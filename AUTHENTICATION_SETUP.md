# Authentication and Environment Setup

This project uses a shared browser session with a short-lived access token and a rotating refresh token.

## Environment

Copy `.env.example` values into your shell/environment. Never commit real secrets.

Required:
- `SECRET_KEY`
- `JWT_SECRET_KEY`

Authentication:
- `ACCESS_TOKEN_MINUTES=60`
- `REFRESH_TOKEN_DAYS=30`
- `MIN_PASSWORD_LENGTH=8`
- `PASSWORD_RESET_MINUTES=30`
- `PASSWORD_RESET_MAX_PER_HOUR=5`

Frontend/CORS:
- `FRONTEND_BASE_URL=http://127.0.0.1:5500`
- `PASSWORD_RESET_PATH=/page/reset-password.html`
- `CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500`

Email:
- `EMAIL_HOST=smtp.gmail.com`
- `EMAIL_PORT=587`
- `EMAIL_USERNAME`
- `EMAIL_PASSWORD` (Gmail App Password)
- `EMAIL_FROM`

Google:
- `GOOGLE_CLIENT_ID`

Admin creation:
- `ADMIN_USERNAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## PowerShell

```powershell
$env:SECRET_KEY="..."
$env:JWT_SECRET_KEY="..."
$env:EMAIL_USERNAME="you@gmail.com"
$env:EMAIL_PASSWORD="your-app-password"
$env:FRONTEND_BASE_URL="http://127.0.0.1:5500"
$env:CORS_ORIGINS="http://127.0.0.1:5500,http://localhost:5500"

cd backend
python create_admin.py
python app.py
```

Generate a secret with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Authentication endpoints

- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `GET /me`
- `POST /forgot-password`
- `GET /reset-password/check?token=...`
- `POST /reset-password`
- `POST /change-password`
- `GET /google-config`
- `POST /google-login`

## Browser session

`auth.js` stores `auth_token`, `auth_refresh_token`, and `auth_user` in `localStorage`, so a login is shared between tabs. A compatibility bridge keeps older pages that still read `sessionStorage` working.

Access tokens are refreshed automatically when close to expiry and after an authenticated request receives HTTP 401. Password changes increment the user's token version, invalidating tokens issued before the change.

The shopping cart is also stored in account-specific `localStorage` keys. `buy_now` remains tab-specific in `sessionStorage`.

## Password reset

Reset tokens are stored only as SHA-256 hashes, expire after 30 minutes, are single-use, and a new reset request invalidates older reset links for the same account. Requests are rate-limited per account and use the same public response for existing and non-existing emails.
