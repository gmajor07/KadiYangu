import Image from "next/image";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { createHeroSlide, updateHeroSlide, deleteHeroSlide } from "@/app/admin/hero-slides/actions";

export async function HomepageMediaManager({placement,query}:{placement:"CARD"|"BACKGROUND";query:{error?:string;saved?:string}}) {
  await requireAdmin();
  const backgrounds = placement === "BACKGROUND";
  const slides = await getDb().heroSlide.findMany({where:{placement},orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]});
  const notice = query.error ? (query.error === "upload" ? "Upload failed. Use a valid JPG, PNG or WebP image up to 5 MB, and check storage configuration." : "Check the image description and display order.") : query.saved ? "Changes saved." : "";
  return <main className="mx-auto max-w-6xl px-6 py-10">
    <p className="eyebrow">Administration</p>
    <h1 className="mt-2 font-serif text-4xl">{backgrounds ? "Homepage backgrounds" : "Homepage hero slides"}</h1>
    <p className="mt-2 text-sm">{backgrounds ? "Background images for the “Beautiful invitations” section. Text, buttons and invitation cards keep their existing layout. Active images rotate every 8 seconds." : "Only active slides appear in the invitation preview on the homepage."}</p>
    {backgrounds && <p className="mt-2 text-sm opacity-70">Use a landscape image, ideally 1920 × 1080 or larger. A light overlay keeps the text readable. Lower display orders appear first.</p>}
    {notice && <p className="mt-4 text-sm" role={query.error ? "alert" : "status"}>{notice}</p>}
    <form action={createHeroSlide} className="mt-8 grid gap-3 rounded-2xl bg-white p-6 md:grid-cols-3">
      <input type="hidden" name="placement" value={placement}/>
      <label className="md:col-span-2">Image<input name="file" type="file" accept="image/jpeg,image/png,image/webp" required/><span className="block text-xs opacity-65">JPG, PNG or WebP · Maximum 5 MB</span></label>
      <label>Display order<input name="sortOrder" type="number" min="0" max="2147483647" defaultValue="0" required/></label>
      <label className="md:col-span-2">{backgrounds ? "Image description" : "Accessible alt text"}<input name="altText" maxLength={200} required/></label>
      <button className="rounded-xl bg-rose-gold px-4 py-2 text-sm font-semibold text-white hover:bg-mauve">{backgrounds ? "Upload background" : "Upload slide"}</button>
    </form>
    <div className="mt-8 grid gap-5 md:grid-cols-2">{slides.map(slide=><div key={slide.id} className="rounded-2xl bg-white p-4">
      <div className={`relative w-full overflow-hidden rounded-xl bg-ivory ${backgrounds ? "aspect-video" : "aspect-[4/5]"}`}><Image src={slide.imageUrl} alt={slide.altText} fill unoptimized sizes="(max-width:768px) 100vw, 550px" className={backgrounds ? "object-cover" : "object-contain"}/></div>
      <form action={updateHeroSlide} className="mt-3 grid gap-2">
        <input type="hidden" name="placement" value={placement}/><input type="hidden" name="id" value={slide.id}/>
        <label>Image description<input name="altText" defaultValue={slide.altText} maxLength={200} required/></label>
        <label>Display order<input name="sortOrder" type="number" min="0" max="2147483647" defaultValue={slide.sortOrder} required/></label>
        <label><input name="isActive" type="checkbox" defaultChecked={slide.isActive}/> Active</label>
        <button className="rounded-xl bg-rose-gold px-4 py-2 text-sm font-semibold text-white hover:bg-mauve">Save</button>
      </form>
      <form action={deleteHeroSlide} className="mt-2"><input type="hidden" name="placement" value={placement}/><input type="hidden" name="id" value={slide.id}/><button className="text-sm text-red-700 underline">Remove {backgrounds ? "background" : "slide"}</button></form>
    </div>)}</div>
    {!slides.length && <p className="mt-8 rounded-2xl border border-dashed p-8">{backgrounds ? "No backgrounds yet. The homepage keeps its current appearance until you upload an active image." : "No slides yet. The homepage will use its existing template fallback."}</p>}
  </main>;
}
