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

The app defaults to the local API on Chrome and Windows desktop, and to the Android emulator host when running on an Android emulator. To set an address explicitly:

```powershell
# Chrome or Windows desktop
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:8000/api

# Android emulator
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api

# Physical Android phone using the active ngrok tunnel
flutter run --dart-define=API_BASE_URL=https://freestyle-fondly-auction.ngrok-free.dev/api
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
