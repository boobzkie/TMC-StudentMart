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
import 'package:student_app/marketplace_page.dart';
import 'package:student_app/tmc_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
  });

  testWidgets('shop searches listings and filters by category', (tester) async {
    final harness = await _pumpMarketplace(tester);

    expect(find.text('Study Notebook'), findsOneWidget);
    expect(find.text('Canvas Tote'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('shop-search-input')),
      'notebook',
    );
    await tester.pumpAndSettle();

    expect(find.text('Study Notebook'), findsOneWidget);
    expect(find.text('Canvas Tote'), findsNothing);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).first, const Offset(-180, 0));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('shop-category-Books')));
    await tester.pumpAndSettle();

    expect(find.text('Study Notebook'), findsOneWidget);
    expect(find.text('Canvas Tote'), findsNothing);
    expect(harness.marketplace.products, hasLength(2));
    expect(harness.requests.last.url.queryParameters['category_id'], '1');
    expect(harness.requests.last.url.queryParameters['category'], 'Books');
  });

  testWidgets('shop switches between grid and list layouts', (tester) async {
    await _pumpMarketplace(tester);

    expect(find.byKey(const ValueKey('shop-product-grid')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('shop-list-view')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('shop-product-list')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('shop-grid-view')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('shop-product-grid')), findsOneWidget);
  });

  testWidgets('shop listings fit small mobile through desktop widths', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await _pumpMarketplace(tester);

    for (final size in const [
      Size(320, 800),
      Size(360, 800),
      Size(390, 844),
      Size(430, 900),
      Size(768, 1024),
      Size(1024, 900),
      Size(1280, 900),
    ]) {
      tester.view.physicalSize = size;
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Viewport: $size');
    }
  });
}

Future<_MarketplaceHarness> _pumpMarketplace(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final requests = <http.Request>[];
  final api = ApiService(
    client: MockClient((request) async {
      requests.add(request);
      if (request.method == 'GET' && request.url.path.endsWith('/products')) {
        final query = request.url.queryParameters;
        final booksOnly =
            query['search']?.isNotEmpty == true || query['category_id'] == '1';
        final products = booksOnly
            ? [_apiProduct(id: 7, name: 'Study Notebook', category: 'Books')]
            : [
                _apiProduct(id: 7, name: 'Study Notebook', category: 'Books'),
                _apiProduct(
                  id: 8,
                  name: 'Canvas Tote',
                  category: 'Accessories',
                ),
              ];
        return http.Response(
          jsonEncode({
            'success': true,
            'products': products,
            'total': products.length,
            'pagination': {
              'current_page': int.tryParse(query['page'] ?? '') ?? 1,
              'last_page': 1,
              'per_page': 24,
              'total': products.length,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('{}', 200);
    }),
  );
  final auth = AuthState(api)
    ..user = const Student(
      id: 1,
      name: 'Test Buyer',
      email: 'buyer@example.test',
      role: 'student',
    );
  final marketplace = MarketplaceState(api)
    ..categories = const [
      ProductCategory(id: 1, name: 'Books'),
      ProductCategory(id: 2, name: 'Accessories'),
    ]
    ..products = const [
      Product(
        id: 7,
        name: 'Study Notebook',
        description: 'Ruled pages for lecture notes.',
        price: 120,
        category: 'Books',
        status: 'active',
        stockQuantity: 5,
        sellerName: 'Search Seller',
        sellerUsername: 'searchseller',
        userId: 20,
      ),
      Product(
        id: 8,
        name: 'Canvas Tote',
        description: 'Reusable carry bag.',
        price: 180,
        category: 'Accessories',
        status: 'active',
        stockQuantity: 2,
        sellerName: 'Market Seller',
        sellerUsername: 'marketseller',
        userId: 21,
      ),
    ];
  final cart = CartState(const FlutterSecureStorage());

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiService>.value(value: api),
        ChangeNotifierProvider<AuthState>.value(value: auth),
        ChangeNotifierProvider<MarketplaceState>.value(value: marketplace),
        ChangeNotifierProvider<CartState>.value(value: cart),
      ],
      child: MaterialApp(
        theme: TmcTheme.light,
        home: const Scaffold(body: MarketplacePage()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return _MarketplaceHarness(marketplace: marketplace, requests: requests);
}

Map<String, Object?> _apiProduct({
  required int id,
  required String name,
  required String category,
}) => {
  'id': id,
  'name': name,
  'description': 'A sample marketplace listing.',
  'price': id == 7 ? 120 : 180,
  'category': category,
  'status': 'active',
  'stock_quantity': 2,
  'user_id': id + 10,
  'user': {
    'id': id + 10,
    'name': id == 7 ? 'Search Seller' : 'Market Seller',
    'username': id == 7 ? 'searchseller' : 'marketseller',
  },
  'images': <Map<String, Object?>>[],
  'attributes': {'condition': 'New'},
  'variants': <Map<String, Object?>>[],
};

class _MarketplaceHarness {
  const _MarketplaceHarness({
    required this.marketplace,
    required this.requests,
  });

  final MarketplaceState marketplace;
  final List<http.Request> requests;
}
