export function ContentPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="prose mx-auto max-w-3xl px-6 py-16">
      <span className="text-xs font-semibold uppercase tracking-widest text-[#a75f38]">
        {eyebrow}
      </span>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1>
      {children}
    </article>
  );
}
