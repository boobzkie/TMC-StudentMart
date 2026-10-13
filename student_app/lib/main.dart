import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';

import 'auth_page.dart';
import 'components.dart';
import 'data.dart';
import 'shell.dart';
import 'tmc_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiService>(create: (_) => ApiService()),
        ChangeNotifierProvider<AuthState>(
          create: (context) => AuthState(context.read<ApiService>())..restore(),
        ),
        ChangeNotifierProvider<MarketplaceState>(
          create: (context) => MarketplaceState(context.read<ApiService>()),
        ),
        ChangeNotifierProvider<CartState>(
          create: (_) => CartState(const FlutterSecureStorage())..load(),
        ),
      ],
      child: const StudentMartApp(),
    ),
  );
}

class StudentMartApp extends StatelessWidget {
  const StudentMartApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TMC StudentMart',
      debugShowCheckedModeBanner: false,
      theme: TmcTheme.light,
      home: Consumer<AuthState>(
        builder: (context, auth, _) {
          if (auth.isRestoring) return const _SplashScreen();
          return auth.user == null ? const AuthPage() : const AppShell();
        },
      ),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandLogo(size: 94),
          SizedBox(height: 20),
          CircularProgressIndicator(),
        ],
      ),
    ),
  );
}
