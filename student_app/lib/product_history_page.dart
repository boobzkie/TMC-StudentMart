import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'tmc_theme.dart';

class ProductHistoryPage extends StatefulWidget {
  const ProductHistoryPage({super.key, required this.product});

  final Product product;

  @override
  State<ProductHistoryPage> createState() => _ProductHistoryPageState();
}

class _ProductHistoryPageState extends State<ProductHistoryPage> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _history = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final payload = asMap(
        await context.read<ApiService>().get(
          '/my-products/${widget.product.id}/history',
        ),
      );
      final rows = listFrom(payload, 'history');
      if (!mounted) return;
      setState(() {
        _history = rows.map((row) => asMap(row)).toList();
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _date(dynamic value) {
    final parsed = DateTime.tryParse(valueOf(value));
    if (parsed == null) return 'Date unavailable';
    final local = parsed.toLocal();
    final month = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '${local.year}-$month-$day  $hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Product history'),
        actions: [
          IconButton(
            tooltip: 'Refresh history',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Card(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 10),
            child: ListTile(
              leading: SizedBox(
                width: 54,
                child: ProductPhoto(product: product, height: 54),
              ),
              title: Text(
                product.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                'Stock ${product.stockQuantity} · ${product.status.replaceAll('_', ' ')}',
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading && _history.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null && _history.isEmpty
                  ? ListView(
                      children: [
                        const SizedBox(height: 90),
                        EmptyMessage(
                          icon: Icons.history,
                          title: 'History could not load',
                          message: _error!,
                        ),
                        Center(
                          child: TextButton.icon(
                            onPressed: _load,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Try again'),
                          ),
                        ),
                      ],
                    )
                  : _history.isEmpty
                  ? ListView(
                      children: [
                        const SizedBox(height: 90),
                        EmptyMessage(
                          icon: Icons.history,
                          title: 'No history yet',
                          message:
                              'Product and order activity will appear here.',
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                      itemCount: _history.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final entry = _history[index];
                        final before = entry['stock_before'];
                        final after = entry['stock_after'];
                        final orderNumber = valueOf(entry['order_number']);
                        final orderStatus = valueOf(entry['order_status']);
                        final quantity = valueOf(entry['quantity']);
                        final amount = valueOf(entry['amount']);
                        return Card(
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.circle,
                                      size: 10,
                                      color: TmcPalette.navyBlue,
                                    ),
                                    const SizedBox(width: 9),
                                    Expanded(
                                      child: Text(
                                        valueOf(entry['label']),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    Text(
                                      _date(entry['occurred_at']),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: TmcPalette.darkGray,
                                      ),
                                    ),
                                  ],
                                ),
                                if (valueOf(entry['note']).isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(valueOf(entry['note'])),
                                ],
                                if (before != null || after != null) ...[
                                  const SizedBox(height: 7),
                                  Text(
                                    'Stock: ${before ?? '—'} → ${after ?? '—'}',
                                  ),
                                ],
                                if (orderNumber.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 6,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      Text(
                                        orderNumber,
                                        style: const TextStyle(
                                          color: TmcPalette.navyBlue,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      if (orderStatus.isNotEmpty)
                                        StatusBadge(orderStatus),
                                      if (quantity.isNotEmpty)
                                        Text('Qty $quantity'),
                                      if (amount.isNotEmpty)
                                        Text(
                                          peso(double.tryParse(amount) ?? 0),
                                        ),
                                    ],
                                  ),
                                ],
                                if (valueOf(entry['actor']).isNotEmpty) ...[
                                  const SizedBox(height: 7),
                                  Text(
                                    'By ${valueOf(entry['actor'])}',
                                    style: const TextStyle(
                                      color: TmcPalette.darkGray,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
