import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'product_details_page.dart';
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
                itemCount: products.length,
                onPageChanged: (index) => setState(() => _currentPage = index),
                itemBuilder: (context, index) {
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

class _ImmersiveProductPageState extends State<_ImmersiveProductPage> {
  int _imageIndex = 0;
  bool _savingFollow = false;
  bool? _followingOverride;

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
      return SizedBox.square(
        dimension: 36,
        child: CircularProgressIndicator(
          strokeWidth: 2.2,
          color: TmcPalette.white,
          backgroundColor: Colors.black.withValues(alpha: .35),
        ),
      );
    }

    final status = asMap(snapshot.data);
    if (_apiBoolean(status['is_self'])) {
      return const Text(
        'You',
        style: TextStyle(
          color: TmcPalette.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      );
    }

    final isFollowing =
        _followingOverride ?? _apiBoolean(status['is_following']);
    return _roundFeedButton(
      tooltip: isFollowing ? 'Following seller' : 'Follow seller',
      icon: isFollowing ? Icons.check : Icons.add,
      backgroundColor: isFollowing ? TmcPalette.deepNavy : TmcPalette.primary,
      onPressed: () => _toggleFollow(isFollowing),
    );
  }

  Widget _roundFeedButton({
    required String tooltip,
    required IconData icon,
    required VoidCallback onPressed,
    Color? backgroundColor,
  }) => SizedBox.square(
    dimension: 48,
    child: IconButton.filled(
      tooltip: tooltip,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        fixedSize: const Size(48, 48),
        padding: EdgeInsets.zero,
        backgroundColor: backgroundColor ?? TmcPalette.primary,
        foregroundColor: TmcPalette.white,
        side: const BorderSide(color: TmcPalette.white, width: 1.2),
      ),
      icon: Icon(icon, size: 21),
    ),
  );

  Widget _feedAction({
    required IconData icon,
    required String label,
    required VoidCallback? onPressed,
  }) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      IconButton.filled(
        tooltip: label,
        onPressed: onPressed,
        style: IconButton.styleFrom(
          fixedSize: const Size(44, 44),
          padding: EdgeInsets.zero,
          backgroundColor: Colors.black.withValues(alpha: .45),
          foregroundColor: TmcPalette.white,
          side: BorderSide(color: TmcPalette.white.withValues(alpha: .8)),
        ),
        icon: Icon(icon, size: 21),
      ),
      const SizedBox(height: 2),
      SizedBox(
        width: 76,
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: TmcPalette.white,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            shadows: [Shadow(color: Colors.black54, blurRadius: 5)],
          ),
        ),
      ),
    ],
  );

  Widget _sellerRail(BuildContext context, String sellerName, bool ownListing) {
    final statusFuture = widget.sellerStatus;
    if (ownListing || statusFuture == null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: widget.onOpenSeller,
            customBorder: const CircleBorder(),
            child: _sellerAvatar(sellerName, null, 48),
          ),
          const SizedBox(height: 5),
          SizedBox(
            width: 76,
            child: Text(
              sellerName,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: TmcPalette.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                shadows: [Shadow(color: Colors.black54, blurRadius: 5)],
              ),
            ),
          ),
          if (ownListing) ...[
            const SizedBox(height: 5),
            const Text(
              'Your listing',
              style: TextStyle(
                color: TmcPalette.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      );
    }

    return FutureBuilder<Map<String, dynamic>>(
      future: statusFuture,
      builder: (context, snapshot) {
        final student = asMap(snapshot.data?['student']);
        final displayName = valueOf(student['name']).isEmpty
            ? sellerName
            : valueOf(student['name']);
        final imagePath = student['profile_picture']?.toString();

        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            InkWell(
              onTap: widget.onOpenSeller,
              customBorder: const CircleBorder(),
              child: _sellerAvatar(displayName, imagePath, 48),
            ),
            const SizedBox(height: 4),
            _followControl(snapshot),
            const SizedBox(height: 4),
            InkWell(
              onTap: widget.onOpenSeller,
              child: SizedBox(
                width: 76,
                child: Text(
                  displayName,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: TmcPalette.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 5)],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

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

    return Stack(
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
                            onTap: widget.onOpenSeller,
                            borderRadius: BorderRadius.circular(8),
                            child: Padding(
                              padding: const EdgeInsets.only(top: 3, right: 3),
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
              Positioned(
                right: 8,
                bottom: 12,
                child: SizedBox(
                  width: 78,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _sellerRail(context, sellerName, ownListing),
                      const SizedBox(height: 8),
                      _feedAction(
                        icon: Icons.add_shopping_cart_outlined,
                        label: 'Add to cart',
                        onPressed: canAddToCart
                            ? () => unawaited(widget.onAddToCart())
                            : null,
                      ),
                      const SizedBox(height: 8),
                      _feedAction(
                        icon: Icons.info_outline,
                        label: 'Details',
                        onPressed: widget.onOpenDetails,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
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
  String _category = 'All categories';
  String _sort = 'Recently added';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = context.watch<AuthState>().user?.id ?? 0;
    final state = context.watch<MarketplaceState>();
    final categories =
        state.categories
            .map((category) => category.name)
            .where((name) => name.isNotEmpty)
            .toList()
          ..sort();
    final query = _search.text.trim().toLowerCase();
    final visible = state.products.where((product) {
      final matchesQuery =
          query.isEmpty ||
          product.name.toLowerCase().contains(query) ||
          product.description.toLowerCase().contains(query) ||
          product.category.toLowerCase().contains(query);
      final matchesCategory =
          _category == 'All categories' || product.category == _category;
      return matchesQuery && matchesCategory;
    }).toList();
    if (_sort == 'Price: low to high') {
      visible.sort((first, second) => first.price.compareTo(second.price));
    } else if (_sort == 'Price: high to low') {
      visible.sort((first, second) => second.price.compareTo(first.price));
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            children: [
              TextField(
                controller: _search,
                onChanged: (_) => setState(() {}),
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search products',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _search.text.isEmpty
                      ? null
                      : IconButton(
                          onPressed: () {
                            _search.clear();
                            setState(() {});
                          },
                          icon: const Icon(Icons.close),
                        ),
                ),
              ),
              const SizedBox(height: 9),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue:
                          categories.contains(_category) ||
                              _category == 'All categories'
                          ? _category
                          : 'All categories',
                      isExpanded: true,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.filter_list),
                        labelText: 'Category',
                      ),
                      items: ['All categories', ...categories]
                          .map(
                            (category) => DropdownMenuItem(
                              value: category,
                              child: Text(
                                category,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _category = value ?? 'All categories'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _sort,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.sort),
                        labelText: 'Sort by',
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
                      onChanged: (value) =>
                          setState(() => _sort = value ?? 'Recently added'),
                    ),
                  ),
                ],
              ),
              if (_search.text.trim().isNotEmpty ||
                  _category != 'All categories' ||
                  _sort != 'Recently added')
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () {
                      _search.clear();
                      setState(() {
                        _category = 'All categories';
                        _sort = 'Recently added';
                      });
                    },
                    icon: const Icon(Icons.filter_alt_off_outlined),
                    label: const Text('Clear filters'),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: state.loadProducts,
            child: state.loading && state.products.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : state.error != null && state.products.isEmpty
                ? ErrorMessage(
                    message: state.error!,
                    onRetry: state.loadProducts,
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
                : GridView.builder(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 20),
                    itemCount: visible.length,
                    gridDelegate:
                        const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 270,
                          mainAxisExtent: 292,
                          crossAxisSpacing: 11,
                          mainAxisSpacing: 11,
                        ),
                    itemBuilder: (context, index) => ProductCard(
                      product: visible[index],
                      isOwnListing: isOwnProduct(visible[index], currentUserId),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              ProductDetailsPage(productId: visible[index].id),
                        ),
                      ),
                      onAdd: () async {
                        await _addProductToCart(
                          context,
                          visible[index],
                          currentUserId,
                        );
                      },
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}
