"""Admin-only editor for the .env file, plus a controlled server restart.

Everything the site reads from the environment is declared once in
SETTINGS_SCHEMA below. The admin page renders itself from that schema, so
adding a new setting means adding one dict here and nothing else.

Endpoints (all require an admin JWT):

    GET  /admin/settings              schema + current values (secrets masked)
    POST /admin/settings              validate, write .env, optionally restart
    POST /admin/settings/test-email   send a test email with the given SMTP values
    POST /admin/settings/restart      restart the server without saving

Safety notes
------------
* Values are validated *before* the file is written. config.py raises at
  import time on a bad SECRET_KEY, so an unchecked save would put the server
  into a restart loop it cannot recover from through the browser.
* The existing .env is backed up to .env.bak on every successful save.
* Comments, blank lines and keys this module does not manage are preserved.
"""

import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request

from security import admin_required


settings_bp = Blueprint("settings_admin", __name__)

# Regenerated every time this module is imported, which means once per
# process. The admin page records it before saving and polls until it
# changes -- that is the only reliable proof the restart really happened,
# because the dev reloader keeps the listening socket open across restarts
# and the port therefore never goes quiet.
BOOT_ID = uuid.uuid4().hex
BOOT_TIME = datetime.now().isoformat(timespec="seconds")

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Sent to the browser in place of a stored secret. If it comes back unchanged
# the saved value is kept, so secrets never travel to the client.
MASK = "********"


# ============================================================
# Schema
# ============================================================
#
# type:     text | password | number | email | url | textarea | select
# secret:   value is masked on read and only written when actually changed
# required: save is refused when empty
# restart:  changing it only takes effect after a restart (informational)

