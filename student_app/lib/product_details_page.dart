import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "components.dart";
import "data.dart";
import "tmc_theme.dart";

class ProductDetailsPage extends StatefulWidget {
  const ProductDetailsPage({super.key, required this.productId});
  final int productId;

  @override
  State<ProductDetailsPage> createState() => _ProductDetailsPageState();
}

class _ProductDetailsPageState extends State<ProductDetailsPage> {
  late Future<Map<String, dynamic>> _future;
  ProductVariant? _selectedVariant;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final response = asMap(
      await context.read<ApiService>().get("/products/${widget.productId}"),
    );
    if (response["success"] == false) {
      throw const ApiException("This product could not be found.", statusCode: 404);
    }
    return response;
  }

  void _refresh() {
    setState(() {
      _future = _load();
      _selectedVariant = null;
    });
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
                style: TextStyle(
                  fontSize: 13,
                  color: TmcPalette.textMuted,
                ),
              ),
              const SizedBox(height: 12),
              ...product.variants.map((variant) => ListTile(
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
              )),
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("This option is sold out.")),
      );
      return;
    }
    try {
      await context.read<CartState>().add(
        product,
        variant: _selectedVariant,
        currentUserId: context.read<AuthState>().user!.id,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Added ${_selectedVariant?.label ?? product.name} to your cart.",
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
    return Scaffold(
      appBar: AppBar(
        title: const Text("Product details"),
        actions: [
          IconButton(
            tooltip: "Refresh",
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorMessage(
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }
          final data = snapshot.data;
          if (data == null) {
            return ErrorMessage(
              message: "Product details are not available.",
              onRetry: _refresh,
            );
          }
          final product = Product.fromJson(data);
          return _buildProductView(context, product);
        },
      ),
    );
  }



  Widget _buildProductView(BuildContext context, Product product) {
    final soldOut = product.status == "sold_out" ||
        product.stockQuantity <= 0;
    final variants = product.variants;
    final primaryImage = product.images.isNotEmpty
        ? product.images.first.path
        : "";
    final imageUrl = primaryImage.isNotEmpty
        ? ApiService.imageUrlFor(primaryImage)
        : "";

    return ListView(
      children: [
        if (imageUrl.isNotEmpty)
          ClipRRect(
            borderRadius: BorderRadius.circular(TmcRadius.lg),
            child: Image.network(
              imageUrl,
              height: 260,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      product.name,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: TmcPalette.text,
                      ),
                    ),
                  ),
                  if (soldOut)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: TmcPalette.errorSoft,
                        borderRadius: BorderRadius.circular(TmcRadius.pill),
                      ),
                      child: const Text(
                        "Sold out",
                        style: TextStyle(
                          color: TmcPalette.error,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                product.category.isEmpty
                    ? "Marketplace listing"
                    : product.category,
                style: const TextStyle(
                  fontSize: 13,
                  color: TmcPalette.slateBlue,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text(
                    peso(product.price),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: TmcPalette.primary,
                    ),
                  ),
                  const SizedBox(width: 10),
                  if (!soldOut)
                    Text(
                      "${product.stockQuantity} available",
                      style: const TextStyle(
                        fontSize: 13,
                        color: TmcPalette.textMuted,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              const SectionHeading("Description"),
              const SizedBox(height: 6),
              Text(
                product.description.isNotEmpty
                    ? product.description
                    : "No description provided.",
                style: const TextStyle(
                  fontSize: 14,
                  color: TmcPalette.textMuted,
                  height: 1.5,
                ),
              ),

              if (variants.isNotEmpty) ...[
                const SizedBox(height: 18),
                const SectionHeading("Options"),
                const SizedBox(height: 8),
                ...variants.map((variant) {
                  final selected = _selectedVariant?.id == variant.id;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: selected
                            ? TmcPalette.primary
                            : TmcPalette.borderSoft,
                        width: selected ? 2 : 1,
                      ),
                      borderRadius: BorderRadius.circular(TmcRadius.md),
                    ),
                    child: CheckboxListTile(
                      controlAffinity: ListTileControlAffinity.leading,
                      title: Text(
                        variant.label,
                        style: TextStyle(
                          fontWeight: selected
                              ? FontWeight.w800
                              : FontWeight.w600,
                          color: selected
                              ? TmcPalette.primary
                              : TmcPalette.text,
                        ),
                      ),
                      subtitle: Text(
                        variant.attributes.entries
                            .map((entry) =>
                                "${entry.key}: ${entry.value}")
                            .join(" · "),
                        style: const TextStyle(
                          fontSize: 12,
                          color: TmcPalette.textMuted,
                        ),
                      ),
                      value: selected,
                      onChanged: soldOut
                          ? null
                          : (bool? value) {
                              if (value == true) {
                                setState(() {
                                  _selectedVariant = variant;
                                });
                              }
                            },
                      activeColor: TmcPalette.primary,
                      secondary: Text(
                        variant.stockQuantity > 0
                            ? "${variant.stockQuantity} available"
                            : "Sold out",
                        style: TextStyle(
                          color: variant.stockQuantity > 0
                              ? TmcPalette.textMuted
                              : TmcPalette.error,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 12),
                if (_selectedVariant != null &&
                    _selectedVariant!.stockQuantity <= 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: TmcPalette.errorSoft,
                      borderRadius: BorderRadius.circular(TmcRadius.pill),
                    ),
                    child: const Text(
                      "This option is sold out.",
                      style: TextStyle(
                        color: TmcPalette.error,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton.icon(
                  onPressed: soldOut
                      ? null
                      : () => _addToCart(product),
                  icon: const Icon(Icons.shopping_cart_outlined),
                  label: Text(
                    soldOut ? "Sold out" : "Add to cart",
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ],
    );
  }
}
