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
import 'package:student_app/profile_page.dart';
import 'package:student_app/tmc_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
  });

  testWidgets('profile shows live stats and keeps account details private', (
    tester,
  ) async {
    final harness = await _pumpProfile(tester);

    expect(find.text('Aisha Student'), findsOneWidget);
    expect(find.text('TMC Student'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('4.8'), findsOneWidget);
    expect(find.text('Your listings'), findsOneWidget);
    expect(
      find.text('Manage the items you’ve posted on StudentMart.'),
      findsOneWidget,
    );
    expect(find.text('Verified Student'), findsNothing);
    expect(find.text('aisha.private@example.test'), findsNothing);
    expect(find.text('PRIVATE-STUDENT-ID'), findsNothing);
    expect(find.text('0000000000'), findsNothing);
    expect(find.text('BSIT'), findsNothing);
    expect(
      harness.requests.any(
        (request) => request.url.path.endsWith('/students/1/profile'),
      ),
      isTrue,
    );
  });

  testWidgets('profile tabs load orders once and keep the listing view', (
    tester,
  ) async {
    final harness = await _pumpProfile(tester);

    await tester.tap(find.text('My Orders'));
    await tester.pumpAndSettle();
    expect(find.text('TMC-ORDER-001'), findsOneWidget);
    expect(
      harness.requests.where((request) => request.url.path.endsWith('/orders')),
      hasLength(1),
    );

    await tester.tap(find.text('My Listings'));
    await tester.pumpAndSettle();
    expect(find.text('Your listings'), findsOneWidget);
  });

  testWidgets('following statistic opens the real connections list', (
    tester,
  ) async {
    final harness = await _pumpProfile(tester);

    await tester.tap(find.text('Following'));
    await tester.pumpAndSettle();

    expect(find.text('Following'), findsOneWidget);
    expect(find.text('Student Follower'), findsOneWidget);
    expect(
      harness.requests.any(
        (request) => request.url.path.endsWith('/user/following'),
      ),
      isTrue,
    );
  });

  testWidgets('profile layout fits phones, tablets, and desktop widths', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await _pumpProfile(tester);

    for (final size in const [
      Size(320, 740),
      Size(420, 844),
      Size(620, 844),
      Size(768, 900),
      Size(1024, 900),
      Size(1440, 1000),
    ]) {
      tester.view.physicalSize = size;
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'Viewport: $size');
    }
  });
}

Future<_ProfileHarness> _pumpProfile(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final requests = <http.Request>[];
  final client = MockClient((request) async {
    requests.add(request);
    if (request.method == 'GET' &&
        request.url.path.endsWith('/students/1/profile')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'student': {
            'id': 1,
            'name': 'Aisha Student',
            'username': 'aisha',
            'email': 'aisha.private@example.test',
            'student_id': 'PRIVATE-STUDENT-ID',
            'contact_number': '0000000000',
            'course': 'BSIT',
            'profile_picture': null,
          },
          'following_count': 12,
          'followers_count': 5,
          'reviews_count': 4,
          'average_rating': 4.8,
          'is_self': true,
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'GET' && request.url.path.endsWith('/my-products')) {
      return http.Response(
        jsonEncode({'success': true, 'products': <Object?>[], 'total': 0}),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'GET' && request.url.path.endsWith('/orders')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'orders': [
            {
              'id': 1,
              'order_number': 'TMC-ORDER-001',
              'total_amount': '250.00',
              'status': 'pending',
              'created_at': '2026-10-29T09:00:00Z',
              'seller': {'name': 'Campus Books'},
            },
          ],
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    }
    if (request.method == 'GET' &&
        request.url.path.endsWith('/user/following')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'accounts': [
            {
              'id': 2,
              'name': 'Student Follower',
              'course': 'BSIT',
              'is_following': true,
            },
          ],
          'total': 1,
          'current_page': 1,
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
      name: 'Aisha Student',
      email: 'aisha.private@example.test',
      studentId: 'PRIVATE-STUDENT-ID',
      contactNumber: '0000000000',
      course: 'BSIT',
      role: 'student',
      status: 'active',
    );
  final marketplace = MarketplaceState(api);

  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ApiService>.value(value: api),
        ChangeNotifierProvider<AuthState>.value(value: auth),
        ChangeNotifierProvider<MarketplaceState>.value(value: marketplace),
      ],
      child: MaterialApp(
        theme: TmcTheme.light,
        home: const Scaffold(body: ProfilePage()),
      ),
    ),
  );
  await tester.pumpAndSettle();

  return _ProfileHarness(requests: requests);
}

class _ProfileHarness {
  const _ProfileHarness({required this.requests});

  final List<http.Request> requests;
}
