import html
import os
import re
import smtplib
from email.message import EmailMessage


def _env(name, default=""):
    return (os.getenv(name, default) or "").strip()


def _smtp_config():
    host = _env("EMAIL_HOST", "smtp.gmail.com")
    try:
        port = int(_env("EMAIL_PORT", "587"))
    except ValueError:
        raise RuntimeError("EMAIL_PORT must be a number.")
    username = _env("EMAIL_USERNAME")
    password = _env("EMAIL_PASSWORD")
    sender = _env("EMAIL_FROM") or username
    return host, port, username, password, sender


def send_email(recipient, subject, text, html_body=None):
    recipient = (recipient or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", recipient):
        raise ValueError("Invalid recipient email address.")

    host, port, username, password, sender = _smtp_config()
    if not username or not password or not sender:
        raise RuntimeError("Email service is not configured.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(text)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    # The message is accepted by the server at send_message(). Gmail often
    # drops the connection rudely afterwards, and a `with` block would turn
    # that harmless teardown error into an exception the caller reads as
    # "the email was never sent" — deleting a verification whose email the
    # user has already received. Close defensively instead.
    smtp = smtplib.SMTP(host, port, timeout=20)
    try:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(username, password)
        smtp.send_message(message)
    finally:
        try:
            smtp.quit()
        except Exception:
            try:
                smtp.close()
            except Exception:
                pass


def send_password_reset_email(recipient, reset_url):
    store = _env("STORE_NAME", "Your Shop")
    store_email = _env("STORE_EMAIL")
    store_phone = _env("STORE_PHONE")

    contact = []
    if store_email:
        contact.append(html.escape(store_email))
    if store_phone:
        contact.append(html.escape(store_phone))

    subject = f"{store} - Reset your password"
    text = (
        f"Hello,\n\n"
        f"We received a request to reset your {store} password.\n"
        f"Open this link within 30 minutes:\n{reset_url}\n\n"
        f"If you did not request this, you can ignore this email.\n\n"
        f"Regards,\n{store}"
    )
    html_body = f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:14px">
<h2>{html.escape(store)}</h2>
<h1>Reset your password</h1>
<p>We received a request to reset your password.</p>
<p><a href="{html.escape(reset_url, quote=True)}"
style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;
text-decoration:none;border-radius:8px">Reset password</a></p>
<p>This link expires in 30 minutes and can only be used once.</p>
<p>If you did not request this, you can ignore this email.</p>
{"<p>" + " | ".join(contact) + "</p>" if contact else ""}
</div></body></html>"""
    send_email(recipient, subject, text, html_body)



def send_registration_verification_email(recipient, code, username, expires_minutes=10):
    store = _env("STORE_NAME", "Your Shop")
    store_email = _env("STORE_EMAIL")
    store_phone = _env("STORE_PHONE")

    contact = []
    if store_email:
        contact.append(html.escape(store_email))
    if store_phone:
        contact.append(html.escape(store_phone))

    subject = f"{store} - Verify your new account"
    text = (
        f"Hello {username},\n\n"
        f"Someone is creating a {store} account with this email address.\n"
        f"Your verification number is: {code}\n\n"
        f"On the registration page, click the number {code}.\n"
        f"This verification expires in {expires_minutes} minutes.\n\n"
        f"If you did not start this registration, you can ignore this email.\n\n"
        f"Regards,\n{store}"
    )
    html_body = f"""<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f5f7fb;padding:30px">
<div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:14px">
<h2>{html.escape(store)}</h2>
<h1>Verify your email</h1>
<p>Hello {html.escape(username)},</p>
<p>Use the verification number below to finish creating your account:</p>
<div style="font-size:42px;font-weight:700;letter-spacing:12px;text-align:center;
padding:20px;margin:24px 0;background:#f1f5f9;border-radius:12px">
{html.escape(code)}
</div>
<p>Go back to the registration page and click the matching number.</p>
<p>This number expires in {expires_minutes} minutes and can only be used once.</p>
<p>If you did not start this registration, you can ignore this email.</p>
{"<p>" + " | ".join(contact) + "</p>" if contact else ""}
</div></body></html>"""
    send_email(recipient, subject, text, html_body)