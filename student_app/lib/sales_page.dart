import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'order_details_page.dart';
import 'tmc_theme.dart';

class SalesPage extends StatefulWidget {
  const SalesPage({super.key});

  @override
  State<SalesPage> createState() => _SalesPageState();
}

class _SalesPageState extends State<SalesPage> {
  static const _pageSize = 25;
  static const _statuses = <({String value, String label, Color color})>[
    (value: 'pending', label: 'Placed', color: TmcPalette.warning),
    (value: 'confirmed', label: 'Accepted', color: TmcPalette.primary),
    (
      value: 'ready_for_pickup',
      label: 'Ready for pickup',
      color: TmcPalette.information,
    ),
    (value: 'completed', label: 'Completed', color: TmcPalette.success),
    (value: 'declined', label: 'Declined', color: TmcPalette.error),
    (value: 'cancelled', label: 'Cancelled', color: TmcPalette.slateBlue),
  ];
  static const _ranges = <({String value, String label})>[
    (value: 'today', label: 'Today'),
    (value: '7d', label: '7 days'),
    (value: '30d', label: '30 days'),
    (value: '90d', label: '90 days'),
    (value: '12m', label: '12 months'),
    (value: 'all', label: 'All time'),
  ];

  final TextEditingController _searchController = TextEditingController();
  final Set<int> _busyOrderIds = <int>{};
  List<Map<String, dynamic>> _orders = <Map<String, dynamic>>[];
  Map<String, dynamic>? _summary;
  String _statusFilter = 'all';
  String _rangeFilter = '30d';
  DateTimeRange? _customRange;
  String? _error;
  Timer? _searchDebounce;
  bool _loading = false;
  bool _loadingMore = false;
  bool _hasMore = false;
  int _page = 0;
  int _filteredTotal = 0;
  int _requestGeneration = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_fetchOrders());
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  DateTimeRange? _selectedDateRange() {
    if (_rangeFilter == 'all') return null;
    if (_rangeFilter == 'custom') return _customRange;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final start = switch (_rangeFilter) {
      'today' => today,
      '7d' => today.subtract(const Duration(days: 6)),
      '90d' => today.subtract(const Duration(days: 89)),
      '12m' => DateTime(today.year, today.month - 11),
      _ => today.subtract(const Duration(days: 29)),
    };
    return DateTimeRange(
      start: start,
      end: DateTime(now.year, now.month, now.day, 23, 59, 59, 999),
    );
  }

  Map<String, String> _requestParameters({required int page}) {
    final parameters = <String, String>{
      'dashboard': '1',
      'page': '$page',
      'per_page': '$_pageSize',
    };
    if (_statusFilter != 'all') parameters['status'] = _statusFilter;
    final search = _searchController.text.trim();
    if (search.isNotEmpty) parameters['search'] = search;

    final range = _selectedDateRange();
    if (range != null) {
      parameters['from'] = range.start.toUtc().toIso8601String();
      final endOfRange = DateTime(
        range.end.year,
        range.end.month,
        range.end.day,
        23,
        59,
        59,
        999,
      );
      parameters['to'] = endOfRange.toUtc().toIso8601String();
    }
    return parameters;
  }

  Future<void> _fetchOrders({bool append = false}) async {
    if (append && (_loading || _loadingMore)) return;
    final generation = ++_requestGeneration;
    final requestedPage = append ? _page + 1 : 1;
    setState(() {
      if (append) {
        _loadingMore = true;
      } else {
        _loading = true;
        _loadingMore = false;
        _error = null;
        _orders = <Map<String, dynamic>>[];
        _summary = null;
        _page = 0;
        _filteredTotal = 0;
        _hasMore = false;
      }
    });

    try {
      final query = Uri(
        queryParameters: _requestParameters(page: requestedPage),
      ).query;
      final response = asMap(
        await context.read<ApiService>().get('/seller/orders?$query'),
      );
      final rawOrders = response['orders'];
      final receivedOrders = rawOrders is List
          ? rawOrders.map((row) => asMap(row)).toList(growable: false)
          : <Map<String, dynamic>>[];
      final pagination = asMap(response['pagination']);
      if (!mounted || generation != _requestGeneration) return;

      setState(() {
        if (append) {
          _orders = [..._orders, ...receivedOrders];
        } else {
          _orders = receivedOrders;
        }
        _summary = asMap(response['summary']);
        _filteredTotal =
            int.tryParse(valueOf(pagination['total'] ?? response['total'])) ??
            _orders.length;
        _page =
            int.tryParse(valueOf(pagination['current_page'])) ?? requestedPage;
        final lastPage =
            int.tryParse(valueOf(pagination['last_page'])) ?? _page;
        _hasMore = _page < lastPage;
        _error = null;
      });
    } catch (error) {
      if (mounted && generation == _requestGeneration) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted && generation == _requestGeneration) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _reload() => _fetchOrders();

  void _scheduleSearch() {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 350), _reload);
  }

  Future<void> _chooseCustomRange() async {
    final today = DateTime.now();
    final initialRange =
        _customRange ??
        DateTimeRange(
          start: DateTime(
            today.year,
            today.month,
            today.day,
          ).subtract(const Duration(days: 29)),
          end: DateTime(today.year, today.month, today.day),
        );
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(today.year, today.month, today.day),
      initialDateRange: initialRange,
      helpText: 'Choose the sales date range',
      saveText: 'Apply range',
    );
    if (!mounted || range == null) return;
    setState(() {
      _rangeFilter = 'custom';
      _customRange = range;
    });
    unawaited(_fetchOrders());
  }

  void _selectRange(String range) {
    setState(() => _rangeFilter = range);
    unawaited(_fetchOrders());
  }

  void _selectStatus(String status) {
    if (_statusFilter == status) return;
    setState(() => _statusFilter = status);
    unawaited(_fetchOrders());
  }

  void _clearFilters() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() {
      _statusFilter = 'all';
      _rangeFilter = '30d';
      _customRange = null;
    });
    unawaited(_fetchOrders());
  }

  Future<String?> _promptDeclineReason() async {
    final controller = TextEditingController();
    try {
      return await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Decline this order?'),
          content: TextField(
            controller: controller,
            autofocus: true,
            maxLines: 3,
            maxLength: 1000,
            decoration: const InputDecoration(
              labelText: 'Reason for declining',
              hintText: 'Let the buyer know why you cannot fulfill this order.',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Keep order'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.of(dialogContext).pop(controller.text.trim()),
              child: const Text('Decline order'),
            ),
          ],
        ),
      );
    } finally {
      controller.dispose();
    }
  }

  Future<bool> _confirmTransition(String status) async {
    final details = switch (status) {
      'confirmed' => (
        title: 'Accept this order?',
        message:
            'The order will move to Accepted and the buyer will be notified.',
        action: 'Accept order',
      ),
      'ready_for_pickup' => (
        title: 'Mark order ready for pickup?',
        message: 'The buyer will be notified that the item is ready.',
        action: 'Mark ready',
      ),
      'completed' => (
        title: 'Confirm order handover',
        message:
            'Only mark this order completed after the buyer has received the item. Payment status remains separate.',
        action: 'Confirm handover',
      ),
      _ => (
        title: 'Update order?',
        message: 'Update this order status?',
        action: 'Update order',
      ),
    };
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text(details.title),
            content: Text(details.message),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Keep current status'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: Text(details.action),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _updateOrderStatus(
    Map<String, dynamic> order,
    String newStatus,
  ) async {
    final id = int.tryParse(valueOf(order['id']));
    if (id == null || _busyOrderIds.contains(id)) return;

    String? sellerNote;
    if (newStatus == 'declined') {
      sellerNote = await _promptDeclineReason();
      if (!mounted || sellerNote == null) return;
      if (sellerNote.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a reason before declining.')),
        );
        return;
      }
    } else if (!await _confirmTransition(newStatus) || !mounted) {
      return;
    }

    final payload = <String, dynamic>{'status': newStatus};
    if (sellerNote != null) payload['seller_note'] = sellerNote;
    setState(() => _busyOrderIds.add(id));

    try {
      final response = asMap(
        await context.read<ApiService>().put('/seller/orders/$id', payload),
      );
      final updatedOrder = asMap(response['order']);
      if (response['success'] != true ||
          valueOf(updatedOrder['status']) != newStatus) {
        throw const ApiException(
          'The server did not confirm this status update.',
        );
      }
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Order #${valueOf(order['order_number'])} updated.'),
        ),
      );
      await _fetchOrders();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busyOrderIds.remove(id));
    }
  }

  Future<void> _openOrder(Map<String, dynamic> order) async {
    final id = int.tryParse(valueOf(order['id']));
    if (id == null) return;
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => OrderDetailsPage(orderId: id, selling: true),
      ),
    );
    if (mounted) await _fetchOrders();
  }

  String _rangeLabel() {
    if (_rangeFilter == 'custom' && _customRange != null) {
      return '${_shortDate(_customRange!.start)} – ${_shortDate(_customRange!.end)}';
    }
    return _ranges.firstWhere((item) => item.value == _rangeFilter).label;
  }

  String _summaryValue(String key) => _money(_summary?[key] ?? 0);

  int _summaryCount(String key) => int.tryParse(valueOf(_summary?[key])) ?? 0;

  Map<String, dynamic> get _statusCounts => asMap(_summary?['status_counts']);

  void _setStatusAndReload(String status) => _selectStatus(status);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales'),
        actions: [
          IconButton(
            tooltip: 'Refresh sales',
            onPressed: _loading || _loadingMore ? null : _reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _error != null && _orders.isEmpty && !_loading
          ? ErrorMessage(message: _error!, onRetry: _reload)
          : RefreshIndicator(
              onRefresh: _reload,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                children: [
                  _pageHeading(),
                  const SizedBox(height: 18),
                  if (_error != null) ...[
                    _inlineError(),
                    const SizedBox(height: 12),
                  ],
                  if (_summary == null && _loading)
                    _summaryLoading()
                  else if (_summary != null) ...[
                    _paidRevenueCard(),
                    const SizedBox(height: 12),
                    _metricsGrid(),
                    const SizedBox(height: 18),
                    _statusDistribution(),
                  ],
                  const SizedBox(height: 20),
                  _dateFilters(),
                  const SizedBox(height: 12),
                  _searchField(),
                  const SizedBox(height: 12),
                  _statusFilters(),
                  const SizedBox(height: 18),
                  SectionHeading(
                    'Orders',
                    action: Text(
                      '$_filteredTotal found',
                      style: const TextStyle(
                        color: TmcPalette.textMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_loading && _orders.isEmpty)
                    _ordersLoading()
                  else if (_orders.isEmpty)
                    _emptyOrders()
                  else ...[
                    for (final order in _orders) ...[
                      _SalesOrderCard(
                        order: order,
                        isBusy: _busyOrderIds.contains(
                          int.tryParse(valueOf(order['id'])) ?? 0,
                        ),
                        onOpen: () => unawaited(_openOrder(order)),
                        onStatus: (status) =>
                            unawaited(_updateOrderStatus(order, status)),
                      ),
                      const SizedBox(height: 10),
                    ],
                    if (_hasMore)
                      Center(
                        child: OutlinedButton.icon(
                          onPressed: _loadingMore
                              ? null
                              : () => unawaited(_fetchOrders(append: true)),
                          icon: _loadingMore
                              ? const SizedBox.square(
                                  dimension: 17,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.expand_more),
                          label: Text(
                            _loadingMore
                                ? 'Loading orders…'
                                : 'Load more orders',
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _pageHeading() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'Sales overview',
        style: TextStyle(
          color: TmcPalette.deepNavy,
          fontSize: 27,
          fontWeight: FontWeight.w900,
          letterSpacing: -.35,
        ),
      ),
      const SizedBox(height: 4),
      const Text(
        'Track paid orders, fulfillment, and buyer requests.',
        style: TextStyle(color: TmcPalette.textMuted, fontSize: 14),
      ),
      const SizedBox(height: 10),
      Row(
        children: [
          const Icon(Icons.calendar_today_outlined, size: 15),
          const SizedBox(width: 6),
          Text(
            'Showing ${_rangeLabel().toLowerCase()}',
            style: const TextStyle(
              color: TmcPalette.textMuted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ],
  );

  Widget _paidRevenueCard() => TmcPanel(
    color: TmcPalette.deepNavy,
    dark: true,
    padding: const EdgeInsets.all(20),
    child: Semantics(
      container: true,
      label:
          'Paid revenue ${_summaryValue('paid_revenue')}. Only orders recorded as paid are included.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.account_balance_wallet_outlined,
                color: TmcPalette.white,
              ),
              const SizedBox(width: 9),
              const Expanded(
                child: Text(
                  'Paid revenue',
                  style: TextStyle(
                    color: TmcPalette.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _rangeTag(),
            ],
          ),
          const SizedBox(height: 12),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              _summaryValue('paid_revenue'),
              style: const TextStyle(
                color: TmcPalette.white,
                fontSize: 31,
                height: 1.1,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Only orders marked paid are included. Completed order value is shown separately.',
            style: TextStyle(
              color: TmcPalette.white.withValues(alpha: .82),
              fontSize: 13,
              height: 1.4,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _rangeTag() => DecoratedBox(
    decoration: BoxDecoration(
      color: TmcPalette.white.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(TmcRadius.pill),
      border: Border.all(color: TmcPalette.white.withValues(alpha: .26)),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Text(
        _rangeLabel(),
        style: const TextStyle(
          color: TmcPalette.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
  );

  Widget _metricsGrid() => LayoutBuilder(
    builder: (context, constraints) {
      final columns = constraints.maxWidth >= 850
          ? 4
          : constraints.maxWidth >= 520
          ? 2
          : 2;
      const gap = 10.0;
      final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [
          SizedBox(
            width: width,
            child: _MetricCard(
              label: 'Total orders',
              value: '${_summaryCount('total_orders')}',
              icon: Icons.receipt_long_outlined,
              color: TmcPalette.primary,
              onTap: () => _setStatusAndReload('all'),
            ),
          ),
          SizedBox(
            width: width,
            child: _MetricCard(
              label: 'Needs response',
              value: '${_summaryCount('pending_orders')}',
              icon: Icons.hourglass_top_rounded,
              color: TmcPalette.warning,
              onTap: () => _setStatusAndReload('pending'),
            ),
          ),
          SizedBox(
            width: width,
            child: _MetricCard(
              label: 'Completed orders',
              value: '${_summaryCount('completed_orders')}',
              icon: Icons.task_alt_rounded,
              color: TmcPalette.success,
              onTap: () => _setStatusAndReload('completed'),
            ),
          ),
          SizedBox(
            width: width,
            child: _MetricCard(
              label: 'Completed order value',
              value: _summaryValue('completed_order_value'),
              icon: Icons.shopping_bag_outlined,
              color: TmcPalette.information,
              footnote: 'Paid or unpaid',
            ),
          ),
          SizedBox(
            width: width,
            child: _MetricCard(
              label: 'Open order value',
              value: _summaryValue('open_order_value'),
              icon: Icons.pending_actions_outlined,
              color: TmcPalette.warning,
              footnote: 'Placed, accepted, or ready for pickup',
            ),
          ),
          SizedBox(
            width: width,
            child: _MetricCard(
              label: 'Gross order value',
              value: _summaryValue('gross_order_value'),
              icon: Icons.stacked_line_chart,
              color: TmcPalette.slateBlue,
              footnote: 'Excludes declined and cancelled',
            ),
          ),
          SizedBox(
            width: width,
            child: _MetricCard(
              label: 'Avg. completed order',
              value: _summaryValue('average_completed_order_value'),
              icon: Icons.analytics_outlined,
              color: TmcPalette.mutedTeal,
              footnote: 'Completed value ÷ completed orders',
            ),
          ),
        ],
      );
    },
  );

  Widget _statusDistribution() {
    final maxCount = _statuses.fold<int>(
      0,
      (maxValue, status) => maxValue > _statusCount(status.value)
          ? maxValue
          : _statusCount(status.value),
    );
    return TmcPanel(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeading('Order status breakdown'),
          const SizedBox(height: 14),
          for (final status in _statuses) ...[
            Semantics(
              label: '${status.label}: ${_statusCount(status.value)} orders',
              child: Row(
                children: [
                  SizedBox(
                    width: 132,
                    child: Text(
                      status.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.textMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(TmcRadius.pill),
                      child: LinearProgressIndicator(
                        value: maxCount == 0
                            ? 0
                            : _statusCount(status.value) / maxCount,
                        minHeight: 9,
                        color: status.color,
                        backgroundColor: TmcPalette.borderSoft,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 28,
                    child: Text(
                      '${_statusCount(status.value)}',
                      textAlign: TextAlign.end,
                      style: const TextStyle(
                        color: TmcPalette.deepNavy,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (status != _statuses.last) const SizedBox(height: 11),
          ],
        ],
      ),
    );
  }

  int _statusCount(String status) =>
      int.tryParse(valueOf(_statusCounts[status])) ?? 0;

  Widget _dateFilters() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const SectionHeading('Date range'),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final range in _ranges)
            ChoiceChip(
              label: Text(range.label),
              selected: _rangeFilter == range.value,
              onSelected: (_) => _selectRange(range.value),
            ),
          ActionChip(
            avatar: const Icon(Icons.date_range_outlined, size: 17),
            label: Text(
              _rangeFilter == 'custom' ? _rangeLabel() : 'Custom dates',
            ),
            onPressed: _chooseCustomRange,
          ),
        ],
      ),
    ],
  );

  Widget _searchField() => TextField(
    controller: _searchController,
    onChanged: (_) {
      setState(() {});
      _scheduleSearch();
    },
    textInputAction: TextInputAction.search,
    onSubmitted: (_) {
      _searchDebounce?.cancel();
      unawaited(_fetchOrders());
    },
    decoration: InputDecoration(
      labelText: 'Search orders',
      hintText: 'Order reference, buyer, or item',
      prefixIcon: const Icon(Icons.search),
      suffixIcon: _searchController.text.isEmpty
          ? null
          : IconButton(
              tooltip: 'Clear search',
              onPressed: () {
                _searchController.clear();
                unawaited(_fetchOrders());
              },
              icon: const Icon(Icons.close),
            ),
    ),
  );

  Widget _statusFilters() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const SectionHeading('Filter by status'),
      const SizedBox(height: 8),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _statusChip('all', 'All', _summaryCount('total_orders')),
            for (final status in _statuses)
              _statusChip(
                status.value,
                status.label,
                _statusCount(status.value),
              ),
          ],
        ),
      ),
    ],
  );

  Widget _statusChip(String value, String label, int count) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text('$label ($count)'),
      selected: _statusFilter == value,
      onSelected: (_) => _selectStatus(value),
    ),
  );

  Widget _emptyOrders() {
    final hasActiveFilters =
        _statusFilter != 'all' ||
        _rangeFilter != '30d' ||
        _searchController.text.trim().isNotEmpty;
    return TmcPanel(
      padding: const EdgeInsets.all(22),
      child: Column(
        children: [
          Icon(
            hasActiveFilters
                ? Icons.filter_alt_off_outlined
                : Icons.receipt_long_outlined,
            size: 34,
            color: TmcPalette.primary,
          ),
          const SizedBox(height: 10),
          Text(
            hasActiveFilters ? 'No matching orders' : 'No sales orders yet',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 5),
          Text(
            hasActiveFilters
                ? 'Try another status, date range, or search term.'
                : 'New requests for your listings will appear here.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: TmcPalette.textMuted, height: 1.4),
          ),
          if (hasActiveFilters) ...[
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: _clearFilters,
              icon: const Icon(Icons.filter_alt_off_outlined),
              label: const Text('Clear filters'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryLoading() => Column(
    children: [
      TmcPanel(
        color: TmcPalette.deepNavy,
        dark: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Loading sales summary',
              style: TextStyle(
                color: TmcPalette.white,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(
              color: TmcPalette.white,
              backgroundColor: TmcPalette.white.withValues(alpha: .2),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      for (var index = 0; index < 2; index++) ...[
        TmcPanel(
          padding: const EdgeInsets.all(20),
          child: LinearProgressIndicator(
            color: TmcPalette.primary.withValues(alpha: .45),
          ),
        ),
        const SizedBox(height: 10),
      ],
    ],
  );

  Widget _ordersLoading() => const Padding(
    padding: EdgeInsets.symmetric(vertical: 24),
    child: Center(
      child: Column(
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 12),
          Text(
            'Loading orders…',
            style: TextStyle(color: TmcPalette.textMuted),
          ),
        ],
      ),
    ),
  );

  Widget _inlineError() => TmcPanel(
    color: TmcPalette.errorSoft,
    padding: const EdgeInsets.all(12),
    child: Row(
      children: [
        const Icon(Icons.cloud_off_outlined, color: TmcPalette.error),
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            'Could not refresh sales: $_error',
            style: const TextStyle(color: TmcPalette.error),
          ),
        ),
        IconButton(
          tooltip: 'Retry loading sales',
          onPressed: _loading ? null : _reload,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
  );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.footnote,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String? footnote;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => TmcPanel(
    padding: const EdgeInsets.all(15),
    child: Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(TmcRadius.md),
      child: Semantics(
        button: onTap != null,
        label: '$label: $value${footnote == null ? '' : ', $footnote'}',
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(TmcRadius.md),
          child: Padding(
            padding: const EdgeInsets.all(1),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: color, size: 23),
                const SizedBox(height: 10),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    maxLines: 1,
                    style: TextStyle(
                      color: color,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: const TextStyle(
                    color: TmcPalette.textMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (footnote != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    footnote!,
                    style: const TextStyle(
                      color: TmcPalette.textSoft,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _SalesOrderCard extends StatelessWidget {
  const _SalesOrderCard({
    required this.order,
    required this.isBusy,
    required this.onOpen,
    required this.onStatus,
  });

  final Map<String, dynamic> order;
  final bool isBusy;
  final VoidCallback onOpen;
  final ValueChanged<String> onStatus;

  static const _nextStatuses = <String, List<String>>{
    'pending': ['confirmed', 'declined'],
    'confirmed': ['ready_for_pickup'],
    'ready_for_pickup': ['completed'],
  };

  static const _statusInfo = <String, ({String label, Color color})>{
    'pending': (label: 'Placed', color: TmcPalette.warning),
    'confirmed': (label: 'Accepted', color: TmcPalette.primary),
    'ready_for_pickup': (
      label: 'Ready for pickup',
      color: TmcPalette.information,
    ),
    'completed': (label: 'Completed', color: TmcPalette.success),
    'declined': (label: 'Declined', color: TmcPalette.error),
    'cancelled': (label: 'Cancelled', color: TmcPalette.slateBlue),
  };

  String _statusLabel(String status) =>
      _statusInfo[status]?.label ??
      (status.isEmpty ? 'Unknown status' : status.replaceAll('_', ' '));

  @override
  Widget build(BuildContext context) {
    final status = valueOf(order['status']);
    final orderNumber = valueOf(order['order_number']);
    final buyer = asMap(order['buyer']);
    final buyerName = valueOf(buyer['name']).isEmpty
        ? 'Buyer'
        : valueOf(buyer['name']);
    final rawItems = order['items'];
    final items = rawItems is List
        ? rawItems.map(asMap).toList()
        : <Map<String, dynamic>>[];
    final firstProduct = items.isEmpty
        ? ''
        : valueOf(items.first['product_name']);
    final otherItemCount = items.length - 1;
    final paymentStatus = valueOf(order['payment_status']);
    final paid = paymentStatus == 'paid';
    final nextStatuses = _nextStatuses[status] ?? const <String>[];
    final statusColor = _statusInfo[status]?.color ?? TmcPalette.slateBlue;

    return TmcPanel(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      orderNumber.isEmpty
                          ? 'Order #${valueOf(order['id'])}'
                          : 'Order #$orderNumber',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.deepNavy,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      buyerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.textMuted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _money(order['total_amount']),
                    style: const TextStyle(
                      color: TmcPalette.deepNavy,
                      fontWeight: FontWeight.w900,
                      fontSize: 17,
                    ),
                  ),
                  const SizedBox(height: 6),
                  _StatusBadge(label: _statusLabel(status), color: statusColor),
                ],
              ),
            ],
          ),
          const SizedBox(height: 11),
          Wrap(
            spacing: 8,
            runSpacing: 7,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _InfoLabel(
                icon: Icons.schedule_outlined,
                label: _formatOrderDate(order['created_at']),
              ),
              _InfoLabel(
                icon: paid ? Icons.verified_outlined : Icons.payments_outlined,
                label: paid ? 'Paid' : 'Unpaid',
                color: paid ? TmcPalette.success : TmcPalette.warning,
              ),
            ],
          ),
          if (firstProduct.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              otherItemCount > 0
                  ? '$firstProduct · +$otherItemCount more item${otherItemCount == 1 ? '' : 's'}'
                  : firstProduct,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: TmcPalette.textMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 8),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              TextButton.icon(
                onPressed: onOpen,
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('Order details'),
                style: TextButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                ),
              ),
              if (nextStatuses.isNotEmpty)
                SizedBox(
                  width: 164,
                  child: DropdownButtonFormField<String>(
                    key: ValueKey<String>(
                      'order-status-$status-${order['id']}',
                    ),
                    initialValue: null,
                    hint: Text(isBusy ? 'Updating…' : 'Update status'),
                    items: nextStatuses
                        .map(
                          (nextStatus) => DropdownMenuItem<String>(
                            value: nextStatus,
                            child: Text(_statusLabel(nextStatus)),
                          ),
                        )
                        .toList(growable: false),
                    onChanged: isBusy
                        ? null
                        : (nextStatus) {
                            if (nextStatus != null) onStatus(nextStatus);
                          },
                    decoration: const InputDecoration(
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      isDense: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.all(
                          Radius.circular(TmcRadius.md),
                        ),
                      ),
                    ),
                    icon: isBusy
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.expand_more),
                  ),
                )
              else
                Text(
                  _statusLabel(status),
                  style: const TextStyle(
                    color: TmcPalette.textSoft,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Order status: $label',
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(TmcRadius.pill),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
  );
}

class _InfoLabel extends StatelessWidget {
  const _InfoLabel({required this.icon, required this.label, this.color});

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 15, color: color ?? TmcPalette.textSoft),
      const SizedBox(width: 5),
      Text(
        label,
        style: TextStyle(
          color: color ?? TmcPalette.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

String _money(dynamic rawValue) {
  final raw = valueOf(rawValue).trim();
  final match = RegExp(r'^(-?)(\d+)(?:\.(\d+))?$').firstMatch(raw);
  if (match == null) return '₱0.00';
  final negative = match.group(1) ?? '';
  final whole = match.group(2)!;
  final fraction = (match.group(3) ?? '').padRight(2, '0');
  final grouped = StringBuffer();
  for (var index = 0; index < whole.length; index++) {
    if (index > 0 && (whole.length - index) % 3 == 0) grouped.write(',');
    grouped.write(whole[index]);
  }
  return '₱$negative$grouped.${fraction.substring(0, 2)}';
}

String _formatOrderDate(dynamic rawValue) {
  final date = DateTime.tryParse(valueOf(rawValue));
  if (date == null) return 'Date unavailable';
  final localDate = date.isUtc ? date.toLocal() : date;
  const months = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final hour = localDate.hour % 12 == 0 ? 12 : localDate.hour % 12;
  final minute = localDate.minute.toString().padLeft(2, '0');
  final suffix = localDate.hour < 12 ? 'AM' : 'PM';
  return '${months[localDate.month - 1]} ${localDate.day}, ${localDate.year} · $hour:$minute $suffix';
}

String _shortDate(DateTime date) => '${date.month}/${date.day}/${date.year}';
