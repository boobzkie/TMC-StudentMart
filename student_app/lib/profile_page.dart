import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'edit_student_profile_page.dart';
import 'marketplace_page.dart';
import 'order_details_page.dart';
import 'orders_page.dart';
import 'sell_page.dart';
import 'tmc_theme.dart';

class CartPage extends StatefulWidget {
  const CartPage({super.key, this.onBrowse});

  final VoidCallback? onBrowse;

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  bool _placingOrder = false;

  Future<Map<String, dynamic>?> _chooseOrderOptions(ApiService api) async {
    final response = asMap(await api.get('/order-options'));
    if (!mounted) return null;
    final rawMethods = response['payment_methods'];
    final rawLocations = response['pickup_locations'];
    final methods = rawMethods is List
        ? rawMethods
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
        : <Map<String, dynamic>>[];
    final locations = rawLocations is List
        ? rawLocations
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
        : <Map<String, dynamic>>[];

    if (methods.isEmpty || locations.isEmpty) {
      throw const ApiException(
        'Checkout is not available yet. Ask the TMC Administrator to configure an active payment method and pickup location.',
      );
    }

    int? paymentMethodId = int.tryParse(methods.first['id'].toString());
    int? pickupLocationId = int.tryParse(locations.first['id'].toString());

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Choose order arrangements'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Select the method and pickup point agreed for this order. The app will not collect or verify payment.',
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  initialValue: paymentMethodId,
                  decoration: const InputDecoration(
                    labelText: 'Payment method',
                  ),
                  items: methods
                      .map((method) {
                        final id = int.tryParse(method['id'].toString());
                        return DropdownMenuItem<int>(
                          value: id,
                          child: Text(
                            method['name']?.toString() ?? 'Payment method',
                          ),
                        );
                      })
                      .where((item) => item.value != null)
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => paymentMethodId = value),
                ),
                if ((methods
                            .firstWhere(
                              (method) =>
                                  int.tryParse(method['id'].toString()) ==
                                  paymentMethodId,
                              orElse: () => <String, dynamic>{},
                            )['instructions']
                            ?.toString() ??
                        '')
                    .trim()
                    .isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    methods
                        .firstWhere(
                          (method) =>
                              int.tryParse(method['id'].toString()) ==
                              paymentMethodId,
                          orElse: () => <String, dynamic>{},
                        )['instructions']
                        .toString(),
                    style: const TextStyle(fontSize: 12),
                  ),
                ],
                const SizedBox(height: 14),
                DropdownButtonFormField<int>(
                  initialValue: pickupLocationId,
                  decoration: const InputDecoration(
                    labelText: 'Pickup location',
                  ),
                  items: locations
                      .map((location) {
                        final id = int.tryParse(location['id'].toString());
                        final area =
                            [location['building_room'], location['campus_area']]
                                .where(
                                  (part) =>
                                      part != null &&
                                      part.toString().trim().isNotEmpty,
                                )
                                .join(' · ');
                        return DropdownMenuItem<int>(
                          value: id,
                          child: Text(
                            area.isEmpty
                                ? location['name']?.toString() ??
                                      'Pickup location'
                                : '${location['name']} · $area',
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      })
                      .where((item) => item.value != null)
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => pickupLocationId = value),
                ),
                const SizedBox(height: 8),
                const Text(
                  'These choices are saved with the order. They do not mark it paid.',
                  style: TextStyle(fontSize: 12, color: TmcPalette.darkGray),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: paymentMethodId == null || pickupLocationId == null
                  ? null
                  : () => Navigator.pop(dialogContext, {
                      'payment_method_id': paymentMethodId,
                      'pickup_location_id': pickupLocationId,
                    }),
              child: const Text('Continue'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _placeOrder(CartState cart) async {
    if (_placingOrder || cart.entries.isEmpty) return;
    final student = context.read<AuthState>().user;
    if (student == null) return;

    if (cart.entries.any((entry) => isOwnProduct(entry.product, student.id))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'You cannot purchase your own product. Remove it from your cart.',
          ),
        ),
      );
      return;
    }

    if (cart.entries.any(
      (entry) =>
          entry.product.status != 'active' ||
          entry.quantity > entry.availableStock,
    )) {
      final unavailable = cart.entries.any(
        (entry) => entry.product.status != 'active',
      );
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            unavailable
                ? 'Product is no longer available.'
                : 'One or more items are no longer available in that quantity. Refresh the marketplace and update your cart.',
          ),
        ),
      );
      return;
    }

    setState(() => _placingOrder = true);
    try {
      final api = context.read<ApiService>();
      final options = await _chooseOrderOptions(api);
      if (!mounted) return;
      if (options == null) {
        setState(() => _placingOrder = false);
        return;
      }
      final items = cart.entries
          .map(
            (entry) => <String, Object?>{
              'product_id': entry.product.id,
              'variant_id': entry.variant?.id,
              'quantity': entry.quantity,
            },
          )
          .toList(growable: false);
      final idempotencyKey = await cart.checkoutIdempotencyKey(
        buyerId: student.id,
        paymentMethodId: options['payment_method_id']!,
        pickupLocationId: options['pickup_location_id']!,
        items: items,
      );
      final response = asMap(
        await api.post('/orders', {
          'idempotency_key': idempotencyKey,
          ...options,
          'items': items,
        }),
      );
      final created = response['orders'];
      final orderCount = created is List ? created.length : 1;
      await cart.clear();
      await cart.completeCheckoutAttempt(
        buyerId: student.id,
        idempotencyKey: idempotencyKey,
      );
      if (!mounted) return;
      setState(() => _placingOrder = false);
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Order request sent'),
          content: Text(
            'Your request was sent as $orderCount ${orderCount == 1 ? 'seller order.' : 'seller orders.'} No payment was collected or verified. The seller will review the request.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Close'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(dialogContext);
                Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const OrdersPage()),
                );
              },
              child: const Text('View my orders'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _placingOrder = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
    if (cart.entries.isEmpty) {
      return Column(
        children: [
          const Expanded(
            child: EmptyMessage(
              icon: Icons.shopping_cart_outlined,
              title: 'Your cart is empty',
              message:
                  'Add items from active marketplace listings. Your cart is saved on this device.',
            ),
          ),
          if (widget.onBrowse != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: widget.onBrowse,
                  icon: const Icon(Icons.storefront_outlined),
                  label: const Text('Browse listings'),
                ),
              ),
            ),
        ],
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: cart.entries.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final entry = cart.entries[index];
              final product = entry.product;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(11),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 76,
                        child: ProductPhoto(product: product, height: 76),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            if (entry.optionLabel.isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                entry.optionLabel,
                                style: const TextStyle(
                                  color: TmcPalette.navyBlue,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                            const SizedBox(height: 4),
                            Text(
                              peso(product.price),
                              style: const TextStyle(
                                color: TmcPalette.navyBlue,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              entry.availableStock <= 0
                                  ? 'Stock unavailable'
                                  : '${entry.availableStock} available for this option',
                              style: const TextStyle(
                                color: TmcPalette.darkGray,
                                fontSize: 11,
                              ),
                            ),
                            if (product.status != 'active')
                              const Text(
                                'Product is no longer available.',
                                style: TextStyle(
                                  color: TmcPalette.error,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                _QuantityButton(
                                  icon: Icons.remove,
                                  onTap: _placingOrder
                                      ? null
                                      : () => cart.setQuantity(
                                          entry.key,
                                          entry.quantity - 1,
                                        ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                  ),
                                  child: Text(
                                    entry.quantity.toString(),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                _QuantityButton(
                                  icon: Icons.add,
                                  onTap:
                                      _placingOrder ||
                                          product.status != 'active' ||
                                          entry.quantity >= entry.availableStock
                                      ? null
                                      : () => cart.setQuantity(
                                          entry.key,
                                          entry.quantity + 1,
                                        ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Remove item',
                        onPressed: _placingOrder
                            ? null
                            : () => cart.setQuantity(entry.key, 0),
                        icon: const Icon(
                          Icons.delete_outline,
                          color: TmcPalette.error,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
            decoration: const BoxDecoration(
              color: TmcPalette.white,
              border: Border(top: BorderSide(color: TmcPalette.lightGray)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Cart estimate',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      peso(cart.total),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Choose an Admin-configured payment method and pickup point when placing the order. The app does not collect or verify payment.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: TmcPalette.darkGray),
                ),
                const SizedBox(height: 10),
                FilledButton.icon(
                  onPressed: _placingOrder ? null : () => _placeOrder(cart),
                  icon: _placingOrder
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.shopping_bag_outlined),
                  label: Text(
                    _placingOrder
                        ? 'Sending request...'
                        : 'Place order request',
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _QuantityButton extends StatelessWidget {
  const _QuantityButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 29,
    height: 29,
    child: IconButton.filledTonal(
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
      onPressed: onTap,
      icon: Icon(icon, size: 17),
    ),
  );
}

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  int _selectedTab = 0;
  Future<dynamic>? _ordersFuture;
  late Future<Map<String, dynamic>> _followStatsFuture;

  @override
  void initState() {
    super.initState();
    _followStatsFuture = context.read<ApiService>().myFollowStats();
    unawaited(context.read<MarketplaceState>().loadMine());
  }

  Future<void> _changeProfilePhoto() async {
    if (context.read<AuthState>().savingProfile) return;

    try {
      final photo = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );
      if (!mounted || photo == null) return;

      final extension = photo.name.toLowerCase().split('.').last;
      const supportedExtensions = {'jpg', 'jpeg', 'png', 'webp'};
      if (!supportedExtensions.contains(extension)) {
        _showProfilePhotoMessage('Choose a JPG, PNG, or WebP image.');
        return;
      }
      if (await photo.length() > 2 * 1024 * 1024) {
        if (mounted) {
          _showProfilePhotoMessage('Choose an image smaller than 2 MB.');
        }
        return;
      }

      final bytes = await photo.readAsBytes();
      if (!mounted) return;
      final shouldUpload = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Update profile photo'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipOval(
                child: Image.memory(
                  bytes,
                  width: 144,
                  height: 144,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 14),
              const Text('Use this photo on your StudentMart profile?'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel'),
            ),
            FilledButton.icon(
              onPressed: () => Navigator.pop(dialogContext, true),
              icon: const Icon(Icons.upload_outlined),
              label: const Text('Upload photo'),
            ),
          ],
        ),
      );
      if (shouldUpload != true || !mounted) return;

      await context.read<AuthState>().uploadProfilePicture(photo);
      if (mounted) {
        _showProfilePhotoMessage('Profile photo updated.');
      }
    } catch (error) {
      if (mounted) _showProfilePhotoMessage(error.toString());
    }
  }

  void _showProfilePhotoMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _selectTab(int tab) {
    if (tab == _selectedTab) return;
    if (tab == 1 && _ordersFuture == null) {
      _ordersFuture = context.read<ApiService>().get('/orders');
    }
    setState(() => _selectedTab = tab);
  }

  void _open(BuildContext context, Widget page) {
    Navigator.of(
      context,
    ).push<void>(MaterialPageRoute<void>(builder: (_) => page));
  }

  void _viewAll(BuildContext context) {
    if (_selectedTab == 0) {
      _openListings(context);
    } else {
      _open(context, const OrdersPage());
    }
  }

  void _openListings(BuildContext context) {
    _open(
      context,
      Scaffold(
        appBar: AppBar(title: const Text('My Listings')),
        body: const SellPage(),
      ),
    );
  }

  Future<void> _openConnections(bool followers) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => _ConnectionsPage(followers: followers),
      ),
    );
    if (!mounted) return;
    setState(() {
      _followStatsFuture = context.read<ApiService>().myFollowStats();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final student = auth.user;
    if (student == null) return const SizedBox.shrink();
    final marketplace = context.watch<MarketplaceState>();
    final listings = marketplace.myProducts;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        TmcPanel(
          padding: const EdgeInsets.all(18),
          color: TmcPalette.primarySoft,
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      _StudentAvatar(student: student, size: 88),
                      Positioned(
                        right: -5,
                        bottom: -5,
                        child: Tooltip(
                          message: 'Change profile photo',
                          child: Semantics(
                            button: true,
                            label: 'Change profile photo',
                            child: IconButton.filled(
                              onPressed: auth.savingProfile
                                  ? null
                                  : _changeProfilePhoto,
                              tooltip: 'Change profile photo',
                              icon: auth.savingProfile
                                  ? const SizedBox.square(
                                      dimension: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.camera_alt_outlined),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          student.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                color: TmcPalette.deepNavyBlack,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 5),
                        const Text(
                          'TMC Student',
                          style: TextStyle(
                            color: TmcPalette.darkGray,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (student.status.isNotEmpty) ...[
                          const SizedBox(height: 9),
                          StatusBadge(student.status),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              FutureBuilder<Map<String, dynamic>>(
                future: _followStatsFuture,
                builder: (context, snapshot) {
                  final stats = snapshot.data ?? const <String, dynamic>{};
                  final followingCount =
                      int.tryParse(valueOf(stats['following_count'])) ?? 0;
                  final followersCount =
                      int.tryParse(valueOf(stats['followers_count'])) ?? 0;
                  final countLabel = snapshot.hasError || !snapshot.hasData
                      ? '—'
                      : null;

                  return Row(
                    children: [
                      Expanded(
                        child: _ProfileStat(
                          count: countLabel ?? '$followingCount',
                          label: 'Following',
                          onTap: () => _openConnections(false),
                        ),
                      ),
                      Container(width: 1, height: 38, color: TmcPalette.border),
                      Expanded(
                        child: _ProfileStat(
                          count: countLabel ?? '$followersCount',
                          label: 'Followers',
                          onTap: () => _openConnections(true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: () =>
                            _open(context, const EditStudentProfilePage()),
                        icon: const Icon(Icons.edit_outlined, size: 16),
                        label: const Text('Edit profile'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(48, 42),
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _open(context, const OrdersPage()),
                icon: const Icon(Icons.shopping_bag_outlined),
                label: const Text('My Orders'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(48, 54),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                onPressed: () => _openListings(context),
                icon: const Icon(Icons.storefront_outlined),
                label: const Text('My Listings'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(48, 54),
                  backgroundColor: TmcPalette.deepNavy,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 22),
        TmcPanel(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 12),
          child: Column(
            children: [
              Row(
                children: [
                  _ProfileTab(
                    label: 'My Listings',
                    selected: _selectedTab == 0,
                    onTap: () => _selectTab(0),
                  ),
                  const SizedBox(width: 18),
                  _ProfileTab(
                    label: 'My Orders',
                    selected: _selectedTab == 1,
                    onTap: () => _selectTab(1),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => _viewAll(context),
                    style: TextButton.styleFrom(
                      minimumSize: const Size(48, 44),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('View all'),
                        Icon(Icons.chevron_right, size: 18),
                      ],
                    ),
                  ),
                ],
              ),
              const Divider(height: 1),
              const SizedBox(height: 12),
              if (_selectedTab == 0)
                _buildListings(marketplace, listings)
              else
                _buildOrders(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildListings(MarketplaceState marketplace, List<Product> listings) {
    if (marketplace.loading && listings.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (marketplace.error != null && listings.isEmpty) {
      return ErrorMessage(
        message: marketplace.error!,
        onRetry: marketplace.loadMine,
      );
    }
    if (listings.isEmpty) {
      return const EmptyMessage(
        icon: Icons.storefront_outlined,
        title: 'No listings yet',
        message:
            'Your marketplace listings will appear here. Use the + button to create one.',
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 900
            ? 4
            : constraints.maxWidth >= 620
            ? 3
            : constraints.maxWidth >= 350
            ? 2
            : 1;
        final preview = listings.take(4).toList(growable: false);
        return GridView.builder(
          itemCount: preview.length,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisExtent: 210,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemBuilder: (context, index) {
            final product = preview[index];
            return ProductCard(
              product: product,
              management: true,
              imageHeight: 104,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ProductDetailsPage(product: product),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildOrders() => FutureBuilder<dynamic>(
    future: _ordersFuture,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        );
      }
      if (snapshot.hasError) {
        return ErrorMessage(
          message: snapshot.error.toString(),
          onRetry: () => setState(
            () => _ordersFuture = context.read<ApiService>().get('/orders'),
          ),
        );
      }
      final rawOrders = asMap(snapshot.data)['orders'];
      final orders = rawOrders is List
          ? rawOrders.map((row) => asMap(row)).take(3).toList()
          : <Map<String, dynamic>>[];
      if (orders.isEmpty) {
        return const EmptyMessage(
          icon: Icons.receipt_long_outlined,
          title: 'No orders yet',
          message: 'Order requests you place will appear here.',
        );
      }
      return Column(
        children: [
          for (final order in orders)
            _ProfileOrderCard(
              order: order,
              onTap: () {
                final id = int.tryParse(valueOf(order['id']));
                if (id != null) {
                  Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => OrderDetailsPage(orderId: id),
                    ),
                  );
                }
              },
            ),
        ],
      );
    },
  );
}

class _ProfileTab extends StatelessWidget {
  const _ProfileTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: label,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(TmcRadius.sm),
      child: Container(
        constraints: const BoxConstraints(minHeight: 46),
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 10),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? TmcPalette.primary : Colors.transparent,
              width: 3,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? TmcPalette.deepNavy : TmcPalette.darkGray,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ),
    ),
  );
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({
    required this.count,
    required this.label,
    required this.onTap,
  });

  final String count;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$count $label',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(TmcRadius.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              count,
              style: const TextStyle(
                color: TmcPalette.deepNavy,
                fontSize: 16,
                fontWeight: FontWeight.w900,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                color: TmcPalette.darkGray,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ConnectionsPage extends StatefulWidget {
  const _ConnectionsPage({required this.followers});

  final bool followers;

  @override
  State<_ConnectionsPage> createState() => _ConnectionsPageState();
}

class _ConnectionsPageState extends State<_ConnectionsPage> {
  final List<StudentConnection> _accounts = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 0;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _loadPage();
  }

  Future<void> _loadPage({bool append = false}) async {
    if (_loadingMore) return;
    setState(() {
      if (append) {
        _loadingMore = true;
      } else {
        _loading = true;
      }
      _error = null;
    });

    try {
      final response = await context.read<ApiService>().myConnections(
        followers: widget.followers,
        page: append ? _page + 1 : 1,
      );
      final accounts = listFrom(response, 'accounts')
          .map((row) => StudentConnection.fromJson(asMap(row)))
          .where((account) => account.id > 0)
          .toList(growable: false);
      if (!mounted) return;

      setState(() {
        if (append) {
          _accounts.addAll(accounts);
        } else {
          _accounts
            ..clear()
            ..addAll(accounts);
        }
        _page = int.tryParse(valueOf(response['current_page'])) ?? 1;
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

  Widget _avatar(StudentConnection account) {
    final nameParts = account.name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2);
    final initials = nameParts.map((part) => part[0].toUpperCase()).join();
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

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: _loading && _accounts.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _accounts.isEmpty
          ? ErrorMessage(message: _error!, onRetry: _loadPage)
          : _accounts.isEmpty
          ? EmptyMessage(
              icon: Icons.people_outline,
              title: 'No ${title.toLowerCase()} yet',
              message: widget.followers
                  ? 'People who follow your account will appear here.'
                  : 'Students you follow will appear here.',
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
              itemCount: _accounts.length + (_accounts.length < _total ? 1 : 0),
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                if (index == _accounts.length) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Center(
                      child: TextButton.icon(
                        onPressed: _loadingMore
                            ? null
                            : () => _loadPage(append: true),
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
                              : 'Load more (${_total - _accounts.length} left)',
                        ),
                      ),
                    ),
                  );
                }

                final account = _accounts[index];
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
                );
              },
            ),
    );
  }
}

class _ProfileOrderCard extends StatelessWidget {
  const _ProfileOrderCard({required this.order, required this.onTap});

  final Map<String, dynamic> order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final orderNumber = valueOf(order['order_number']);
    final id = valueOf(order['id']);
    final seller = asMap(order['seller']);
    final sellerName = valueOf(seller['name']);
    final createdAt = DateTime.tryParse(valueOf(order['created_at']));
    final dateLabel = createdAt == null
        ? 'Date unavailable'
        : MaterialLocalizations.of(
            context,
          ).formatMediumDate(createdAt.toLocal());
    final total = double.tryParse(valueOf(order['total_amount'])) ?? 0;

    return Card(
      margin: const EdgeInsets.only(bottom: 9),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        leading: const CircleAvatar(
          backgroundColor: TmcPalette.primarySoft,
          child: Icon(Icons.receipt_long_outlined, color: TmcPalette.primary),
        ),
        title: Text(
          orderNumber.isEmpty ? 'Order $id' : orderNumber,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(sellerName.isEmpty ? dateLabel : '$sellerName · $dateLabel'),
              const SizedBox(height: 4),
              Text(
                peso(total),
                style: const TextStyle(
                  color: TmcPalette.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
        trailing: StatusBadge(valueOf(order['status'])),
        onTap: onTap,
      ),
    );
  }
}

class _StudentAvatar extends StatelessWidget {
  const _StudentAvatar({required this.student, this.size = 84});

  final Student student;
  final double size;

  @override
  Widget build(BuildContext context) {
    final imagePath = student.profilePicture;
    final nameParts = student.name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2);
    final initials = nameParts.map((part) => part[0].toUpperCase()).join();
    final fallback = CircleAvatar(
      radius: size / 2,
      backgroundColor: TmcPalette.paleBlue,
      child: Text(
        initials.isEmpty ? 'T' : initials,
        style: const TextStyle(
          color: TmcPalette.deepNavy,
          fontSize: 24,
          fontWeight: FontWeight.w900,
        ),
      ),
    );

    if (imagePath == null || imagePath.isEmpty) return fallback;
    final url = ApiService.imageUrlFor(imagePath);
    if (url.isEmpty) return fallback;

    return Semantics(
      label: 'Profile photo for ${student.name}',
      child: ClipOval(
        child: Image.network(
          url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => fallback,
        ),
      ),
    );
  }
}

class ReportsPage extends StatefulWidget {
  const ReportsPage({super.key});
  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  late Future<dynamic> _reports;
  @override
  void initState() {
    super.initState();
    _reports = context.read<ApiService>().get('/complaints');
  }

  void _reload() =>
      setState(() => _reports = context.read<ApiService>().get('/complaints'));

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My reports')),
    body: FutureBuilder<dynamic>(
      future: _reports,
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
        final rows = listFrom(snapshot.data, 'complaints');
        if (rows.isEmpty) {
          return const EmptyMessage(
            icon: Icons.flag_outlined,
            title: 'No reports yet',
            message:
                'Reports you submit about marketplace listings will appear here.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: rows.length,
          separatorBuilder: (_, _) => const SizedBox(height: 9),
          itemBuilder: (context, index) {
            final report = asMap(rows[index]);
            final subject = valueOf(report['subject']);
            final status = valueOf(report['status']);
            return Card(
              child: ListTile(
                leading: const Icon(
                  Icons.flag_outlined,
                  color: TmcPalette.navyBlue,
                ),
                title: Text(
                  subject.isEmpty ? 'Report' : subject,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  valueOf(report['description']),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: StatusBadge(status),
              ),
            );
          },
        );
      },
    ),
  );
}
