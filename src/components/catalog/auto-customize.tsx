"use client";
import { useEffect, useRef } from "react";
import { customizeTemplateAction } from "@/app/(public)/template/[slug]/actions";
export function AutoCustomize({ slug }: { slug: string }) { const form = useRef<HTMLFormElement>(null); useEffect(() => { form.current?.requestSubmit(); }, []); return <form ref={form} action={customizeTemplateAction}><input type="hidden" name="slug" value={slug} /><p className="text-sm text-forest/70">Opening the editor…</p></form>; }