SETTINGS_SCHEMA = [
    {
        "group": "Security keys",
        "note": "Long random values. Changing them signs every user out, "
                "including you.",
        "fields": [
            {"key": "SECRET_KEY", "label": "Flask secret key", "type": "password",
             "secret": True, "required": True, "min_length": 16,
             "help": "At least 16 characters. Must be different from the JWT key."},
            {"key": "JWT_SECRET_KEY", "label": "JWT secret key", "type": "password",
             "secret": True, "required": True, "min_length": 16,
             "help": "Signs login tokens. Must be different from the Flask key."},
            {"key": "ACCESS_TOKEN_MINUTES", "label": "Access token lifetime (minutes)",
             "type": "number", "default": "60", "min": 5, "max": 1440},
            {"key": "REFRESH_TOKEN_DAYS", "label": "Refresh token lifetime (days)",
             "type": "number", "default": "30", "min": 1, "max": 365},
            {"key": "MIN_PASSWORD_LENGTH", "label": "Minimum password length",
             "type": "number", "default": "8", "min": 8, "max": 128,
             "help": "The server refuses to start if this is below 8."},
        ],
    },
    {
        "group": "Site addresses",
        "note": "Where the frontend lives and which origins may call the API.",
        "fields": [
            {"key": "FRONTEND_BASE_URL", "label": "Frontend base URL", "type": "url",
             "default": "http://127.0.0.1:5500", "required": True,
             "help": "No trailing slash. Used to build links inside emails."},
            {"key": "CORS_ORIGINS", "label": "Allowed origins (CORS)", "type": "textarea",
             "default": "http://127.0.0.1:5500,http://localhost:5500", "required": True,
             "help": "Comma-separated. Every origin the browser loads the site from."},
            {"key": "PASSWORD_RESET_PATH", "label": "Password reset page path",
             "type": "text", "default": "/page/reset-password.html",
             "help": "Appended to the frontend base URL in reset emails."},
        ],
    },
    {
        "group": "Email (SMTP)",
        "note": "Used for registration verification and password resets. "
                "For Gmail this must be a 16-character App Password, not your "
                "normal password.",
        "fields": [
            {"key": "EMAIL_HOST", "label": "SMTP host", "type": "text",
             "default": "smtp.gmail.com", "required": True},
            {"key": "EMAIL_PORT", "label": "SMTP port", "type": "number",
             "default": "587", "min": 1, "max": 65535,
             "help": "587 for STARTTLS, which is what the mailer uses."},
            # Deliberately not type "email": SendGrid's username is the
            # literal word "apikey", Resend's is "resend", and Brevo issues
            # an SMTP login that is not an address either.
            {"key": "EMAIL_USERNAME", "label": "SMTP username", "type": "text",
             "required": True,
             "help": "Often the mailbox address, but some services issue a "
                     "separate login. Use whatever their dashboard shows."},
            {"key": "EMAIL_PASSWORD", "label": "SMTP password / app password",
             "type": "password", "secret": True, "required": True},
            {"key": "EMAIL_FROM", "label": "From address", "type": "email",
             "help": "Leave empty to send as the SMTP username."},
        ],
    },
    {
        "group": "Registration & verification",
        "fields": [
            {"key": "REGISTRATION_VERIFICATION_MINUTES",
             "label": "Verification code lifetime (minutes)", "type": "number",
             "default": "10", "min": 1, "max": 120},
            {"key": "REGISTRATION_MAX_PER_HOUR",
             "label": "Max verification emails per address per hour",
             "type": "number", "default": "5", "min": 1, "max": 50},
            {"key": "REGISTRATION_RESEND_COOLDOWN_SECONDS",
             "label": "Duplicate-submit window (seconds)", "type": "number",
             "default": "60", "min": 0, "max": 3600,
             "help": "Repeat submits inside this window reuse the same email "
                     "instead of sending another."},
            {"key": "PASSWORD_RESET_MINUTES", "label": "Reset link lifetime (minutes)",
             "type": "number", "default": "30", "min": 1, "max": 240},
            {"key": "PASSWORD_RESET_MAX_PER_HOUR",
             "label": "Max reset emails per address per hour", "type": "number",
             "default": "5", "min": 1, "max": 50},
        ],
    },
    {
        "group": "Store identity",
        "note": "Shown in email headers and footers.",
        "fields": [
            {"key": "STORE_NAME", "label": "Store name", "type": "text",
             "default": "Your Shop", "required": True},
            {"key": "STORE_EMAIL", "label": "Contact email", "type": "email"},
            {"key": "STORE_PHONE", "label": "Contact phone", "type": "text"},
            {"key": "STORE_WEBSITE", "label": "Public website", "type": "url"},
            {"key": "STORE_LOGO_URL", "label": "Logo URL", "type": "url"},
        ],
    },
    {
        "group": "Google sign-in",
        "fields": [
            {"key": "GOOGLE_CLIENT_ID", "label": "Google OAuth client ID",
             "type": "text",
             "help": "Leave empty to hide the Google button on the login page."},
        ],
    },
    {
        "group": "Bank transfer details",
        "note": "Shown to customers on the checkout page.",
        "fields": [
            {"key": "BANK_NAME", "label": "Bank name", "type": "text"},
            {"key": "BANK_ACCOUNT_NAME", "label": "Account holder", "type": "text"},
            {"key": "BANK_ACCOUNT_NUMBER", "label": "Account number / IBAN",
             "type": "password", "secret": True},
            {"key": "BANK_ROUTING_NUMBER", "label": "Routing / SWIFT code",
             "type": "password", "secret": True},
        ],
    },
    {
        "group": "SMS (Twilio, optional)",
        "fields": [
            {"key": "TWILIO_ACCOUNT_SID", "label": "Account SID", "type": "text"},
            {"key": "TWILIO_AUTH_TOKEN", "label": "Auth token", "type": "password",
             "secret": True},
            {"key": "TWILIO_FROM_NUMBER", "label": "From number", "type": "text",
             "help": "E.164 format, for example +201234567890."},
        ],
    },
]


def _all_fields():
    for group in SETTINGS_SCHEMA:
        for field in group["fields"]:
            yield field


