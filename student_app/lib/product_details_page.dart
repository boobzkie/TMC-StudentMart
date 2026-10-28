import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:provider/provider.dart";

import "components.dart";
import "data.dart";
import "profile_page.dart";
import "seller_profile_page.dart";
import "tmc_theme.dart";

String _attributeLabel(String key) => key
    .split("_")
    .map(
      (part) =>
          part.isEmpty ? part : "${part[0].toUpperCase()}${part.substring(1)}",
    )
    .join(" ");

class ProductDetailsPage extends StatefulWidget {
  const ProductDetailsPage({super.key, required this.productId});
  final int productId;

  @override
  State<ProductDetailsPage> createState() => _ProductDetailsPageState();
}

class _ProductDetailsPageState extends State<ProductDetailsPage> {
  late Future<Product> _future;
  ProductVariant? _selectedVariant;
  bool _descriptionExpanded = false;
  final _reviewFormKey = GlobalKey<FormState>();
  final _reviewTitle = TextEditingController();
  final _reviewComment = TextEditingController();
  final List<Map<String, dynamic>> _reviews = [];
  int _reviewPage = 0;
  int _reviewLastPage = 1;
  int _reviewTotal = 0;
  double _averageRating = 0;
  int _selectedRating = 5;
  bool _canReview = false;
  bool _alreadyReviewed = false;
  bool _loadingReviews = true;
  bool _loadingMoreReviews = false;
  bool _submittingReview = false;
  String? _reviewError;
  String _eligibilityMessage =
      "Only students with a completed order confirming receipt can review this product.";

