import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'tmc_theme.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.onOpenMarketplace});
  final VoidCallback onOpenMarketplace;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  @override
  Widget build(BuildContext context) {
    final student = context.watch<AuthState>().user;
    final state = context.watch<MarketplaceState>();
    final featured = state.products.take(6).toList();
    final studentName = student?.name.split(' ').first ?? 'Student';
    final studentCourse = student?.course ?? '';
    final studentCode = student?.studentId ?? '';
    final homeCategories = state.categories;
    return RefreshIndicator(
      onRefresh: state.loadProducts,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
        children: [
          TmcPanel(
            color: TmcPalette.deepNavy,
            dark: true,
            padding: const EdgeInsets.all(20),
            radius: TmcRadius.xl,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const BrandLogo(size: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'TMC StudentMart',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: TmcPalette.white,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                    const Icon(
                      Icons.school_outlined,
                      color: TmcPalette.lightBlue,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  'Hello, $studentName!',
                  style: const TextStyle(
                    color: TmcPalette.white,
                    fontSize: 23,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  studentCourse.isNotEmpty
                      ? '$studentCourse • $studentCode'
                      : 'Your campus marketplace',
                  style: const TextStyle(color: TmcPalette.paleBlue),
                ),
                const SizedBox(height: 13),
                const Text(
                  'Find affordable books, uniforms, and student essentials from your campus community.',
                  style: TextStyle(color: TmcPalette.white, height: 1.45),
                ),
                const SizedBox(height: 17),
                FilledButton.icon(
                  onPressed: widget.onOpenMarketplace,
                  icon: const Icon(Icons.storefront_outlined),
                  label: const Text('Explore marketplace'),
                  style: FilledButton.styleFrom(
                    backgroundColor: TmcPalette.paleBlue,
                    foregroundColor: TmcPalette.deepNavyBlack,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            readOnly: true,
            onTap: widget.onOpenMarketplace,
            decoration: const InputDecoration(
              hintText: 'Search active listings',
              prefixIcon: Icon(Icons.search),
              suffixIcon: Icon(Icons.arrow_forward),
            ),
          ),
          const SizedBox(height: 24),
          const SectionHeading('Categories in active listings'),
          const SizedBox(height: 11),
          if (state.categoriesLoading && homeCategories.isEmpty)
            const LinearProgressIndicator()
          else if (state.categoriesError != null && homeCategories.isEmpty)
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Categories could not be loaded.',
                    style: TextStyle(color: TmcPalette.darkGray),
                  ),
                ),
                TextButton(
                  onPressed: state.loadCategories,
                  child: const Text('Retry'),
                ),
              ],
            )
          else if (homeCategories.isEmpty)
            const Text(
              'No active categories are available yet.',
              style: TextStyle(color: TmcPalette.darkGray),
            )
          else
            SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: homeCategories.take(8).length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) => ActionChip(
                  avatar: const Icon(Icons.category_outlined, size: 16),
                  label: Text(homeCategories[index].name),
                  onPressed: widget.onOpenMarketplace,
                ),
              ),
            ),
          const SizedBox(height: 24),
          SectionHeading(
            'Recently listed',
            action: TextButton(
              onPressed: widget.onOpenMarketplace,
              child: const Text('See all'),
            ),
          ),
          const SizedBox(height: 10),
          if (state.loading && featured.isEmpty)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (state.error != null && featured.isEmpty)
            ErrorMessage(message: state.error!, onRetry: state.loadProducts)
          else if (featured.isEmpty)
            const EmptyMessage(
              icon: Icons.storefront_outlined,
              title: 'No active listings yet',
              message:
                  'Check back later for student listings approved for the marketplace.',
            )
          else
            SizedBox(
              height: 292,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: featured.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, index) => SizedBox(
                  width: 190,
                  child: ProductCard(
                    product: featured[index],
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            ProductDetailsPage(product: featured[index]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
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
                              ProductDetailsPage(product: visible[index]),
                        ),
                      ),
                      onAdd: () async {
                        final added = await context.read<CartState>().add(
                          visible[index],
                          currentUserId: currentUserId,
                        );
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                added
                                    ? 'Added to your local cart.'
                                    : isOwnProduct(
                                        visible[index],
                                        currentUserId,
                                      )
                                    ? 'You cannot purchase your own product.'
                                    : visible[index].stockQuantity <= 0
                                    ? 'This product is sold out.'
                                    : 'You have reached the available stock limit.',
                              ),
                            ),
                          );
                        }
                      },
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

