export function CatalogLoading() {
  return (
    <div role="status" className="mx-auto max-w-6xl px-6 py-16">
      <p className="mb-8 text-sm text-forest/70">
        Finding something beautiful…
      </p>
      <div aria-hidden="true" className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div
            key={key}
            className="aspect-[4/5] rounded-2xl bg-forest/5 motion-safe:animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
