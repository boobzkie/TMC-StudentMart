import 'dart:async';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'edit_student_profile_page.dart';
import 'order_details_page.dart';
import 'orders_page.dart';
import 'product_details_page.dart';
import 'seller_profile_page.dart';
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
  bool _editing = false;
  bool _cartRefreshStarted = false;
  bool _refreshingCart = false;
  String? _refreshError;
  CartEntry? _recentlyRemoved;
  Set<String>? _selectedKeys;
  Set<String> _knownEntryKeys = {};
  final Set<int> _unavailableProductIds = {};

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
                  isExpanded: true,
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

  void _scheduleCartRefresh(CartState cart) {
    if (!cart.isLoaded || _cartRefreshStarted) return;
    _cartRefreshStarted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_refreshCartProducts());
    });
  }

  Future<void> _refreshCartProducts() async {
    if (_refreshingCart) return;
    final cart = context.read<CartState>();
    if (cart.entries.isEmpty) {
      if (mounted) {
        setState(() {
          _refreshError = null;
          _refreshingCart = false;
        });
      }
      return;
    }

    setState(() {
      _refreshingCart = true;
      _refreshError = null;
    });
    final unavailable = Set<int>.from(_unavailableProductIds);
    String? refreshError;
    final productIds = cart.entries.map((entry) => entry.product.id).toSet();
    for (final productId in productIds) {
      try {
        final payload = asMap(
          await context.read<ApiService>().get('/products/$productId'),
        );
        final rawProduct = asMap(payload['product']);
        if (payload['success'] == false || rawProduct.isEmpty) {
          unavailable.add(productId);
          continue;
        }
        final product = Product.fromJson(rawProduct);
        if (product.id != productId) {
          unavailable.add(productId);
          continue;
        }
        unavailable.remove(productId);
        await cart.updateProduct(product);
      } on ApiException catch (error) {
        if (error.statusCode == 403 || error.statusCode == 404) {
          unavailable.add(productId);
        } else {
          refreshError ??= error.toString();
        }
      } catch (error) {
        refreshError ??= error.toString();
      }
    }
    if (!mounted) return;
    setState(() {
      _unavailableProductIds
        ..clear()
        ..addAll(unavailable);
      _refreshError = refreshError;
      _refreshingCart = false;
    });
  }

  bool _isEntryAvailable(CartEntry entry, int currentUserId) {
    final product = entry.product;
    if (_unavailableProductIds.contains(product.id) ||
        product.status.toLowerCase() != 'active' ||
        entry.quantity < 1 ||
        entry.availableStock < entry.quantity ||
        isOwnProduct(product, currentUserId)) {
      return false;
    }
    if (product.variants.isEmpty) return entry.variant == null;
    return entry.variant != null &&
        product.variants.any(
          (variant) =>
              variant.id == entry.variant!.id &&
              variant.stockQuantity >= entry.quantity,
        );
  }

  bool _isEntrySelected(CartEntry entry, int currentUserId) =>
      _isEntryAvailable(entry, currentUserId) &&
      (_selectedKeys == null || _selectedKeys!.contains(entry.key));

  void _syncSelectedKeys(List<CartEntry> entries, int currentUserId) {
    final currentKeys = entries.map((entry) => entry.key).toSet();
    if (_selectedKeys != null) {
      _selectedKeys!.removeWhere((key) => !currentKeys.contains(key));
      for (final entry in entries) {
        if (!_knownEntryKeys.contains(entry.key) &&
            _isEntryAvailable(entry, currentUserId)) {
          _selectedKeys!.add(entry.key);
        }
      }
    }
    _knownEntryKeys = currentKeys;
  }

  List<CartEntry> _selectedEntries(
    List<CartEntry> entries,
    int currentUserId,
  ) => entries
      .where((entry) => _isEntrySelected(entry, currentUserId))
      .toList(growable: false);

  void _toggleEntry(
    CartEntry entry,
    bool selected,
    CartState cart,
    int userId,
  ) {
    if (!_isEntryAvailable(entry, userId)) {
      _showMessage('This item is unavailable and cannot be checked out.');
      return;
    }
    final next =
        _selectedKeys ??
        cart.entries
            .where((item) => _isEntryAvailable(item, userId))
            .map((item) => item.key)
            .toSet();
    if (selected) {
      next.add(entry.key);
    } else {
      next.remove(entry.key);
    }
    setState(() => _selectedKeys = next);
  }

  void _toggleGroup(List<CartEntry> entries, CartState cart, int userId) {
    final available = entries
        .where((entry) => _isEntryAvailable(entry, userId))
        .toList(growable: false);
    if (available.isEmpty) return;
    final allSelected = available.every(
      (entry) => _isEntrySelected(entry, userId),
    );
    final next =
        _selectedKeys ??
        cart.entries
            .where((entry) => _isEntryAvailable(entry, userId))
            .map((entry) => entry.key)
            .toSet();
    for (final entry in available) {
      if (allSelected) {
        next.remove(entry.key);
      } else {
        next.add(entry.key);
      }
    }
    setState(() => _selectedKeys = next);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _removeEntry(CartEntry entry, CartState cart) async {
    await cart.setQuantity(entry.key, 0);
    _selectedKeys?.remove(entry.key);
    if (!mounted) return;
    setState(() => _recentlyRemoved = entry);
  }

  Future<void> _restoreEntry(CartEntry entry, CartState cart) async {
    final restored = await cart.restoreEntry(entry);
    if (!mounted) return;
    if (restored) {
      setState(() {
        _selectedKeys?.add(entry.key);
        if (_recentlyRemoved?.key == entry.key) _recentlyRemoved = null;
      });
    } else {
      _showMessage('This item cannot be restored because its stock changed.');
    }
  }

  Widget _buildUndoNotice(CartState cart) {
    final entry = _recentlyRemoved;
    if (entry == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: TmcPanel(
        padding: const EdgeInsets.fromLTRB(12, 4, 6, 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${entry.product.name} removed',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            TextButton.icon(
              onPressed: _placingOrder
                  ? null
                  : () => unawaited(_restoreEntry(entry, cart)),
              icon: const Icon(Icons.undo_rounded, size: 18),
              label: const Text('Undo'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _increaseQuantity(CartEntry entry, CartState cart) async {
    if (entry.quantity >= entry.availableStock) {
      _showMessage(
        'Only ${entry.availableStock} unit(s) are currently available.',
      );
      return;
    }
    await cart.setQuantity(entry.key, entry.quantity + 1);
  }

  Future<void> _placeOrder(
    CartState cart,
    List<CartEntry> selectedEntries,
  ) async {
    if (_placingOrder || selectedEntries.isEmpty) return;
    final student = context.read<AuthState>().user;
    if (student == null) return;

    if (_refreshingCart || _refreshError != null) {
      _showMessage('Refresh your cart items before checkout.');
      return;
    }
    if (selectedEntries.any((entry) => !_isEntryAvailable(entry, student.id))) {
      _showMessage('One or more selected items are no longer available.');
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
      final items = selectedEntries
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
      await cart.removeEntries(selectedEntries.map((entry) => entry.key));
      await cart.completeCheckoutAttempt(
        buyerId: student.id,
        idempotencyKey: idempotencyKey,
      );
      _selectedKeys?.removeAll(selectedEntries.map((entry) => entry.key));
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
      _showMessage(error.toString());
    }
  }

  void _openSellerProfile(int sellerId) {
    if (sellerId <= 0) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => SellerProfilePage(
          sellerId: sellerId,
          onOpenProduct: (product) => Navigator.of(context).push<void>(
            MaterialPageRoute<void>(
              builder: (_) => ProductDetailsPage(productId: product.id),
            ),
          ),
        ),
      ),
    );
  }

  Widget _refreshNotice(CartState cart) {
    final message = cart.loadError ?? _refreshError;
    if (message == null) return const SizedBox.shrink();
    final storageError = cart.loadError != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TmcPanel(
        color: TmcPalette.warningSoft,
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.info_outline, color: TmcPalette.warning),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                storageError
                    ? message
                    : 'Could not confirm current item details. Your cart is saved; retry before checkout.',
                style: const TextStyle(color: TmcPalette.deepNavy),
              ),
            ),
            TextButton(
              onPressed: _refreshingCart
                  ? null
                  : storageError
                  ? cart.load
                  : _refreshCartProducts,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartItem(CartEntry entry, CartState cart, int userId) {
    final product = entry.product;
    final available = _isEntryAvailable(entry, userId);
    final statusMessage =
        _unavailableProductIds.contains(product.id) ||
            product.status.toLowerCase() != 'active'
        ? 'Product is no longer available.'
        : isOwnProduct(product, userId)
        ? 'You cannot order your own listing.'
        : entry.availableStock <= 0
        ? 'Stock is unavailable.'
        : entry.quantity > entry.availableStock
        ? 'Only ${entry.availableStock} unit(s) remain. Reduce the quantity or remove this item.'
        : null;

    return Padding(
      padding: const EdgeInsets.only(top: 9),
      child: TmcPanel(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: _isEntrySelected(entry, userId),
                  onChanged: available && !_placingOrder
                      ? (value) =>
                            _toggleEntry(entry, value ?? false, cart, userId)
                      : null,
                  semanticLabel: 'Select ${product.name}',
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 11),
                    child: Text(
                      product.name,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.deepNavy,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                if (_editing)
                  IconButton(
                    tooltip: 'Remove ${product.name}',
                    onPressed: _placingOrder
                        ? null
                        : () => unawaited(_removeEntry(entry, cart)),
                    icon: const Icon(
                      Icons.delete_outline,
                      color: TmcPalette.error,
                    ),
                  ),
              ],
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 86,
                  height: 86,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(TmcRadius.md),
                    child: ProductPhoto(product: product, height: 86),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.category.isEmpty
                            ? 'Marketplace listing'
                            : product.category,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: TmcPalette.textMuted,
                          fontSize: 12,
                        ),
                      ),
                      if (entry.optionLabel.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          'Option: ${entry.optionLabel}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: TmcPalette.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                      const SizedBox(height: 5),
                      Text(
                        '${peso(product.price)} each',
                        style: const TextStyle(
                          color: TmcPalette.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        statusMessage ??
                            '${entry.availableStock} available for this option',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: available
                              ? TmcPalette.textMuted
                              : TmcPalette.error,
                          fontSize: 12,
                          fontWeight: available
                              ? FontWeight.w400
                              : FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 11),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Subtotal ${peso(entry.subtotal)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: TmcPalette.deepNavy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _QuantityButton(
                  icon: Icons.remove,
                  tooltip: 'Decrease quantity for ${product.name}',
                  onTap: _placingOrder || entry.quantity <= 1
                      ? null
                      : () => unawaited(
                          cart.setQuantity(entry.key, entry.quantity - 1),
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Semantics(
                    label: 'Quantity ${entry.quantity}',
                    child: Text(
                      entry.quantity.toString(),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                _QuantityButton(
                  icon: Icons.add,
                  tooltip: 'Increase quantity for ${product.name}',
                  onTap: _placingOrder || product.status != 'active'
                      ? null
                      : () => unawaited(_increaseQuantity(entry, cart)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSellerGroup(
    int sellerId,
    List<CartEntry> entries,
    CartState cart,
    int userId,
  ) {
    final sellerName = entries.first.product.sellerName.trim().isEmpty
        ? 'TMC Student seller'
        : entries.first.product.sellerName.trim();
    final available = entries
        .where((entry) => _isEntryAvailable(entry, userId))
        .toList(growable: false);
    final selected = available
        .where((entry) => _isEntrySelected(entry, userId))
        .toList(growable: false);
    final allSelected =
        available.isNotEmpty && selected.length == available.length;
    final checkboxValue = allSelected
        ? true
        : selected.isEmpty
        ? false
        : null;
    final sellerSubtotal = selected.fold<double>(
      0,
      (total, entry) => total + entry.subtotal,
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TmcPanel(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                Checkbox(
                  value: checkboxValue,
                  tristate: true,
                  onChanged: available.isEmpty || _placingOrder
                      ? null
                      : (_) => _toggleGroup(entries, cart, userId),
                  semanticLabel: 'Select all items from $sellerName',
                ),
                Expanded(
                  child: TextButton.icon(
                    onPressed: sellerId > 0
                        ? () => _openSellerProfile(sellerId)
                        : null,
                    icon: const Icon(Icons.storefront_outlined, size: 19),
                    label: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        sellerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ),
                if (selected.isNotEmpty)
                  Text(
                    peso(sellerSubtotal),
                    style: const TextStyle(
                      color: TmcPalette.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
              ],
            ),
          ),
          for (final entry in entries) _buildCartItem(entry, cart, userId),
        ],
      ),
    );
  }

  Widget _buildItemList(
    CartState cart,
    int userId,
    Map<int, List<CartEntry>> groupedEntries,
  ) {
    final available = cart.entries
        .where((entry) => _isEntryAvailable(entry, userId))
        .toList(growable: false);
    final selected = _selectedEntries(cart.entries, userId);
    final allSelected =
        available.isNotEmpty && selected.length == available.length;
    final checkboxValue = allSelected
        ? true
        : selected.isEmpty
        ? false
        : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _buildUndoNotice(cart),
        _refreshNotice(cart),
        if (_refreshingCart) ...[
          const LinearProgressIndicator(),
          const SizedBox(height: 10),
        ],
        TmcPanel(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Row(
            children: [
              Checkbox(
                value: checkboxValue,
                tristate: true,
                onChanged: available.isEmpty || _placingOrder
                    ? null
                    : (_) => _toggleGroup(cart.entries, cart, userId),
                semanticLabel: 'Select all available cart items',
              ),
              Expanded(
                child: Text(
                  'Select all available items',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                '${selected.length}/${available.length}',
                style: const TextStyle(
                  color: TmcPalette.textMuted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        if (_editing)
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 9, 4, 0),
            child: Text(
              'Tap a remove icon to delete an item. You can undo each removal.',
              style: TextStyle(color: TmcPalette.textMuted, fontSize: 12),
            ),
          ),
        const SizedBox(height: 14),
        for (final group in groupedEntries.entries)
          _buildSellerGroup(group.key, group.value, cart, userId),
      ],
    );
  }

  Widget _buildSummary(
    CartState cart,
    List<CartEntry> selected,
    int selectedQuantity, {
    required bool compact,
  }) {
    final subtotal = selected.fold<double>(
      0,
      (total, entry) => total + entry.subtotal,
    );
    final blocked =
        _placingOrder ||
        _refreshingCart ||
        _refreshError != null ||
        cart.loadError != null ||
        selected.isEmpty;
    final content = TmcPanel(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Order summary',
            style: TextStyle(
              color: TmcPalette.deepNavy,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: Text('Selected items ($selectedQuantity)')),
              Text(peso(subtotal)),
            ],
          ),
          const SizedBox(height: 9),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 11),
            child: Divider(height: 1),
          ),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Estimated total',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                peso(subtotal),
                style: const TextStyle(
                  color: TmcPalette.primary,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'This estimate uses current listing prices. Pickup and payment arrangements are chosen for the order request. No payment is collected or verified in the app.',
            style: TextStyle(color: TmcPalette.textMuted, fontSize: 12),
          ),
          if (selected.isEmpty && cart.entries.isNotEmpty) ...[
            const SizedBox(height: 8),
            const Text(
              'Select at least one available item to continue.',
              style: TextStyle(color: TmcPalette.textMuted, fontSize: 12),
            ),
          ],
          const SizedBox(height: 13),
          SizedBox(
            height: TmcControlSize.filledButtonHeight,
            child: FilledButton.icon(
              onPressed: blocked ? null : () => _placeOrder(cart, selected),
              icon: _placingOrder
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.shopping_bag_outlined),
              label: Text(
                _placingOrder
                    ? 'Sending order request…'
                    : selectedQuantity > 0
                    ? 'Proceed to Checkout ($selectedQuantity)'
                    : 'Proceed to Checkout',
              ),
            ),
          ),
        ],
      ),
    );

    if (!compact) return content;
    return SafeArea(
      top: false,
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: TmcPalette.pageBackground,
          border: Border(top: BorderSide(color: TmcPalette.border)),
        ),
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
        child: content,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
    final userId = context.watch<AuthState>().user?.id ?? 0;
    final compactLayout = MediaQuery.sizeOf(context).width < 960;
    _syncSelectedKeys(cart.entries, userId);
    _scheduleCartRefresh(cart);
    final selected = _selectedEntries(cart.entries, userId);
    final selectedQuantity = selected.fold<int>(
      0,
      (total, entry) => total + entry.quantity,
    );
    final groupedEntries = <int, List<CartEntry>>{};
    for (final entry in cart.entries) {
      groupedEntries.putIfAbsent(entry.product.userId, () => []).add(entry);
    }
    final summary = _buildSummary(
      cart,
      selected,
      selectedQuantity,
      compact: compactLayout,
    );

    return Scaffold(
      backgroundColor: TmcPalette.pageBackground,
      appBar: AppBar(
        leading: Navigator.of(context).canPop()
            ? IconButton(
                tooltip: 'Back',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded),
              )
            : null,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('My Cart'),
            Text(
              '${cart.itemCount} ${cart.itemCount == 1 ? 'item' : 'items'}',
              style: const TextStyle(
                color: TmcPalette.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        actions: cart.entries.isEmpty || !cart.isLoaded
            ? null
            : [
                TextButton(
                  onPressed: () => setState(() => _editing = !_editing),
                  child: Text(_editing ? 'Done' : 'Edit'),
                ),
              ],
      ),
      bottomNavigationBar:
          compactLayout && cart.isLoaded && cart.entries.isNotEmpty
          ? summary
          : null,
      body: !cart.isLoaded
          ? const Center(child: CircularProgressIndicator())
          : cart.entries.isEmpty
          ? cart.loadError != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: ErrorMessage(
                        message: cart.loadError!,
                        onRetry: cart.load,
                      ),
                    ),
                  )
                : Column(
                    children: [
                      _buildUndoNotice(cart),
                      const Expanded(
                        child: EmptyMessage(
                          icon: Icons.shopping_cart_outlined,
                          title: 'Your cart is empty.',
                          message:
                              'Discover products from fellow students and add your favorites to your cart.',
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                        child: SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed:
                                widget.onBrowse ??
                                () => Navigator.of(context).maybePop(),
                            icon: const Icon(Icons.storefront_outlined),
                            label: const Text('Browse Products'),
                          ),
                        ),
                      ),
                    ],
                  )
          : Builder(
              builder: (context) {
                final list = _buildItemList(cart, userId, groupedEntries);
                if (compactLayout) return list;
                return Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1360),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(flex: 7, child: list),
                          const SizedBox(width: 18),
                          SizedBox(
                            width: 350,
                            child: SingleChildScrollView(child: summary),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _QuantityButton extends StatelessWidget {
  const _QuantityButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: TmcControlSize.minimumTapTarget,
    height: TmcControlSize.minimumTapTarget,
    child: IconButton.filledTonal(
      tooltip: tooltip,
      padding: EdgeInsets.zero,
      onPressed: onTap,
      icon: Icon(icon, size: 18),
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
  late Future<Map<String, dynamic>> _profileSummaryFuture;

  @override
  void initState() {
    super.initState();
    _profileSummaryFuture = _loadProfileSummary();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(context.read<MarketplaceState>().loadMine());
    });
  }

  Future<Map<String, dynamic>> _loadProfileSummary() {
    final studentId = context.read<AuthState>().user?.id ?? 0;
    if (studentId <= 0) return Future.value(const <String, dynamic>{});
    return context.read<ApiService>().sellerProfile(studentId);
  }

  void _refreshProfileSummary() {
    setState(() => _profileSummaryFuture = _loadProfileSummary());
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
    _refreshProfileSummary();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final student = auth.user;
    if (student == null) return const SizedBox.shrink();
    final marketplace = context.watch<MarketplaceState>();
    final listings = marketplace.myProducts;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        _buildProfileCard(student, auth),
        const SizedBox(height: 18),
        TmcPanel(
          padding: const EdgeInsets.all(5),
          radius: TmcRadius.pill,
          child: Row(
            children: [
              Expanded(
                child: _ProfileTab(
                  label: 'My Listings',
                  icon: Icons.storefront_outlined,
                  selected: _selectedTab == 0,
                  onTap: () => _selectTab(0),
                ),
              ),
              Expanded(
                child: _ProfileTab(
                  label: 'My Orders',
                  icon: Icons.shopping_bag_outlined,
                  selected: _selectedTab == 1,
                  onTap: () => _selectTab(1),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        if (_selectedTab == 0)
          _buildListings(marketplace, listings)
        else
          _buildOrders(),
      ],
    );
  }

  Widget _buildProfileCard(Student student, AuthState auth) => Container(
    padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [TmcPalette.primary, TmcPalette.deepNavy],
      ),
      borderRadius: BorderRadius.circular(26),
      boxShadow: TmcNeumorphism.darkRaised,
    ),
    child: Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  padding: const EdgeInsets.all(3),
                  decoration: const BoxDecoration(
                    color: TmcPalette.white,
                    shape: BoxShape.circle,
                  ),
                  child: _StudentAvatar(student: student, size: 90),
                ),
                Positioned(
                  right: -4,
                  bottom: -2,
                  child: IconButton.filledTonal(
                    tooltip: 'Change profile photo',
                    onPressed: auth.savingProfile ? null : _changeProfilePhoto,
                    style: IconButton.styleFrom(
                      minimumSize: const Size(42, 42),
                      backgroundColor: TmcPalette.white,
                      foregroundColor: TmcPalette.primary,
                    ),
                    icon: auth.savingProfile
                        ? const SizedBox.square(
                            dimension: 17,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.camera_alt_outlined, size: 20),
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
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: TmcPalette.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 7),
                  const Row(
                    children: [
                      Icon(
                        Icons.school_outlined,
                        color: TmcPalette.paleBlue,
                        size: 19,
                      ),
                      SizedBox(width: 7),
                      Flexible(
                        child: Text(
                          'TMC Student',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: TmcPalette.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            IconButton.filledTonal(
              tooltip: 'Edit profile',
              onPressed: auth.savingProfile
                  ? null
                  : () => _open(context, const EditStudentProfilePage()),
              style: IconButton.styleFrom(
                minimumSize: const Size(44, 44),
                backgroundColor: TmcPalette.white.withValues(alpha: .14),
                foregroundColor: TmcPalette.white,
              ),
              icon: const Icon(Icons.edit_outlined),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Container(height: 1, color: TmcPalette.white.withValues(alpha: .28)),
        const SizedBox(height: 12),
        FutureBuilder<Map<String, dynamic>>(
          future: _profileSummaryFuture,
          builder: (context, snapshot) {
            final summary = snapshot.data ?? const <String, dynamic>{};
            final following = int.tryParse(valueOf(summary['following_count']));
            final followers = int.tryParse(valueOf(summary['followers_count']));
            final reviewCount =
                int.tryParse(valueOf(summary['reviews_count'])) ?? 0;
            final average = double.tryParse(valueOf(summary['average_rating']));
            final isLoading = snapshot.connectionState != ConnectionState.done;
            final hasError = snapshot.hasError;
            final rating =
                !isLoading && !hasError && reviewCount > 0 && average != null
                ? average.toStringAsFixed(1)
                : '—';

            return Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _ProfileStat(
                        count: isLoading || hasError
                            ? '—'
                            : '${following ?? 0}',
                        label: 'Following',
                        dark: true,
                        onTap: () => _openConnections(false),
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: TmcPalette.white.withValues(alpha: .32),
                    ),
                    Expanded(
                      child: _ProfileStat(
                        count: isLoading || hasError
                            ? '—'
                            : '${followers ?? 0}',
                        label: 'Followers',
                        dark: true,
                        onTap: () => _openConnections(true),
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: TmcPalette.white.withValues(alpha: .32),
                    ),
                    Expanded(
                      child: _ProfileStat(
                        count: rating,
                        label: 'Rating',
                        dark: true,
                        trailing: rating == '—'
                            ? null
                            : const Icon(
                                Icons.star_rounded,
                                color: Color(0xFFFFD15C),
                                size: 20,
                              ),
                      ),
                    ),
                  ],
                ),
                if (hasError)
                  TextButton.icon(
                    onPressed: _refreshProfileSummary,
                    icon: const Icon(Icons.refresh, size: 17),
                    label: const Text('Retry profile stats'),
                    style: TextButton.styleFrom(
                      foregroundColor: TmcPalette.white,
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    ),
  );

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
      return const _ProfileEmptyState(
        icon: Icons.storefront_outlined,
        title: 'Your listings',
        message: 'Manage the items you’ve posted on StudentMart.',
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
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _ProfileListHeading(
              title: 'Your listings',
              onViewAll: () => _viewAll(context),
            ),
            GridView.builder(
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
                      builder: (_) => ProductDetailsPage(productId: product.id),
                    ),
                  ),
                );
              },
            ),
          ],
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
        return const _ProfileEmptyState(
          icon: Icons.receipt_long_outlined,
          title: 'Your orders',
          message: 'Track your purchases and pickup requests here.',
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ProfileListHeading(
            title: 'Recent orders',
            onViewAll: () => _viewAll(context),
          ),
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

class _ProfileEmptyState extends StatelessWidget {
  const _ProfileEmptyState({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final height = (MediaQuery.sizeOf(context).height * .4)
        .clamp(280.0, 400.0)
        .toDouble();
    return SizedBox(
      height: height,
      child: Center(
        child: Semantics(
          liveRegion: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 104,
                height: 104,
                decoration: BoxDecoration(
                  color: TmcPalette.primarySoft,
                  borderRadius: BorderRadius.circular(30),
                ),
                child: Icon(icon, size: 54, color: TmcPalette.primary),
              ),
              const SizedBox(height: 22),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: TmcPalette.deepNavy,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: TmcPalette.textMuted,
                    fontSize: 15,
                    height: 1.45,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileListHeading extends StatelessWidget {
  const _ProfileListHeading({required this.title, required this.onViewAll});

  final String title;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 6, 0, 10),
    child: Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: TmcPalette.deepNavy,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        TextButton.icon(
          onPressed: onViewAll,
          iconAlignment: IconAlignment.end,
          icon: const Icon(Icons.chevron_right, size: 18),
          label: const Text('View all'),
        ),
      ],
    ),
  );
}

class _ProfileTab extends StatelessWidget {
  const _ProfileTab({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: label,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(TmcRadius.pill),
      child: AnimatedContainer(
        duration: TmcMotion.fast,
        padding: const EdgeInsets.fromLTRB(6, 6, 6, 3),
        decoration: BoxDecoration(
          color: selected ? TmcPalette.white : Colors.transparent,
          borderRadius: BorderRadius.circular(TmcRadius.pill),
          boxShadow: selected ? TmcNeumorphism.lightRaised : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 3),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    size: 22,
                    color: selected ? TmcPalette.primary : TmcPalette.textMuted,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: selected
                            ? TmcPalette.primary
                            : TmcPalette.textMuted,
                        fontSize: 14,
                        fontWeight: selected
                            ? FontWeight.w800
                            : FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              height: 3,
              margin: const EdgeInsets.symmetric(horizontal: 20),
              decoration: BoxDecoration(
                color: selected ? TmcPalette.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(TmcRadius.pill),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({
    required this.count,
    required this.label,
    this.onTap,
    this.dark = false,
    this.trailing,
  });

  final String count;
  final String label;
  final VoidCallback? onTap;
  final bool dark;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Semantics(
    button: onTap != null,
    label: '$count $label',
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(TmcRadius.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    count,
                    style: TextStyle(
                      color: dark ? TmcPalette.white : TmcPalette.deepNavy,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 3),
                    trailing!,
                  ],
                ],
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                color: TmcPalette.paleBlue,
                fontSize: 13,
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
