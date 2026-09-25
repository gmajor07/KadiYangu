"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  saveCategoryAction,
  saveTemplateAction,
} from "@/app/admin/catalog-actions";
import type { CatalogFormState } from "@/types/catalog";
type Values = Record<string, string | number | boolean | null>;
export function CatalogForm({
  kind,
  initial = {},
  categories = [],
}: {
  kind: "category" | "template";
  initial?: Values;
  categories?: { id: string; name: string; isActive: boolean }[];
}) {
  const [state, action, pending] = useActionState(
    kind === "category" ? saveCategoryAction : saveTemplateAction,
    { message: "" } as CatalogFormState,
  );
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    if (state.values) setValues(state.values);
  }, [state.values]);
  const update = (key: string, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));
  const value = (key: string, fallback = "") =>
    String(values[key] ?? state.values?.[key] ?? initial[key] ?? fallback);
  const checked = (key: string, fallback = false) =>
    Boolean(values[key] ?? state.values?.[key] ?? initial[key] ?? fallback);
  const errors = (name: string) => state.errors?.[name];
  function field(
    name: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      help?: string;
      min?: number;
      max?: number;
      fallback?: string;
      maxLength?: number;
    } = {},
  ) {
    return (
      <div key={name}>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          type={options.type || "text"}
          required={options.required ?? true}
          value={value(name, options.fallback)}
          onChange={(event) => update(name, event.target.value)}
          min={options.min}
          max={options.max}
          step={options.type === "number" ? "1" : undefined}
          maxLength={options.maxLength ?? 100}
          aria-invalid={!!errors(name)}
          aria-describedby={`${name}-help`}
        />
        <p
          id={`${name}-help`}
          className={`mt-2 text-xs leading-5 ${errors(name) ? "text-red-800" : "text-forest/65"}`}
        >
          {errors(name)?.join(" ") || options.help}
        </p>
      </div>
    );
  }
  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
    fallback: string,
  ) {
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <select
          id={name}
          name={name}
          value={value(name, fallback)}
          onChange={(event) => update(name, event.target.value)}
          required
          aria-invalid={!!errors(name)}
          aria-describedby={`${name}-help`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p id={`${name}-help`} className="mt-2 text-xs text-red-800">
          {errors(name)?.join(" ")}
        </p>
      </div>
    );
  }
  function checkbox(name: string, label: string, fallback = false) {
    return (
      <label className="flex items-center gap-3 text-sm font-normal">
        <input
          type="checkbox"
          name={name}
          checked={checked(name, fallback)}
          onChange={(event) => update(name, event.target.checked)}
        />
        {label}
      </label>
    );
  }
  return (
    <form
      action={action}
      className="mt-8 max-w-3xl space-y-7 rounded-2xl border border-forest/15 bg-white p-5 sm:p-8"
    >
      <input type="hidden" name="id" value={String(initial.id || "")} />
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "Name")}
        {field("slug", "URL slug", {
          help: "Unique lowercase words with hyphens, e.g. royal-gold-wedding.",
        })}
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          value={value("description")}
          onChange={(event) => update("description", event.target.value)}
          aria-invalid={!!errors("description")}
          aria-describedby="description-help"
        />
        <p id="description-help" className="mt-2 text-xs text-red-800">
          {errors("description")?.join(" ")}
        </p>
      </div>
      {kind === "category" ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {field("imageUrl", "Image path (optional)", {
              required: false,
              maxLength: 300,
              help: "Local path, e.g. /demo/royal-gold.svg. External URLs and uploads are not enabled.",
            })}
            {field("icon", "Symbol (optional)", {
              required: false,
              maxLength: 8,
              help: "A short text symbol, such as ♡ or ✧.",
            })}
            {field("sortOrder", "Sort order", {
              type: "number",
              min: 0,
              max: 100000,
              fallback: "0",
              help: "Lower numbers appear first.",
            })}
          </div>
          {checkbox(
            "isActive",
            "Active — show this category and its published templates publicly",
            true,
          )}
        </>
      ) : (
        <>
          {select(
            "categoryId",
            "Category",
            [
              { value: "", label: "Choose a category" },
              ...categories.map((category) => ({
                value: category.id,
                label: `${category.name}${category.isActive ? "" : " (inactive — hidden publicly)"}`,
              })),
            ],
            "",
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {field("thumbnailUrl", "Thumbnail image path", {
              fallback: "/images/invitation-placeholder.svg",
              maxLength: 300,
              help: "Local /images/ or /demo/ image. Example: /demo/royal-gold.svg.",
            })}
            {field("previewImageUrl", "Preview image path (optional)", {
              required: false,
              maxLength: 300,
              help: "Leave empty to use the thumbnail. No external URLs or uploads in this phase.",
            })}
          </div>
          <fieldset className="space-y-4 rounded-xl border border-forest/15 p-5">
            <legend className="px-2 text-sm font-semibold">
              Free or premium
            </legend>
            {checkbox("isPremium", "Premium design")}
            {field("price", "Price in whole TZS", {
              type: "number",
              min: 1,
              max: 2147483647,
              required: false,
              help: "Premium requires a positive whole number, e.g. 15000. For FREE, uncheck Premium and leave price empty.",
            })}
            <input type="hidden" name="currency" value="TZS" />
            <p className="text-xs text-forest/65">
              Currency: TZS. This sets a catalog price only; there is no
              checkout.
            </p>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            {select(
              "status",
              "Publication status",
              [
                { value: "DRAFT", label: "Draft (unpublished)" },
                { value: "PUBLISHED", label: "Published" },
                { value: "ARCHIVED", label: "Archived" },
              ],
              "DRAFT",
            )}
            {select(
              "orientation",
              "Orientation",
              [
                { value: "PORTRAIT", label: "Portrait" },
                { value: "LANDSCAPE", label: "Landscape" },
                { value: "SQUARE", label: "Square" },
              ],
              "PORTRAIT",
            )}
            {field("width", "Canvas width (px)", {
              type: "number",
              min: 320,
              max: 8000,
              fallback: "1080",
            })}
            {field("height", "Canvas height (px)", {
              type: "number",
              min: 320,
              max: 8000,
              fallback: "1350",
            })}
          </div>
          <p className="text-xs leading-6 text-forest/65">
            Dimensions must match the orientation. A basic design document is
            created automatically; no JSON editing is required. Portrait: height
            &gt; width. Landscape: width &gt; height. Square: equal sides.
          </p>
          {checkbox(
            "isActive",
            "Active — eligible for public display when published",
            true,
          )}
          {checkbox(
            "isFeatured",
            "Featured — eligible for the homepage when publicly visible",
          )}
        </>
      )}
      <p role="alert" className="text-sm font-semibold text-red-800">
        {state.message}
      </p>
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white"
        >
          {pending ? "Saving…" : `Save ${kind}`}
        </button>
        <Link
          href={kind === "category" ? "/admin/categories" : "/admin/templates"}
          className="text-sm underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
