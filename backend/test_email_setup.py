import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath("/home/claude/site/Mywebsite-main/backend/x")))
"""Email-only saves must not wipe or trip validation on the rest of .env."""
import os, sys, uuid, pathlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mailer
SENT=[]; mailer.send_email = lambda *a, **k: SENT.append(a)
import settings_admin
import app as app_module
from database import db
from models import User
from werkzeug.security import generate_password_hash

app = app_module.app; app.config["TESTING"]=True
settings_admin.schedule_restart = lambda delay=1.0: None
P,F=[],[]
def check(n,c,d=""):
    (P if c else F).append(n); print(("  PASS  " if c else "  FAIL  ")+n+("" if c else "  "+str(d)))

client = app.test_client()
tag=uuid.uuid4().hex[:8]; email=f"pa_{tag}@example.com"
with app.app_context():
    db.session.add(User(username=f"pa{tag}", email=email,
        password=generate_password_hash("AdminPass123"), role="admin", token_version=0))
    db.session.commit()
h={"Authorization":"Bearer "+client.post("/login",json={"email":email,"password":"AdminPass123"}).get_json()["token"]}

env = settings_admin.ENV_PATH
snap = env.read_text()

# Start from a bare .env so the test proves the wizard can fill in an
# unconfigured install, not just edit one that is already complete.
env.write_text(
    "SECRET_KEY=test-flask-secret-key-aaaaaaaaaaaaaaaa\n"
    "JWT_SECRET_KEY=test-jwt-secret-key-bbbbbbbbbbbbbbbb\n"
    "CORS_ORIGINS=http://127.0.0.1:5500\n"
    "FRONTEND_BASE_URL=http://127.0.0.1:5500\n"
)
try:
    print("\n[1] .env starts with no STORE_NAME and no email keys")
    before = settings_admin.read_env_file()
    check("STORE_NAME absent to begin with", "STORE_NAME" not in before)

    print("\n[2] The wizard posts only its six keys")
    r = client.post("/admin/settings", json={"values": {
        "STORE_NAME": "Nehad Store",
        "EMAIL_FROM": "orders@nehad.com",
        "EMAIL_USERNAME": "apikey",
        "EMAIL_PASSWORD": "SG.realkey123",
        "EMAIL_HOST": "smtp.sendgrid.net",
        "EMAIL_PORT": "587",
    }, "restart": False}, headers=h)
    check("partial save accepted", r.status_code == 200, r.get_json())
    after = settings_admin.read_env_file()
    check("email keys written", after.get("EMAIL_HOST")=="smtp.sendgrid.net")
    check("password written", after.get("EMAIL_PASSWORD")=="SG.realkey123")
    check("pre-existing SECRET_KEY untouched",
          after.get("SECRET_KEY")==before.get("SECRET_KEY"))
    check("pre-existing CORS untouched", after.get("CORS_ORIGINS")==before.get("CORS_ORIGINS"))
    check("unsupplied required key filled from its default",
          after.get("PASSWORD_RESET_PATH")=="/page/reset-password.html",
          after.get("PASSWORD_RESET_PATH"))
    check("defaults did not overwrite a real stored value",
          after.get("FRONTEND_BASE_URL")=="http://127.0.0.1:5500")

    print("\n[3] Saving again without the password keeps it")
    r = client.post("/admin/settings", json={"values": {
        "STORE_NAME": "Nehad Store 2", "EMAIL_PASSWORD": settings_admin.MASK,
    }, "restart": False}, headers=h)
    check("second save ok", r.status_code==200, r.get_json())
    again = settings_admin.read_env_file()
    check("password survived", again.get("EMAIL_PASSWORD")=="SG.realkey123", again.get("EMAIL_PASSWORD"))
    check("store name updated", again.get("STORE_NAME")=="Nehad Store 2")

    print("\n[4] Gmail app password spaces are stripped client-side; server takes it raw")
    r = client.post("/admin/settings", json={"values": {
        "EMAIL_HOST":"smtp.gmail.com","EMAIL_USERNAME":"shop@gmail.com",
        "EMAIL_PASSWORD":"abcdefghijklmnop"}, "restart": False}, headers=h)
    check("gmail save ok", r.status_code==200, r.get_json())
    check("app password stored intact",
          settings_admin.read_env_file().get("EMAIL_PASSWORD")=="abcdefghijklmnop")

    print("\n[5] The resulting file still boots config.py")
    import importlib
    from dotenv import load_dotenv
    load_dotenv(env, override=True)
    import config as c
    try:
        importlib.reload(c); check("config imports cleanly", True)
    except Exception as e:
        check("config imports cleanly", False, e)

    print("\n[6] Free-form usernames allowed, but the From address is checked")
    r = client.post("/admin/settings", json={"values":{"EMAIL_USERNAME":"apikey"}, "restart":False}, headers=h)
    check("non-email username accepted (SendGrid, Resend)", r.status_code==200, r.get_json())
    r = client.post("/admin/settings", json={"values":{"EMAIL_FROM":"nope"}, "restart":False}, headers=h)
    check("bad From address still rejected",
          r.status_code==400 and "EMAIL_FROM" in (r.get_json() or {}).get("errors",{}), r.get_json())
finally:
    env.write_text(snap)
    for x in (".env.bak",".env.tmp"):
        p = env.parent / x
        if p.exists(): p.unlink()
    with app.app_context():
        User.query.filter(User.email==email).delete(synchronize_session=False); db.session.commit()

print("\n"+"="*50); print(f"PASSED: {len(P)}  FAILED: {len(F)}")
for f in F: print("  -",f)
sys.exit(1 if F else 0)
