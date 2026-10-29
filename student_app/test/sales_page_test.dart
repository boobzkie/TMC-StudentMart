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
import 'package:student_app/sales_page.dart';

void main() {
  late String orderStatus;
  late String paymentStatus;
  late List<http.Request> requests;

  setUp(() {
    orderStatus = 'completed';
    paymentStatus = 'unpaid';
    requests = <http.Request>[];
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform({
      ApiService.tokenKey: 'test-token',
    });
  });

  testWidgets('shows paid revenue separately from completed unpaid orders', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final client = MockClient((request) async {
      requests.add(request);
      return http.Response(
        jsonEncode(_response(orderStatus, paymentStatus)),
        200,
      );
    });

    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: SalesPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Paid revenue'), findsOneWidget);
    expect(find.text('₱0.00'), findsWidgets);
    expect(find.text('Completed order value'), findsOneWidget);
    expect(find.text('₱125.50'), findsWidgets);
    expect(find.text('Unpaid'), findsOneWidget);
    expect(find.text('2026-10-12T08:00:00.000000Z'), findsNothing);
    expect(requests.single.url.queryParameters['dashboard'], '1');
    expect(requests.single.url.queryParameters['per_page'], '25');
  });

  testWidgets('date and search filters are sent to the seller orders API', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final client = MockClient((request) async {
      requests.add(request);
      return http.Response(
        jsonEncode(_response(orderStatus, paymentStatus)),
        200,
      );
    });
    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: SalesPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('7 days'));
    await tester.pumpAndSettle();
    expect(requests.last.url.queryParameters['from'], isNotNull);
    expect(requests.last.url.queryParameters['to'], isNotNull);

    await tester.enterText(find.byType(TextField), 'textbook');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(requests.last.url.queryParameters['search'], 'textbook');
    expect(requests.last.url.queryParameters['status'], isNull);
  });

  testWidgets('sales cards and controls fit a narrow mobile viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final client = MockClient((request) async {
      return http.Response(
        jsonEncode(_response(orderStatus, paymentStatus)),
        200,
      );
    });
    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: SalesPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  testWidgets('seller confirms a valid order transition before server update', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    orderStatus = 'pending';
    final client = MockClient((request) async {
      requests.add(request);
      if (request.method == 'PUT') {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        orderStatus = body['status'] as String;
        return http.Response(
          jsonEncode({
            'success': true,
            'order': {..._order(orderStatus, paymentStatus)},
          }),
          200,
        );
      }
      return http.Response(
        jsonEncode(_response(orderStatus, paymentStatus)),
        200,
      );
    });
    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: ApiService(client: client),
        child: const MaterialApp(home: SalesPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Update status'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Accepted').last);
    await tester.pumpAndSettle();
    expect(orderStatus, 'pending');
    await tester.tap(find.text('Accept order'));
    await tester.pumpAndSettle();

    expect(orderStatus, 'confirmed');
    expect(
      requests.where((request) => request.method == 'PUT').single.url.path,
      endsWith('/seller/orders/41'),
    );
    expect(find.text('Accepted'), findsWidgets);
  });
}

Map<String, dynamic> _response(String status, String paymentStatus) {
  final isCompleted = status == 'completed';
  final isPending = status == 'pending';
  return {
    'success': true,
    'orders': [_order(status, paymentStatus)],
    'total': 1,
    'pagination': {
      'current_page': 1,
      'last_page': 1,
      'per_page': 25,
      'total': 1,
    },
    'summary': {
      'total_orders': 1,
      'pending_orders': isPending ? 1 : 0,
      'completed_orders': isCompleted ? 1 : 0,
      'gross_order_value': '125.50',
      'completed_order_value': isCompleted ? '125.50' : '0.00',
      'paid_revenue': paymentStatus == 'paid' ? '125.50' : '0.00',
      'open_order_value': isPending ? '125.50' : '0.00',
      'average_completed_order_value': isCompleted ? '125.50' : '0.00',
      'status_counts': {
        'pending': isPending ? 1 : 0,
        'confirmed': 0,
        'ready_for_pickup': 0,
        'completed': isCompleted ? 1 : 0,
        'declined': 0,
        'cancelled': 0,
      },
    },
  };
}

Map<String, dynamic> _order(String status, String paymentStatus) => {
  'id': 41,
  'order_number': 'TMC-261012-TEST0001',
  'status': status,
  'payment_status': paymentStatus,
  'total_amount': '125.50',
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
