import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'tmc_theme.dart';

typedef SellerProductTap = void Function(Product product);

class SellerProfilePage extends StatefulWidget {
  const SellerProfilePage({
    super.key,
    required this.sellerId,
    required this.onOpenProduct,
  });

  final int sellerId;
  final SellerProductTap onOpenProduct;

  @override
  State<SellerProfilePage> createState() => _SellerProfilePageState();
}

class _SellerProfilePageState extends State<SellerProfilePage> {
  late Future<Map<String, dynamic>> _profileFuture;
  Map<String, dynamic>? _profile;
  final List<Product> _products = [];
  final List<Map<String, dynamic>> _reviews = [];
  int _productPage = 0;
  int _productLastPage = 1;
  int _reviewPage = 0;
  int _reviewLastPage = 1;
  String? _productError;
  String? _reviewError;
  bool _loadingProducts = false;
  bool _loadingReviews = false;
  bool _followingBusy = false;
  bool _isLoadingProducts = true;
  bool _isLoadingReviews = true;
  bool? _followingOverride;
  bool _showReviews = false;

  @override
  void initState() {
    super.initState();
    _profileFuture = _loadProfile();
    unawaited(_loadProducts(reset: true));
    unawaited(_loadReviews(reset: true));
  }

  Future<Map<String, dynamic>> _loadProfile() async {
    final response = await context.read<ApiService>().sellerProfile(
      widget.sellerId,
    );
    if (response['success'] == false) {
      throw const ApiException('This student profile is unavailable.');
    }
    return response;
  }

  void _retryProfile() {
    setState(() => _profileFuture = _loadProfile());
  }

  List<Map<String, dynamic>> _maps(dynamic raw) => raw is List
      ? raw
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
      : <Map<String, dynamic>>[];

