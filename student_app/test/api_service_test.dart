import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/data.dart';

void main() {
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
}
