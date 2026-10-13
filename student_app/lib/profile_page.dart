import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'edit_student_profile_page.dart';
import 'orders_page.dart';
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
          entry.quantity > entry.product.stockQuantity,
    )) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'One or more items are no longer available in that quantity. Refresh the marketplace and update your cart.',
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
      final response = asMap(
        await api.post('/orders', {
          ...options,
          'items': cart.entries
              .map(
                (entry) => {
                  'product_id': entry.product.id,
                  'quantity': entry.quantity,
                },
              )
              .toList(),
        }),
      );
      final created = response['orders'];
      final orderCount = created is List ? created.length : 1;
      await cart.clear();
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
                              product.stockQuantity <= 0
                                  ? 'Stock unavailable'
                                  : '${product.stockQuantity} available when added',
                              style: const TextStyle(
                                color: TmcPalette.darkGray,
                                fontSize: 11,
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
                                          product.id,
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
                                          entry.quantity >=
                                              product.stockQuantity
                                      ? null
                                      : () => cart.setQuantity(
                                          product.id,
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
                            : () => cart.setQuantity(product.id, 0),
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

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  Future<void> _logout(BuildContext context) async {
    final okay = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
          'Your sign-in session will be cleared from this device.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (okay != true || !context.mounted) return;
    final cart = context.read<CartState>();
    final auth = context.read<AuthState>();
    await cart.clear();
    await auth.logout();
  }

  @override
  Widget build(BuildContext context) {
    final student = context.watch<AuthState>().user;
    if (student == null) return const SizedBox.shrink();
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        TmcPanel(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              _StudentAvatar(student: student),
              const SizedBox(height: 12),
              Text(
                student.name,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: TmcPalette.deepNavyBlack,
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                student.course.isEmpty ? 'TMC Student' : student.course,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
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
        const SizedBox(height: 16),
        const SectionHeading('Account information'),
        const SizedBox(height: 8),
        _InfoRow(
          icon: Icons.badge_outlined,
          label: 'Student ID',
          value: student.studentId,
        ),
        _InfoRow(
          icon: Icons.email_outlined,
          label: 'Email',
          value: student.email,
        ),
        _InfoRow(
          icon: Icons.phone_outlined,
          label: 'Contact number',
          value: student.contactNumber,
        ),
        _InfoRow(
          icon: Icons.school_outlined,
          label: 'Course / Department',
          value: student.course,
        ),
        Card(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.manage_accounts_outlined),
                title: const Text('Edit profile and privacy'),
                subtitle: const Text('Update contact details and sharing options'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const EditStudentProfilePage(),
                  ),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.receipt_long_outlined),
                title: const Text('My orders'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const OrdersPage()),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.storefront_outlined),
                title: const Text('Orders for my listings'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const OrdersPage(selling: true),
                  ),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: const Text('My reports'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const ReportsPage()),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.logout, color: TmcPalette.error),
                title: const Text(
                  'Sign out',
                  style: TextStyle(
                    color: TmcPalette.error,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () => _logout(context),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StudentAvatar extends StatelessWidget {
  const _StudentAvatar({required this.student});

  final Student student;

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
      radius: 42,
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
          width: 84,
          height: 84,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => fallback,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => TmcPanel(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    child: ListTile(
      leading: Icon(icon, color: TmcPalette.navyBlue),
      title: Text(
        label,
        style: const TextStyle(fontSize: 12, color: TmcPalette.darkGray),
      ),
      subtitle: Text(
        value.isEmpty ? 'Not provided' : value,
        style: const TextStyle(
          color: TmcPalette.deepNavyBlack,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  );
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
