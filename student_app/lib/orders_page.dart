import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'order_details_page.dart';
import 'tmc_theme.dart';

class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key, this.selling = false});
  final bool selling;

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  late Future<dynamic> _ordersFuture;
  final Set<int> _busyOrderIds = <int>{};
  String _selectedSellerStatus = 'all';
  String _selectedBuyerGroup = 'all';

  static const _buyerFilters = <({String group, String label})>[
    (group: 'all', label: 'All'),
    (group: 'active', label: 'Active'),
    (group: 'completed', label: 'Completed'),
    (group: 'cancelled', label: 'Cancelled'),
  ];

  static const _sellerFilters = <({String status, String label})>[
    (status: 'all', label: 'All'),
    (status: 'pending', label: 'Placed'),
    (status: 'confirmed', label: 'Accepted'),
    (status: 'ready_for_pickup', label: 'Ready for pickup'),
    (status: 'completed', label: 'Completed'),
    (status: 'declined', label: 'Declined'),
    (status: 'cancelled', label: 'Cancelled'),
  ];

  @override
  void initState() {
    super.initState();
    _ordersFuture = _loadOrders();
  }

  Future<dynamic> _loadOrders() => context.read<ApiService>().get(
    widget.selling ? '/seller/orders' : '/orders',
  );

  void _reload() => setState(() => _ordersFuture = _loadOrders());

  List<Map<String, dynamic>> _buyerOrders(List<Map<String, dynamic>> orders) {
    return switch (_selectedBuyerGroup) {
      'active' =>
        orders
            .where(
              (order) => const {
                'pending',
                'confirmed',
                'ready_for_pickup',
              }.contains(valueOf(order['status'])),
            )
            .toList(),
      'completed' =>
        orders
            .where((order) => valueOf(order['status']) == 'completed')
            .toList(),
      'cancelled' =>
        orders
            .where(
              (order) => const {
                'cancelled',
                'declined',
              }.contains(valueOf(order['status'])),
            )
            .toList(),
      _ => orders,
    };
  }

  int _buyerGroupCount(List<Map<String, dynamic>> orders, String group) {
    return switch (group) {
      'active' =>
        orders
            .where(
              (order) => const {
                'pending',
                'confirmed',
                'ready_for_pickup',
              }.contains(valueOf(order['status'])),
            )
            .length,
      'completed' =>
        orders.where((order) => valueOf(order['status']) == 'completed').length,
      'cancelled' =>
        orders
            .where(
              (order) => const {
                'cancelled',
                'declined',
              }.contains(valueOf(order['status'])),
            )
            .length,
      _ => orders.length,
    };
  }

  void _openOrderDetails(Map<String, dynamic> order) {
    final id = int.tryParse(valueOf(order['id']));
    if (id == null) return;
    Navigator.of(context)
        .push<void>(
          MaterialPageRoute<void>(
            builder: (_) => OrderDetailsPage(orderId: id),
          ),
        )
        .then((_) {
          if (mounted) _reload();
        });
  }

  Future<void> _updateOrder(
    Map<String, dynamic> order,
    String status, {
    String? note,
    bool cancel = false,
  }) async {
    final id = int.tryParse(valueOf(order['id']));
    if (id == null) return;
    setState(() => _busyOrderIds.add(id));
    try {
      final api = context.read<ApiService>();
      if (cancel) {
        await api.put('/orders/$id/cancel', const {});
      } else {
        await api.put('/seller/orders/$id', {
          'status': status,
          ...?(note == null ? null : {'seller_note': note}),
        });
      }
      if (!mounted) return;
      setState(() {
        _busyOrderIds.remove(id);
        _ordersFuture = _loadOrders();
      });
      final message = cancel
          ? 'Order request cancelled.'
          : switch (status) {
              'confirmed' => 'Order accepted.',
              'declined' => 'Order declined.',
              'ready_for_pickup' => 'Order marked ready for pickup.',
              'completed' => 'Order completed.',
              _ => 'Order updated.',
            };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (error) {
      if (!mounted) return;
      setState(() => _busyOrderIds.remove(id));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _decline(Map<String, dynamic> order) async {
    var declineReason = '';
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Decline order request?'),
        content: TextField(
          autofocus: true,
          maxLength: 1000,
          maxLines: 3,
          onChanged: (value) => declineReason = value,
          decoration: const InputDecoration(
            labelText: 'Reason for declining',
            hintText: 'Let the buyer know why you cannot accept this order.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Keep order'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, declineReason),
            child: const Text('Decline'),
          ),
        ],
      ),
    );
    if (reason == null || reason.trim().isEmpty || !mounted) return;
    await _updateOrder(order, 'declined', note: reason.trim());
  }

  Future<void> _completeAfterHandover(Map<String, dynamic> order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Confirm order handover'),
        content: const Text(
          'Only mark this order completed after the buyer has received the item. Payment is arranged separately between you and the buyer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Not yet'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Confirm handover'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) await _updateOrder(order, 'completed');
  }

  Future<void> _cancel(Map<String, dynamic> order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel this order request?'),
        content: const Text('Only pending order requests can be cancelled.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep order'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await _updateOrder(order, 'cancelled', cancel: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.selling ? 'Orders for My Listings' : 'My Orders'),
        actions: [
          IconButton(
            tooltip: 'Refresh orders',
            onPressed: _reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<dynamic>(
        future: _ordersFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorMessage(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }

          final rawOrders = asMap(snapshot.data)['orders'];
          final orders = rawOrders is List
              ? rawOrders.map((row) => asMap(row)).toList()
              : <Map<String, dynamic>>[];
          if (orders.isEmpty) {
            return EmptyMessage(
              icon: widget.selling
                  ? Icons.storefront_outlined
                  : Icons.receipt_long_outlined,
              title: widget.selling
                  ? 'No orders for your listings'
                  : 'No orders yet',
              message: widget.selling
                  ? 'New requests for your active listings will appear here.'
                  : 'Order requests you place from the cart will appear here.',
            );
          }

          final emptyFilterLabel = widget.selling
              ? _sellerFilterLabel(_selectedSellerStatus)
              : _buyerFilterLabel(_selectedBuyerGroup);
          final visibleOrders = widget.selling
              ? (_selectedSellerStatus == 'all'
                    ? orders
                    : orders
                          .where(
                            (order) =>
                                valueOf(order['status']) ==
                                _selectedSellerStatus,
                          )
                          .toList())
              : _buyerOrders(orders);

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              TmcPanel(
                padding: const EdgeInsets.all(13),
                color: TmcPalette.paleBlue.withValues(alpha: .62),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline, color: TmcPalette.navyBlue),
                    SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        'These are order requests. No payment is collected in the app; buyer and seller coordinate payment and pickup separately.',
                        style: TextStyle(
                          color: TmcPalette.deepNavyBlack,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.selling) ...[
                const SizedBox(height: 18),
                const SectionHeading('Order status'),
                const SizedBox(height: 9),
                Wrap(
                  spacing: 8,
                  runSpacing: 7,
                  children: [
                    for (final filter in _sellerFilters)
                      ChoiceChip(
                        label: Text(
                          '${filter.label} (${filter.status == 'all' ? orders.length : orders.where((order) => valueOf(order['status']) == filter.status).length})',
                        ),
                        selected: _selectedSellerStatus == filter.status,
                        onSelected: (_) => setState(
                          () => _selectedSellerStatus = filter.status,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
              ] else ...[
                const SizedBox(height: 18),
                SectionHeading(
                  'Order history',
                  action: Text(
                    '${orders.length} total',
                    style: const TextStyle(
                      color: TmcPalette.darkGray,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 9),
                Wrap(
                  spacing: 8,
                  runSpacing: 7,
                  children: [
                    for (final filter in _buyerFilters)
                      ChoiceChip(
                        label: Text(
                          '${filter.label} (${_buyerGroupCount(orders, filter.group)})',
                        ),
                        selected: _selectedBuyerGroup == filter.group,
                        onSelected: (_) =>
                            setState(() => _selectedBuyerGroup = filter.group),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
              ],
              if (visibleOrders.isEmpty)
                EmptyMessage(
                  icon: Icons.filter_list_off,
                  title: 'No ${emptyFilterLabel.toLowerCase()} orders',
                  message: 'Choose another status filter to see more orders.',
                )
              else
                for (final order in visibleOrders)
                  _OrderCard(
                    order: order,
                    selling: widget.selling,
                    busy: _busyOrderIds.contains(
                      int.tryParse(valueOf(order['id'])) ?? -1,
                    ),
                    onAccept: () => _updateOrder(order, 'confirmed'),
                    onDecline: () => _decline(order),
                    onReadyForPickup: () =>
                        _updateOrder(order, 'ready_for_pickup'),
                    onComplete: () => _completeAfterHandover(order),
                    onCancel: () => _cancel(order),
                    onOpenDetails: widget.selling
                        ? null
                        : () => _openOrderDetails(order),
                  ),
            ],
          );
        },
      ),
    );
  }
}

String _sellerFilterLabel(String status) => switch (status) {
  'pending' => 'Placed',
  'confirmed' => 'Accepted',
  'ready_for_pickup' => 'Ready for pickup',
  'completed' => 'Completed',
  'declined' => 'Declined',
  'cancelled' => 'Cancelled',
  _ => 'All',
};

String _buyerFilterLabel(String group) => switch (group) {
  'active' => 'Active',
  'completed' => 'Completed',
  'cancelled' => 'Cancelled',
  _ => 'All',
};

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.selling,
    required this.busy,
    required this.onAccept,
    required this.onDecline,
    required this.onReadyForPickup,
    required this.onComplete,
    required this.onCancel,
    this.onOpenDetails,
  });

  final Map<String, dynamic> order;
  final bool selling;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onReadyForPickup;
  final VoidCallback onComplete;
  final VoidCallback onCancel;
  final VoidCallback? onOpenDetails;

  @override
  Widget build(BuildContext context) {
    final status = valueOf(order['status']);
    final buyer = asMap(order['buyer']);
    final seller = asMap(order['seller']);
    final otherParty = selling ? buyer : seller;
    final rawItems = order['items'];
    final items = rawItems is List
        ? rawItems.map((row) => asMap(row)).toList()
        : <Map<String, dynamic>>[];
    final orderNumber = valueOf(order['order_number']);
    final total = double.tryParse(valueOf(order['total_amount'])) ?? 0;
    final note = valueOf(selling ? order['buyer_note'] : order['seller_note']);
    final createdAt = DateTime.tryParse(valueOf(order['created_at']));
    final dateLabel = createdAt == null
        ? ''
        : '${createdAt.year}-${createdAt.month.toString().padLeft(2, '0')}-${createdAt.day.toString().padLeft(2, '0')}';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    orderNumber.isEmpty ? 'Order' : orderNumber,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                _OrderStatusBadge(status: status),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              '${selling ? "Buyer" : "Seller"}: ${valueOf(otherParty["name"])}${dateLabel.isEmpty ? "" : " | $dateLabel"}',
              style: const TextStyle(color: TmcPalette.darkGray, fontSize: 12),
            ),
            const Divider(height: 21),
            for (final item in items) _OrderLineItem(item: item),
            const Divider(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Order total',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                Text(
                  peso(total),
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
            if (note.isNotEmpty) ...[
              const SizedBox(height: 9),
              Text(
                (selling ? 'Buyer note: ' : 'Seller note: ') + note,
                style: const TextStyle(
                  color: TmcPalette.darkGray,
                  fontSize: 12,
                ),
              ),
            ],
            if (!selling && onOpenDetails != null) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: onOpenDetails,
                  icon: const Icon(Icons.open_in_new, size: 17),
                  label: const Text('View order details'),
                ),
              ),
            ],
            if (selling && status == 'pending') ...[
              const SizedBox(height: 13),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: busy ? null : onDecline,
                      child: const Text('Decline'),
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: FilledButton(
                      onPressed: busy ? null : onAccept,
                      child: busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Accept order'),
                    ),
                  ),
                ],
              ),
            ],
            if (selling && status == 'confirmed') ...[
              const SizedBox(height: 13),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: busy ? null : onReadyForPickup,
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Mark ready for pickup'),
                ),
              ),
            ],
            if (selling && status == 'ready_for_pickup') ...[
              const SizedBox(height: 8),
              const Text(
                'Only mark completed after the buyer receives the item.',
                style: TextStyle(color: TmcPalette.darkGray, fontSize: 12),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: busy ? null : onComplete,
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Mark completed'),
                ),
              ),
            ],
            if (!selling && status == 'pending') ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: busy ? null : onCancel,
                  child: const Text('Cancel request'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _OrderLineItem extends StatelessWidget {
  const _OrderLineItem({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final imageUrl = ApiService.imageUrlFor(valueOf(item['product_image']));
    final quantity = int.tryParse(valueOf(item['quantity'])) ?? 0;
    final unitPrice = double.tryParse(valueOf(item['unit_price'])) ?? 0;
    final lineTotal = double.tryParse(valueOf(item['line_total'])) ?? 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(TmcRadius.sm),
            child: SizedBox(
              width: 52,
              height: 52,
              child: imageUrl.isEmpty
                  ? _thumbnailPlaceholder()
                  : Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _thumbnailPlaceholder(),
                      loadingBuilder: (context, child, progress) =>
                          progress == null ? child : _thumbnailPlaceholder(),
                    ),
            ),
          ),
          const SizedBox(width: 10),
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
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  '$quantity x ${peso(unitPrice)}',
                  style: const TextStyle(
                    color: TmcPalette.darkGray,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            peso(lineTotal),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _thumbnailPlaceholder() => DecoratedBox(
    decoration: BoxDecoration(
      color: TmcPalette.paleBlue.withValues(alpha: .7),
      borderRadius: BorderRadius.circular(TmcRadius.sm),
    ),
    child: const Center(
      child: Icon(
        Icons.shopping_bag_outlined,
        color: TmcPalette.navyBlue,
        size: 23,
      ),
    ),
  );
}

class _OrderStatusBadge extends StatelessWidget {
  const _OrderStatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final color = switch (normalized) {
      'confirmed' || 'completed' => TmcPalette.success,
      'ready_for_pickup' => TmcPalette.navyBlue,
      'declined' || 'cancelled' => TmcPalette.error,
      _ => TmcPalette.warning,
    };
    final label = switch (normalized) {
      'pending' => 'Placed',
      'confirmed' => 'Accepted',
      'ready_for_pickup' => 'Ready for pickup',
      'declined' => 'Declined',
      'completed' => 'Completed',
      'cancelled' => 'Cancelled',
      _ => normalized.isEmpty ? 'Unknown' : normalized.replaceAll('_', ' '),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
