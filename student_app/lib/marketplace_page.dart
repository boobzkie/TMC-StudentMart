import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'product_details_page.dart';
import 'search_page.dart';
import 'seller_profile_page.dart';
import 'tmc_theme.dart';

Future<void> _addProductToCart(
  BuildContext context,
  Product product,
  int currentUserId,
) async {
  ProductVariant? selectedVariant;
  if (product.variants.isNotEmpty) {
    selectedVariant = await showModalBottomSheet<ProductVariant>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Choose an option',
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              const Text('Each option has its own available stock.'),
              const SizedBox(height: 12),
              for (final variant in product.variants)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  enabled: variant.stockQuantity > 0,
                  title: Text(variant.label),
                  subtitle: Text(
                    variant.attributes.entries
                        .map((entry) => '${entry.key}: ${entry.value}')
                        .join(' · '),
                  ),
                  trailing: Text(
                    variant.stockQuantity > 0
                        ? '${variant.stockQuantity} available'
                        : 'Sold out',
                    style: TextStyle(
                      color: variant.stockQuantity > 0
                          ? TmcPalette.darkGray
                          : TmcPalette.error,
                    ),
                  ),
                  onTap: variant.stockQuantity > 0
                      ? () => Navigator.pop(sheetContext, variant)
                      : null,
                ),
            ],
          ),
        ),
      ),
    );
    if (selectedVariant == null || !context.mounted) return;
  }

  try {
    final added = await context.read<CartState>().add(
      product,
      variant: selectedVariant,
      currentUserId: currentUserId,
    );
    if (!context.mounted) return;
    final message = added
        ? 'Added ${selectedVariant?.label ?? product.name} to your cart.'
        : isOwnProduct(product, currentUserId)
        ? 'You cannot purchase your own product.'
        : product.status != 'active'
        ? 'Product is no longer available.'
        : selectedVariant != null && selectedVariant.stockQuantity <= 0
        ? 'This option is sold out.'
        : 'You have reached the available stock limit.';
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.onOpenMarketplace});
  final VoidCallback onOpenMarketplace;

  @override
  State<HomePage> createState() => _HomePageState();
}

Future<void> _openProductDetails(BuildContext context, Product product) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FractionallySizedBox(
        heightFactor: .94,
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          child: ProductDetailsPage(productId: product.id),
        ),
      ),
    );

class _HomePageState extends State<HomePage> {
  final PageController _feedController = PageController();
  final Map<int, Future<Map<String, dynamic>>> _sellerStatusRequests = {};
  int _currentPage = 0;

  Future<Map<String, dynamic>> _sellerStatusFuture(int sellerId) =>
      _sellerStatusRequests.putIfAbsent(
        sellerId,
        () => context.read<ApiService>().studentFollowStatus(sellerId),
      );

  void _retrySellerStatus(int sellerId) {
    setState(() => _sellerStatusRequests.remove(sellerId));
  }

  void _updateSellerStatus(int sellerId, Map<String, dynamic> status) {
    if (!mounted) return;
    setState(() {
      _sellerStatusRequests[sellerId] = Future<Map<String, dynamic>>.value(
        status,
      );
    });
  }

  Future<void> _refreshProducts() async {
    await context.read<MarketplaceState>().loadProducts();
    if (!mounted) return;
    setState(() => _currentPage = 0);
    if (_feedController.hasClients) _feedController.jumpToPage(0);
  }

  void _openSellerProfile(Product product) {
    if (product.userId <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Seller profile is unavailable.')),
      );
      return;
    }
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => SellerProfilePage(
          sellerId: product.userId,
          onOpenProduct: (listedProduct) =>
              _openProductDetails(context, listedProduct),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _feedController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = context.watch<AuthState>().user?.id ?? 0;
    final state = context.watch<MarketplaceState>();
    final products = state.products
        .where((product) => product.status.toLowerCase() == 'active')
        .toList(growable: false);
    if (products.isEmpty &&
        state.hasMoreProducts &&
        !state.loadingMoreProducts) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && state.hasMoreProducts && !state.loadingMoreProducts) {
          unawaited(state.loadMoreProducts());
        }
      });
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        if (products.isEmpty) {
          final message = state.loading && state.products.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : state.error != null && state.products.isEmpty
              ? ErrorMessage(
                  message: state.error!,
                  onRetry: () => unawaited(state.loadProducts()),
                )
              : state.loadingMoreProducts && products.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : state.loadMoreProductsError != null && products.isEmpty
              ? ErrorMessage(
                  message: state.loadMoreProductsError!,
                  onRetry: () => unawaited(state.loadMoreProducts()),
                )
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const EmptyMessage(
                      icon: Icons.storefront_outlined,
                      title: 'No active listings yet',
                      message:
                          'Check back later for student listings approved for the marketplace.',
                    ),
                    FilledButton.icon(
                      onPressed: widget.onOpenMarketplace,
                      icon: const Icon(Icons.storefront_outlined),
                      label: const Text('Browse listings'),
                    ),
                  ],
                );

          return RefreshIndicator(
            onRefresh: _refreshProducts,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(height: constraints.maxHeight, child: message),
              ],
            ),
          );
        }

        final activeIndex = _currentPage.clamp(0, products.length - 1).toInt();
        if (activeIndex != _currentPage) {
          _currentPage = activeIndex;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && _feedController.hasClients) {
              _feedController.jumpToPage(activeIndex);
            }
          });
        }

        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1200),
            child: RefreshIndicator(
              onRefresh: _refreshProducts,
              child: PageView.builder(
                controller: _feedController,
                scrollDirection: Axis.vertical,
                physics: const BouncingScrollPhysics(
                  parent: PageScrollPhysics(),
                ),
                itemCount: products.length + (state.hasMoreProducts ? 1 : 0),
                onPageChanged: (index) {
                  setState(() => _currentPage = index);
                  if (index >= products.length - 3 &&
                      state.hasMoreProducts &&
                      !state.loadingMoreProducts) {
                    unawaited(state.loadMoreProducts());
                  }
                },
                itemBuilder: (context, index) {
                  if (index >= products.length) {
                    return _FeedLoadMorePage(
                      loading: state.loadingMoreProducts,
                      error: state.loadMoreProductsError,
                      onRetry: () => unawaited(state.loadMoreProducts()),
                    );
                  }
                  final product = products[index];
                  final isOwnListing = isOwnProduct(product, currentUserId);
                  final followStatus =
                      !isOwnListing &&
                          index == activeIndex &&
                          product.userId > 0
                      ? _sellerStatusFuture(product.userId)
                      : null;

                  return _ImmersiveProductPage(
                    key: ValueKey(product.id),
                    product: product,
                    currentUserId: currentUserId,
                    sellerStatus: followStatus,
                    onRetrySellerStatus: () =>
                        _retrySellerStatus(product.userId),
                    onSellerStatusChanged: (status) =>
                        _updateSellerStatus(product.userId, status),
                    onOpenSeller: () => _openSellerProfile(product),
                    onOpenDetails: () => _openProductDetails(context, product),
                    onAddToCart: () =>
                        _addProductToCart(context, product, currentUserId),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

class _FeedLoadMorePage extends StatelessWidget {
  const _FeedLoadMorePage({
    required this.loading,
    required this.error,
    required this.onRetry,
  });

  final bool loading;
  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (loading || error == null)
          const CircularProgressIndicator()
        else ...[
          const Icon(Icons.cloud_off_outlined, size: 36),
          const SizedBox(height: 8),
          const Text('More listings could not be loaded.'),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Try again'),
          ),
        ],
      ],
    ),
  );
}

