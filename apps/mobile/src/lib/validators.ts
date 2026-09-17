const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function emailError(value: string): string | null {
  if (!value.trim()) return 'Email address is required';
  if (!isValidEmail(value)) return 'Please enter a valid email address';
  return null;
}

export function passwordError(value: string): string | null {
  if (!value) return 'Password is required';
  if (value.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function passwordMatchError(value: string, confirm: string): string | null {
  if (value !== confirm) return 'Passwords do not match';
  return null;
}
