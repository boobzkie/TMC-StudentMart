import 'dart:async' show TimeoutException;
import 'dart:convert';
import 'dart:io' show SocketException;
import 'dart:math' show Random;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';

const courseOptions = <Course>[
  Course('BSIT', 'Bachelor of Science in Information Technology'),
  Course('BSCRIM', 'Bachelor of Science in Criminology'),
  Course('BSOA', 'Bachelor of Science in Office Administration'),
  Course('BSED', 'Bachelor of Secondary Education'),
  Course('CAS', 'College of Arts and Sciences'),
];

String valueOf(dynamic value) => value?.toString() ?? '';

class Course {
  const Course(this.code, this.name);
  final String code;
  final String name;
}

class ProductCategory {
  const ProductCategory({
    required this.id,
    required this.name,
    this.description = '',
  });

  final int id;
  final String name;
  final String description;

  factory ProductCategory.fromJson(Map<String, dynamic> json) =>
      ProductCategory(
        id: int.tryParse(valueOf(json['id'])) ?? 0,
        name: valueOf(json['name']),
        description: valueOf(json['description']),
      );
}

enum ApiErrorType {
  noInternet,
  cannotConnect,
  timeout,
  ngrokUnavailable,
  invalidUrl,
  httpError,
}

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.type});
  final String message;
  final int? statusCode;
  final ApiErrorType? type;
  @override
  String toString() => message;
}

class ApiService {
  ApiService({http.Client? client, FlutterSecureStorage? storage})
    : _client = client ?? http.Client(),
      storage = storage ?? const FlutterSecureStorage();

  static const _configuredBaseUrls = String.fromEnvironment('API_BASE_URLS');
  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String normalizeBaseUrl(String value) {
    final cleaned = value.trim().replaceAll(RegExp(r'\s+'), '');
    if (cleaned.isEmpty) {
      return '';
    }
    final parsed = Uri.tryParse(cleaned);
    return parsed != null &&
            (parsed.scheme == 'http' || parsed.scheme == 'https')
        ? parsed.toString()
        : cleaned;
  }

  @visibleForTesting
  static List<String> resolveBaseUrls({
    String? configuredBaseUrls,
    String? configuredBaseUrl,
    bool? isWeb,
    TargetPlatform? platform,
  }) {
    final multiValue = configuredBaseUrls ?? _configuredBaseUrls;
    final singleValue = configuredBaseUrl ?? _configuredBaseUrl;
    final targetPlatform = platform ?? defaultTargetPlatform;
    final runningOnWeb = isWeb ?? kIsWeb;

    String forPlatform(String value) {
      // Use the URL exactly as configured. Do not rewrite localhost or
      // 127.0.0.1 to the emulator-only 10.0.2.2 alias: that address does not
      // work on physical Android phones.
      return normalizeBaseUrl(value);
    }

    final configured = <String>[];
    if (multiValue.trim().isNotEmpty) {
      configured.addAll(
        multiValue
            .split(',')
            .map(forPlatform)
            .where((value) => value.isNotEmpty),
      );
    }
    if (configured.isEmpty && singleValue.trim().isNotEmpty) {
      final singleUrl = forPlatform(singleValue);
      if (singleUrl.isNotEmpty) {
        configured.add(singleUrl);
      }
    }
    if (configured.isEmpty) {
      if (runningOnWeb) {
        // Flutter Web running on the same PC as Laravel.
        configured.add('http://127.0.0.1:8000/api');
      } else if (targetPlatform == TargetPlatform.android) {
        // ngrok is the correct address for a physical Android phone.
        // Do not fall back to 10.0.2.2: that is the Android emulator-only
        // alias and does not work on physical devices.
        configured.add('https://freestyle-fondly-auction.ngrok-free.dev/api');
      } else {
        // Other platforms running on the same PC.
        configured.add('http://127.0.0.1:8000/api');

        configured.add('https://freestyle-fondly-auction.ngrok-free.dev/api');
      }
    }
    return configured.toSet().toList(growable: false);
  }

  static final List<String> _candidateBaseUrls = resolveBaseUrls();
  static String _activeBaseUrl = _candidateBaseUrls.isEmpty
      ? ''
      : _candidateBaseUrls.first;
  static String get baseUrl => _activeBaseUrl;

