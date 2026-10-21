import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/data.dart';

void main() {
  group('API base URL configuration', () {
    test(
      'uses only the ngrok tunnel for physical Android devices by default',
      () {
        expect(
          ApiService.resolveBaseUrls(
            configuredBaseUrls: '',
            configuredBaseUrl: '',
            isWeb: false,
            platform: TargetPlatform.android,
          ),
          ['https://freestyle-fondly-auction.ngrok-free.dev/api'],
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
        expect(urls, isNot(contains('http://10.0.2.2:8000/api')));
        expect(
          urls.first,
          'https://freestyle-fondly-auction.ngrok-free.dev/api',
        );
      },
    );

    test(
      'keeps a configured Android URL as-is without rewriting to 10.0.2.2',
      () {
        expect(
          ApiService.resolveBaseUrls(
            configuredBaseUrls: '',
            configuredBaseUrl: 'http://localhost:8000/api',
            isWeb: false,
            platform: TargetPlatform.android,
          ),
          ['http://localhost:8000/api'],
        );
      },
    );

    test('keeps the configured HTTPS tunnel for a physical Android device', () {
      expect(
        ApiService.resolveBaseUrls(
          configuredBaseUrls: '',
          configuredBaseUrl:
              'https://freestyle-fondly-auction.ngrok-free.dev/api',
          isWeb: false,
          platform: TargetPlatform.android,
        ),
        ['https://freestyle-fondly-auction.ngrok-free.dev/api'],
      );
    });

    test('uses a local host on desktop when no URL is configured', () {
      expect(
        ApiService.resolveBaseUrls(
          configuredBaseUrls: '',
          configuredBaseUrl: '',
          isWeb: false,
          platform: TargetPlatform.windows,
        ),
        [
          'http://127.0.0.1:8000/api',
          'https://freestyle-fondly-auction.ngrok-free.dev/api',
        ],
      );
    });

    test('normalizes whitespace in configured Laravel API URLs', () {
      expect(
        ApiService.normalizeBaseUrl('http:// 10.0.2.2:8000/api'),
        'http://10.0.2.2:8000/api',
      );
      expect(
        ApiService.normalizeBaseUrl('  https://my.ngrok-free.app/api  '),
        'https://my.ngrok-free.app/api',
      );
    });
  });
}
