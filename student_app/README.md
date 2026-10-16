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

The app selects a local API address for Chrome and Android emulators when no address is supplied. To set one explicitly:

```powershell
# Chrome or Windows desktop
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:8000/api

# Android emulator
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api
```

For a physical phone, replace the host with the computer's LAN IP address and keep both devices on the same network. You can also use the current HTTPS tunnel URL with `--dart-define=API_BASE_URL`.

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
