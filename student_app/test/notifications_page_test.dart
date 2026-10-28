import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
// ignore_for_file: depend_on_referenced_packages
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:student_app/data.dart';
import 'package:student_app/notifications_page.dart';

void main() {
  testWidgets(
    'marks an order notification read and opens seller order details',
    (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform({
        ApiService.tokenKey: 'test-token',
      });

      var isRead = false;
      final requestedPaths = <String>[];
      final client = MockClient((request) async {
        requestedPaths.add(request.url.path);

        if (request.method == 'PUT' && request.url.path.endsWith('/n-1/read')) {
          isRead = true;
          return http.Response(
            jsonEncode({
              'success': true,
              'notification': {'id': 'n-1'},
            }),
            200,
          );
        }

        if (request.method == 'GET' &&
            request.url.path.endsWith('/notifications')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'unread_count': isRead ? 0 : 1,
              'notifications': [
                {
                  'id': 'n-1',
                  'event': 'order_placed',
                  'title': 'New order request',
                  'message': 'Order TMC-TEST-44 is waiting for your review.',
                  'order_id': 44,
                  'order_number': 'TMC-TEST-44',
                  'status': 'pending',
                  'created_at': '2026-10-12T09:00:00.000000Z',
                  'read_at': isRead ? '2026-10-12T09:01:00.000000Z' : null,
                },
              ],
              'total': 1,
            }),
            200,
          );
        }

        if (request.method == 'GET' &&
            request.url.path.endsWith('/seller/orders')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'orders': [
                {
                  'id': 44,
                  'order_number': 'TMC-TEST-44',
                  'status': 'pending',
                  'total_amount': '125.50',
                  'buyer_note': null,
                  'seller_note': null,
                  'buyer': {
                    'id': 7,
                    'name': 'Test Buyer',
                    'student_id': 'TMC-007',
                  },
                  'seller': {
                    'id': 9,
                    'name': 'Test Seller',
                    'student_id': 'TMC-009',
                  },
                  'items': [
                    {
                      'id': 81,
                      'product_id': 12,
                      'product_name': 'TMC Textbook',
                      'unit_price': '125.50',
                      'quantity': 1,
                      'line_total': '125.50',
                      'product_image': null,
                    },
                  ],
                  'created_at': '2026-10-12T08:00:00.000000Z',
                  'updated_at': '2026-10-12T08:00:00.000000Z',
                },
              ],
              'total': 1,
            }),
            200,
          );
        }
        if (request.method == 'GET' && request.url.path.endsWith('/orders')) {
          return http.Response(
            jsonEncode({'success': true, 'orders': [], 'total': 0}),
            200,
          );
        }

        return http.Response('Not found', 404);
      });

      await tester.pumpWidget(
        Provider<ApiService>.value(
          value: ApiService(client: client),
          child: const MaterialApp(home: NotificationsPage(initialTab: 1)),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('1 unread notification'), findsOneWidget);
      expect(find.text('New order request'), findsOneWidget);
      expect(find.text('Order TMC-TEST-44'), findsOneWidget);

      await tester.tap(find.text('New order request'));
      await tester.pumpAndSettle();

      expect(isRead, isTrue);
      expect(requestedPaths, contains('/api/notifications/n-1/read'));
      expect(requestedPaths, contains('/api/seller/orders'));
      expect(find.text('Order details'), findsOneWidget);
      expect(find.text('Buyer'), findsOneWidget);
      expect(find.text('Test Buyer'), findsOneWidget);
    },
  );

  testWidgets(
    'Inbox exposes all destinations and uses the real order and follow APIs',
    (tester) async {
      tester.view.physicalSize = const Size(360, 840);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform({
        ApiService.tokenKey: 'test-token',
      });

      final requestedPaths = <String>[];
      final client = MockClient((request) async {
        requestedPaths.add(request.url.path);
        if (request.method == 'GET' &&
            request.url.path.endsWith('/notifications')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'unread_count': 2,
              'notifications': [],
              'total': 0,
            }),
            200,
          );
        }
        if (request.method == 'GET' &&
            (request.url.path.endsWith('/orders') ||
                request.url.path.endsWith('/seller/orders'))) {
          return http.Response(
            jsonEncode({
              'success': true,
              'orders': [
                {
                  'id': 18,
                  'order_number': 'TMC-TEST-18',
                  'status': 'pending',
                  'buyer': {'id': 4, 'name': 'Buyer'},
                  'seller': {'id': 9, 'name': 'Seller'},
                  'items': [
                    {'product_name': 'Biology textbook'},
                  ],
                  'created_at': '2026-10-12T08:00:00.000000Z',
                  'updated_at': '2026-10-12T08:00:00.000000Z',
                },
              ],
              'total': 1,
            }),
            200,
          );
        }
        if (request.method == 'GET' &&
            request.url.path.endsWith('/user/followers')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'accounts': [
                {
                  'id': 27,
                  'name': 'Ana Santos',
                  'course': 'BSIT',
                  'profile_picture': null,
                  'is_following': false,
                },
              ],
              'total': 1,
              'current_page': 1,
              'last_page': 1,
            }),
            200,
          );
        }
        if (request.method == 'GET' &&
            request.url.path.endsWith('/user/following')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'accounts': [],
              'total': 0,
              'current_page': 1,
              'last_page': 1,
            }),
            200,
          );
        }
        if (request.method == 'POST' &&
            request.url.path.endsWith('/students/27/follow')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'is_following': true,
              'followers_count': 4,
              'following_count': 2,
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      final api = ApiService(client: client);
      final auth = AuthState(api)
        ..user = const Student(
          id: 9,
          name: 'Test Seller',
          email: 'seller@example.test',
          role: 'student',
        );
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            Provider<ApiService>.value(value: api),
            ChangeNotifierProvider<AuthState>.value(value: auth),
          ],
          child: const MaterialApp(home: NotificationsPage()),
        ),
      );
      await tester.pumpAndSettle();

      for (final label in [
        'Messages',
        'Notifications',
        'Orders',
        'Followers',
        'Following',
      ]) {
        expect(find.text(label), findsOneWidget);
      }
      expect(find.text('2'), findsOneWidget);
      expect(find.text('1'), findsOneWidget);

      await tester.ensureVisible(find.text('Orders'));
      await tester.tap(find.text('Orders'));
      await tester.pumpAndSettle();
      expect(find.text('TMC-TEST-18'), findsOneWidget);
      expect(requestedPaths, contains('/api/orders'));
      expect(requestedPaths, contains('/api/seller/orders'));

      await tester.ensureVisible(find.text('Followers'));
      await tester.tap(find.text('Followers'));
      await tester.pumpAndSettle();
      expect(find.text('Ana Santos'), findsOneWidget);
      expect(requestedPaths, contains('/api/user/followers'));

      await tester.tap(find.byTooltip('Follow back Ana Santos'));
      await tester.pumpAndSettle();
      expect(requestedPaths, contains('/api/students/27/follow'));

      await tester.ensureVisible(find.text('Following'));
      await tester.tap(find.text('Following'));
      await tester.pumpAndSettle();
      expect(requestedPaths, contains('/api/user/following'));
    },
  );
}
