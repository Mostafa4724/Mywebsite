"""Tests for the admin .env settings endpoints.

Restarts are never triggered here: every save posts restart=False, and the
restart plumbing is checked separately by asserting the scheduler is called.

Run from the backend/ folder:   python test_settings_admin.py
"""

import os
import shutil
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import mailer

SENT = []
mailer.send_email = lambda *a, **k: SENT.append(a)

import settings_admin  # noqa: E402
import app as app_module  # noqa: E402
from database import db  # noqa: E402
from models import User  # noqa: E402
from werkzeug.security import generate_password_hash  # noqa: E402

app = app_module.app
app.config["TESTING"] = True

PASSED, FAILED = [], []


def check(name, condition, detail=""):
    if condition:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append(f"{name} :: {detail}")
        print(f"  FAIL  {name}  {detail}")


def admin_headers(client):
    tag = uuid.uuid4().hex[:8]
    email = f"settings_admin_{tag}@example.com"
    with app.app_context():
        user = User(
            username=f"settingsadmin{tag}",
            email=email,
            password=generate_password_hash("AdminPass123"),
            role="admin",
            token_version=0,
        )
        db.session.add(user)
        db.session.commit()
        user_id = user.id
    response = client.post("/login", json={"email": email, "password": "AdminPass123"})
    token = (response.get_json() or {}).get("token")
    return {"Authorization": f"Bearer {token}"}, user_id, email


def user_headers(client):
    tag = uuid.uuid4().hex[:8]
    email = f"settings_user_{tag}@example.com"
    with app.app_context():
        user = User(
            username=f"settingsuser{tag}",
            email=email,
            password=generate_password_hash("UserPass123"),
            role="user",
            token_version=0,
        )
        db.session.add(user)
        db.session.commit()
        user_id = user.id
    response = client.post("/login", json={"email": email, "password": "UserPass123"})
    token = (response.get_json() or {}).get("token")
    return {"Authorization": f"Bearer {token}"}, user_id, email


