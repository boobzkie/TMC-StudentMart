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
import 'package:student_app/profile_page.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
  });

  testWidgets('cart groups sellers and checks out selected lines only', (
    tester,
  ) async {
    _setViewport(tester, const Size(390, 844));
    final first = _product(
      id: 11,
      sellerId: 20,
      sellerName: 'Campus Books',
      name: 'Long mathematics textbook title that wraps safely',
      price: 300,
    );
    final second = _product(
      id: 22,
      sellerId: 30,
      sellerName: 'Student Supplies',
      name: 'Scientific calculator',
      price: 500,
    );
    final harness = await _pumpCart(tester, [first, second]);

    expect(find.text('My Cart'), findsOneWidget);
    expect(find.text('Campus Books'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Student Supplies'),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Student Supplies'), findsOneWidget);
    expect(
      find.textContaining('Long mathematics textbook title'),
      findsOneWidget,
    );
    expect(find.text('Estimated total'), findsOneWidget);

    final calculatorCheckbox = _selectionCheckbox(
      'Select Scientific calculator',
    );
    await tester.ensureVisible(calculatorCheckbox);
    await tester.tap(calculatorCheckbox);
    await tester.pumpAndSettle();
    expect(find.text('Selected items (1)'), findsOneWidget);
    expect(find.text('Proceed to Checkout (1)'), findsOneWidget);

    await tester.tap(find.text('Proceed to Checkout (1)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('Choose order arrangements'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.text('Order request sent'), findsOneWidget);
    final request = harness.requests.singleWhere(
      (item) => item.method == 'POST' && item.url.path.endsWith('/orders'),
    );
    final body = jsonDecode(request.body) as Map<String, dynamic>;
    expect(body['items'], [
      {'product_id': 11, 'variant_id': null, 'quantity': 1},
    ]);
    expect(harness.cart.entries, hasLength(1));
    expect(harness.cart.entries.single.product.id, 22);
    expect(harness.cart.itemCount, 1);
  });

  testWidgets('quantity controls respect stock and remove supports undo', (
    tester,
  ) async {
    _setViewport(tester, const Size(390, 844));
    final product = _product(
      id: 33,
      sellerId: 40,
      sellerName: 'TMC Store',
      name: 'Limited stock notebook',
      price: 125,
      stock: 2,
    );
    final harness = await _pumpCart(tester, [product]);

    final increase = find.byTooltip(
      'Increase quantity for Limited stock notebook',
    );
    await tester.ensureVisible(increase);
    await tester.tap(increase);
    await tester.pumpAndSettle();
    expect(harness.cart.entries.single.quantity, 2);

    await tester.ensureVisible(increase);
    await tester.tap(increase);
    await tester.pumpAndSettle();
    expect(harness.cart.entries.single.quantity, 2);
    expect(find.text('Only 2 unit(s) are currently available.'), findsWidgets);

    final decrease = find.byTooltip(
      'Decrease quantity for Limited stock notebook',
    );
    await tester.ensureVisible(decrease);
    await tester.tap(decrease);
    await tester.pumpAndSettle();
    expect(harness.cart.entries.single.quantity, 1);

    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    final remove = find.byTooltip('Remove Limited stock notebook');
    await tester.ensureVisible(remove);
    await tester.tap(remove);
    await tester.pump(const Duration(milliseconds: 250));
    expect(harness.cart.entries, isEmpty);
    expect(find.text('Your cart is empty.'), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, 'Undo'));
    await tester.pumpAndSettle();
    expect(harness.cart.entries.single.product.id, 33);
  });

  testWidgets('empty cart has a browse action and layout fits common widths', (
    tester,
  ) async {
    _setViewport(tester, const Size(390, 844));
    final harness = await _pumpCart(tester, const []);
    var browsed = false;

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<ApiService>.value(value: harness.api),
          ChangeNotifierProvider<AuthState>.value(value: harness.auth),
          ChangeNotifierProvider<CartState>.value(value: harness.cart),
        ],
        child: MaterialApp(home: CartPage(onBrowse: () => browsed = true)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Your cart is empty.'), findsOneWidget);
    await tester.tap(find.text('Browse Products'));
    expect(browsed, isTrue);

    for (final size in const [
      Size(320, 740),
      Size(420, 844),
      Size(768, 900),
      Size(1024, 900),
      Size(1440, 1000),
    ]) {
      tester.view.physicalSize = size;
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Viewport: $size');
    }

    await _pumpCart(tester, [
      _product(
        id: 44,
        sellerId: 50,
        sellerName: 'Student seller with a long shop name',
        name:
            'Long product name that must wrap without pushing the quantity controls off screen',
        price: 1750,
      ),
    ]);
    for (final size in const [
      Size(320, 740),
      Size(420, 844),
      Size(768, 900),
      Size(1024, 900),
      Size(1440, 1000),
    ]) {
      tester.view.physicalSize = size;
      await tester.pumpAndSettle();
      expect(
        tester.takeException(),
        isNull,
        reason: 'Populated viewport: $size',
      );
    }
  });
}