class ProductDetailsPage extends StatelessWidget {
  const ProductDetailsPage({super.key, required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final currentUserId = context.watch<AuthState>().user?.id ?? 0;
    final isOwnListing = isOwnProduct(product, currentUserId);
    final soldOut = product.status == 'sold_out' || product.stockQuantity <= 0;

    return Scaffold(
      appBar: AppBar(title: const Text('Product details')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          ProductGallery(product: product, height: 280),
          const SizedBox(height: 18),
          Text(
            product.name,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 7),
          Text(
            peso(product.price),
            style: const TextStyle(
              fontSize: 22,
              color: TmcPalette.navyBlue,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            soldOut ? 'Sold out' : '${product.stockQuantity} available',
            style: TextStyle(
              color: soldOut ? TmcPalette.error : TmcPalette.darkGray,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(
                Icons.category_outlined,
                size: 18,
                color: TmcPalette.darkGray,
              ),
              const SizedBox(width: 7),
              Text(
                product.category.isEmpty
                    ? 'Category not specified'
                    : product.category,
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'Description',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
          ),
          const SizedBox(height: 7),
          Text(
            product.description.isEmpty
                ? 'No description provided.'
                : product.description,
            style: const TextStyle(height: 1.5),
          ),
          const SizedBox(height: 18),
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text(
                product.sellerName.isEmpty
                    ? 'TMC Student Seller'
                    : product.sellerName,
              ),
              subtitle: const Text('TMC Student seller'),
            ),
          ),
          if (product.sellerContactNumber.isNotEmpty ||
              product.sellerFacebookUrl.isNotEmpty ||
              product.sellerInstagramUrl.isNotEmpty ||
              product.sellerTiktokUrl.isNotEmpty) ...[
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Seller-shared contact',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    if (product.sellerContactNumber.isNotEmpty)
                      SelectableText('Contact number: ${product.sellerContactNumber}'),
                    if (product.sellerFacebookUrl.isNotEmpty)
                      SelectableText('Facebook: ${product.sellerFacebookUrl}'),
                    if (product.sellerInstagramUrl.isNotEmpty)
                      SelectableText('Instagram: ${product.sellerInstagramUrl}'),
                    if (product.sellerTiktokUrl.isNotEmpty)
                      SelectableText('TikTok: ${product.sellerTiktokUrl}'),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: isOwnListing || soldOut
                ? null
                : () async {
                    final added = await context.read<CartState>().add(
                      product,
                      currentUserId: currentUserId,
                    );
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            added
                                ? 'Added to your local cart.'
                                : isOwnListing
                                ? 'You cannot purchase your own product.'
                                : soldOut
                                ? 'This product is sold out.'
                                : 'You have reached the available stock limit.',
                          ),
                        ),
                      );
                    }
                  },
            icon: Icon(
              isOwnListing
                  ? Icons.storefront_outlined
                  : soldOut
                  ? Icons.remove_shopping_cart_outlined
                  : Icons.add_shopping_cart,
            ),
            label: Text(
              isOwnListing
                  ? 'Your listing'
                  : soldOut
                  ? 'Sold out'
                  : 'Add to cart',
            ),
          ),
          if (isOwnListing) ...[
            const SizedBox(height: 8),
            const Text(
              'You cannot purchase your own product.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TmcPalette.darkGray,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (soldOut && !isOwnListing) ...[
            const SizedBox(height: 8),
            const Text(
              'This listing is out of stock and cannot be ordered.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: TmcPalette.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => ReportProductPage(product: product),
              ),
            ),
            icon: const Icon(Icons.flag_outlined),
            label: const Text('Report this listing'),
          ),
          const SizedBox(height: 7),
          const Text(
            'Choose an Admin-approved payment method and pickup location at checkout. No payment is collected or verified in the app.',
            textAlign: TextAlign.center,
            style: TextStyle(color: TmcPalette.darkGray, fontSize: 12),
          ),
        ],
      ),
    );
  }
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
  String _subject = 'Inappropriate product';
  bool _saving = false;
  String? _error;
  static const _subjects = [
    'Inappropriate product',
    'Suspicious listing',
    'Incorrect product information',
    'Seller concern',
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
      await context.read<ApiService>().post('/complaints', {
        'product_id': widget.product.id,
        'subject': _subject,
        'description': _description.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted to the TMC team.')),
        );
        Navigator.of(context).pop();
      }
    } catch (exception) {
      if (mounted) setState(() => _error = exception.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final productName = widget.product.name;
    return Scaffold(
      appBar: AppBar(title: const Text('Report listing')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Text(
              'Report “$productName”',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<String>(
              initialValue: _subject,
              decoration: const InputDecoration(labelText: 'Reason'),
              items: _subjects
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
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
                labelText: 'Tell us what happened',
                alignLabelWithHint: true,
              ),
              validator: (value) {
                if (value == null || value.trim().length < 10) {
                  return 'Please provide at least 10 characters.';
                }
                return null;
              },
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
                  : const Text('Submit report'),
            ),
          ],
        ),
      ),
    );
  }
}