  static const tokenKey = 'tmc_student_sanctum_token';
  final http.Client _client;
  final FlutterSecureStorage storage;

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    final clean = path.startsWith('/') ? path.substring(1) : path;
    return Uri.parse('$root/$clean');
  }

  Future<Map<String, String>> _headers({bool authenticated = true}) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      // Avoid host-level interstitial pages from replacing API responses when a tunnel is used.
      'ngrok-skip-browser-warning': 'true',
    };
    if (authenticated) {
      final token = await storage.read(key: tokenKey);
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  Future<dynamic> _request(Future<http.Response> Function() send) async {
    if (_candidateBaseUrls.isEmpty) {
      throw const ApiException(
        'No Laravel API base URL is configured. Use --dart-define=API_BASE_URL=https://freestyle-fondly-auction.ngrok-free.dev/api for a physical Android phone, or --dart-define=API_BASE_URL=http://127.0.0.1:8000/api for web or desktop.',
        type: ApiErrorType.invalidUrl,
      );
    }
    ApiException? lastError;
    final startedBase = _activeBaseUrl;
    final attemptedBases = <String>[];

    for (var index = 0; index < _candidateBaseUrls.length; index++) {
      final candidate = _candidateBaseUrls[index];
      _activeBaseUrl = candidate;
      attemptedBases.add(candidate);

      final uri = Uri.tryParse(candidate);
      final isNgrok = uri != null && uri.host.toLowerCase().contains('ngrok');

      for (var retry = 0; retry < 2; retry++) {
        try {
          return _decode(await send().timeout(const Duration(seconds: 10)));
        } on SocketException {
          lastError = ApiException(
            'No internet connection. The device cannot reach the network at all. Check Wi-Fi or mobile data.',
            type: ApiErrorType.noInternet,
          );
        } on TimeoutException {
          lastError = ApiException(
            'Timed out while contacting the Laravel API at $candidate. The server or ngrok tunnel may be slow or unreachable.',
            type: ApiErrorType.timeout,
          );
        } on http.ClientException {
          lastError = ApiException(
            isNgrok
                ? 'The ngrok tunnel at $candidate is unavailable. Check that ngrok is still running and forwarding to http://localhost:8000.'
                : 'Cannot connect to the Laravel API at $candidate. Check that the backend is running on port 8000.',
            type: ApiErrorType.cannotConnect,
          );
        } catch (error) {
          if (error is ApiException) rethrow;
          lastError = ApiException(
            'Unexpected error contacting the Laravel API at $candidate: $error.',
            type: ApiErrorType.cannotConnect,
          );
        }

        if (retry < 1) {
          await Future<void>.delayed(Duration(milliseconds: 350 * (retry + 1)));
        }
      }

      if (index < _candidateBaseUrls.length - 1) {
        await Future<void>.delayed(const Duration(milliseconds: 250));
      }
    }

    _activeBaseUrl = attemptedBases.last == startedBase
        ? startedBase
        : attemptedBases.last;

    throw lastError ??
        ApiException(
          'Cannot reach any configured Laravel API server. Tried: ${attemptedBases.join(', ')}.',
          type: ApiErrorType.cannotConnect,
        );
  }

  Future<dynamic> get(String path) async =>
      _request(() async => _client.get(_uri(path), headers: await _headers()));

  Future<dynamic> post(
    String path,
    Map<String, dynamic> body, {
    bool authenticated = true,
  }) async {
    final headers = await _headers(authenticated: authenticated);
    headers['Content-Type'] = 'application/json';
    return _request(
      () => _client.post(_uri(path), headers: headers, body: jsonEncode(body)),
    );
  }

  Future<dynamic> put(String path, Map<String, dynamic> body) async {
    final headers = await _headers();
    headers['Content-Type'] = 'application/json';
    return _request(
      () => _client.put(_uri(path), headers: headers, body: jsonEncode(body)),
    );
  }

  Future<dynamic> uploadStudentProfilePicture(XFile image) async {
    if (_candidateBaseUrls.isEmpty) {
      throw const ApiException(
        'No Laravel API base URL is configured.',
        type: ApiErrorType.invalidUrl,
      );
    }

    final request = http.MultipartRequest(
      'POST',
      _uri('/user/student-profile'),
    );
    request.headers.addAll(await _headers());
    request.fields['_method'] = 'PUT';
    request.files.add(
      http.MultipartFile.fromBytes(
        'profile_picture',
        await image.readAsBytes(),
        filename: image.name,
        contentType: _imageMediaType(image),
      ),
    );

    try {
      final streamed = await _client
          .send(request)
          .timeout(const Duration(seconds: 10));
      final response = await http.Response.fromStream(
        streamed,
      ).timeout(const Duration(seconds: 10));
      return _decode(response);
    } on SocketException {
      throw ApiException(
        'No internet connection. The device cannot reach the network at all. Check Wi-Fi or mobile data.',
        type: ApiErrorType.noInternet,
      );
    } on TimeoutException {
      throw ApiException(
        'Timed out while contacting the Laravel API at $baseUrl.',
        type: ApiErrorType.timeout,
      );
    } on http.ClientException {
      final isNgrok =
          Uri.tryParse(baseUrl)?.host.toLowerCase().contains('ngrok') == true;
      throw ApiException(
        isNgrok
            ? 'The ngrok tunnel at $baseUrl is unavailable. Check that ngrok is still running and forwarding to http://localhost:8000.'
            : 'Cannot reach the Laravel API at $baseUrl. Check that the backend is running and restart the app with the correct API URL for this platform.',
        type: ApiErrorType.cannotConnect,
      );
    }
  }

  Future<dynamic> delete(String path) async => _request(
    () async => _client.delete(_uri(path), headers: await _headers()),
  );

  Future<Map<String, dynamic>> studentFollowStatus(int studentId) async =>
      asMap(await get('/students/$studentId/follow'));

  Future<Map<String, dynamic>> setStudentFollowing(
    int studentId, {
    required bool follow,
  }) async {
    final payload = follow
        ? await post('/students/$studentId/follow', {})
        : await delete('/students/$studentId/follow');
    return asMap(payload);
  }

  Future<Map<String, dynamic>> myConnections({
    required bool followers,
    int page = 1,
  }) async => asMap(
    await get('/user/${followers ? 'followers' : 'following'}?page=$page'),
  );

  Future<Map<String, dynamic>> myFollowStats() async =>
      asMap(await get('/user/follow-stats'));

  Future<Map<String, dynamic>> sellerProfile(int studentId) async =>
      asMap(await get('/students/$studentId/profile'));

  Future<Map<String, dynamic>> sellerProducts(
    int studentId, {
    int page = 1,
  }) async => asMap(await get('/students/$studentId/products?page=$page'));

  Future<Map<String, dynamic>> sellerReviews(
    int studentId, {
    int page = 1,
  }) async => asMap(await get('/students/$studentId/reviews?page=$page'));

  Future<Map<String, dynamic>> studentConnections(
    int studentId, {
    required bool followers,
    int page = 1,
  }) async => asMap(
    await get(
      '/students/$studentId/${followers ? 'followers' : 'following'}?page=$page',
    ),
  );

  Future<Map<String, dynamic>> productReviews(
    int productId, {
    int page = 1,
  }) async => asMap(await get('/products/$productId/reviews?page=$page'));

  Future<Map<String, dynamic>> submitProductReview(
    int productId, {
    required int rating,
    String? title,
    required String comment,
  }) async => asMap(
    await post('/products/$productId/reviews', {
      'rating': rating,
      'title': title,
      'comment': comment,
    }),
  );

  Future<dynamic> sendProduct({
    required Map<String, String> fields,
    List<XFile> images = const [],
    List<int> removeImageIds = const [],
    int? primaryImageId,
    int? primaryImageIndex,
    int? id,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      _uri(id == null ? '/products' : '/products/$id'),
    );
    request.headers.addAll(await _headers());
    final requestFields = Map<String, String>.from(fields);
    if (id != null) requestFields['_method'] = 'PUT';
    if (primaryImageId != null) {
      requestFields['primary_image_id'] = '$primaryImageId';
    }
    if (primaryImageIndex != null) {
      requestFields['primary_image_index'] = '$primaryImageIndex';
    }
    for (var index = 0; index < removeImageIds.length; index++) {
      requestFields['remove_image_ids[$index]'] = '${removeImageIds[index]}';
    }
    request.fields.addAll(requestFields);

    for (final image in images) {
      request.files.add(
        http.MultipartFile.fromBytes(
          'images[]',
          await image.readAsBytes(),
          filename: image.name,
          contentType: _imageMediaType(image),
        ),
      );
    }

    try {
      const uploadTimeout = Duration(seconds: 30);
      final stopwatch = Stopwatch()..start();
      final streamed = await _client.send(request).timeout(uploadTimeout);
      final remaining = uploadTimeout - stopwatch.elapsed;
      if (remaining <= Duration.zero) {
        throw TimeoutException('Product upload timed out after 30 seconds.');
      }
      final response = await http.Response.fromStream(streamed).timeout(
        remaining,
      );
      return _decode(response);
    } on SocketException {
      throw ApiException(
        'No internet connection. The device cannot reach the network at all. Check Wi-Fi or mobile data.',
        type: ApiErrorType.noInternet,
      );
    } on TimeoutException {
      throw ApiException(
        'Timed out while contacting the Laravel API at $baseUrl.',
        type: ApiErrorType.timeout,
      );
    } on http.ClientException catch (_) {
      final isNgrok =
          Uri.tryParse(baseUrl)?.host.toLowerCase().contains('ngrok') == true;
      throw ApiException(
        isNgrok
            ? 'The ngrok tunnel at $baseUrl is unavailable. Check that ngrok is still running and forwarding to http://localhost:8000.'
            : 'Cannot reach the Laravel API at $baseUrl. Check that the backend is running and restart the app with the correct API URL for this platform.',
        type: ApiErrorType.cannotConnect,
      );
    }
  }

  MediaType _imageMediaType(XFile image) {
    final pickedMimeType = image.mimeType;
    if (pickedMimeType != null && pickedMimeType.contains('/')) {
      try {
        return MediaType.parse(pickedMimeType);
      } on FormatException {
        // Fall back to the selected file extension below.
      }
    }

    final extension = image.name.toLowerCase().split('.').last;
    return switch (extension) {
      'jpg' || 'jpeg' => MediaType('image', 'jpeg'),
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      _ => MediaType('application', 'octet-stream'),
    };
  }

  dynamic _decode(http.Response response) {
    dynamic payload;
    try {
      payload = response.body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(response.body);
    } on FormatException {
      payload = <String, dynamic>{};
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      var message = 'Request failed. Please try again.';
      if (payload is Map) {
        message = valueOf(payload['message']).isEmpty
            ? message
            : valueOf(payload['message']);
        final errors = payload['errors'];
        if (errors is Map && errors.isNotEmpty) {
          final first = errors.values.first;
          if (first is List && first.isNotEmpty) message = valueOf(first.first);
        }
      }
      throw ApiException(
        message,
        statusCode: response.statusCode,
        type: ApiErrorType.httpError,
      );
    }
    return payload;
  }

  Future<void> saveToken(String token) =>
      storage.write(key: tokenKey, value: token);
  Future<void> clearToken() => storage.delete(key: tokenKey);

  String get serverRoot {
    final uri = Uri.parse(baseUrl);
    return uri
        .replace(path: '', query: null, fragment: null)
        .toString()
        .replaceFirst(RegExp(r'/$'), '');
  }

  String imageUrl(String? path) {
    return imageUrlFor(path);
  }

  static String imageUrlFor(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final clean = path.startsWith('/') ? path.substring(1) : path;
    final uri = Uri.parse(baseUrl);
    final root = uri
        .replace(path: '', query: null, fragment: null)
        .toString()
        .replaceFirst(RegExp(r'/$'), '');
    return '$root/storage/$clean';
  }
}

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return <String, dynamic>{};
}

