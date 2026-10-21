import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "components.dart";
import "data.dart";
import "profile_page.dart";
import "product_details_page.dart";
import "tmc_theme.dart";

class CategoriesPage extends StatefulWidget {
  const CategoriesPage({super.key});

  @override
  State<CategoriesPage> createState() => _CategoriesPageState();
}

class _CategoriesPageState extends State<CategoriesPage> {
  ProductCategory? _selected;
  List<ProductCategory> _categories = <ProductCategory>[];
  List<Product> _products = <Product>[];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    setState(() => _loading = true);
    try {
      final response = await context.read<ApiService>().get("/categories");
      if (!mounted) return;
      final raw = response["categories"];
      final categories = raw is List
          ? raw.map((row) => ProductCategory.fromJson(asMap(row))).toList()
          : <ProductCategory>[];
      setState(() {
        _categories = categories;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadProductsForCategory() async {
    if (_selected == null) return;
    setState(() {
      _loading = true;
      _error = null;
      _products = <Product>[];
    });
    try {
      final response = await context.read<ApiService>().get(
        "/products?category=",
      );
      if (!mounted) return;
      final raw = response["products"];
      final products = raw is List
          ? raw.map((row) => Product.fromJson(asMap(row))).toList()
          : <Product>[];
      setState(() {
        _products = products;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _selectCategory(ProductCategory category) {
    setState(() {
      _selected = category;
      _products = <Product>[];
      _error = null;
    });
    _loadProductsForCategory();
  }

  void _showAllCategories() {
    setState(() {
      _selected = null;
      _products = <Product>[];
      _error = null;
    });
  }

  Widget _categoryChip(ProductCategory category) {
    final selected = _selected?.id == category.id;
    return ChoiceChip(
      label: Text(
        category.name,
        style: TextStyle(
          color: selected ? TmcPalette.white : TmcPalette.textMuted,
          fontWeight: FontWeight.w700,
        ),
      ),
      selected: selected,
      onSelected: (_) => _selectCategory(category),
      selectedColor: TmcPalette.primary,
      backgroundColor: TmcPalette.surface,
      labelStyle: const TextStyle(fontSize: 13),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(TmcRadius.pill),
        side: BorderSide(
          color: selected ? TmcPalette.primary : TmcPalette.border,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartCount = context.watch<CartState>().itemCount;
    return Scaffold(
      appBar: AppBar(
        title: const Text("Categories"),
        actions: [
          IconButton(
            tooltip: "Cart",
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute<void>(builder: (_) => const CartPage())),
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text(cartCount > 99 ? "99+" : "$cartCount"),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
          ),
        ],
      ),
      body: _loading && _categories.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _categories.isEmpty
          ? ErrorMessage(message: _error!, onRetry: _loadCategories)
          : Column(
              children: [
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SectionHeading(
                    "Browse by category",
                    action: _selected != null
                        ? TextButton(
                            onPressed: _showAllCategories,
                            child: const Text("View all"),
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 52,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _categories.length,
                    itemBuilder: (context, index) {
                      final category = _categories[index];
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _categoryChip(category),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 14),
                Expanded(
                  child: _selected == null
                      ? _buildCategoryGrid()
                      : _buildProductGrid(),
                ),
              ],
            ),
    );
  }

  Widget _buildCategoryGrid() {
    if (_categories.isEmpty) {
      return const EmptyMessage(
        icon: Icons.category_outlined,
        title: "No categories",
        message:
            "Product categories have not been set up by the TMC Administrator yet.",
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 2.6,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _categories.length,
      itemBuilder: (context, index) {
        final category = _categories[index];
        return Card(
          child: InkWell(
            borderRadius: BorderRadius.circular(TmcRadius.lg),
            onTap: () => _selectCategory(category),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.category_outlined,
                    color: TmcPalette.primary,
                    size: 32,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    category.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: TmcPalette.text,
                    ),
                  ),
                  if (category.description.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      category.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: TmcPalette.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildProductGrid() {
    final title = _selected != null ? _selected!.name : "All products";
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              IconButton(
                tooltip: "Back to categories",
                onPressed: _showAllCategories,
                icon: const Icon(Icons.arrow_back),
                color: TmcPalette.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: TmcPalette.text,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading && _products.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : _products.isEmpty
              ? EmptyMessage(
                  icon: Icons.storefront_outlined,
                  title: "No products",
                  message:
                      "There are no approved products in this category right now.",
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.78,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _products.length,
                  itemBuilder: (context, index) {
                    final product = _products[index];
                    return ProductCard(
                      product: product,
                      isOwnListing:
                          product.userId == context.read<AuthState>().user?.id,
                      onTap: () => Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              ProductDetailsPage(productId: product.id),
                        ),
                      ),
                      onAdd:
                          product.userId !=
                                  context.read<AuthState>().user?.id &&
                              product.status == "active"
                          ? () {
                              context.read<CartState>().add(
                                product,
                                currentUserId: context
                                    .read<AuthState>()
                                    .user!
                                    .id,
                              );
                            }
                          : null,
                    );
                  },
                ),
        ),
      ],
    );
  }
}
