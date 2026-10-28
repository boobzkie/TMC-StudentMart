import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'order_details_page.dart';
import 'product_details_page.dart';
import 'seller_profile_page.dart';
import 'tmc_theme.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    super.key,
    this.showAppBar = true,
    this.initialTab = 0,
    this.initialUnreadCount = 0,
    this.onUnreadCountChanged,
  });

  final bool showAppBar;
  final int initialTab;
  final int initialUnreadCount;
  final ValueChanged<int>? onUnreadCountChanged;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  late Future<dynamic> _future;
  late Future<List<Map<String, dynamic>>> _ordersFuture;
  late int _selectedTab;
  int _unreadCount = 0;
  int _pendingOrderCount = 0;
  int _notificationRequestVersion = 0;
  int _ordersRequestVersion = 0;
  late final Set<int> _visitedTabs;
  final Set<String> _busyIds = <String>{};

  static const _tabs = <_InboxTab>[
    _InboxTab('Messages', Icons.chat_bubble_outline_rounded),
    _InboxTab('Notifications', Icons.notifications_none_rounded),
    _InboxTab('Orders', Icons.receipt_long_outlined),
    _InboxTab('Followers', Icons.people_outline_rounded),
    _InboxTab('Following', Icons.person_add_alt_1_outlined),
  ];

  @override
  void initState() {
    super.initState();
    _selectedTab = widget.initialTab.clamp(0, _tabs.length - 1).toInt();
    _unreadCount = widget.initialUnreadCount;
    _visitedTabs = <int>{0, _selectedTab};
    _future = _load();
    _ordersFuture = _loadOrders();
  }

  @override
  void didUpdateWidget(covariant NotificationsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialUnreadCount != widget.initialUnreadCount &&
        _unreadCount != widget.initialUnreadCount) {
      _unreadCount = widget.initialUnreadCount;
    }
  }

  Future<dynamic> _load() async {
    final requestVersion = ++_notificationRequestVersion;
    final payload = await context.read<ApiService>().get('/notifications');
    if (mounted && requestVersion == _notificationRequestVersion) {
      final unreadCount =
          int.tryParse(valueOf(asMap(payload)['unread_count'])) ?? 0;
      setState(() {
        _unreadCount = unreadCount;
      });
      widget.onUnreadCountChanged?.call(unreadCount);
    }
    return payload;
  }

  Future<List<Map<String, dynamic>>> _loadOrders() async {
    final requestVersion = ++_ordersRequestVersion;
    final api = context.read<ApiService>();
    final payloads = await Future.wait<dynamic>([
      api.get('/orders'),
      api.get('/seller/orders'),
    ]);
    final byId = <String, Map<String, dynamic>>{};
    for (final payload in payloads) {
      final rows = asMap(payload)['orders'];
      if (rows is! List) continue;
      for (final row in rows) {
        final order = asMap(row);
        final id = valueOf(order['id']);
        if (id.isNotEmpty) byId[id] = order;
      }
    }
    final orders = byId.values.toList()
      ..sort((a, b) {
        final first =
            DateTime.tryParse(valueOf(a['updated_at'])) ??
            DateTime.tryParse(valueOf(a['created_at']));
        final second =
            DateTime.tryParse(valueOf(b['updated_at'])) ??
            DateTime.tryParse(valueOf(b['created_at']));
        if (first == null || second == null) return 0;
        return second.compareTo(first);
      });
    if (mounted && requestVersion == _ordersRequestVersion) {
      setState(() {
        _pendingOrderCount = orders
            .where((order) => valueOf(order['status']) == 'pending')
            .length;
      });
    }
    return orders;
  }

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

  void _refreshOrders() {
    final next = _loadOrders();
    setState(() => _ordersFuture = next);
  }

  Future<void> _handleOrdersRefresh() async {
    final next = _loadOrders();
    setState(() => _ordersFuture = next);
    await next;
  }

  void _selectTab(int index) {
    if (index == _selectedTab) return;
    setState(() {
      _selectedTab = index;
      _visitedTabs.add(index);
    });
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
      final productId = int.tryParse(valueOf(notification['product_id']));
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
      } else if (productId != null && productId > 0) {
        await Navigator.of(context).push<void>(
          MaterialPageRoute<void>(
            builder: (_) => ProductDetailsPage(productId: productId),
          ),
        );
        if (mounted) _refresh();
      } else if (valueOf(notification['complaint_id']).isNotEmpty && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Complaint details are not available in the app yet.',
            ),
          ),
        );
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
    appBar: widget.showAppBar
        ? AppBar(
            title: const Row(
              children: [
                BrandLogo(size: 30),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'TMC StudentMart',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            actions: [
              if (_selectedTab == 1)
                IconButton(
                  tooltip: 'Refresh notifications',
                  onPressed: _refresh,
                  icon: const Icon(Icons.refresh),
                ),
              if (_selectedTab == 2)
                IconButton(
                  tooltip: 'Refresh orders',
                  onPressed: _refreshOrders,
                  icon: const Icon(Icons.refresh),
                ),
            ],
          )
        : null,
    body: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Inbox',
                style: TextStyle(
                  color: TmcPalette.deepNavy,
                  fontSize: 26,
                  height: 1.12,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 5),
              const Text(
                'Stay updated with your orders, messages and notifications.',
                style: TextStyle(
                  color: TmcPalette.textMuted,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        _categorySelector(),
        const SizedBox(height: 10),
        Expanded(
          child: IndexedStack(
            index: _selectedTab,
            children: [
              for (var index = 0; index < _tabs.length; index++)
                _visitedTabs.contains(index)
                    ? _tabPage(index)
                    : const SizedBox.shrink(),
            ],
          ),
        ),
      ],
    ),
  );

  Widget _categorySelector() => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Row(
      children: [
        for (var index = 0; index < _tabs.length; index++) ...[
          _InboxCategoryButton(
            tab: _tabs[index],
            selected: index == _selectedTab,
            badgeCount: switch (index) {
              1 => _unreadCount,
              2 => _pendingOrderCount,
              _ => 0,
            },
            badgeMeaning: index == 1 ? 'unread' : 'pending',
            onTap: () => _selectTab(index),
          ),
          if (index < _tabs.length - 1) const SizedBox(width: 8),
        ],
      ],
    ),
  );

  Widget _tabPage(int index) => switch (index) {
    0 => _messagesUnavailable(),
    1 => _notificationList(),
    2 => _ordersList(),
    3 => _InboxConnectionsTab(
      key: const ValueKey('inbox-followers'),
      followers: true,
    ),
    4 => _InboxConnectionsTab(
      key: const ValueKey('inbox-following'),
      followers: false,
    ),
    _ => const SizedBox.shrink(),
  };

  Widget _messagesUnavailable() => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
    children: [
      TmcPanel(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: TmcPalette.primarySoft,
                borderRadius: BorderRadius.circular(TmcRadius.md),
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                color: TmcPalette.deepNavy,
                size: 25,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Messages are not available yet',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TmcPalette.deepNavy,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 5),
            const Text(
              'Direct messages are not connected yet. Check Notifications for marketplace updates.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TmcPalette.textMuted,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      Center(
        child: FilledButton.tonalIcon(
          onPressed: () => _selectTab(1),
          icon: const Icon(Icons.notifications_none_rounded),
          label: const Text('View notifications'),
        ),
      ),
    ],
  );

  Widget _notificationList() => FutureBuilder<dynamic>(
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
      return RefreshIndicator(
        onRefresh: _handleRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            _UnreadSummary(count: unreadCount),
            if (notifications.isEmpty) ...[
              const SizedBox(height: 14),
              const SizedBox(
                height: 280,
                child: EmptyMessage(
                  icon: Icons.notifications_none,
                  title: 'You are all caught up',
                  message:
                      'Order and marketplace updates will appear here when they are available.',
                ),
              ),
            ] else ...[
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
          ],
        ),
      );
    },
  );

  Widget _ordersList() => FutureBuilder<List<Map<String, dynamic>>>(
    future: _ordersFuture,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return ErrorMessage(
          message: snapshot.error.toString(),
          onRetry: _refreshOrders,
        );
      }
      final orders = snapshot.data ?? const <Map<String, dynamic>>[];
      return RefreshIndicator(
        onRefresh: _handleOrdersRefresh,
        child: orders.isEmpty
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                children: const [
                  SizedBox(
                    height: 280,
                    child: EmptyMessage(
                      icon: Icons.receipt_long_outlined,
                      title: 'No orders yet',
                      message:
                          'Orders you place or receive as a seller will appear here.',
                    ),
                  ),
                ],
              )
            : ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                itemCount: orders.length,
                separatorBuilder: (_, _) => const SizedBox(height: 9),
                itemBuilder: (context, index) => _InboxOrderCard(
                  order: orders[index],
                  onTap: () => _openOrder(orders[index]),
                ),
              ),
      );
    },
  );

  void _openOrder(Map<String, dynamic> order) {
    final orderId = int.tryParse(valueOf(order['id']));
    if (orderId == null || orderId <= 0) return;
    final userId = context.read<AuthState>().user?.id;
    final sellerId = int.tryParse(valueOf(asMap(order['seller'])['id']));
    Navigator.of(context)
        .push<void>(
          MaterialPageRoute<void>(
            builder: (_) => OrderDetailsPage(
              orderId: orderId,
              selling: userId != null && sellerId == userId,
            ),
          ),
        )
        .then((_) {
          if (mounted) _refreshOrders();
        });
  }
}

