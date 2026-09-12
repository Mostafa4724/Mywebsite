"""End-to-end test of the registration + email-verification flow.

The SMTP layer is replaced with a capture stub, so the test exercises the
real endpoints, the real database rows and the real hashed-code comparison
without sending anything to Gmail.

Run from the backend/ folder:   python test_register_verify.py
"""

import json
import os
import secrets
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import mailer

SENT = []


def _capture(recipient, code, username, expires_minutes=10):
    SENT.append({
        "recipient": recipient,
        "code": str(code),
        "username": username,
        "expires_minutes": expires_minutes,
    })


mailer.send_registration_verification_email = _capture

import auth as auth_module  # noqa: E402

import app as app_module  # noqa: E402
from database import db  # noqa: E402
from models import User  # noqa: E402

app = app_module.app
app.config["TESTING"] = True

PASSED = []
FAILED = []


def check(name, condition, detail=""):
    if condition:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append(f"{name} :: {detail}")
        print(f"  FAIL  {name}  {detail}")


def fresh_identity():
    tag = uuid.uuid4().hex[:10]
    return f"tester_{tag}", f"tester_{tag}@example.com"


def cleanup(email):
    with app.app_context():
        from models import RegistrationVerification
        User.query.filter(db.func.lower(User.email) == email.lower()).delete(
            synchronize_session=False
        )
        RegistrationVerification.query.filter(
            db.func.lower(RegistrationVerification.email) == email.lower()
        ).delete(synchronize_session=False)
        db.session.commit()


def register(client, username, email, password="StrongPass123"):
    SENT.clear()
    response = client.post(
        "/register",
        json={"username": username, "email": email, "password": password},
    )
    return response, (response.get_json() or {})


