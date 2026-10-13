# student_app

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

## TMC StudentMart local setup

### 1. Apply the product photo gallery migration

Open PowerShell in `C:\xampp\htdocs\myproject\backend` and run this once:

```powershell
php artisan migrate
```

This adds the `product_images` table and copies each existing product's current `image` path into the gallery. It does not reset or delete product records. Do not use `php artisan migrate:fresh` on a database that contains project data.

### 2. Start the Laravel API

In a backend PowerShell terminal:

```powershell
cd C:\xampp\htdocs\myproject\backend
php artisan serve --host=127.0.0.1 --port=8000
```

### 3. Run the Flutter app in Chrome

In another PowerShell terminal:

```powershell
cd C:\xampp\htdocs\myproject\student_app
flutter run -d chrome --web-port 65156 --dart-define=API_BASE_URL=http://127.0.0.1:8000/api
```

Chrome must use `127.0.0.1` (or `localhost`) for the API. `10.0.2.2` is for an Android emulator, not Chrome.

### Android emulator or physical phone

For an Android emulator, use:

```powershell
cd C:\xampp\htdocs\myproject\student_app
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api
```

For a physical phone, replace the API host with the computer's LAN IP address and keep both devices on the same network.

### Verify changes

From `student_app`:

```powershell
flutter analyze
flutter test
flutter build web --dart-define=API_BASE_URL=http://127.0.0.1:8000/api
```

From `backend`:

```powershell
php artisan test
```

Student listings support up to four product photos. Each new gallery photo is limited to 1.5 MB; one photo can be selected as the cover image.