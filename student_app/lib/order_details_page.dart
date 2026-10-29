import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'tmc_theme.dart';

class OrderDetailsPage extends StatefulWidget {
  const OrderDetailsPage({
    super.key,
    required this.orderId,
    this.selling = false,
  });
  final int orderId;
  final bool selling;

  @override
  State<OrderDetailsPage> createState() => _OrderDetailsPageState();
}

class _OrderDetailsPageState extends State<OrderDetailsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final response = asMap(
      await context.read<ApiService>().get(
        widget.selling ? '/seller/orders' : '/orders',
      ),
    );
    final rows = response['orders'];
    if (rows is List) {
      for (final row in rows) {
        final order = asMap(row);
        if (int.tryParse(valueOf(order['id'])) == widget.orderId) return order;
      }
    }
    throw const ApiException(
      'This order could not be found in your account. Refresh your order history and try again.',
      statusCode: 404,
    );
  }

  void _refresh() {
    final future = _load();
    setState(() {
      _future = future;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Order details'),
      actions: [
        IconButton(
          tooltip: 'Refresh order',
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return ErrorMessage(
            message: snapshot.error.toString(),
            onRetry: _refresh,
          );
        }
        final order = snapshot.data;
        if (order == null) {
          return ErrorMessage(
            message: 'Order details are not available.',
            onRetry: _refresh,
          );
        }
        return _OrderDetails(order: order, selling: widget.selling);
      },
    ),
  );
}

class _OrderDetails extends StatelessWidget {
  const _OrderDetails({required this.order, required this.selling});
  final Map<String, dynamic> order;
  final bool selling;

