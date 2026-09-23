# Prizmad landings

Personal outreach landings built from one template. Text is fixed in the template; everything that changes per prospect lives in a JSON file. Agent instructions: [AGENTS.md](AGENTS.md).

```
prizmad-landings/
  _template/
    parts/                   shared sections, the approved copy lives here once
    templates/               four layouts: a-demo, b-scene, c-texture, d-character
    assets/                  styles, script, logos, illustrations
  _prospects/<slug>/
    landing.json             per-prospect data (brand, names, numbers, scenes, video, form)
    media/                   scene photos, sample video
  build.mjs                  node build.mjs <slug> | --all
  <slug>/                    built landing, self-contained, do not edit by hand
```

## Build and preview

```bash
node build.mjs blenderbottle      # or --all
python3 -m http.server 8000       # open http://localhost:8000/blenderbottle/
```

No dependencies, Node 18+.

## Hosting

- GitHub Pages: each landing opens at `/<slug>/`. Folders starting with `_` are sources, not pages.
- Vercel / Netlify / Cloudflare Pages: one project per landing, Root Directory = `<slug>`.

Four layouts share the same copy and identity, only the hero and the gallery differ:
`a-demo` (show it working), `b-scene` (the place sells, the banner is the hero), `c-texture` (macro and feel), `d-character` (faces and UGC).
A prospect picks one with `"template"` in `landing.json`.

Changing the design or the copy means editing `_template/` and running `node build.mjs --all`.

Pages are `noindex`: they are personal offers, not SEO pages.
