import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'tmc_theme.dart';
import 'product_history_page.dart';

class SellPage extends StatefulWidget {
  const SellPage({super.key});
  @override
  State<SellPage> createState() => _SellPageState();
}

class _SellPageState extends State<SellPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<MarketplaceState>().loadMine();
    });
  }

  Future<void> _form({Product? product}) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => ProductFormPage(product: product),
      ),
    );
  }

  Future<void> _archive(Product product) async {
    final productName = product.name;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Archive listing?'),
        content: Text('“$productName” will leave the marketplace. Its order and product history will be kept.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: TmcPalette.error),
            child: const Text('Archive'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await context.read<MarketplaceState>().deleteProduct(product.id);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Listing archived. History was preserved.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  Future<void> _manageStock(Product product) async {
    final controller = TextEditingController(text: '${product.stockQuantity}');
    final quantity = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Manage stock'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Available units',
            helperText: 'Set to 0 to mark this listing sold out.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = int.tryParse(controller.text.trim());
              if (value == null || value < 0) {
                ScaffoldMessenger.of(dialogContext).showSnackBar(
                  const SnackBar(content: Text('Enter a whole number that is 0 or greater.')),
                );
                return;
              }
              Navigator.pop(dialogContext, value);
            },
            child: const Text('Save stock'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (quantity == null || !mounted) return;
    try {
      await context.read<MarketplaceState>().updateStock(product.id, quantity);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(quantity == 0 ? 'Listing marked sold out.' : 'Stock updated.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<MarketplaceState>();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(15),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: TmcPalette.paleBlue,
                    child: Icon(
                      Icons.storefront_outlined,
                      color: TmcPalette.navyBlue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Your listings',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                        SizedBox(height: 3),
                        Text(
                          'New or edited items are sent for moderation.',
                          style: TextStyle(
                            fontSize: 12,
                            color: TmcPalette.darkGray,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: state.loading ? null : state.loadMine,
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: state.loadMine,
            child: state.loading && state.myProducts.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : state.error != null && state.myProducts.isEmpty
                ? ErrorMessage(message: state.error!, onRetry: state.loadMine)
                : state.myProducts.isEmpty
                ? ListView(
                    children: [
                      const SizedBox(height: 110),
                      const EmptyMessage(
                        icon: Icons.inventory_2_outlined,
                        title: 'No listings yet',
                        message:
                            'Create a listing to offer an item to other TMC students.',
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 45),
                        child: FilledButton.icon(
                          onPressed: () => _form(),
                          icon: const Icon(Icons.add),
                          label: const Text('Create listing'),
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                    itemCount: state.myProducts.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final product = state.myProducts[index];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(11),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 82,
                                child: ProductPhoto(
                                  product: product,
                                  height: 82,
                                ),
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
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      peso(product.price),
                                      style: const TextStyle(
                                        color: TmcPalette.navyBlue,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      'Stock: ${product.stockQuantity}',
                                      style: const TextStyle(
                                        color: TmcPalette.darkGray,
                                        fontSize: 12,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    StatusBadge(product.status),
                                    if (product.rejectionReason?.isNotEmpty ==
                                        true) ...[
                                      const SizedBox(height: 7),
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: TmcPalette.error.withValues(
                                            alpha: .08,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            9,
                                          ),
                                        ),
                                        child: Text(
                                          'Review note: ${product.rejectionReason}',
                                          style: const TextStyle(
                                            color: TmcPalette.error,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              PopupMenuButton<String>(
                                onSelected: (action) {
                                  if (action == 'edit') _form(product: product);
                                  if (action == 'stock') _manageStock(product);
                                  if (action == 'history') {
                                    Navigator.of(context).push<void>(
                                      MaterialPageRoute<void>(
                                        builder: (_) => ProductHistoryPage(product: product),
                                      ),
                                    );
                                  }
                                  if (action == 'archive') _archive(product);
                                },
                                itemBuilder: (_) => [
                                  if (product.status != 'archived')
                                    const PopupMenuItem(
                                      value: 'edit',
                                      child: Text('Edit listing'),
                                    ),
                                  if (product.status == 'active' || product.status == 'sold_out')
                                    const PopupMenuItem(
                                      value: 'stock',
                                      child: Text('Manage stock'),
                                    ),
                                  const PopupMenuItem(
                                    value: 'history',
                                    child: Text('Product history'),
                                  ),
                                  if (product.status != 'archived')
                                    const PopupMenuItem(
                                      value: 'archive',
                                      child: Text('Archive listing'),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

class ProductFormPage extends StatefulWidget {
  const ProductFormPage({super.key, this.product});
  final Product? product;

  @override
  State<ProductFormPage> createState() => _ProductFormPageState();
}

class _ProductFormPageState extends State<ProductFormPage> {
  static const _maxPhotos = 4;
  static const _maxPhotoBytes = 1536 * 1024;

  final _form = GlobalKey<FormState>();
  late final TextEditingController _name = TextEditingController(
    text: widget.product?.name ?? '',
  );
  late final TextEditingController _description = TextEditingController(
    text: widget.product?.description ?? '',
  );
  late final TextEditingController _price = TextEditingController(
    text: widget.product?.price.toStringAsFixed(2) ?? '',
  );
  late final TextEditingController _stock = TextEditingController(
    text: '${widget.product?.stockQuantity ?? 1}',
  );
  int? _selectedCategoryId;
  final List<XFile> _newImages = [];
  final Set<int> _removedImageIds = {};
  final Map<XFile, Future<Uint8List>> _imageBytes = {};
  int? _primaryExistingImageId;
  int? _primaryNewImageIndex;
  bool _saving = false;
  String? _error;
  bool get _editing => widget.product != null;

  List<ProductImage> get _keptImages => [
    for (final image in widget.product?.images ?? const <ProductImage>[])
      if (image.id == null || !_removedImageIds.contains(image.id)) image,
  ];

  @override
  void initState() {
    super.initState();
    _selectedCategoryId = widget.product?.categoryId;
    final images = widget.product?.images ?? const <ProductImage>[];
    ProductImage? cover;
    for (final image in images) {
      if (image.isPrimary) {
        cover = image;
        break;
      }
    }
    cover ??= images.isEmpty ? null : images.first;
    _primaryExistingImageId = cover?.id;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<MarketplaceState>().loadCategories();
    });
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _price.dispose();
    _stock.dispose();
    super.dispose();
  }

  Future<void> _chooseImages() async {
    final slots = _maxPhotos - _keptImages.length - _newImages.length;
    if (slots <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('A listing can have up to 4 photos.')),
      );
      return;
    }

    try {
      final picked = await ImagePicker().pickMultiImage(
        limit: slots,
        imageQuality: 78,
        maxWidth: 1400,
      );
      if (!mounted || picked.isEmpty) return;

      final accepted = <XFile>[];
      var tooLarge = 0;
      for (final image in picked.take(slots)) {
        final bytes = await image.readAsBytes();
        if (bytes.lengthInBytes > _maxPhotoBytes) {
          tooLarge++;
          continue;
        }
        accepted.add(image);
        _imageBytes[image] = Future<Uint8List>.value(bytes);
      }

      if (!mounted) return;
      setState(() {
        _newImages.addAll(accepted);
        if (_primaryExistingImageId == null &&
            _primaryNewImageIndex == null &&
            _newImages.isNotEmpty) {
          _primaryNewImageIndex = 0;
        }
      });
      if (tooLarge > 0 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '$tooLarge photo${tooLarge == 1 ? '' : 's'} exceeded the 1.5 MB limit and were skipped.',
            ),
          ),
        );
      }
    } catch (exception) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open the photo picker: $exception'),
          ),
        );
      }
    }
  }

  void _removeExistingImage(ProductImage image) {
    final id = image.id;
    if (id == null) return;
    setState(() {
      _removedImageIds.add(id);
      if (_primaryExistingImageId == id) {
        final next = _keptImages.where((item) => item.id != null);
        if (next.isNotEmpty) {
          _primaryExistingImageId = next.first.id;
          _primaryNewImageIndex = null;
        } else if (_newImages.isNotEmpty) {
          _primaryExistingImageId = null;
          _primaryNewImageIndex = 0;
        } else {
          _primaryExistingImageId = null;
          _primaryNewImageIndex = null;
        }
      }
    });
  }

  void _removeNewImage(int index) {
    setState(() {
      final image = _newImages.removeAt(index);
      _imageBytes.remove(image);
      if (_primaryNewImageIndex == index) {
        _primaryNewImageIndex = _newImages.isEmpty ? null : 0;
        if (_primaryNewImageIndex == null) {
          final existing = _keptImages.where((item) => item.id != null);
          _primaryExistingImageId = existing.isEmpty ? null : existing.first.id;
        } else {
          _primaryExistingImageId = null;
        }
      } else if (_primaryNewImageIndex != null &&
          _primaryNewImageIndex! > index) {
        _primaryNewImageIndex = _primaryNewImageIndex! - 1;
      }
    });
  }

  int get _categoryIdForSave {
    if (_selectedCategoryId != null) {
      return _selectedCategoryId!;
    }

    final productCategory = widget.product?.category;
    for (final category in context.read<MarketplaceState>().categories) {
      if (category.name == productCategory) {
        return category.id;
      }
    }

    return 0;
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<MarketplaceState>().saveProduct(
        id: widget.product?.id,
        images: _newImages,
        removeImageIds: _removedImageIds.toList(),
        primaryImageId: _primaryExistingImageId,
        primaryImageIndex: _primaryNewImageIndex,
        fields: {
          'name': _name.text.trim(),
          'description': _description.text.trim(),
          'price': _price.text.trim(),
          'category_id': _categoryIdForSave.toString(),
          'stock_quantity': _stock.text.trim(),
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _editing
                  ? 'Listing updated and sent for review.'
                  : 'Listing submitted for review.',
            ),
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _photoTile({
    required Widget photo,
    required String label,
    required bool isCover,
    required VoidCallback onRemove,
    VoidCallback? onSetCover,
  }) {
    return SizedBox(
      width: 112,
      child: Column(
        children: [
          SizedBox(
            height: 94,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: photo,
                ),
                Positioned(
                  top: 3,
                  right: 3,
                  child: Material(
                    color: Colors.black.withValues(alpha: .62),
                    shape: const CircleBorder(),
                    child: IconButton(
                      tooltip: 'Remove $label',
                      constraints: const BoxConstraints.tightFor(
                        width: 31,
                        height: 31,
                      ),
                      padding: EdgeInsets.zero,
                      onPressed: _saving ? null : onRemove,
                      icon: const Icon(
                        Icons.close,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ),
                if (isCover)
                  const Positioned(
                    left: 5,
                    top: 5,
                    child: Icon(
                      Icons.star,
                      color: TmcPalette.mutedTeal,
                      size: 20,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 3),
          SizedBox(
            height: 31,
            child: TextButton(
              onPressed: _saving || isCover ? null : onSetCover,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                visualDensity: VisualDensity.compact,
              ),
              child: Text(
                isCover ? 'Cover photo' : 'Set as cover',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhotoSection() {
    final tiles = <Widget>[];
    for (final image in _keptImages) {
      final isCover = image.id != null
          ? _primaryExistingImageId == image.id && _primaryNewImageIndex == null
          : image.isPrimary;
      tiles.add(
        _photoTile(
          label: 'existing photo',
          isCover: isCover,
          onRemove: () => _removeExistingImage(image),
          onSetCover: image.id == null
              ? null
              : () => setState(() {
                  _primaryExistingImageId = image.id;
                  _primaryNewImageIndex = null;
                }),
          photo: Image.network(
            ApiService.imageUrlFor(image.path),
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) =>
                const Center(child: Icon(Icons.broken_image_outlined)),
            loadingBuilder: (context, child, progress) => progress == null
                ? child
                : const Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
          ),
        ),
      );
    }

    for (final entry in _newImages.asMap().entries) {
      final index = entry.key;
      final image = entry.value;
      tiles.add(
        _photoTile(
          label: image.name,
          isCover: _primaryNewImageIndex == index,
          onRemove: () => _removeNewImage(index),
          onSetCover: () => setState(() {
            _primaryNewImageIndex = index;
            _primaryExistingImageId = null;
          }),
          photo: FutureBuilder<Uint8List>(
            future: _imageBytes.putIfAbsent(image, image.readAsBytes),
            builder: (context, snapshot) {
              if (snapshot.hasData) {
                return Image.memory(snapshot.data!, fit: BoxFit.cover);
              }
              if (snapshot.hasError) {
                return const Center(child: Icon(Icons.broken_image_outlined));
              }
              return const Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              );
            },
          ),
        ),
      );
    }

    final count = _keptImages.length + _newImages.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Product photos',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            Text('$count/$_maxPhotos', style: const TextStyle(fontSize: 12)),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'Choose up to 4 photos. The cover photo appears in marketplace listings. Each photo must be 1.5 MB or smaller.',
          style: TextStyle(color: TmcPalette.darkGray, fontSize: 12),
        ),
        const SizedBox(height: 10),
        if (tiles.isNotEmpty) ...[
          Wrap(spacing: 10, runSpacing: 8, children: tiles),
          const SizedBox(height: 8),
        ],
        OutlinedButton.icon(
          onPressed: _saving || count >= _maxPhotos ? null : _chooseImages,
          icon: const Icon(Icons.add_photo_alternate_outlined),
          label: Text(count == 0 ? 'Choose photos' : 'Add more photos'),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(_editing ? 'Edit listing' : 'New listing')),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
        children: [
          const Text(
            'Product details',
            style: TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w900,
              color: TmcPalette.navyBlue,
            ),
          ),
          const SizedBox(height: 7),
          const Text(
            'Listings are reviewed before students can see them. Add a name, description, price, category, and up to four photos.',
            style: TextStyle(color: TmcPalette.darkGray),
          ),
          if (_editing) ...[
            const SizedBox(height: 12),
            const Card(
              child: Padding(
                padding: EdgeInsets.all(12),
                child: Text(
                  'Saving changes sends this listing back to moderation.',
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          TextFormField(
            controller: _name,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Product name'),
            validator: (value) => value == null || value.trim().isEmpty
                ? 'Enter a product name.'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _description,
            minLines: 4,
            maxLines: 7,
            decoration: const InputDecoration(
              labelText: 'Description',
              alignLabelWithHint: true,
            ),
            validator: (value) => value == null || value.trim().isEmpty
                ? 'Enter a description.'
                : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _price,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
              labelText: 'Price (PHP)',
              prefixText: 'PHP ',
            ),
            validator: (value) {
              final price = double.tryParse(value?.trim() ?? '');
              return price == null || price <= 0
                  ? 'Enter a price greater than zero.'
                  : null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _stock,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Available stock',
              helperText: _editing
                  ? 'Stock saved with listing edits returns the listing to review.'
                  : 'Enter how many units you have available.',
            ),
            validator: (value) {
              final quantity = int.tryParse(value?.trim() ?? '');
              return quantity == null || quantity < 0
                  ? 'Enter a whole number that is 0 or greater.'
                  : null;
            },
          ),
          const SizedBox(height: 12),
          Builder(
            builder: (context) {
              final marketplace = context.watch<MarketplaceState>();
              final categories = marketplace.categories;
              int? selectedCategoryId =
                  categories.any(
                    (category) => category.id == _selectedCategoryId,
                  )
                  ? _selectedCategoryId
                  : null;
              if (selectedCategoryId == null &&
                  widget.product?.categoryId != null) {
                for (final category in categories) {
                  if (category.id == widget.product!.categoryId) {
                    selectedCategoryId = category.id;
                    break;
                  }
                }
              }
              if (selectedCategoryId == null && widget.product != null) {
                for (final category in categories) {
                  if (category.name == widget.product!.category) {
                    selectedCategoryId = category.id;
                    break;
                  }
                }
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<int>(
                    key: ValueKey(
                      categories.map((category) => category.id).join(','),
                    ),
                    initialValue: selectedCategoryId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: 'Category',
                      helperText: marketplace.categoriesLoading
                          ? 'Loading active categories…'
                          : categories.isEmpty
                          ? 'No active categories are available.'
                          : 'Choose a category managed by TMC.',
                    ),
                    items: categories
                        .map(
                          (category) => DropdownMenuItem<int>(
                            value: category.id,
                            child: Text(
                              category.name,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: _saving || categories.isEmpty
                        ? null
                        : (value) =>
                              setState(() => _selectedCategoryId = value),
                    validator: (value) => value == null || value <= 0
                        ? categories.isEmpty
                              ? 'No active categories are available. Try again later.'
                              : 'Select a category.'
                        : null,
                  ),
                  if (marketplace.categoriesError != null) ...[
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Could not load categories: ${marketplace.categoriesError}',
                            style: const TextStyle(
                              color: TmcPalette.error,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: marketplace.categoriesLoading
                              ? null
                              : marketplace.loadCategories,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ],
                ],
              );
            },
          ),
          const SizedBox(height: 16),
          _buildPhotoSection(),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: TmcPalette.error)),
          ],
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(_editing ? 'Save and resubmit' : 'Submit for review'),
          ),
        ],
      ),
    ),
  );
}
