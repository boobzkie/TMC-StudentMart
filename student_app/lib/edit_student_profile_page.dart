import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'data.dart';
import 'tmc_theme.dart';

class EditStudentProfilePage extends StatefulWidget {
  const EditStudentProfilePage({super.key});

  @override
  State<EditStudentProfilePage> createState() =>
      _EditStudentProfilePageState();
}

class _EditStudentProfilePageState extends State<EditStudentProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _contactNumber;
  String? _course;
  late bool _shareContactInfo;
  String? _error;

  @override
  void initState() {
    super.initState();
    final student = context.read<AuthState>().user!;
    _name = TextEditingController(text: student.name);
    _contactNumber = TextEditingController(text: student.contactNumber);
    _course = courseOptions.any((option) => option.code == student.course)
        ? student.course
        : null;
    _shareContactInfo = student.shareContactInfo;
  }

  @override
  void dispose() {
    _name.dispose();
    _contactNumber.dispose();
    super.dispose();
  }

  String? _optionalValue(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _error = null);

    final auth = context.read<AuthState>();
    final marketplace = context.read<MarketplaceState>();
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    try {
      await auth.updateProfile({
        'name': _name.text.trim(),
        'contact_number': _optionalValue(_contactNumber),
        'course': _course,
        'share_contact_info': _shareContactInfo,
      });

      await Future.wait([
        marketplace.loadProducts(),
        marketplace.loadMine(),
      ]);

      if (!mounted) return;

      messenger.showSnackBar(
        const SnackBar(content: Text('Your profile was updated.')),
      );
      navigator.pop();
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final student = context.watch<AuthState>().user;
    if (student == null) return const SizedBox.shrink();

    final saving = context.watch<AuthState>().savingProfile;

    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextFormField(
                      controller: _name,
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.name],
                      maxLength: 255,
                      decoration: const InputDecoration(
                        labelText: 'Full name',
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                              ? 'Enter your name.'
                              : null,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      initialValue: student.email,
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: 'Email address',
                        helperText:
                            'Email changes require a verified account process.',
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: _contactNumber,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      maxLength: 30,
                      decoration: const InputDecoration(
                        labelText: 'Contact number',
                      ),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: _course,
                      decoration: const InputDecoration(
                        labelText: 'Course / department',
                      ),
                      items: courseOptions
                          .map(
                            (course) => DropdownMenuItem<String>(
                              value: course.code,
                              child: Text(course.code),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => _course = value),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Contact sharing',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      'Choose whether your contact number is visible to students viewing your product listings.',
                      style: TextStyle(
                        color: TmcPalette.darkGray,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      value: _shareContactInfo,
                      onChanged: (value) {
                        setState(() => _shareContactInfo = value);
                      },
                      title: const Text(
                        'Share my contact details on my listings',
                      ),
                      subtitle: const Text(
                        'When enabled, your contact number is visible to students viewing your product listings.',
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: TmcPalette.error.withValues(alpha: .08),
                  borderRadius: BorderRadius.circular(TmcRadius.md),
                  border: Border.all(
                    color: TmcPalette.error.withValues(alpha: .35),
                  ),
                ),
                child: Text(
                  _error!,
                  style: const TextStyle(color: TmcPalette.error),
                ),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: saving ? null : _save,
              icon: saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(saving ? 'Saving…' : 'Save profile'),
            ),
          ],
        ),
      ),
    );
  }

}