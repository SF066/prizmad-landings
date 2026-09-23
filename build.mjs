#!/usr/bin/env node
// Builds personal landings from _template + _prospects/<slug>/landing.json.
// Usage: node build.mjs <slug> [<slug>...] | node build.mjs --all
// Zero dependencies. Output goes to ./<slug>/ and is fully replaced on every build.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(ROOT, "_template");
const PROSPECTS = path.join(ROOT, "_prospects");
const MARKER = ".generated";
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const IMAGE_EXT = new Set([".webp", ".jpg", ".jpeg", ".png"]);

class BuildError extends Error {}

// ---------- image size (webp / png / jpeg headers) ----------
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  throw new BuildError(`cannot read image size: ${path.basename(file)}`);
}

// ---------- tiny mustache-like renderer ----------
const esc = (v) => String(v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function lookup(stack, key) {
  for (let i = stack.length - 1; i >= 0; i--) {
    let cur = stack[i];
    let ok = true;
    for (const part of key.split(".")) {
      if (cur != null && typeof cur === "object" && part in cur) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok) return cur;
  }
  return undefined;
}

const PARTS = path.join(TEMPLATE, "parts");
function expand(tpl, depth = 0) {
  if (depth > 10) throw new BuildError("partials nested too deep");
  return tpl.replace(/\{\{>\s*([\w-]+)\}\}/g, (_, name) => {
    const f = path.join(PARTS, `${name}.html`);
    if (!fs.existsSync(f)) throw new BuildError(`missing partial: parts/${name}.html`);
    return expand(fs.readFileSync(f, "utf8"), depth + 1);
  });
}

function render(tpl, stack) {
  tpl = tpl.replace(/\{\{([#^])([\w.]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_, type, key, inner) => {
    const val = lookup(stack, key);
    const truthy = Array.isArray(val) ? val.length > 0 : Boolean(val);
    if (type === "^") return truthy ? "" : render(inner, stack);
    if (!truthy) return "";
    if (Array.isArray(val)) return val.map((item) => render(inner, [...stack, item])).join("");
    return render(inner, stack);
  });
  return tpl.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const val = lookup(stack, key);
    if (val === undefined || val === null || typeof val === "object") {
      throw new BuildError(`missing value for {{${key}}}`);
    }
    return esc(val);
  });
}

// ---------- data checks ----------
function need(obj, keyPath) {
  const v = keyPath.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
    throw new BuildError(`landing.json: "${keyPath}" is required`);
  }
  return v;
}

function checkStrings(value, where, warnings) {
  if (typeof value === "string") {
    if (/[—–]/.test(value)) throw new BuildError(`${where}: em/en dash is not allowed, use "-" or a comma`);
    if (/\{\{|\}\}/.test(value)) throw new BuildError(`${where}: curly braces are not allowed`);
    if (value !== value.trim()) warnings.push(`${where}: leading/trailing spaces`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => checkStrings(v, `${where}[${i}]`, warnings));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) checkStrings(v, where ? `${where}.${k}` : k, warnings);
  }
}

