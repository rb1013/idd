// Keep in sync with apps/mobile/src/lib/validators.ts
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_HINT = 'Min. 6 chars, upper, lower & digit';

export function passwordError(value: string): string | null {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(value)) return 'Password must contain at least one digit.';
  return null;
}

export function passwordMatchError(value: string, confirm: string): string | null {
  if (value !== confirm) return 'Passwords do not match.';
  return null;
}
