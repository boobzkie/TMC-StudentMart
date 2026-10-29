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
import 'package:student_app/orders_page.dart';

void main() {
  late String orderStatus;
  late List<String> updatedStatuses;

  setUp(() {
    orderStatus = 'pending';
    updatedStatuses = <String>[];
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform({
      ApiService.tokenKey: 'test-token',
    });
  });

  testWidgets(
    'seller must move an order through pickup readiness before completion',
    (tester) async {
      tester.view.physicalSize = const Size(800, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final client = MockClient((request) async {
        if (request.method == 'PUT') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          orderStatus = body['status'] as String;
          updatedStatuses.add(orderStatus);
          return http.Response(
            jsonEncode({'success': true, 'message': 'Order status updated.'}),
            200,
          );
        }

        final order = <String, dynamic>{
          'id': 41,
          'order_number': 'TMC-261012-TEST0001',
          'status': orderStatus,
          'total_amount': '125.50',
          'buyer_note': null,
          'seller_note': null,
          'buyer': {'id': 7, 'name': 'Test Buyer', 'student_id': 'TMC-007'},
          'seller': {'id': 9, 'name': 'Test Seller', 'student_id': 'TMC-009'},
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
        };
        return http.Response(
          jsonEncode({
            'success': true,
            'orders': [order],
            'total': 1,
          }),
          200,
        );
      });

      final api = ApiService(client: client);
      await tester.pumpWidget(
        Provider<ApiService>.value(
          value: api,
          child: const MaterialApp(home: OrdersPage(selling: true)),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Placed'), findsOneWidget);
      expect(find.text('Accept order'), findsOneWidget);
      expect(find.text('Mark completed'), findsNothing);

      await tester.tap(find.text('Accept order'));
      await tester.pumpAndSettle();
      expect(orderStatus, 'confirmed');
      expect(find.text('Accepted'), findsOneWidget);
      expect(find.text('Mark ready for pickup'), findsOneWidget);
      expect(find.text('Mark completed'), findsNothing);

      await tester.dragUntilVisible(
        find.text('Mark ready for pickup'),
        find.byType(ListView),
        const Offset(0, -300),
      );
      await tester.tap(find.text('Mark ready for pickup'));
      await tester.pumpAndSettle();
      expect(orderStatus, 'ready_for_pickup');
      expect(find.text('Ready for pickup'), findsOneWidget);
      expect(find.text('Mark completed'), findsOneWidget);

      await tester.dragUntilVisible(
        find.text('Mark completed'),
        find.byType(ListView),
        const Offset(0, -300),
      );
      await tester.tap(find.text('Mark completed'));
      await tester.pumpAndSettle();
      expect(find.text('Confirm order handover'), findsOneWidget);
      expect(orderStatus, 'ready_for_pickup');

      await tester.tap(find.text('Confirm handover'));
      await tester.pumpAndSettle();
      expect(orderStatus, 'completed');
      expect(find.text('Completed'), findsOneWidget);
      expect(find.text('Mark completed'), findsNothing);
      expect(updatedStatuses, ['confirmed', 'ready_for_pickup', 'completed']);
    },
  );

  testWidgets('seller can decline an order with a reason', (tester) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final client = MockClient((request) async {
      if (request.method == 'PUT') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        orderStatus = body['status'] as String;
        updatedStatuses.add(orderStatus);
        expect(body['seller_note'], 'Item is no longer available.');
        return http.Response(jsonEncode({'success': true}), 200);
      }

      final order = <String, dynamic>{
        'id': 42,
        'order_number': 'TMC-261012-TEST0002',
        'status': orderStatus,
        'total_amount': '80.00',
        'buyer_note': null,
        'seller_note': null,
        'buyer': {'id': 7, 'name': 'Test Buyer'},
        'seller': {'id': 9, 'name': 'Test Seller'},
        'items': [
          {
            'product_name': 'Calculator',
            'unit_price': '80.00',
            'quantity': 1,
            'line_total': '80.00',
            'product_image': null,
          },
        ],
        'created_at': '2026-10-12T08:00:00.000000Z',
      };
      return http.Response(
        jsonEncode({
          'success': true,
          'orders': [order],
          'total': 1,
        }),
        200,
      );
    });

    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: OrdersPage(selling: true)),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(OutlinedButton, 'Decline'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextField),
      'Item is no longer available.',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Decline'));
    await tester.pumpAndSettle();

    expect(orderStatus, 'declined');
    expect(updatedStatuses, ['declined']);
    expect(find.text('Declined'), findsOneWidget);
    expect(find.text('Accept order'), findsNothing);
  });
  testWidgets('buyer can filter orders and refresh order details', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var reads = 0;
    var detailStatus = 'pending';
    final client = MockClient((request) async {
      reads++;
      if (reads == 3) detailStatus = 'ready_for_pickup';
      return http.Response(
        jsonEncode({
          'success': true,
          'orders': [
            _testOrder(101, detailStatus),
            _testOrder(102, 'completed'),
            _testOrder(103, 'cancelled'),
          ],
        }),
        200,
      );
    });

    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: OrdersPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Active (1)'), findsOneWidget);
    expect(find.text('Completed (1)'), findsOneWidget);
    expect(find.text('Cancelled (1)'), findsOneWidget);

    await tester.tap(find.text('Active (1)'));
    await tester.pumpAndSettle();
    expect(find.text('TMC-TEST-101'), findsOneWidget);
    expect(find.text('TMC-TEST-102'), findsNothing);

    await tester.ensureVisible(find.text('View order details'));
    await tester.tap(find.text('View order details'));
    await tester.pumpAndSettle();
    expect(find.text('Order details'), findsOneWidget);
    expect(find.text('Order progress'), findsOneWidget);
    expect(find.text('Test Seller'), findsOneWidget);
    expect(find.text('Payment status'), findsOneWidget);
    expect(find.text('Unpaid'), findsOneWidget);
    expect(reads, 2);

    await tester.tap(find.byTooltip('Refresh order'));
    await tester.pumpAndSettle();
    expect(reads, 3);
    expect(
      find.text('Current status · Seller marked the order ready'),
      findsOneWidget,
    );
  });

  testWidgets('buyer sees when an Admin has marked an order paid', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final client = MockClient((request) async {
      return http.Response(
        jsonEncode({
          'success': true,
          'orders': [_testOrder(301, 'completed', paymentStatus: 'paid')],
        }),
        200,
      );
    });

    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: OrdersPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Completed (1)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View order details'));
    await tester.pumpAndSettle();

    expect(find.text('Payment status'), findsOneWidget);
    expect(find.text('Paid · marked by Admin'), findsOneWidget);
    expect(
      find.textContaining(
        'Only an authorized Admin can mark an order as paid.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('cancelled buyer order shows a terminal state only', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final client = MockClient((request) async {
      return http.Response(
        jsonEncode({
          'success': true,
          'orders': [_testOrder(201, 'pending'), _testOrder(202, 'cancelled')],
        }),
        200,
      );
    });

    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: OrdersPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cancelled (1)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View order details'));
    await tester.pumpAndSettle();

    expect(find.text('Order cancelled'), findsOneWidget);
    expect(find.text('Order progress'), findsNothing);
    expect(find.text('Completed'), findsNothing);
  });
}

Map<String, dynamic> _testOrder(
  int id,
  String status, {
  String paymentStatus = 'unpaid',
}) => {
  'id': id,
  'order_number': 'TMC-TEST-$id',
  'status': status,
  'payment_status': paymentStatus,
  'total_amount': '125.50',
  'buyer_note': null,
  'seller_note': null,
  'buyer': {'id': 7, 'name': 'Test Buyer', 'student_id': 'TMC-007'},
  'seller': {'id': 9, 'name': 'Test Seller', 'student_id': 'TMC-009'},
  'items': [
    {
      'id': id + 100,
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
};
