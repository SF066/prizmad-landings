# Prizmad landings

Personal outreach landings built from one template. Text is fixed in the template; everything that changes per prospect lives in a JSON file. Agent instructions: [AGENTS.md](AGENTS.md).

```
prizmad-landings/
  _template/                 fixed page: index.html with {{placeholders}}, styles, script, fonts, logos
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

Changing the design or the copy means editing `_template/` and running `node build.mjs --all`.

Pages are `noindex`: they are personal offers, not SEO pages.