  @override
  void initState() {
    super.initState();
    _future = _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadReviews(reset: true);
    });
  }

  Future<Product> _load() async {
    final response = asMap(
      await context.read<ApiService>().get("/products/${widget.productId}"),
    );
    if (response["success"] == false) {
      throw const ApiException(
        "This product could not be found.",
        statusCode: 404,
      );
    }
    final rawProduct = asMap(response["product"]);
    if (rawProduct.isEmpty) {
      throw const ApiException("Product details are not available.");
    }
    return Product.fromJson(rawProduct);
  }

  void _refresh() {
    setState(() {
      _future = _load();
      _selectedVariant = null;
    });
    _loadReviews(reset: true);
  }

  Future<void> _loadReviews({bool reset = false}) async {
    if (_loadingMoreReviews) return;
    final page = reset ? 1 : _reviewPage + 1;
    setState(() {
      _loadingMoreReviews = true;
      if (reset) {
        _loadingReviews = true;
        _reviewError = null;
      }
    });
    try {
      final response = await context.read<ApiService>().productReviews(
        widget.productId,
        page: page,
      );
      final raw = response["reviews"];
      final next = raw is List
          ? raw
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList()
          : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        if (reset) _reviews.clear();
        _reviews.addAll(next);
        _reviewPage = int.tryParse(valueOf(response["current_page"])) ?? page;
        _reviewLastPage = int.tryParse(valueOf(response["last_page"])) ?? page;
        _reviewTotal =
            int.tryParse(valueOf(response["total"])) ?? _reviews.length;
        _averageRating =
            double.tryParse(valueOf(response["average_rating"])) ?? 0;
        _canReview = response["can_review"] == true;
        _alreadyReviewed = response["already_reviewed"] == true;
        _eligibilityMessage = valueOf(response["eligibility_message"]);
        _loadingReviews = false;
        _reviewError = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _loadingReviews = false;
          _reviewError = error.toString();
        });
      }
    } finally {
      if (mounted) setState(() => _loadingMoreReviews = false);
    }
  }

  Future<void> _submitReview() async {
    if (!_reviewFormKey.currentState!.validate()) return;
    setState(() => _submittingReview = true);
    try {
      await context.read<ApiService>().submitProductReview(
        widget.productId,
        rating: _selectedRating,
        title: _reviewTitle.text.trim().isEmpty
            ? null
            : _reviewTitle.text.trim(),
        comment: _reviewComment.text.trim(),
      );
      if (!mounted) return;
      _reviewTitle.clear();
      _reviewComment.clear();
      await _loadReviews(reset: true);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Your verified buyer review was submitted."),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Could not submit review: $error")),
        );
      }
    } finally {
      if (mounted) setState(() => _submittingReview = false);
    }
  }

  @override
  void dispose() {
    _reviewTitle.dispose();
    _reviewComment.dispose();
    super.dispose();
  }

  Future<void> _chooseVariant(Product product) async {
    _selectedVariant = await showModalBottomSheet<ProductVariant>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Choose an option",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: TmcPalette.text,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                "Each option has its own available stock.",
                style: TextStyle(fontSize: 13, color: TmcPalette.textMuted),
              ),
              const SizedBox(height: 12),
              ...product.variants.map(
                (variant) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  enabled: variant.stockQuantity > 0,
                  title: Text(
                    variant.label,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    variant.attributes.entries
                        .map((entry) => "${entry.key}: ${entry.value}")
                        .join(" \u00b7 "),
                  ),
                  trailing: Text(
                    variant.stockQuantity > 0
                        ? "${variant.stockQuantity} available"
                        : "Sold out",
                    style: TextStyle(
                      color: variant.stockQuantity > 0
                          ? TmcPalette.textMuted
                          : TmcPalette.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  onTap: variant.stockQuantity > 0
                      ? () => Navigator.pop(sheetContext, variant)
                      : null,
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
    if (!mounted) return;
    setState(() {});
  }

  Future<void> _addToCart(Product product) async {
    if (_selectedVariant == null && product.variants.isNotEmpty) {
      await _chooseVariant(product);
      if (!mounted) return;
    }
    if (_selectedVariant != null && _selectedVariant!.stockQuantity <= 0) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("This option is sold out.")));
      return;
    }
    try {
      final added = await context.read<CartState>().add(
        product,
        variant: _selectedVariant,
        currentUserId: context.read<AuthState>().user!.id,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            added
                ? "Added ${_selectedVariant?.label ?? product.name} to your cart."
                : "This listing is no longer available or has reached its stock limit.",
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Product>(
      future: _future,
      builder: (context, snapshot) {
        final product = snapshot.data;
        return Scaffold(
          appBar: AppBar(
            title: const Text("Product details"),
            actions: [
              Consumer<CartState>(
                builder: (context, cart, _) => IconButton(
                  tooltip: cart.itemCount > 0
                      ? "Cart, ${cart.itemCount} items"
                      : "Cart",
                  onPressed: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(builder: (_) => const CartPage()),
                  ),
                  icon: Badge(
                    isLabelVisible: cart.itemCount > 0,
                    label: Text(
                      cart.itemCount > 99 ? "99+" : "${cart.itemCount}",
                    ),
                    child: const Icon(Icons.shopping_cart_outlined),
                  ),
                ),
              ),
            ],
          ),
          body: snapshot.connectionState != ConnectionState.done
              ? const Center(child: CircularProgressIndicator())
              : snapshot.hasError
              ? ErrorMessage(
                  message: snapshot.error.toString(),
                  onRetry: _refresh,
                )
              : product == null
              ? ErrorMessage(
                  message: "Product details are not available.",
                  onRetry: _refresh,
                )
              : _buildProductView(context, product),
          bottomNavigationBar:
              snapshot.connectionState == ConnectionState.done &&
                  !snapshot.hasError &&
                  product != null
              ? _purchaseBar(product)
              : null,
        );
      },
    );
  }

  Widget _buildProductView(BuildContext context, Product product) {
    final soldOut =
        product.status.toLowerCase() == "sold_out" ||
        product.stockQuantity <= 0;
    final summary = _productSummary(product, soldOut);
    final buyingDetails = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sellerCard(product),
        if (product.sellerContactNumber.isNotEmpty) ...[
          const SizedBox(height: 10),
          TmcPanel(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.phone_outlined, color: TmcPalette.primary),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    "Seller-shared contact: ${product.sellerContactNumber}",
                  ),
                ),
              ],
            ),
          ),
        ],
        if (product.variants.isNotEmpty) ...[
          const SizedBox(height: 14),
          _variantsSection(product, soldOut),
        ],
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => Navigator.of(context).push<void>(
            MaterialPageRoute<void>(
              builder: (_) => ReportProductPage(product: product),
            ),
          ),
          icon: const Icon(Icons.flag_outlined),
          label: const Text("Report this listing"),
        ),
      ],
    );
    final productContent = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (product.attributes.values.any((value) => value.trim().isNotEmpty))
          _attributesSection(product),
        _descriptionSection(product),
        _reviewsSection(),
        _relatedProducts(product),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 900;
        final imageHeight = wide
            ? 480.0
            : (constraints.maxWidth * .86).clamp(280, 390).toDouble();
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1280),
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                wide ? 24 : 16,
                16,
                wide ? 24 : 16,
                24,
              ),
              children: [
                if (wide)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: ProductGallery(
                          product: product,
                          height: imageHeight,
                        ),
                      ),
                      const SizedBox(width: 24),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            summary,
                            const SizedBox(height: 16),
                            buyingDetails,
                          ],
                        ),
                      ),
                    ],
                  )
                else ...[
                  ProductGallery(product: product, height: imageHeight),
                  const SizedBox(height: 16),
                  summary,
                  const SizedBox(height: 14),
                  buyingDetails,
                ],
                const SizedBox(height: 22),
                productContent,
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _productSummary(Product product, bool soldOut) => TmcPanel(
    padding: const EdgeInsets.all(18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: TmcPalette.primarySoft,
            borderRadius: BorderRadius.circular(TmcRadius.pill),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
            child: Text(
              product.category.isEmpty
                  ? "Marketplace listing"
                  : product.category,
              style: const TextStyle(
                color: TmcPalette.primary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          product.name,
          style: const TextStyle(
            fontSize: 23,
            height: 1.2,
            fontWeight: FontWeight.w900,
            color: TmcPalette.deepNavy,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _reviewTotal > 0
                  ? Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 5,
                      children: [
                        const Icon(
                          Icons.star_rounded,
                          size: 18,
                          color: TmcPalette.warning,
                        ),
                        Text(
                          _averageRating.toStringAsFixed(1),
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        Text("($_reviewTotal verified reviews)"),
                      ],
                    )
                  : const Text(
                      "No verified reviews yet",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: TmcPalette.textMuted,
                        fontSize: 13,
                      ),
                    ),
            ),
            IconButton(
              tooltip: "Refresh product details",
              onPressed: _refresh,
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: "Copy product details to share",
              onPressed: () async {
                await Clipboard.setData(
                  ClipboardData(
                    text:
                        "${product.name} · ${peso(product.price)} on TMC StudentMart",
                  ),
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Product details copied.")),
                  );
                }
              },
              icon: const Icon(Icons.share_outlined),
            ),
          ],
        ),
        const Divider(height: 18),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Text(
                peso(product.price),
                style: const TextStyle(
                  fontSize: 28,
                  height: 1.1,
                  fontWeight: FontWeight.w900,
                  color: TmcPalette.primary,
                ),
              ),
            ),
            _stockBadge(product, soldOut),
          ],
        ),
      ],
    ),
  );

  Widget _stockBadge(Product product, bool soldOut) {
    final stock = _selectedVariant?.stockQuantity ?? product.stockQuantity;
    final label = soldOut || stock <= 0 ? "Sold out" : "$stock available";
    final color = soldOut || stock <= 0 ? TmcPalette.error : TmcPalette.success;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: .10),
        borderRadius: BorderRadius.circular(TmcRadius.pill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: TextStyle(color: color, fontWeight: FontWeight.w800),
        ),
      ),
    );
  }

  Widget _descriptionSection(Product product) {
    final description = product.description.trim();
    final longDescription = description.length > 180;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeading("About this product"),
          const SizedBox(height: 8),
          TmcPanel(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  description.isEmpty
                      ? "No description provided."
                      : description,
                  maxLines: longDescription && !_descriptionExpanded ? 4 : null,
                  overflow: longDescription && !_descriptionExpanded
                      ? TextOverflow.ellipsis
                      : TextOverflow.visible,
                  style: const TextStyle(
                    height: 1.55,
                    color: TmcPalette.textMuted,
                  ),
                ),
                if (longDescription)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => setState(
                        () => _descriptionExpanded = !_descriptionExpanded,
                      ),
                      child: Text(
                        _descriptionExpanded ? "Show less" : "Read more",
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

  Widget _attributesSection(Product product) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeading("Product details"),
        const SizedBox(height: 8),
        TmcPanel(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Column(
            children: product.attributes.entries
                .where((entry) => entry.value.trim().isNotEmpty)
                .map(
                  (entry) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 2,
                          child: Text(
                            _attributeLabel(entry.key),
                            style: const TextStyle(color: TmcPalette.textMuted),
                          ),
                        ),
                        Expanded(
                          flex: 3,
                          child: Text(
                            entry.value,
                            textAlign: TextAlign.end,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
        ),
      ],
    ),
  );

  Widget _variantsSection(Product product, bool soldOut) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const SectionHeading("Options"),
      const SizedBox(height: 6),
      TmcPanel(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          children: product.variants.map((variant) {
            final selected = _selectedVariant?.id == variant.id;
            return CheckboxListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 7),
              title: Text(variant.label),
              subtitle: Text(
                variant.attributes.entries
                    .map((entry) => "${entry.key}: ${entry.value}")
                    .join(" · "),
              ),
              value: selected,
              onChanged: soldOut || variant.stockQuantity <= 0
                  ? null
                  : (value) {
                      if (value == true) {
                        setState(() => _selectedVariant = variant);
                      }
                    },
              secondary: Text(
                variant.stockQuantity > 0
                    ? "${variant.stockQuantity} left"
                    : "Sold out",
                style: TextStyle(
                  color: variant.stockQuantity > 0
                      ? TmcPalette.textMuted
                      : TmcPalette.error,
                  fontSize: 12,
                ),
              ),
            );
          }).toList(),
        ),
      ),
    ],
  );

  Widget _purchaseBar(Product product) {
    final userId = context.watch<AuthState>().user?.id ?? 0;
    final soldOut =
        product.status.toLowerCase() == "sold_out" ||
        product.stockQuantity <= 0 ||
        (_selectedVariant != null && _selectedVariant!.stockQuantity <= 0);
    final ownListing = isOwnProduct(product, userId);
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        decoration: const BoxDecoration(
          color: TmcPalette.white,
          border: Border(top: BorderSide(color: TmcPalette.border)),
          boxShadow: [
            BoxShadow(
              color: Color(0x14001D39),
              blurRadius: 12,
              offset: Offset(0, -3),
            ),
          ],
        ),
        child: SizedBox(
          height: 48,
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: ownListing || soldOut ? null : () => _addToCart(product),
            icon: const Icon(Icons.add_shopping_cart_outlined),
            label: Text(
              ownListing
                  ? "Your listing"
                  : soldOut
                  ? "Sold out"
                  : product.variants.isNotEmpty && _selectedVariant == null
                  ? "Choose option"
                  : "Add to cart",
            ),
          ),
        ),
      ),
    );
  }

  Widget _relatedProducts(Product product) {
    final available = context
        .watch<MarketplaceState>()
        .products
        .where((item) => item.id != product.id && item.status == "active")
        .toList();
    bool matchesCategory(Product item) => product.categoryId != null
        ? item.categoryId == product.categoryId
        : product.category.isNotEmpty && item.category == product.category;
    available.sort((a, b) {
      final aMatches = matchesCategory(a);
      final bMatches = matchesCategory(b);
      return (bMatches ? 1 : 0).compareTo(aMatches ? 1 : 0);
    });
    final related = available.take(8).toList();
    if (related.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeading("You may also like"),
        const SizedBox(height: 8),
        SizedBox(
          height: 238,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: related.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final item = related[index];
              return SizedBox(
                width: 164,
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  margin: EdgeInsets.zero,
                  child: InkWell(
                    onTap: () => Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) => ProductDetailsPage(productId: item.id),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ProductPhoto(product: item, height: 142),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(10, 9, 10, 6),
                          child: Text(
                            item.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Text(
                            peso(item.price),
                            style: const TextStyle(
                              color: TmcPalette.primary,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _sellerCard(Product product) {
    final name = product.sellerName.isEmpty
        ? "TMC Student Seller"
        : product.sellerName;
    final username = product.sellerUsername.isEmpty
        ? "student${product.userId}"
        : product.sellerUsername;
    final course = product.sellerCourse.isEmpty
        ? "TMC Student"
        : product.sellerCourse;
    return InkWell(
      onTap: product.userId <= 0
          ? null
          : () {
              Navigator.of(context).push<void>(
                MaterialPageRoute<void>(
                  builder: (_) => SellerProfilePage(
                    sellerId: product.userId,
                    onOpenProduct: (item) => Navigator.of(context).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) => ProductDetailsPage(productId: item.id),
                      ),
                    ),
                  ),
                ),
              );
            },
      child: TmcPanel(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            _profileAvatar(name, product.sellerProfilePicture, 48),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text(
                    "@$username · $course",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: TmcPalette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: TmcPalette.primary),
          ],
        ),
      ),
    );
  }

  Widget _reviewsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeading("Verified buyer reviews"),
        if (_loadingReviews && _reviews.isEmpty)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_reviewError != null && _reviews.isEmpty)
          ErrorMessage(
            message: _reviewError!,
            onRetry: () => _loadReviews(reset: true),
          )
        else ...[
          TmcPanel(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.star, color: TmcPalette.warning),
                const SizedBox(width: 6),
                Text(
                  _averageRating > 0 ? _averageRating.toStringAsFixed(1) : "—",
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(child: Text("$_reviewTotal verified reviews")),
                _stars(_averageRating.round()),
              ],
            ),
          ),
          const SizedBox(height: 8),
          if (_canReview)
            _reviewForm()
          else
            TmcPanel(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    _alreadyReviewed
                        ? Icons.verified_outlined
                        : Icons.lock_outline,
                    color: TmcPalette.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _eligibilityMessage.isEmpty
                          ? "Only buyers with a completed order can review this product."
                          : _eligibilityMessage,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 8),
          if (_reviews.isEmpty)
            const EmptyMessage(
              icon: Icons.rate_review_outlined,
              title: "No reviews yet",
              message:
                  "Verified buyers can review after their order is completed.",
            )
          else
            for (final review in _reviews) ...[
              _reviewCard(review),
              const SizedBox(height: 8),
            ],
          if (_reviewPage < _reviewLastPage)
            Center(
              child: OutlinedButton(
                onPressed: _loadingMoreReviews ? null : () => _loadReviews(),
                child: Text(
                  _loadingMoreReviews ? "Loading…" : "Load more reviews",
                ),
              ),
            ),
        ],
      ],
    );
  }

  Widget _reviewForm() => Form(
    key: _reviewFormKey,
    child: TmcPanel(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Your rating",
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          Row(
            children: [
              for (var rating = 1; rating <= 5; rating++)
                IconButton(
                  tooltip: "$rating stars",
                  onPressed: _submittingReview
                      ? null
                      : () => setState(() => _selectedRating = rating),
                  icon: Icon(
                    rating <= _selectedRating ? Icons.star : Icons.star_border,
                    color: TmcPalette.warning,
                  ),
                ),
            ],
          ),
          TextFormField(
            controller: _reviewTitle,
            maxLength: 120,
            decoration: const InputDecoration(labelText: "Title (optional)"),
          ),
          TextFormField(
            controller: _reviewComment,
            minLines: 3,
            maxLines: 5,
            maxLength: 2000,
            decoration: const InputDecoration(
              labelText: "Your review",
              alignLabelWithHint: true,
            ),
            validator: (value) => value == null || value.trim().length < 3
                ? "Write at least 3 characters."
                : null,
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _submittingReview ? null : _submitReview,
            child: Text(
              _submittingReview ? "Submitting…" : "Submit verified review",
            ),
          ),
        ],
      ),
    ),
  );

  Widget _reviewCard(Map<String, dynamic> review) {
    final reviewer = asMap(review["reviewer"]);
    final name = valueOf(reviewer["name"]).isEmpty
        ? "TMC Student"
        : valueOf(reviewer["name"]);
    final rating = int.tryParse(valueOf(review["rating"])) ?? 0;
    final date = DateTime.tryParse(valueOf(review["created_at"]))?.toLocal();
    final dateText = date == null
        ? "Date unavailable"
        : "${date.month}/${date.day}/${date.year}";
    return TmcPanel(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _profileAvatar(name, reviewer["profile_picture"]?.toString(), 40),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      "Verified buyer · $dateText",
                      style: const TextStyle(
                        fontSize: 12,
                        color: TmcPalette.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              _stars(rating),
            ],
          ),
          if (valueOf(review["title"]).isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              valueOf(review["title"]),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
          const SizedBox(height: 4),
          Text(valueOf(review["comment"])),
        ],
      ),
    );
  }

  Widget _profileAvatar(String name, String? path, double size) {
    final initials = name
        .trim()
        .split(RegExp(r"\s+"))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
    final fallback = CircleAvatar(
      radius: size / 2,
      backgroundColor: TmcPalette.paleBlue,
      child: Text(
        initials.isEmpty ? "T" : initials,
        style: TextStyle(
          color: TmcPalette.deepNavy,
          fontSize: size * .28,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
    final url = ApiService.imageUrlFor(path);
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

  Widget _stars(int rating) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var index = 1; index <= 5; index++)
        Icon(
          index <= rating ? Icons.star : Icons.star_border,
          size: 16,
          color: TmcPalette.warning,
        ),
    ],
  );
}

