"""Find out why SMTP login is failing.

Prints the whole conversation with the mail server, so instead of a Python
traceback you see what the server actually said before it gave up.

    cd backend
    python diagnose_smtp.py                  read settings from .env
    python diagnose_smtp.py --port 465       try implicit TLS instead
    python diagnose_smtp.py --send you@x.com actually send a message

Nothing is written or changed. The password is never printed.
"""

import argparse
import os
import smtplib
import socket
import ssl
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

try:
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH, override=True)
except ImportError:
    print("python-dotenv is not installed; reading the real environment only.")


def line(char="-"):
    print(char * 66)


def get(name, default=""):
    return (os.getenv(name, default) or "").strip()


def describe_secret(value):
    """Say enough about the password to spot a paste error, never the value."""
    if not value:
        return "EMPTY"
    notes = [f"{len(value)} characters"]
    if value != value.strip():
        notes.append("HAS LEADING/TRAILING SPACES")
    if " " in value.strip():
        notes.append("CONTAINS SPACES")
    if value[0] in "\"'" or value[-1] in "\"'":
        notes.append("STARTS OR ENDS WITH A QUOTE")
    if value.startswith("SG."):
        notes.append("looks like a SendGrid key")
    elif value.startswith("re_"):
        notes.append("looks like a Resend key")
    elif len(value.replace(" ", "")) == 16 and value.replace(" ", "").isalpha():
        notes.append("looks like a Gmail app password")
    return ", ".join(notes)


def check_settings(host, port, username, password, sender):
    line("=")
    print("SETTINGS")
    line()
    print(f"  Host      : {host or '(empty)'}")
    print(f"  Port      : {port}")
    print(f"  Username  : {username or '(empty)'}")
    print(f"  Password  : {describe_secret(password)}")
    print(f"  From      : {sender or '(empty)'}")
    print(f"  .env file : {ENV_PATH}")

    problems = []
    if not host:
        problems.append("EMAIL_HOST is empty.")
    if not username:
        problems.append("EMAIL_USERNAME is empty.")
    if not password:
        problems.append("EMAIL_PASSWORD is empty.")
    if password and (password[0] in "\"'" or password[-1] in "\"'"):
        problems.append(
            "The password starts or ends with a quote character. Quotes in "
            ".env wrap a value; they are not part of it. Remove them."
        )
    if password and password != password.strip():
        problems.append("The password has spaces around it. Remove them.")
    if port == 465:
        problems.append(
            "Port 465 expects TLS from the very first byte. mailer.py uses "
            "STARTTLS, which is port 587. Use 587 unless your provider "
            "insists otherwise."
        )
    if port == 25:
        problems.append(
            "Port 25 is blocked by nearly every home ISP and cloud host. "
            "Use 587."
        )

    if problems:
        print()
        print("  Problems spotted before even connecting:")
        for problem in problems:
            print(f"    ! {problem}")
    return problems


def check_dns(host):
    line("=")
    print("STEP 1 - Can this machine find the server?")
    line()
    try:
        infos = socket.getaddrinfo(host, None)
        addresses = sorted({info[4][0] for info in infos})
        print(f"  OK. {host} resolves to: {', '.join(addresses)}")
        return True
    except socket.gaierror as error:
        print(f"  FAILED. {host} could not be resolved: {error}")
        print("  Check the host address for typos, and check your internet.")
        return False


def check_port(host, port):
    line("=")
    print(f"STEP 2 - Is port {port} reachable?")
    line()
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(12)
    try:
        sock.connect((host, port))
        print(f"  OK. Connected to {host}:{port}")
        return True
    except socket.timeout:
        print("  FAILED. The connection timed out.")
        print("  Something is silently dropping the traffic - usually a")
        print("  firewall, your ISP, or a company network.")
        return False
    except OSError as error:
        print(f"  FAILED. {type(error).__name__}: {error}")
        return False
    finally:
        sock.close()


