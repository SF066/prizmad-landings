# How agents make a personal landing

The page text is fixed in `_template/index.html`. An agent never edits HTML or CSS. It only fills `_prospects/<slug>/landing.json`, drops images into `_prospects/<slug>/media/` and runs the build.

## Steps

1. `cp -R _prospects/blenderbottle _prospects/<slug>` and delete the old files in `media/`.
2. Put the scene images into `media/` (webp, jpg or png, at least 1200px on the long side, portrait 3:4 or 4:5 works best). Optional: the sample video as `media/<name>.mp4`.
3. Fill `landing.json` (fields below).
4. `node build.mjs <slug>`. It fails loudly on a missing field, a missing file, an em dash or a broken placeholder. Fix and rerun until you get `ok`.
5. Check the result in a browser at 1440px and 390px wide (`playwright-cli`), then commit `_prospects/<slug>/` and `<slug>/` together.

Never edit files inside a built `<slug>/` folder: the next build overwrites them.

## Fields

The page copy is approved and fixed in the template. Agents never rewrite it; they only fill the variables below so the fixed sentences read naturally. All values are English, plain, no em or en dashes (use `-` or a comma), no emoji.

| Field | Where it shows | Rules and example |
|---|---|---|
| `template` | which of the four layouts to build | `a-demo` (the product has to be shown working: kitchen appliances, sports equipment, watches), `b-scene` (the place sells: trail gear, bags, coffee and tea; needs `banner`, it becomes the hero), `c-texture` (macro and feel: skincare, supplements), `d-character` (faces and UGC: pet products, kids toys, bottles and shakers). Default `d-character` |
| `slug` | URL folder | lowercase latin, digits, dashes. Must equal the folder name. `blenderbottle` |
| `brand.name` | title, H1, video text, meta | exactly as the brand writes it. `BlenderBottle` |
| `brand.domain` | form placeholders | `www.blenderbottle.com` |
| `brand.emailDomain` | optional, email placeholder | defaults to domain without `www.` |
| `brand.productUrlExample` | optional, product link placeholder | defaults to `https://<domain>/products/...` |
| `recipient.name` | name chip in the hero | person the link is sent to. Leave `{}` to hide the chip |
| `sender.name` | hero line "I'm ___, <title>. I analyzed ..." | `Sam Patel`. Avatar file must exist in `_template/assets/img/senders/` |
| `sender.title` | hero line after the name | optional. Empty gives "I'm Sam Patel. I analyzed ..." |
| `sender.avatar` | note avatar | `sam-patel.webp` |
| `sender.adsReviewed` | "I analyzed ___ ads in your niche" | `10,000+` |
| `product.name` | "We pulled the ___ photos from your site" | the product shown in the scenes. `Trail 3` |
| `product.noun` | "built five ad scenes around the ___" | singular, lowercase. `tent`, `shaker` |
| `category.name` | "We analyzed the ___ ad market" and table row "Finding a UGC creator for ___" | lowercase. `outdoor gear` |
| `category.demoLabel` | "shot the way ___ would run it" | with article, a reference brand only after "like". `a big outdoor label like The North Face` |
| `video.sceneDetail` | "would run it: ___, a voice, proper cuts" | `a real face by the fire` |
| `market.adsRunning` | big number: ads the average brand in the category runs | real number from Ad Spy / Meta Ad Library. `792` |
| `market.yourAds` | "while you run ___" | the prospect's live ad count, as a word up to ten. `four` |
| `market.monthlySpend` | spend of brands this size per month | `$50,000/m` |
| `market.revenueLift` | revenue lift from varied creative | `+60%` |
| `scenes[]` | "five ad scenes", 3D carousel | 3-10 items. Each: `file`, `alt` (what is in the photo), `caption` (short scene description shown on the card, under 40 chars) |
| `hero.main`, `hero.inset` | two hero photos | file names from `scenes`. Alt and the caption on the main photo come from the scene |
| `hero.focus` | which part of the hero photo stays in frame when it is cropped | optional, CSS `object-position`, e.g. `50% 34%` to keep a tall product whole. Default `50% 50%` |
| `banner` | full-width image band. In `b-scene` it is the hero and is required, in the others it is an optional band after the gallery | wide 16:9 photo in `media/` |
| `video.file` | sample player | mp4 in `media/`, 16:9. `null` hides the play button and shows only the poster |
| `video.poster` | player poster | file name from `scenes` |
| `formats[]` | endless strip of ad formats in the orange "What we do" card | optional. Leave it out and every landing shows the same fixed set from `_template/assets/img/formats/`. Only override it when you have a full set for this product where every frame really matches its label |
| `form.calLink` | booking calendar inside the popup | Cal.com `user/event` or full cal.com URL. Empty = popup shows the fallback form |
| `form.calOrigin` | optional | defaults to `https://cal.com` |
| `form.endpoint` | fallback form only: where it POSTs JSON | empty = fallback form opens a prefilled email to `form.mailto` |
| `form.mailto` | fallback form email | `hello@prizmad.com` |

Facts only: numbers in `market` must come from real data for this prospect's category. If a number is unknown, stop and ask, do not invent it.