  Future<void> _loadProducts({bool reset = false}) async {
    if (_loadingProducts) return;
    final page = reset ? 1 : _productPage + 1;
    setState(() {
      _loadingProducts = true;
      if (reset) {
        _productError = null;
        _isLoadingProducts = true;
      }
    });
    try {
      final response = await context.read<ApiService>().sellerProducts(
        widget.sellerId,
        page: page,
      );
      final next = _maps(
        response['products'],
      ).map(Product.fromJson).toList(growable: false);
      if (!mounted) return;
      setState(() {
        if (reset) _products.clear();
        _products.addAll(next);
        _productPage = int.tryParse(valueOf(response['current_page'])) ?? page;
        _productLastPage = int.tryParse(valueOf(response['last_page'])) ?? page;
        _productError = null;
        _isLoadingProducts = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _productError = error.toString();
          _isLoadingProducts = false;
        });
      }
    } finally {
      if (mounted) setState(() => _loadingProducts = false);
    }
  }

  Future<void> _loadReviews({bool reset = false}) async {
    if (_loadingReviews) return;
    final page = reset ? 1 : _reviewPage + 1;
    setState(() {
      _loadingReviews = true;
      if (reset) {
        _reviewError = null;
        _isLoadingReviews = true;
      }
    });
    try {
      final response = await context.read<ApiService>().sellerReviews(
        widget.sellerId,
        page: page,
      );
      if (!mounted) return;
      setState(() {
        final next = _maps(response['reviews']);
        if (reset) _reviews.clear();
        _reviews.addAll(next);
        _reviewPage = int.tryParse(valueOf(response['current_page'])) ?? page;
        _reviewLastPage = int.tryParse(valueOf(response['last_page'])) ?? page;
        _reviewError = null;
        _isLoadingReviews = false;
        if (_profile != null) {
          _profile = {
            ..._profile!,
            'reviews_count': response['total'] ?? _profile!['reviews_count'],
            'average_rating':
                response['average_rating'] ?? _profile!['average_rating'],
          };
        }
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _reviewError = error.toString();
          _isLoadingReviews = false;
        });
      }
    } finally {
      if (mounted) setState(() => _loadingReviews = false);
    }
  }

  Future<void> _toggleFollow(bool isFollowing) async {
    if (_followingBusy) return;
    setState(() => _followingBusy = true);
    try {
      final response = await context.read<ApiService>().setStudentFollowing(
        widget.sellerId,
        follow: !isFollowing,
      );
      if (!mounted) return;
      setState(() {
        _followingOverride = response['is_following'] == true;
        _profile = {
          ...?_profile,
          'followers_count': response['followers_count'],
          'following_count': response['following_count'],
          'is_following': response['is_following'],
          'student': response['student'],
        };
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _followingOverride == true
                ? 'You are now following this seller.'
                : 'You unfollowed this seller.',
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update follow status: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _followingBusy = false);
    }
  }

  void _openConnections(bool followers) {
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => _SellerConnectionsPage(
          sellerId: widget.sellerId,
          followers: followers,
          onOpenSeller: (studentId) => Navigator.of(context).push<void>(
            MaterialPageRoute<void>(
              builder: (_) => SellerProfilePage(
                sellerId: studentId,
                onOpenProduct: widget.onOpenProduct,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _avatar(String name, String? path, double size) {
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
    final fallback = CircleAvatar(
      radius: size / 2,
      backgroundColor: TmcPalette.paleBlue,
      child: Text(
        initials.isEmpty ? 'T' : initials,
        style: TextStyle(
          color: TmcPalette.deepNavy,
          fontSize: size * .28,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
    final url = ApiService.imageUrlFor(path);
    if (url.isEmpty) return fallback;
    return ClipOval(
      child: Image.network(
        url,
        height: size,
        width: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }

  Widget _countButton({
    required String label,
    required dynamic count,
    required VoidCallback onTap,
  }) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(TmcRadius.md),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Column(
        children: [
          Text(
            valueOf(count).isEmpty ? '0' : valueOf(count),
            style: const TextStyle(
              color: TmcPalette.deepNavy,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              color: TmcPalette.darkGray,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    ),
  );

  Widget _profileHeader(Map<String, dynamic> payload) {
    final student = asMap(payload['student']);
    final name = valueOf(student['name']).isEmpty
        ? 'TMC Student Seller'
        : valueOf(student['name']);
    final username = valueOf(student['username']);
    final course = valueOf(student['course']);
    final joined = valueOf(student['joined_at']);
    final isSelf = payload['is_self'] == true;
    final isFollowing = _followingOverride ?? payload['is_following'] == true;

    return TmcPanel(
      color: TmcPalette.primarySoft,
      padding: const EdgeInsets.all(16),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 560;
          final identity = Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _avatar(name, student['profile_picture']?.toString(), 76),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: TmcPalette.deepNavy,
                        fontSize: 21,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '@${username.isEmpty ? 'student${widget.sellerId}' : username}',
                      style: const TextStyle(
                        color: TmcPalette.navyBlue,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      course.isEmpty ? 'TMC Student' : 'TMC Student · $course',
                      style: const TextStyle(
                        color: TmcPalette.darkGray,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (joined.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        'Member since ${DateTime.tryParse(joined)?.year ?? joined}',
                        style: const TextStyle(
                          color: TmcPalette.darkGray,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    if (valueOf(student['bio']).trim().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        valueOf(student['bio']).trim(),
                        style: const TextStyle(height: 1.35),
                      ),
                    ],
                  ],
                ),
              ),
              if (wide && !isSelf) ...[
                const SizedBox(width: 12),
                _followButton(isFollowing),
              ],
            ],
          );
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              identity,
              if (!wide && !isSelf) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: _followButton(isFollowing),
                ),
              ],
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  _countButton(
                    label: 'Followers',
                    count: payload['followers_count'],
                    onTap: () => _openConnections(true),
                  ),
                  _countButton(
                    label: 'Following',
                    count: payload['following_count'],
                    onTap: () => _openConnections(false),
                  ),
                  _countButton(
                    label: 'Listings',
                    count: payload['products_count'],
                    onTap: () => setState(() => _showReviews = false),
                  ),
                  _countButton(
                    label: 'Reviews',
                    count: payload['reviews_count'],
                    onTap: () {
                      setState(() => _showReviews = true);
                      unawaited(_loadReviews(reset: true));
                    },
                  ),
                  if (double.tryParse(valueOf(payload['average_rating'])) !=
                          null &&
                      (double.tryParse(valueOf(payload['average_rating'])) ??
                              0) >
                          0)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.star, color: TmcPalette.warning),
                          const SizedBox(width: 3),
                          Text(
                            valueOf(payload['average_rating']),
                            style: const TextStyle(
                              color: TmcPalette.deepNavy,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _followButton(bool isFollowing) => FilledButton.icon(
    onPressed: _followingBusy ? null : () => _toggleFollow(isFollowing),
    icon: _followingBusy
        ? const SizedBox.square(
            dimension: 17,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Icon(isFollowing ? Icons.check : Icons.add),
    label: Text(
      _followingBusy
          ? 'Updating…'
          : isFollowing
          ? 'Following'
          : 'Follow',
    ),
  );

  Widget _productSection(int currentUserId) {
    if (_isLoadingProducts && _products.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(26),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_productError != null && _products.isEmpty) {
      return ErrorMessage(
        message: _productError!,
        onRetry: () => unawaited(_loadProducts(reset: true)),
      );
    }
    if (_products.isEmpty) {
      return const EmptyMessage(
        icon: Icons.storefront_outlined,
        title: 'No products listed yet',
        message: 'This student has no public listings right now.',
      );
    }

    return Column(
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 880
                ? 4
                : constraints.maxWidth >= 600
                ? 3
                : constraints.maxWidth >= 340
                ? 2
                : 1;
            return GridView.builder(
              itemCount: _products.length,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                mainAxisExtent: 282,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemBuilder: (context, index) {
                final product = _products[index];
                return ProductCard(
                  product: product,
                  isOwnListing: isOwnProduct(product, currentUserId),
                  imageHeight: 108,
                  onTap: () => widget.onOpenProduct(product),
                  onAdd: () async {
                    if (isOwnProduct(product, currentUserId)) return;
                    try {
                      final added = await context.read<CartState>().add(
                        product,
                        currentUserId: currentUserId,
                      );
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            added
                                ? 'Added ${product.name} to your cart.'
                                : 'This listing is unavailable or at its stock limit.',
                          ),
                        ),
                      );
                    } catch (error) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(error.toString())),
                        );
                      }
                    }
                  },
                );
              },
            );
          },
        ),
        if (_productPage < _productLastPage)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: OutlinedButton.icon(
              onPressed: _loadingProducts
                  ? null
                  : () => unawaited(_loadProducts()),
              icon: _loadingProducts
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.expand_more),
              label: const Text('Load more listings'),
            ),
          ),
      ],
    );
  }

  Widget _reviewTile(Map<String, dynamic> review) {
    final reviewer = asMap(review['reviewer']);
    final name = valueOf(reviewer['name']).isEmpty
        ? 'TMC Student'
        : valueOf(reviewer['name']);
    return TmcPanel(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _avatar(name, reviewer['profile_picture']?.toString(), 42),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      _dateLabel(valueOf(review['created_at'])),
                      style: const TextStyle(
                        color: TmcPalette.darkGray,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _ratingStars(int.tryParse(valueOf(review['rating'])) ?? 0),
            ],
          ),
          if (valueOf(review['title']).trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              valueOf(review['title']),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
          const SizedBox(height: 5),
          Text(valueOf(review['comment']), style: const TextStyle(height: 1.4)),
          if (asMap(review['product']).isNotEmpty) ...[
            const Divider(height: 18),
            Text(
              'Product: ${valueOf(asMap(review['product'])['name'])}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: TmcPalette.darkGray,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _reviewsSection() {
    if (_isLoadingReviews && _reviews.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(26),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_reviewError != null && _reviews.isEmpty) {
      return ErrorMessage(
        message: _reviewError!,
        onRetry: () => unawaited(_loadReviews(reset: true)),
      );
    }
    if (_reviews.isEmpty) {
      return const EmptyMessage(
        icon: Icons.star_outline,
        title: 'No reviews yet',
        message: 'Verified buyer reviews will appear here.',
      );
    }
    return Column(
      children: [
        for (var index = 0; index < _reviews.length; index++) ...[
          if (index > 0) const SizedBox(height: 10),
          _reviewTile(_reviews[index]),
        ],
        if (_reviewPage < _reviewLastPage)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: OutlinedButton.icon(
              onPressed: _loadingReviews
                  ? null
                  : () => unawaited(_loadReviews()),
              icon: _loadingReviews
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.expand_more),
              label: const Text('Load more reviews'),
            ),
          ),
      ],
    );
  }

  Widget _profileContent(Map<String, dynamic> payload, int currentUserId) {
    return LayoutBuilder(
      builder: (context, constraints) => Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              _profileHeader(payload),
              const SizedBox(height: 18),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment<bool>(
                    value: false,
                    icon: Icon(Icons.storefront_outlined),
                    label: Text('Listings'),
                  ),
                  ButtonSegment<bool>(
                    value: true,
                    icon: Icon(Icons.star_outline),
                    label: Text('Reviews'),
                  ),
                ],
                selected: {_showReviews},
                onSelectionChanged: (value) {
                  setState(() => _showReviews = value.first);
                  if (value.first && _reviews.isEmpty && !_isLoadingReviews) {
                    unawaited(_loadReviews(reset: true));
                  }
                },
              ),
              const SizedBox(height: 14),
              if (_showReviews)
                _reviewsSection()
              else
                _productSection(currentUserId),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUserId = context.watch<AuthState>().user?.id ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text('Seller profile')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _profileFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorMessage(
              message: snapshot.error.toString(),
              onRetry: _retryProfile,
            );
          }
          final payload = snapshot.data ?? const <String, dynamic>{};
          _profile ??= payload;
          return _profileContent(_profile!, currentUserId);
        },
      ),
    );
  }
}

