import "dart:async";

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
  final _minPriceInput = TextEditingController();
  final _maxPriceInput = TextEditingController();
  final _focus = FocusNode();
  List<Product> _results = <Product>[];
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;
  String? _loadMoreError;
  String _lastQuery = "";
  String _sort = "Newest";
  String _condition = "Any condition";
  String? _category;
  double? _minPrice;
  double? _maxPrice;
  bool _inStockOnly = false;
  int _requestGeneration = 0;
  int _resultPage = 0;
  int _resultLastPage = 1;
  int _resultTotal = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final marketplace = context.read<MarketplaceState>();
      if (marketplace.categories.isEmpty && !marketplace.categoriesLoading) {
        marketplace.loadCategories();
      }
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _minPriceInput.dispose();
    _maxPriceInput.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _searchProducts({
    required String query,
    bool recordRecentSearch = true,
    bool append = false,
  }) async {
    final normalized = query.trim();
    if (normalized.isEmpty) {
      _resetSearch();
      return;
    }
    if (append &&
        (_loading ||
            _loadingMore ||
            _resultPage == 0 ||
            _resultPage >= _resultLastPage)) {
      return;
    }
    final requestId = append ? _requestGeneration : ++_requestGeneration;
    if (recordRecentSearch) {
      context.read<MarketplaceState>().addRecentSearch(normalized);
    }
    if (append) {
      setState(() {
        _loadingMore = true;
        _loadMoreError = null;
      });
    } else {
      setState(() {
        _loading = true;
        _loadingMore = false;
        _error = null;
        _loadMoreError = null;
        _lastQuery = normalized;
        _results = <Product>[];
        _resultPage = 0;
        _resultLastPage = 1;
        _resultTotal = 0;
      });
      _focus.unfocus();
    }
    try {
      final marketplace = context.read<MarketplaceState>();
      int? categoryId;
      if (_category != null) {
        for (final category in marketplace.categories) {
          if (category.name.toLowerCase() == _category!.toLowerCase()) {
            categoryId = category.id;
            break;
          }
        }
      }
      final result = await context.read<ApiService>().catalogProducts(
        page: append ? _resultPage + 1 : 1,
        search: normalized,
        category: _category,
        categoryId: categoryId,
        minPrice: _minPrice,
        maxPrice: _maxPrice,
        condition: _condition == 'Any condition'
            ? null
            : _condition.toLowerCase(),
        inStockOnly: _inStockOnly,
        sort: switch (_sort) {
          'Price: low to high' => 'price_asc',
          'Price: high to low' => 'price_desc',
          _ => 'newest',
        },
      );
      if (!mounted || requestId != _requestGeneration) return;
      final knownIds = append
          ? _results.map((product) => product.id).toSet()
          : <int>{};
      setState(() {
        if (append) {
          _results.addAll(
            result.products.where((product) => knownIds.add(product.id)),
          );
        } else {
          _results = result.products;
        }
        _resultPage = result.currentPage;
        _resultLastPage = result.lastPage;
        _resultTotal = result.total;
        _error = null;
        _loadMoreError = null;
      });
    } catch (error) {
      if (!mounted || requestId != _requestGeneration) return;
      setState(() {
        if (append) {
          _loadMoreError = error.toString();
        } else {
          _results = <Product>[];
          _error =
              "We couldn't load search results. Check your connection and try again.";
        }
      });
    } finally {
      if (mounted && requestId == _requestGeneration) {
        setState(() {
          if (append) {
            _loadingMore = false;
          } else {
            _loading = false;
          }
        });
      }
    }
  }

  void _onSubmitted(String value) {
    if (!_loading) _searchProducts(query: value);
  }

  void _resetSearch() {
    _requestGeneration++;
    _search.clear();
    _focus.unfocus();
    setState(() {
      _results = <Product>[];
      _loading = false;
      _error = null;
      _loadMoreError = null;
      _lastQuery = "";
      _resultPage = 0;
      _resultLastPage = 1;
      _resultTotal = 0;
      _loadingMore = false;
      _sort = "Newest";
      _clearFilters();
    });
  }

  List<Product> get _visibleResults => _results;

  int get _activeFilterCount =>
      (_category == null ? 0 : 1) +
      (_condition == "Any condition" ? 0 : 1) +
      (_minPrice == null ? 0 : 1) +
      (_maxPrice == null ? 0 : 1) +
      (_inStockOnly ? 1 : 0);

  Iterable<_SearchSuggestion> _suggestions(String input) {
    final query = input.trim().toLowerCase();
    if (query.length < 2) return const <_SearchSuggestion>[];
    final suggestions = <_SearchSuggestion>[];
    final seen = <String>{};
    void add(String label, String subtitle, String type) {
      final key = label.trim().toLowerCase();
      if (key.isEmpty || !key.contains(query) || !seen.add(key)) return;
      suggestions.add(_SearchSuggestion(label, subtitle, type));
    }

    final marketplace = context.read<MarketplaceState>();
    for (final product in marketplace.products) {
      add(product.name, "Product", "product");
      add(product.sellerName, "Seller", "seller");
    }
    for (final category in marketplace.categories) {
      add(category.name, "Category", "category");
    }
    return suggestions.take(6);
  }

  Future<void> _openFilters() async {
    _minPriceInput.text = _minPrice?.toStringAsFixed(2) ?? "";
    _maxPriceInput.text = _maxPrice?.toStringAsFixed(2) ?? "";
    final formKey = GlobalKey<FormState>();
    var category = _category;
    var condition = _condition;
    var inStock = _inStockOnly;
    double? minPrice = _minPrice;
    double? maxPrice = _maxPrice;
    final marketplace = context.read<MarketplaceState>();
    final categories = marketplace.categories.map((item) => item.name).toList();

    final filters = await showModalBottomSheet<_SearchFilterResult>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: TmcPalette.surface,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              8,
              20,
              20 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Form(
              key: formKey,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      "Filters",
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 18),
                    DropdownButtonFormField<String?>(
                      initialValue: category,
                      decoration: const InputDecoration(labelText: "Category"),
                      items: <DropdownMenuItem<String?>>[
                        const DropdownMenuItem<String?>(
                          value: null,
                          child: Text("All categories"),
                        ),
                        ...categories.map(
                          (item) => DropdownMenuItem<String?>(
                            value: item,
                            child: Text(item),
                          ),
                        ),
                      ],
                      onChanged: (value) =>
                          setSheetState(() => category = value),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: condition,
                      decoration: const InputDecoration(labelText: "Condition"),
                      items: const <String>["Any condition", "New", "Used"]
                          .map(
                            (item) => DropdownMenuItem(
                              value: item,
                              child: Text(item),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setSheetState(
                        () => condition = value ?? "Any condition",
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _minPriceInput,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: const InputDecoration(
                              labelText: "Minimum price",
                              prefixText: "₱ ",
                            ),
                            validator: _priceValidator,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _maxPriceInput,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: const InputDecoration(
                              labelText: "Maximum price",
                              prefixText: "₱ ",
                            ),
                            validator: _priceValidator,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      title: const Text("Available now"),
                      subtitle: const Text("Hide sold out listings"),
                      value: inStock,
                      onChanged: (value) =>
                          setSheetState(() => inStock = value),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        TextButton(
                          onPressed: () {
                            _minPriceInput.clear();
                            _maxPriceInput.clear();
                            setSheetState(() {
                              category = null;
                              condition = "Any condition";
                              inStock = false;
                              minPrice = null;
                              maxPrice = null;
                            });
                          },
                          child: const Text("Reset"),
                        ),
                        const Spacer(),
                        FilledButton(
                          onPressed: () {
                            if (!formKey.currentState!.validate()) return;
                            minPrice = _minPriceInput.text.trim().isEmpty
                                ? null
                                : double.parse(_minPriceInput.text.trim());
                            maxPrice = _maxPriceInput.text.trim().isEmpty
                                ? null
                                : double.parse(_maxPriceInput.text.trim());
                            if (minPrice != null &&
                                maxPrice != null &&
                                minPrice! > maxPrice!) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    "Minimum price must be less than maximum price.",
                                  ),
                                ),
                              );
                              return;
                            }
                            Navigator.of(sheetContext).pop(
                              _SearchFilterResult(
                                category: category,
                                condition: condition,
                                minPrice: minPrice,
                                maxPrice: maxPrice,
                                inStockOnly: inStock,
                              ),
                            );
                          },
                          child: const Text("Show results"),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
    if (filters == null || !mounted) return;
    setState(() {
      _category = filters.category;
      _condition = filters.condition;
      _minPrice = filters.minPrice;
      _maxPrice = filters.maxPrice;
      _inStockOnly = filters.inStockOnly;
    });
    unawaited(_searchProducts(query: _lastQuery, recordRecentSearch: false));
  }

  String? _priceValidator(String? value) {
    final text = value?.trim() ?? "";
    if (text.isEmpty) return null;
    final amount = double.tryParse(text);
    if (amount == null || amount < 0) return "Enter a valid amount";
    return null;
  }

  void _selectSuggestion(_SearchSuggestion suggestion) {
    _search.text = suggestion.label;
    _onSubmitted(suggestion.label);
  }

  void _browseCategory(String category) {
    _search.text = category;
    _onSubmitted(category);
  }

  Widget _buildSearchField() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
    child: RawAutocomplete<_SearchSuggestion>(
      textEditingController: _search,
      focusNode: _focus,
      displayStringForOption: (option) => option.label,
      optionsBuilder: (value) => _suggestions(value.text),
      onSelected: _selectSuggestion,
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) =>
          Row(
            children: [
              Expanded(
                child: TmcPanel(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  color: TmcPalette.surface,
                  radius: TmcRadius.pill,
                  child: Row(
                    children: [
                      const Icon(Icons.search, color: TmcPalette.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          key: const ValueKey("marketplace-search-input"),
                          controller: controller,
                          focusNode: focusNode,
                          autofocus: true,
                          textInputAction: TextInputAction.search,
                          onChanged: (_) => setState(() {}),
                          onSubmitted: (value) {
                            final requestGeneration = _requestGeneration;
                            onFieldSubmitted();
                            if (_requestGeneration == requestGeneration) {
                              _onSubmitted(value);
                            }
                          },
                          decoration: const InputDecoration(
                            hintText: "Search products, sellers, categories",
                            hintStyle: TextStyle(color: TmcPalette.textSoft),
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(vertical: 17),
                            isCollapsed: true,
                          ),
                        ),
                      ),
                      if (controller.text.isNotEmpty)
                        IconButton(
                          tooltip: "Clear search",
                          onPressed: _resetSearch,
                          icon: const Icon(Icons.close_rounded),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                height: 54,
                child: FilledButton(
                  onPressed: _loading
                      ? null
                      : () => _onSubmitted(controller.text),
                  child: _loading
                      ? const SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text("Search"),
                ),
              ),
            ],
          ),
      optionsViewBuilder: (context, onSelected, options) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 8,
          color: TmcPalette.surface,
          borderRadius: BorderRadius.circular(TmcRadius.md),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 320, maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 6),
              shrinkWrap: true,
              children: options
                  .map(
                    (option) => ListTile(
                      leading: Icon(
                        option.type == "seller"
                            ? Icons.person_outline
                            : option.type == "category"
                            ? Icons.category_outlined
                            : Icons.inventory_2_outlined,
                      ),
                      title: Text(
                        option.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(option.subtitle),
                      onTap: () => onSelected(option),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ),
    ),
  );

  Widget _buildDiscovery(MarketplaceState marketplace) {
    final recentSearches = marketplace.recentSearches;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
      children: [
        if (recentSearches.isNotEmpty) ...[
          Row(
            children: [
              const Expanded(
                child: SectionHeading("Recent searches", action: null),
              ),
              TextButton.icon(
                onPressed: marketplace.clearRecentSearches,
                icon: const Icon(Icons.delete_outline, size: 18),
                label: const Text("Clear"),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ...recentSearches.map(
            (query) => ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              leading: const Icon(Icons.history, color: TmcPalette.textSoft),
              title: Text(query, maxLines: 1, overflow: TextOverflow.ellipsis),
              onTap: () {
                _search.text = query;
                _onSubmitted(query);
              },
              trailing: IconButton(
                tooltip: "Remove recent search",
                onPressed: () => marketplace.removeRecentSearch(query),
                icon: const Icon(Icons.close, size: 20),
              ),
            ),
          ),
          const SizedBox(height: 18),
        ],
        Row(
          children: [
            const Expanded(
              child: SectionHeading("Browse categories", action: null),
            ),
            IconButton(
              tooltip: "Refresh categories",
              onPressed: marketplace.categoriesLoading
                  ? null
                  : marketplace.loadCategories,
              icon: marketplace.categoriesLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh),
            ),
          ],
        ),
        if (marketplace.categoriesError != null &&
            marketplace.categories.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 8),
            child: Text(
              "Categories couldn't be loaded. Try refreshing.",
              style: const TextStyle(color: TmcPalette.error),
            ),
          ),
        if (marketplace.categories.isEmpty && marketplace.categoriesLoading)
          const Padding(
            padding: EdgeInsets.all(20),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (marketplace.categories.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text("No categories are available right now."),
          )
        else
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: marketplace.categories
                .map(
                  (category) => ActionChip(
                    avatar: const Icon(Icons.category_outlined, size: 18),
                    label: Text(category.name),
                    onPressed: () => _browseCategory(category.name),
                  ),
                )
                .toList(),
          ),
        const SizedBox(height: 34),
        TmcPanel(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: TmcPalette.primarySoft,
                  borderRadius: BorderRadius.circular(TmcRadius.xl),
                ),
                child: const Icon(
                  Icons.search,
                  size: 40,
                  color: TmcPalette.primary,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                "Search the marketplace",
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 6),
              const Text(
                "Enter a keyword above to find products and sellers.",
                textAlign: TextAlign.center,
                style: TextStyle(color: TmcPalette.textMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildResults(MarketplaceState marketplace) {
    if (_loading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 14),
            Text("Searching products..."),
          ],
        ),
      );
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: TmcPanel(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.cloud_off_outlined,
                  size: 42,
                  color: TmcPalette.error,
                ),
                const SizedBox(height: 12),
                Text(
                  "Search failed",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => _searchProducts(
                    query: _lastQuery,
                    recordRecentSearch: false,
                  ),
                  icon: const Icon(Icons.refresh),
                  label: const Text("Try again"),
                ),
              ],
            ),
          ),
        ),
      );
    }
    final products = _visibleResults;
    if (products.isEmpty) {
      final hasNoSearchMatches = _results.isEmpty && _activeFilterCount == 0;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: TmcPanel(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.search_off_outlined,
                  size: 42,
                  color: TmcPalette.primary,
                ),
                const SizedBox(height: 12),
                Text(
                  hasNoSearchMatches
                      ? "No results found"
                      : "No matching products",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  hasNoSearchMatches
                      ? "We couldn't find products for ‘$_lastQuery’. Try another search."
                      : "Try adjusting or clearing your filters.",
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: TmcPalette.textMuted),
                ),
                if (_activeFilterCount > 0) ...[
                  const SizedBox(height: 12),
                  TextButton.icon(
                    onPressed: _clearFiltersAndReload,
                    icon: const Icon(Icons.filter_alt_off),
                    label: const Text("Clear filters"),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 12, 8),
          child: Column(
            children: [
              SectionHeading(
                "$_resultTotal ${_resultTotal == 1 ? 'result' : 'results'}",
                action: null,
              ),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _openFilters,
                    icon: const Icon(Icons.tune, size: 18),
                    label: Text(
                      _activeFilterCount == 0
                          ? "Filter"
                          : "Filter ($_activeFilterCount)",
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        isExpanded: true,
                        value: _sort,
                        items:
                            const <String>[
                                  "Newest",
                                  "Price: low to high",
                                  "Price: high to low",
                                ]
                                .map(
                                  (item) => DropdownMenuItem(
                                    value: item,
                                    child: Text(
                                      item,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                        onChanged: (value) {
                          setState(() => _sort = value ?? "Newest");
                          unawaited(
                            _searchProducts(
                              query: _lastQuery,
                              recordRecentSearch: false,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final narrow = constraints.maxWidth < 380;
              return NotificationListener<ScrollNotification>(
                onNotification: (notification) {
                  if (notification.metrics.extentAfter < 600 &&
                      _resultPage < _resultLastPage &&
                      !_loadingMore) {
                    unawaited(_loadMore());
                  }
                  return false;
                },
                child: GridView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: narrow ? 340 : 250,
                    mainAxisExtent: 344,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount:
                      products.length +
                      ((_resultPage < _resultLastPage ||
                              _loadingMore ||
                              _loadMoreError != null)
                          ? 1
                          : 0),
                  itemBuilder: (context, index) {
                    if (index >= products.length) {
                      return Center(
                        child: _loadMoreError != null
                            ? TextButton.icon(
                                onPressed: _loadMore,
                                icon: const Icon(Icons.refresh),
                                label: const Text('Retry loading results'),
                              )
                            : const CircularProgressIndicator(),
                      );
                    }
                    final product = products[index];
                    final userId = context.read<AuthState>().user?.id ?? 0;
                    final ownListing = product.userId == userId;
                    return ProductCard(
                      key: ValueKey("search-product-${product.id}"),
                      product: product,
                      showSeller: true,
                      imageHeight: narrow ? 142 : 148,
                      isOwnListing: ownListing,
                      onTap: () => Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              ProductDetailsPage(productId: product.id),
                        ),
                      ),
                      onAdd:
                          !ownListing &&
                              product.status == "active" &&
                              product.stockQuantity > 0 &&
                              userId > 0
                          ? () {
                              context.read<CartState>().add(
                                product,
                                currentUserId: userId,
                              );
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    "${product.name} added to cart.",
                                  ),
                                ),
                              );
                            }
                          : null,
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  void _clearFilters() {
    _category = null;
    _condition = "Any condition";
    _minPrice = null;
    _maxPrice = null;
    _inStockOnly = false;
  }

  Future<void> _loadMore() => _searchProducts(
    query: _lastQuery,
    recordRecentSearch: false,
    append: true,
  );

  void _clearFiltersAndReload() {
    setState(_clearFilters);
    unawaited(_searchProducts(query: _lastQuery, recordRecentSearch: false));
  }

  @override
  Widget build(BuildContext context) {
    final marketplace = context.watch<MarketplaceState>();
    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        titleSpacing: 0,
        title: Row(
          children: [
            const BrandLogo(size: 34),
            const SizedBox(width: 10),
            Text("Search", style: Theme.of(context).textTheme.titleLarge),
          ],
        ),
      ),
      body: Column(
        children: [
          _buildSearchField(),
          Expanded(
            child: _lastQuery.isEmpty
                ? _buildDiscovery(marketplace)
                : _buildResults(marketplace),
          ),
        ],
      ),
    );
  }
}

class _SearchSuggestion {
  const _SearchSuggestion(this.label, this.subtitle, this.type);
  final String label;
  final String subtitle;
  final String type;
}

class _SearchFilterResult {
  const _SearchFilterResult({
    required this.category,
    required this.condition,
    required this.minPrice,
    required this.maxPrice,
    required this.inStockOnly,
  });

  final String? category;
  final String condition;
  final double? minPrice;
  final double? maxPrice;
  final bool inStockOnly;
}
