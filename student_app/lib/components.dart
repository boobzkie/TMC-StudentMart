import 'package:flutter/material.dart';

import 'data.dart';
import 'tmc_theme.dart';

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.size = 42});
  final double size;

  @override
  Widget build(BuildContext context) => Image.asset(
    'assets/images/tmc_logo.png',
    width: size,
    height: size,
    fit: BoxFit.contain,
    errorBuilder: (_, _, _) => Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: TmcPalette.deepNavy,
        borderRadius: BorderRadius.circular(size * .28),
      ),
      child: const Text(
        'TMC',
        style: TextStyle(
          color: TmcPalette.white,
          fontSize: 15,
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
  );
}

class TmcPanel extends StatelessWidget {
  const TmcPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color,
    this.radius = TmcRadius.lg,
    this.dark = false,
    this.inset = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  final double radius;
  final bool dark;
  final bool inset;

  @override
  Widget build(BuildContext context) {
    final background = color ?? TmcPalette.white;
    final shadows = inset
        ? TmcNeumorphism.lightInset
        : dark
        ? TmcNeumorphism.darkRaised
        : TmcNeumorphism.lightRaised;

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: (dark ? TmcPalette.paleBlue : TmcPalette.lightGray).withValues(
            alpha: dark ? .18 : .68,
          ),
        ),
        boxShadow: shadows,
      ),
      child: child,
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.action});
  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          title,
          style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
        ),
      ),
      ?action,
    ],
  );
}

class EmptyMessage extends StatelessWidget {
  const EmptyMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(30),
      child: TmcPanel(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: TmcPalette.paleBlue.withValues(alpha: .68),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: TmcPalette.navyBlue, size: 30),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: TmcPalette.deepNavyBlack,
                fontWeight: FontWeight.w800,
                fontSize: 17,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: TmcPalette.darkGray, height: 1.4),
            ),
          ],
        ),
      ),
    ),
  );
}

class ErrorMessage extends StatelessWidget {
  const ErrorMessage({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: TmcPanel(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_outlined,
              color: TmcPalette.error,
              size: 38,
            ),
            const SizedBox(height: 10),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: TmcPalette.deepNavyBlack),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    ),
  );
}

class ProductPhoto extends StatelessWidget {
  const ProductPhoto({
    super.key,
    required this.product,
    this.height = 145,
    this.imagePath,
    this.fit = BoxFit.cover,
  });

  final Product product;
  final double height;
  final String? imagePath;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final url = ApiService.imageUrlFor(imagePath ?? product.image);
    return Container(
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
        color: TmcPalette.paleBlue.withValues(alpha: .7),
        borderRadius: BorderRadius.circular(TmcRadius.md),
      ),
      clipBehavior: Clip.antiAlias,
      child: url.isEmpty
          ? Center(
              child: Icon(
                Icons.shopping_bag_outlined,
                size: 44,
                color: TmcPalette.slateBlue,
              ),
            )
          : Image.network(
              url,
              fit: fit,
              errorBuilder: (_, _, _) => Center(
                child: Icon(
                  Icons.broken_image_outlined,
                  size: 40,
                  color: TmcPalette.slateBlue,
                ),
              ),
              loadingBuilder: (context, child, progress) => progress == null
                  ? child
                  : const Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
            ),
    );
  }
}

class ProductGallery extends StatefulWidget {
  const ProductGallery({super.key, required this.product, this.height = 280});

  final Product product;
  final double height;

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  int _page = 0;

  Future<void> _openViewer(List<ProductImage> images) =>
      Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          fullscreenDialog: true,
          builder: (_) =>
              _ProductImageViewer(images: images, initialPage: _page),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final images = widget.product.images.isNotEmpty
        ? widget.product.images
        : widget.product.image == null || widget.product.image!.isEmpty
        ? const <ProductImage>[]
        : <ProductImage>[ProductImage(path: widget.product.image!)];