Finder _selectionCheckbox(String label) => find.byWidgetPredicate(
  (widget) => widget is Checkbox && widget.semanticLabel == label,
);

void _setViewport(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<_CartHarness> _pumpCart(
  WidgetTester tester,
  List<Product> products,
) async {
  final requests = <http.Request>[];
  final byId = {for (final product in products) product.id: product};
  final client = MockClient((request) async {
    requests.add(request);
    if (request.method == 'GET' && request.url.path.contains('/products/')) {
      final id = int.tryParse(request.url.pathSegments.last) ?? 0;
      final product = byId[id];
      if (product == null) {
        return http.Response(
          jsonEncode({'message': 'Product not found.'}),
          404,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response(
        jsonEncode({'success': true, 'product': _productJson(product)}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'GET' &&
        request.url.path.endsWith('/order-options')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'payment_methods': [
            {'id': 1, 'name': 'Cash in person', 'instructions': ''},
          ],
          'pickup_locations': [
            {
              'id': 2,
              'name': 'Main campus',
              'campus_area': 'Library',
              'building_room': 'Room 1',
            },
          ],
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'POST' && request.url.path.endsWith('/orders')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'orders': [
            {'id': 1, 'status': 'pending'},
          ],
        }),
        201,
        headers: {'content-type': 'application/json'},
      );
    }
    return http.Response(
      jsonEncode({'message': 'Unexpected cart test request.'}),
      404,
      headers: {'content-type': 'application/json'},
    );
  });
  const storage = FlutterSecureStorage();
  final api = ApiService(client: client, storage: storage);
  final cart = CartState(storage);
  await cart.load();
  for (final product in products) {
    await cart.add(product, currentUserId: 1);
  }
  final auth = AuthState(api)
    ..user = const Student(
      id: 1,
      name: 'Buyer Student',
      email: 'buyer@example.test',
      role: 'student',
    );

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiService>.value(value: api),
        ChangeNotifierProvider<AuthState>.value(value: auth),
        ChangeNotifierProvider<CartState>.value(value: cart),
      ],
      child: const MaterialApp(home: CartPage()),
    ),
  );
  await tester.pumpAndSettle();

  return _CartHarness(requests: requests, api: api, auth: auth, cart: cart);
}

Product _product({
  required int id,
  required int sellerId,
  required String sellerName,
  required String name,
  required double price,
  int stock = 5,
}) => Product(
  id: id,
  name: name,
  description: 'A cart test product.',
  price: price,
  category: 'Books',
  status: 'active',
  sellerName: sellerName,
  userId: sellerId,
  stockQuantity: stock,
  attributes: const {},
);

Map<String, Object?> _productJson(Product product) => {
  'id': product.id,
  'name': product.name,
  'description': product.description,
  'price': product.price,
  'category': product.category,
  'status': product.status,
  'stock_quantity': product.stockQuantity,
  'image': product.image,
  'images': const [],
  'attributes': const {},
  'variants': const [],
  'user_id': product.userId,
  'user': {'id': product.userId, 'name': product.sellerName},
};

class _CartHarness {
  const _CartHarness({
    required this.requests,
    required this.api,
    required this.auth,
    required this.cart,
  });

  final List<http.Request> requests;
  final ApiService api;
  final AuthState auth;
  final CartState cart;
}
