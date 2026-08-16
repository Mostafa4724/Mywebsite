# Google Sign-In setup

This project now includes the official Google Identity Services button on `page/login.html` and a Flask `/google-login` endpoint. Google returns an ID token to the browser callback; the backend verifies that token before creating/signing in the local shop user.

## 1. Create a Google Web Client ID

In Google Cloud, create/configure an OAuth 2.0 **Web application** client. Add the exact frontend origins you use, for example:

- `http://127.0.0.1:5501`
- `http://localhost:5501`

If you use port 5500 too, add that origin as well.

## 2. Set the backend environment variable

From PowerShell, inside the `backend` folder:

```powershell
$env:GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
```

Keep your existing `SECRET_KEY` and `JWT_SECRET_KEY` environment variables too.

## 3. Install the dependency

From the project root:

```powershell
python -m pip install -r requirements.txt
```

## 4. Start Flask

```powershell
cd backend
py app.py
```

## 5. Start your frontend server

Open `page/login.html` through your normal local frontend server.

## 6. Test

1. The Google button should appear under the normal login form.
2. Click **Continue with Google**.
3. Choose a Google account.
4. Flask verifies the Google ID token.
5. Flask creates/fetches the local shop user and returns your normal JWT.
6. The JWT is stored in `sessionStorage` for the current tab.
7. The user is redirected to `page/home.html`.

## 7. Account isolation

Open two tabs and sign into different Google accounts. Refresh both tabs. Each tab must remain on its own account. Their carts and user order lists must remain separate. Admin accounts continue to see all orders.

## 8. Important

The Google Client ID is public and can be used in frontend configuration. Do not put a Google client secret in frontend code. The backend uses Google's verified `sub` claim as the stable Google account identifier.
