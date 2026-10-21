import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "components.dart";
import "data.dart";
import "product_details_page.dart";
import "tmc_theme.dart";

class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _search = TextEditingController();
  final FocusNode _focus = FocusNode();
  List<Product> _results = <Product>[];
  bool _loading = false;
  String? _error;
  String _lastQuery = "";

  @override
  void dispose() {
    _search.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _searchProducts({required String query}) async {
    if (query.trim().isEmpty) {
      setState(() {
        _results = <Product>[];
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _lastQuery = query.trim();
    });
    try {
      final response = await context.read<ApiService>().get(
        "/products?search=${Uri.encodeComponent(query.trim())}",
      );
      if (!mounted) return;
      final raw = response["products"];
      final products = raw is List
          ? raw.map((row) => Product.fromJson(asMap(row))).toList()
          : <Product>[];
      setState(() {
        _results = products;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSubmitted(String value) {
    if (value.trim().isNotEmpty) {
      _searchProducts(query: value.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const BrandLogo(size: 34),
            const SizedBox(width: 10),
            const Text(
              "Search",
              style: TextStyle(
                color: TmcPalette.text,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: TmcPanel(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
              color: TmcPalette.surface,
              radius: TmcRadius.pill,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _search,
                      focusNode: _focus,
                      autofocus: true,
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: "Search products, sellers, categories",
                        hintStyle: const TextStyle(
                          color: TmcPalette.textSoft,
                          fontSize: 14,
                        ),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                        isCollapsed: true,
                        suffixIcon: _search.text.isNotEmpty
                            ? IconButton(
                                tooltip: "Clear",
                                onPressed: () {
                                  _search.clear();
                                  _focus.requestFocus();
                                  setState(() {
                                    _results = <Product>[];
                                    _error = null;
                                    _lastQuery = "";
                                  });
                                },
                                icon: const Icon(Icons.clear, size: 20),
                              )
                            : null,
                      ),
                      onSubmitted: _onSubmitted,
                    ),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: _loading
                        ? null
                        : () => _onSubmitted(_search.text),
                    child: _loading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text("Search"),
                  ),
                ],
              ),
            ),
          ),

          if (_lastQuery.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: SectionHeading("Search results", action: null),
            ),
          Expanded(
            child: _loading && _results.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : _results.isEmpty
                ? EmptyMessage(
                    icon: Icons.search_off_outlined,
                    title: _error != null
                        ? "Search failed"
                        : _lastQuery.isEmpty
                        ? "Search the marketplace"
                        : "No results for $_lastQuery",
                    message: _error != null
                        ? _error!
                        : _lastQuery.isEmpty
                        ? "Enter a keyword above to find products."
                        : "Try another keyword or browse categories.",
                  )
                : GridView.builder(
                    padding: const EdgeInsets.all(16),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.78,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      final product = _results[index];
                      return ProductCard(
                        product: product,
                        isOwnListing:
                            product.userId ==
                            context.read<AuthState>().user?.id,
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
      ),
    );
  }
}