FIELDS_BY_KEY = {field["key"]: field for field in _all_fields()}
MANAGED_KEYS = list(FIELDS_BY_KEY)


# ============================================================
# .env parsing and writing
# ============================================================

_LINE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$")


def _unquote(raw):
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        inner = value[1:-1]
        if value[0] == '"':
            inner = (inner.replace("\\n", "\n")
                          .replace("\\t", "\t")
                          .replace('\\"', '"')
                          .replace("\\\\", "\\"))
        return inner
    # An unquoted value ends at an inline comment.
    if " #" in value:
        value = value.split(" #", 1)[0].rstrip()
    return value


def _quote(value):
    text = str(value if value is not None else "")
    if text == "":
        return ""
    needs_quotes = any(ch in text for ch in " \t\"'#$\\\n") or text != text.strip()
    if not needs_quotes:
        return text
    escaped = (text.replace("\\", "\\\\")
                   .replace('"', '\\"')
                   .replace("\n", "\\n")
                   .replace("\t", "\\t"))
    return f'"{escaped}"'


def read_env_file():
    """Return {key: value} for the .env file, or {} when it does not exist."""
    if not ENV_PATH.exists():
        return {}
    values = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = _LINE.match(line)
        if match:
            values[match.group(1)] = _unquote(match.group(2))
    return values


def write_env_file(updates):
    """Rewrite .env with `updates` applied, preserving comments and other keys."""
    existing_lines = []
    if ENV_PATH.exists():
        existing_lines = ENV_PATH.read_text(encoding="utf-8").splitlines()

    remaining = dict(updates)
    output = []

    for line in existing_lines:
        match = _LINE.match(line)
        if match and match.group(1) in remaining:
            key = match.group(1)
            output.append(f"{key}={_quote(remaining.pop(key))}")
        else:
            output.append(line)

    if remaining:
        if output and output[-1].strip():
            output.append("")
        output.append(f"# Added by the admin settings page on "
                      f"{datetime.now():%Y-%m-%d %H:%M}")
        for group in SETTINGS_SCHEMA:
            group_keys = [f["key"] for f in group["fields"] if f["key"] in remaining]
            if not group_keys:
                continue
            output.append(f"# --- {group['group']} ---")
            for key in group_keys:
                output.append(f"{key}={_quote(remaining.pop(key))}")
            output.append("")
        for key, value in remaining.items():
            output.append(f"{key}={_quote(value)}")

    if ENV_PATH.exists():
        shutil.copy2(ENV_PATH, Path(str(ENV_PATH) + ".bak"))

    temp_path = Path(str(ENV_PATH) + ".tmp")
    temp_path.write_text("\n".join(output).rstrip("\n") + "\n", encoding="utf-8")
    os.replace(temp_path, ENV_PATH)

    try:
        os.chmod(ENV_PATH, 0o600)
    except OSError:
        # Windows and some mounted filesystems do not support this.
        pass


# ============================================================
# Validation
# ============================================================

_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


