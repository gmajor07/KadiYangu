// Reserved for future reviewed ad placements between useful public content.
// Never mount in authentication, administration, or a future card canvas.
export function AdSlot({
  placement,
}: {
  placement: "catalog-bottom" | "category-bottom" | "detail-bottom";
}) {
  void placement;
  return null;
}
