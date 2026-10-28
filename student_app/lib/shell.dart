import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'edit_student_profile_page.dart';
import 'marketplace_page.dart';
import 'notifications_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'search_page.dart';
import 'categories_page.dart';
import 'account_security_page.dart';
import 'sales_page.dart';
import 'sell_page.dart';
import 'tmc_theme.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  bool _hasOpenedInbox = false;
  int _unreadInboxCount = 0;

  void _selectDestination(int value) {
    setState(() {
      _index = value;
      if (value == 3) _hasOpenedInbox = true;
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final student = context.read<AuthState>().user;
        if (student != null) {
          unawaited(context.read<CartState>().setCurrentUser(student.id));
          unawaited(_loadInboxUnreadCount());
        }
        unawaited(context.read<MarketplaceState>().loadProducts());
        unawaited(context.read<MarketplaceState>().loadCategories());
      }
    });
  }

  Future<void> _loadInboxUnreadCount() async {
    try {
      final response = asMap(
        await context.read<ApiService>().get('/notifications'),
      );
      if (!mounted) return;
      setState(() {
        _unreadInboxCount =
            int.tryParse(valueOf(response['unread_count'])) ?? 0;
      });
    } catch (_) {
      // Inbox data will retry when the user opens the Inbox destination.
    }
  }

  void _setInboxUnreadCount(int count) {
    if (!mounted || count == _unreadInboxCount) return;
    setState(() => _unreadInboxCount = count);
  }

  @override
  Widget build(BuildContext context) {
    final cartCount = context.watch<CartState>().itemCount;
    final pages = <Widget>[
      HomePage(onOpenMarketplace: () => _selectDestination(1)),
      const MarketplacePage(),
      const SellPage(),
      _hasOpenedInbox
          ? NotificationsPage(
              showAppBar: false,
              initialUnreadCount: _unreadInboxCount,
              onUnreadCountChanged: _setInboxUnreadCount,
            )
          : const SizedBox.shrink(),
      const ProfilePage(),
    ];
    return Scaffold(
      drawer: _StudentDrawer(
        selectedIndex: _index,
        onNavigate: _selectDestination,
        unreadInboxCount: _unreadInboxCount,
        onUnreadCountChanged: _setInboxUnreadCount,
      ),
      appBar: AppBar(
        leading: Builder(
          builder: (context) => IconButton(
            tooltip: 'Menu',
            icon: const Icon(Icons.menu_rounded),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: Row(
          children: [
            const BrandLogo(size: 36),
            const SizedBox(width: 9),
            const Expanded(
              child: Text(
                'TMC StudentMart',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: TmcPalette.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Search',
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute<void>(builder: (_) => const SearchPage())),
            icon: const Icon(Icons.search),
          ),
          IconButton(
            tooltip: 'Cart',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => CartPage(
                  onBrowse: () {
                    Navigator.of(context).pop();
                    _selectDestination(1);
                  },
                ),
              ),
            ),
            icon: _CartNavigationIcon(count: cartCount, selected: false),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: _StudentBottomNavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _selectDestination,
        unreadInboxCount: _unreadInboxCount,
      ),
    );
  }
}

class _StudentDrawer extends StatelessWidget {
  const _StudentDrawer({
    required this.selectedIndex,
    required this.onNavigate,
    required this.unreadInboxCount,
    required this.onUnreadCountChanged,
  });

  final int selectedIndex;
  final ValueChanged<int> onNavigate;
  final int unreadInboxCount;
  final ValueChanged<int> onUnreadCountChanged;

  void _push(BuildContext context, Widget page) {
    Navigator.of(context).pop();
    Navigator.of(
      context,
    ).push<void>(MaterialPageRoute<void>(builder: (_) => page));
  }

  void _navigate(BuildContext context, int destination) {
    Navigator.of(context).pop();
    onNavigate(destination);
  }

  @override
  Widget build(BuildContext context) {
    final student = context.watch<AuthState>().user;
    return Drawer(
      child: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 12, 14),
              child: Column(
                children: [
                  Row(
                    children: [
                      const BrandLogo(size: 42),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Text(
                          'TMC StudentMart',
                          style: TextStyle(
                            color: TmcPalette.deepNavyBlack,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close menu',
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _DrawerAvatar(student: student),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              student?.name ?? 'Student',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: TmcPalette.deepNavyBlack,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              student?.course.isNotEmpty == true
                                  ? student!.course
                                  : 'TMC Student',
                              style: const TextStyle(
                                color: TmcPalette.darkGray,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            const _DrawerSectionLabel('Marketplace'),
            ListTile(
              selected: selectedIndex == 0,
              leading: const Icon(Icons.home_outlined),
              title: const Text('Home'),
              onTap: () => _navigate(context, 0),
            ),
            ListTile(
              selected: selectedIndex == 1,
              leading: const Icon(Icons.storefront_outlined),
              title: const Text('Shop'),
              onTap: () => _navigate(context, 1),
            ),
            ListTile(
              selected: selectedIndex == 2,
              leading: const Icon(Icons.add_box_outlined),
              title: const Text('Sell an item'),
              onTap: () => _navigate(context, 2),
            ),
            ListTile(
              leading: const Icon(Icons.shopping_cart_outlined),
              title: const Text('Cart'),
              onTap: () {
                final navigator = Navigator.of(context);
                navigator.pop();
                navigator.push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => CartPage(
                      onBrowse: () {
                        navigator.pop();
                        onNavigate(1);
                      },
                    ),
                  ),
                );
              },
            ),
            const Divider(height: 1),
            const _DrawerSectionLabel('Your profile'),
            ListTile(
              selected: selectedIndex == 4,
              leading: const Icon(Icons.person_outline),
              title: const Text('Profile'),
              onTap: () => _navigate(context, 4),
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('My Orders'),
              onTap: () => _push(context, const OrdersPage()),
            ),
            ListTile(
              leading: const Icon(Icons.storefront_outlined),
              title: const Text('My Listings'),
              onTap: () => _navigate(context, 2),
            ),
            ListTile(
              leading: const Icon(Icons.alternate_email_outlined),
              title: const Text('Email & Contact'),
              onTap: () => _push(context, const EditStudentProfilePage()),
            ),
            ListTile(
              leading: const Icon(Icons.manage_accounts_outlined),
              title: const Text('Edit Profile'),
              onTap: () => _push(context, const EditStudentProfilePage()),
            ),
            ListTile(
              leading: const Icon(Icons.lock_outline),
              title: const Text('Account Settings'),
              onTap: () => _push(context, const AccountSecurityPage()),
            ),
            ListTile(
              leading: const Icon(Icons.privacy_tip_outlined),
              title: const Text('Privacy Settings'),
              onTap: () => _push(context, const EditStudentProfilePage()),
            ),
            ListTile(
              leading: const Icon(Icons.notifications_none),
              title: const Text('Notifications'),
              onTap: () => _push(
                context,
                NotificationsPage(
                  initialTab: 1,
                  initialUnreadCount: unreadInboxCount,
                  onUnreadCountChanged: onUnreadCountChanged,
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: const Text('My reports'),
              onTap: () => _push(context, const ReportsPage()),
            ),
            const Divider(height: 1),
            const _DrawerSectionLabel('More'),
            ListTile(
              leading: const Icon(Icons.category_outlined),
              title: const Text('Browse categories'),
              onTap: () => _push(context, const CategoriesPage()),
            ),
            ListTile(
              leading: const Icon(Icons.attach_money),
              title: const Text('Sales'),
              onTap: () => _push(context, const SalesPage()),
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: TmcPalette.error),
              title: const Text(
                'Log Out',
                style: TextStyle(
                  color: TmcPalette.error,
                  fontWeight: FontWeight.w700,
                ),
              ),
              onTap: () async {
                Navigator.of(context).pop();
                final cart = context.read<CartState>();
                final auth = context.read<AuthState>();
                await cart.clear();
                await auth.logout();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerSectionLabel extends StatelessWidget {
  const _DrawerSectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 14, 18, 5),
    child: Text(
      label.toUpperCase(),
      style: const TextStyle(
        color: TmcPalette.darkGray,
        fontSize: 12,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.1,
      ),
    ),
  );
}

class _StudentBottomNavigationBar extends StatelessWidget {
  const _StudentBottomNavigationBar({
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.unreadInboxCount,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final int unreadInboxCount;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: TmcPalette.deepNavy,
      border: Border(
        top: BorderSide(color: Colors.white.withValues(alpha: .12)),
      ),
      boxShadow: [
        BoxShadow(
          color: TmcPalette.deepNavy.withValues(alpha: .2),
          blurRadius: 14,
          offset: const Offset(0, -4),
        ),
      ],
    ),
    child: SafeArea(
      top: false,
      child: SizedBox(
        height: 66,
        child: Row(
          children: [
            _BottomNavigationItem(
              label: 'Home',
              icon: Icons.home_outlined,
              selectedIcon: Icons.home_rounded,
              selected: selectedIndex == 0,
              onTap: () => onDestinationSelected(0),
            ),
            _BottomNavigationItem(
              label: 'Shop',
              icon: Icons.shopping_bag_outlined,
              selectedIcon: Icons.shopping_bag_rounded,
              selected: selectedIndex == 1,
              onTap: () => onDestinationSelected(1),
            ),
            Expanded(
              child: Center(
                child: Semantics(
                  button: true,
                  label: 'Sell an item',
                  child: Tooltip(
                    message: 'Sell an item',
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => onDestinationSelected(2),
                        borderRadius: BorderRadius.circular(16),
                        child: Container(
                          width: 54,
                          height: 42,
                          decoration: BoxDecoration(
                            color: TmcPalette.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: TmcPalette.border),
                            boxShadow: [
                              BoxShadow(
                                color: TmcPalette.lightBlue.withValues(
                                  alpha: .68,
                                ),
                                offset: const Offset(-3, 0),
                                blurRadius: 7,
                              ),
                              BoxShadow(
                                color: TmcPalette.mutedTeal.withValues(
                                  alpha: .62,
                                ),
                                offset: const Offset(3, 0),
                                blurRadius: 7,
                              ),
                              BoxShadow(
                                color: Colors.black.withValues(alpha: .22),
                                offset: const Offset(0, 3),
                                blurRadius: 7,
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.add_rounded,
                            size: 29,
                            color: TmcPalette.deepNavy,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            _BottomNavigationItem(
              label: 'Inbox',
              icon: Icons.chat_bubble_outline_rounded,
              selectedIcon: Icons.chat_bubble_rounded,
              selected: selectedIndex == 3,
              badgeCount: unreadInboxCount,
              onTap: () => onDestinationSelected(3),
            ),
            _BottomNavigationItem(
              label: 'Profile',
              icon: Icons.person_outline_rounded,
              selectedIcon: Icons.person_rounded,
              selected: selectedIndex == 4,
              onTap: () => onDestinationSelected(4),
            ),
          ],
        ),
      ),
    ),
  );
}

class _BottomNavigationItem extends StatelessWidget {
  const _BottomNavigationItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    required this.selected,
    required this.onTap,
    this.badgeCount = 0,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final bool selected;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Semantics(
      button: true,
      selected: selected,
      label: badgeCount > 0
          ? '$label, $badgeCount unread notifications'
          : label,
      child: Tooltip(
        message: label,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 5),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Badge(
                    isLabelVisible: badgeCount > 0,
                    label: Text(badgeCount > 99 ? '99+' : '$badgeCount'),
                    child: Icon(
                      selected ? selectedIcon : icon,
                      size: 22,
                      color: selected
                          ? TmcPalette.white
                          : TmcPalette.white.withValues(alpha: .72),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.clip,
                    style: TextStyle(
                      color: selected
                          ? TmcPalette.white
                          : TmcPalette.white.withValues(alpha: .72),
                      fontSize: 11,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _DrawerAvatar extends StatelessWidget {
  const _DrawerAvatar({required this.student});

  final Student? student;

  @override
  Widget build(BuildContext context) {
    final name = student?.name ?? 'Student';
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    final initials = parts.take(2).map((p) => p[0].toUpperCase()).join();
    final imagePath = student?.profilePicture;
    if (imagePath != null && imagePath.isNotEmpty) {
      final url = ApiService.imageUrlFor(imagePath);
      if (url.isNotEmpty) {
        return ClipOval(
          child: Image.network(
            url,
            width: 52,
            height: 52,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => _fallback(initials),
          ),
        );
      }
    }
    return _fallback(initials);
  }

  Widget _fallback(String initials) => CircleAvatar(
    radius: 26,
    backgroundColor: TmcPalette.surface,
    child: Text(
      initials.isEmpty ? 'T' : initials,
      style: const TextStyle(
        color: TmcPalette.deepNavyBlack,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
}

class _CartNavigationIcon extends StatelessWidget {
  const _CartNavigationIcon({required this.count, required this.selected});
  final int count;
  final bool selected;

  @override
  Widget build(BuildContext context) => Badge(
    isLabelVisible: count > 0,
    label: Text(count > 99 ? '99+' : '$count'),
    child: Icon(selected ? Icons.shopping_cart : Icons.shopping_cart_outlined),
  );
}
