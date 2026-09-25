import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { CategoryGrid } from "@/components/catalog/category-grid";
import { TemplateGrid } from "@/components/catalog/template-card";
import { CatalogImage } from "@/components/catalog/catalog-image";
import { getActiveCategories, getFeaturedTemplates } from "@/services/catalog";
import { catalogMetadata } from "@/lib/catalog/metadata";
export const dynamic = "force-dynamic";
export const metadata = catalogMetadata(
  "Beautiful invitations for every celebration",
  "Discover free and premium invitation designs for weddings, birthdays, send-offs and celebrations across Tanzania and East Africa.",
  "/",
);
export default async function Home() {
  const [categories, featured] = await Promise.all([
    getActiveCategories(),
    getFeaturedTemplates(),
  ]);
  const heroTemplate =
    featured.find(
      (template) => template.isPremium && template.orientation === "PORTRAIT",
    ) ??
    featured.find((template) => template.orientation === "PORTRAIT") ??
    featured[0];
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
        <div>
          <p className="eyebrow">Made for moments that matter</p>
          <h1 className="mt-5 text-5xl leading-[1.09] tracking-tight md:text-6xl lg:text-7xl">
            Beautiful invitations.
            <br />
            <span className="font-serif italic">Unforgettable</span>
            <br />
            celebrations.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-forest/75">
            From “I do” to another trip around the sun. Discover a design that
            feels like you, and start bringing your favourite people together.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <ButtonLink href="/templates">
              Create Invitation{" "}
              <span aria-hidden="true" className="ml-3">
                ↗
              </span>
            </ButtonLink>
            <Link
              href="/templates"
              className="text-sm font-semibold underline underline-offset-4"
            >
              Browse Templates
            </Link>
          </div>
          <p className="mt-5 max-w-md text-xs leading-6 text-forest/65">
            Explore the collection today. Personalization, downloads and sharing
            are coming with our next creation tools.
          </p>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-forest/75">
            <span>✧ Free & premium designs</span>
            <span>♡ For every kind of gathering</span>
          </div>
        </div>
        <div className="relative flex min-h-[430px] items-center justify-center rounded-t-[46%] rounded-b-3xl bg-[#e9e6d9] px-10 py-14">
          <div
            aria-hidden="true"
            className="absolute inset-5 rounded-t-[46%] rounded-b-2xl border border-[#bbaa86]/40"
          />
          <div className="relative w-full max-w-64 rotate-[-6deg] drop-shadow-2xl">
            <CatalogImage
              src={heroTemplate?.thumbnailUrl || null}
              alt={
                heroTemplate
                  ? `${heroTemplate.name} featured invitation`
                  : "Decorative invitation preview"
              }
              priority
              className="max-h-[380px] w-full object-contain"
            />
          </div>
          <div className="absolute bottom-8 right-3 max-w-48 rotate-3 rounded-xl border border-forest/10 bg-[#fffdf7] px-5 py-4 shadow-lg">
            <p className="font-serif text-xl italic">An occasion. A feeling.</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-forest/65">
              A beautiful beginning
            </p>
          </div>
        </div>
      </section>
      <section className="border-y border-forest/10 bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Every reason to gather</p>
              <h2 className="section-title">Find your celebration.</h2>
            </div>
            <Link
              href="/categories"
              className="text-sm font-semibold underline underline-offset-4"
            >
              All categories ↗
            </Link>
          </div>
          <CategoryGrid categories={categories.slice(0, 8)} />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A little inspiration</p>
            <h2 className="section-title">Designs to fall in love with.</h2>
          </div>
          <Link
            href="/templates"
            className="text-sm font-semibold underline underline-offset-4"
          >
            Explore the collection ↗
          </Link>
        </div>
        {featured.length ? (
          <TemplateGrid templates={featured} />
        ) : (
          <p className="rounded-2xl border border-dashed border-forest/20 p-10 text-center text-forest/70">
            Our featured collection is being curated. Browse categories to
            explore what is available.
          </p>
        )}
      </section>
      <section id="how-it-works" className="scroll-mt-8 bg-[#edece2]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <p className="eyebrow">Your invitation journey</p>
            <h2 className="section-title">
              From a lovely idea to “see you there.”
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-forest/70">
              Choose your favourite design now. The next steps are on their way.
            </p>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Choose a template",
                "Find a design for your celebration.",
                "Available now",
              ],
              [
                "Customize",
                "Make the words, colours and details yours.",
                "Coming next",
              ],
              [
                "Download or publish",
                "Prepare a card or digital invitation page.",
                "Planned",
              ],
              [
                "Share with guests",
                "Bring your people into the moment.",
                "Planned",
              ],
            ].map(([title, copy, state], i) => (
              <li key={title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-forest/25 font-serif text-lg">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-forest/75">{copy}</p>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-[#805b38]">
                  {state}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2">
        <div>
          <p className="eyebrow">More than a beautiful card</p>
          <h2 className="section-title">
            The invitation is
            <br />
            just the beginning.
          </h2>
          <p className="mt-5 max-w-lg leading-8 text-forest/75">
            We’re building a thoughtful home for your celebration: a digital
            invitation page, RSVP, QR invitations, location details and WhatsApp
            sharing.
          </p>
          <p className="mt-4 text-sm font-semibold text-forest/65">
            These features are planned for future phases.
          </p>
        </div>
        <div className="rounded-3xl border border-forest/15 bg-white p-8">
          <p className="eyebrow">A design for every budget</p>
          <h2 className="mt-4 font-serif text-3xl">
            Lovely can be free.
            <br />
            Extra special can be premium.
          </h2>
          <p className="mt-5 text-sm leading-8 text-forest/75">
            Browse free designs or explore premium styles with clear prices in
            Tanzanian shillings. No checkout or payments are available in this
            release.
          </p>
          <Link
            href="/templates?tier=free"
            className="mt-6 inline-block text-sm font-semibold underline underline-offset-4"
          >
            Explore free designs ↗
          </Link>
        </div>
      </section>
      <section className="bg-forest px-6 py-16 text-center text-cream">
        <p className="text-xs uppercase tracking-[.2em] text-white/70">
          Your people. Your moment.
        </p>
        <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
          Let’s make the first impression beautiful.
        </h2>
        <Link
          href="/templates"
          className="mt-8 inline-flex rounded-full bg-cream px-7 py-3 text-sm font-semibold text-forest"
        >
          Create Invitation{" "}
          <span aria-hidden="true" className="ml-3">
            ↗
          </span>
        </Link>
      </section>
    </>
  );
}
