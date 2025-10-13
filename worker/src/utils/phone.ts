/**
 * Normalize phone number to E.164 format
 * E.164 format: +[country code][subscriber number]
 * Example: +14155334125
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode = '1'): string {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length === 0) {
    throw new Error('Phone number must contain digits');
  }

  // If it already starts with country code, return with +
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }

  // If it's 10 digits (US number without country code), add +1
  if (digitsOnly.length === 10) {
    return `+${defaultCountryCode}${digitsOnly}`;
  }

  // If it already has a country code but no +
  if (digitsOnly.length > 10) {
    return `+${digitsOnly}`;
  }

  throw new Error(`Invalid phone number format: ${phone} (digits: ${digitsOnly})`);
}

/**
 * Validate if phone number is in E.164 format
 */
export function isValidE164(phone: string): boolean {
  // E.164 format: +[1-9]\d{1,14}
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}
