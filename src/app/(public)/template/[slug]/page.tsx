import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTemplate } from "@/services/catalog";
import { CatalogImage } from "@/components/catalog/catalog-image";
import { AdSlot } from "@/components/catalog/ad-slot";
import { formatTemplatePrice } from "@/lib/catalog/money";
import { catalogMetadata } from "@/lib/catalog/metadata";
import { customizeTemplateAction } from "./actions";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const template = await getPublicTemplate((await params).slug);
  if (!template) notFound();
  return catalogMetadata(
    template.name,
    template.description,
    `/template/${template.slug}`,
    false,
    template.previewImageUrl || template.thumbnailUrl,
  );
}
export default async function TemplateDetail({ params }: Props) {
  const template = await getPublicTemplate((await params).slug);
  if (!template) notFound();
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap gap-2 text-xs text-forest/65"
      >
        <Link href="/templates" className="underline">
          Templates
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/templates/category/${template.category.slug}`}
          className="underline"
        >
          {template.category.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{template.name}</span>
      </nav>
      <div className="grid items-start gap-10 md:grid-cols-2 lg:gap-16">
        <div className="flex min-h-80 items-center justify-center rounded-3xl border border-forest/10 bg-[#ece8de] p-8 sm:p-12">
          <CatalogImage
            src={template.previewImageUrl || template.thumbnailUrl}
            alt={`${template.name} invitation preview`}
            priority
            className="max-h-[650px] w-full object-contain drop-shadow-xl"
          />
        </div>
        <div className="min-w-0 md:py-7">
          <Link
            href={`/templates/category/${template.category.slug}`}
            className="eyebrow"
          >
            {template.category.name}
          </Link>
          <h1 className="mt-4 break-words font-serif text-4xl leading-tight sm:text-5xl">
            {template.name}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${template.isPremium ? "bg-[#f4dfac] text-[#62481b]" : "bg-forest/10 text-forest"}`}
            >
              {template.isPremium ? "PREMIUM" : "FREE"}
            </span>
            <span className="text-xl font-semibold">
              {formatTemplatePrice(
                template.isPremium,
                template.price,
                template.currency,
              )}
            </span>
          </div>
          <p className="mt-6 whitespace-pre-line leading-8 text-forest/75">
            {template.description}
          </p>
          <dl className="mt-7 grid grid-cols-2 gap-4 border-y border-forest/15 py-5 text-sm">
            <div>
              <dt className="text-forest/60">Format</dt>
              <dd className="mt-1 capitalize">
                {template.orientation.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-forest/60">Canvas dimensions</dt>
              <dd className="mt-1">
                {template.width} × {template.height} px
              </dd>
            </div>
          </dl>
          <div className="mt-7 rounded-2xl border border-forest/15 bg-white p-6">
            <form action={customizeTemplateAction}>
              <input type="hidden" name="slug" value={template.slug} />
              <button aria-describedby="editor-note" className="w-full rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white">Customize This Template</button>
            </form>
            <h2 id="editor-note" className="mt-4 text-sm font-semibold">
              Start your invitation design
            </h2>
            <p className="mt-2 text-xs leading-6 text-forest/70">
              Open the editor to personalize this template. Saving requires an account.
            </p>
          </div>
          <Link
            href="/templates"
            className="mt-7 inline-block text-sm font-semibold underline underline-offset-4"
          >
            ← Keep exploring
          </Link>
        </div>
      </div>
      <AdSlot placement="detail-bottom" />
    </section>
  );
}
