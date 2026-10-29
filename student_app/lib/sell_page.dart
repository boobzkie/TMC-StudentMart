import 'dart:convert';
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
        content: Text(
          '“$productName” will leave the marketplace. Its order and product history will be kept.',
        ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Listing archived. History was preserved.'),
          ),
        );
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
    ProductVariant? selectedVariant;
    if (product.variants.isNotEmpty) {
      selectedVariant = await showDialog<ProductVariant>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Choose an option'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: product.variants
                .map(
                  (variant) => ListTile(
                    title: Text(variant.label),
                    subtitle: Text('${variant.stockQuantity} available'),
                    onTap: () => Navigator.pop(dialogContext, variant),
                  ),
                )
                .toList(),
          ),
        ),
      );
      if (selectedVariant == null || !mounted) return;
    }
    final controller = TextEditingController(
      text: '${selectedVariant?.stockQuantity ?? product.stockQuantity}',
    );
    final quantity = await showDialog<int>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(
          selectedVariant == null
              ? 'Manage stock'
              : 'Manage stock — ${selectedVariant.label}',
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: 'Available units',
            helperText: selectedVariant == null
                ? 'Set to 0 to mark this listing sold out.'
                : 'Set to 0 to mark this option sold out.',
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
                  const SnackBar(
                    content: Text('Enter a whole number that is 0 or greater.'),
                  ),
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
      await context.read<MarketplaceState>().updateStock(
        product.id,
        quantity,
        variantId: selectedVariant?.id,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              quantity == 0 ? 'Listing marked sold out.' : 'Stock updated.',
            ),
          ),
        );
      }
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
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        onPressed: state.loading ? null : state.loadMine,
                        icon: const Icon(Icons.refresh),
                      ),
                      const SizedBox(width: 4),
                      FilledButton.icon(
                        onPressed: () => _form(),
                        icon: const Icon(Icons.add),
                        label: const Text('Add Listing'),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                        ),
                      ),
                    ],
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
                                            fontSize: 12,
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
                                        builder: (_) => ProductHistoryPage(
                                          product: product,
                                        ),
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
                                  if (product.status == 'active' ||
                                      product.status == 'sold_out')
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

class _VariantDraft {
  _VariantDraft({
    this.id,
    String label = '',
    String stockQuantity = '0',
    Map<String, String> attributes = const {},
  }) : label = TextEditingController(text: label),
       stockQuantity = TextEditingController(text: stockQuantity),
       attributes = {
         for (final key in const ['size', 'color', 'type'])
           key: TextEditingController(text: attributes[key] ?? ''),
       };

  final int? id;
  final TextEditingController label;
  final TextEditingController stockQuantity;
  final Map<String, TextEditingController> attributes;

  factory _VariantDraft.fromVariant(ProductVariant variant) => _VariantDraft(
    id: variant.id,
    label: variant.label,
    stockQuantity: '${variant.stockQuantity}',
    attributes: variant.attributes,
  );

