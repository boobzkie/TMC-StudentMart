import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'components.dart';
import 'data.dart';
import 'tmc_theme.dart';

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _studentId = TextEditingController();
  final _email = TextEditingController();
  final _contact = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _registering = false;
  bool _showPassword = false;
  String? _course;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _studentId.dispose();
    _email.dispose();
    _contact.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  String? _required(String? value, String label) =>
      value == null || value.trim().isEmpty ? '$label is required.' : null;

  String? _validateEmail(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Email address is required.';
    }
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value.trim())) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() => _error = null);
    final auth = context.read<AuthState>();
    try {
      if (_registering) {
        await auth.register({
          'name': _name.text.trim(),
          'student_id': _studentId.text.trim(),
          'email': _email.text.trim(),
          'contact_number': _contact.text.trim(),
          'course': _course,
          'password': _password.text,
          'password_confirmation': _confirm.text,
        });
      } else {
        await auth.login(_email.text.trim(), _password.text);
      }
    } catch (exception) {
      if (mounted) setState(() => _error = exception.toString());
    }
  }

  Future<void> _showPasswordRecovery() async {
    await showDialog<void>(
      context: context,
      builder: (_) => const _PasswordRecoveryDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final busy = context.watch<AuthState>().busy;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 22, 24, 28),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 12),
                    const Center(child: BrandLogo(size: 92)),
                    const SizedBox(height: 12),
                    const Text(
                      'TMC StudentMart',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w900,
                        color: TmcPalette.deepNavy,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      _registering
                          ? 'Create your student account'
                          : 'Your campus marketplace',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: TmcPalette.darkGray),
                    ),
                    const SizedBox(height: 28),
                    Text(
                      _registering ? 'Join the TMC community' : 'Welcome back',
                      style: const TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w800,
                        color: TmcPalette.deepNavyBlack,
                      ),
                    ),
                    const SizedBox(height: 18),
                    if (_registering) ...[
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'Full name',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: (value) => _required(value, 'Full name'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _studentId,
                        decoration: const InputDecoration(
                          labelText: 'Student ID',
                          prefixIcon: Icon(Icons.badge_outlined),
                        ),
                        validator: (value) => _required(value, 'Student ID'),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        labelText: 'Email address',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                      validator: _validateEmail,
                    ),
                    if (_registering) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _contact,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Contact number',
                          prefixIcon: Icon(Icons.phone_outlined),
                        ),
                        validator: (value) =>
                            _required(value, 'Contact number'),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _course,
                        decoration: const InputDecoration(
                          labelText: 'Course / Department',
                          prefixIcon: Icon(Icons.school_outlined),
                        ),
                        items: courseOptions
                            .map(
                              (course) => DropdownMenuItem(
                                value: course.code,
                                child: Text(
                                  course.code,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        validator: (value) => value == null
                            ? 'Select your course / department.'
                            : null,
                        onChanged: (value) => setState(() => _course = value),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      controller: _password,
                      obscureText: !_showPassword,
                      autofillHints: _registering
                          ? const [AutofillHints.newPassword]
                          : const [AutofillHints.password],
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          onPressed: () =>
                              setState(() => _showPassword = !_showPassword),
                          tooltip: _showPassword
                              ? 'Hide password'
                              : 'Show password',
                          icon: Icon(
                            _showPassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        final required = _required(value, 'Password');
                        if (required != null) {
                          return required;
                        }
                        if (_registering && value!.length < 8) {
                          return 'Use at least 8 characters.';
                        }
                        return null;
                      },
                    ),
                    if (!_registering)
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: busy ? null : _showPasswordRecovery,
                          child: const Text('Forgot password?'),
                        ),
                      ),
                    if (_registering) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _confirm,
                        obscureText: !_showPassword,
                        decoration: const InputDecoration(
                          labelText: 'Confirm password',
                          prefixIcon: Icon(Icons.lock_reset_outlined),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please confirm your password.';
                          }
                          if (value != _password.text) {
                            return 'Passwords do not match.';
                          }
                          return null;
                        },
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      _InlineError(message: _error!),
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: busy ? null : _submit,
                      child: busy
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(_registering ? 'Create account' : 'Sign in'),
                    ),
                    const SizedBox(height: 10),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => setState(() {
                              _registering = !_registering;
                              _error = null;
                            }),
                      child: Text(
                        _registering
                            ? 'Already registered? Sign in'
                            : 'New to StudentMart? Create an account',
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Student accounts are handled by the TMC StudentMart service. Use the email address registered with your account.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: TmcPalette.darkGray,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PasswordRecoveryDialog extends StatefulWidget {
  const _PasswordRecoveryDialog();

  @override
  State<_PasswordRecoveryDialog> createState() => _PasswordRecoveryDialogState();
}

class _PasswordRecoveryDialogState extends State<_PasswordRecoveryDialog> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().requestPasswordReset(_email.text);
      if (mounted) setState(() => _sent = true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'Email address is required.';
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      return 'Enter a valid email address.';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(_sent ? 'Check your email' : 'Reset your password'),
    content: _sent
        ? const Text(
            'If an account matches that email, password-reset instructions have been sent. Open the link from your email to choose a new password.',
          )
        : Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Enter the email address registered to your student account. We will send a reset link if an account matches.',
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(
                    labelText: 'Email address',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: _validateEmail,
                  enabled: !_loading,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  _InlineError(message: _error!),
                ],
              ],
            ),
          ),
    actions: [
      TextButton(
        onPressed: _loading ? null : () => Navigator.of(context).pop(),
        child: Text(_sent ? 'Close' : 'Cancel'),
      ),
      if (!_sent)
        FilledButton(
          onPressed: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Send reset link'),
        ),
    ],
  );
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: TmcPalette.error.withValues(alpha: .08),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: TmcPalette.error.withValues(alpha: .3)),
    ),
    child: Text(
      message,
      style: const TextStyle(
        color: TmcPalette.error,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}
