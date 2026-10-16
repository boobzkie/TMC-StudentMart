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
  static const _titles = ['Home', 'Marketplace', 'Sell', 'Cart', 'Profile'];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final student = context.read<AuthState>().user;
        if (student != null) {
          unawaited(context.read<CartState>().setCurrentUser(student.id));
        }
        unawaited(context.read<MarketplaceState>().loadProducts());
        unawaited(context.read<MarketplaceState>().loadCategories());
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final cartCount = context.watch<CartState>().itemCount;
    final pages = <Widget>[
      HomePage(onOpenMarketplace: () => setState(() => _index = 1)),
      const MarketplacePage(),
      const SellPage(),
      CartPage(onBrowse: () => setState(() => _index = 1)),
      const ProfilePage(),
    ];
    return Scaffold(
      drawer: _StudentDrawer(
        onNavigate: (index) => setState(() => _index = index),
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
            const BrandLogo(size: 38),
            const SizedBox(width: 10),
            Text(
              _titles[_index],
              style: const TextStyle(
                color: TmcPalette.text,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const NotificationsPage(),
              ),
            ),
            icon: const Icon(Icons.notifications_none),
          ),
          IconButton(
            tooltip: 'Search',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const SearchPage(),
              ),
            ),
            icon: const Icon(Icons.search),
          ),
          if (_index != 4)
            IconButton(
              tooltip: 'Profile',
              onPressed: () => setState(() => _index = 4),
              icon: const Icon(Icons.account_circle_outlined),
            ),
          const SizedBox(width: 6),
        ],
      ),
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Browse',
          ),
          const NavigationDestination(
            icon: Icon(Icons.add_box_outlined),
            selectedIcon: Icon(Icons.add_box),
            label: 'Sell',
          ),
          NavigationDestination(
            icon: _CartNavigationIcon(count: cartCount, selected: false),
            selectedIcon: _CartNavigationIcon(count: cartCount, selected: true),
            label: 'Cart',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _StudentDrawer extends StatelessWidget {
  const _StudentDrawer({required this.onNavigate});

  final ValueChanged<int> onNavigate;

  void _push(BuildContext context, Widget page) {
    Navigator.of(context).pop();
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => page),
    );
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
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
              child: Row(
                children: [
                  _DrawerAvatar(student: student),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          student?.name ?? 'Student',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: TmcPalette.deepNavyBlack,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          student?.course ?? 'TMC Student',
                          style: const TextStyle(color: TmcPalette.darkGray),
                        ),
                        if (student?.studentId.isNotEmpty ?? false)
                          Text(
                            student!.studentId,
                            style: const TextStyle(
                              color: TmcPalette.darkGray,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.home_outlined),
              title: const Text('Home'),
              onTap: () {
                Navigator.of(context).pop();
                onNavigate(0);
              },
            ),
            ListTile(
              leading: const Icon(Icons.storefront_outlined),
              title: const Text('Browse marketplace'),
              onTap: () {
                Navigator.of(context).pop();
                onNavigate(1);
              },
            ),
            ListTile(
              leading: const Icon(Icons.add_box_outlined),
              title: const Text('Sell an item'),
              onTap: () {
                Navigator.of(context).pop();
                onNavigate(2);
              },
            ),
            ListTile(
              leading: const Icon(Icons.shopping_cart_outlined),
              title: const Text('Cart'),
              onTap: () {
                Navigator.of(context).pop();
                onNavigate(3);
              },
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Profile'),
              onTap: () {
                Navigator.of(context).pop();
                onNavigate(4);
              },
            ),
            const Divider(height: 1),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 14, 20, 6),
              child: Text(
                'Settings and account',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.manage_accounts_outlined),
              title: const Text('Edit profile and privacy'),
              onTap: () => _push(
                context,
                const EditStudentProfilePage(),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('My orders'),
              onTap: () => _push(context, const OrdersPage()),
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: const Text('My reports'),
              onTap: () => _push(context, const ReportsPage()),
            ),
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
              leading: const Icon(Icons.lock_outlined),
              title: const Text('Change password'),
              onTap: () => _push(context, const AccountSecurityPage()),
            ),
            ListTile(
              leading: const Icon(Icons.notifications_none),
              title: const Text('Notifications'),
              onTap: () => _push(context, const NotificationsPage()),
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: TmcPalette.error),
              title: const Text(
                'Sign out',
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