class _InboxTab {
  const _InboxTab(this.label, this.icon);
  final String label;
  final IconData icon;
}

class _InboxCategoryButton extends StatelessWidget {
  const _InboxCategoryButton({
    required this.tab,
    required this.selected,
    required this.badgeCount,
    required this.badgeMeaning,
    required this.onTap,
  });

  final _InboxTab tab;
  final bool selected;
  final int badgeCount;
  final String badgeMeaning;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: badgeCount > 0
        ? '${tab.label}, $badgeCount $badgeMeaning'
        : tab.label,
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(TmcRadius.md),
        child: AnimatedContainer(
          duration: TmcMotion.fast,
          constraints: const BoxConstraints(minHeight: 46, minWidth: 104),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? TmcPalette.deepNavy : TmcPalette.white,
            borderRadius: BorderRadius.circular(TmcRadius.md),
            border: Border.all(
              color: selected ? TmcPalette.deepNavy : TmcPalette.border,
            ),
            boxShadow: selected
                ? const <BoxShadow>[]
                : TmcNeumorphism.lightRaised,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                tab.icon,
                size: 18,
                color: selected ? TmcPalette.white : TmcPalette.deepNavy,
              ),
              const SizedBox(width: 7),
              Text(
                tab.label,
                style: TextStyle(
                  color: selected ? TmcPalette.white : TmcPalette.deepNavy,
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
                ),
              ),
              if (badgeCount > 0) ...[
                const SizedBox(width: 7),
                Container(
                  constraints: const BoxConstraints(minWidth: 19),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: selected ? TmcPalette.white : TmcPalette.error,
                    borderRadius: BorderRadius.circular(TmcRadius.pill),
                  ),
                  child: Text(
                    badgeCount > 99 ? '99+' : '$badgeCount',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: selected ? TmcPalette.deepNavy : TmcPalette.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

class _InboxOrderCard extends StatelessWidget {
  const _InboxOrderCard({required this.order, required this.onTap});
  final Map<String, dynamic> order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final id = valueOf(order['id']);
    final number = valueOf(order['order_number']);
    final items = order['items'];
    final firstItem = items is List && items.isNotEmpty
        ? asMap(items.first)
        : const <String, dynamic>{};
    final product = valueOf(firstItem['product_name']);
    final buyer = asMap(order['buyer']);
    final seller = asMap(order['seller']);
    final userId = context.read<AuthState>().user?.id;
    final selling =
        userId != null && int.tryParse(valueOf(seller['id'])) == userId;
    final otherParty = valueOf(selling ? buyer['name'] : seller['name']);
    final updated = _receivedAt(
      valueOf(order['updated_at']).isEmpty
          ? valueOf(order['created_at'])
          : valueOf(order['updated_at']),
    );

    return TmcPanel(
      padding: EdgeInsets.zero,
      child: InkWell(
        borderRadius: BorderRadius.circular(TmcRadius.lg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: TmcPalette.primarySoft,
                  borderRadius: BorderRadius.circular(TmcRadius.md),
                ),
                child: const Icon(
                  Icons.receipt_long_outlined,
                  color: TmcPalette.deepNavy,
                  size: 21,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      number.isEmpty ? 'Order $id' : number,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.deepNavy,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                    if (product.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        product,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: TmcPalette.textMuted,
                          fontSize: 13,
                        ),
                      ),
                    ],
                    const SizedBox(height: 5),
                    Text(
                      '${selling ? 'Selling to' : 'Buying from'} '
                      '${otherParty.isEmpty ? 'TMC Student' : otherParty}'
                      '${updated.isEmpty ? '' : ' · $updated'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.textSoft,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 7),
                    StatusBadge(valueOf(order['status'])),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                color: TmcPalette.textSoft,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InboxConnectionsTab extends StatefulWidget {
  const _InboxConnectionsTab({super.key, required this.followers});
  final bool followers;

  @override
  State<_InboxConnectionsTab> createState() => _InboxConnectionsTabState();
}

class _InboxConnectionsTabState extends State<_InboxConnectionsTab> {
  final List<StudentConnection> _accounts = <StudentConnection>[];
  final Set<int> _busyIds = <int>{};
  int _page = 0;
  int _lastPage = 1;
  int _total = 0;
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_loadPage());
  }

  Future<void> _loadPage({bool append = false}) async {
    if (_loadingMore || _loading) return;
    final requestedPage = append ? _page + 1 : 1;
    setState(() {
      _error = null;
      if (append) {
        _loadingMore = true;
      } else {
        _loading = true;
      }
    });
    try {
      final response = await context.read<ApiService>().myConnections(
        followers: widget.followers,
        page: requestedPage,
      );
      final rawAccounts = response['accounts'];
      final accounts = rawAccounts is List
          ? rawAccounts
                .map((row) => StudentConnection.fromJson(asMap(row)))
                .where((account) => account.id > 0)
                .toList()
          : <StudentConnection>[];
      if (!mounted) return;
      setState(() {
        if (append) {
          final knownIds = _accounts.map((account) => account.id).toSet();
          _accounts.addAll(
            accounts.where((account) => knownIds.add(account.id)),
          );
        } else {
          _accounts
            ..clear()
            ..addAll(accounts);
        }
        _page =
            int.tryParse(valueOf(response['current_page'])) ?? requestedPage;
        _lastPage = int.tryParse(valueOf(response['last_page'])) ?? _page;
        _total = int.tryParse(valueOf(response['total'])) ?? _accounts.length;
        _loading = false;
        _loadingMore = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _toggleFollow(StudentConnection account) async {
    if (_busyIds.contains(account.id)) return;
    final follow = !account.isFollowing;
    setState(() => _busyIds.add(account.id));
    try {
      final response = await context.read<ApiService>().setStudentFollowing(
        account.id,
        follow: follow,
      );
      if (!mounted) return;
      final isFollowing = response['is_following'] == true;
      setState(() {
        _busyIds.remove(account.id);
        if (!widget.followers && !isFollowing) {
          _accounts.removeWhere((item) => item.id == account.id);
          if (_total > 0) _total--;
        } else {
          final index = _accounts.indexWhere((item) => item.id == account.id);
          if (index >= 0) {
            _accounts[index] = StudentConnection(
              id: account.id,
              name: account.name,
              course: account.course,
              profilePicture: account.profilePicture,
              isFollowing: isFollowing,
            );
          }
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isFollowing
                ? 'You are now following ${account.name}.'
                : 'You unfollowed ${account.name}.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _busyIds.remove(account.id));
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _confirmUnfollow(StudentConnection account) async {
    final shouldUnfollow = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Unfollow this student?'),
        content: Text('You will stop following ${account.name}.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Unfollow'),
          ),
        ],
      ),
    );
    if (shouldUnfollow == true && mounted) await _toggleFollow(account);
  }

  void _openProfile(StudentConnection account) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => SellerProfilePage(
          sellerId: account.id,
          onOpenProduct: (product) => Navigator.of(context).push<void>(
            MaterialPageRoute<void>(
              builder: (_) => ProductDetailsPage(productId: product.id),
            ),
          ),
        ),
      ),
    );
  }

  Widget _avatar(StudentConnection account) {
    final initials = account.name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
    final imagePath = account.profilePicture;
    final imageUrl = imagePath == null || imagePath.isEmpty
        ? ''
        : ApiService.imageUrlFor(imagePath);
    final fallback = Text(
      initials.isEmpty ? 'T' : initials,
      style: const TextStyle(
        color: TmcPalette.deepNavy,
        fontWeight: FontWeight.w800,
      ),
    );
    return CircleAvatar(
      backgroundColor: TmcPalette.paleBlue,
      child: imageUrl.isEmpty
          ? fallback
          : ClipOval(
              child: Image.network(
                imageUrl,
                width: 40,
                height: 40,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => fallback,
              ),
            ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.followers ? 'Followers' : 'Following';
    if (_loading && _accounts.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _accounts.isEmpty) {
      return ErrorMessage(message: _error!, onRetry: _loadPage);
    }
    return RefreshIndicator(
      onRefresh: _loadPage,
      child: _accounts.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
              children: [
                TmcPanel(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: TmcPalette.primarySoft,
                          borderRadius: BorderRadius.circular(TmcRadius.md),
                        ),
                        child: const Icon(
                          Icons.people_outline,
                          color: TmcPalette.deepNavy,
                        ),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        'No ${title.toLowerCase()} yet',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: TmcPalette.deepNavy,
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        widget.followers
                            ? 'People who follow you appear here.'
                            : 'Students you follow appear here.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: TmcPalette.textMuted,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              itemCount:
                  _accounts.length +
                  (_page < _lastPage || _error != null ? 1 : 0),
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                if (index == _accounts.length) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Center(
                      child: TextButton.icon(
                        onPressed: _loadingMore
                            ? null
                            : () => _loadPage(append: _error == null),
                        icon: _loadingMore
                            ? const SizedBox.square(
                                dimension: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.expand_more),
                        label: Text(
                          _loadingMore
                              ? 'Loading…'
                              : _error != null
                              ? 'Retry loading more'
                              : 'Load more (${_total - _accounts.length} remaining)',
                        ),
                      ),
                    ),
                  );
                }
                final account = _accounts[index];
                final busy = _busyIds.contains(account.id);
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                  leading: _avatar(account),
                  title: Text(
                    account.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    account.course.isEmpty
                        ? 'TMC Student'
                        : 'TMC Student · ${account.course}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  onTap: () => _openProfile(account),
                  trailing: busy
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : widget.followers
                      ? account.isFollowing
                            ? const Icon(
                                Icons.check_circle_outline,
                                color: TmcPalette.textSoft,
                              )
                            : IconButton(
                                tooltip: 'Follow back ${account.name}',
                                onPressed: () => _toggleFollow(account),
                                icon: const Icon(
                                  Icons.person_add_alt_1_outlined,
                                ),
                              )
                      : IconButton(
                          tooltip: 'Unfollow ${account.name}',
                          onPressed: () => _confirmUnfollow(account),
                          icon: const Icon(Icons.person_remove_alt_1_outlined),
                        ),
                );
              },
            ),
    );
  }
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
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
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
                          fontSize: 12,
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
  final difference = DateTime.now().difference(date);
  if (difference.isNegative || difference.inMinutes < 1) return 'Just now';
  if (difference.inMinutes < 60) {
    final minutes = difference.inMinutes;
    return '${minutes}m ago';
  }
  if (difference.inHours < 24) return '${difference.inHours}h ago';
  if (difference.inDays < 7) return '${difference.inDays}d ago';
  return '${date.month}/${date.day}/${date.year}';
}