def main():
    client = app.test_client()
    env_path = settings_admin.ENV_PATH
    snapshot = env_path.read_text(encoding="utf-8") if env_path.exists() else None

    # Never restart during the tests.
    restarts = []
    settings_admin.schedule_restart = lambda delay=1.0: restarts.append(delay)

    admin, admin_id, admin_email = admin_headers(client)
    plain, plain_id, plain_email = user_headers(client)

    try:
        print("\n[1] Access control")
        check("anonymous GET is rejected",
              client.get("/admin/settings").status_code == 401)
        check("non-admin GET is rejected (403)",
              client.get("/admin/settings", headers=plain).status_code == 403)
        check("anonymous POST is rejected",
              client.post("/admin/settings", json={"values": {}}).status_code == 401)
        check("non-admin POST is rejected",
              client.post("/admin/settings", json={"values": {}},
                          headers=plain).status_code == 403)
        check("non-admin restart is rejected",
              client.post("/admin/settings/restart",
                          headers=plain).status_code == 403)

        print("\n[2] GET returns the schema with secrets masked")
        response = client.get("/admin/settings", headers=admin)
        body = response.get_json() or {}
        check("GET returns 200", response.status_code == 200, str(body)[:150])
        groups = body.get("groups", [])
        check("schema has groups", len(groups) >= 5, str(len(groups)))
        flat = {f["key"]: f for g in groups for f in g["fields"]}
        check("SECRET_KEY is in the schema", "SECRET_KEY" in flat)
        check("EMAIL_PASSWORD is in the schema", "EMAIL_PASSWORD" in flat)
        check("stored SECRET_KEY is masked",
              flat["SECRET_KEY"]["value"] == settings_admin.MASK,
              str(flat["SECRET_KEY"]["value"]))
        check("masked field reports has_value", flat["SECRET_KEY"]["has_value"] is True)
        check("non-secret STORE_NAME is returned in clear",
              flat["STORE_NAME"]["value"] == "Test Shop",
              str(flat["STORE_NAME"]["value"]))
        raw = response.get_data(as_text=True)
        real_secret = settings_admin.read_env_file().get("SECRET_KEY", "")
        check("the real secret never reaches the client",
              real_secret and real_secret not in raw)

        print("\n[3] Validation refuses bad values and writes nothing")
        before = env_path.read_text(encoding="utf-8")
        bad_cases = [
            ("identical secret keys",
             {"SECRET_KEY": "x" * 20, "JWT_SECRET_KEY": "x" * 20}, "JWT_SECRET_KEY"),
            ("short secret key", {"SECRET_KEY": "short"}, "SECRET_KEY"),
            ("MIN_PASSWORD_LENGTH below 8", {"MIN_PASSWORD_LENGTH": "4"},
             "MIN_PASSWORD_LENGTH"),
            ("non-numeric port", {"EMAIL_PORT": "abc"}, "EMAIL_PORT"),
            ("port out of range", {"EMAIL_PORT": "99999"}, "EMAIL_PORT"),
            ("frontend URL without scheme", {"FRONTEND_BASE_URL": "127.0.0.1:5500"},
             "FRONTEND_BASE_URL"),
            ("frontend URL with trailing slash",
             {"FRONTEND_BASE_URL": "http://127.0.0.1:5500/"}, "FRONTEND_BASE_URL"),
            ("CORS origin without scheme", {"CORS_ORIGINS": "localhost:5500"},
             "CORS_ORIGINS"),
            ("empty required store name", {"STORE_NAME": ""}, "STORE_NAME"),
            ("bad From address", {"EMAIL_FROM": "not-an-email"}, "EMAIL_FROM"),
            ("reset path without slash", {"PASSWORD_RESET_PATH": "page/reset.html"},
             "PASSWORD_RESET_PATH"),
        ]
        for label, values, expect_key in bad_cases:
            r = client.post("/admin/settings",
                            json={"values": values, "restart": False}, headers=admin)
            data = r.get_json() or {}
            ok = r.status_code == 400 and expect_key in (data.get("errors") or {})
            check(f"rejects {label}", ok,
                  f"{r.status_code} {str(data.get('errors'))[:120]}")
        check("no write happened during validation failures",
              env_path.read_text(encoding="utf-8") == before)

        print("\n[4] A valid save round-trips")
        save = client.post("/admin/settings", json={
            "values": {
                "STORE_NAME": "Misbar Shop",
                "STORE_PHONE": "+20 100 000 0000",
                "EMAIL_PORT": "587",
                "SECRET_KEY": settings_admin.MASK,
                "JWT_SECRET_KEY": settings_admin.MASK,
            },
            "restart": False,
        }, headers=admin)
        save_body = save.get_json() or {}
        check("save returns 200", save.status_code == 200, str(save_body)[:200])
        check("save did not schedule a restart when asked not to", not restarts)
        stored = settings_admin.read_env_file()
        check("new STORE_NAME persisted", stored.get("STORE_NAME") == "Misbar Shop",
              stored.get("STORE_NAME"))
        check("value with spaces round-trips",
              stored.get("STORE_PHONE") == "+20 100 000 0000",
              repr(stored.get("STORE_PHONE")))
        check("masked SECRET_KEY was preserved, not overwritten with the mask",
              stored.get("SECRET_KEY") == real_secret,
              repr(stored.get("SECRET_KEY")))
        check("the mask string was never written to the file",
              settings_admin.MASK not in env_path.read_text(encoding="utf-8"))
        check("a .bak backup was created",
              (env_path.parent / ".env.bak").exists())
        check("os.environ was refreshed in-process",
              os.environ.get("STORE_NAME") == "Misbar Shop",
              os.environ.get("STORE_NAME"))

        print("\n[5] Comments and unmanaged keys survive a save")
        with open(env_path, "a", encoding="utf-8") as handle:
            handle.write("\n# a comment the admin wrote by hand\n")
            handle.write("MY_CUSTOM_KEY=keep-me\n")
        client.post("/admin/settings",
                    json={"values": {"STORE_NAME": "Second Save"}, "restart": False},
                    headers=admin)
        text = env_path.read_text(encoding="utf-8")
        check("hand-written comment preserved",
              "# a comment the admin wrote by hand" in text)
        check("unmanaged key preserved",
              settings_admin.read_env_file().get("MY_CUSTOM_KEY") == "keep-me")
        check("no duplicate STORE_NAME lines",
              text.count("\nSTORE_NAME=") + text.startswith("STORE_NAME=") == 1,
              str(text.count("STORE_NAME=")))

        print("\n[6] A secret can actually be changed")
        client.post("/admin/settings", json={
            "values": {"BANK_ACCOUNT_NUMBER": "EG380019000500000000263180002"},
            "restart": False,
        }, headers=admin)
        check("new secret written",
              settings_admin.read_env_file().get("BANK_ACCOUNT_NUMBER")
              == "EG380019000500000000263180002")
        again = client.get("/admin/settings", headers=admin).get_json() or {}
        flat2 = {f["key"]: f for g in again.get("groups", []) for f in g["fields"]}
        check("the new secret comes back masked",
              flat2["BANK_ACCOUNT_NUMBER"]["value"] == settings_admin.MASK)

        print("\n[7] Quoting survives awkward values")
        tricky = 'Ahmed "The Shop" #1'
        client.post("/admin/settings",
                    json={"values": {"BANK_ACCOUNT_NAME": tricky}, "restart": False},
                    headers=admin)
        check("quotes and hash round-trip",
              settings_admin.read_env_file().get("BANK_ACCOUNT_NAME") == tricky,
              repr(settings_admin.read_env_file().get("BANK_ACCOUNT_NAME")))
        from dotenv import dotenv_values
        check("python-dotenv reads the same value back",
              dotenv_values(env_path).get("BANK_ACCOUNT_NAME") == tricky,
              repr(dotenv_values(env_path).get("BANK_ACCOUNT_NAME")))

        print("\n[8] The saved file still boots Config.validate()")
        import importlib
        from dotenv import load_dotenv
        load_dotenv(env_path, override=True)
        import config as config_module
        try:
            importlib.reload(config_module)
            check("config.py imports cleanly after the save", True)
        except Exception as error:
            check("config.py imports cleanly after the save", False, str(error))

        print("\n[9] Save with restart=True schedules exactly one restart")
        restarts.clear()
        r = client.post("/admin/settings",
                        json={"values": {"STORE_NAME": "Restart Test"},
                              "restart": True},
                        headers=admin)
        check("restart save returns 200", r.status_code == 200)
        check("exactly one restart scheduled", len(restarts) == 1, str(restarts))
        check("response flags restarting", (r.get_json() or {}).get("restarting") is True)
        restarts.clear()
        r = client.post("/admin/settings/restart", headers=admin)
        check("explicit restart endpoint works",
              r.status_code == 200 and len(restarts) == 1)
        restarts.clear()

        print("\n[10] Test-email endpoint")
        SENT.clear()
        r = client.post("/admin/settings/test-email",
                        json={"recipient": "not-an-email", "values": {}},
                        headers=admin)
        check("invalid recipient rejected", r.status_code == 400)
        r = client.post("/admin/settings/test-email", json={
            "recipient": "target@example.com",
            "values": {"EMAIL_HOST": "smtp.example.com", "EMAIL_PORT": "587",
                       "EMAIL_USERNAME": "sender@example.com",
                       "EMAIL_PASSWORD": "app-password"},
        }, headers=admin)
        check("test email accepted", r.status_code == 200, str(r.get_json())[:150])
        check("mailer was called once", len(SENT) == 1)
        check("test email addressed correctly",
              SENT and SENT[0][0] == "target@example.com")
        check("form SMTP values were not persisted to .env",
              settings_admin.read_env_file().get("EMAIL_HOST") == "smtp.gmail.com",
              settings_admin.read_env_file().get("EMAIL_HOST"))
        check("os.environ restored after the test send",
              os.environ.get("EMAIL_HOST") == "smtp.gmail.com",
              os.environ.get("EMAIL_HOST"))

        def boom(*a, **k):
            raise OSError("Connection refused")
        original = mailer.send_email
        mailer.send_email = boom
        r = client.post("/admin/settings/test-email", json={
            "recipient": "target@example.com",
            "values": {"EMAIL_HOST": "smtp.example.com",
                       "EMAIL_USERNAME": "sender@example.com",
                       "EMAIL_PASSWORD": "pw"},
        }, headers=admin)
        body = r.get_json() or {}
        check("SMTP failure reported as 502", r.status_code == 502)
        check("failure message names the real error",
              "Connection refused" in str(body.get("message")), str(body)[:150])
        mailer.send_email = original

        print("\n[11] Missing SMTP fields are caught before dialling out")
        r = client.post("/admin/settings/test-email", json={
            "recipient": "target@example.com",
            "values": {"EMAIL_HOST": "", "EMAIL_USERNAME": "", "EMAIL_PASSWORD": ""},
        }, headers=admin)
        check("blank SMTP config rejected with 400", r.status_code == 400,
              str(r.get_json())[:150])

    finally:
        if snapshot is not None:
            env_path.write_text(snapshot, encoding="utf-8")
        for extra in (".env.bak", ".env.tmp"):
            candidate = env_path.parent / extra
            if candidate.exists():
                candidate.unlink()
        with app.app_context():
            User.query.filter(User.id.in_([admin_id, plain_id])).delete(
                synchronize_session=False)
            db.session.commit()

    print("\n" + "=" * 60)
    print(f"PASSED: {len(PASSED)}    FAILED: {len(FAILED)}")
    if FAILED:
        print("\nFailures:")
        for f in FAILED:
            print("  -", f)
    print("=" * 60)
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
