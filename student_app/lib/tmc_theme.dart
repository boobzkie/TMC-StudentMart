import 'package:flutter/material.dart';

abstract final class TmcPalette {
  static const deepNavy = Color(0xFF001D39);
  static const navyBlue = Color(0xFF0A4174);
  static const slateBlue = Color(0xFF49769F);
  static const tealBlue = Color(0xFF4E8EA2);
  static const mutedTeal = Color(0xFF6EA2B3);
  static const lightBlue = Color(0xFF7BBDE8);
  static const paleBlue = Color(0xFFBDD8E9);

  static const white = Color(0xFFFFFFFF);
  static const lightGray = Color(0xFFD6D6D6);
  static const mediumGray = Color(0xFF898A8C);
  static const darkGray = Color(0xFF545A5B);
  static const deepNavyBlack = Color(0xFF06151E);

  static const success = Color(0xFF166534);
  static const warning = Color(0xFF92400E);
  static const error = Color(0xFFB42332);
  static const information = navyBlue;

  static Color get pageBackground =>
      Color.alphaBlend(white.withValues(alpha: .72), paleBlue);
}

abstract final class TmcTypography {
  static const fontFamily = 'Roboto';
  static const label = 12.0;
  static const body = 14.0;
  static const title = 20.0;
  static const headline = 28.0;
  static const lineHeight = 1.5;
}

abstract final class TmcSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
}

abstract final class TmcRadius {
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 18.0;
  static const xl = 22.0;
  static const pill = 999.0;
}

abstract final class TmcNeumorphism {
  static const lightRaised = <BoxShadow>[
    BoxShadow(color: Color(0x2206151E), offset: Offset(5, 5), blurRadius: 14),
    BoxShadow(color: Color(0xCFFFFFFF), offset: Offset(-5, -5), blurRadius: 14),
  ];

  static const darkRaised = <BoxShadow>[
    BoxShadow(color: Color(0x55000000), offset: Offset(5, 5), blurRadius: 14),
    BoxShadow(color: Color(0x1AFFFFFF), offset: Offset(-5, -5), blurRadius: 14),
  ];

  static const lightInset = <BoxShadow>[
    BoxShadow(color: Color(0x1F06151E), offset: Offset(2, 2), blurRadius: 6),
    BoxShadow(color: Color(0xBFFFFFFF), offset: Offset(-2, -2), blurRadius: 6),
  ];
}

abstract final class TmcMotion {
  static const fast = Duration(milliseconds: 150);
  static const standard = Duration(milliseconds: 190);
  static const slow = Duration(milliseconds: 250);
}

abstract final class TmcTheme {
  static final ThemeData light = _buildLightTheme();

  static ThemeData _buildLightTheme() {
    final colorScheme = ColorScheme.light().copyWith(
      primary: TmcPalette.navyBlue,
      onPrimary: TmcPalette.white,
      primaryContainer: TmcPalette.paleBlue,
      onPrimaryContainer: TmcPalette.deepNavyBlack,
      secondary: TmcPalette.tealBlue,
      onSecondary: TmcPalette.deepNavyBlack,
      secondaryContainer: TmcPalette.paleBlue,
      onSecondaryContainer: TmcPalette.deepNavyBlack,
      surface: TmcPalette.white,
      onSurface: TmcPalette.deepNavyBlack,
      surfaceContainerHighest: TmcPalette.paleBlue,
      onSurfaceVariant: TmcPalette.darkGray,
      outline: TmcPalette.mediumGray,
      outlineVariant: TmcPalette.lightGray,
      error: TmcPalette.error,
      onError: TmcPalette.white,
    );

    final baseTextTheme = ThemeData.light().textTheme.apply(
      bodyColor: TmcPalette.deepNavyBlack,
      displayColor: TmcPalette.deepNavyBlack,
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
        foregroundColor: TmcPalette.deepNavyBlack,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: TmcPalette.deepNavyBlack,
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
        hintStyle: const TextStyle(color: TmcPalette.mediumGray),
        labelStyle: const TextStyle(color: TmcPalette.darkGray),
        prefixIconColor: TmcPalette.slateBlue,
        suffixIconColor: TmcPalette.slateBlue,
        errorStyle: const TextStyle(
          color: TmcPalette.error,
          fontWeight: FontWeight.w600,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.lightGray),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.lightGray),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          borderSide: const BorderSide(color: TmcPalette.navyBlue, width: 1.5),
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
        shadowColor: TmcPalette.deepNavyBlack.withValues(alpha: .08),
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(TmcRadius.lg),
          side: const BorderSide(color: TmcPalette.lightGray),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: TmcPalette.navyBlue,
          foregroundColor: TmcPalette.white,
          disabledBackgroundColor: TmcPalette.mediumGray.withValues(alpha: .32),
          disabledForegroundColor: TmcPalette.darkGray,
          minimumSize: const Size(48, 50),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TmcRadius.md),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: TmcPalette.navyBlue,
          side: const BorderSide(color: TmcPalette.slateBlue),
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TmcRadius.md),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: TmcPalette.navyBlue,
          minimumSize: const Size(48, 44),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(TmcRadius.md),
          ),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: TmcPalette.navyBlue,
          minimumSize: const Size(44, 44),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: TmcPalette.white,
        indicatorColor: TmcPalette.paleBlue,
        elevation: 0,
        height: 68,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? TmcPalette.navyBlue : TmcPalette.darkGray,
            size: 22,
          );
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            color: selected ? TmcPalette.deepNavyBlack : TmcPalette.darkGray,
            fontSize: 11,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          );
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: TmcPalette.white,
        selectedColor: TmcPalette.paleBlue,
        side: const BorderSide(color: TmcPalette.lightGray),
        labelStyle: const TextStyle(
          color: TmcPalette.deepNavyBlack,
          fontWeight: FontWeight.w600,
        ),
        secondaryLabelStyle: const TextStyle(color: TmcPalette.deepNavyBlack),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(TmcRadius.pill),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: TmcPalette.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(TmcRadius.lg),
          side: const BorderSide(color: TmcPalette.lightGray),
        ),
        titleTextStyle: const TextStyle(
          color: TmcPalette.deepNavyBlack,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: TmcPalette.navyBlue,
        textColor: TmcPalette.deepNavyBlack,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      ),
      dividerTheme: const DividerThemeData(
        color: TmcPalette.lightGray,
        thickness: 1,
        space: TmcSpacing.lg,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: TmcPalette.navyBlue,
        linearTrackColor: TmcPalette.paleBlue,
        circularTrackColor: TmcPalette.paleBlue,
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: TmcPalette.deepNavy,
        contentTextStyle: TextStyle(color: TmcPalette.white),
      ),
    );
  }
}
