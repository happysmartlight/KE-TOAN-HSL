/** Validate số điện thoại VN: 10 chữ số, bắt đầu bằng 0 */
export function isValidPhone(phone: string): boolean {
  return /^0\d{9}$/.test(phone.trim());
}

/** Validate email cơ bản */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function phoneError(phone: string): string | null {
  if (!phone) return null;
  return isValidPhone(phone) ? null : 'Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 0)';
}

export function emailError(email: string): string | null {
  if (!email) return null;
  return isValidEmail(email) ? null : 'Email không hợp lệ';
}
