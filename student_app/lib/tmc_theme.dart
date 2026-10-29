import 'package:flutter/material.dart';

abstract final class TmcPalette {
  // Shared student-app tokens. Keep page styling tied to these values so a
  // brand adjustment is applied consistently across every screen.
  static const deepNavy = Color(0xFF0F172A);
  static const primary = Color(0xFF0F2C59);
  static const primaryHover = Color(0xFF174875);
  static const slateBlue = Color(0xFF475569);
  static const tealBlue = Color(0xFF0284C7);
  static const accentBlue = Color(0xFF0284C7);
  static const mutedTeal = Color(0xFF0F766E);
  static const lightBlue = Color(0xFF38BDF8);
  static const paleBlue = Color(0xFFE0F2FE);
  static const gold = Color(0xFFD97706);

  static const deepNavyBlack = deepNavy;
  static const mutedGreen = mutedTeal;
  static const satinGold = gold;
  static const white = Color(0xFFFFFFFF);
  static const pageBackground = Color(0xFFF8FAFC);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFCBD5E1);
  static const borderSoft = Color(0xFFE2E8F0);
  static const text = deepNavy;
  static const textMuted = slateBlue;
  static const textSoft = Color(0xFF64748B);
  static const invertedText = white;

  static const success = Color(0xFF166534);
  static const successSoft = Color(0xFFDCFCE7);
  static const warning = Color(0xFF92400E);
  static const warningSoft = Color(0xFFFEF3C7);
  static const error = Color(0xFFB91C1C);
  static const errorSoft = Color(0xFFFEE2E2);
  static const followAccent = Color(0xFFE83E66);
  // Use a deeper blue for small informational text to retain AA contrast.
  static const information = Color(0xFF0369A1);
  static const informationSoft = Color(0xFFE0F2FE);
  static const primarySoft = Color(0xFFEFF6FF);

  // Backward-compatible aliases for existing pages ported to the TMC brand.
  static const navyBlue = primary;
  static const darkGray = textMuted;
  static const lightGray = border;
  static const mediumGray = textSoft;
  static const tikTokCyan = primary;
  static const neutralSurface = pageBackground;
}

abstract final class TmcTypography {
  // Roboto is the existing platform-safe font. Inter is not bundled in this
  // app, so naming it here would silently fall back on most student devices.
  static const fontFamily = 'Roboto';

  static const labelSize = 12.0;
  static const bodySize = 14.0;
  static const titleSize = 20.0;
  static const headlineSize = 28.0;
  static const lineHeight = 1.5;

  static const weightLabel = FontWeight.w600;
  static const weightBody = FontWeight.w400;
  static const weightTitle = FontWeight.w700;
  static const weightHeadline = FontWeight.w800;
}

abstract final class TmcLayout {
  static const breakpointSmall = 360.0;
  static const breakpointMedium = 600.0;
  static const breakpointLarge = 840.0;
  static const gridMinColumnWidth = 230.0;
}

abstract final class TmcControlSize {
  static const minimumTapTarget = 44.0;
  static const inputHeight = 50.0;
  static const filledButtonHeight = 50.0;
  static const outlinedButtonHeight = 48.0;
  static const textButtonHeight = 44.0;
}

abstract final class TmcSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 22.0;
  static const xxl = 32.0;
}

abstract final class TmcRadius {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 22.0;
  static const pill = 999.0;
}

abstract final class TmcNeumorphism {
  static const lightRaised = <BoxShadow>[
    BoxShadow(color: Color(0x1F001D39), offset: Offset(4, 4), blurRadius: 12),
    BoxShadow(color: Color(0xB3FFFFFF), offset: Offset(-4, -4), blurRadius: 12),
  ];

  static const darkRaised = <BoxShadow>[
    BoxShadow(color: Color(0x55000000), offset: Offset(5, 5), blurRadius: 14),
    BoxShadow(color: Color(0x1AFFFFFF), offset: Offset(-5, -5), blurRadius: 14),
  ];

  static const lightInset = <BoxShadow>[
    BoxShadow(color: Color(0x16001D39), offset: Offset(2, 2), blurRadius: 6),
    BoxShadow(color: Color(0xBFFFFFFF), offset: Offset(-2, -2), blurRadius: 6),
  ];
}

abstract final class TmcMotion {
  static const fast = Duration(milliseconds: 150);
  static const standard = Duration(milliseconds: 200);
  static const slow = Duration(milliseconds: 250);
}

abstract final class TmcTheme {
  static final ThemeData light = _buildLightTheme();

