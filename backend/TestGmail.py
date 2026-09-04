import smtplib

email = "nmaigm@gmail.com"
password = "tjlr tmfr kpsc bjlu"

try:
    print("Connecting to Gmail...")

    smtp = smtplib.SMTP("smtp.gmail.com", 587, timeout=20)
    print("Connected!")

    smtp.starttls()
    print("TLS started!")

    smtp.login(email, password)
    print("SMTP LOGIN: OK!")

    smtp.quit()

except Exception as e:
    print("FAILED!")
    print(type(e).__name__)
    print(repr(e))