  @override
  Widget build(BuildContext context) {
    final status = valueOf(order['status']).toLowerCase();
    final seller = asMap(order['seller']);
    final buyer = asMap(order['buyer']);
    final paymentMethod = asMap(order['payment_method']);
    final pickupLocation = asMap(order['pickup_location']);
    final otherParty = selling ? buyer : seller;
    final rows = order['items'];
    final items = rows is List
        ? rows.map((row) => asMap(row)).toList()
        : <Map<String, dynamic>>[];
    final sellerNote = valueOf(order['seller_note']);
    final buyerNote = valueOf(order['buyer_note']);
    final terminal = status == 'cancelled' || status == 'declined';
    final createdAt = _date(valueOf(order['created_at']));
    final updatedAt = _date(valueOf(order['updated_at']));

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        TmcPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.receipt_long_outlined,
                    color: TmcPalette.navyBlue,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      valueOf(order['order_number']).isEmpty
                          ? 'Order #${valueOf(order['id'])}'
                          : valueOf(order['order_number']),
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  _Status(status: status),
                ],
              ),
              const SizedBox(height: 13),
              _Info(
                label: 'Date placed',
                value: createdAt.isEmpty ? 'Not provided' : createdAt,
              ),
              if (updatedAt.isNotEmpty) ...[
                const SizedBox(height: 7),
                _Info(label: 'Last updated', value: updatedAt),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (terminal)
          _TerminalStatus(
            status: status,
            reason: status == 'declined' ? sellerNote : '',
          )
        else
          _Progress(status: status),
        const SizedBox(height: 16),
        SectionHeading(selling ? 'Buyer' : 'Seller'),
        const SizedBox(height: 9),
        TmcPanel(
          child: Column(
            children: [
              _Info(
                label: 'Name',
                value: valueOf(otherParty['name']).isEmpty
                    ? 'Account information unavailable'
                    : valueOf(otherParty['name']),
              ),
              if (valueOf(otherParty['student_id']).isNotEmpty) ...[
                const SizedBox(height: 7),
                _Info(
                  label: 'Student ID',
                  value: valueOf(otherParty['student_id']),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionHeading(
          'Items',
          action: Text(
            items.length.toString() + (items.length == 1 ? ' item' : ' items'),
            style: const TextStyle(
              color: TmcPalette.darkGray,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 9),
        TmcPanel(
          child: items.isEmpty
              ? const Text('No item details were returned for this order.')
              : Column(
                  children: [
                    for (var i = 0; i < items.length; i++) ...[
                      _Item(item: items[i]),
                      if (i < items.length - 1) const Divider(height: 20),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 12),
        TmcPanel(
          color: TmcPalette.paleBlue.withValues(alpha: .45),
          child: Column(
            children: [
              _Info(
                label: 'Order total',
                value: peso(
                  double.tryParse(valueOf(order['total_amount'])) ?? 0,
                ),
                prominent: true,
              ),
              const SizedBox(height: 8),
              const Text(
                'The payment method records the agreed arrangement only. This app does not collect or verify payment.',
                style: TextStyle(
                  color: TmcPalette.darkGray,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const SectionHeading('Payment & pickup'),
        const SizedBox(height: 9),
        TmcPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Info(
                label: 'Agreed payment method',
                value: valueOf(paymentMethod['name']).isEmpty
                    ? 'Not recorded'
                    : valueOf(paymentMethod['name']),
              ),
              if (valueOf(paymentMethod['instructions']).isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  valueOf(paymentMethod['instructions']),
                  style: const TextStyle(
                    color: TmcPalette.darkGray,
                    fontSize: 12,
                  ),
                ),
              ],
              const Divider(height: 22),
              _Info(
                label: 'Agreed pickup location',
                value: valueOf(pickupLocation['name']).isEmpty
                    ? 'Not recorded'
                    : valueOf(pickupLocation['name']),
              ),
              if (valueOf(pickupLocation['area']).isNotEmpty) ...[
                const SizedBox(height: 5),
                _Info(
                  label: 'Campus / area',
                  value: valueOf(pickupLocation['area']),
                ),
              ],
              if (valueOf(pickupLocation['details']).isNotEmpty) ...[
                const SizedBox(height: 5),
                _Info(
                  label: 'Building / room',
                  value: valueOf(pickupLocation['details']),
                ),
              ],
              if (valueOf(pickupLocation['operating_hours']).isNotEmpty) ...[
                const SizedBox(height: 5),
                _Info(
                  label: 'Operating hours',
                  value: valueOf(pickupLocation['operating_hours']),
                ),
              ],
              if (valueOf(pickupLocation['instructions']).isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  valueOf(pickupLocation['instructions']),
                  style: const TextStyle(
                    color: TmcPalette.darkGray,
                    fontSize: 12,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (buyerNote.isNotEmpty || sellerNote.isNotEmpty) ...[
          const SizedBox(height: 16),
          const SectionHeading('Order updates'),
          const SizedBox(height: 9),
          TmcPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (buyerNote.isNotEmpty) ...[
                  const Text(
                    'Your note',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    buyerNote,
                    style: const TextStyle(color: TmcPalette.darkGray),
                  ),
                ],
                if (buyerNote.isNotEmpty && sellerNote.isNotEmpty)
                  const Divider(height: 20),
                if (sellerNote.isNotEmpty) ...[
                  Text(
                    status == 'declined'
                        ? 'Seller decline reason'
                        : 'Seller update',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    sellerNote,
                    style: const TextStyle(color: TmcPalette.darkGray),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

String _date(String raw) {
  final parsed = DateTime.tryParse(raw)?.toLocal();
  if (parsed == null) return '';
  return parsed.toIso8601String().substring(0, 16).replaceFirst('T', ' ');
}

class _Info extends StatelessWidget {
  const _Info({
    required this.label,
    required this.value,
    this.prominent = false,
  });
  final String label;
  final String value;
  final bool prominent;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          label,
          style: const TextStyle(
            color: TmcPalette.darkGray,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      const SizedBox(width: 12),
      Flexible(
        child: Text(
          value,
          textAlign: TextAlign.right,
          style: TextStyle(
            color: TmcPalette.deepNavyBlack,
            fontSize: prominent ? 17 : 13,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    ],
  );
}

class _Status extends StatelessWidget {
  const _Status({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'confirmed' || 'completed' => TmcPalette.success,
      'ready_for_pickup' => TmcPalette.navyBlue,
      'cancelled' || 'declined' => TmcPalette.error,
      _ => TmcPalette.warning,
    };
    final label = switch (status) {
      'pending' => 'Placed',
      'confirmed' => 'Accepted',
      'ready_for_pickup' => 'Ready for pickup',
      'completed' => 'Completed',
      'cancelled' => 'Cancelled',
      'declined' => 'Declined',
      _ => status.isEmpty ? 'Unknown' : status.replaceAll('_', ' '),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(TmcRadius.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final current = switch (status) {
      'confirmed' => 1,
      'ready_for_pickup' => 2,
      'completed' => 3,
      _ => 0,
    };
    const titles = ['Placed', 'Accepted', 'Ready for pickup', 'Completed'];
    const descriptions = [
      'Order request sent to the seller',
      'Seller accepted the order',
      'Seller marked the order ready',
      'Handover marked complete',
    ];
    return TmcPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeading('Order progress'),
          const SizedBox(height: 16),
          for (var i = 0; i < titles.length; i++) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 23,
                  height: 23,
                  decoration: BoxDecoration(
                    color: i <= current
                        ? TmcPalette.navyBlue
                        : TmcPalette.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: i <= current
                          ? TmcPalette.navyBlue
                          : TmcPalette.mediumGray,
                    ),
                  ),
                  child: i <= current
                      ? const Icon(
                          Icons.check,
                          size: 14,
                          color: TmcPalette.white,
                        )
                      : null,
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      bottom: i == titles.length - 1 ? 0 : 15,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          titles[i],
                          style: TextStyle(
                            color: i <= current
                                ? TmcPalette.navyBlue
                                : TmcPalette.mediumGray,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          i == current
                              ? 'Current status · ${descriptions[i]}'
                              : descriptions[i],
                          style: const TextStyle(
                            color: TmcPalette.darkGray,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _TerminalStatus extends StatelessWidget {
  const _TerminalStatus({required this.status, required this.reason});
  final String status;
  final String reason;

  @override
  Widget build(BuildContext context) {
    final declined = status == 'declined';
    return TmcPanel(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            declined ? Icons.block_outlined : Icons.cancel_outlined,
            color: TmcPalette.error,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  declined ? 'Order declined' : 'Order cancelled',
                  style: const TextStyle(
                    color: TmcPalette.error,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                const Text(
                  'This order is closed. The normal completion steps do not apply.',
                  style: TextStyle(color: TmcPalette.darkGray, height: 1.4),
                ),
                if (reason.isNotEmpty) ...[
                  const SizedBox(height: 9),
                  Text(
                    'Seller reason: $reason',
                    style: const TextStyle(color: TmcPalette.deepNavyBlack),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final image = ApiService.imageUrlFor(valueOf(item['product_image']));
    final quantity = int.tryParse(valueOf(item['quantity'])) ?? 0;
    final price = double.tryParse(valueOf(item['unit_price'])) ?? 0;
    final lineTotal = double.tryParse(valueOf(item['line_total'])) ?? 0;
    final variantLabel = valueOf(item['variant_label']);
    final variantAttributes = asMap(item['variant_attributes']);
    return Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(TmcRadius.md),
          child: SizedBox(
            width: 64,
            height: 64,
            child: image.isEmpty
                ? _placeholder()
                : Image.network(
                    image,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => _placeholder(),
                    loadingBuilder: (context, child, progress) =>
                        progress == null ? child : _placeholder(),
                  ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                valueOf(item['product_name']).isEmpty
                    ? 'Product'
                    : valueOf(item['product_name']),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                '$quantity × ${peso(price)}',
                style: const TextStyle(
                  color: TmcPalette.darkGray,
                  fontSize: 12,
                ),
              ),
              if (variantLabel.isNotEmpty || variantAttributes.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  [
                    if (variantLabel.isNotEmpty) variantLabel,
                    ...variantAttributes.entries.map(
                      (entry) => '${entry.key}: ${entry.value}',
                    ),
                  ].join(' · '),
                  style: const TextStyle(
                    color: TmcPalette.navyBlue,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          peso(lineTotal),
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ],
    );
  }

  Widget _placeholder() => DecoratedBox(
    decoration: BoxDecoration(
      color: TmcPalette.paleBlue.withValues(alpha: .7),
      borderRadius: BorderRadius.circular(TmcRadius.md),
    ),
    child: const Center(
      child: Icon(Icons.shopping_bag_outlined, color: TmcPalette.navyBlue),
    ),
  );
}
