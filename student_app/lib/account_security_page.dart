import "package:flutter/material.dart";
import "package:provider/provider.dart";

import "data.dart";
import "tmc_theme.dart";

class AccountSecurityPage extends StatefulWidget {
  const AccountSecurityPage({super.key});

  @override
  State<AccountSecurityPage> createState() => _AccountSecurityPageState();
}

class _AccountSecurityPageState extends State<AccountSecurityPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  bool _saving = false;
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  String? _error;

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  String? _required(String? value, String label) {
    if (value == null || value.trim().isEmpty) {
      return "$label is required.";
    }
    return null;
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().changePassword(
        currentPassword: _currentPassword.text,
        newPassword: _newPassword.text,
        confirmPassword: _confirmPassword.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Your password was changed successfully."),
        ),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Change password")),
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
                      controller: _currentPassword,
                      obscureText: _obscureCurrent,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        labelText: "Current password",
                        suffixIcon: IconButton(
                          tooltip: _obscureCurrent
                              ? "Show password"
                              : "Hide password",
                          onPressed: () => setState(() {
                            _obscureCurrent = !_obscureCurrent;
                          }),
                          icon: Icon(
                            _obscureCurrent
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                        ),
                      ),
                      validator: (value) =>
                          _required(value, "Current password"),
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _newPassword,
                      obscureText: _obscureNew,
                      autofillHints: const [AutofillHints.newPassword],
                      decoration: InputDecoration(
                        labelText: "New password",
                        helperText: "Must be at least 8 characters.",
                        suffixIcon: IconButton(
                          tooltip: _obscureNew
                              ? "Show password"
                              : "Hide password",
                          onPressed: () => setState(() {
                            _obscureNew = !_obscureNew;
                          }),
                          icon: Icon(
                            _obscureNew
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        final required = _required(value, "New password");
                        if (required != null) return required;
                        if (value!.length < 8) {
                          return "Password must be at least 8 characters.";
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _confirmPassword,
                      obscureText: _obscureConfirm,
                      autofillHints: const [AutofillHints.newPassword],
                      decoration: InputDecoration(
                        labelText: "Confirm new password",
                        suffixIcon: IconButton(
                          tooltip: _obscureConfirm
                              ? "Show password"
                              : "Hide password",
                          onPressed: () => setState(() {
                            _obscureConfirm = !_obscureConfirm;
                          }),
                          icon: Icon(
                            _obscureConfirm
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        final required = _required(value, "Confirm password");
                        if (required != null) return required;
                        if (value != _newPassword.text) {
                          return "Passwords do not match.";
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            if (_error != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: TmcPalette.errorSoft,
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
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: TmcControlSize.filledButtonHeight,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.lock_outlined),
                label: Text(_saving ? "Changing..." : "Change password"),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
