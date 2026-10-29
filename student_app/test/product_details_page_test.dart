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
import 'package:student_app/product_details_page.dart';
import 'package:student_app/tmc_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
  });

  testWidgets('owner sees listing management instead of purchase actions', (
    tester,
  ) async {
    await _pumpProductDetails(
      tester,
      currentUserId: 20,
      sellerId: 20,
      stock: 4,
    );

    expect(find.text('Your listing'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('product-details-edit-listing')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('product-details-add-to-cart')),
      findsNothing,
    );

    await tester.tap(
      find.byKey(const ValueKey('product-details-edit-listing')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Edit listing'), findsOneWidget);
  });

  testWidgets('buyer can add another seller active product to cart', (
    tester,
  ) async {
    final harness = await _pumpProductDetails(
      tester,
      currentUserId: 1,
      sellerId: 20,
      stock: 4,
    );

    expect(
      find.byKey(const ValueKey('product-details-add-to-cart')),
      findsOneWidget,
    );
    expect(find.text('Your listing'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('product-details-add-to-cart')));
    await tester.pumpAndSettle();

    expect(harness.cart.itemCount, 1);
  });

  testWidgets(
    'variant stock remains available when another option is sold out',
    (tester) async {
      await _pumpProductDetails(
        tester,
        currentUserId: 1,
        sellerId: 20,
        stock: 0,
        variants: const [
          {'id': 4, 'label': 'Small', 'stock_quantity': 2},
          {'id': 5, 'label': 'Large', 'stock_quantity': 0},
        ],
      );

      expect(find.text('Choose option'), findsOneWidget);
      expect(find.text('Sold out'), findsOneWidget);
      final unavailableVariant = tester.widget<CheckboxListTile>(
        find.widgetWithText(CheckboxListTile, 'Large'),
      );
      expect(unavailableVariant.onChanged, isNull);
      await tester.tap(find.text('Small'));
      await tester.pumpAndSettle();
      expect(find.text('Add to cart'), findsOneWidget);
    },
  );

  testWidgets('unavailable listings do not expose a purchase action', (
    tester,
  ) async {
    await _pumpProductDetails(
      tester,
      currentUserId: 1,
      sellerId: 20,
      stock: 0,
      status: 'sold_out',
    );

    expect(find.text('This listing is out of stock.'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('product-details-add-to-cart')),
      findsNothing,
    );
  });

  testWidgets('owner controls fit a narrow mobile viewport', (tester) async {
    await _pumpProductDetails(
      tester,
      currentUserId: 20,
      sellerId: 20,
      stock: 4,
      viewport: const Size(320, 800),
    );

    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('product-details-edit-listing')),
      findsOneWidget,
    );
  });
}

Future<_ProductDetailsHarness> _pumpProductDetails(
  WidgetTester tester, {
  required int currentUserId,
  required int sellerId,
  required int stock,
  String status = 'active',
  List<Map<String, Object?>> variants = const [],
  Size viewport = const Size(390, 844),
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = viewport;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final productId = 31;
  final api = ApiService(
    client: MockClient((request) async {
      if (request.method == 'GET' &&
          request.url.path.endsWith('/products/$productId/reviews')) {
        return http.Response(
          jsonEncode({
            'reviews': [],
            'current_page': 1,
            'last_page': 1,
            'total': 0,
            'average_rating': 0,
            'can_review': false,
            'already_reviewed': false,
            'eligibility_message':
                'Only students with a completed order can review this product.',
          }),
          200,
        );
      }
      if (request.method == 'GET' &&
          request.url.path.endsWith('/products/$productId')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'product': {
              'id': productId,
              'name': 'Course textbook',
              'description': 'A used textbook in good condition.',
              'price': 180,
              'category': 'Books',
              'status': status,
              'stock_quantity': stock,
              'user_id': sellerId,
              'user': {
                'id': sellerId,
                'name': 'Student Seller',
                'username': 'seller',
                'course': 'BSIT',
              },
              'variants': variants,
            },
          }),
          200,
        );
      }
      if (request.method == 'GET' && request.url.path.endsWith('/categories')) {
        return http.Response(jsonEncode({'categories': []}), 200);
      }
      return http.Response('{}', 200);
    }),
  );
  final auth = AuthState(api)
    ..user = Student(
      id: currentUserId,
      name: currentUserId == sellerId ? 'Listing Owner' : 'Test Buyer',
      email: 'student@example.test',
      role: 'student',
    );
  final marketplace = MarketplaceState(api);
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
        home: ProductDetailsPage(productId: productId),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return _ProductDetailsHarness(cart: cart);
}

class _ProductDetailsHarness {
  const _ProductDetailsHarness({required this.cart});

  final CartState cart;
}