  static ThemeData _buildLightTheme() {
    final colorScheme = ColorScheme.light().copyWith(
      primary: TmcPalette.primary,
      onPrimary: TmcPalette.white,
      primaryContainer: TmcPalette.primarySoft,
      onPrimaryContainer: TmcPalette.deepNavy,
      secondary: TmcPalette.slateBlue,
      onSecondary: TmcPalette.white,
      secondaryContainer: TmcPalette.primarySoft,
      onSecondaryContainer: TmcPalette.deepNavy,
      surface: TmcPalette.white,
      onSurface: TmcPalette.text,
      surfaceContainerHighest: TmcPalette.informationSoft,
      onSurfaceVariant: TmcPalette.textMuted,
      outline: TmcPalette.border,
      outlineVariant: TmcPalette.borderSoft,
      error: TmcPalette.error,
      onError: TmcPalette.white,
    );

    final baseTextTheme = ThemeData.light().textTheme.apply(
      bodyColor: TmcPalette.text,
      displayColor: TmcPalette.text,
      fontFamily: TmcTypography.fontFamily,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: TmcPalette.pageBackground,
      fontFamily: TmcTypography.fontFamily,
      visualDensity: VisualDensity.adaptivePlatformDensity,
      textTheme: baseTextTheme.copyWith(
        titleLarge: baseTextTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -.25,
        ),
        titleMedium: baseTextTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
        bodyMedium: baseTextTheme.bodyMedium?.copyWith(height: 1.45),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: TmcPalette.white,
        foregroundColor: TmcPalette.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: TmcPalette.text,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          fontFamily: TmcTypography.fontFamily,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: TmcPalette.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: TmcSpacing.lg,
          vertical: 15,
        ),
        hintStyle: const TextStyle(color: TmcPalette.textSoft),
        labelStyle: const TextStyle(color: TmcPalette.textMuted),
        prefixIconColor: TmcPalette.primary,
        suffixIconColor: TmcPalette.primary,
        errorStyle: const TextStyle(
          color: TmcPalette.error,
          fontWeight: FontWeight.w600,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.error, width: 1.5),
        ),
      ),
      cardTheme: CardThemeData(
        color: TmcPalette.white,
        elevation: 1,
        shadowColor: TmcPalette.text.withValues(alpha: .06),
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(TmcRadius.lg),
          side: const BorderSide(color: TmcPalette.border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: TmcPalette.primary,
          foregroundColor: TmcPalette.white,
          disabledBackgroundColor: TmcPalette.textSoft.withValues(alpha: .32),
          disabledForegroundColor: TmcPalette.textMuted,
          minimumSize: const Size(48, TmcControlSize.filledButtonHeight),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TmcRadius.md),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: TmcPalette.primary,
          side: const BorderSide(color: TmcPalette.border),
          minimumSize: const Size(48, TmcControlSize.outlinedButtonHeight),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TmcRadius.md),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: TmcPalette.primary,
          minimumSize: const Size(48, TmcControlSize.textButtonHeight),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TmcRadius.md),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: TmcPalette.primary,
          minimumSize: const Size(44, 44),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: TmcPalette.white,
        indicatorColor: TmcPalette.tealBlue.withValues(alpha: .18),
        elevation: 0,
        height: TmcControlSize.filledButtonHeight + 18,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? TmcPalette.primary : TmcPalette.textMuted,
            size: 22,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: selected ? TmcPalette.primary : TmcPalette.textSoft,
            fontSize: TmcTypography.labelSize,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          );
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: TmcPalette.surface,
        selectedColor: TmcPalette.primarySoft,
        side: const BorderSide(color: TmcPalette.borderSoft),
        labelStyle: const TextStyle(
          color: TmcPalette.text,
          fontWeight: FontWeight.w600,
        ),
        secondaryLabelStyle: const TextStyle(color: TmcPalette.textMuted),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(TmcRadius.pill),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: TmcPalette.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(TmcRadius.lg),
          side: const BorderSide(color: TmcPalette.borderSoft),
        ),
        titleTextStyle: const TextStyle(
          color: TmcPalette.text,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: TmcPalette.primary,
        textColor: TmcPalette.text,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      ),
      dividerTheme: const DividerThemeData(
        color: TmcPalette.borderSoft,
        thickness: 1,
        space: TmcSpacing.lg,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: TmcPalette.primary,
        linearTrackColor: TmcPalette.informationSoft,
        circularTrackColor: TmcPalette.informationSoft,
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: TmcPalette.deepNavy,
        contentTextStyle: TextStyle(color: TmcPalette.white),
      ),
    );
  }
}