class _ImmersiveProductPage extends StatefulWidget {
  const _ImmersiveProductPage({
    super.key,
    required this.product,
    required this.currentUserId,
    required this.sellerStatus,
    required this.onRetrySellerStatus,
    required this.onSellerStatusChanged,
    required this.onOpenSeller,
    required this.onOpenDetails,
    required this.onAddToCart,
  });

  final Product product;
  final int currentUserId;
  final Future<Map<String, dynamic>>? sellerStatus;
  final VoidCallback onRetrySellerStatus;
  final ValueChanged<Map<String, dynamic>> onSellerStatusChanged;
  final VoidCallback onOpenSeller;
  final VoidCallback onOpenDetails;
  final Future<void> Function() onAddToCart;

  @override
  State<_ImmersiveProductPage> createState() => _ImmersiveProductPageState();
}

enum _FeedSpeedDialPhase { closed, animatingOpen, open, animatingClosed }

class _ImmersiveProductPageState extends State<_ImmersiveProductPage>
    with SingleTickerProviderStateMixin {
  static const _speedDialButtonSize = 56.0;
  static const _speedDialGap = 12.0;
  // The Scaffold body already ends above the app's bottom navigation bar.
  static const _speedDialBottomInset = 12.0;

  late final AnimationController _speedDialController;
  _FeedSpeedDialPhase _speedDialPhase = _FeedSpeedDialPhase.closed;
  int _imageIndex = 0;
  bool _savingFollow = false;
  bool _addingToCart = false;
  bool? _followingOverride;
  DateTime? _lastCartActionAt;

  @override
  void initState() {
    super.initState();
    _speedDialController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    )..addStatusListener(_handleSpeedDialAnimationStatus);
  }

  @override
  void dispose() {
    _speedDialController.dispose();
    super.dispose();
  }

  void _handleSpeedDialAnimationStatus(AnimationStatus status) {
    final nextPhase = switch (status) {
      AnimationStatus.completed => _FeedSpeedDialPhase.open,
      AnimationStatus.dismissed => _FeedSpeedDialPhase.closed,
      _ => null,
    };
    if (nextPhase != null && mounted && _speedDialPhase != nextPhase) {
      setState(() => _speedDialPhase = nextPhase);
    }
  }

  bool get _speedDialVisible => _speedDialPhase != _FeedSpeedDialPhase.closed;

  bool get _speedDialTransitioning =>
      _speedDialPhase == _FeedSpeedDialPhase.animatingOpen ||
      _speedDialPhase == _FeedSpeedDialPhase.animatingClosed;

  void _toggleSpeedDial() {
    if (_speedDialTransitioning) return;
    if (_speedDialPhase == _FeedSpeedDialPhase.open) {
      _closeSpeedDial();
      return;
    }
    setState(() => _speedDialPhase = _FeedSpeedDialPhase.animatingOpen);
    _speedDialController.forward(from: 0);
  }

  void _closeSpeedDial() {
    if (_speedDialPhase != _FeedSpeedDialPhase.open) return;
    setState(() => _speedDialPhase = _FeedSpeedDialPhase.animatingClosed);
    _speedDialController.reverse();
  }

  void _openSeller() {
    _closeSpeedDial();
    widget.onOpenSeller();
  }

  void _openDetails() {
    _closeSpeedDial();
    widget.onOpenDetails();
  }

  Future<void> _addProductToCart() async {
    final startedAt = DateTime.now();
    final previousAttempt = _lastCartActionAt;
    if (_addingToCart ||
        (previousAttempt != null &&
            startedAt.difference(previousAttempt) <
                const Duration(milliseconds: 500))) {
      return;
    }

    _lastCartActionAt = startedAt;
    _closeSpeedDial();
    setState(() => _addingToCart = true);
    try {
      await widget.onAddToCart();
    } finally {
      final elapsed = DateTime.now().difference(startedAt);
      final remaining = const Duration(milliseconds: 500) - elapsed;
      if (remaining > Duration.zero) await Future<void>.delayed(remaining);
      if (mounted) setState(() => _addingToCart = false);
    }
  }

  List<String> get _imagePaths {
    final paths = widget.product.images
        .map((image) => image.path)
        .where((path) => path.trim().isNotEmpty)
        .toList(growable: false);
    if (paths.isNotEmpty) return paths;
    final image = widget.product.image;
    return image == null || image.trim().isEmpty ? const [] : [image];
  }

  Future<void> _openImageViewer(List<String> images) async {
    if (images.isEmpty) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => _ProductImageViewer(
          images: images,
          initialIndex: _imageIndex,
          onPageChanged: (index) {
            if (mounted) setState(() => _imageIndex = index);
          },
        ),
      ),
    );
  }

  Future<void> _toggleFollow(bool isFollowing) async {
    setState(() => _savingFollow = true);
    try {
      final status = await context.read<ApiService>().setStudentFollowing(
        widget.product.userId,
        follow: !isFollowing,
      );
      if (!mounted) return;
      setState(() {
        _followingOverride = _apiBoolean(status['is_following']);
      });
      widget.onSellerStatusChanged(status);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update follow status: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _savingFollow = false);
    }
  }

  Widget _followControl(AsyncSnapshot<Map<String, dynamic>> snapshot) {
    if (snapshot.hasError) {
      return _roundFeedButton(
        tooltip: 'Retry loading seller status',
        icon: Icons.refresh,
        onPressed: widget.onRetrySellerStatus,
      );
    }

    if (_savingFollow || snapshot.connectionState != ConnectionState.done) {
      return _roundFeedButton(
        tooltip: 'Loading seller status',
        icon: Icons.add_rounded,
        onPressed: null,
        loading: true,
      );
    }

    final status = asMap(snapshot.data);
    if (_apiBoolean(status['is_self'])) {
      return const SizedBox.shrink();
    }

    final isFollowing =
        _followingOverride ?? _apiBoolean(status['is_following']);
    return _roundFeedButton(
      tooltip: isFollowing ? 'Following seller' : 'Follow seller',
      icon: isFollowing ? Icons.check_rounded : Icons.add_rounded,
      backgroundColor: TmcPalette.followAccent,
      onPressed: () => _toggleFollow(isFollowing),
    );
  }

  Widget _roundFeedButton({
    required String tooltip,
    required IconData icon,
    required VoidCallback? onPressed,
    Color? backgroundColor,
    bool loading = false,
  }) => SizedBox.square(
    dimension: 48,
    child: IconButton.filled(
      tooltip: tooltip,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        fixedSize: const Size(48, 48),
        padding: EdgeInsets.zero,
        backgroundColor: backgroundColor ?? TmcPalette.followAccent,
        foregroundColor: TmcPalette.white,
        side: BorderSide.none,
      ),
      icon: loading
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: TmcPalette.white,
              ),
            )
          : Icon(icon, size: 23),
    ),
  );

  Widget _speedDialAction({
    required IconData icon,
    required String label,
    required VoidCallback? onPressed,
    bool loading = false,
  }) => SizedBox.square(
    dimension: 56,
    child: IconButton(
      tooltip: label,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        fixedSize: const Size(56, 56),
        padding: EdgeInsets.zero,
        foregroundColor: TmcPalette.white,
        overlayColor: TmcPalette.white.withValues(alpha: .14),
      ),
      icon: loading
          ? const SizedBox.square(
              dimension: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: TmcPalette.white,
              ),
            )
          : Icon(icon, size: 25),
    ),
  );

  Widget _sellerRail(BuildContext context, String sellerName, bool ownListing) {
    final statusFuture = widget.sellerStatus;
    if (ownListing || statusFuture == null) {
      return Tooltip(
        message: 'Open seller profile',
        child: InkWell(
          onTap: _openSeller,
          customBorder: const CircleBorder(),
          child: _feedSellerAvatar(
            sellerName,
            widget.product.sellerProfilePicture,
          ),
        ),
      );
    }

    return FutureBuilder<Map<String, dynamic>>(
      future: statusFuture,
      builder: (context, snapshot) {
        final student = asMap(snapshot.data?['student']);
        final displayName = valueOf(student['name']).isEmpty
            ? sellerName
            : valueOf(student['name']);
        final imagePath = valueOf(student['profile_picture']).isEmpty
            ? widget.product.sellerProfilePicture
            : student['profile_picture']?.toString();
        final isSelf = _apiBoolean(snapshot.data?['is_self']);

        return SizedBox(
          width: 88,
          height: 88,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 0,
                top: 0,
                child: Tooltip(
                  message: 'Open seller profile',
                  child: Semantics(
                    button: true,
                    label: 'Open seller profile',
                    child: InkWell(
                      onTap: _openSeller,
                      customBorder: const CircleBorder(),
                      child: _feedSellerAvatar(displayName, imagePath),
                    ),
                  ),
                ),
              ),
              if (!isSelf)
                Positioned(
                  right: -4,
                  bottom: -4,
                  child: _followControl(snapshot),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _feedSellerAvatar(String name, String? imagePath) => Container(
    width: 80,
    height: 80,
    padding: const EdgeInsets.all(2),
    decoration: BoxDecoration(
      color: TmcPalette.white.withValues(alpha: .92),
      shape: BoxShape.circle,
    ),
    child: ClipOval(child: _sellerAvatar(name, imagePath, 76)),
  );

  Widget _productImage(String path) {
    final url = ApiService.imageUrlFor(path);
    if (url.isEmpty) return _fallbackProductImage();
    return Image.network(
      url,
      fit: BoxFit.contain,
      width: double.infinity,
      height: double.infinity,
      loadingBuilder: (context, child, progress) => progress == null
          ? child
          : const ColoredBox(
              color: TmcPalette.deepNavy,
              child: Center(
                child: CircularProgressIndicator(color: TmcPalette.white),
              ),
            ),
      errorBuilder: (_, _, _) => _fallbackProductImage(),
    );
  }

  Widget _fallbackProductImage() => const ColoredBox(
    color: TmcPalette.deepNavy,
    child: Center(
      child: Icon(
        Icons.shopping_bag_outlined,
        color: TmcPalette.white,
        size: 64,
      ),
    ),
  );

  Widget _metaChip(String label, {bool highlighted = false}) => DecoratedBox(
    decoration: BoxDecoration(
      color: highlighted
          ? TmcPalette.tealBlue.withValues(alpha: .9)
          : Colors.black.withValues(alpha: .42),
      borderRadius: BorderRadius.circular(TmcRadius.pill),
      border: Border.all(color: TmcPalette.white.withValues(alpha: .5)),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: TmcPalette.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final ownListing = isOwnProduct(product, widget.currentUserId);
    final sellerName = product.sellerName.trim().isEmpty
        ? 'TMC Student Seller'
        : product.sellerName.trim();
    final images = _imagePaths;
    final condition = product.attributes['condition']?.trim() ?? '';
    final brand = product.attributes['brand']?.trim() ?? '';
    final size = product.attributes['size']?.trim() ?? '';
    final stock = product.stockQuantity;
    final canAddToCart = !ownListing && stock > 0;

    return Focus(
      onKeyEvent: (_, event) {
        if (event is KeyDownEvent &&
            event.logicalKey == LogicalKeyboardKey.escape &&
            _speedDialVisible) {
          _closeSpeedDial();
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (images.isEmpty)
            _fallbackProductImage()
          else
            Semantics(
              button: true,
              label: 'Open product images full screen',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _openImageViewer(images),
                child: PageView.builder(
                  itemCount: images.length,
                  onPageChanged: (index) => setState(() => _imageIndex = index),
                  itemBuilder: (context, index) => _productImage(images[index]),
                ),
              ),
            ),
          const IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: [0, .3, .56, 1],
                  colors: [
                    Color(0x5C001D39),
                    Colors.transparent,
                    Color(0x52001D39),
                    Color(0xF0001020),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Stack(
              children: [
                if (images.length > 1)
                  Positioned(
                    top: 12,
                    left: 14,
                    right: 112,
                    child: Row(
                      children: [
                        for (var index = 0; index < images.length; index++)
                          Expanded(
                            child: Container(
                              height: 3,
                              margin: EdgeInsets.only(
                                right: index == images.length - 1 ? 0 : 5,
                              ),
                              decoration: BoxDecoration(
                                color: index == _imageIndex
                                    ? TmcPalette.white
                                    : TmcPalette.white.withValues(alpha: .4),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                Positioned(
                  left: 12,
                  right: 88,
                  bottom: 12,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.fromLTRB(10, 8, 10, 9),
                        decoration: BoxDecoration(
                          color: const Color(0xD9001426),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: TmcPalette.white.withValues(alpha: .16),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Wrap(
                              spacing: 5,
                              runSpacing: 4,
                              children: [
                                if (product.category.isNotEmpty)
                                  _metaChip(product.category),
                                if (condition.isNotEmpty) _metaChip(condition),
                                if (brand.isNotEmpty) _metaChip(brand),
                                if (size.isNotEmpty) _metaChip('Size $size'),
                              ],
                            ),
                            const SizedBox(height: 5),
                            Text(
                              product.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: TmcPalette.white,
                                fontSize: 17,
                                height: 1.08,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              peso(product.price),
                              style: const TextStyle(
                                color: TmcPalette.white,
                                fontSize: 20,
                                height: 1.1,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            if (product.description.trim().isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                product.description.trim(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: TmcPalette.white,
                                  fontSize: 12,
                                  height: 1.2,
                                ),
                              ),
                            ],
                            const SizedBox(height: 4),
                            Text(
                              stock > 0 ? '$stock available' : 'Out of stock',
                              style: TextStyle(
                                color: stock > 0
                                    ? TmcPalette.paleBlue
                                    : TmcPalette.errorSoft,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            InkWell(
                              onTap: _openSeller,
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  top: 3,
                                  right: 3,
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(
                                      Icons.storefront_outlined,
                                      size: 14,
                                      color: TmcPalette.white,
                                    ),
                                    const SizedBox(width: 4),
                                    Flexible(
                                      child: Text(
                                        'Sold by $sellerName',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: TmcPalette.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (_speedDialVisible)
                  Positioned.fill(
                    child: AnimatedBuilder(
                      animation: _speedDialController,
                      builder: (context, _) {
                        final progress = Curves.easeOutCubic.transform(
                          _speedDialController.value,
                        );
                        return GestureDetector(
                          key: const ValueKey('feed-speed-dial-backdrop'),
                          behavior: HitTestBehavior.opaque,
                          onTap: _closeSpeedDial,
                          child: BackdropFilter(
                            filter: ImageFilter.blur(
                              sigmaX: 4 * progress,
                              sigmaY: 4 * progress,
                            ),
                            child: ColoredBox(
                              color: Colors.black.withValues(
                                alpha: .16 * progress,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                Positioned(
                  right: 12,
                  bottom:
                      _speedDialBottomInset +
                      _speedDialButtonSize +
                      _speedDialGap,
                  child: Visibility(
                    visible: _speedDialVisible,
                    maintainState: true,
                    maintainAnimation: true,
                    child: AnimatedBuilder(
                      animation: _speedDialController,
                      builder: (context, child) {
                        final progress = Curves.easeOutCubic.transform(
                          _speedDialController.value,
                        );
                        return IgnorePointer(
                          ignoring: _speedDialPhase != _FeedSpeedDialPhase.open,
                          child: ExcludeSemantics(
                            excluding:
                                _speedDialPhase != _FeedSpeedDialPhase.open,
                            child: Opacity(
                              opacity: progress,
                              child: Transform.translate(
                                offset: Offset(0, 18 * (1 - progress)),
                                child: child,
                              ),
                            ),
                          ),
                        );
                      },
                      child: FocusTraversalGroup(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            _sellerRail(context, sellerName, ownListing),
                            const SizedBox(height: _speedDialGap),
                            _speedDialAction(
                              icon: Icons.add_shopping_cart_outlined,
                              label: 'Add to cart',
                              loading: _addingToCart,
                              onPressed: canAddToCart && !_addingToCart
                                  ? () => unawaited(_addProductToCart())
                                  : null,
                            ),
                            const SizedBox(height: _speedDialGap),
                            _speedDialAction(
                              icon: Icons.info_outline,
                              label: 'Details',
                              onPressed: _openDetails,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 12,
                  bottom: _speedDialBottomInset,
                  child: Semantics(
                    button: true,
                    expanded:
                        _speedDialPhase == _FeedSpeedDialPhase.open ||
                        _speedDialPhase == _FeedSpeedDialPhase.animatingOpen,
                    label: 'Product actions menu',
                    child: SizedBox.square(
                      dimension: _speedDialButtonSize,
                      child: FloatingActionButton(
                        heroTag: 'feed-actions-${product.id}',
                        tooltip: 'Product actions',
                        onPressed: _speedDialTransitioning
                            ? null
                            : _toggleSpeedDial,
                        backgroundColor: TmcPalette.deepNavy,
                        foregroundColor: TmcPalette.white,
                        elevation: 5,
                        child: AnimatedRotation(
                          turns: _speedDialPhase == _FeedSpeedDialPhase.open
                              ? .125
                              : 0,
                          duration: const Duration(milliseconds: 180),
                          child: Icon(
                            _speedDialVisible
                                ? Icons.close_rounded
                                : Icons.more_horiz_rounded,
                            size: 27,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductImageViewer extends StatefulWidget {
  const _ProductImageViewer({
    required this.images,
    required this.initialIndex,
    required this.onPageChanged,
  });

  final List<String> images;
  final int initialIndex;
  final ValueChanged<int> onPageChanged;

  @override
  State<_ProductImageViewer> createState() => _ProductImageViewerState();
}

class _ProductImageViewerState extends State<_ProductImageViewer> {
  late final PageController _controller;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, widget.images.length - 1);
    _controller = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _showPage(int index) {
    if (index < 0 || index >= widget.images.length) return;
    _controller.animateToPage(
      index,
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
    );
  }

  Widget _image(String path) {
    final url = ApiService.imageUrlFor(path);
    if (url.isEmpty) return _imageFallback();
    return Image.network(
      url,
      fit: BoxFit.contain,
      width: double.infinity,
      height: double.infinity,
      loadingBuilder: (context, child, progress) => progress == null
          ? child
          : const Center(
              child: CircularProgressIndicator(color: TmcPalette.white),
            ),
      errorBuilder: (_, _, _) => _imageFallback(),
    );
  }

  Widget _imageFallback() => const Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.broken_image_outlined, color: TmcPalette.white, size: 52),
        SizedBox(height: 8),
        Text(
          'Image unavailable',
          style: TextStyle(color: TmcPalette.white, fontSize: 14),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF050B12),
    body: SafeArea(
      child: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.images.length,
            onPageChanged: (index) {
              setState(() => _currentIndex = index);
              widget.onPageChanged(index);
            },
            itemBuilder: (context, index) => Center(
              child: Semantics(
                image: true,
                label: 'Product image ${index + 1} of ${widget.images.length}',
                child: _image(widget.images[index]),
              ),
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: IconButton.filledTonal(
              tooltip: 'Close image viewer',
              onPressed: () => Navigator.of(context).pop(),
              style: IconButton.styleFrom(
                backgroundColor: Colors.black.withValues(alpha: .55),
                foregroundColor: TmcPalette.white,
                fixedSize: const Size(48, 48),
              ),
              icon: const Icon(Icons.close),
            ),
          ),
          if (widget.images.length > 1) ...[
            Positioned(
              left: 6,
              top: 0,
              bottom: 0,
              child: Center(
                child: IconButton.filledTonal(
                  tooltip: 'Previous image',
                  onPressed: _currentIndex > 0
                      ? () => _showPage(_currentIndex - 1)
                      : null,
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black.withValues(alpha: .48),
                    foregroundColor: TmcPalette.white,
                    disabledForegroundColor: TmcPalette.white.withValues(
                      alpha: .4,
                    ),
                  ),
                  icon: const Icon(Icons.chevron_left),
                ),
              ),
            ),
            Positioned(
              right: 6,
              top: 0,
              bottom: 0,
              child: Center(
                child: IconButton.filledTonal(
                  tooltip: 'Next image',
                  onPressed: _currentIndex < widget.images.length - 1
                      ? () => _showPage(_currentIndex + 1)
                      : null,
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.black.withValues(alpha: .48),
                    foregroundColor: TmcPalette.white,
                    disabledForegroundColor: TmcPalette.white.withValues(
                      alpha: .4,
                    ),
                  ),
                  icon: const Icon(Icons.chevron_right),
                ),
              ),
            ),
            Positioned(
              bottom: 14,
              left: 0,
              right: 0,
              child: Center(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: .58),
                    borderRadius: BorderRadius.circular(TmcRadius.pill),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    child: Text(
                      '${_currentIndex + 1} / ${widget.images.length}',
                      style: const TextStyle(
                        color: TmcPalette.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

bool _apiBoolean(dynamic value) =>
    value == true ||
    valueOf(value).toLowerCase() == '1' ||
    valueOf(value).toLowerCase() == 'true';

Widget _sellerAvatar(String name, String? imagePath, double size) {
  final nameParts = name
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
      style: TextStyle(
        color: TmcPalette.deepNavy,
        fontSize: size * .28,
        fontWeight: FontWeight.w900,
      ),
    ),
  );
  if (imagePath == null || imagePath.isEmpty) return fallback;
  final url = ApiService.imageUrlFor(imagePath);
  if (url.isEmpty) return fallback;
  return ClipOval(
    child: Image.network(
      url,
      width: size,
      height: size,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => fallback,
    ),
  );
}

class MarketplacePage extends StatefulWidget {
  const MarketplacePage({super.key});

  @override
  State<MarketplacePage> createState() => _MarketplacePageState();
}

class _MarketplacePageState extends State<MarketplacePage> {
  final _search = TextEditingController();
  Timer? _filterDebounce;
  String _category = 'All categories';
  String _sort = 'Recently added';
  bool _gridView = true;
  List<Product> _filteredProducts = <Product>[];
  bool _filterLoading = false;
  bool _filterLoadingMore = false;
  String? _filterError;
  String? _filterMoreError;
  int _filterPage = 0;
  int _filterLastPage = 1;
  int _filterRequestGeneration = 0;

  bool get _hasActiveQuery =>
      _search.text.trim().isNotEmpty ||
      _category != 'All categories' ||
      _sort != 'Recently added';

  @override
  void dispose() {
    _filterDebounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  int? _categoryId(MarketplaceState state) {
    if (_category == 'All categories') return null;
    for (final category in state.categories) {
      if (category.name == _category) return category.id;
    }
    return null;
  }

  void _scheduleFilteredProducts({bool debounce = false}) {
    _filterDebounce?.cancel();
    final requestGeneration = ++_filterRequestGeneration;
    if (!_hasActiveQuery) {
      setState(() {
        _filteredProducts = <Product>[];
        _filterLoading = false;
        _filterLoadingMore = false;
        _filterError = null;
        _filterMoreError = null;
        _filterPage = 0;
        _filterLastPage = 1;
      });
      return;
    }
    setState(() {
      _filteredProducts = <Product>[];
      _filterLoading = true;
      _filterLoadingMore = false;
      _filterError = null;
      _filterMoreError = null;
      _filterPage = 0;
      _filterLastPage = 1;
    });
    void load() =>
        unawaited(_loadFilteredProducts(requestGeneration: requestGeneration));
    if (debounce) {
      _filterDebounce = Timer(const Duration(milliseconds: 300), load);
    } else {
      load();
    }
  }

  Future<void> _loadFilteredProducts({
    required int requestGeneration,
    bool append = false,
  }) async {
    if (!mounted || requestGeneration != _filterRequestGeneration) return;
    if (append &&
        (_filterLoading ||
            _filterLoadingMore ||
            _filterPage == 0 ||
            _filterPage >= _filterLastPage)) {
      return;
    }
    final requestedPage = append ? _filterPage + 1 : 1;
    final marketplace = context.read<MarketplaceState>();
    if (append) {
      setState(() {
        _filterLoadingMore = true;
        _filterMoreError = null;
      });
    }
    try {
      final result = await context.read<ApiService>().catalogProducts(
        page: requestedPage,
        search: _search.text,
        category: _category == 'All categories' ? null : _category,
        categoryId: _categoryId(marketplace),
        sort: switch (_sort) {
          'Price: low to high' => 'price_asc',
          'Price: high to low' => 'price_desc',
          _ => 'newest',
        },
      );
      if (!mounted || requestGeneration != _filterRequestGeneration) return;
      final received = result.products.where(
        (product) => product.status == 'active' || product.status == 'sold_out',
      );
      final knownIds = append
          ? _filteredProducts.map((product) => product.id).toSet()
          : <int>{};
      setState(() {
        if (append) {
          _filteredProducts.addAll(
            received.where((product) => knownIds.add(product.id)),
          );
        } else {
          _filteredProducts = received.toList();
        }
        _filterPage = result.currentPage;
        _filterLastPage = result.lastPage;
        _filterError = null;
        _filterMoreError = null;
      });
    } catch (error) {
      if (!mounted || requestGeneration != _filterRequestGeneration) return;
      setState(() {
        if (append) {
          _filterMoreError = error.toString();
        } else {
          _filterError = error.toString();
        }
      });
    } finally {
      if (mounted && requestGeneration == _filterRequestGeneration) {
        setState(() {
          if (append) {
            _filterLoadingMore = false;
          } else {
            _filterLoading = false;
          }
        });
      }
    }
  }

  Future<void> _loadMoreFilteredProducts() => _loadFilteredProducts(
    requestGeneration: _filterRequestGeneration,
    append: true,
  );

  Future<void> _refreshProducts(MarketplaceState marketplace) async {
    _filterDebounce?.cancel();
    if (_hasActiveQuery) {
      final requestGeneration = ++_filterRequestGeneration;
      setState(() {
        _filterLoading = true;
        _filterError = null;
        _filterMoreError = null;
        _filterPage = 0;
        _filterLastPage = 1;
      });
      await _loadFilteredProducts(requestGeneration: requestGeneration);
    } else {
      await marketplace.loadProducts();
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = context.watch<AuthState>().user?.id ?? 0;
    final state = context.watch<MarketplaceState>();
    final categories =
        state.categories
            .map((category) => category.name.trim())
            .where((name) => name.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    final activeFilters = _hasActiveQuery;
    final visible = activeFilters ? _filteredProducts : state.products;
    final isLoading = activeFilters ? _filterLoading : state.loading;
    final error = activeFilters ? _filterError : state.error;
    final hasMore = activeFilters
        ? _filterPage > 0 && _filterPage < _filterLastPage
        : state.hasMoreProducts;
    final loadingMore = activeFilters
        ? _filterLoadingMore
        : state.loadingMoreProducts;
    final moreError = activeFilters
        ? _filterMoreError
        : state.loadMoreProductsError;

    Future<void> loadMore() async {
      if (activeFilters) {
        await _loadMoreFilteredProducts();
      } else {
        await state.loadMoreProducts();
      }
    }

    Widget moreIndicator() {
      if (moreError != null) {
        return Center(
          child: TextButton.icon(
            onPressed: () => unawaited(loadMore()),
            icon: const Icon(Icons.refresh),
            label: const Text('Retry loading products'),
          ),
        );
      }
      return const Center(child: CircularProgressIndicator());
    }

    return LayoutBuilder(
      builder: (context, pageConstraints) => Column(
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1140),
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  pageConstraints.maxWidth < 360 ? 12 : 16,
                  8,
                  pageConstraints.maxWidth < 360 ? 12 : 16,
                  10,
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 52,
                            child: TextField(
                              key: const ValueKey('shop-search-input'),
                              controller: _search,
                              onChanged: (_) {
                                setState(() {});
                                _scheduleFilteredProducts(debounce: true);
                              },
                              textInputAction: TextInputAction.search,
                              decoration: InputDecoration(
                                hintText:
                                    'Search products, sellers, categories…',
                                prefixIcon: const Icon(Icons.search),
                                contentPadding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                                suffixIcon: _search.text.isEmpty
                                    ? null
                                    : IconButton(
                                        tooltip: 'Clear search',
                                        onPressed: () {
                                          _search.clear();
                                          setState(() {});
                                          _scheduleFilteredProducts();
                                        },
                                        icon: const Icon(Icons.close),
                                      ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filledTonal(
                          key: const ValueKey('shop-open-filters'),
                          tooltip: 'More search filters',
                          onPressed: () => Navigator.of(context).push<void>(
                            MaterialPageRoute<void>(
                              builder: (_) => const SearchPage(),
                            ),
                          ),
                          icon: const Icon(Icons.tune),
                          style: IconButton.styleFrom(
                            minimumSize: const Size(48, 48),
                            foregroundColor: TmcPalette.deepNavy,
                            backgroundColor: TmcPalette.white,
                            side: const BorderSide(color: TmcPalette.border),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _categoryChip('All categories'),
                          for (final category in categories)
                            _categoryChip(category),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            key: const ValueKey('shop-sort-select'),
                            initialValue: _sort,
                            isExpanded: true,
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.sort),
                              labelText: 'Sort by',
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 12,
                              ),
                            ),
                            items: const [
                              DropdownMenuItem(
                                value: 'Recently added',
                                child: Text('Recently added'),
                              ),
                              DropdownMenuItem(
                                value: 'Price: low to high',
                                child: Text('Price: low to high'),
                              ),
                              DropdownMenuItem(
                                value: 'Price: high to low',
                                child: Text('Price: high to low'),
                              ),
                            ],
                            onChanged: (value) {
                              setState(() => _sort = value ?? 'Recently added');
                              _scheduleFilteredProducts();
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        _viewButton(
                          label: 'Grid view',
                          key: const ValueKey('shop-grid-view'),
                          icon: Icons.grid_view_rounded,
                          selected: _gridView,
                          onPressed: () => setState(() => _gridView = true),
                        ),
                        const SizedBox(width: 4),
                        _viewButton(
                          label: 'List view',
                          key: const ValueKey('shop-list-view'),
                          icon: Icons.view_list_rounded,
                          selected: !_gridView,
                          onPressed: () => setState(() => _gridView = false),
                        ),
                      ],
                    ),
                    if (activeFilters)
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          key: const ValueKey('shop-clear-filters'),
                          onPressed: () {
                            _search.clear();
                            setState(() {
                              _category = 'All categories';
                              _sort = 'Recently added';
                            });
                            _scheduleFilteredProducts();
                          },
                          icon: const Icon(Icons.filter_alt_off_outlined),
                          label: const Text('Clear filters'),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _refreshProducts(state),
              child: isLoading && visible.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : error != null && visible.isEmpty
                  ? ErrorMessage(
                      message: error,
                      onRetry: () => _refreshProducts(state),
                    )
                  : visible.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        EmptyMessage(
                          icon: Icons.search_off,
                          title: 'No products found',
                          message:
                              'Try another search or category. Only active marketplace listings are shown.',
                        ),
                      ],
                    )
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        final contentWidth = constraints.maxWidth
                            .clamp(0.0, 1140.0)
                            .toDouble();
                        final columns = contentWidth < 540
                            ? 1
                            : contentWidth < 1120
                            ? 2
                            : 3;
                        final cardWidth =
                            (contentWidth - 28 - (columns - 1) * 12) / columns;
                        final imageHeight = (cardWidth * .48)
                            .clamp(150.0, 218.0)
                            .toDouble();
                        return NotificationListener<ScrollNotification>(
                          onNotification: (notification) {
                            if (notification.metrics.extentAfter < 600 &&
                                hasMore &&
                                !loadingMore) {
                              unawaited(loadMore());
                            }
                            return false;
                          },
                          child: Center(
                            child: SizedBox(
                              width: contentWidth,
                              child: _gridView
                                  ? GridView.builder(
                                      key: const ValueKey('shop-product-grid'),
                                      padding: const EdgeInsets.fromLTRB(
                                        14,
                                        2,
                                        14,
                                        20,
                                      ),
                                      itemCount:
                                          visible.length +
                                          ((hasMore ||
                                                  loadingMore ||
                                                  moreError != null)
                                              ? 1
                                              : 0),
                                      gridDelegate:
                                          SliverGridDelegateWithFixedCrossAxisCount(
                                            crossAxisCount: columns,
                                            mainAxisExtent: imageHeight + 220,
                                            crossAxisSpacing: 12,
                                            mainAxisSpacing: 12,
                                          ),
                                      itemBuilder: (context, index) {
                                        if (index >= visible.length) {
                                          return moreIndicator();
                                        }
                                        final product = visible[index];
                                        final ownListing = isOwnProduct(
                                          product,
                                          currentUserId,
                                        );
                                        return ProductCard(
                                          key: ValueKey(
                                            'shop-product-${product.id}',
                                          ),
                                          product: product,
                                          imageHeight: imageHeight,
                                          isOwnListing: ownListing,
                                          showSeller: true,
                                          showSellerAvatar: true,
                                          showViewAction: true,
                                          onSellerTap: product.userId > 0
                                              ? () =>
                                                    _openSellerProfile(product)
                                              : null,
                                          onTap: () => _openProduct(product),
                                          onAdd: () => _addProductToCart(
                                            context,
                                            product,
                                            currentUserId,
                                          ),
                                        );
                                      },
                                    )
                                  : ListView.separated(
                                      key: const ValueKey('shop-product-list'),
                                      padding: const EdgeInsets.fromLTRB(
                                        14,
                                        2,
                                        14,
                                        20,
                                      ),
                                      itemCount:
                                          visible.length +
                                          ((hasMore ||
                                                  loadingMore ||
                                                  moreError != null)
                                              ? 1
                                              : 0),
                                      separatorBuilder: (_, _) =>
                                          const SizedBox(height: 10),
                                      itemBuilder: (context, index) {
                                        if (index >= visible.length) {
                                          return SizedBox(
                                            height: 76,
                                            child: moreIndicator(),
                                          );
                                        }
                                        final product = visible[index];
                                        final ownListing = isOwnProduct(
                                          product,
                                          currentUserId,
                                        );
                                        return _MarketplaceListItem(
                                          key: ValueKey(
                                            'shop-list-product-${product.id}',
                                          ),
                                          product: product,
                                          isOwnListing: ownListing,
                                          onTap: () => _openProduct(product),
                                          onSellerTap: product.userId > 0
                                              ? () =>
                                                    _openSellerProfile(product)
                                              : null,
                                          onAdd: () => _addProductToCart(
                                            context,
                                            product,
                                            currentUserId,
                                          ),
                                        );
                                      },
                                    ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _categoryChip(String label) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 220),
      child: ChoiceChip(
        key: ValueKey('shop-category-$label'),
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        selected: _category == label,
        onSelected: (_) {
          setState(() => _category = label);
          _scheduleFilteredProducts();
        },
        selectedColor: TmcPalette.deepNavy,
        backgroundColor: TmcPalette.white,
        labelStyle: TextStyle(
          color: _category == label ? TmcPalette.white : TmcPalette.deepNavy,
          fontWeight: FontWeight.w700,
        ),
        side: BorderSide(
          color: _category == label ? TmcPalette.deepNavy : TmcPalette.border,
        ),
        showCheckmark: false,
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    ),
  );

  Widget _viewButton({
    required String label,
    required Key key,
    required IconData icon,
    required bool selected,
    required VoidCallback onPressed,
  }) => Semantics(
    button: true,
    selected: selected,
    label: label,
    child: IconButton(
      key: key,
      tooltip: label,
      onPressed: onPressed,
      icon: Icon(icon),
      style: IconButton.styleFrom(
        minimumSize: const Size(44, 48),
        foregroundColor: selected ? TmcPalette.white : TmcPalette.deepNavy,
        backgroundColor: selected ? TmcPalette.deepNavy : TmcPalette.white,
        side: BorderSide(
          color: selected ? TmcPalette.deepNavy : TmcPalette.border,
        ),
      ),
    ),
  );

  void _openProduct(Product product) => Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      builder: (_) => ProductDetailsPage(productId: product.id),
    ),
  );

  void _openSellerProfile(Product product) {
    if (product.userId <= 0) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => SellerProfilePage(
          sellerId: product.userId,
          onOpenProduct: _openProduct,
        ),
      ),
    );
  }
}

class _MarketplaceListItem extends StatelessWidget {
  const _MarketplaceListItem({
    super.key,
    required this.product,
    required this.isOwnListing,
    required this.onTap,
    required this.onAdd,
    this.onSellerTap,
  });

  final Product product;
  final bool isOwnListing;
  final VoidCallback onTap;
  final VoidCallback onAdd;
  final VoidCallback? onSellerTap;

  @override
  Widget build(BuildContext context) {
    final soldOut = product.status == 'sold_out' || product.stockQuantity <= 0;
    final radius = BorderRadius.circular(TmcRadius.lg);
    return Container(
      decoration: BoxDecoration(
        color: TmcPalette.white,
        borderRadius: radius,
        border: Border.all(color: TmcPalette.border),
        boxShadow: TmcNeumorphism.lightRaised,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          customBorder: RoundedRectangleBorder(borderRadius: radius),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 104,
                  child: ProductPhoto(product: product, height: 112),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: TmcPalette.deepNavy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        peso(product.price),
                        style: const TextStyle(
                          color: TmcPalette.primary,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 2),
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
                      const SizedBox(height: 5),
                      if (product.sellerName.isNotEmpty)
                        InkWell(
                          onTap: onSellerTap,
                          borderRadius: BorderRadius.circular(TmcRadius.pill),
                          child: Row(
                            children: [
                              _sellerAvatar(
                                product.sellerName,
                                product.sellerProfilePicture,
                                26,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  product.sellerName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: TmcPalette.text,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              soldOut
                                  ? 'Sold out'
                                  : '${product.stockQuantity} available',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: soldOut
                                    ? TmcPalette.error
                                    : TmcPalette.textMuted,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: onTap,
                            style: TextButton.styleFrom(
                              minimumSize: const Size(48, 40),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                              ),
                            ),
                            child: const Text('View'),
                          ),
                          IconButton(
                            tooltip: isOwnListing
                                ? 'You cannot purchase your own product.'
                                : soldOut
                                ? 'This product is sold out.'
                                : 'Add this product to your cart.',
                            onPressed: isOwnListing || soldOut ? null : onAdd,
                            icon: const Icon(Icons.add_shopping_cart),
                            style: IconButton.styleFrom(
                              minimumSize: const Size(40, 40),
                              foregroundColor: TmcPalette.primary,
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
        ),
      ),
    );
  }
}
