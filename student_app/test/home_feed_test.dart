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
      _product(
        id: 4,
        name: 'Used calculator',
        sellerId: 40,
        images: const [
          ProductImage(path: '/calculator-front.jpg'),
          ProductImage(path: '/calculator-back.jpg'),
        ],
      ),
    ]);

    await tester.tap(find.byTooltip('Details'));
    await tester.pumpAndSettle();
    expect(find.text('Product details'), findsWidgets);
    expect(find.text('Used calculator'), findsNWidgets(2));

    expect(
      find.bySemanticsLabel('Open product images full screen'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('product-gallery-open-viewer')));
    await tester.pumpAndSettle();
    expect(find.text('1 / 2'), findsOneWidget);
    await tester.tap(find.byTooltip('Next image'));
    await tester.pumpAndSettle();
    expect(find.text('2 / 2'), findsOneWidget);
    await tester.tap(find.byTooltip('Close image viewer'));
    await tester.pumpAndSettle();

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sold by Seller 40'));
    await tester.pumpAndSettle();

    expect(find.text('Seller profile'), findsOneWidget);
    expect(find.text('Listings'), findsNWidgets(2));
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

  testWidgets('verified buyers can submit a product review from details', (
    tester,
  ) async {
    _setPhoneViewport(tester);
    final harness = await _pumpHome(tester, [
      _product(id: 7, name: 'Verified review listing'),
    ], canReview: true);

    await tester.tap(find.byTooltip('Details'));
    await tester.pumpAndSettle();
    expect(
      harness.requests.any(
        (request) => request.url.path.endsWith('/products/7/reviews'),
      ),
      isTrue,
    );
    await tester.scrollUntilVisible(
      find.text('Submit verified review'),
      400,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.text('Verified buyer reviews'), findsOneWidget);
    expect(find.text('Submit verified review'), findsOneWidget);
    expect(find.text('Your rating'), findsOneWidget);

    await tester.enterText(
      find.byType(TextFormField).last,
      'Received in great condition.',
    );
    await tester.tap(find.text('Submit verified review'));
    await tester.pumpAndSettle();

    final reviewRequest = harness.requests.singleWhere(
      (request) =>
          request.method == 'POST' && request.url.path.endsWith('/reviews'),
    );
    expect(jsonDecode(reviewRequest.body), {
      'rating': 5,
      'title': null,
      'comment': 'Received in great condition.',
    });
    expect(
      find.text('Your verified buyer review was submitted.'),
      findsWidgets,
    );
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

  testWidgets('Product details fits phone, tablet, and desktop widths', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    await _pumpHome(tester, [
      _product(id: 8, name: 'Responsive detail listing'),
    ]);
    await tester.tap(find.byTooltip('Details'));
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
  List<Product> products, {
  bool canReview = false,
}) async {
  final requests = <http.Request>[];
  final client = MockClient((request) async {
    requests.add(request);
    final pathSegments = request.url.path.split('/');
    final sellerId = pathSegments.length > 1
        ? int.tryParse(pathSegments[pathSegments.length - 2]) ?? 0
        : 0;
    final following = request.method == 'POST';
    if (request.method == 'GET' && request.url.path.endsWith('/profile')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'student': {
            'id': sellerId,
            'name': 'Seller $sellerId',
            'username': 'seller$sellerId',
            'bio': 'A helpful TMC seller.',
            'course': 'BSIT',
            'profile_picture': null,
            'joined_at': '2026-01-01',
          },
          'followers_count': 5,
          'following_count': 2,
          'products_count': 1,
          'reviews_count': 0,
          'average_rating': 0,
          'is_following': false,
          'is_self': false,
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'GET' &&
        request.url.path.endsWith('/products') &&
        request.url.path.contains('/students/')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'products': products.map(_productJson).toList(),
          'total': products.length,
          'current_page': 1,
          'last_page': 1,
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'POST' && request.url.path.endsWith('/reviews')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'message': 'Your verified buyer review has been submitted.',
          'review': {
            'id': 1,
            'rating': 5,
            'title': null,
            'comment': 'Received in great condition.',
            'reviewer': {'id': 1, 'name': 'Test Buyer'},
          },
        }),
        201,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'GET' && request.url.path.contains('/reviews')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'reviews': <Map<String, Object?>>[],
          'total': 0,
          'current_page': 1,
          'last_page': 1,
          'average_rating': 0,
          'can_review': canReview,
          'already_reviewed': false,
          'eligibility_message': 'Complete an order to review.',
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'GET' && request.url.path.contains('/products/')) {
      final id = int.tryParse(pathSegments.last) ?? 0;
      final matches = products.where((item) => item.id == id);
      if (matches.isNotEmpty) {
        final product = matches.first;
        return http.Response(
          jsonEncode({'success': true, 'product': _productJson(product)}),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
    }
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

Map<String, Object?> _productJson(Product product) => {
  'id': product.id,
  'name': product.name,
  'description': product.description,
  'price': product.price,
  'category': product.category,
  'status': product.status,
  'image': product.image,
  'images': product.images
      .map(
        (image) => {
          'id': image.id,
          'path': image.path,
          'sort_order': image.sortOrder,
          'is_primary': image.isPrimary,
        },
      )
      .toList(),
  'stock_quantity': product.stockQuantity,
  'attributes': product.attributes,
  'variants': const [],
  'user_id': product.userId,
  'user': {
    'id': product.userId,
    'name': product.sellerName,
    'username': product.sellerUsername,
    'bio': product.sellerBio,
    'course': product.sellerCourse,
    'profile_picture': product.sellerProfilePicture,
  },
};

class _HomeHarness {
  const _HomeHarness({required this.requests, required this.cart});

  final List<http.Request> requests;
  final CartState cart;
}