List<dynamic> listFrom(dynamic payload, String key) {
  final map = asMap(payload);
  final value = map[key] ?? map['data'];
  if (value is List) return value;
  if (value is Map && value['data'] is List) return value['data'] as List;
  return const [];
}

class Student {
  const Student({
    required this.id,
    required this.name,
    required this.email,
    this.studentId = '',
    this.contactNumber = '',
    this.course = '',
    this.status = '',
    this.role = '',
    this.username = '',
    this.bio = '',
    this.profilePicture,
    this.facebookUrl = '',
    this.instagramUrl = '',
    this.tiktokUrl = '',
    this.shareContactInfo = false,
  });

  final int id;
  final String name;
  final String email;
  final String studentId;
  final String contactNumber;
  final String course;
  final String status;
  final String role;
  final String username;
  final String bio;
  final String? profilePicture;
  final String facebookUrl;
  final String instagramUrl;
  final String tiktokUrl;
  final bool shareContactInfo;

  factory Student.fromJson(Map<String, dynamic> json) => Student(
    id: int.tryParse(valueOf(json['id'])) ?? 0,
    name: valueOf(json['name']),
    email: valueOf(json['email']),
    studentId: valueOf(json['student_id']),
    contactNumber: valueOf(json['contact_number']),
    course: valueOf(json['course']),
    status: valueOf(json['status']),
    role: valueOf(json['role']),
    username: valueOf(json['username']),
    bio: valueOf(json['bio']),
    profilePicture: json['profile_picture']?.toString(),
    facebookUrl: valueOf(json['facebook_url']),
    instagramUrl: valueOf(json['instagram_url']),
    tiktokUrl: valueOf(json['tiktok_url']),
    shareContactInfo:
        json['share_contact_info'] == true ||
        valueOf(json['share_contact_info']).toLowerCase() == '1' ||
        valueOf(json['share_contact_info']).toLowerCase() == 'true',
  );
}