function prepare(slug) {
  const dir = path.join(PROSPECTS, slug);
  const jsonPath = path.join(dir, "landing.json");
  if (!fs.existsSync(jsonPath)) throw new BuildError(`no ${path.relative(ROOT, jsonPath)}`);
  let data;
  try { data = JSON.parse(fs.readFileSync(jsonPath, "utf8")); }
  catch (e) { throw new BuildError(`landing.json is not valid JSON: ${e.message}`); }

  const warnings = [];
  checkStrings(data, "", warnings);
  if (data.slug !== slug) throw new BuildError(`landing.json: "slug" must be "${slug}"`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new BuildError(`slug must be lowercase latin, digits and dashes`);

  ["brand.name", "brand.domain", "sender.name", "sender.avatar", "sender.adsReviewed", "product.name", "product.noun",
    "category.name", "category.demoLabel", "video.sceneDetail", "market.adsRunning", "market.yourAds",
    "market.monthlySpend", "market.revenueLift", "hero.main", "hero.inset",
    "form.mailto"].forEach((k) => need(data, k));

  const media = path.join(dir, "media");
  const images = new Map();
  const image = (file, alt, where) => {
    if (!file || typeof file !== "string") throw new BuildError(`${where}: file name is required`);
    const src = path.join(media, file);
    if (!fs.existsSync(src)) throw new BuildError(`${where}: media/${file} not found`);
    if (!IMAGE_EXT.has(path.extname(file).toLowerCase())) throw new BuildError(`${where}: ${file} must be webp, jpg or png`);
    const size = imageSize(src);
    if (size.width < 800) warnings.push(`${where}: ${file} is only ${size.width}px wide`);
    images.set(file, src);
    return { file, alt: alt || "", ...size };
  };

  const scenes = data.scenes;
  if (!Array.isArray(scenes) || scenes.length < 3 || scenes.length > WORDS.length - 1) {
    throw new BuildError(`landing.json: "scenes" must have 3-${WORDS.length - 1} items`);
  }
  const builtScenes = scenes.map((s, i) => {
    need(s, "alt"); need(s, "caption");
    if (s.caption.length > 40) warnings.push(`scenes[${i}].caption is ${s.caption.length} chars, keep it under 40`);
    return { ...image(s.file, s.alt, `scenes[${i}]`), caption: s.caption, idx: i, num: String(i + 1).padStart(2, "0") };
  });
  const sceneOf = (file) => builtScenes.find((s) => s.file === file);
  const pick = (file, where) => ({ caption: sceneOf(file)?.caption || "", ...image(file, sceneOf(file)?.alt || data.alts?.[file], where) });

  const avatar = path.join(TEMPLATE, "assets/img/senders", data.sender.avatar);
  if (!fs.existsSync(avatar)) throw new BuildError(`sender.avatar: _template/assets/img/senders/${data.sender.avatar} not found`);

  if (!data.video || (!data.video.poster && !(Array.isArray(data.video.files) && data.video.files.every((v) => v.poster)))) {
    throw new BuildError('landing.json: every entry in "video.files" needs a "poster", or set "video.poster"');
  }
  const videoList = Array.isArray(data.video.files) && data.video.files.length
    ? data.video.files
    : (data.video.file ? [{ file: data.video.file, poster: data.video.poster }] : []);
  if (!videoList.length) warnings.push("no video, the player shows only the poster");
  const builtVideos = videoList.map((v, i) => {
    const where = `video.files[${i}]`;
    if (v.file) {
      const src = path.join(media, v.file);
      if (!fs.existsSync(src)) throw new BuildError(`${where}: media/${v.file} not found`);
      if (path.extname(src).toLowerCase() !== ".mp4") throw new BuildError(`${where}: must be .mp4`);
      images.set(`video:${v.file}`, src);
    } else {
      warnings.push(`${where}: no file, only the poster is shown`);
    }
    const poster = v.poster || data.video.poster;
    return { file: v.file || "", poster: pick(poster, `${where}.poster`) };
  });
  const posterShape = builtVideos[0] && builtVideos[0].poster.height > builtVideos[0].poster.width ? "is-tall" : "is-wide";

  const calLink = (data.form.calLink || "").trim().replace(/^https?:\/\/(app\.)?cal\.com\//, "").replace(/\/$/, "");
  if (calLink && !/^[\w.-]+\/[\w.-]+$/.test(calLink)) throw new BuildError(`form.calLink must look like "team-or-user/event", got "${calLink}"`);
  if (!calLink) warnings.push("form.calLink is empty, the popup shows the fallback form");

  const template = data.template || "d-character";
  const tplFile = path.join(TEMPLATE, "templates", `${template}.html`);
  if (!/^[a-z-]+$/.test(template) || !fs.existsSync(tplFile)) {
    const all = fs.readdirSync(path.join(TEMPLATE, "templates")).map((f) => f.replace(".html", ""));
    throw new BuildError(`"template" must be one of: ${all.join(", ")}`);
  }
  if (template === "b-scene" && !data.banner) throw new BuildError('template "b-scene" needs a wide "banner" image, it is the hero');

  const words = WORDS[builtScenes.length];
  const bareDomain = data.brand.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const name = data.recipient?.name?.trim();

  const view = {
    ...data,
    scenes: builtScenes,
    scenesWord: words,
    ScenesWord: words[0].toUpperCase() + words.slice(1),
    brand: {
      ...data.brand,
      emailDomain: data.brand.emailDomain || bareDomain,
      productUrlExample: data.brand.productUrlExample || `https://${data.brand.domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/products/...`,
    },
    recipient: name
      ? { name, initials: data.recipient.initials || name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() }
      : {},
    sender: { ...data.sender, title: data.sender.title || "" },
    video: { ...data.video, poster: builtVideos[0] ? builtVideos[0].poster : pick(data.video.poster, "video.poster") },
    videos: builtVideos,
    videoShape: `${posterShape} count-${builtVideos.length}`,
    // b-scene puts the banner in the hero, c-texture right under the hero copy
    heroTone: data.hero.tone === "dark" ? "tone-dark" : "",
    showBanner: Boolean(data.banner) && !["b-scene", "c-texture"].includes(template),
    hero: { main: pick(data.hero.main, "hero.main"), inset: pick(data.hero.inset, "hero.inset"), focus: data.hero.focus || "50% 50%" },
    heroBleed: data.banner ? { ...image(data.banner, "", "banner"), caption: "" } : pick(data.hero.main, "hero.main"),
    heroReels: [builtScenes.find((x) => x.file === data.hero.inset) || builtScenes[1], builtScenes.find((x) => x.file === data.hero.main) || builtScenes[0], builtScenes.find((x) => ![data.hero.main, data.hero.inset].includes(x.file)) || builtScenes[2]],
    heroThumbs: builtScenes.filter((x) => x.file !== data.hero.main).slice(0, 3),
    banner: data.banner ? { ...image(data.banner, "", "banner"), alt: "" } : { file: "" },
    formats: Array.isArray(data.formats) && data.formats.length ? data.formats.map((f, i) => {
      need(f, "label");
      image(f.file, "", `formats[${i}]`);
      return { file: f.file, label: f.label };
    }) : [
      // One fixed set for every landing: the labels have to match the frames.
      { file: "formats/fmt-ugc.webp", label: "UGC" },
      { file: "formats/fmt-unboxing.webp", label: "Unboxing" },
      { file: "formats/fmt-product-demo.webp", label: "Product demo" },
      { file: "formats/fmt-talking-head.webp", label: "Talking head" },
      { file: "formats/fmt-lifestyle.webp", label: "Lifestyle" },
      { file: "formats/fmt-hands-on.webp", label: "Hands-on" },
      { file: "formats/fmt-studio.webp", label: "Studio" },
    ],
    finalStack: (() => {
      const others = builtScenes.filter((x) => x.file !== data.hero.main);
      return [others[0], builtScenes.find((x) => x.file === data.hero.main), others[others.length - 1]].map((x) => ({ file: x.file }));
    })(),
    form: {
      endpoint: data.form.endpoint || "",
      mailto: data.form.mailto,
      calLink: calLink,
      calOrigin: data.form.calOrigin || "https://cal.com",
    },
  };
  return { view, images, warnings, tplFile };
}

// ---------- output ----------
// Assets keep the same name, so a query built from their content busts the CDN cache.
function assetVersion(rel) {
  const f = path.join(TEMPLATE, "assets", rel);
  return crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
}

function build(slug) {
  const { view, images, warnings, tplFile } = prepare(slug);
  const html = render(expand(fs.readFileSync(tplFile, "utf8")), [view]);
  if (/\{\{|\}\}/.test(html)) throw new BuildError("unrendered placeholder left in index.html");
  const stamped = html
    .replace('assets/styles.css"', `assets/styles.css?v=${assetVersion("styles.css")}"`)
    .replace('assets/main.js"', `assets/main.js?v=${assetVersion("main.js")}"`);
  if (stamped === html) throw new BuildError("could not stamp the asset versions");

  const out = path.join(ROOT, slug);
  if (fs.existsSync(out)) {
    if (!fs.existsSync(path.join(out, MARKER))) {
      throw new BuildError(`${slug}/ exists and was not made by build.mjs, move it away first`);
    }
    fs.rmSync(out, { recursive: true, force: true });
  }
  fs.cpSync(path.join(TEMPLATE, "assets"), path.join(out, "assets"), { recursive: true });
  // Only the chosen sender avatar ships
  const senders = path.join(out, "assets/img/senders");
  for (const f of fs.readdirSync(senders)) if (f !== view.sender.avatar) fs.rmSync(path.join(senders, f));
  for (const [key, src] of images) {
    const dest = key.startsWith("video:")
      ? path.join(out, "assets/video", key.slice(6))
      : path.join(out, "assets/img", key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  fs.writeFileSync(path.join(out, "index.html"), stamped);
  fs.writeFileSync(path.join(out, MARKER), "Built by build.mjs from _prospects/" + slug + "/landing.json. Do not edit by hand.\n");
  return warnings;
}

const args = process.argv.slice(2);
const slugs = args.includes("--all")
  ? fs.readdirSync(PROSPECTS).filter((d) => fs.existsSync(path.join(PROSPECTS, d, "landing.json")))
  : args;
if (!slugs.length) {
  console.error("Usage: node build.mjs <slug> [<slug>...] | node build.mjs --all");
  process.exit(2);
}
let failed = 0;
for (const slug of slugs) {
  try {
    const warnings = build(slug);
    console.log(`ok    ${slug}/`);
    warnings.forEach((w) => console.log(`  warn ${w}`));
  } catch (e) {
    failed++;
    console.error(`FAIL  ${slug}: ${e instanceof BuildError ? e.message : e.stack}`);
  }
}
process.exit(failed ? 1 : 0);