def validate(values):
    """Return a {key: message} dict of problems. Empty means the save is safe."""
    errors = {}

    for key, field in FIELDS_BY_KEY.items():
        raw = values.get(key, "")
        text = str(raw or "").strip()

        if not text:
            if field.get("required"):
                errors[key] = "This field is required."
            continue

        kind = field.get("type")

        if kind == "number":
            if not re.fullmatch(r"-?\d+", text):
                errors[key] = "Enter a whole number."
                continue
            number = int(text)
            if "min" in field and number < field["min"]:
                errors[key] = f"Must be {field['min']} or more."
            elif "max" in field and number > field["max"]:
                errors[key] = f"Must be {field['max']} or less."

        elif kind == "email":
            if not _EMAIL_RE.fullmatch(text):
                errors[key] = "Enter a valid email address."

        elif kind == "url":
            if not re.match(r"^https?://", text, re.I):
                errors[key] = "Must start with http:// or https://"
            elif text.endswith("/") and key == "FRONTEND_BASE_URL":
                errors[key] = "Remove the trailing slash."

        if "min_length" in field and len(text) < field["min_length"]:
            errors[key] = f"Must be at least {field['min_length']} characters."

        if "\n" in str(raw) and kind != "textarea":
            errors[key] = "Line breaks are not allowed here."

    # Cross-field rules that mirror Config.validate(), so a save can never
    # produce a .env the server refuses to boot with.
    secret = str(values.get("SECRET_KEY", "") or "").strip()
    jwt_secret = str(values.get("JWT_SECRET_KEY", "") or "").strip()
    if secret and jwt_secret and secret == jwt_secret:
        errors["JWT_SECRET_KEY"] = "Must be different from the Flask secret key."

    origins = str(values.get("CORS_ORIGINS", "") or "").strip()
    if origins:
        bad = [o.strip() for o in origins.split(",")
               if o.strip() and not re.match(r"^https?://", o.strip(), re.I)]
        if bad:
            errors["CORS_ORIGINS"] = (
                "Each origin must start with http:// or https:// "
                f"(check: {', '.join(bad[:3])})"
            )

    path = str(values.get("PASSWORD_RESET_PATH", "") or "").strip()
    if path and not path.startswith("/"):
        errors["PASSWORD_RESET_PATH"] = "Must start with /"

    return errors


def merge_submitted(submitted):
    """Combine posted values with the stored ones, keeping masked secrets."""
    stored = read_env_file()
    merged = {}
    for key, field in FIELDS_BY_KEY.items():
        # A page that posts only part of the schema (the email setup wizard,
        # for example) must not wipe out the rest or trip the "required"
        # check on a key it never showed. Fall back to the stored value, then
        # to the declared default -- which is what the form displays anyway.
        fallback = stored.get(key) or field.get("default", "")

        if key not in submitted:
            merged[key] = fallback
            continue

        value = submitted.get(key)
        value = "" if value is None else str(value).strip()

        if field.get("secret") and value == MASK:
            merged[key] = stored.get(key, "")
        else:
            merged[key] = value
    return merged


# ============================================================
# Restart
# ============================================================

def _restart_now():
    """Replace this process with a fresh one running the same command."""
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        # The dev reloader is watching imported modules; touching one is the
        # cleanest possible restart because the parent handles the socket.
        Path(__file__).touch()
        return

    args = [sys.executable] + sys.argv
    if os.name == "nt":
        # os.execv detaches the console on Windows, so spawn and exit instead.
        subprocess.Popen(args, cwd=os.getcwd(), close_fds=False)
        os._exit(0)
    else:
        os.execv(sys.executable, args)


def schedule_restart(delay=1.0):
    """Restart shortly after the current response has been flushed."""
    def run():
        time.sleep(delay)
        try:
            _restart_now()
        except Exception:
            current_app.logger.exception("Automatic restart failed.")

    threading.Thread(target=run, daemon=True).start()


def restart_supported():
    return os.environ.get("WERKZEUG_RUN_MAIN") == "true" or bool(sys.argv)


# ============================================================
# Routes
# ============================================================

@settings_bp.get("/admin/settings")
@admin_required
def get_settings():
    stored = read_env_file()
    groups = []

    for group in SETTINGS_SCHEMA:
        fields = []
        for field in group["fields"]:
            key = field["key"]
            raw = stored.get(key, "")
            has_value = bool(str(raw).strip())
            item = {k: v for k, v in field.items()}
            item["has_value"] = has_value
            if field.get("secret"):
                item["value"] = MASK if has_value else ""
            else:
                item["value"] = raw if has_value else field.get("default", "")
            fields.append(item)
        groups.append({
            "group": group["group"],
            "note": group.get("note", ""),
            "fields": fields,
        })

    return jsonify(
        success=True,
        boot_id=BOOT_ID,
        env_path=str(ENV_PATH),
        env_exists=ENV_PATH.exists(),
        mask=MASK,
        restart_supported=restart_supported(),
        groups=groups,
    )


