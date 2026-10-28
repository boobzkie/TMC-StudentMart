// ignore_for_file: depend_on_referenced_packages

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:student_app/data.dart';
import 'package:student_app/sell_page.dart';
import 'package:student_app/tmc_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform({
      ApiService.tokenKey: 'test-token',
    });
  });

  testWidgets('New listing form stays responsive and validates required data', (
    tester,
  ) async {
    final requests = <http.Request>[];
    final api = ApiService(
      client: MockClient((request) async {
        requests.add(request);
        if (request.method == 'GET' &&
            request.url.path.endsWith('/categories')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'categories': [
                {'id': 1, 'name': 'Books', 'status': 'active'},
              ],
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.method == 'POST' &&
            request.url.path.endsWith('/products')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'message': 'Product submitted successfully.',
              'product': {'id': 25, 'status': 'pending'},
            }),
            201,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.method == 'GET' &&
            (request.url.path.endsWith('/my-products') ||
                request.url.path.endsWith('/products'))) {
          return http.Response(
            jsonEncode({'success': true, 'products': [], 'total': 0}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response(
          jsonEncode({'success': false, 'message': 'Unexpected request.'}),
          404,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    final marketplace = MarketplaceState(api);

    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      ChangeNotifierProvider<MarketplaceState>.value(
        value: marketplace,
        child: MaterialApp(
          theme: TmcTheme.light,
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => const ProductFormPage(),
                    ),
                  ),
                  child: const Text('Open listing form'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open listing form'));
    await tester.pumpAndSettle();

    for (final width in [320.0, 375.0, 430.0, 768.0, 1024.0, 1440.0]) {
      tester.view.physicalSize = Size(width, 900);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Viewport: $width px');
    }

    expect(find.text('Product information'), findsOneWidget);
    expect(find.text('Inventory and options'), findsOneWidget);
    expect(find.text('Product photos'), findsOneWidget);
    expect(find.text('0 of 4 photos'), findsOneWidget);
    expect(
      requests.any((request) => request.url.path.endsWith('/categories')),
      isTrue,
    );

    await tester.ensureVisible(find.text('Submit for review'));
    await tester.tap(find.text('Submit for review'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Product information'));
    await tester.pumpAndSettle();

    expect(find.text('Enter a product name.'), findsOneWidget);
    expect(find.text('Enter a description.'), findsOneWidget);
    expect(find.text('Select a category.'), findsOneWidget);
    expect(
      find.text('Enter a price with up to 2 decimal places.'),
      findsOneWidget,
    );
    expect(
      requests.where((request) => request.url.path.endsWith('/products')),
      isEmpty,
    );

    await tester.ensureVisible(find.byKey(const ValueKey('listing-name')));
    await tester.enterText(
      find.byKey(const ValueKey('listing-name')),
      'TMC course book',
    );
    await tester.enterText(
      find.byKey(const ValueKey('listing-description')),
      'Clean used copy with no missing pages.',
    );
    await tester.enterText(
      find.byKey(const ValueKey('listing-price')),
      '250.50',
    );
    final category = find.byType(DropdownButtonFormField<int>);
    await tester.ensureVisible(category);
    await tester.tap(category);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Books').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Submit for review'));
    await tester.tap(find.text('Submit for review'));
    await tester.pumpAndSettle();

    expect(find.text('Open listing form'), findsOneWidget);
    expect(find.text('Listing submitted for review.'), findsOneWidget);
    expect(
      requests.where(
        (request) =>
            request.method == 'POST' && request.url.path.endsWith('/products'),
      ),
      hasLength(1),
    );
  });

  testWidgets('leaving a changed listing asks before discarding it', (
    tester,
  ) async {
    final api = ApiService(
      client: MockClient((request) async {
        if (request.url.path.endsWith('/categories')) {
          return http.Response(
            jsonEncode({'success': true, 'categories': []}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 200);
      }),
    );
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ChangeNotifierProvider<MarketplaceState>.value(
        value: MarketplaceState(api),
        child: MaterialApp(
          theme: TmcTheme.light,
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => const ProductFormPage(),
                    ),
                  ),
                  child: const Text('Open listing form'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open listing form'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('listing-name')),
      'Draft listing',
    );
    await tester.pump();
    expect(
      tester
          .widget<TextFormField>(find.byKey(const ValueKey('listing-name')))
          .controller!
          .text,
      'Draft listing',
    );
    expect(
      tester.widget<PopScope<void>>(find.byType(PopScope<void>)).canPop,
      isFalse,
    );

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(ProductFormPage), findsOneWidget);
    expect(find.text('Discard listing changes?'), findsOneWidget);
    await tester.tap(find.text('Keep editing'));
    await tester.pumpAndSettle();
    expect(find.text('Product information'), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Discard changes'));
    await tester.pumpAndSettle();
    expect(find.text('Open listing form'), findsOneWidget);
  });
}
