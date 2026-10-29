import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/components.dart';
import 'package:student_app/data.dart';
import 'package:student_app/tmc_theme.dart';

void main() {
  testWidgets('status badges have readable labels and clear semantics', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: TmcTheme.light,
        home: const Scaffold(body: StatusBadge('sold_out')),
      ),
    );

    expect(find.bySemanticsLabel('Status: Sold Out'), findsOneWidget);
    expect(tester.widget<Text>(find.text('Sold Out')).style?.fontSize, 12);
  });

  test('category responses preserve the server category ID and name', () {
    final category = ProductCategory.fromJson({
      'id': 17,
      'name': 'Books',
      'description': 'Books and course materials',
    });

    expect(category.id, 17);
    expect(category.name, 'Books');
    expect(category.description, 'Books and course materials');
  });

  test('registration course choices are the five official TMC options', () {
    expect(courseOptions.map((course) => course.code).toList(), [
      'BSIT',
      'BSCRIM',
      'BSOA',
      'BSED',
      'CAS',
    ]);
  });

  test('student response parsing keeps fields returned by Laravel', () {
    final student = Student.fromJson({
      'id': 12,
      'name': 'TMC Student',
      'email': 'student@example.com',
      'student_id': 'TMC-2026-001',
      'contact_number': '09170000000',
      'course': 'BSIT',
      'role': 'student',
      'status': 'active',
    });

    expect(student.id, 12);
    expect(student.studentId, 'TMC-2026-001');
    expect(student.course, 'BSIT');
    expect(student.role, 'student');
    expect(student.status, 'active');
  });

  test('product parsing reads gallery photos and chooses the cover image', () {
    final product = Product.fromJson({
      'id': 8,
      'name': 'Used textbook',
      'description': 'Good condition',
      'price': '250.50',
      'category': 'Books',
      'status': 'active',
      'image': 'products/cover.jpg',
      'images': [
        {
          'id': 20,
          'path': 'products/cover.jpg',
          'sort_order': 0,
          'is_primary': true,
        },
        {
          'id': 21,
          'path': 'products/back.jpg',
          'sort_order': 1,
          'is_primary': false,
        },
      ],
      'user': {'id': 4, 'name': 'Seller', 'student_id': 'TMC-04'},
    });

    expect(product.id, 8);
    expect(product.price, 250.50);
    expect(product.category, 'Books');
    expect(product.sellerName, 'Seller');
    expect(product.image, 'products/cover.jpg');
    expect(product.images.map((image) => image.path).toList(), [
      'products/cover.jpg',
      'products/back.jpg',
    ]);
    expect(product.images.first.isPrimary, isTrue);
  });

  test('single-image product responses remain compatible', () {
    final product = Product.fromJson({
      'id': 9,
      'name': 'Notebook',
      'description': 'Unused',
      'price': 25,
      'category': 'Supplies',
      'status': 'active',
      'image': 'products/notebook.jpg',
    });

    expect(product.image, 'products/notebook.jpg');
    expect(product.images, hasLength(1));
    expect(product.images.single.path, 'products/notebook.jpg');
  });

  test('a student cannot purchase their own product', () {
    const ownProduct = Product(
      id: 23,
      name: 'My textbook',
      description: '',
      price: 100,
      category: 'Books',
      status: 'active',
      userId: 7,
    );
    const otherProduct = Product(
      id: 24,
      name: 'Another textbook',
      description: '',
      price: 100,
      category: 'Books',
      status: 'active',
      userId: 8,
    );

    expect(isOwnProduct(ownProduct, 7), isTrue);
    expect(isOwnProduct(otherProduct, 7), isFalse);
    expect(isOwnProduct(ownProduct, 0), isFalse);
  });
}