@settings_bp.post("/admin/settings")
@admin_required
def save_settings():
    from dotenv import load_dotenv

    data = request.get_json(silent=True) or {}
    submitted = data.get("values") or {}
    if not isinstance(submitted, dict):
        return jsonify(success=False, message="Invalid payload."), 400

    merged = merge_submitted(submitted)
    errors = validate(merged)
    if errors:
        return jsonify(
            success=False,
            message="Some values need fixing. Nothing was saved.",
            errors=errors,
        ), 400

    secrets_changed = any(
        FIELDS_BY_KEY[key].get("secret")
        and str(submitted.get(key, MASK)).strip() not in (MASK, "")
        for key in ("SECRET_KEY", "JWT_SECRET_KEY")
        if key in submitted
    )

    try:
        write_env_file(merged)
    except OSError as error:
        current_app.logger.exception("Could not write .env")
        return jsonify(
            success=False,
            message=f"Could not write {ENV_PATH}: {error}",
        ), 500

    # Make the new values live for this process too, so anything that reads
    # os.getenv at request time picks them up even before the restart lands.
    load_dotenv(ENV_PATH, override=True)

    should_restart = bool(data.get("restart", True))
    if should_restart:
        schedule_restart(1.0)

    return jsonify(
        success=True,
        boot_id=BOOT_ID,
        message=("Settings saved. The server is restarting..."
                 if should_restart else "Settings saved."),
        restarting=should_restart,
        signed_out=secrets_changed,
        saved_keys=sorted(merged),
    )


@settings_bp.post("/admin/settings/test-email")
@admin_required
def test_email():
    """Send a test message using the posted SMTP values without saving them."""
    import mailer

    data = request.get_json(silent=True) or {}
    recipient = str(data.get("recipient") or "").strip()
    if not _EMAIL_RE.fullmatch(recipient):
        return jsonify(success=False, message="Enter a valid test address."), 400

    merged = merge_submitted(data.get("values") or {})

    missing = [k for k in ("EMAIL_HOST", "EMAIL_USERNAME", "EMAIL_PASSWORD")
               if not str(merged.get(k, "")).strip()]
    if missing:
        return jsonify(
            success=False,
            message="Fill in " + ", ".join(missing) + " first.",
        ), 400

    keys = ("EMAIL_HOST", "EMAIL_PORT", "EMAIL_USERNAME",
            "EMAIL_PASSWORD", "EMAIL_FROM", "STORE_NAME")
    previous = {k: os.environ.get(k) for k in keys}
    try:
        for key in keys:
            value = str(merged.get(key, "") or "")
            if value:
                os.environ[key] = value
            else:
                os.environ.pop(key, None)

        store = os.environ.get("STORE_NAME", "Your Shop")
        mailer.send_email(
            recipient,
            f"{store} - SMTP test",
            "This is a test message from the admin settings page.\n"
            "If you can read this, registration and password-reset emails "
            "will work.",
            "<p>This is a test message from the admin settings page.</p>"
            "<p>If you can read this, registration and password-reset "
            "emails will work.</p>",
        )
    except Exception as error:
        current_app.logger.exception("Test email failed")
        return jsonify(
            success=False,
            message=f"{type(error).__name__}: {error}",
        ), 502
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    return jsonify(success=True, message=f"Test email sent to {recipient}.")


@settings_bp.get("/admin/settings/boot")
def boot_marker():
    """Opaque per-process id, so the browser can tell a restart really landed.

    Deliberately unauthenticated: it returns a random string and a start
    time, nothing about the configuration. The admin page has to be able to
    poll it during the window where its own token may be on its way out.
    """
    return jsonify(success=True, boot_id=BOOT_ID, started_at=BOOT_TIME)


@settings_bp.post("/admin/settings/restart")
@admin_required
def restart_server():
    schedule_restart(1.0)
    return jsonify(success=True, boot_id=BOOT_ID, message="Restarting...")