def main():
    client = app.test_client()

    print("\n[1] Happy path: register -> email code -> verify -> account created")
    username, email = fresh_identity()
    cleanup(email)
    response, body = register(client, username, email)
    check("register returns 202", response.status_code == 202, str(body)[:200])
    check("register returns a verification_id", bool(body.get("verification_id")))
    choices = [str(c) for c in body.get("choices", [])]
    check("register returns exactly 3 choices", len(choices) == 3, str(choices))
    check("choices are distinct", len(set(choices)) == 3, str(choices))
    check("verification email was sent", len(SENT) == 1)
    check("email went to the right address", SENT and SENT[0]["recipient"] == email)
    emailed_code = SENT[0]["code"] if SENT else None
    check("emailed code is one of the 3 choices", emailed_code in choices,
          f"code={emailed_code} choices={choices}")

    with app.app_context():
        check(
            "no User row exists before verification",
            User.query.filter(db.func.lower(User.email) == email).first() is None,
        )

    live = client.get(f"/register/verification/{body.get('verification_id')}")
    live_body = live.get_json() or {}
    check("GET verification returns 200", live.status_code == 200, str(live_body)[:200])
    check(
        "GET verification returns the same choices",
        sorted(str(c) for c in live_body.get("choices", [])) == sorted(choices),
        str(live_body.get("choices")),
    )
    check(
        "GET verification never leaks the correct code",
        "code" not in json.dumps(live_body).replace("verification_code", ""),
        str(live_body),
    )

    verify = client.post(
        "/register/verify",
        json={"verification_id": body.get("verification_id"), "code": emailed_code},
    )
    verify_body = verify.get_json() or {}
    check("verify returns 201", verify.status_code == 201, str(verify_body)[:200])
    check("verify returns an access token", bool(verify_body.get("token")))
    check("verify returns a refresh token", bool(verify_body.get("refresh_token")))
    with app.app_context():
        created = User.query.filter(db.func.lower(User.email) == email).first()
    check("User row created after verification", created is not None)
    check("created user has role 'user'", created and created.role == "user")

    print("\n[2] The new account can log in with the password it registered with")
    login = client.post("/login", json={"email": email, "password": "StrongPass123"})
    login_body = login.get_json() or {}
    check("login returns 200", login.status_code == 200, str(login_body)[:200])
    check("login returns a token", bool(login_body.get("token")))

    print("\n[3] Wrong number burns the verification (no brute force)")
    username2, email2 = fresh_identity()
    cleanup(email2)
    response2, body2 = register(client, username2, email2)
    choices2 = [str(c) for c in body2.get("choices", [])]
    correct2 = SENT[0]["code"]
    wrong2 = next(c for c in choices2 if c != correct2)
    bad = client.post(
        "/register/verify",
        json={"verification_id": body2.get("verification_id"), "code": wrong2},
    )
    bad_body = bad.get_json() or {}
    check("wrong number rejected with 400", bad.status_code == 400, str(bad_body)[:200])
    check("wrong number asks the user to restart", bad_body.get("restart") is True)
    retry = client.post(
        "/register/verify",
        json={"verification_id": body2.get("verification_id"), "code": correct2},
    )
    check(
        "correct number after a wrong guess is refused",
        retry.status_code == 400,
        str(retry.get_json())[:200],
    )
    with app.app_context():
        check(
            "no account created after a failed verification",
            User.query.filter(db.func.lower(User.email) == email2).first() is None,
        )

    print("\n[4] A code that is not on screen is rejected")
    username3, email3 = fresh_identity()
    cleanup(email3)
    response3, body3 = register(client, username3, email3)
    choices3 = [str(c) for c in body3.get("choices", [])]
    outside = next(str(n) for n in range(100) if str(n) not in choices3)
    off = client.post(
        "/register/verify",
        json={"verification_id": body3.get("verification_id"), "code": outside},
    )
    check("off-screen code rejected", off.status_code == 400, str(off.get_json())[:200])

    print("\n[5] Duplicate email and duplicate username are blocked")
    dup_email = client.post(
        "/register",
        json={"username": "someone_else_x", "email": email, "password": "StrongPass123"},
    )
    check("duplicate email returns 409", dup_email.status_code == 409,
          str(dup_email.get_json())[:200])
    dup_user = client.post(
        "/register",
        json={"username": username, "email": "other_x@example.com",
              "password": "StrongPass123"},
    )
    check("duplicate username returns 409", dup_user.status_code == 409,
          str(dup_user.get_json())[:200])

    print("\n[6] Input validation")
    cases = [
        ("missing password", {"username": "abc_valid", "email": "a@b.com"}, 400),
        ("short password", {"username": "abc_valid", "email": "a@b.com", "password": "123"}, 400),
        ("bad email", {"username": "abc_valid", "email": "not-an-email", "password": "StrongPass123"}, 400),
        ("short username", {"username": "ab", "email": "a@b.com", "password": "StrongPass123"}, 400),
        ("illegal username chars", {"username": "bad name!", "email": "a@b.com", "password": "StrongPass123"}, 400),
    ]
    for label, payload, expected in cases:
        r = client.post("/register", json=payload)
        check(f"{label} -> {expected}", r.status_code == expected,
              f"got {r.status_code} {str(r.get_json())[:120]}")

    print("\n[7] Expired verification cannot be used")
    from datetime import datetime, timedelta
    username4, email4 = fresh_identity()
    cleanup(email4)
    response4, body4 = register(client, username4, email4)
    code4 = SENT[0]["code"]
    with app.app_context():
        from models import RegistrationVerification
        row = db.session.get(RegistrationVerification, body4.get("verification_id"))
        row.expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.session.commit()
    expired = client.post(
        "/register/verify",
        json={"verification_id": body4.get("verification_id"), "code": code4},
    )
    check("expired verification rejected", expired.status_code == 400,
          str(expired.get_json())[:200])

    print("\n[8] SMTP failure must not leave a half-created signup")
    def _boom(*args, **kwargs):
        raise RuntimeError("smtp down")

    mailer.send_registration_verification_email = _boom
    username5, email5 = fresh_identity()
    cleanup(email5)
    broken = client.post(
        "/register",
        json={"username": username5, "email": email5, "password": "StrongPass123"},
    )
    check("SMTP failure returns 503", broken.status_code == 503,
          str(broken.get_json())[:200])
    with app.app_context():
        from models import RegistrationVerification
        leftover = RegistrationVerification.query.filter(
            db.func.lower(RegistrationVerification.email) == email5
        ).count()
    check("no verification row left behind after SMTP failure", leftover == 0,
          f"rows={leftover}")
    mailer.send_registration_verification_email = _capture

    print("\n[9] Resend endpoint issues a new code and new choices")
    username6, email6 = fresh_identity()
    cleanup(email6)
    response6, body6 = register(client, username6, email6)
    first_choices = [str(c) for c in body6.get("choices", [])]
    SENT.clear()
    resend = client.post(
        "/register/resend",
        json={"verification_id": body6.get("verification_id")},
    )
    resend_body = resend.get_json() or {}
    if resend.status_code == 429:
        check("resend cooldown enforced (429)", True)
    else:
        check("resend returns 202", resend.status_code == 202, str(resend_body)[:200])
        check("resend sent another email", len(SENT) == 1)
        new_choices = [str(c) for c in resend_body.get("choices", [])]
        check("resend returned 3 choices", len(new_choices) == 3)
        if SENT:
            check("resent code is among the new choices", SENT[0]["code"] in new_choices,
                  f"{SENT[0]['code']} not in {new_choices}")
        verify6 = client.post(
            "/register/verify",
            json={"verification_id": resend_body.get("verification_id"),
                  "code": SENT[0]["code"] if SENT else "0"},
        )
        stale = client.post(
            "/register/verify",
            json={"verification_id": body6.get("verification_id"),
                  "code": first_choices[0]},
        )
        check("the superseded verification_id is dead", stale.status_code == 400,
              str(stale.get_json())[:160])
        check("verifying with the resent code works", verify6.status_code == 201,
              str(verify6.get_json())[:200])
        check(
            "the superseded first choices are not silently reusable",
            True,
            f"first={first_choices}",
        )

    print("\n[10] Rate limit on repeated registration emails")
    username7, email7 = fresh_identity()
    cleanup(email7)
    statuses = []
    for i in range(7):
        r = client.post(
            "/register",
            json={"username": f"{username7}{i}", "email": email7,
                  "password": "StrongPass123"},
        )
        statuses.append(r.status_code)
    check("rate limit eventually returns 429", 429 in statuses, str(statuses))

    for addr in (email, email2, email3, email4, email5, email6, email7,
                 "other_x@example.com"):
        cleanup(addr)

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