def try_starttls(host, port, username, password, sender, recipient=None):
    line("=")
    print("STEP 3 - The SMTP conversation (everything below is verbatim)")
    line()

    smtp = None
    try:
        smtp = smtplib.SMTP(host, port, timeout=25)
        smtp.set_debuglevel(1)

        print("\n>>> greeting received, sending EHLO")
        smtp.ehlo()

        before = dict(smtp.esmtp_features)
        print(f"\n>>> features BEFORE STARTTLS: {sorted(before)}")

        if "starttls" not in before:
            line("=")
            print("PROBLEM: the server did not offer STARTTLS.")
            print("  Either this is not the right port for encrypted SMTP,")
            print("  or something between you and the server is rewriting")
            print("  the conversation. See the antivirus note at the end.")
            return False

        print("\n>>> sending STARTTLS")
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()

        after = dict(smtp.esmtp_features)
        print(f"\n>>> features AFTER STARTTLS: {sorted(after)}")

        auth = after.get("auth", "")
        print(f">>> AUTH mechanisms offered: {auth or '(none)'}")
        if not auth:
            line("=")
            print("PROBLEM: the server offers no way to log in over this")
            print("  connection. For Microsoft 365 this normally means")
            print("  authenticated SMTP is disabled on the account.")
            return False

        print("\n>>> logging in")
        smtp.login(username, password)
        print("\n  LOGIN SUCCEEDED.")

        if recipient:
            from email.message import EmailMessage
            message = EmailMessage()
            message["Subject"] = "SMTP diagnostic"
            message["From"] = sender
            message["To"] = recipient
            message.set_content("Sent by diagnose_smtp.py. Your SMTP works.")
            print(f"\n>>> sending a real message to {recipient}")
            smtp.send_message(message)
            print(f"\n  MESSAGE ACCEPTED for {recipient}.")

        return True

    except smtplib.SMTPServerDisconnected as error:
        line("=")
        print(f"PROBLEM: the server hung up. ({error})")
        explain_disconnect(host)
        return False
    except smtplib.SMTPAuthenticationError as error:
        line("=")
        print(f"PROBLEM: the server rejected the credentials. {error}")
        explain_auth(host)
        return False
    except smtplib.SMTPSenderRefused as error:
        line("=")
        print(f"PROBLEM: the From address was refused. {error}")
        print(f"  Most providers only let you send from an address or domain")
        print(f"  you have verified with them. Current From: {sender}")
        return False
    except ssl.SSLError as error:
        line("=")
        print(f"PROBLEM: the TLS handshake failed. {error}")
        print("  If you are on port 465, switch to 587.")
        print("  Otherwise see the antivirus note at the end.")
        return False
    except Exception as error:
        line("=")
        print(f"PROBLEM: {type(error).__name__}: {error}")
        return False
    finally:
        if smtp is not None:
            try:
                smtp.quit()
            except Exception:
                try:
                    smtp.close()
                except Exception:
                    pass


def explain_disconnect(host):
    lowered = host.lower()
    print()
    print("  The server accepted the connection and then closed it during")
    print("  login without sending an error code. In order of likelihood:")
    print()
    print("  1. ANTIVIRUS / SECURITY SOFTWARE ON THIS PC.")
    print("     Avast, AVG, ESET, Kaspersky and Bitdefender all ship a 'mail")
    print("     shield' that sits in the middle of SMTP connections. It")
    print("     breaks app-password logins and disconnects exactly like")
    print("     this. Turn off the mail/email shield (not the whole")
    print("     antivirus) and run this script again. This is the single")
    print("     most common cause of this error on Windows.")
    print()
    if "office365" in lowered or "outlook" in lowered:
        print("  2. MICROSOFT DISABLED BASIC AUTHENTICATION.")
        print("     Microsoft 365 turns off username-and-password SMTP by")
        print("     default. An administrator has to enable authenticated")
        print("     SMTP for the mailbox. This will not work until they do.")
    elif "gmail" in lowered:
        print("  2. THE GMAIL APP PASSWORD IS NOT VALID.")
        print("     App passwords only exist once 2-Step Verification is on,")
        print("     and they stop working if it is later turned off. Delete")
        print("     the old one and create a fresh one.")
    else:
        print("  2. THE ACCOUNT IS NOT ALLOWED TO SEND YET.")
        print("     New accounts at most providers are restricted until the")
        print("     sending domain is verified. Check your provider's")
        print("     dashboard for a warning.")
    print()
    print("  3. A CORPORATE OR SCHOOL NETWORK filtering outbound mail.")
    print("     Try a phone hotspot to rule this out - it takes a minute")
    print("     and definitively separates network from credentials.")


def explain_auth(host):
    lowered = host.lower()
    print()
    if "gmail" in lowered:
        print("  Gmail needs a 16-character App Password, not your Google")
        print("  password. Turn on 2-Step Verification, then create one at")
        print("  Google Account > Security > App passwords.")
    else:
        print("  Use the key or SMTP password from your provider's")
        print("  dashboard, not the password you log into their website")
        print("  with. Those are different for every sending service.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", help="override EMAIL_HOST")
    parser.add_argument("--port", type=int, help="override EMAIL_PORT")
    parser.add_argument("--send", metavar="ADDRESS",
                        help="send a real message if login works")
    args = parser.parse_args()

    host = args.host or get("EMAIL_HOST", "smtp.gmail.com")
    port = args.port or int(get("EMAIL_PORT", "587") or 587)
    username = get("EMAIL_USERNAME")
    password = os.getenv("EMAIL_PASSWORD", "") or ""
    sender = get("EMAIL_FROM") or username

    check_settings(host, port, username, password, sender)

    if not host or not username or not password:
        line("=")
        print("Fill in the missing settings first, then run this again.")
        return 1

    if not check_dns(host):
        return 1
    if not check_port(host, port):
        return 1

    ok = try_starttls(host, port, username, password.strip(), sender, args.send)

    line("=")
    if ok:
        print("RESULT: SMTP is working.")
        if not args.send:
            print("Run again with --send your@address.com to post a real one.")
        return 0

    print("RESULT: SMTP is not working. See the explanation above.")
    print()
    print("Quick way to split network problems from credential problems:")
    print("  * Same error on a phone hotspot  -> credentials or provider")
    print("  * Works on a hotspot             -> your network or antivirus")
    return 1


if __name__ == "__main__":
    sys.exit(main())
