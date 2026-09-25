export function formatTemplatePrice(
  isPremium: boolean,
  price: number | null,
  currency = "TZS",
) {
  if (!isPremium) return "Free";
  if (price === null || !Number.isSafeInteger(price) || price <= 0)
    return "Price unavailable";
  return `${currency} ${new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(price)}`;
}
