(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const body = document.body;

  // ---------- reveal on scroll ----------
  const items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    items.forEach((el) => io.observe(el));
  }

  // ---------- 3D coverflow, loops in a circle ----------
  const cf = document.getElementById("cf");
  const lightbox = document.getElementById("lightbox");
  let openLightbox = () => {};
  if (cf) {
    const cards = [...cf.querySelectorAll(".cf-card")];
    const dots = [...cf.querySelectorAll(".cf-dot")];
    const n = cards.length;
    let active = 0;
    let timer = null;

    const offset = (i) => {
      let d = i - active;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      return d;
    };
    const layout = () => {
      const narrow = window.innerWidth < 768;
      const stepX = narrow ? 58 : 64;       // % of card width between neighbours
      cards.forEach((card, i) => {
        const d = offset(i);
        const a = Math.abs(d);
        const hidden = a > 2;
        const scale = a === 0 ? 1 : a === 1 ? 0.8 : 0.64;
        const tx = d * stepX * (a === 2 ? 0.92 : 1);
        card.style.transform = `translateX(${tx}%) translateZ(${-a * 140}px) rotateY(${-Math.sign(d) * Math.min(a, 2) * 22}deg) scale(${scale})`;
        card.style.zIndex = String(10 - a);
        card.classList.toggle("is-active", d === 0);
        card.classList.toggle("is-hidden", hidden);
        card.tabIndex = d === 0 ? 0 : -1;
        card.setAttribute("aria-hidden", hidden ? "true" : "false");
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === active);
        dot.setAttribute("aria-current", i === active ? "true" : "false");
      });
    };
    const go = (i) => { active = ((i % n) + n) % n; layout(); };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => {
      if (reduce || timer) return;
      timer = setInterval(() => { if (!document.hidden) go(active + 1); }, 3800);
    };

    let swiped = false;
    cards.forEach((card, i) => card.addEventListener("click", () => {
      if (swiped) { swiped = false; return; }
      if (i === active) openLightbox(i);
      else go(i);
    }));
    dots.forEach((dot, i) => dot.addEventListener("click", () => { stop(); go(i); }));
    cf.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { stop(); go(active - 1); }
      if (e.key === "ArrowRight") { stop(); go(active + 1); }
    });

    // swipe
    let x0 = null;
    const stage = cf.querySelector(".cf-stage");
    stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
    stage.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) {
        swiped = true;
        setTimeout(() => { swiped = false; }, 350);
        stop(); go(active + (dx < 0 ? 1 : -1));
      }
    });

    cf.addEventListener("mouseenter", stop);
    cf.addEventListener("mouseleave", start);
    cf.addEventListener("focusin", stop);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.3 }).observe(cf);
    window.addEventListener("resize", layout);
    layout();

    // ---------- lightbox: the card grows into place ----------
    if (lightbox) {
      const img = lightbox.querySelector(".lb-img");
      const cap = lightbox.querySelector(".lb-cap");
      let current = 0;
      const fill = (i) => {
        current = ((i % n) + n) % n;
        const src = cards[current].querySelector("img");
        img.src = src.currentSrc || src.src;
        img.alt = src.alt;
        cap.textContent = cards[current].dataset.caption;
      };
      openLightbox = (i) => {
        stop();
        fill(i);
        const from = cards[i].getBoundingClientRect();
        lightbox.showModal();
        body.classList.add("is-locked");
        if (reduce) return;
        const grow = () => {
          const to = img.getBoundingClientRect();
          if (!to.width) return;
          img.animate([
            { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, borderRadius: "28px" },
            { transform: "none", borderRadius: "20px" },
          ], { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" });
        };
        img.complete ? requestAnimationFrame(grow) : img.addEventListener("load", grow, { once: true });
      };
      const closeLb = () => { lightbox.close(); };
      lightbox.addEventListener("close", () => { body.classList.remove("is-locked"); go(current); cards[current].focus({ preventScroll: true }); });
      lightbox.querySelector(".lb-close").addEventListener("click", closeLb);
      lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLb(); });
      lightbox.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") fill(current - 1);
        if (e.key === "ArrowRight") fill(current + 1);
      });
    }
  }

  // ---------- sample video ----------
  const player = document.getElementById("player");
  const video = document.getElementById("sample-video");
  const playBtn = player && player.querySelector(".play");
  if (player && video && playBtn) {
    playBtn.addEventListener("click", () => {
      player.classList.add("is-playing");
      video.play().catch(() => player.classList.remove("is-playing"));
    });
  }

  // ---------- booking popup: Cal.com inline, fallback form ----------
  const modal = document.getElementById("book");
  if (!modal) return;
  const calLink = modal.dataset.calLink;
  const calWrap = modal.querySelector(".cal-wrap");
  const form = document.getElementById("lead-form");
  const slug = body.dataset.slug;
  let calReady = false;

  const track = (name, extra) => {
    // Hook for analytics: window.dataLayer (GTM) or any listener of "prizmad:track".
    const detail = { event: name, landing: slug, ...extra };
    (window.dataLayer = window.dataLayer || []).push(detail);
    window.dispatchEvent(new CustomEvent("prizmad:track", { detail }));
  };

  const loadCal = () => {
    if (calReady) return;
    calReady = true;
    const origin = modal.dataset.calOrigin || "https://cal.com";
    // Official Cal.com embed loader
    (function (C, A, L) {
      const p = function (a, ar) { a.q.push(ar); };
      const d = C.document;
      C.Cal = C.Cal || function () {
        const cal = C.Cal; const ar = arguments;
        if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1]; api.q = api.q || [];
          if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); }
          else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    window.Cal("init", "prizmad", { origin });
    const ns = window.Cal.ns.prizmad;
    ns("inline", {
      elementOrSelector: "#cal-inline",
      calLink,
      config: {
        layout: "month_view",
        theme: "light",
        "metadata[landing]": slug,
        "metadata[brand]": body.dataset.brand,
        "metadata[page]": location.href,
      },
    });
    ns("ui", {
      theme: "light",
      cssVarsPerTheme: { light: { "cal-brand": "#f54900" } },
      hideEventTypeDetails: false,
      layout: "month_view",
    });
    const skeleton = modal.querySelector(".cal-loading");
    const dropSkeleton = () => skeleton && skeleton.remove();
    ns("on", { action: "linkReady", callback: dropSkeleton });
    ns("on", { action: "linkFailed", callback: dropSkeleton });
    setTimeout(dropSkeleton, 10000);
    ns("on", {
      action: "bookingSuccessful",
      callback: (e) => track("booking_successful", { booking: e.detail && e.detail.data }),
    });
  };

  const open = (e) => {
    if (e) e.preventDefault();
    if (calLink) {
      calWrap.hidden = false;
      modal.classList.remove("is-form");
      loadCal();
    } else {
      form.hidden = false;
      modal.classList.add("is-form");
    }
    modal.showModal();
    body.classList.add("is-locked");
    track("booking_open");
    if (!calLink) setTimeout(() => form.elements.product.focus(), 50);
  };
  document.querySelectorAll("[data-book]").forEach((a) => a.addEventListener("click", open));
  modal.querySelector("[data-close]").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  modal.addEventListener("close", () => body.classList.remove("is-locked"));
  if (location.hash === "#book") open();

  // Fallback form (used only while no Cal.com link is set)
  const checks = {
    product: (v) => /^https?:\/\/\S+\.\S+/i.test(v),
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  };
  const validate = (name) => {
    const input = form.elements[name];
    const ok = checks[name](input.value.trim());
    input.closest(".field").classList.toggle("invalid", !ok);
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  };
  Object.keys(checks).forEach((k) => form.elements[k].addEventListener("blur", () => {
    if (form.elements[k].value) validate(k);
  }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (Object.keys(checks).map(validate).includes(false)) {
      form.querySelector(".field.invalid input").focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    data.landing = slug;
    data.page = location.href;
    const endpoint = modal.dataset.endpoint;
    const btn = form.querySelector('button[type="submit"]');

    if (!endpoint) {
      const text = `Product: ${data.product}\nFormat: ${data.format}\nEmail: ${data.email}\nTime: ${data.time || "-"}\nPage: ${data.page}`;
      location.href = `mailto:${modal.dataset.mailto}?subject=${encodeURIComponent("Free ad request: " + body.dataset.brand)}&body=${encodeURIComponent(text)}`;
      modal.classList.add("is-done");
      track("form_submit", { via: "mailto" });
      return;
    }
    btn.disabled = true;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      modal.classList.add("is-done");
      track("form_submit", { via: "endpoint" });
    } catch {
      btn.disabled = false;
      alert("Could not send the form. Please try again or email " + modal.dataset.mailto);
    }
  });
})();
