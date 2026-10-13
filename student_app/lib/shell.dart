import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'tmc_theme.dart';
import 'marketplace_page.dart';
import 'notifications_page.dart';
import 'profile_page.dart';
import 'sell_page.dart';

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
      appBar: AppBar(
        title: Row(
          children: [
            const BrandLogo(size: 38),
            const SizedBox(width: 10),
            Text(
              _titles[_index],
              style: const TextStyle(
                color: TmcPalette.deepNavyBlack,
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
