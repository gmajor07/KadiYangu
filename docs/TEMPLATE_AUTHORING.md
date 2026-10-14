# KadiYangu template authoring

Templates use the same versioned `DesignData` document in the catalog, Quick Customize and Advanced Editor. Keep the canvas dimensions and background in `canvas`; put decorative artwork in elements with `locked: true`; put user content in text/image elements with `editable: true` and a unique `fieldKey`.

Declare `fields` only for supported content. Each field should provide `elementId` pointing to exactly one element and may define `type`, `maxLength`, `allowMultiline`, `minFontSize`, `maxFontSize`, `fitMode`, and `maxLines`. Field defaults come from the mapped element's existing value. Never use the template name as a content default.

Quick Customize may change only the mapped element's content. Position, size, style, layer order, locked artwork and canvas are preserved. Use `backgroundImage` for an asset URL rather than storing binary data in PostgreSQL. Assets belong in `public/` or the upload storage path.

A template preview should be generated from or match this same document. If a static thumbnail is retained, update it whenever the canonical design changes.