class _SellerConnectionsPage extends StatefulWidget {
  const _SellerConnectionsPage({
    required this.sellerId,
    required this.followers,
    required this.onOpenSeller,
  });

  final int sellerId;
  final bool followers;
  final ValueChanged<int> onOpenSeller;

  @override
  State<_SellerConnectionsPage> createState() => _SellerConnectionsPageState();
}

class _SellerConnectionsPageState extends State<_SellerConnectionsPage> {
  final List<StudentConnection> _accounts = [];
  int _page = 0;
  int _lastPage = 1;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load(reset: true));
  }

  Future<void> _load({bool reset = false}) async {
    if (_loadingMore) return;
    final nextPage = reset ? 1 : _page + 1;
    setState(() {
      _loadingMore = true;
      if (reset) {
        _loading = true;
        _error = null;
      }
    });
    try {
      final response = await context.read<ApiService>().studentConnections(
        widget.sellerId,
        followers: widget.followers,
        page: nextPage,
      );
      final raw = response['accounts'];
      final accounts = raw is List
          ? raw
                .whereType<Map>()
                .map(
                  (item) => StudentConnection.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
          : <StudentConnection>[];
      if (!mounted) return;
      setState(() {
        if (reset) _accounts.clear();
        _accounts.addAll(accounts);
        _page = int.tryParse(valueOf(response['current_page'])) ?? nextPage;
        _lastPage = int.tryParse(valueOf(response['last_page'])) ?? nextPage;
        _loading = false;
        _error = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _toggleFollow(int index) async {
    final account = _accounts[index];
    try {
      final response = await context.read<ApiService>().setStudentFollowing(
        account.id,
        follow: !account.isFollowing,
      );
      if (!mounted) return;
      setState(() {
        _accounts[index] = StudentConnection(
          id: account.id,
          name: account.name,
          course: account.course,
          profilePicture: account.profilePicture,
          isFollowing: response['is_following'] == true,
        );
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not update follow status: $error')),
        );
      }
    }
  }

  Widget _avatar(StudentConnection account) {
    final url = ApiService.imageUrlFor(account.profilePicture);
    if (url.isEmpty) {
      return CircleAvatar(
        backgroundColor: TmcPalette.paleBlue,
        child: Text(
          account.name.isEmpty ? 'T' : account.name[0].toUpperCase(),
          style: const TextStyle(
            color: TmcPalette.deepNavy,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
    }
    return CircleAvatar(
      backgroundColor: TmcPalette.paleBlue,
      foregroundImage: NetworkImage(url),
      onForegroundImageError: (_, _) {},
      child: Text(
        account.name.isEmpty ? 'T' : account.name[0].toUpperCase(),
        style: const TextStyle(
          color: TmcPalette.deepNavy,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.followers ? 'Followers' : 'Following')),
    body: _loading && _accounts.isEmpty
        ? const Center(child: CircularProgressIndicator())
        : _error != null && _accounts.isEmpty
        ? ErrorMessage(message: _error!, onRetry: () => _load(reset: true))
        : _accounts.isEmpty
        ? EmptyMessage(
            icon: Icons.people_outline,
            title: widget.followers
                ? 'No followers yet'
                : 'Not following anyone',
            message: widget.followers
                ? 'New followers will appear here.'
                : 'Accounts this student follows will appear here.',
          )
        : ListView.builder(
            padding: const EdgeInsets.all(12),
            itemCount: _accounts.length + (_page < _lastPage ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _accounts.length) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: OutlinedButton.icon(
                      onPressed: _loadingMore ? null : () => _load(),
                      icon: _loadingMore
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.expand_more),
                      label: const Text('Load more'),
                    ),
                  ),
                );
              }
              final account = _accounts[index];
              return Card(
                child: ListTile(
                  onTap: () => widget.onOpenSeller(account.id),
                  leading: _avatar(account),
                  title: Text(
                    account.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    account.course.isEmpty
                        ? 'TMC Student'
                        : 'TMC Student · ${account.course}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: account.id == context.read<AuthState>().user?.id
                      ? const Text('You')
                      : IconButton.filledTonal(
                          tooltip: account.isFollowing
                              ? 'Unfollow ${account.name}'
                              : 'Follow ${account.name}',
                          onPressed: () => _toggleFollow(index),
                          icon: Icon(
                            account.isFollowing ? Icons.check : Icons.add,
                          ),
                        ),
                ),
              );
            },
          ),
  );
}

String _dateLabel(String raw) {
  final date = DateTime.tryParse(raw)?.toLocal();
  if (date == null) return 'Date unavailable';
  return '${date.month}/${date.day}/${date.year}';
}

Widget _ratingStars(int rating) => Row(
  mainAxisSize: MainAxisSize.min,
  children: [
    for (var index = 1; index <= 5; index++)
      Icon(
        index <= rating ? Icons.star : Icons.star_border,
        color: TmcPalette.warning,
        size: 16,
      ),
  ],
);