  void dispose() {
    label.dispose();
    stockQuantity.dispose();
    for (final controller in attributes.values) {
      controller.dispose();
    }
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
  static const _maxStock = 4294967295;
  static const _maxPrice = 99999999.99;

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
  late final Map<String, TextEditingController> _attributeControllers = {
    for (final key in const [
      'brand',
      'material',
      'model',
      'dimensions',
      'subject',
      'edition',
      'author',
      'uniform_type',
      'notes',
    ])
      key: TextEditingController(text: widget.product?.attributes[key] ?? ''),
  };
  String? _condition;
  bool _variantsEnabled = false;
  final List<_VariantDraft> _variantDrafts = [];
  int? _selectedCategoryId;
  final List<XFile> _newImages = [];
  final Set<int> _removedImageIds = {};
  final Map<XFile, Future<Uint8List>> _imageBytes = {};
  int? _primaryExistingImageId;
  int? _primaryNewImageIndex;
  bool _saving = false;
  bool _savedSuccessfully = false;
  bool _discardConfirmed = false;
  bool _dirty = false;
  String? _error;
  late final String _initialSnapshot;
  bool get _editing => widget.product != null;
  bool get _hasUnsavedChanges => _dirty || _formSnapshot() != _initialSnapshot;

  List<ProductImage> get _keptImages => [
    for (final image in widget.product?.images ?? const <ProductImage>[])
      if (image.id == null || !_removedImageIds.contains(image.id)) image,
  ];

  Map<String, String> _productAttributes() {
    final values = <String, String>{};
    for (final entry in _attributeControllers.entries) {
      final value = entry.value.text.trim();
      if (value.isNotEmpty) values[entry.key] = value;
    }
    if (_condition != null && _condition!.isNotEmpty) {
      values['condition'] = _condition!;
    }
    return values;
  }

  List<Map<String, dynamic>> _variantPayload() => _variantDrafts.map((draft) {
    final attributes = <String, String>{};
    for (final entry in draft.attributes.entries) {
      final value = entry.value.text.trim();
      if (value.isNotEmpty) attributes[entry.key] = value;
    }
    return <String, dynamic>{
      if (draft.id != null) 'id': draft.id,
      'label': draft.label.text.trim(),
      'attributes': attributes,
      'stock_quantity': int.tryParse(draft.stockQuantity.text.trim()) ?? -1,
    };
  }).toList();

  void _setVariantsEnabled(bool enabled) {
    if (widget.product?.variants.isNotEmpty == true && !enabled) return;
    if (!enabled && _variantsEnabled) {
      _stock.text =
          '${_variantDrafts.fold<int>(0, (sum, variant) => sum + (int.tryParse(variant.stockQuantity.text.trim()) ?? 0))}';
    }
    setState(() {
      _variantsEnabled = enabled;
      if (enabled && _variantDrafts.isEmpty) {
        _addVariantDraft(
          _VariantDraft(label: 'Standard', stockQuantity: _stock.text.trim()),
        );
      }
    });
  }

  void _trackController(TextEditingController controller) {
    controller.addListener(_onFormInputChanged);
  }

  void _untrackController(TextEditingController controller) {
    controller.removeListener(_onFormInputChanged);
  }

  void _onFormInputChanged() {
    if (mounted) {
      setState(() {
        _dirty = true;
        _error = null;
      });
    }
  }

  void _addVariantDraft(_VariantDraft draft) {
    _variantDrafts.add(draft);
    _trackController(draft.label);
    _trackController(draft.stockQuantity);
    for (final controller in draft.attributes.values) {
      _trackController(controller);
    }
  }

  @override
  void initState() {
    super.initState();
    _selectedCategoryId = widget.product?.categoryId;
    _condition = widget.product?.attributes['condition'];
    _variantsEnabled = widget.product?.variants.isNotEmpty ?? false;
    for (final variant
        in widget.product?.variants ?? const <ProductVariant>[]) {
      _addVariantDraft(_VariantDraft.fromVariant(variant));
    }
    _trackController(_name);
    _trackController(_description);
    _trackController(_price);
    _trackController(_stock);
    for (final controller in _attributeControllers.values) {
      _trackController(controller);
    }
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
    _initialSnapshot = _formSnapshot();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<MarketplaceState>().loadCategories();
    });
  }

  String _formSnapshot() => jsonEncode({
    'name': _name.text,
    'description': _description.text,
    'price': _price.text,
    'stock': _stock.text,
    'condition': _condition,
    'category': _selectedCategoryId,
    'variantsEnabled': _variantsEnabled,
    'attributes': {
      for (final entry in _attributeControllers.entries)
        entry.key: entry.value.text,
    },
    'variants': _variantDrafts
        .map(
          (variant) => {
            'id': variant.id,
            'label': variant.label.text,
            'stock': variant.stockQuantity.text,
            'attributes': {
              for (final entry in variant.attributes.entries)
                entry.key: entry.value.text,
            },
          },
        )
        .toList(),
    'keptImages': _keptImages
        .map((image) => {'id': image.id, 'path': image.path})
        .toList(),
    'newImages': _newImages.map((image) => image.path).toList(),
    'cover': [_primaryExistingImageId, _primaryNewImageIndex],
  });

  Future<bool> _confirmDiscardChanges() async {
    if (!_hasUnsavedChanges) return true;
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Discard listing changes?'),
            content: const Text(
              'Your changes have not been submitted. Leave this page and discard them?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Keep editing'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Discard changes'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _removeVariant(int index) async {
    final variant = _variantDrafts[index];
    final hasEnteredData =
        variant.label.text.trim().isNotEmpty ||
        (int.tryParse(variant.stockQuantity.text.trim()) ?? 0) != 0 ||
        variant.attributes.values.any(
          (controller) => controller.text.trim().isNotEmpty,
        );
    if (hasEnteredData) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Remove this option?'),
          content: Text(
            '“${variant.label.text.trim().isEmpty ? 'Option ${index + 1}' : variant.label.text.trim()}” and its stock details will be removed from this listing.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Keep option'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Remove option'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    setState(() {
      final removed = _variantDrafts.removeAt(index);
      _untrackController(removed.label);
      _untrackController(removed.stockQuantity);
      for (final controller in removed.attributes.values) {
        _untrackController(controller);
      }
      removed.dispose();
    });
  }

  String? _nameValidator(String? value) {
    final name = value?.trim() ?? '';
    if (name.isEmpty) return 'Enter a product name.';
    if (name.length > 255) return 'Use 255 characters or fewer.';
    return null;
  }

  String? _priceValidator(String? value) {
    final text = value?.trim() ?? '';
    if (!RegExp(r'^\d{1,8}(?:\.\d{1,2})?$').hasMatch(text)) {
      return 'Enter a price with up to 2 decimal places.';
    }
    final price = double.tryParse(text);
    if (price == null || !price.isFinite || price <= 0 || price > _maxPrice) {
      return 'Enter an amount from ₱0.01 to ₱99,999,999.99.';
    }
    return null;
  }

  String? _stockValidator(String? value) {
    final quantity = int.tryParse(value?.trim() ?? '');
    if (quantity == null || quantity < 0 || quantity > _maxStock) {
      return 'Enter a whole number from 0 to $_maxStock.';
    }
    return null;
  }

  bool _hasSupportedImageSignature(Uint8List bytes) {
    if (bytes.length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF) {
      return true;
    }
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if (bytes.length >= pngSignature.length) {
      var isPng = true;
      for (var index = 0; index < pngSignature.length; index++) {
        if (bytes[index] != pngSignature[index]) {
          isPng = false;
          break;
        }
      }
      if (isPng) return true;
    }
    return bytes.length >= 12 &&
        String.fromCharCodes(bytes.sublist(0, 4)) == 'RIFF' &&
        String.fromCharCodes(bytes.sublist(8, 12)) == 'WEBP';
  }

  String _submissionError(Object error) {
    if (error is! ApiException) {
      return 'Could not submit this listing. Your details are still here; please try again.';
    }
    if (error.statusCode == 401) {
      return 'Your session has expired. Sign in again to submit this listing.';
    }
    if (error.statusCode == 403) {
      return 'This account cannot submit listings. Your details are still here.';
    }
    if (error.statusCode != null && error.statusCode! >= 500) {
      return 'StudentMart could not save this listing right now. Please try again later.';
    }
    return error.message;
  }

  Future<XFile?> _pickValidatedReplacement() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 78,
      maxWidth: 1400,
    );
    if (image == null) return null;
    final bytes = await image.readAsBytes();
    if (bytes.lengthInBytes > _maxPhotoBytes) {
      _showPhotoMessage('Choose a photo that is 1.5 MB or smaller.');
      return null;
    }
    if (!_hasSupportedImageSignature(bytes)) {
      _showPhotoMessage('Choose a JPG, PNG, or WEBP image.');
      return null;
    }
    if (!mounted) return null;
    _imageBytes[image] = Future<Uint8List>.value(bytes);
    return image;
  }

  void _showPhotoMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _replaceExistingImage(ProductImage existing) async {
    if (existing.id == null) return;
    try {
      final replacement = await _pickValidatedReplacement();
      if (replacement == null || !mounted) return;
      if (!_keptImages.any((image) => image.id == existing.id)) return;
      setState(() {
        _removedImageIds.add(existing.id!);
        _newImages.add(replacement);
        if (_primaryExistingImageId == existing.id &&
            _primaryNewImageIndex == null) {
          _primaryExistingImageId = null;
          _primaryNewImageIndex = _newImages.length - 1;
        }
      });
    } catch (_) {
      _showPhotoMessage('Could not replace this photo. Please try again.');
    }
  }

  Future<void> _replaceNewImage(int index) async {
    if (index < 0 || index >= _newImages.length) return;
    final previous = _newImages[index];
    try {
      final replacement = await _pickValidatedReplacement();
      if (replacement == null || !mounted) return;
      final currentIndex = _newImages.indexOf(previous);
      if (currentIndex < 0) return;
      setState(() {
        _imageBytes.remove(previous);
        _newImages[currentIndex] = replacement;
      });
    } catch (_) {
      _showPhotoMessage('Could not replace this photo. Please try again.');
    }
  }

  @override
  void dispose() {
    _untrackController(_name);
    _untrackController(_description);
    _untrackController(_price);
    _untrackController(_stock);
    _name.dispose();
    _description.dispose();
    _price.dispose();
    _stock.dispose();
    for (final controller in _attributeControllers.values) {
      _untrackController(controller);
      controller.dispose();
    }
    for (final variant in _variantDrafts) {
      _untrackController(variant.label);
      _untrackController(variant.stockQuantity);
      for (final controller in variant.attributes.values) {
        _untrackController(controller);
      }
      variant.dispose();
    }
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
      var unsupported = 0;
      for (final image in picked.take(slots)) {
        final bytes = await image.readAsBytes();
        if (bytes.lengthInBytes > _maxPhotoBytes) {
          tooLarge++;
          continue;
        }
        if (!_hasSupportedImageSignature(bytes)) {
          unsupported++;
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
      if ((tooLarge > 0 || unsupported > 0) && mounted) {
        final messages = <String>[];
        if (tooLarge > 0) {
          messages.add(
            '$tooLarge photo${tooLarge == 1 ? '' : 's'} exceeded the 1.5 MB limit',
          );
        }
        if (unsupported > 0) {
          messages.add(
            '$unsupported photo${unsupported == 1 ? '' : 's'} was not a supported JPG, PNG, or WEBP image',
          );
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${messages.join('; ')} and skipped.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open photos. Please try again.'),
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
    if (_error != null) setState(() => _error = null);
    if (!_form.currentState!.validate()) return;
    if (_variantsEnabled) {
      final labels = _variantDrafts
          .map((variant) => variant.label.text.trim().toLowerCase())
          .toList();
      final quantities = _variantDrafts
          .map((variant) => int.tryParse(variant.stockQuantity.text.trim()))
          .toList();
      if (_variantDrafts.isEmpty || labels.any((label) => label.isEmpty)) {
        setState(() => _error = 'Add a name for every product option.');
        return;
      }
      if (labels.toSet().length != labels.length) {
        setState(() => _error = 'Each product option needs a different name.');
        return;
      }
      if (quantities.any((quantity) => quantity == null || quantity < 0)) {
        setState(
          () => _error =
              'Enter a whole stock quantity of 0 or more for each option.',
        );
        return;
      }
      if (quantities.fold<int>(0, (sum, quantity) => sum + (quantity ?? 0)) <=
          0) {
        setState(() => _error = 'At least one product option must have stock.');
        return;
      }
      if (quantities.fold<int>(0, (sum, quantity) => sum + (quantity ?? 0)) >
          _maxStock) {
        setState(
          () =>
              _error = 'Combined option stock cannot exceed $_maxStock units.',
        );
        return;
      }
    }
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
          'stock_quantity': _variantsEnabled
              ? '${_variantDrafts.fold<int>(0, (sum, variant) => sum + (int.tryParse(variant.stockQuantity.text.trim()) ?? 0))}'
              : _stock.text.trim(),
          'attributes': jsonEncode(_productAttributes()),
          if (_variantsEnabled) 'variants': jsonEncode(_variantPayload()),
        },
      );
      if (mounted) {
        setState(() => _savedSuccessfully = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _editing
                  ? 'Listing updated and sent for review.'
                  : 'Listing submitted for review.',
            ),
          ),
        );
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.of(context).pop();
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = _submissionError(error));
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
    VoidCallback? onReplace,
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
                if (onReplace != null)
                  Positioned(
                    bottom: 3,
                    right: 3,
                    child: Material(
                      color: Colors.black.withValues(alpha: .62),
                      shape: const CircleBorder(),
                      child: IconButton(
                        tooltip: 'Replace $label',
                        constraints: const BoxConstraints.tightFor(
                          width: 34,
                          height: 34,
                        ),
                        padding: EdgeInsets.zero,
                        onPressed: _saving ? null : onReplace,
                        icon: const Icon(
                          Icons.edit_outlined,
                          color: Colors.white,
                          size: 17,
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
                style: const TextStyle(fontSize: 12),
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
          onReplace: image.id == null
              ? null
              : () => _replaceExistingImage(image),
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
          onReplace: () => _replaceNewImage(index),
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
            const Icon(
              Icons.photo_library_outlined,
              size: 18,
              color: TmcPalette.primary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '$count of $_maxPhotos photos',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            Text(
              'Up to 1.5 MB each',
              style: const TextStyle(fontSize: 12, color: TmcPalette.textMuted),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: TmcPalette.pageBackground,
            border: Border.all(color: TmcPalette.border),
            borderRadius: BorderRadius.circular(TmcRadius.md),
          ),
          child: const Text(
            'Add clear product photos. Your cover photo appears first in the marketplace. Supported formats: JPG, PNG, and WEBP.',
            style: TextStyle(color: TmcPalette.textMuted, fontSize: 13),
          ),
        ),
        const SizedBox(height: 12),
        if (tiles.isNotEmpty) ...[
          Wrap(spacing: 10, runSpacing: 8, children: tiles),
          const SizedBox(height: 10),
        ] else ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
            decoration: BoxDecoration(
              color: TmcPalette.surface,
              border: Border.all(color: TmcPalette.borderSoft),
              borderRadius: BorderRadius.circular(TmcRadius.md),
            ),
            child: const Column(
              children: [
                Icon(
                  Icons.add_photo_alternate_outlined,
                  size: 30,
                  color: TmcPalette.slateBlue,
                ),
                SizedBox(height: 8),
                Text(
                  'No photos added yet',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                SizedBox(height: 3),
                Text(
                  'Listings with photos are easier to browse.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: TmcPalette.textMuted, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        OutlinedButton.icon(
          onPressed: _saving || count >= _maxPhotos ? null : _chooseImages,
          icon: const Icon(Icons.add_photo_alternate_outlined),
          label: Text(count == 0 ? 'Choose photos' : 'Add more photos'),
        ),
      ],
    );
  }

  Widget _sectionCard({
    required IconData icon,
    required String title,
    required String description,
    required Widget child,
  }) => Card(
    margin: EdgeInsets.zero,
    elevation: 0,
    color: TmcPalette.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(TmcRadius.lg),
      side: const BorderSide(color: TmcPalette.border),
    ),
    child: Padding(
      padding: const EdgeInsets.all(TmcSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: TmcPalette.primarySoft,
                  borderRadius: BorderRadius.circular(TmcRadius.md),
                ),
                child: Icon(icon, color: TmcPalette.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: TmcPalette.deepNavy,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 13,
                        color: TmcPalette.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => PopScope<void>(
    canPop:
        _savedSuccessfully ||
        _discardConfirmed ||
        (!_saving && !_hasUnsavedChanges),
    onPopInvokedWithResult: (didPop, _) async {
      if (didPop || _saving || _savedSuccessfully || !_hasUnsavedChanges) {
        return;
      }
      if (await _confirmDiscardChanges() && mounted) {
        setState(() => _discardConfirmed = true);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.of(context).pop();
        });
      }
    },
    child: Scaffold(
      appBar: AppBar(title: Text(_editing ? 'Edit listing' : 'New listing')),
      body: Form(
        key: _form,
        onChanged: () {
          setState(() {
            _dirty = true;
            _error = null;
          });
        },
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 860),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                TmcSpacing.lg,
                TmcSpacing.md,
                TmcSpacing.lg,
                TmcSpacing.xxl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(TmcSpacing.lg),
                    decoration: BoxDecoration(
                      color: TmcPalette.primarySoft,
                      borderRadius: BorderRadius.circular(TmcRadius.lg),
                      border: Border.all(color: TmcPalette.border),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.fact_check_outlined,
                          color: TmcPalette.primary,
                          size: 24,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _editing
                                    ? 'Update your listing'
                                    : 'List an item',
                                style: const TextStyle(
                                  fontSize: 19,
                                  fontWeight: FontWeight.w800,
                                  color: TmcPalette.deepNavy,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _editing
                                    ? 'Changes are reviewed before the listing returns to the marketplace.'
                                    : 'Complete the details below. Your listing will be reviewed before students can see it.',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: TmcPalette.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: TmcSpacing.lg),
                  _sectionCard(
                    icon: Icons.inventory_2_outlined,
                    title: 'Product information',
                    description:
                        'Start with the details students need to know.',
                    child: Column(
                      children: [
                        TextFormField(
                          key: const ValueKey('listing-name'),
                          controller: _name,
                          autovalidateMode: AutovalidateMode.onUserInteraction,
                          textCapitalization: TextCapitalization.sentences,
                          maxLength: 255,
                          decoration: const InputDecoration(
                            labelText: 'Product name *',
                            hintText: 'For example: TMC PE uniform',
                            counterText: '',
                          ),
                          validator: _nameValidator,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          key: const ValueKey('listing-description'),
                          controller: _description,
                          autovalidateMode: AutovalidateMode.onUserInteraction,
                          minLines: 4,
                          maxLines: 7,
                          textCapitalization: TextCapitalization.sentences,
                          decoration: const InputDecoration(
                            labelText: 'Description *',
                            hintText:
                                'Describe the condition, features, defects, and what is included.',
                            alignLabelWithHint: true,
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Enter a description.'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final showStock = !_variantsEnabled;
                            final fieldWidth =
                                showStock && constraints.maxWidth >= 520
                                ? (constraints.maxWidth - 12) / 2
                                : constraints.maxWidth;
                            return Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: [
                                SizedBox(
                                  width: fieldWidth,
                                  child: TextFormField(
                                    key: const ValueKey('listing-price'),
                                    controller: _price,
                                    autovalidateMode:
                                        AutovalidateMode.onUserInteraction,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                          decimal: true,
                                        ),
                                    decoration: const InputDecoration(
                                      labelText: 'Price *',
                                      prefixText: '₱ ',
                                      helperText: 'PHP, up to 2 decimal places',
                                    ),
                                    validator: _priceValidator,
                                  ),
                                ),
                                if (showStock)
                                  SizedBox(
                                    width: fieldWidth,
                                    child: TextFormField(
                                      key: const ValueKey('listing-stock'),
                                      controller: _stock,
                                      autovalidateMode:
                                          AutovalidateMode.onUserInteraction,
                                      keyboardType: TextInputType.number,
                                      decoration: InputDecoration(
                                        labelText: 'Available stock *',
                                        helperText: _editing
                                            ? 'Changes return the listing to review.'
                                            : 'Enter the number of units available.',
                                      ),
                                      validator: _stockValidator,
                                    ),
                                  ),
                              ],
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: TmcSpacing.md),
                  _sectionCard(
                    icon: Icons.tune_rounded,
                    title: 'Inventory and options',
                    description:
                        'Use options only when each choice has its own stock.',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('This listing has product options'),
                          subtitle: const Text(
                            'For example, sizes or colors with separate quantities.',
                          ),
                          value: _variantsEnabled,
                          onChanged:
                              _saving ||
                                  widget.product?.variants.isNotEmpty == true
                              ? null
                              : _setVariantsEnabled,
                        ),
                        if (_variantsEnabled) ...[
                          const SizedBox(height: 6),
                          const Text(
                            'Each option has its own stock. The listing total is calculated from its options.',
                            style: TextStyle(
                              color: TmcPalette.textMuted,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 12),
                          for (
                            var index = 0;
                            index < _variantDrafts.length;
                            index++
                          )
                            Card(
                              margin: const EdgeInsets.only(bottom: 10),
                              color: TmcPalette.pageBackground,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                  TmcRadius.md,
                                ),
                                side: const BorderSide(
                                  color: TmcPalette.border,
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: TextFormField(
                                            controller:
                                                _variantDrafts[index].label,
                                            autovalidateMode: AutovalidateMode
                                                .onUserInteraction,
                                            maxLength: 120,
                                            decoration: InputDecoration(
                                              labelText:
                                                  'Option ${index + 1} name *',
                                              hintText:
                                                  'For example: Small / Blue',
                                              counterText: '',
                                            ),
                                            validator: (value) =>
                                                _variantsEnabled &&
                                                    (value == null ||
                                                        value.trim().isEmpty)
                                                ? 'Enter an option name.'
                                                : null,
                                          ),
                                        ),
                                        const SizedBox(width: 4),
                                        IconButton(
                                          tooltip: 'Remove option ${index + 1}',
                                          onPressed:
                                              _saving ||
                                                  _variantDrafts.length <= 1
                                              ? null
                                              : () => _removeVariant(index),
                                          icon: const Icon(
                                            Icons.delete_outline,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    TextFormField(
                                      controller:
                                          _variantDrafts[index].stockQuantity,
                                      autovalidateMode:
                                          AutovalidateMode.onUserInteraction,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                        labelText:
                                            'Available units for this option *',
                                      ),
                                      validator: _variantsEnabled
                                          ? _stockValidator
                                          : null,
                                    ),
                                    const SizedBox(height: 10),
                                    for (final field in const [
                                      ('size', 'Size'),
                                      ('color', 'Color'),
                                      ('type', 'Type / fit'),
                                    ]) ...[
                                      TextFormField(
                                        controller: _variantDrafts[index]
                                            .attributes[field.$1],
                                        maxLength: 120,
                                        decoration: InputDecoration(
                                          labelText: '${field.$2} (optional)',
                                          counterText: '',
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: OutlinedButton.icon(
                              onPressed: _saving || _variantDrafts.length >= 100
                                  ? null
                                  : () => setState(
                                      () => _addVariantDraft(_VariantDraft()),
                                    ),
                              icon: const Icon(Icons.add),
                              label: const Text('Add another option'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: TmcSpacing.md),
                  _sectionCard(
                    icon: Icons.category_outlined,
                    title: 'Category',
                    description: 'Choose an active category managed by TMC.',
                    child: Builder(
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
                        if (selectedCategoryId == null &&
                            widget.product != null) {
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
                              autovalidateMode:
                                  AutovalidateMode.onUserInteraction,
                              key: ValueKey(
                                categories
                                    .map((category) => category.id)
                                    .join(','),
                              ),
                              initialValue: selectedCategoryId,
                              isExpanded: true,
                              decoration: InputDecoration(
                                labelText: 'Category *',
                                helperText: marketplace.categoriesLoading
                                    ? 'Loading active categories…'
                                    : categories.isEmpty
                                    ? 'No active categories are available.'
                                    : 'Select one category for this listing.',
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
                                  : (value) => setState(
                                      () => _selectedCategoryId = value,
                                    ),
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
                                      'Could not load categories. Check your connection and retry.',
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
                  ),
                  const SizedBox(height: TmcSpacing.md),
                  _sectionCard(
                    icon: Icons.info_outline_rounded,
                    title: 'More product details',
                    description:
                        'Optional information can help students decide.',
                    child: ExpansionTile(
                      tilePadding: EdgeInsets.zero,
                      childrenPadding: const EdgeInsets.only(top: 8),
                      maintainState: true,
                      title: const Text(
                        'Add condition, brand, and other details',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: const Text(
                        'All fields in this section are optional.',
                      ),
                      children: [
                        DropdownButtonFormField<String>(
                          initialValue: _condition,
                          decoration: const InputDecoration(
                            labelText: 'Condition (optional)',
                          ),
                          items: const [
                            DropdownMenuItem(value: 'new', child: Text('New')),
                            DropdownMenuItem(
                              value: 'used',
                              child: Text('Used'),
                            ),
                          ],
                          onChanged: _saving
                              ? null
                              : (value) => setState(() => _condition = value),
                        ),
                        for (final field in const [
                          ('brand', 'Brand'),
                          ('material', 'Material'),
                          ('model', 'Model / version'),
                          ('dimensions', 'Dimensions'),
                          ('subject', 'Subject'),
                          ('edition', 'Edition'),
                          ('author', 'Author'),
                          ('uniform_type', 'Uniform type'),
                          ('notes', 'Other details'),
                        ]) ...[
                          const SizedBox(height: 10),
                          TextFormField(
                            controller: _attributeControllers[field.$1],
                            maxLength: 255,
                            decoration: InputDecoration(
                              labelText: '${field.$2} (optional)',
                              counterText: '',
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: TmcSpacing.md),
                  _sectionCard(
                    icon: Icons.photo_library_outlined,
                    title: 'Product photos',
                    description:
                        'Use a clear cover image and add more views if needed.',
                    child: _buildPhotoSection(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: TmcSpacing.md),
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: TmcPalette.errorSoft,
                          borderRadius: BorderRadius.circular(TmcRadius.md),
                          border: Border.all(color: TmcPalette.error),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.error_outline,
                              color: TmcPalette.error,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: const TextStyle(color: TmcPalette.error),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: TmcSpacing.lg),
                  FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(TmcRadius.md),
                      ),
                    ),
                    icon: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send_outlined),
                    label: Text(
                      _saving
                          ? 'Submitting…'
                          : _editing
                          ? 'Save and resubmit'
                          : 'Submit for review',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _editing
                        ? 'Your saved changes will return this listing to review.'
                        : 'You will see your listing in My Listings while it is under review.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: TmcPalette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