class StudentConnection {
  const StudentConnection({
    required this.id,
    required this.name,
    required this.course,
    required this.isFollowing,
    this.profilePicture,
  });

  final int id;
  final String name;
  final String course;
  final String? profilePicture;
  final bool isFollowing;

  factory StudentConnection.fromJson(Map<String, dynamic> json) =>
      StudentConnection(
        id: int.tryParse(valueOf(json['id'])) ?? 0,
        name: valueOf(json['name']),
        course: valueOf(json['course']),
        profilePicture: json['profile_picture']?.toString(),
        isFollowing:
            json['is_following'] == true ||
            valueOf(json['is_following']).toLowerCase() == '1' ||
            valueOf(json['is_following']).toLowerCase() == 'true',
      );
}

class ProductImage {
  const ProductImage({
    required this.path,
    this.id,
    this.sortOrder = 0,
    this.isPrimary = false,
  });

  final int? id;
  final String path;
  final int sortOrder;
  final bool isPrimary;

  factory ProductImage.fromJson(Map<String, dynamic> json) => ProductImage(
    id: int.tryParse(valueOf(json['id'])),
    path: valueOf(json['path'] ?? json['image'] ?? json['url']),
    sortOrder: int.tryParse(valueOf(json['sort_order'])) ?? 0,
    isPrimary:
        json['is_primary'] == true ||
        valueOf(json['is_primary']).toLowerCase() == '1' ||
        valueOf(json['is_primary']).toLowerCase() == 'true',
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'path': path,
    'sort_order': sortOrder,
    'is_primary': isPrimary,
  };
}

