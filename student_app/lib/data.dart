import 'dart:convert';

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

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class ApiService {
  ApiService({http.Client? client, FlutterSecureStorage? storage})
    : _client = client ?? http.Client(),
      storage = storage ?? const FlutterSecureStorage();

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  static String get baseUrl {
    if (_configuredBaseUrl.isNotEmpty) return _configuredBaseUrl;
    if (kIsWeb) return 'http://127.0.0.1:8000/api';
    return 'http://10.0.2.2:8000/api';
  }

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
    final headers = <String, String>{'Accept': 'application/json'};
    if (authenticated) {
      final token = await storage.read(key: tokenKey);
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  Future<dynamic> _request(Future<http.Response> Function() send) async {
    try {
      return _decode(await send());
    } on http.ClientException catch (_) {
      throw ApiException(
        'Cannot reach the Laravel API at $baseUrl. Check that the backend is running and restart the app with the correct API URL for this platform.',
      );
    }
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

  Future<dynamic> delete(String path) async => _request(
    () async => _client.delete(_uri(path), headers: await _headers()),
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
      final streamed = await _client.send(request);
      return _decode(await http.Response.fromStream(streamed));
    } on http.ClientException catch (_) {
      throw ApiException(
        'Cannot reach the Laravel API at $baseUrl. Check that the backend is running and restart the app with the correct API URL for this platform.',
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
      throw ApiException(message, statusCode: response.statusCode);
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
    profilePicture: json['profile_picture']?.toString(),
    facebookUrl: valueOf(json['facebook_url']),
    instagramUrl: valueOf(json['instagram_url']),
    tiktokUrl: valueOf(json['tiktok_url']),
    shareContactInfo: json['share_contact_info'] == true ||
        valueOf(json['share_contact_info']).toLowerCase() == '1' ||
        valueOf(json['share_contact_info']).toLowerCase() == 'true',
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
    await api.post(
      '/forgot-password',
      {'email': email.trim()},
      authenticated: false,
    );
  }

  Future<void> updateProfile(Map<String, dynamic> values) async {
    savingProfile = true;
    notifyListeners();
    try {
      final payload = asMap(await api.put('/user/student-profile', values));
      final updated = Student.fromJson(asMap(payload['user']));
      if (updated.id == 0 || updated.role != 'student') {
        throw const ApiException('The API did not return your updated student profile.');
      }
      user = updated;
    } finally {
      savingProfile = false;
      notifyListeners();
    }
  }

  Future<void> register(Map<String, dynamic> values) async {
    busy = true;
    notifyListeners();
    try {
      final payload = asMap(
        await api.post('/register', values, authenticated: false),
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
        throw const ApiException('The API did not create a student account.');
      }
      user = student;
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
  bool loading = false;
  bool categoriesLoading = false;
  String? error;
  String? categoriesError;

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
          .where((product) =>
              product.status == 'active' || product.status == 'sold_out')
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

  Future<void> updateStock(int id, int quantity) async {
    await api.put('/my-products/$id/stock', {'stock_quantity': quantity});
    await Future.wait([loadMine(), loadProducts()]);
  }
}

class CartEntry {
  const CartEntry(this.product, this.quantity);
  final Product product;
  final int quantity;
  double get subtotal => product.price * quantity;
}

class CartState extends ChangeNotifier {
  CartState(this.storage);
  final FlutterSecureStorage storage;
  static const _key = 'tmc_student_cart_v1';
  final Map<int, CartEntry> _entries = {};
  int? _currentUserId;
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
    try {
      final raw = await storage.read(key: _key);
      if (raw != null) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          _entries.clear();
          var removedOwnProduct = false;
          for (final item in decoded) {
            final row = asMap(item);
            final product = Product.fromJson(asMap(row['product']));
            final quantity = int.tryParse(valueOf(row['quantity'])) ?? 1;
            if (product.id > 0 && quantity > 0) {
              if (_currentUserId != null &&
                  isOwnProduct(product, _currentUserId!)) {
                removedOwnProduct = true;
              } else {
                _entries[product.id] = CartEntry(product, quantity);
              }
            }
          }
          if (removedOwnProduct) await _save();
        }
      }
    } catch (_) {
      _entries.clear();
    }
    notifyListeners();
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
            },
            'quantity': entry.quantity,
          },
        )
        .toList();
    await storage.write(key: _key, value: jsonEncode(rows));
  }

  Future<bool> add(Product product, {required int currentUserId}) async {
    if (isOwnProduct(product, currentUserId) ||
        product.status != 'active' ||
        product.stockQuantity <= 0) {
      return false;
    }
    final old = _entries[product.id];
    if ((old?.quantity ?? 0) >= product.stockQuantity) return false;
    _entries[product.id] = CartEntry(product, (old?.quantity ?? 0) + 1);
    await _save();
    notifyListeners();
    return true;
  }

  Future<void> setQuantity(int id, int quantity) async {
    final entry = _entries[id];
    if (entry == null) return;
    if (quantity <= 0) {
      _entries.remove(id);
    } else if (quantity <= entry.product.stockQuantity &&
        entry.product.status == 'active') {
      _entries[id] = CartEntry(entry.product, quantity);
    } else {
      return;
    }
    await _save();
    notifyListeners();
  }

  Future<void> clear() async {
    _entries.clear();
    await storage.delete(key: _key);
    notifyListeners();
  }
}

String peso(double amount) {
  final formatted = amount.toStringAsFixed(2);
  return '₱$formatted';
}
