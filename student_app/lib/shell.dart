import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'marketplace_page.dart';
import 'notifications_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'search_page.dart';
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
      drawer: const _StudentDrawer(),
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
  const _StudentDrawer();

  void _push(BuildContext context, Widget page) {
    Navigator.of(context).pop();
    Navigator.of(
      context,
    ).push<void>(MaterialPageRoute<void>(builder: (_) => page));
  }

  Future<void> _logOut(BuildContext context) async {
    Navigator.of(context).pop();
    final cart = context.read<CartState>();
    final auth = context.read<AuthState>();
    await cart.clear();
    await auth.logout();
  }

  Widget _iconTile(IconData icon) => Container(
    width: 42,
    height: 42,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: TmcPalette.primarySoft,
      borderRadius: BorderRadius.circular(13),
      border: Border.all(color: TmcPalette.borderSoft),
    ),
    child: Icon(icon, size: 21, color: TmcPalette.primary),
  );

  Widget _trailingArrow() => const Icon(
    Icons.arrow_forward_ios_rounded,
    size: 14,
    color: TmcPalette.textSoft,
  );

  @override
  Widget build(BuildContext context) {
    final student = context.watch<AuthState>().user;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final drawerWidth = screenWidth < 400 ? screenWidth * .88 : 360.0;

    return Drawer(
      width: drawerWidth,
      backgroundColor: TmcPalette.pageBackground,
      elevation: 18,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(26)),
      ),
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(18, 14, 14, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [TmcPalette.deepNavy, TmcPalette.primaryHover],
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(24),
                  bottomRight: Radius.circular(24),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: TmcPalette.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const BrandLogo(size: 36),
                      ),
                      const SizedBox(width: 11),
                      const Expanded(
                        child: Text(
                          'TMC StudentMart',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: TmcPalette.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close menu',
                        onPressed: () => Navigator.of(context).pop(),
                        style: IconButton.styleFrom(
                          foregroundColor: TmcPalette.white,
                          backgroundColor: TmcPalette.white.withValues(
                            alpha: .12,
                          ),
                          minimumSize: const Size(42, 42),
                        ),
                        icon: const Icon(Icons.close_rounded, size: 21),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: TmcPalette.white.withValues(alpha: .09),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: TmcPalette.white.withValues(alpha: .16),
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: TmcPalette.gold,
                              width: 1.5,
                            ),
                          ),
                          child: _DrawerAvatar(student: student),
                        ),
                        const SizedBox(width: 11),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                student?.name ?? 'Student',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: TmcPalette.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.school_outlined,
                                    size: 14,
                                    color: TmcPalette.paleBlue,
                                  ),
                                  const SizedBox(width: 5),
                                  Flexible(
                                    child: Text(
                                      student?.course.isNotEmpty == true
                                          ? student!.course
                                          : 'TMC Student',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: TmcPalette.paleBlue,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListTileTheme(
                data: ListTileThemeData(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8),
                  dense: true,
                  iconColor: TmcPalette.primary,
                  textColor: TmcPalette.text,
                  horizontalTitleGap: 11,
                  minLeadingWidth: 42,
                  visualDensity: const VisualDensity(vertical: -1),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
                  children: [
                    const _DrawerSectionLabel('Your activity'),
                    ListTile(
                      leading: _iconTile(Icons.receipt_long_outlined),
                      title: const Text(
                        'My Orders',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text(
                        'Track purchases and order status',
                        style: TextStyle(
                          color: TmcPalette.textSoft,
                          fontSize: 12,
                        ),
                      ),
                      trailing: _trailingArrow(),
                      onTap: () => _push(context, const OrdersPage()),
                    ),
                    ListTile(
                      leading: _iconTile(Icons.flag_outlined),
                      title: const Text(
                        'My reports',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text(
                        'Review reports you have submitted',
                        style: TextStyle(
                          color: TmcPalette.textSoft,
                          fontSize: 12,
                        ),
                      ),
                      trailing: _trailingArrow(),
                      onTap: () => _push(context, const ReportsPage()),
                    ),
                    ListTile(
                      leading: _iconTile(Icons.storefront_outlined),
                      title: const Text(
                        'Sales',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text(
                        'Manage orders for your listings',
                        style: TextStyle(
                          color: TmcPalette.textSoft,
                          fontSize: 12,
                        ),
                      ),
                      trailing: _trailingArrow(),
                      onTap: () => _push(context, const SalesPage()),
                    ),
                    const SizedBox(height: 8),
                    const Divider(height: 1, indent: 8, endIndent: 8),
                    const SizedBox(height: 8),
                    const _DrawerSectionLabel('Account'),
                    ListTile(
                      leading: _iconTile(Icons.shield_outlined),
                      title: const Text(
                        'Account Settings',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text(
                        'Password and security controls',
                        style: TextStyle(
                          color: TmcPalette.textSoft,
                          fontSize: 12,
                        ),
                      ),
                      trailing: _trailingArrow(),
                      onTap: () => _push(context, const AccountSecurityPage()),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
              child: ListTileTheme(
                data: ListTileThemeData(
                  minLeadingWidth: 42,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: ListTile(
                  leading: Container(
                    width: 42,
                    height: 42,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: TmcPalette.errorSoft,
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(
                      Icons.logout_rounded,
                      size: 21,
                      color: TmcPalette.error,
                    ),
                  ),
                  title: const Text(
                    'Log out',
                    style: TextStyle(
                      color: TmcPalette.error,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  subtitle: const Text(
                    'Securely end this session',
                    style: TextStyle(color: TmcPalette.textSoft, fontSize: 12),
                  ),
                  onTap: () => _logOut(context),
                ),
              ),
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
                      fontSize: 12,
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