class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.label,
    this.attributes = const {},
    this.stockQuantity = 0,
    this.isActive = true,
  });

  final int id;
  final String label;
  final Map<String, String> attributes;
  final int stockQuantity;
  final bool isActive;

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    final rawAttributes = asMap(json['attributes']);
    return ProductVariant(
      id: int.tryParse(valueOf(json['id'])) ?? 0,
      label: valueOf(json['label']),
      attributes: rawAttributes.map(
        (key, value) => MapEntry(key, valueOf(value)),
      ),
      stockQuantity: int.tryParse(valueOf(json['stock_quantity'])) ?? 0,
      isActive:
          json['is_active'] != false &&
          valueOf(json['is_active']).toLowerCase() != '0',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'attributes': attributes,
    'stock_quantity': stockQuantity,
    'is_active': isActive,
  };
}

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.category,
    this.categoryId,
    required this.status,
    this.image,
    this.images = const [],
    this.sellerName = '',
    this.sellerUsername = '',
    this.sellerBio = '',
    this.sellerCourse = '',
    this.sellerProfilePicture,
    this.sellerStudentId = '',
    this.sellerContactNumber = '',
    this.sellerFacebookUrl = '',
    this.sellerInstagramUrl = '',
    this.sellerTiktokUrl = '',
    this.userId = 0,
    this.rejectionReason,
    this.stockQuantity = 1,
    this.soldOutAt,
    this.archivedAt,
    this.attributes = const {},
    this.variants = const [],
  });

  final int id;
  final String name;
  final String description;
  final double price;
  final String category;
  final int? categoryId;
  final String status;
  final String? image;
  final List<ProductImage> images;
  final String sellerName;
  final String sellerUsername;
  final String sellerBio;
  final String sellerCourse;
  final String? sellerProfilePicture;
  final String sellerStudentId;
  final String sellerContactNumber;
  final String sellerFacebookUrl;
  final String sellerInstagramUrl;
  final String sellerTiktokUrl;
  final int userId;
  final String? rejectionReason;
  final int stockQuantity;
  final String? soldOutAt;
  final String? archivedAt;
  final Map<String, String> attributes;
  final List<ProductVariant> variants;

  factory Product.fromJson(Map<String, dynamic> json) {
    final seller = asMap(json['user'] ?? json['seller']);
    final categoryValue = json['category'];
    final categoryRecord = asMap(json['category_record']);
    final categoryName = categoryRecord.isNotEmpty
        ? valueOf(categoryRecord['name'])
        : categoryValue is Map
        ? valueOf(asMap(categoryValue)['name'])
        : valueOf(categoryValue);
    final categoryId = int.tryParse(
      valueOf(
        json['category_id'] ??
            categoryRecord['id'] ??
            (categoryValue is Map ? asMap(categoryValue)['id'] : null),
      ),
    );
    final parsedImages = json['images'] is List
        ? (json['images'] as List)
              .map((item) => ProductImage.fromJson(asMap(item)))
              .where((image) => image.path.isNotEmpty)
              .toList()
        : <ProductImage>[];
    final parsedAttributes = asMap(
      json['attributes'],
    ).map((key, value) => MapEntry(key, valueOf(value)));
    final parsedVariants = json['variants'] is List
        ? (json['variants'] as List)
              .map((item) => ProductVariant.fromJson(asMap(item)))
              .where((variant) => variant.id > 0 && variant.isActive)
              .toList()
        : <ProductVariant>[];
    final legacyImage = (json['image'] ?? json['image_url'])?.toString();
    ProductImage? primaryImage;
    for (final item in parsedImages) {
      if (item.isPrimary) {
        primaryImage = item;
        break;
      }
    }
    final coverImage = (legacyImage != null && legacyImage.isNotEmpty)
        ? legacyImage
        : primaryImage?.path ??
              (parsedImages.isNotEmpty ? parsedImages.first.path : null);
    final allImages = parsedImages.isNotEmpty
        ? parsedImages
        : coverImage == null || coverImage.isEmpty
        ? <ProductImage>[]
        : <ProductImage>[ProductImage(path: coverImage, isPrimary: true)];

    return Product(
      id: int.tryParse(valueOf(json['id'])) ?? 0,
      name: valueOf(json['name']),
      description: valueOf(json['description']),
      price: double.tryParse(valueOf(json['price'])) ?? 0,
      category: categoryName,
      categoryId: categoryId,
      status: valueOf(json['status']),
      image: coverImage,
      images: allImages,
      sellerName: valueOf(seller['name']),
      sellerUsername: valueOf(seller['username']),
      sellerBio: valueOf(seller['bio']),
      sellerCourse: valueOf(seller['course']),
      sellerProfilePicture: seller['profile_picture']?.toString(),
      sellerStudentId: valueOf(seller['student_id']),
      sellerContactNumber: valueOf(seller['contact_number']),
      sellerFacebookUrl: valueOf(seller['facebook_url']),
      sellerInstagramUrl: valueOf(seller['instagram_url']),
      sellerTiktokUrl: valueOf(seller['tiktok_url']),
      userId: int.tryParse(valueOf(json['user_id'] ?? seller['id'])) ?? 0,
      rejectionReason: json['rejection_reason']?.toString(),
      stockQuantity: int.tryParse(valueOf(json['stock_quantity'])) ?? 1,
      soldOutAt: json['sold_out_at']?.toString(),
      archivedAt: json['archived_at']?.toString(),
      attributes: parsedAttributes,
      variants: parsedVariants,
    );
  }
}

bool isOwnProduct(Product product, int currentUserId) =>
    currentUserId > 0 && product.userId == currentUserId;

class AuthState extends ChangeNotifier {
  AuthState(this.api);
  final ApiService api;
  Student? user;
  bool isRestoring = true;
  bool busy = false;
  bool savingProfile = false;