class ReportProductPage extends StatefulWidget {
  const ReportProductPage({super.key, required this.product});
  final Product product;

  @override
  State<ReportProductPage> createState() => _ReportProductPageState();
}

class _ReportProductPageState extends State<ReportProductPage> {
  final _form = GlobalKey<FormState>();
  final _description = TextEditingController();
  String _subject = "Inappropriate product";
  bool _saving = false;
  String? _error;
  static const _subjects = [
    "Inappropriate product",
    "Suspicious listing",
    "Incorrect product information",
    "Seller concern",
  ];

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<ApiService>().post("/complaints", {
        "product_id": widget.product.id,
        "subject": _subject,
        "description": _description.text.trim(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Report submitted to the TMC team.")),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text("Report listing")),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Text(
            'Report “${widget.product.name}”',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 18),
          DropdownButtonFormField<String>(
            initialValue: _subject,
            decoration: const InputDecoration(labelText: "Reason"),
            items: _subjects
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: (value) =>
                setState(() => _subject = value ?? _subjects.first),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _description,
            minLines: 5,
            maxLines: 8,
            maxLength: 5000,
            decoration: const InputDecoration(
              labelText: "Tell us what happened",
              alignLabelWithHint: true,
            ),
            validator: (value) => value == null || value.trim().length < 10
                ? "Please provide at least 10 characters."
                : null,
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          FilledButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const CircularProgressIndicator()
                : const Text("Submit report"),
          ),
        ],
      ),
    ),
  );
}
