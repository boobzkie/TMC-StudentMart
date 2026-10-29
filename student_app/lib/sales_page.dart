import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "components.dart";
import "data.dart";
import "order_details_page.dart";
import "tmc_theme.dart";

class SalesPage extends StatefulWidget {
  const SalesPage({super.key});

  @override
  State<SalesPage> createState() => _SalesPageState();
}

class _SalesPageState extends State<SalesPage> {
  late Future<Map<String, dynamic>> _future;
  String _statusFilter = "all";
  final Set<int> _busyOrderIds = <int>{};

  static const _statuses = <(String, String)>[
    ("all", "All"),
    ("pending", "Placed"),
    ("confirmed", "Accepted"),
    ("ready_for_pickup", "Ready for pickup"),
    ("completed", "Completed"),
    ("declined", "Declined"),
    ("cancelled", "Cancelled"),
  ];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    return asMap(await context.read<ApiService>().get("/seller/orders"));
  }

  void _reload() {
    setState(() {
      _future = _load();
    });
  }

  Future<String?> _promptDeclineReason() async {
    final controller = TextEditingController();
    try {
      return await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text("Decline this order?"),
          content: TextField(
            controller: controller,
            autofocus: true,
            maxLines: 3,
            maxLength: 1000,
            decoration: const InputDecoration(
              labelText: "Reason for declining",
              hintText: "Let the buyer know why you cannot fulfill this order.",
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text("Cancel"),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.of(dialogContext).pop(controller.text.trim()),
              child: const Text("Decline order"),
            ),
          ],
        ),
      );
    } finally {
      controller.dispose();
    }
  }

  List<Map<String, dynamic>> _filteredOrders(
    List<Map<String, dynamic>> orders,
  ) {
    if (_statusFilter == "all") return orders;
    return orders.where((o) => valueOf(o["status"]) == _statusFilter).toList();
  }

  double _revenue(List<Map<String, dynamic>> orders) {
    double total = 0;
    for (final o in orders) {
      final st = valueOf(o["status"]);
      if (st == "completed" || st == "confirmed") {
        total += double.tryParse(valueOf(o["total_amount"])) ?? 0;
      }
    }
    return total;
  }

  Future<void> _updateOrderStatus(
    Map<String, dynamic> order,
    String newStatus,
  ) async {
    final id = int.tryParse(valueOf(order["id"]));
    if (id == null || _busyOrderIds.contains(id)) return;

    String? sellerNote;
    if (newStatus == "declined") {
      sellerNote = await _promptDeclineReason();
      if (!mounted || sellerNote == null) return;
      if (sellerNote.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Enter a reason before declining.")),
        );
        return;
      }
    }

    final payload = <String, dynamic>{"status": newStatus};
    if (sellerNote != null) payload["seller_note"] = sellerNote;

    setState(() => _busyOrderIds.add(id));
    try {
      await context.read<ApiService>().put("/seller/orders/$id", payload);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Order #${valueOf(order["order_number"])} updated."),
        ),
      );
      _reload();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busyOrderIds.remove(id));
    }
  }

  void _openOrder(Map<String, dynamic> order) {
    final id = int.tryParse(valueOf(order["id"]));
    if (id == null) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => OrderDetailsPage(orderId: id, selling: true),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Sales"),
        actions: [
          IconButton(
            tooltip: "Refresh sales",
            onPressed: _reload,
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
              onRetry: _reload,
            );
          }
          final data = snapshot.data;
          if (data == null) {
            return ErrorMessage(
              message: "Sales data is not available.",
              onRetry: _reload,
            );
          }
          final rawOrders = data["orders"];
          final orders = rawOrders is List
              ? rawOrders.map((row) => asMap(row)).toList()
              : <Map<String, dynamic>>[];
          final filtered = _filteredOrders(orders);
          final revenue = _revenue(orders);

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeading("Sales summary"),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _summaryCard(
                            "Total sales",
                            "${orders.length} orders",
                            Icons.storefront_outlined,
                            TmcPalette.primary,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _summaryCard(
                            "Revenue",
                            peso(revenue),
                            Icons.attach_money,
                            TmcPalette.success,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _statuses.map((entry) {
                        final selected = _statusFilter == entry.$1;
                        return ChoiceChip(
                          label: Text(
                            entry.$2,
                            style: TextStyle(
                              color: selected
                                  ? TmcPalette.white
                                  : TmcPalette.textMuted,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          selected: selected,
                          onSelected: (_) => setState(() {
                            _statusFilter = entry.$1;
                          }),
                          selectedColor: TmcPalette.primary,
                          backgroundColor: TmcPalette.surface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(TmcRadius.pill),
                            side: BorderSide(
                              color: selected
                                  ? TmcPalette.primary
                                  : TmcPalette.border,
                            ),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: filtered.isEmpty
                    ? EmptyMessage(
                        icon: Icons.receipt_long_outlined,
                        title: "No orders",
                        message: _statusFilter == "all"
                            ? "You have no sales yet."
                            : "No ${_statuses.firstWhere((e) => e.$1 == _statusFilter).$2} orders.",
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final order = filtered[index];
                          final status = valueOf(order["status"]);
                          final buyer = asMap(order["buyer"]);
                          return _OrderRow(
                            order: order,
                            status: status,
                            buyerName: valueOf(buyer["name"]),
                            isBusy: _busyOrderIds.contains(
                              int.tryParse(valueOf(order["id"])) ?? 0,
                            ),
                            onTap: () => _openOrder(order),
                            onStatus: (newStatus) =>
                                _updateOrderStatus(order, newStatus),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _summaryCard(String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 26),
                const Spacer(),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: color == TmcPalette.primary
                    ? TmcPalette.deepNavy
                    : color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(fontSize: 12, color: TmcPalette.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderRow extends StatelessWidget {
  const _OrderRow({
    required this.order,
    required this.status,
    required this.buyerName,
    required this.isBusy,
    required this.onTap,
    required this.onStatus,
  });
  final Map<String, dynamic> order;
  final String status;
  final String buyerName;
  final bool isBusy;
  final VoidCallback onTap;
  final ValueChanged<String> onStatus;

  Color _statusColor(String status) {
    switch (status) {
      case "completed":
        return TmcPalette.success;
      case "ready_for_pickup":
        return TmcPalette.primary;
      case "confirmed":
        return TmcPalette.slateBlue;
      case "declined":
      case "cancelled":
        return TmcPalette.error;
      default:
        return TmcPalette.warning;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case "pending":
        return "Placed";
      case "confirmed":
        return "Accepted";
      case "ready_for_pickup":
        return "Ready for pickup";
      case "completed":
        return "Completed";
      case "declined":
        return "Declined";
      case "cancelled":
        return "Cancelled";
      default:
        return status.isEmpty ? "Unknown" : status.replaceAll("_", " ");
    }
  }

  List<DropdownMenuItem<String>> _statusOptions(String current) {
    final nextStatuses = switch (current) {
      "pending" => <String>["confirmed", "declined"],
      "confirmed" => <String>["ready_for_pickup"],
      "ready_for_pickup" => <String>["completed"],
      _ => <String>[],
    };
    return [
      DropdownMenuItem<String>(
        value: current,
        enabled: false,
        child: Text(_statusLabel(current)),
      ),
      ...nextStatuses.map(
        (nextStatus) => DropdownMenuItem<String>(
          value: nextStatus,
          child: Text(_statusLabel(nextStatus)),
        ),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final orderNumber = valueOf(order["order_number"]);
    final total = double.tryParse(valueOf(order["total_amount"])) ?? 0;
    final createdAt = valueOf(order["created_at"]);
    final statusOptions = _statusOptions(status);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(TmcRadius.lg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Order #$orderNumber",
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: TmcPalette.text,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          buyerName.isEmpty ? "Buyer" : buyerName,
                          style: const TextStyle(
                            fontSize: 12,
                            color: TmcPalette.textMuted,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          createdAt.isEmpty ? "" : createdAt,
                          style: const TextStyle(
                            fontSize: 12,
                            color: TmcPalette.textSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        peso(total),
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: TmcPalette.text,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: _statusColor(status).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(TmcRadius.pill),
                        ),
                        child: Text(
                          _statusLabel(status),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: _statusColor(status),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: status,
                      items: statusOptions,
                      onChanged: isBusy || statusOptions.length <= 1
                          ? null
                          : (value) {
                              if (value != null) onStatus(value);
                            },
                      decoration: const InputDecoration(
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.all(
                            Radius.circular(TmcRadius.md),
                          ),
                        ),
                        isDense: true,
                      ),
                      menuMaxHeight: 300,
                    ),
                  ),
                  if (isBusy)
                    const Padding(
                      padding: EdgeInsets.only(left: 8),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
