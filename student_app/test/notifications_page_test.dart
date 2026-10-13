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

        return http.Response('Not found', 404);
      });

      await tester.pumpWidget(
        Provider<ApiService>.value(
          value: ApiService(client: client),
          child: const MaterialApp(home: NotificationsPage()),
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
}
