"""Live test: start the real server, save settings through HTTP, confirm it
restarts on its own and comes back serving the new value.

This is the part unit tests cannot prove. Run from backend/:
    python test_live_restart.py
"""

import os
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ENV_PATH = ROOT / ".env"
BASE = "http://127.0.0.1:5000"

PASSED, FAILED = [], []


def check(name, condition, detail=""):
    (PASSED if condition else FAILED).append(name if condition else f"{name} :: {detail}")
    print(("  PASS  " if condition else "  FAIL  ") + name + ("" if condition else f"  {detail}"))


def wait_up(timeout=40):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if requests.get(BASE + "/", timeout=2).ok:
                return True
        except requests.RequestException:
            pass
        time.sleep(0.4)
    return False


def boot_id():
    try:
        return requests.get(BASE + "/admin/settings/boot", timeout=3).json().get("boot_id")
    except requests.RequestException:
        return None


def wait_new_boot(previous, timeout=40):
    """The reloader keeps the socket open, so a restart is only visible as a
    change in the per-process boot id, never as a dropped connection."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        current = boot_id()
        if current and current != previous:
            return current
        time.sleep(0.4)
    return None


def main():
    snapshot = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else None

    sys.path.insert(0, str(HERE))
    tag = uuid.uuid4().hex[:8]
    admin_email = f"live_admin_{tag}@example.com"

    # Create the admin account in a throwaway process so the test process
    # never holds the SQLite file open while the server runs.
    subprocess.run(
        [sys.executable, "-c", f'''
import sys; sys.path.insert(0, r"{HERE}")
from app import app
from database import db
from models import User
from werkzeug.security import generate_password_hash
with app.app_context():
    db.session.add(User(username="liveadmin{tag}", email="{admin_email}",
                        password=generate_password_hash("AdminPass123"),
                        role="admin", token_version=0))
    db.session.commit()
'''],
        cwd=HERE, check=True, capture_output=True,
    )

    log = open("/tmp/live_server.log", "w")
    server = subprocess.Popen(
        [sys.executable, "app.py"], cwd=HERE,
        stdout=log, stderr=subprocess.STDOUT,
        start_new_session=True,
    )

    try:
        print("\n[1] Server starts")
        check("server is up", wait_up(), "see /tmp/live_server.log")

        session = requests.Session()
        login = session.post(BASE + "/login",
                             json={"email": admin_email, "password": "AdminPass123"},
                             timeout=10)
        token = (login.json() or {}).get("token")
        check("admin logged in", bool(token), login.text[:200])
        headers = {"Authorization": f"Bearer {token}"}

        print("\n[2] Settings load over HTTP")
        response = session.get(BASE + "/admin/settings", headers=headers, timeout=10)
        check("GET /admin/settings returns 200", response.status_code == 200,
              response.text[:200])
        flat = {f["key"]: f for g in response.json()["groups"] for f in g["fields"]}
        check("SECRET_KEY masked over the wire",
              flat["SECRET_KEY"]["value"] == "********")

        print("\n[3] Save with restart -> the server restarts by itself")
        before_boot = boot_id()
        check("boot id is exposed", bool(before_boot), str(before_boot))
        new_name = f"Live Restart {tag}"
        save = session.post(BASE + "/admin/settings", headers=headers, timeout=10,
                            json={"values": {"STORE_NAME": new_name,
                                             "STORE_PHONE": "+20 111 222 3333"},
                                  "restart": True})
        check("save returns 200", save.status_code == 200, save.text[:250])
        check("save reports restarting", save.json().get("restarting") is True)

        fresh = wait_new_boot(before_boot, 40)
        check("a new server process took over", fresh is not None,
              "boot id never changed; see /tmp/live_server.log")
        check("the site stayed reachable throughout the restart",
              requests.get(BASE + "/", timeout=5).ok)

        print("\n[4] The restarted server is serving the new configuration")
        check("new STORE_NAME is on disk",
              f"STORE_NAME={new_name}" in ENV_PATH.read_text(encoding="utf-8")
              or f'STORE_NAME="{new_name}"' in ENV_PATH.read_text(encoding="utf-8"),
              ENV_PATH.read_text(encoding="utf-8")[:200])

        login2 = session.post(BASE + "/login",
                              json={"email": admin_email, "password": "AdminPass123"},
                              timeout=10)
        check("login still works after the restart", login2.status_code == 200,
              login2.text[:200])
        token2 = (login2.json() or {}).get("token")
        headers2 = {"Authorization": f"Bearer {token2}"}

        response2 = session.get(BASE + "/admin/settings", headers=headers2, timeout=10)
        flat2 = {f["key"]: f for g in response2.json()["groups"] for f in g["fields"]}
        check("the reloaded process reports the new STORE_NAME",
              flat2["STORE_NAME"]["value"] == new_name,
              flat2["STORE_NAME"]["value"])
        check("the phone number survived too",
              flat2["STORE_PHONE"]["value"] == "+20 111 222 3333",
              flat2["STORE_PHONE"]["value"])

        print("\n[5] A rejected save leaves the running server untouched")
        bad = session.post(BASE + "/admin/settings", headers=headers2, timeout=10,
                           json={"values": {"MIN_PASSWORD_LENGTH": "3"},
                                 "restart": True})
        check("bad value rejected with 400", bad.status_code == 400, bad.text[:200])
        time.sleep(3)
        check("server did not restart on a rejected save",
              requests.get(BASE + "/", timeout=5).ok)
        check(".env was not touched",
              "MIN_PASSWORD_LENGTH=3" not in ENV_PATH.read_text(encoding="utf-8"))

        print("\n[6] Explicit restart endpoint")
        before_boot2 = boot_id()
        session.post(BASE + "/admin/settings/restart", headers=headers2, timeout=10)
        check("server restarts on demand",
              wait_new_boot(before_boot2, 40) is not None)

        print("\n[7] A rejected save does not restart anything")
        before_boot3 = boot_id()
        session.post(BASE + "/admin/settings", headers=headers2, timeout=10,
                     json={"values": {"EMAIL_PORT": "not-a-port"}, "restart": True})
        time.sleep(4)
        check("boot id unchanged after a rejected save",
              boot_id() == before_boot3)

    finally:
        try:
            os.killpg(os.getpgid(server.pid), signal.SIGTERM)
        except Exception:
            server.terminate()
        time.sleep(1)
        log.close()

        if snapshot is not None:
            ENV_PATH.write_text(snapshot, encoding="utf-8")
        for extra in (".env.bak", ".env.tmp"):
            candidate = ROOT / extra
            if candidate.exists():
                candidate.unlink()

        subprocess.run(
            [sys.executable, "-c", f'''
import sys; sys.path.insert(0, r"{HERE}")
from app import app
from database import db
from models import User
with app.app_context():
    User.query.filter(User.email == "{admin_email}").delete(synchronize_session=False)
    db.session.commit()
'''],
            cwd=HERE, capture_output=True,
        )

    print("\n" + "=" * 60)
    print(f"PASSED: {len(PASSED)}    FAILED: {len(FAILED)}")
    for f in FAILED:
        print("  -", f)
    print("=" * 60)
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
