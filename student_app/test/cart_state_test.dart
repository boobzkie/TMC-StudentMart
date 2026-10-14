import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
// ignore_for_file: depend_on_referenced_packages
import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/data.dart';

void main() {
  late CartState cart;

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
    cart = CartState(const FlutterSecureStorage());
  });

  const items = <Map<String, Object?>>[
    {'product_id': 12, 'variant_id': 4, 'quantity': 2},
    {'product_id': 9, 'variant_id': null, 'quantity': 1},
  ];

  test('reuses a persisted checkout key for the same request', () async {
    final firstKey = await cart.checkoutIdempotencyKey(
      buyerId: 7,
      paymentMethodId: 1,
      pickupLocationId: 2,
      items: items,
    );

    final restartedCart = CartState(const FlutterSecureStorage());
    final retryKey = await restartedCart.checkoutIdempotencyKey(
      buyerId: 7,
      paymentMethodId: 1,
      pickupLocationId: 2,
      items: items.reversed.toList(),
    );

    expect(firstKey, matches(RegExp(r'^[a-f0-9]{64}$')));
    expect(retryKey, firstKey);
  });

  test(
    'uses a different key for changed checkout details and clears success',
    () async {
      final firstKey = await cart.checkoutIdempotencyKey(
        buyerId: 7,
        paymentMethodId: 1,
        pickupLocationId: 2,
        items: items,
      );
      final changedItems = <Map<String, Object?>>[
        {'product_id': 12, 'variant_id': 4, 'quantity': 1},
        {'product_id': 9, 'variant_id': null, 'quantity': 1},
      ];
      final changedKey = await cart.checkoutIdempotencyKey(
        buyerId: 7,
        paymentMethodId: 1,
        pickupLocationId: 2,
        items: changedItems,
      );

      expect(changedKey, isNot(firstKey));
      await cart.completeCheckoutAttempt(
        buyerId: 7,
        idempotencyKey: changedKey,
      );
      final nextKey = await cart.checkoutIdempotencyKey(
        buyerId: 7,
        paymentMethodId: 1,
        pickupLocationId: 2,
        items: changedItems,
      );

      expect(nextKey, isNot(changedKey));
    },
  );
}
