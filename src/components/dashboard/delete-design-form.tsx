"use client";
import { useRef, useState } from "react";
import { deleteDesignAction } from "@/app/dashboard/designs/actions";
export function DeleteDesignForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-red-200 px-3 py-2 text-xs text-red-700">Delete</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/30 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div role="dialog" aria-modal="true" aria-labelledby={`delete-title-${id}`} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"><h2 id={`delete-title-${id}`} className="font-serif text-2xl">Delete design?</h2><p className="mt-3 text-sm leading-6 text-forest/70">This will permanently remove this design from your workspace.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-forest/20 px-4 py-2 text-sm">Cancel</button><form ref={formRef} action={deleteDesignAction}><input type="hidden" name="id" value={id} /><button type="submit" className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white">Delete</button></form></div></div></div>}
  </>;
}
