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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
  });

  testWidgets('Home swipes through active listings and skips sold-out items', (
    tester,
  ) async {
    _setPhoneViewport(tester);
    await _pumpHome(tester, [
      _product(id: 1, name: 'Sold-out listing', status: 'sold_out'),
      _product(id: 2, name: 'First book', sellerId: 20),
      _product(id: 3, name: 'Second book', sellerId: 30),
    ]);

    expect(find.text('First book'), findsOneWidget);
    expect(find.text('Sold-out listing'), findsNothing);

    await tester.drag(
      find.byWidgetPredicate(
        (widget) =>
            widget is PageView && widget.scrollDirection == Axis.vertical,
      ),
      const Offset(0, -650),
    );
    await tester.pumpAndSettle();

    expect(find.text('Second book'), findsOneWidget);
  });

  testWidgets('Follow uses the existing API and cart action uses CartState', (
    tester,
  ) async {
    _setPhoneViewport(tester);
    final harness = await _pumpHome(tester, [
      _product(id: 2, name: 'Course book', sellerId: 20),
    ]);

    expect(find.byTooltip('Follow seller'), findsOneWidget);
    await tester.tap(find.byTooltip('Follow seller'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('Following seller'), findsOneWidget);
    expect(
      harness.requests.any(
        (request) =>
            request.method == 'POST' &&
            request.url.path.endsWith('/students/20/follow'),
      ),
      isTrue,
    );

    await tester.tap(find.byTooltip('Add to cart'));
    await tester.pumpAndSettle();

    expect(harness.cart.itemCount, 1);
  });

  testWidgets('Product details and public seller profile open from the feed', (
    tester,
  ) async {
    _setPhoneViewport(tester);
    await _pumpHome(tester, [
      _product(id: 4, name: 'Used calculator', sellerId: 40),
    ]);

    await tester.tap(find.byTooltip('Details'));
    await tester.pumpAndSettle();
    expect(find.text('Product details'), findsWidgets);
    expect(find.text('Used calculator'), findsNWidgets(2));

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sold by Seller 40'));
    await tester.pumpAndSettle();

    expect(find.text('Seller profile'), findsOneWidget);
    expect(find.text('Active listings (1)'), findsOneWidget);
    expect(find.text('TMC Student · BSIT'), findsOneWidget);
  });

  testWidgets('Product photos open a swipeable full-screen image viewer', (
    tester,
  ) async {
    _setPhoneViewport(tester);
    await _pumpHome(tester, [
      _product(
        id: 5,
        name: 'Two-image listing',
        images: const [
          ProductImage(path: '/first.jpg'),
          ProductImage(path: '/second.jpg'),
        ],
      ),
    ]);

    await tester.tap(find.bySemanticsLabel('Open product images full screen'));
    await tester.pumpAndSettle();
    expect(find.text('1 / 2'), findsOneWidget);

    await tester.tap(find.byTooltip('Next image'));
    await tester.pumpAndSettle();
    expect(find.text('2 / 2'), findsOneWidget);

    await tester.tap(find.byTooltip('Close image viewer'));
    await tester.pumpAndSettle();
    expect(find.text('Two-image listing'), findsOneWidget);
  });

  testWidgets('Home feed lays out without overflow on tablet and desktop', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    await _pumpHome(tester, [_product(id: 6, name: 'Responsive listing')]);

    for (final size in const [
      Size(1280, 800),
      Size(900, 900),
      Size(720, 900),
      Size(620, 844),
      Size(420, 844),
    ]) {
      tester.view.physicalSize = size;
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Viewport: $size');
    }
    addTearDown(tester.view.resetPhysicalSize);
  });
}

void _setPhoneViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Future<_HomeHarness> _pumpHome(
  WidgetTester tester,
  List<Product> products,
) async {
  final requests = <http.Request>[];
  final client = MockClient((request) async {
    requests.add(request);
    final pathSegments = request.url.path.split('/');
    final sellerId = pathSegments.length > 1
        ? int.tryParse(pathSegments[pathSegments.length - 2]) ?? 0
        : 0;
    final following = request.method == 'POST';
    if (request.url.path.endsWith('/follow') &&
        (request.method == 'GET' || request.method == 'POST')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'student': {
            'id': sellerId,
            'name': 'Seller $sellerId',
            'course': 'BSIT',
            'profile_picture': null,
          },
          'followers_count': following ? 6 : 5,
          'following_count': 2,
          'is_following': following,
          'is_self': false,
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    return http.Response(
      jsonEncode({'success': false, 'message': 'Unexpected test request.'}),
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
  final marketplace = MarketplaceState(api)..products = products;
  final cart = CartState(const FlutterSecureStorage());

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiService>.value(value: api),
        ChangeNotifierProvider<AuthState>.value(value: auth),
        ChangeNotifierProvider<MarketplaceState>.value(value: marketplace),
        ChangeNotifierProvider<CartState>.value(value: cart),
      ],
      child: const MaterialApp(
        home: Scaffold(body: HomePage(onOpenMarketplace: _noop)),
      ),
    ),
  );
  await tester.pumpAndSettle();

  return _HomeHarness(requests: requests, cart: cart);
}

void _noop() {}

Product _product({
  required int id,
  required String name,
  int sellerId = 20,
  String status = 'active',
  List<ProductImage> images = const [],
}) => Product(
  id: id,
  name: name,
  description: 'A real listing description for $name.',
  price: 250,
  category: 'Books',
  status: status,
  sellerName: 'Seller $sellerId',
  userId: sellerId,
  stockQuantity: 2,
  attributes: const {'condition': 'Used - Good', 'brand': 'TMC'},
  images: images,
);

class _HomeHarness {
  const _HomeHarness({required this.requests, required this.cart});

  final List<http.Request> requests;
  final CartState cart;
}