  Future<void> restore() async {
    try {
      final token = await api.storage.read(key: ApiService.tokenKey);
      if (token != null && token.isNotEmpty) {
        final payload = asMap(await api.get('/user'));
        final student = Student.fromJson(
          asMap(payload['user'] ?? payload['data'] ?? payload),
        );
        if (student.role != 'student') {
          throw const ApiException(
            'This app is for student accounts only.',
            statusCode: 403,
          );
        }
        user = student;
      }
    } on ApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        await api.clearToken();
      }
      user = null;
    } catch (_) {
      await api.clearToken();
      user = null;
    } finally {
      isRestoring = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    busy = true;
    notifyListeners();
    try {
      final payload = asMap(
        await api.post('/login', {
          'email': email,
          'password': password,
        }, authenticated: false),
      );
      final token = valueOf(payload['token']);
      if (token.isEmpty) {
        throw const ApiException('The API did not return a sign-in token.');
      }
      await api.saveToken(token);
      final student = Student.fromJson(
        asMap(payload['user'] ?? payload['data']),
      );
      if (student.role != 'student') {
        await api.clearToken();
        throw const ApiException(
          'This app is for student accounts only. Use the Admin and Staff web portal.',
        );
      }
      user = student;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> requestPasswordReset(String email) async {
    await api.post('/forgot-password', {
      'email': email.trim(),
    }, authenticated: false);
  }

  Future<void> resetPassword({
    required String email,
    required String token,
    required String password,
  }) async {
    await api.post('/reset-password', {
      'token': token.trim(),
      'email': email.trim(),
      'password': password,
      'password_confirmation': password,
    }, authenticated: false);
  }

  Future<void> updateProfile(Map<String, dynamic> values) async {
    savingProfile = true;
    notifyListeners();
    try {
      final payload = asMap(await api.put('/user/student-profile', values));
      final updated = Student.fromJson(asMap(payload['user']));
      if (updated.id == 0 || updated.role != 'student') {
        throw const ApiException(
          'The API did not return your updated student profile.',
        );
      }
      user = updated;
    } finally {
      savingProfile = false;
      notifyListeners();
    }
  }

  Future<void> uploadProfilePicture(XFile image) async {
    savingProfile = true;
    notifyListeners();
    try {
      final payload = asMap(await api.uploadStudentProfilePicture(image));
      final updated = Student.fromJson(asMap(payload['user']));
      if (updated.id == 0 || updated.role != 'student') {
        throw const ApiException(
          'The API did not return your updated student profile.',
        );
      }
      user = updated;
    } finally {
      savingProfile = false;
      notifyListeners();
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    busy = true;
    notifyListeners();
    try {
      await api.put('/user/student-password', {
        'current_password': currentPassword.trim(),
        'password': newPassword,
        'password_confirmation': confirmPassword,
      });
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> register(Map<String, dynamic> values) async {
    busy = true;
    notifyListeners();
    try {
      await api.post('/register', values, authenticated: false);
      await api.clearToken();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    busy = true;
    notifyListeners();
    try {
      await api.post('/logout', const {});
    } catch (_) {
      // Clear local credentials even if the server cannot be reached.
    }
    await api.clearToken();
    user = null;
    busy = false;
    notifyListeners();
  }
}

class MarketplaceState extends ChangeNotifier {
  MarketplaceState(this.api);
  final ApiService api;
  List<Product> products = [];
  List<Product> myProducts = [];
  List<ProductCategory> categories = [];
  final List<String> recentSearches = <String>[];
  bool loading = false;
  bool categoriesLoading = false;
  String? error;
  String? categoriesError;

  void addRecentSearch(String query) {
    final normalized = query.trim();
    if (normalized.isEmpty) return;
    recentSearches.removeWhere(
      (item) => item.toLowerCase() == normalized.toLowerCase(),
    );
    recentSearches.insert(0, normalized);
    if (recentSearches.length > 8) recentSearches.removeLast();
    notifyListeners();
  }

  void removeRecentSearch(String query) {
    recentSearches.removeWhere(
      (item) => item.toLowerCase() == query.toLowerCase(),
    );
    notifyListeners();
  }

  void clearRecentSearches() {
    if (recentSearches.isEmpty) return;
    recentSearches.clear();
    notifyListeners();
  }

  Future<void> loadCategories() async {
    categoriesLoading = true;
    categoriesError = null;
    notifyListeners();
    try {
      final payload = await api.get('/categories');
      categories = listFrom(payload, 'categories')
          .map((item) => ProductCategory.fromJson(asMap(item)))
          .where((category) => category.id > 0 && category.name.isNotEmpty)
          .toList();
    } catch (exception) {
      categoriesError = exception.toString();
    } finally {
      categoriesLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadProducts() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final payload = await api.get('/products');
      products = listFrom(payload, 'products')
          .map((item) => Product.fromJson(asMap(item)))
          .where(
            (product) =>
                product.status == 'active' || product.status == 'sold_out',
          )
          .toList();
    } catch (exception) {
      error = exception.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> loadMine() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final payload = await api.get('/my-products');
      myProducts = listFrom(
        payload,
        'products',
      ).map((item) => Product.fromJson(asMap(item))).toList();
    } catch (exception) {
      error = exception.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> saveProduct({
    required Map<String, String> fields,
    List<XFile> images = const [],
    List<int> removeImageIds = const [],
    int? primaryImageId,
    int? primaryImageIndex,
    int? id,
  }) async {
    await api.sendProduct(
      fields: fields,
      images: images,
      removeImageIds: removeImageIds,
      primaryImageId: primaryImageId,
      primaryImageIndex: primaryImageIndex,
      id: id,
    );
    await Future.wait([loadMine(), loadProducts()]);
  }

  Future<void> deleteProduct(int id) async {
    await api.delete('/products/$id');
    await loadMine();
  }

  Future<void> updateStock(int id, int quantity, {int? variantId}) async {
    await api.put('/my-products/$id/stock', {
      'stock_quantity': quantity,
      'variant_id': variantId,
    });
    await Future.wait([loadMine(), loadProducts()]);
  }
}

class CartEntry {
  const CartEntry(this.product, this.quantity, {this.variant});
  final Product product;
  final int quantity;
  final ProductVariant? variant;
  String get key => '${product.id}:${variant?.id ?? 0}';
  int get availableStock => variant?.stockQuantity ?? product.stockQuantity;
  String get optionLabel => variant?.label ?? '';
  double get subtotal => product.price * quantity;
}

class CartState extends ChangeNotifier {
  CartState(this.storage);
  final FlutterSecureStorage storage;
  static const _key = 'tmc_student_cart_v1';
  static const _checkoutAttemptStoragePrefix =
      'tmc_student_checkout_attempt_v1_';
  final Map<String, CartEntry> _entries = {};
  int? _currentUserId;
  bool isLoaded = false;
  String? loadError;
  List<CartEntry> get entries => _entries.values.toList(growable: false);
  int get itemCount =>
      _entries.values.fold(0, (total, entry) => total + entry.quantity);
  double get total =>
      _entries.values.fold(0, (sum, entry) => sum + entry.subtotal);

  Future<void> setCurrentUser(int currentUserId) async {
    _currentUserId = currentUserId > 0 ? currentUserId : null;
    final previousCount = _entries.length;
    _entries.removeWhere(
      (_, entry) => isOwnProduct(entry.product, currentUserId),
    );
    if (_entries.length != previousCount) {
      await _save();
      notifyListeners();
    }
  }

  Future<void> load() async {
    isLoaded = false;
    loadError = null;
    notifyListeners();
    try {
      final raw = await storage.read(key: _key);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is! List) {
          throw const FormatException('Saved cart must be a list.');
        }
        final restored = <String, CartEntry>{};
        var removedOwnProduct = false;
        for (final item in decoded) {
          final row = asMap(item);
          final product = Product.fromJson(asMap(row['product']));
          final rawVariant = row['variant'];
          final variant = rawVariant is Map
              ? ProductVariant.fromJson(asMap(rawVariant))
              : null;
          final quantity = int.tryParse(valueOf(row['quantity'])) ?? 1;
          if (product.id > 0 && quantity > 0) {
            if (_currentUserId != null &&
                isOwnProduct(product, _currentUserId!)) {
              removedOwnProduct = true;
            } else {
              final entry = CartEntry(product, quantity, variant: variant);
              restored[entry.key] = entry;
            }
          }
        }
        _entries
          ..clear()
          ..addAll(restored);
        if (removedOwnProduct) await _save();
      }
    } on FormatException {
      loadError = 'Saved cart data could not be read. Retry to load it again.';
    } catch (_) {
      loadError = 'Saved cart could not be loaded. Your cart has been kept.';
    } finally {
      isLoaded = true;
      notifyListeners();
    }
  }

  Future<void> _save() async {
    final rows = _entries.values
        .map(
          (entry) => {
            'product': {
              'id': entry.product.id,
              'name': entry.product.name,
              'description': entry.product.description,
              'price': entry.product.price,
              'category': entry.product.category,
              'status': entry.product.status,
              'image': entry.product.image,
              'images': entry.product.images
                  .map((image) => image.toJson())
                  .toList(),
              'user': {
                'name': entry.product.sellerName,
                'student_id': entry.product.sellerStudentId,
              },
              'user_id': entry.product.userId,
              'stock_quantity': entry.product.stockQuantity,
              'sold_out_at': entry.product.soldOutAt,
              'archived_at': entry.product.archivedAt,
              'attributes': entry.product.attributes,
              'variants': entry.product.variants
                  .map((variant) => variant.toJson())
                  .toList(),
            },
            'variant': entry.variant?.toJson(),
            'quantity': entry.quantity,
          },
        )
        .toList();
    await storage.write(key: _key, value: jsonEncode(rows));
    loadError = null;
  }

  Future<bool> add(
    Product product, {
    ProductVariant? variant,
    required int currentUserId,
  }) async {
    if (isOwnProduct(product, currentUserId) ||
        product.status != 'active' ||
        (product.variants.isNotEmpty && variant == null) ||
        (product.variants.isEmpty && variant != null) ||
        (variant?.stockQuantity ?? product.stockQuantity) <= 0 ||
        (variant != null &&
            !product.variants.any((item) => item.id == variant.id))) {
      return false;
    }
    final entry = CartEntry(product, 1, variant: variant);
    final old = _entries[entry.key];
    if ((old?.quantity ?? 0) >= entry.availableStock) return false;
    final optimisticEntry = CartEntry(
      product,
      (old?.quantity ?? 0) + 1,
      variant: variant,
    );
    _entries[entry.key] = optimisticEntry;
    notifyListeners();

    try {
      await _save();
    } catch (_) {
      final current = _entries[entry.key];
      if (current != null) {
        final rolledBackQuantity = current.quantity - 1;
        if (rolledBackQuantity <= 0) {
          _entries.remove(entry.key);
        } else {
          _entries[entry.key] = CartEntry(
            current.product,
            rolledBackQuantity,
            variant: current.variant,
          );
        }
        notifyListeners();
      }
      rethrow;
    }
    return true;
  }

  Future<void> setQuantity(String key, int quantity) async {
    final entry = _entries[key];
    if (entry == null) return;
    if (quantity <= 0) {
      _entries.remove(key);
    } else if (quantity <= entry.availableStock &&
        entry.product.status == 'active') {
      _entries[key] = CartEntry(
        entry.product,
        quantity,
        variant: entry.variant,
      );
    } else {
      return;
    }
    await _save();
    notifyListeners();
  }

  Future<void> updateProduct(Product product) async {
    var changed = false;
    for (final entry in entries.where(
      (item) => item.product.id == product.id,
    )) {
      ProductVariant? updatedVariant;
      if (entry.variant != null) {
        for (final candidate in product.variants) {
          if (candidate.id == entry.variant!.id) {
            updatedVariant = candidate;
            break;
          }
        }
        updatedVariant ??= entry.variant;
      }
      _entries[entry.key] = CartEntry(
        product,
        entry.quantity,
        variant: updatedVariant,
      );
      changed = true;
    }
    if (changed) {
      await _save();
      notifyListeners();
    }
  }

  Future<void> removeEntries(Iterable<String> keys) async {
    var changed = false;
    for (final key in keys.toSet()) {
      changed = _entries.remove(key) != null || changed;
    }
    if (changed) {
      await _save();
      notifyListeners();
    }
  }

  Future<bool> restoreEntry(CartEntry entry) async {
    if (_entries.containsKey(entry.key) ||
        entry.product.status != 'active' ||
        entry.quantity > entry.availableStock ||
        (_currentUserId != null &&
            isOwnProduct(entry.product, _currentUserId!)) ||
        (entry.product.variants.isNotEmpty &&
            (entry.variant == null ||
                !entry.product.variants.any(
                  (variant) => variant.id == entry.variant!.id,
                ))) ||
        (entry.product.variants.isEmpty && entry.variant != null)) {
      return false;
    }
    _entries[entry.key] = entry;
    await _save();
    notifyListeners();
    return true;
  }

  Future<void> clear() async {
    _entries.clear();
    await storage.delete(key: _key);
    notifyListeners();
  }

  Future<String> checkoutIdempotencyKey({
    required int buyerId,
    required int paymentMethodId,
    required int pickupLocationId,
    required List<Map<String, Object?>> items,
  }) async {
    if (buyerId <= 0 || paymentMethodId <= 0 || pickupLocationId <= 0) {
      throw ArgumentError('Checkout requires valid buyer and option IDs.');
    }

    final normalizedItems =
        items.map((item) {
          final productId = item['product_id'];
          final variantId = item['variant_id'];
          final quantity = item['quantity'];
          if (productId is! int ||
              quantity is! int ||
              (variantId != null && variantId is! int)) {
            throw ArgumentError(
              'Checkout items have invalid identifiers or quantity.',
            );
          }
          return <String, Object?>{
            'product_id': productId,
            'variant_id': variantId,
            'quantity': quantity,
          };
        }).toList()..sort((left, right) {
          final productOrder = (left['product_id'] as int).compareTo(
            right['product_id'] as int,
          );
          if (productOrder != 0) return productOrder;
          return ((left['variant_id'] as int?) ?? 0).compareTo(
            (right['variant_id'] as int?) ?? 0,
          );
        });

    final fingerprint = jsonEncode({
      'buyer_id': buyerId,
      'payment_method_id': paymentMethodId,
      'pickup_location_id': pickupLocationId,
      'items': normalizedItems,
    });
    final storageKey = '$_checkoutAttemptStoragePrefix$buyerId';
    final existingJson = await storage.read(key: storageKey);
    if (existingJson != null) {
      try {
        final existing = jsonDecode(existingJson);
        if (existing is Map &&
            existing['fingerprint'] == fingerprint &&
            existing['idempotency_key'] is String &&
            (existing['idempotency_key'] as String).isNotEmpty) {
          return existing['idempotency_key'] as String;
        }
      } on FormatException {
        // Replace an unreadable attempt record with a fresh key.
      }
    }

    final random = Random.secure();
    final idempotencyKey = List<int>.generate(
      32,
      (_) => random.nextInt(256),
    ).map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
    await storage.write(
      key: storageKey,
      value: jsonEncode({
        'fingerprint': fingerprint,
        'idempotency_key': idempotencyKey,
      }),
    );
    return idempotencyKey;
  }

  Future<void> completeCheckoutAttempt({
    required int buyerId,
    required String idempotencyKey,
  }) async {
    if (buyerId <= 0 || idempotencyKey.isEmpty) return;
    final storageKey = '$_checkoutAttemptStoragePrefix$buyerId';
    final existingJson = await storage.read(key: storageKey);
    if (existingJson == null) return;

    try {
      final existing = jsonDecode(existingJson);
      if (existing is Map && existing['idempotency_key'] == idempotencyKey) {
        await storage.delete(key: storageKey);
      }
    } on FormatException {
      await storage.delete(key: storageKey);
    }
  }
}

String peso(double amount) {
  final formatted = amount.toStringAsFixed(2);
  return '\u20b1$formatted';
}
