"""The handover flow, end to end.

Plays the customer's actual journey: receive a shop with the delivery
login, be warned about it, replace the credentials, and sign back in with
the new ones. The bug this suite exists to prevent is the obvious one --
the panel says "saved" but the database still holds Admin@gmail.com, so
the owner is locked out of their own shop.

Run from backend/:  python test_onboarding.py
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import mailer
mailer.send_email = lambda *a, **k: None

import onboarding  # noqa: E402
import app as app_module  # noqa: E402
from database import db  # noqa: E402
from models import User  # noqa: E402
from werkzeug.security import generate_password_hash  # noqa: E402

app = app_module.app
app.config["TESTING"] = True

DEFAULT_PASSWORD = "Admin@1234"

PASSED, FAILED = [], []


def check(name, condition, detail=""):
    if condition:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append(f"{name} :: {detail}")
        print(f"  FAIL  {name}  {detail}")


def login(client, email, password):
    response = client.post("/login", json={"email": email, "password": password})
    return response, (response.get_json() or {})


def headers(tok):
    return {"Authorization": f"Bearer {tok}"}


def row(user_id):
    with app.app_context():
        user = db.session.get(User, user_id)
        return (user.id, user.email, user.username, user.role) if user else None


def main():
    client = app.test_client()
    tag = uuid.uuid4().hex[:8]

    # The shop as Misbar hands it over.
    default_email = f"Admin_{tag}@gmail.com"
    os.environ["DEFAULT_ADMIN_EMAIL"] = default_email
    os.environ["DEFAULT_ADMIN_PASSWORD"] = DEFAULT_PASSWORD

    with app.app_context():
        admin = User(
            username=f"Admin{tag}",
            email=default_email,
            password=generate_password_hash(DEFAULT_PASSWORD),
            role="admin",
            token_version=0,
        )
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

    other_ids = []
    try:
        print("\n[1] The customer signs in with the delivery login")
        response, body = login(client, default_email, DEFAULT_PASSWORD)
        check("delivery login works", response.status_code == 200, str(body)[:150])
        tok = body.get("token")
        check("a token was issued", bool(tok))

        print("\n[2] The panel knows the shop is not secured yet")
        status = client.get("/admin/setup-status", headers=headers(tok))
        data = status.get_json() or {}
        check("setup-status returns 200", status.status_code == 200, str(data)[:150])
        check("account reported as NOT secure", data.get("account_secure") is False)
        check("default email detected", data.get("using_default_email") is True)
        check("default password detected", data.get("using_default_password") is True)
        tasks = data.get("tasks") or []
        account_task = next((t for t in tasks if t["id"] == "account"), None)
        check("an account task is emitted", account_task is not None)
        check("the task targets the security sidebar link",
              account_task and account_task["section"] == "security")
        check("the task is marked urgent", account_task and account_task["urgent"] is True)
        check("the wording is the promised one",
              account_task and account_task["title"] == "Please secure your account",
              account_task and account_task["title"])

        print("\n[3] A password change alone is not enough to clear the warning")
        interim = client.post("/admin/account", headers=headers(tok), json={
            "current_password": DEFAULT_PASSWORD,
            "new_password": "Interim@9876",
            "confirm_password": "Interim@9876",
        })
        interim_body = interim.get_json() or {}
        check("password-only change accepted", interim.status_code == 200,
              str(interim_body)[:200])
        tok = interim_body.get("token")
        check("fresh token returned so the browser stays in", bool(tok))
        still = (client.get("/admin/setup-status", headers=headers(tok)).get_json() or {})
        check("still flagged: the delivery EMAIL is unchanged",
              still.get("account_secure") is False)
        check("password no longer the default",
              still.get("using_default_password") is False)
        check("email still the default", still.get("using_default_email") is True)

        print("\n[4] Ahmed replaces name, email and password together")
        new_email = f"ahmed_{tag}@gmail.com"
        save = client.post("/admin/account", headers=headers(tok), json={
            "current_password": "Interim@9876",
            "username": f"ahmed{tag}",
            "email": new_email,
            "new_password": "Ahmed@1234",
            "confirm_password": "Ahmed@1234",
        })
        save_body = save.get_json() or {}
        check("save returns 200", save.status_code == 200, str(save_body)[:200])
        check("all three reported as changed",
              sorted(save_body.get("changed", [])) == ["email", "password", "username"],
              str(save_body.get("changed")))
        check("response says the account is now secure",
              save_body.get("account_secure") is True)

        print("\n[5] THE DATABASE ROW ACTUALLY CHANGED")
        current = row(admin_id)
        check("email column updated in the database",
              current and current[1] == new_email, str(current))
        check("username column updated", current and current[2] == f"ahmed{tag}",
              str(current))
        check("still an admin", current and current[3] == "admin", str(current))
        with app.app_context():
            user = db.session.get(User, admin_id)
            check("password hash verifies against the new password",
                  user.check_password("Ahmed@1234"))
            check("the delivery password no longer works on the hash",
                  not user.check_password(DEFAULT_PASSWORD))

        print("\n[6] Ahmed can sign in fresh with what he chose")
        response, body = login(client, new_email, "Ahmed@1234")
        check("login with the new email and password works",
              response.status_code == 200, str(body)[:150])
        check("logged in as admin",
              (body.get("user") or {}).get("role") == "admin", str(body.get("user")))
        new_tok = body.get("token")

        print("\n[7] The delivery login is dead")
        response, body = login(client, default_email, DEFAULT_PASSWORD)
        check("old email + old password rejected", response.status_code != 200,
              str(body)[:120])
        response, body = login(client, default_email, "Ahmed@1234")
        check("old email + new password rejected", response.status_code != 200,
              str(body)[:120])
        response, body = login(client, new_email, DEFAULT_PASSWORD)
        check("new email + old password rejected", response.status_code != 200,
              str(body)[:120])

        print("\n[8] The warning is gone and the next task appears")
        after = (client.get("/admin/setup-status",
                            headers=headers(new_tok)).get_json() or {})
        check("account now reported secure", after.get("account_secure") is True)
        ids = [t["id"] for t in (after.get("tasks") or [])]
        check("the account task disappeared", "account" not in ids, str(ids))

        print("\n[9] Old sessions elsewhere were signed out")
        old = client.get("/admin/setup-status", headers=headers(tok))
        check("the token from before the password change is dead",
              old.status_code == 401, str(old.status_code))

        print("\n[10] The current password is always required")
        bad = client.post("/admin/account", headers=headers(new_tok), json={
            "current_password": "wrong-password",
            "email": f"attacker_{tag}@evil.com",
            "new_password": "Attacker@1234",
            "confirm_password": "Attacker@1234",
        })
        check("wrong current password rejected", bad.status_code == 400)
        check("the error points at the right field",
              "current_password" in (bad.get_json() or {}).get("errors", {}))
        check("nothing was changed by the attempt", row(admin_id)[1] == new_email)

        print("\n[11] Validation")
        cases = [
            ("mismatched confirmation",
             {"new_password": "Zzz@123456", "confirm_password": "Different@1"},
             "confirm_password"),
            ("password too short", {"new_password": "abc", "confirm_password": "abc"},
             "new_password"),
            ("reusing the delivery password",
             {"new_password": DEFAULT_PASSWORD, "confirm_password": DEFAULT_PASSWORD},
             "new_password"),
            ("going back to the delivery email", {"email": default_email}, "email"),
            ("invalid email", {"email": "not-an-email"}, "email"),
            ("username with spaces", {"username": "ahmed hassan"}, "username"),
            ("username too short", {"username": "ab"}, "username"),
        ]
        for label, extra, field in cases:
            payload = {"current_password": "Ahmed@1234"}
            payload.update(extra)
            r = client.post("/admin/account", headers=headers(new_tok), json=payload)
            errors = (r.get_json() or {}).get("errors", {})
            check(f"rejects {label}", r.status_code == 400 and field in errors,
                  f"{r.status_code} {errors}")

        print("\n[12] Cannot take an address another account already uses")
        with app.app_context():
            taken = User(
                username=f"shopper{tag}",
                email=f"shopper_{tag}@gmail.com",
                password=generate_password_hash("Shopper@1234"),
                role="user",
                token_version=0,
            )
            db.session.add(taken)
            db.session.commit()
            other_ids.append(taken.id)
        r = client.post("/admin/account", headers=headers(new_tok), json={
            "current_password": "Ahmed@1234",
            "email": f"shopper_{tag}@gmail.com",
        })
        check("duplicate email rejected",
              r.status_code == 400 and "email" in (r.get_json() or {}).get("errors", {}),
              str(r.get_json())[:150])
        check("the customer's own account was untouched",
              row(taken.id)[1] == f"shopper_{tag}@gmail.com")

        print("\n[13] A shop customer cannot reach any of this")
        _, shopper = login(client, f"shopper_{tag}@gmail.com", "Shopper@1234")
        shopper_tok = shopper.get("token")
        check("shopper is not an admin",
              (shopper.get("user") or {}).get("role") != "admin")
        check("shopper blocked from setup-status",
              client.get("/admin/setup-status",
                         headers=headers(shopper_tok)).status_code == 403)
        check("shopper blocked from changing the admin account",
              client.post("/admin/account", headers=headers(shopper_tok), json={
                  "current_password": "Shopper@1234",
                  "email": f"hijack_{tag}@evil.com",
              }).status_code == 403)
        check("anonymous blocked",
              client.post("/admin/account", json={}).status_code == 401)
        check("the admin row survived all of that", row(admin_id)[1] == new_email)

        print("\n[14] Changing nothing is refused rather than silently 'saved'")
        r = client.post("/admin/account", headers=headers(new_tok), json={
            "current_password": "Ahmed@1234",
            "username": f"ahmed{tag}",
            "email": new_email,
        })
        check("no-op save rejected", r.status_code == 400, str(r.get_json())[:150])

    finally:
        with app.app_context():
            User.query.filter(User.id.in_([admin_id] + other_ids)).delete(
                synchronize_session=False)
            db.session.commit()
        os.environ.pop("DEFAULT_ADMIN_EMAIL", None)
        os.environ.pop("DEFAULT_ADMIN_PASSWORD", None)

    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASSED)}    FAILED: {len(FAILED)}")
    for f in FAILED:
        print("  -", f)
    print("=" * 62)
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
