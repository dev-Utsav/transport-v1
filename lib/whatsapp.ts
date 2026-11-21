/** Indian numbers: keep digits, assume +91 for 10-digit mobiles. Empty when unusable. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return "";
}

/** wa.me link that opens WhatsApp with the text ready; without a number the admin picks the chat. */
export function waLink(phone: string, text: string): string {
  const number = waNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
