import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'order_details_page.dart';
import 'tmc_theme.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  late Future<dynamic> _future;
  final Set<String> _busyIds = <String>{};

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<dynamic> _load() => context.read<ApiService>().get('/notifications');

  void _refresh() {
    final next = _load();
    setState(() {
      _future = next;
    });
  }

  Future<void> _handleRefresh() async {
    final next = _load();
    setState(() {
      _future = next;
    });
    await next;
  }

  Future<void> _openNotification(Map<String, dynamic> notification) async {
    final id = valueOf(notification['id']);
    if (id.isEmpty || _busyIds.contains(id)) return;

    setState(() {
      _busyIds.add(id);
    });
    try {
      if (valueOf(notification['read_at']).isEmpty) {
        await context.read<ApiService>().put(
          '/notifications/$id/read',
          const {},
        );
      }
      if (!mounted) return;

      final next = _load();
      setState(() {
        _busyIds.remove(id);
        _future = next;
      });

      final orderId = int.tryParse(valueOf(notification['order_id']));
      if (orderId != null && orderId > 0) {
        final event = valueOf(notification['event']);
        final sellerOrder =
            event == 'order_placed' || event == 'order_cancelled';
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) =>
                OrderDetailsPage(orderId: orderId, selling: sellerOrder),
          ),
        );
        if (mounted) _refresh();
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busyIds.remove(id);
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Notifications'),
      actions: [
        IconButton(
          tooltip: 'Refresh notifications',
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: FutureBuilder<dynamic>(
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

        final payload = asMap(snapshot.data);
        final unreadCount = int.tryParse(valueOf(payload['unread_count'])) ?? 0;
        final rawItems = payload['notifications'];
        final notifications = rawItems is List
            ? rawItems.map((row) => asMap(row)).toList()
            : <Map<String, dynamic>>[];

        if (notifications.isEmpty) {
          return Column(
            children: [
              _UnreadSummary(count: unreadCount),
              const Expanded(
                child: EmptyMessage(
                  icon: Icons.notifications_none,
                  title: 'You are all caught up',
                  message:
                      'Order updates will appear here when they are available.',
                ),
              ),
            ],
          );
        }

        return RefreshIndicator(
          onRefresh: _handleRefresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              _UnreadSummary(count: unreadCount),
              const SizedBox(height: 14),
              for (final notification in notifications) ...[
                _NotificationCard(
                  notification: notification,
                  busy: _busyIds.contains(valueOf(notification['id'])),
                  onTap: () => _openNotification(notification),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
        );
      },
    ),
  );
}

class _UnreadSummary extends StatelessWidget {
  const _UnreadSummary({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) => TmcPanel(
    color: TmcPalette.paleBlue.withValues(alpha: .48),
    child: Row(
      children: [
        const Icon(
          Icons.notifications_active_outlined,
          color: TmcPalette.navyBlue,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            count.toString() +
                (count == 1 ? ' unread notification' : ' unread notifications'),
            style: const TextStyle(
              color: TmcPalette.deepNavyBlack,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    ),
  );
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.notification,
    required this.busy,
    required this.onTap,
  });

  final Map<String, dynamic> notification;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = valueOf(notification['read_at']).isEmpty;
    final orderNumber = valueOf(notification['order_number']);
    final receivedAt = _receivedAt(valueOf(notification['created_at']));

    return TmcPanel(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(TmcRadius.lg),
        onTap: busy ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: unread
                      ? TmcPalette.paleBlue
                      : TmcPalette.lightGray.withValues(alpha: .55),
                  borderRadius: BorderRadius.circular(TmcRadius.md),
                ),
                child: Icon(
                  _notificationIcon(valueOf(notification['event'])),
                  color: TmcPalette.navyBlue,
                  size: 21,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            valueOf(notification['title']).isEmpty
                                ? 'Notification'
                                : valueOf(notification['title']),
                            style: TextStyle(
                              color: TmcPalette.deepNavyBlack,
                              fontWeight: unread
                                  ? FontWeight.w900
                                  : FontWeight.w700,
                            ),
                          ),
                        ),
                        if (unread)
                          const Padding(
                            padding: EdgeInsets.only(left: 7),
                            child: Icon(
                              Icons.circle,
                              size: 9,
                              color: TmcPalette.navyBlue,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      valueOf(notification['message']),
                      style: const TextStyle(
                        color: TmcPalette.darkGray,
                        fontSize: 13,
                        height: 1.35,
                      ),
                    ),
                    if (orderNumber.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Order $orderNumber',
                        style: const TextStyle(
                          color: TmcPalette.navyBlue,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                    if (receivedAt.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        receivedAt,
                        style: const TextStyle(
                          color: TmcPalette.mediumGray,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 5),
              busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(
                      Icons.chevron_right,
                      color: TmcPalette.mediumGray,
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

IconData _notificationIcon(String event) => switch (event) {
  'order_placed' => Icons.shopping_bag_outlined,
  'order_accepted' => Icons.check_circle_outline,
  'order_declined' => Icons.block_outlined,
  'order_ready_for_pickup' => Icons.storefront_outlined,
  'order_completed' => Icons.done_all,
  'order_cancelled' => Icons.cancel_outlined,
  _ => Icons.notifications_none,
};

String _receivedAt(String raw) {
  final date = DateTime.tryParse(raw)?.toLocal();
  if (date == null) return '';
  return date.toIso8601String().substring(0, 16).replaceFirst('T', ' ');
}
