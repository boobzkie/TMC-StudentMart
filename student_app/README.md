# TMC StudentMart — Flutter student app

The student app is in `student_app` and connects to the Laravel API in `backend`.

## Start the API

Open PowerShell in the backend folder:

```powershell
cd "C:\xampp\htdocs\TMC StudentMart\backend"
php artisan serve --host=0.0.0.0 --port=8000
```

## Run the app

Open a second PowerShell terminal in the student app folder:

```powershell
cd "C:\xampp\htdocs\TMC StudentMart\student_app"
flutter pub get
flutter run
```

The app defaults to the local API on Chrome and Windows desktop. Android requires an explicit API URL: use `http://10.0.2.2:8000/api` for an emulator, or the active HTTPS ngrok forwarding URL followed by `/api` for a physical phone. `API_BASE_URL` is read at compile time from `--dart-define` and overrides the platform default. If `API_BASE_URLS` is also supplied, that comma-separated list takes precedence. No temporary tunnel URL is stored in the app.

```powershell
# Chrome or Windows desktop
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:8000/api

# Android emulator
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api

# Physical Android phone: start `ngrok http 8000` in another terminal first.
# Read the active HTTPS forwarding URL from ngrok's local dashboard and append `/api`.
$ngrokUrl = (Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels').tunnels |
  Where-Object { $_.public_url -like 'https://*' } |
  Select-Object -First 1 -ExpandProperty public_url
if (-not $ngrokUrl) { throw 'No active HTTPS ngrok tunnel was found.' }
$apiBaseUrl = "$($ngrokUrl.TrimEnd('/'))/api"
flutter run --dart-define="API_BASE_URL=$apiBaseUrl"
```

## Verify the app

From `student_app`:

```powershell
flutter analyze
flutter test
```

From `backend`:

```powershell
php artisan test
```

The Laravel migrations add schema fields and tables without resetting existing marketplace data. Do not run `php artisan migrate:fresh` against a database that contains project data.
