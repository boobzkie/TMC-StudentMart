# TMC StudentMart Shared Design System

This is the canonical reference for visual parity between the Flutter student app and the React admin/staff web portal.

## Brand

- Logo: official TMC StudentMart seal (do not alter).
- Primary: `#0A4174`
- Deep navy: `#001D39`
- Slate blue: `#49769F`
- Teal blue: `#4E8EA2`
- Muted teal: `#6EA2B3`
- Light blue: `#7BBDE8`
- Pale blue: `#BDD8E9`
- Success: `#166534`
- Warning: `#92400E`
- Error: `#B42332`
- Text: `#06151E`
- Muted text: `#545A5B`, `#898A8C`

## Tokens

- Spacing: `4, 8, 12, 16, 24, 32`
- Radius: `8, 12, 18, 22, 999`
- Motion: `150ms`, `190ms`, `250ms`
- Tap target minimum: `44px`
- Input/button baseline height: `50px`
- Breakpoints: `360px`, `600px`, `840px`

## Typography

- Font family: Roboto with platform-compatible fallbacks.
- Scale: label `12`, body `14`, title `20`, headline `28`.
- Line height: `1.5`.
- Weights: label `600`, body `400`, title `700`, headline `800`.

## Surfaces

- Cards use white background, `18px` radius, subtle border, minimal elevation.
- Panels use rounded surfaces and padded content.
- Empty states use an icon container, title, and helper text.
- Error states use red-tinted surfaces and a retry action.

## Components

- Brand logo placement in app bar/header/sidebar.
- Primary buttons are filled navy.
- Secondary actions use outlined buttons.
- Forms use rounded filled inputs.
- Status badges use semantic colors for active, sold out, archived, pending, rejected.
- Tables remain management-focused in React admin/staff.

## Rules

- Do not invent backend endpoints or roles.
- Preserve authentication, permissions, validation, loading, empty, and error states.
- Keep student features in the Flutter app.
- Keep admin/staff web layouts management-focused.
- Do not change the logo or brand palette.