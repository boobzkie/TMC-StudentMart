# TMC StudentMart Flutter Redesign Plan - TikTok-Inspired UI/UX

## Scope
This redesign updates the existing Flutter app (`student_app`) to a TikTok-inspired visual system while preserving
the student marketplace business logic, authentication, API communication, cart, orders, moderation, and role-based
permissions.

The app remains a student marketplace, not a social/video app and not an e-commerce feature clone.

## Existing architecture reviewed
- Entry point: `lib/main.dart`
- Theme and design tokens: `lib/tmc_theme.dart`
- Reusable widgets: `lib/components.dart`
- API, auth, state, models: `lib/data.dart`
- Routing/navigation shell: `lib/shell.dart`
- Main feature screens: `lib/marketplace_page.dart`, `lib/profile_page.dart`, `lib/auth_page.dart`,
  `lib/orders_page.dart`, `lib/notifications_page.dart`, `lib/sell_page.dart`, etc.

## Implemented changes
- Theme palette converted from navy/academic blue to a clean TikTok-inspired black/neutral/cyan/pink system.
- Cards, buttons, inputs, app bars, and bottom navigation share rounded Material 3 styling.
- Home screen hero converted into a profile-oriented dashboard with avatar, identity, stats, and quick actions.
- Profile screen header redesigned with TikTok-like centered avatar, identity line, and action buttons.
- Shell now includes a structured side drawer with quick navigation and account settings.
- Authentication screen keeps existing validation/recovery flows while receiving the refreshed neutral identity.

## Preserved business logic
- Login, registration, password reset, session/token handling, and logout use existing `AuthState`.
- Marketplace loading, filtering, cart, checkout idempotency, product CRUD, orders, and notifications remain unchanged.
- Role permissions and moderation flows are not altered.

## Authentication flow map
- Requests: `lib/data.dart` (`AuthState.login`, `register`, `requestPasswordReset`, `resetPassword`, `logout`)
- UI: `lib/auth_page.dart`
- Session storage: `ApiService.storage` and `ApiService.tokenKey`

## Academic/marketplace data request map
- Marketplace: `MarketplaceState` in `lib/data.dart`
- Cart: `CartState` in `lib/data.dart`
- UI request surfaces: `lib/marketplace_page.dart`, `lib/orders_page.dart`, `lib/notifications_page.dart`

## Remaining backend-driven work
- No grades, attendance, schedule, or course-registration backend exists in this project; those hypothetical student
  information-system modules were intentionally not fabricated.
- Any future student-information features need backend endpoints and authorized response models first.

## Verification target
- `flutter analyze`
- `flutter test`
- manual navigation: login, recovery dialog, home, profile, drawer, orders, notifications, sell page
