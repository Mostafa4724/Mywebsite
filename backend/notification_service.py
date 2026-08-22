"""
Customer payment notification service.

SMS: Twilio REST API.
Email: SMTP (Gmail-compatible).
All credentials are read from backend environment variables.
"""
import html
import os
import re
import smtplib
from email.message import EmailMessage

import requests


def _required_env(*names):
    for name in names:
        value = os.getenv(name)
        if value:
            return value.strip()
    return None


def _store_name():
    return os.getenv("STORE_NAME", "Your Shop").strip() or "Your Shop"


def _customer_name(order):
    first = (getattr(order, "customer_name", None) or "").strip()
    last = (getattr(order, "customer_lastname", None) or "").strip()
    return " ".join(part for part in (first, last) if part).strip()


def _order_number(order):
    return f"#{getattr(order, 'id', '')}"


def _payment_copy(order, status):
    store = _store_name()
    order_number = _order_number(order)
    customer = _customer_name(order) or "Customer"

    if status == "verified":
        subject = f"Payment Confirmed – Order {order_number}"
        sms = (
            f"Payment Confirmed – Order {order_number}. "
            "Your payment has been successfully verified. "
            f"Your order is now being processed. Thank you for shopping with {store}."
        )
        title = "Payment Confirmed"
        status_label = "Verified"
        intro = (
            f"We are pleased to inform you that the payment for your order "
            f"{order_number} has been successfully verified."
        )
        detail = (
            "Your order is now being processed, and we will keep you updated as it progresses."
        )
    else:
        subject = f"Payment Not Approved – Order {order_number}"
        sms = (
            f"Payment Update – Order {order_number}. "
            "Unfortunately, the payment for your order was not approved. "
            "You may review your payment details and place a new order if you would like to try again. "
            f"Thank you for choosing {store}."
        )
        title = "Payment Not Approved"
        status_label = "Not Approved"
        intro = (
            f"We are writing to inform you that the payment associated with your order "
            f"{order_number} was not approved."
        )
        detail = (
            "You may review your payment information and place a new order if you would like to try again. "
            "If you believe this was unexpected or need assistance, please contact our support team."
        )

    return {
        "subject": subject,
        "sms": sms,
        "title": title,
        "status_label": status_label,
        "customer": customer,
        "intro": intro,
        "detail": detail,
        "store": store,
    }


def send_sms(phone, message):
    """Send one SMS through Twilio. Returns None on success or a safe error string."""
    sid = _required_env("TWILIO_ACCOUNT_SID")
    token = _required_env("TWILIO_AUTH_TOKEN")
    from_number = _required_env("TWILIO_FROM_NUMBER", "SMS_SENDER_ID")

    if not sid or not token or not from_number:
        return "SMS provider is not configured."

    phone = (phone or "").strip()
    if not phone:
        return "Customer phone number is missing."

    # Twilio expects an E.164 destination. Do not silently guess a country code.
    if not re.fullmatch(r"\+[1-9]\d{6,14}", re.sub(r"[\s().-]", "", phone)):
        return "Customer phone number is not in a valid international format."

    to_number = re.sub(r"[\s().-]", "", phone)

    try:
        response = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            auth=(sid, token),
            data={
                "To": to_number,
                "From": from_number,
                "Body": message,
            },
            timeout=15,
        )
        if not response.ok:
            return "SMS provider rejected the message."
        return None
    except requests.RequestException:
        return "SMS provider could not be reached."


def send_email(recipient, subject, order, copy):
    """Send the payment email over SMTP. Returns None on success or a safe error string."""
    host = _required_env("EMAIL_HOST") or "smtp.gmail.com"
    port_raw = _required_env("EMAIL_PORT") or "587"
    username = _required_env("EMAIL_USERNAME")
    password = _required_env("EMAIL_PASSWORD")
    sender = _required_env("EMAIL_FROM") or username

    if not username or not password or not sender:
        return "Email service is not configured."

    recipient = (recipient or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", recipient):
        return "Customer email address is missing or invalid."

    try:
        port = int(port_raw)
    except ValueError:
        return "Email service configuration is invalid."

    store_email = os.getenv("STORE_EMAIL", "").strip()
    store_phone = os.getenv("STORE_PHONE", "").strip()
    store_website = os.getenv("STORE_WEBSITE", "").strip()
    logo_url = os.getenv("STORE_LOGO_URL", "").strip()

    customer = html.escape(copy["customer"])
    order_number = html.escape(_order_number(order))
    store = html.escape(copy["store"])
    title = html.escape(copy["title"])
    status_label = html.escape(copy["status_label"])
    intro = html.escape(copy["intro"])
    detail = html.escape(copy["detail"])

    logo_html = (
        f'<img src="{html.escape(logo_url, quote=True)}" alt="{store}" '
        'style="max-width:180px;max-height:60px;object-fit:contain;">'
        if logo_url
        else f'<div style="font-size:22px;font-weight:700;color:#111827;">{store}</div>'
    )

    contact_parts = []
    if store_email:
        contact_parts.append(html.escape(store_email))
    if store_phone:
        contact_parts.append(html.escape(store_phone))
    if store_website:
        contact_parts.append(
            f'<a href="{html.escape(store_website, quote=True)}" '
            'style="color:#2563eb;text-decoration:none;">Visit our website</a>'
        )
    contact_html = " &nbsp;|&nbsp; ".join(contact_parts)

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        f"Dear {copy['customer']},\n\n{copy['intro']}\n\n{copy['detail']}\n\n"
        f"Best regards,\n{copy['store']}"
    )
    message.add_alternative(
        f"""<!doctype html>
<html>
<body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#1f2937;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
    <div style="padding:28px 32px;border-bottom:1px solid #eef0f4;">{logo_html}</div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px;font-size:16px;">Dear {customer},</p>
      <h1 style="margin:0 0 22px;font-size:25px;color:#111827;">{title}</h1>
      <div style="padding:14px 16px;background:#f8fafc;border-radius:10px;margin-bottom:24px;">
        <div style="font-size:13px;color:#6b7280;">Order Number</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">{order_number}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:14px;">Payment Status</div>
        <div style="font-size:16px;font-weight:700;margin-top:4px;">{status_label}</div>
      </div>
      <p style="font-size:15px;line-height:1.7;margin:0 0 14px;">{intro}</p>
      <p style="font-size:15px;line-height:1.7;margin:0;">{detail}</p>
      <p style="font-size:15px;line-height:1.7;margin:28px 0 0;">
        Thank you for choosing {store}. We appreciate your business.
      </p>
      <p style="font-size:15px;line-height:1.7;margin:24px 0 0;">
        Best regards,<br><strong>{store}</strong>
      </p>
    </div>
    {f'<div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #eef0f4;font-size:12px;color:#6b7280;">{contact_html}</div>' if contact_html else ''}
  </div>
</body>
</html>""",
        subtype="html",
    )

    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=20) as server:
                server.login(username, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(username, password)
                server.send_message(message)
        return None
    except (OSError, smtplib.SMTPException):
        return "Email service could not deliver the message."


def send_payment_notification(order, status):
    """Send both customer notifications and return per-channel results."""
    copy = _payment_copy(order, status)
    sms_error = send_sms(getattr(order, "customer_phone", None), copy["sms"])
    email_error = send_email(
        getattr(order, "customer_email", None),
        copy["subject"],
        order,
        copy,
    )

    return {
        "sms_sent": sms_error is None,
        "email_sent": email_error is None,
        "sms_error": sms_error,
        "email_error": email_error,
    }