    return SizedBox(
      height: widget.height,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(TmcRadius.lg),
        child: Stack(
          children: [
            if (images.length > 1)
              PageView.builder(
                itemCount: images.length,
                onPageChanged: (index) => setState(() => _page = index),
                itemBuilder: (context, index) => ProductPhoto(
                  product: widget.product,
                  imagePath: images[index].path,
                  height: widget.height,
                  fit: BoxFit.contain,
                ),
              )
            else
              ProductPhoto(
                product: widget.product,
                height: widget.height,
                imagePath: images.isEmpty ? null : images.first.path,
                fit: BoxFit.contain,
              ),
            Positioned.fill(
              child: Semantics(
                button: images.isNotEmpty,
                label: 'Open product images full screen',
                child: GestureDetector(
                  key: const ValueKey('product-gallery-open-viewer'),
                  behavior: HitTestBehavior.translucent,
                  onTap: images.isEmpty ? null : () => _openViewer(images),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
            if (images.isNotEmpty)
              Positioned(
                top: 10,
                right: 10,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: .55),
                    borderRadius: BorderRadius.circular(TmcRadius.pill),
                  ),
                  child: const Padding(
                    padding: EdgeInsets.all(7),
                    child: Icon(
                      Icons.zoom_out_map,
                      color: Colors.white,
                      size: 17,
                    ),
                  ),
                ),
              ),
            if (images.length > 1)
              Positioned(
                right: 10,
                bottom: 10,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: .62),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    child: Text(
                      '${_page + 1} / ${images.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProductImageViewer extends StatefulWidget {
  const _ProductImageViewer({required this.images, required this.initialPage});

  final List<ProductImage> images;
  final int initialPage;

  @override
  State<_ProductImageViewer> createState() => _ProductImageViewerState();
}

class _ProductImageViewerState extends State<_ProductImageViewer> {
  late final PageController _controller = PageController(
    initialPage: widget.initialPage,
  );
  late int _page = widget.initialPage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: Colors.black,
    body: SafeArea(
      child: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.images.length,
            onPageChanged: (index) => setState(() => _page = index),
            itemBuilder: (context, index) {
              final url = ApiService.imageUrlFor(widget.images[index].path);
              if (url.isEmpty) {
                return const Center(
                  child: Icon(
                    Icons.broken_image_outlined,
                    color: Colors.white70,
                    size: 52,
                  ),
                );
              }
              return Center(
                child: InteractiveViewer(
                  minScale: 1,
                  maxScale: 4,
                  child: Image.network(
                    url,
                    fit: BoxFit.contain,
                    loadingBuilder: (context, child, progress) =>
                        progress == null
                        ? child
                        : const Center(
                            child: CircularProgressIndicator(
                              color: Colors.white,
                            ),
                          ),
                    errorBuilder: (_, _, _) => const Center(
                      child: Icon(
                        Icons.broken_image_outlined,
                        color: Colors.white70,
                        size: 52,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          Positioned(
            top: 8,
            left: 8,
            child: IconButton(
              tooltip: 'Close image viewer',
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close, color: Colors.white),
            ),
          ),
          Positioned(
            top: 20,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Center(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(TmcRadius.pill),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    child: Text(
                      '${_page + 1} / ${widget.images.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (_page > 0)
            Positioned(
              left: 8,
              top: 0,
              bottom: 0,
              child: Center(
                child: IconButton.filledTonal(
                  tooltip: 'Previous image',
                  onPressed: () => _controller.previousPage(
                    duration: TmcMotion.standard,
                    curve: Curves.easeOut,
                  ),
                  icon: const Icon(Icons.chevron_left),
                ),
              ),
            ),
          if (_page < widget.images.length - 1)
            Positioned(
              right: 8,
              top: 0,
              bottom: 0,
              child: Center(
                child: IconButton.filledTonal(
                  tooltip: 'Next image',
                  onPressed: () => _controller.nextPage(
                    duration: TmcMotion.standard,
                    curve: Curves.easeOut,
                  ),
                  icon: const Icon(Icons.chevron_right),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final color = normalized == 'active'
        ? TmcPalette.success
        : normalized == 'sold_out'
        ? TmcPalette.error
        : normalized == 'archived'
        ? TmcPalette.darkGray
        : normalized == 'pending' || normalized == 'in_review'
        ? TmcPalette.warning
        : normalized == 'rejected' || normalized == 'declined'
        ? TmcPalette.error
        : TmcPalette.slateBlue;
    final label = status.isEmpty
        ? 'Unknown'
        : status
              .replaceAll('_', ' ')
              .split(' ')
              .map(
                (word) => word.isEmpty
                    ? word
                    : word[0].toUpperCase() + word.substring(1),
              )
              .join(' ');
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        border: Border.all(color: color.withValues(alpha: .26)),
        borderRadius: BorderRadius.circular(TmcRadius.pill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    required this.onTap,
    this.onAdd,
    this.isOwnListing = false,
    this.management = false,
    this.imageHeight = 132,
    this.showSeller = false,
    this.showSellerAvatar = false,
    this.showViewAction = false,
    this.onSellerTap,
  });
  final Product product;
  final VoidCallback onTap;
  final VoidCallback? onAdd;
  final bool isOwnListing;
  final bool management;
  final double imageHeight;
  final bool showSeller;
  final bool showSellerAvatar;
  final bool showViewAction;
  final VoidCallback? onSellerTap;

  @override
  Widget build(BuildContext context) {
    final cardRadius = BorderRadius.circular(TmcRadius.lg);
    final soldOut = product.status == 'sold_out' || product.stockQuantity <= 0;
    return Container(
      decoration: BoxDecoration(
        color: TmcPalette.white,
        borderRadius: cardRadius,
        border: Border.all(color: TmcPalette.lightGray.withValues(alpha: .72)),
        boxShadow: TmcNeumorphism.lightRaised,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: cardRadius,
        child: InkWell(
          customBorder: RoundedRectangleBorder(borderRadius: cardRadius),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    ProductPhoto(product: product, height: imageHeight),
                    if (management || product.status == 'sold_out')
                      Positioned(
                        right: 8,
                        top: 8,
                        child: StatusBadge(product.status),
                      ),
                    if (product.images.length > 1)
                      Positioned(
                        left: 8,
                        bottom: 8,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: TmcPalette.deepNavy.withValues(alpha: .86),
                            borderRadius: BorderRadius.circular(TmcRadius.pill),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            child: Text(
                              '${product.images.length} photos',
                              style: const TextStyle(
                                color: TmcPalette.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 9),
                Text(
                  product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: TmcPalette.deepNavyBlack,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  peso(product.price),
                  style: const TextStyle(
                    color: TmcPalette.navyBlue,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  product.category.isEmpty
                      ? 'Marketplace listing'
                      : product.category,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: TmcPalette.darkGray,
                    fontSize: 12,
                  ),
                ),
                if (showSeller && product.sellerName.isNotEmpty) ...[
                  SizedBox(height: showSellerAvatar ? 6 : 3),
                  if (showSellerAvatar)
                    InkWell(
                      onTap: onSellerTap,
                      borderRadius: BorderRadius.circular(TmcRadius.pill),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 2),
                        child: Row(
                          children: [
                            _ProductSellerAvatar(product: product, size: 30),
                            const SizedBox(width: 7),
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
                            if (onSellerTap != null)
                              const Icon(
                                Icons.chevron_right,
                                size: 18,
                                color: TmcPalette.textSoft,
                              ),
                          ],
                        ),
                      ),
                    )
                  else
                    Text(
                      'Sold by ${product.sellerName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.textSoft,
                        fontSize: 12,
                      ),
                    ),
                ],
                if (!management) ...[
                  const SizedBox(height: 2),
                  Text(
                    product.status == 'sold_out'
                        ? 'No units available'
                        : '${product.stockQuantity} available',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: product.status == 'sold_out'
                          ? TmcPalette.error
                          : TmcPalette.darkGray,
                      fontSize: 11,
                    ),
                  ),
                ],
                if (onAdd != null) ...[
                  const Spacer(),
                  const SizedBox(height: 7),
                  if (showViewAction)
                    Row(
                      children: [
                        Expanded(
                          child: TextButton.icon(
                            onPressed: onTap,
                            icon: const Icon(Icons.arrow_forward, size: 17),
                            label: const Text('View'),
                            style: TextButton.styleFrom(
                              minimumSize: const Size(48, 40),
                              foregroundColor: TmcPalette.navyBlue,
                            ),
                          ),
                        ),
                        Tooltip(
                          message: isOwnListing
                              ? 'You cannot purchase your own product.'
                              : soldOut
                              ? 'This product is sold out.'
                              : 'Add this product to your cart.',
                          child: IconButton.filledTonal(
                            onPressed: isOwnListing || soldOut ? null : onAdd,
                            icon: Icon(
                              isOwnListing
                                  ? Icons.storefront_outlined
                                  : soldOut
                                  ? Icons.remove_shopping_cart_outlined
                                  : Icons.add_shopping_cart,
                              size: 18,
                            ),
                            style: IconButton.styleFrom(
                              minimumSize: const Size(42, 40),
                              foregroundColor: TmcPalette.navyBlue,
                              backgroundColor: TmcPalette.primarySoft,
                            ),
                          ),
                        ),
                      ],
                    )
                  else
                    SizedBox(
                      width: double.infinity,
                      child: Tooltip(
                        message: isOwnListing
                            ? 'You cannot purchase your own product.'
                            : soldOut
                            ? 'This product is sold out.'
                            : 'Add this product to your cart.',
                        child: OutlinedButton.icon(
                          onPressed: isOwnListing || soldOut ? null : onAdd,
                          icon: Icon(
                            isOwnListing
                                ? Icons.storefront_outlined
                                : soldOut
                                ? Icons.remove_shopping_cart_outlined
                                : Icons.add_shopping_cart,
                            size: 17,
                          ),
                          label: Text(
                            isOwnListing
                                ? 'Your listing'
                                : soldOut
                                ? 'Sold out'
                                : 'Add to cart',
                          ),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(48, 40),
                            foregroundColor: TmcPalette.navyBlue,
                            visualDensity: VisualDensity.compact,
                          ),
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
}

class _ProductSellerAvatar extends StatelessWidget {
  const _ProductSellerAvatar({required this.product, required this.size});

  final Product product;
  final double size;

  @override
  Widget build(BuildContext context) {
    final nameParts = product.sellerName
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2);
    final initials = nameParts.map((part) => part[0].toUpperCase()).join();
    final fallback = CircleAvatar(
      radius: size / 2,
      backgroundColor: TmcPalette.paleBlue,
      child: Text(
        initials.isEmpty ? 'S' : initials,
        style: TextStyle(
          color: TmcPalette.deepNavy,
          fontSize: size * .28,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
    final path = product.sellerProfilePicture;
    final url = path == null || path.isEmpty
        ? ''
        : ApiService.imageUrlFor(path);
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
}
