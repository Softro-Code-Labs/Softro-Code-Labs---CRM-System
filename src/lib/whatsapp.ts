/**
 * Builds a wa.me link. Sri Lankan local numbers (07X XXX XXXX) are converted
 * to international format (947X XXX XXXX).
 */
export function whatsappLink(phone: string | null | undefined, message?: string) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `94${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) digits = `94${digits}`;
  if (digits.length < 8) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
