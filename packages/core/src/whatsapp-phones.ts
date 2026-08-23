const MIN_ALLOWED_PHONE_DIGITS = 8;

export function parseAllowedWhatsAppPhones(raw: string): string[] {
  const phones = new Set<string>();

  for (const part of raw.split(",")) {
    const digits = part.replace(/\D/g, "");

    if (!digits) {
      continue;
    }

    if (digits.length < MIN_ALLOWED_PHONE_DIGITS) {
      throw new Error(`Invalid WhatsApp number: ${part.trim()}`);
    }

    phones.add(digits);
  }

  return [...phones];
}
