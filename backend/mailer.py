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
    print(1)
    recipient = (recipient or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", recipient):
        raise ValueError("Invalid recipient email address.")

    host, port, username, password, sender = _smtp_config()
    print(host, port, username, password, sender)
    if not username or not password or not sender:
        raise RuntimeError("Email service is not configured.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(text)
    if html_body:
        message.add_alternative(html_body, subtype="html")
        print(2)

    with smtplib.SMTP(host, port, timeout=20) as smtp:
        print(3)
        smtp.starttls()
        print("3-1")
        print(username,password)
        smtp.login(username, password)
        print(4)
        smtp.send_message(message)
        print(5)
        print(message["From"])
       


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
