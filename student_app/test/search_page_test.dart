// ignore_for_file: depend_on_referenced_packages

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:student_app/data.dart';
import 'package:student_app/search_page.dart';
import 'package:student_app/tmc_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
  });

  testWidgets('search submits to the marketplace API and saves recent query', (
    tester,
  ) async {
    final harness = await _pumpSearch(tester);

    await tester.enterText(
      find.byKey(const ValueKey('marketplace-search-input')),
      'Study',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Search'));
    await tester.pumpAndSettle();

    expect(find.text('Study Notebook'), findsOneWidget);
    expect(find.text('Sold by Search Seller'), findsOneWidget);
    expect(harness.marketplace.recentSearches, ['Study']);
    expect(harness.requests.single.url.queryParameters['search'], 'Study');
  });

  testWidgets('recent search can be repeated, removed, and cleared', (
    tester,
  ) async {
    final harness = await _pumpSearch(tester);

    await tester.enterText(
      find.byKey(const ValueKey('marketplace-search-input')),
      'Textbook',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Search'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Clear search'));
    await tester.pumpAndSettle();

    expect(find.text('Recent searches'), findsOneWidget);
    expect(find.text('Textbook'), findsOneWidget);
    await tester.tap(find.byTooltip('Remove recent search'));
    await tester.pumpAndSettle();
    expect(harness.marketplace.recentSearches, isEmpty);
    expect(find.text('Recent searches'), findsNothing);
  });

  testWidgets('price filters update visible search results', (tester) async {
    await _pumpSearch(tester);

    await tester.enterText(
      find.byKey(const ValueKey('marketplace-search-input')),
      'Study',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Search'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(OutlinedButton, 'Filter'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, '200');
    await tester.tap(find.text('Show results'));
    await tester.pumpAndSettle();

    expect(find.text('No matching products'), findsOneWidget);
    expect(
      find.text('Try adjusting or clearing your filters.'),
      findsOneWidget,
    );
  });

  testWidgets('search and results layout fits narrow and wide screens', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await _pumpSearch(tester);
    await tester.enterText(
      find.byKey(const ValueKey('marketplace-search-input')),
      'Study',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Search'));
    await tester.pumpAndSettle();

    for (final size in const [
      Size(1280, 800),
      Size(900, 900),
      Size(720, 900),
      Size(620, 844),
      Size(420, 844),
      Size(360, 800),
    ]) {
      tester.view.physicalSize = size;
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Viewport: $size');
    }
  });
}

Future<_SearchHarness> _pumpSearch(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final requests = <http.Request>[];
  final client = MockClient((request) async {
    requests.add(request);
    if (request.method == 'GET' && request.url.path.endsWith('/products')) {
      final matchesPrice = request.url.queryParameters.containsKey('min_price')
          ? <Map<String, Object?>>[]
          : [_productJson()];
      return http.Response(
        jsonEncode({
          'success': true,
          'products': matchesPrice,
          'total': matchesPrice.length,
          'pagination': {
            'current_page': 1,
            'last_page': 1,
            'per_page': 24,
            'total': matchesPrice.length,
          },
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    return http.Response(
      jsonEncode({'success': false, 'message': 'Unexpected request.'}),
      404,
      headers: {'content-type': 'application/json'},
    );
  });
  final api = ApiService(client: client);
  final auth = AuthState(api)
    ..user = const Student(
      id: 1,
      name: 'Test Buyer',
      email: 'buyer@example.test',
      role: 'student',
    );
  final marketplace = MarketplaceState(api)
    ..categories = const [ProductCategory(id: 1, name: 'Books')];
  final cart = CartState(const FlutterSecureStorage());

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiService>.value(value: api),
        ChangeNotifierProvider<AuthState>.value(value: auth),
        ChangeNotifierProvider<MarketplaceState>.value(value: marketplace),
        ChangeNotifierProvider<CartState>.value(value: cart),
      ],
      child: MaterialApp(theme: TmcTheme.light, home: const SearchPage()),
    ),
  );
  await tester.pumpAndSettle();

  return _SearchHarness(requests: requests, marketplace: marketplace);
}

Map<String, Object?> _productJson() => {
  'id': 7,
  'name': 'Study Notebook',
  'description': 'Ruled pages for lecture notes.',
  'price': 120,
  'category': 'Books',
  'status': 'active',
  'stock_quantity': 5,
  'user_id': 20,
  'user': {'id': 20, 'name': 'Search Seller', 'username': 'searchseller'},
  'images': <Map<String, Object?>>[],
  'attributes': {'condition': 'New'},
  'variants': <Map<String, Object?>>[],
};

class _SearchHarness {
  const _SearchHarness({required this.requests, required this.marketplace});

  final List<http.Request> requests;
  final MarketplaceState marketplace;
}
