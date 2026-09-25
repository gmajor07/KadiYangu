import Link from "next/link";
import type { CatalogTemplate } from "@/services/catalog";
import { CatalogImage } from "./catalog-image";
import { formatTemplatePrice } from "@/lib/catalog/money";
export function TemplateCard({ template }: { template: CatalogTemplate }) {
  return (
    <article className="group min-w-0">
      <Link
        href={`/template/${template.slug}`}
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-forest/10 bg-[#ede9df] p-6 transition hover:bg-[#e4dfd1]"
        aria-label={`Preview ${template.name}`}
      >
        <CatalogImage
          src={template.thumbnailUrl}
          alt={`${template.name} invitation design`}
          className="h-full w-full object-contain drop-shadow-lg transition duration-300 group-hover:scale-[1.025]"
        />
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${template.isPremium ? "bg-[#f4dfac] text-[#62481b]" : "bg-white text-forest"}`}
        >
          {template.isPremium ? "✦ Premium" : "Free"}
        </span>
      </Link>
      <p className="mt-4 text-xs text-forest/65">{template.category.name}</p>
      <h3 className="mt-1 break-words text-lg font-semibold">
        <Link href={`/template/${template.slug}`}>{template.name}</Link>
      </h3>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold">
          {formatTemplatePrice(
            template.isPremium,
            template.price,
            template.currency,
          )}
        </span>
        <Link
          href={`/template/${template.slug}`}
          className="font-semibold underline decoration-forest/30 underline-offset-4"
          aria-label={`Customize ${template.name}`}
        >
          Customize <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
export function TemplateGrid({ templates }: { templates: CatalogTemplate[] }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}
