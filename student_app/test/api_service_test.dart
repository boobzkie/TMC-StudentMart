// ignore_for_file: depend_on_referenced_packages

import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/test/test_flutter_secure_storage_platform.dart';
import 'package:flutter_secure_storage_platform_interface/flutter_secure_storage_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:student_app/data.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStoragePlatform.instance = TestFlutterSecureStoragePlatform(
      {},
    );
  });

  test('catalogProducts sends server-side filters and pagination', () async {
    late http.Request request;
    final api = ApiService(
      client: MockClient((received) async {
        request = received;
        return http.Response(
          jsonEncode({
            'success': true,
            'products': <Object?>[],
            'total': 31,
            'pagination': {
              'current_page': 2,
              'last_page': 2,
              'per_page': 24,
              'total': 31,
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final page = await api.catalogProducts(
      page: 2,
      search: 'Study books',
      category: 'Books',
      categoryId: 3,
      minPrice: 10,
      maxPrice: 500,
      condition: 'New',
      inStockOnly: true,
      sort: 'price_asc',
    );

    expect(request.url.path, endsWith('/products'));
    expect(request.url.queryParameters, {
      'page': '2',
      'per_page': '24',
      'sort': 'price_asc',
      'search': 'Study books',
      'category': 'Books',
      'category_id': '3',
      'min_price': '10.0',
      'max_price': '500.0',
      'condition': 'new',
      'in_stock': '1',
    });
    expect(page.currentPage, 2);
    expect(page.lastPage, 2);
    expect(page.total, 31);
    expect(page.hasMore, isFalse);
  });

  test(
    'reports API socket failures as an unreachable server, not no internet',
    () async {
      final api = ApiService(
        client: MockClient((_) async {
          throw const SocketException('Failed host lookup');
        }),
      );

      await expectLater(
        api.post('/login', {
          'email': 'student@example.com',
          'password': 'test-password',
        }, authenticated: false),
        throwsA(
          isA<ApiException>()
              .having((error) => error.type, 'type', ApiErrorType.cannotConnect)
              .having(
                (error) => error.message,
                'message',
                allOf(
                  contains('Cannot reach the StudentMart API'),
                  isNot(contains('No internet connection')),
                ),
              ),
        ),
      );
    },
  );

  test(
    'reports HTTP client connection failures as API reachability errors',
    () async {
      final api = ApiService(
        client: MockClient((_) async {
          throw http.ClientException('Connection refused');
        }),
      );

      await expectLater(
        api.post('/login', {
          'email': 'student@example.com',
          'password': 'test-password',
        }, authenticated: false),
        throwsA(
          isA<ApiException>()
              .having((error) => error.type, 'type', ApiErrorType.cannotConnect)
              .having(
                (error) => error.message,
                'message',
                allOf(
                  contains('Cannot reach the StudentMart API'),
                  isNot(contains('No internet connection')),
                ),
              ),
        ),
      );
    },
  );

  test('reports API timeouts separately from connection failures', () async {
    final api = ApiService(
      client: MockClient((_) async => throw TimeoutException('test timeout')),
    );

    await expectLater(
      api.post('/login', {
        'email': 'student@example.com',
        'password': 'test-password',
      }, authenticated: false),
      throwsA(
        isA<ApiException>()
            .having((error) => error.type, 'type', ApiErrorType.timeout)
            .having(
              (error) => error.message,
              'message',
              contains('Timed out while contacting the Laravel API'),
            ),
      ),
    );
  });

  test('preserves Laravel login validation errors as HTTP errors', () async {
    final api = ApiService(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'message': 'The given data was invalid.',
            'errors': {
              'email': ['The provided credentials are incorrect.'],
            },
          }),
          422,
          headers: {'content-type': 'application/json'},
        ),
      ),
    );

    await expectLater(
      api.post('/login', {
        'email': 'student@example.com',
        'password': 'test-password',
      }, authenticated: false),
      throwsA(
        isA<ApiException>()
            .having((error) => error.statusCode, 'statusCode', 422)
            .having((error) => error.type, 'type', ApiErrorType.httpError)
            .having(
              (error) => error.message,
              'message',
              'The provided credentials are incorrect.',
            ),
      ),
    );
  });

  for (final statusCode in [200, 502]) {
    test('rejects HTML API responses safely (HTTP $statusCode)', () async {
      final api = ApiService(
        client: MockClient(
          (_) async => http.Response(
            '<!doctype html><html><body>gateway detail</body></html>',
            statusCode,
            headers: {'content-type': 'text/html; charset=utf-8'},
          ),
        ),
      );

      await expectLater(
        api.post('/login', {
          'email': 'student@example.com',
          'password': 'test-password',
        }, authenticated: false),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', statusCode)
              .having((error) => error.type, 'type', ApiErrorType.httpError)
              .having(
                (error) => error.message,
                'message',
                allOf(contains('HTML page'), isNot(contains('gateway detail'))),
              ),
        ),
      );
    });
  }

  test(
    'does not expose Laravel internals from an HTTP 500 JSON response',
    () async {
      final api = ApiService(
        client: MockClient(
          (_) async => http.Response(
            jsonEncode({'message': 'SQLSTATE[HY000] private database detail'}),
            500,
            headers: {'content-type': 'application/json'},
          ),
        ),
      );

      await expectLater(
        api.post('/login', {
          'email': 'student@example.com',
          'password': 'test-password',
        }, authenticated: false),
        throwsA(
          isA<ApiException>()
              .having((error) => error.statusCode, 'statusCode', 500)
              .having(
                (error) => error.message,
                'message',
                allOf(
                  contains('temporarily unavailable'),
                  isNot(contains('SQLSTATE')),
                ),
              ),
        ),
      );
    },
  );

  test(
    'marketplace loads later pages, shows loading, and removes duplicates',
    () async {
      final firstPage = Completer<http.Response>();
      final secondPage = Completer<http.Response>();
      final requests = <http.Request>[];
      final api = ApiService(
        client: MockClient((request) async {
          requests.add(request);
          return switch (request.url.queryParameters['page']) {
            '1' => firstPage.future,
            '2' => secondPage.future,
            _ => throw StateError('Unexpected catalog page.'),
          };
        }),
      );
      final marketplace = MarketplaceState(api);

      final initialLoad = marketplace.loadProducts();
      expect(marketplace.loading, isTrue);
      firstPage.complete(
        _catalogResponse(
          products: [_catalogProductJson(1)],
          currentPage: 1,
          lastPage: 2,
          total: 3,
        ),
      );
      await initialLoad;

      expect(marketplace.loading, isFalse);
      expect(marketplace.products.map((product) => product.id), [1]);
      expect(marketplace.hasMoreProducts, isTrue);

      final nextLoad = marketplace.loadMoreProducts();
      expect(marketplace.loadingMoreProducts, isTrue);
      secondPage.complete(
        _catalogResponse(
          products: [_catalogProductJson(1), _catalogProductJson(2)],
          currentPage: 2,
          lastPage: 2,
          total: 3,
        ),
      );
      await nextLoad;

      expect(marketplace.loadingMoreProducts, isFalse);
      expect(marketplace.loadMoreProductsError, isNull);
      expect(marketplace.products.map((product) => product.id), [1, 2]);
      expect(marketplace.hasMoreProducts, isFalse);
      expect(requests.map((request) => request.url.queryParameters['page']), [
        '1',
        '2',
      ]);
    },
  );

  test(
    'marketplace retains products after a page error and can retry',
    () async {
      var failNextPage = true;
      final api = ApiService(
        client: MockClient((request) async {
          if (request.url.queryParameters['page'] == '1') {
            return _catalogResponse(
              products: [_catalogProductJson(1)],
              currentPage: 1,
              lastPage: 2,
              total: 2,
            );
          }
          if (failNextPage) {
            return http.Response(
              jsonEncode({'message': 'Temporary catalog error.'}),
              503,
              headers: {'content-type': 'application/json'},
            );
          }
          return _catalogResponse(
            products: [_catalogProductJson(2)],
            currentPage: 2,
            lastPage: 2,
            total: 2,
          );
        }),
      );
      final marketplace = MarketplaceState(api);

      await marketplace.loadProducts();
      await marketplace.loadMoreProducts();

      expect(marketplace.products.map((product) => product.id), [1]);
      expect(marketplace.loadMoreProductsError, isNotNull);
      expect(marketplace.loadingMoreProducts, isFalse);

      failNextPage = false;
      await marketplace.loadMoreProducts();

      expect(marketplace.products.map((product) => product.id), [1, 2]);
      expect(marketplace.loadMoreProductsError, isNull);
      expect(marketplace.hasMoreProducts, isFalse);
    },
  );

  test(
    'empty catalog response settles without advertising another page',
    () async {
      final api = ApiService(
        client: MockClient(
          (_) async => _catalogResponse(
            products: const [],
            currentPage: 1,
            lastPage: 1,
            total: 0,
          ),
        ),
      );
      final marketplace = MarketplaceState(api);

      await marketplace.loadProducts();

      expect(marketplace.products, isEmpty);
      expect(marketplace.loading, isFalse);
      expect(marketplace.hasMoreProducts, isFalse);
      expect(marketplace.error, isNull);
    },
  );

  group('API base URL configuration', () {
    test(
      'requires an explicit API URL on Android instead of a stale tunnel default',
      () {
        expect(
          ApiService.resolveBaseUrls(
            configuredBaseUrls: '',
            configuredBaseUrl: '',
            isWeb: false,
            platform: TargetPlatform.android,
          ),
          isEmpty,
        );
      },
    );

    test(
      'does not fall back to the emulator-only 10.0.2.2 address on Android',
      () {
        final urls = ApiService.resolveBaseUrls(
          configuredBaseUrls: '',
          configuredBaseUrl: '',
          isWeb: false,
          platform: TargetPlatform.android,
        );
        expect(urls, isEmpty);
        expect(urls, isNot(contains('http://10.0.2.2:8000/api')));
      },
    );

    test(
      'rejects loopback hosts on Android instead of targeting the phone',
      () {
        expect(
          ApiService.resolveBaseUrls(
            configuredBaseUrls: '',
            configuredBaseUrl: 'http://localhost:8000/api',
            isWeb: false,
            platform: TargetPlatform.android,
          ),
          isEmpty,
        );
      },
    );

    test(
      'accepts the Android emulator host only when explicitly configured',
      () {
        expect(
          ApiService.resolveBaseUrls(
            configuredBaseUrls: '',
            configuredBaseUrl: 'http://10.0.2.2:8000/api',
            isWeb: false,
            platform: TargetPlatform.android,
          ),
          ['http://10.0.2.2:8000/api'],
        );
      },
    );

    test('preserves the configured HTTPS API base and its /api prefix', () {
      const configuredUrl = 'https://api.example.test/api';
      expect(
        ApiService.resolveBaseUrls(
          configuredBaseUrls: '',
          configuredBaseUrl: configuredUrl,
          isWeb: false,
          platform: TargetPlatform.android,
        ),
        [configuredUrl],
      );
    });

    test('uses the configured compile-time API_BASE_URL for login', () async {
      const configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
      if (configuredBaseUrl.isEmpty) return;

      late http.Request request;
      final api = ApiService(
        client: MockClient((received) async {
          request = received;
          return http.Response(
            jsonEncode({'success': true}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      await api.post('/login', {
        'email': 'student@example.com',
        'password': 'test-password',
      }, authenticated: false);

      final configuredUri = Uri.parse(configuredBaseUrl);
      expect(request.url.scheme, configuredUri.scheme);
      expect(request.url.host, configuredUri.host);
      expect(
        request.url.path,
        '${configuredUri.path.replaceFirst(RegExp(r'/+$'), '')}/login',
      );
      expect(request.url.path, '/api/login');
    });

    test('uses a local host on desktop when no URL is configured', () {
      expect(
        ApiService.resolveBaseUrls(
          configuredBaseUrls: '',
          configuredBaseUrl: '',
          isWeb: false,
          platform: TargetPlatform.windows,
        ),
        ['http://127.0.0.1:8000/api'],
      );
    });

    test('normalizes whitespace in configured Laravel API URLs', () {
      expect(
        ApiService.normalizeBaseUrl('http:// 10.0.2.2:8000/api'),
        'http://10.0.2.2:8000/api',
      );
      expect(
        ApiService.normalizeBaseUrl('  https://api.example.test/api  '),
        'https://api.example.test/api',
      );
    });
  });
}

http.Response _catalogResponse({
  required List<Map<String, Object?>> products,
  required int currentPage,
  required int lastPage,
  required int total,
}) => http.Response(
  jsonEncode({
    'success': true,
    'products': products,
    'total': total,
    'pagination': {
      'current_page': currentPage,
      'last_page': lastPage,
      'per_page': 24,
      'total': total,
    },
  }),
  200,
  headers: {'content-type': 'application/json'},
);

Map<String, Object?> _catalogProductJson(int id) => {
  'id': id,
  'name': 'Catalog item $id',
  'description': 'A test marketplace listing.',
  'price': 100 + id,
  'category': 'Books',
  'status': 'active',
  'stock_quantity': 2,
  'user_id': 20,
  'user': {'id': 20, 'name': 'Test Seller', 'username': 'testseller'},
  'images': <Map<String, Object?>>[],
  'attributes': {'condition': 'New'},
  'variants': <Map<String, Object?>>[],
};
