/* shell.jsx — sidebar, header, command palette, notifications, login, toasts */
const { useState: shS, useEffect: shE, useMemo: shM, useRef: shR } = React;

const NAV = [
  {
    group: "nav.crm", items: [
      { path: "/dashboard", key: "page.dashboard", icon: "home" },
      { path: "/customers", key: "page.customers", icon: "users" },
      { path: "/tasks", key: "page.tasks", icon: "checkCircle" },
      { path: "/inbox", key: "page.inbox", icon: "inbox" },
    ]
  },
  {
    group: "nav.catalog", items: [
      { path: "/products", key: "page.products", icon: "box" },
      { path: "/warehouse", key: "page.warehouse", icon: "layers" },
      { path: "/debtors", key: "page.orders", icon: "wallet" },
      { path: "/accounting", key: "page.payments", icon: "chart" },
      { path: "/contracts", key: "page.contracts", icon: "doc" },
      { path: "/locations", key: "page.locations", icon: "mapPin" },
    ]
  },
  {
    group: "nav.system", items: [
      { path: "/users", key: "page.users", icon: "users" },
      { path: "/audit-logs", key: "page.audit", icon: "clock" },
      { path: "/notifications", key: "page.notifications", icon: "bell" },
      { path: "/integrations", key: "page.integrations", icon: "link" },
      { path: "/settings", key: "page.settings", icon: "settings" },
    ]
  },
];
window.NAV = NAV;

// role-based access: which paths each role can see
const ROLE_ACCESS = {
  developer: null,
  admin: ["/dashboard", "/customers", "/tasks", "/inbox", "/products", "/warehouse", "/debtors", "/accounting", "/contracts", "/locations", "/users", "/audit-logs", "/notifications", "/settings"],
  operator: ["/dashboard", "/customers", "/tasks", "/inbox", "/products", "/warehouse", "/debtors", "/accounting", "/contracts", "/locations", "/notifications", "/integrations", "/settings"],
};
window.ROLE_ACCESS = ROLE_ACCESS;
const PAGE_PERMISSION_MAP = {
  "/dashboard": ["dashboard.view"],
  "/customers": ["clients.view", "clients.manage"],
  "/tasks": ["tasks.view", "tasks.manage"],
  "/inbox": ["chats.view", "chats.manage"],
  "/products": ["products.view", "products.manage"],
  "/warehouse": ["warehouse.view", "warehouse.manage"],
  "/debtors": ["debtors.view", "debtors.manage"],
  "/accounting": ["accounting.view", "accounting.manage"],
  "/contracts": ["contracts.view", "contracts.manage"],
  "/locations": ["clients.view", "clients.manage"],
  "/users": ["users.view", "users.manage"],
  "/audit-logs": ["audit_logs.view"],
  "/notifications": ["notifications.view", "notifications.manage"],
  "/integrations": ["integrations.view", "integrations.manage"],
  "/settings": ["ai.view", "ai.manage"],
};
function permissionKeysFrom(items) {
  return [...new Set((items || []).map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return item.key || item.codename || item.name || "";
    return "";
  }).filter(Boolean))];
}
function canDo(permKey, data) {
  const keys = permissionKeysFrom(data?.authUser?.permissions || data?.permissions || []);
  return keys.includes(permKey);
}
window.canDo = canDo;

function routeBasePath(path) {
  const normalized = String(path || "").trim();
  if (!normalized.startsWith("/")) return "/" + normalized.split("/")[0];
  return "/" + normalized.split("/").filter(Boolean)[0];
}
function canAccess(role, path, data) {
  const basePath = routeBasePath(path);
  const allowedByRole = ROLE_ACCESS[role];
  const roleAllows = allowedByRole == null || allowedByRole.includes(basePath);
  if (!data) return roleAllows;
  const authUserHasPermissions = !!data.authUser && Object.prototype.hasOwnProperty.call(data.authUser, "permissions");
  const sourcePermissions = authUserHasPermissions ? data.authUser.permissions : data.permissions;
  const permissionKeys = permissionKeysFrom(sourcePermissions);
  if (!authUserHasPermissions && !permissionKeys.length) return roleAllows;
  const needed = PAGE_PERMISSION_MAP[basePath];
  if (!needed?.length) return roleAllows;
  return needed.some((key) => permissionKeys.includes(key));
}
window.canAccess = canAccess;

// ---------- Logo ----------
function Logo({ compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #000))", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(var(--accent-rgb),.4)" }}>
        <I.sun size={19} style={{ color: "#fff" }} />
      </div>
      {!compact && <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontWeight: 760, fontSize: 15, letterSpacing: "-.02em" }}>Bogot Armada NRG</div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", fontWeight: 560, letterSpacing: ".02em" }}>CRM • Cognilabs</div>
      </div>}
    </div>
  );
}
window.Logo = Logo;

// ---------- Sidebar "wind" indicator ----------
// One shared ribbon that flows between nav links. On navigation the edge facing
// the travel direction leads, the trailing edge follows with a gentle lag, so the
// ribbon stretches like a gust and then relaxes. Both edges use smooth ease-in-out
// curves (zero velocity at start and end, no overshoot), sampled densely enough
// for 60 fps. Every effect timing is a fraction of WIND_MS.
const WIND_MS = 950;
const WIND_FRAMES = 120;
const WIND_LEAD = { from: 0, to: 0.8, ease: [0.5, 0, 0.22, 1] };
const WIND_TRAIL = { from: 0.14, to: 1, ease: [0.55, 0, 0.3, 1] };
const WIND_SOFT = "cubic-bezier(.45,0,.55,1)"; // gentle in-out for fades
// Flying up, the 💨 turns over first: its puff rises to the top and the streaks slide out below it,
// then the ribbon takes off with the streaks trailing; on arrival it turns back to blowing down.
const WIND_FLIP_MS = 300;
const WIND_FLIP_CLOUD = 8.5; // puff moves up by this (glyph units)
const WIND_FLIP_LINES = 10.5; // streaks move down by this
const windFlipOf = (cur) => {
  if (!cur || !cur.transform || cur.transform === "none") return 0;
  try { return Math.max(0, Math.min(1, -new DOMMatrix(cur.transform).m42 / WIND_FLIP_CLOUD)); } catch { return 0; }
};

// cubic-bezier(x1,y1,x2,y2) evaluated at x (Newton + bisection fallback)
function windBezier(x, [x1, y1, x2, y2]) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (t) => ((ax * t + bx) * t + cx) * t;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    const nt = t - (fx(t) - x) / d;
    if (nt < 0 || nt > 1) break;
    t = nt;
  }
  if (Math.abs(fx(t) - x) > 1e-5) {
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40; i++) { if (fx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
  }
  return ((ay * t + by) * t + cy) * t;
}
// progress (0..1) of one edge at normalised flight time u
const windEdge = (u, p) => windBezier((u - p.from) / (p.to - p.from), p.ease);
// Hermite blend that carries an edge's previous velocity (px/ms) into an interrupted flight and fades it
// out within window c (keeps velocity continuous; c shrinks so the carried drift never exceeds ~60px)
const WIND_CARRY_PX = 60;
function windCarry(u, vel) {
  if (!vel) return 0;
  const c = Math.min(0.3, WIND_CARRY_PX / (Math.abs(vel) * WIND_MS * 4 / 27));
  if (u >= c) return 0;
  const x = u / c;
  return vel * WIND_MS * c * x * (1 - x) * (1 - x);
}
const windLerp = (a, b, k) => a + (b - a) * k;

function windBoxOf(el, nav) {
  const r = el.getBoundingClientRect();
  const n = nav.getBoundingClientRect();
  return {
    x: r.left - n.left - nav.clientLeft + nav.scrollLeft,
    y: r.top - n.top - nav.clientTop + nav.scrollTop,
    w: r.width,
    h: r.height,
  };
}
const windSame = (a, b) => !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

function useWindIndicator(navRef, windRef) {
  const st = shR({ first: true, shown: false, path: null, box: null, axis: "y", flying: false, anims: [], flight: null, navIcon: null });
  const syncRef = shR(null);

  const apply = (box) => {
    const el = windRef.current, nav = navRef.current;
    // where the accent bar sits: nav's inner left edge (sidebar) / bottom edge (topnav)
    el.style.setProperty("--wind-x", box.x + "px");
    el.style.setProperty("--wind-b", Math.max(0, nav.clientHeight - box.y - box.h + nav.scrollTop) + "px");
    el.style.setProperty("--wind-ih", box.h + "px"); // icon stays centred on the link while it rides the leading edge
    el.style.transform = `translate(${box.x}px, ${box.y}px)`;
    el.style.width = box.w + "px";
    el.style.height = box.h + "px";
  };
  const stopFlight = () => {
    st.current.anims.forEach(a => a.cancel());
    st.current.anims = [];
    st.current.flying = false;
    st.current.flight = null;
    if (windRef.current) windRef.current.removeAttribute("data-flying");
  };
  // Live visual state right before a new flight, so the next one continues from it with no jump:
  // edge velocities of an interrupted flight, and the current opacity/transform/dash of every
  // animated piece (also catches the idle loop's drift and stream dashes).
  const snapshot = () => {
    const el = windRef.current, s = st.current;
    const snap = { styles: new Map(), vel: null, iconTop: null, dir: el.getAttribute("data-dir") };
    const f = s.flight;
    if (s.flying && f && f.anim && f.anim.currentTime != null) {
      const u = Math.max(0, Math.min(1, (f.anim.currentTime - f.pre) / WIND_MS)), du = 0.01;
      const p0 = f.edges(Math.max(0, u - du)), p1 = f.edges(Math.min(1, u + du));
      const dt = (Math.min(1, u + du) - Math.max(0, u - du)) * WIND_MS;
      if (dt > 0) snap.vel = { axis: f.axis, start: (p1.start - p0.start) / dt, end: (p1.end - p0.end) / dt };
    }
    const targets = [...el.querySelectorAll(".tg-wind-gust, .tg-wind-tint, .tg-wind-streak, .tg-wind-puff, .tg-wind-icon, .tg-wind-glyph, .tg-wind-glyph path, .tg-wg-lines, .tg-wg-cloud, .tg-wind-ipuff")];
    if (s.navIcon && s.navIcon.isConnected) targets.push(s.navIcon);
    targets.forEach(n => {
      const cs = getComputedStyle(n);
      snap.styles.set(n, { opacity: cs.opacity, transform: cs.transform, dash: parseFloat(cs.strokeDashoffset) || 0 });
    });
    const icon = el.querySelector(".tg-wind-icon");
    if (icon && getComputedStyle(icon).display !== "none") snap.iconTop = icon.getBoundingClientRect().top;
    return snap;
  };
  const setShown = (on, instant) => {
    const el = windRef.current;
    if (instant) {
      el.style.transition = "none";
      el.setAttribute("data-shown", on ? "1" : "0");
      void el.offsetWidth;
      el.style.transition = "";
    } else {
      el.setAttribute("data-shown", on ? "1" : "0");
    }
    st.current.shown = on;
  };

  const fly = (from, to, item, snap) => {
    const el = windRef.current, s = st.current;
    const axis = s.axis;
    const P = axis === "y" ? ["y", "h", "x", "w"] : ["x", "w", "y", "h"];
    const [pos, size, cpos, csize] = P;
    const back = to[pos] < from[pos]; // up (or left): the start edge leads
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    apply(to);
    el.setAttribute("data-dir", axis === "y" ? (back ? "up" : "down") : (back ? "left" : "right"));
    const frame = (b) => ({ transform: `translate(${b.x}px, ${b.y}px)`, width: b.w + "px", height: b.h + "px" });

    if (reduce) {
      s.anims = [el.animate([frame(from), frame(to)], { duration: 160, easing: "ease-out" })];
    } else {
      const ms = (k) => WIND_MS * k;
      const styles = (snap && snap.styles) || new Map();
      // run an effect, starting from the element's live value when it was mid-animation
      const fx = [];
      const run = (n, kfs, opts, props = ["opacity", "transform"]) => {
        if (!n) return;
        const cur = styles.get(n);
        if (cur) props.forEach(pr => { if (kfs.some(k => pr in k)) kfs[0][pr] = cur[pr]; });
        fx.push(n.animate(kfs, opts));
        styles.delete(n);
      };

      // ---- ribbon: lead edge first, trail edge follows; an interrupted flight keeps its momentum ----
      const aStart = from[pos], aEnd = from[pos] + from[size];
      const bStart = to[pos], bEnd = to[pos] + to[size];
      const v = snap && snap.vel && snap.vel.axis === axis ? snap.vel : { start: 0, end: 0 };
      const edgeAt = (a, b, k, vel, u) => {
        let p = windLerp(a, b, k) + windCarry(u, vel);
        if (b > a) p = Math.min(p, b); else if (b < a) p = Math.max(p, b); // never past the target
        return p;
      };
      // an interrupted flight releases its trailing edge right away, so it never hesitates after braking
      // (and ramps up sooner, so the new pull overlaps the braking of the old momentum)
      const moving = !!(v.start || v.end);
      const lead = moving ? { ...WIND_LEAD, ease: [0.3, 0, 0.22, 1] } : WIND_LEAD;
      const trail = moving ? { ...WIND_TRAIL, from: 0.04, ease: [0.3, 0, 0.3, 1] } : WIND_TRAIL;
      const edges = (u) => {
        const kl = windEdge(u, lead), kt = windEdge(u, trail);
        const start = edgeAt(aStart, bStart, back ? kl : kt, v.start, u);
        const end = edgeAt(aEnd, bEnd, back ? kt : kl, v.end, u);
        return { start, end, kl, kt };
      };
      const frames = [], stretch = [], sizes = [];
      for (let i = 0; i <= WIND_FRAMES; i++) {
        const u = i / WIND_FRAMES;
        let { start, end, kl, kt } = edges(u);
        if (end - start < 8) { const mid = (start + end) / 2; start = mid - 4; end = mid + 4; }
        const b = {};
        b[pos] = start; b[size] = end - start;
        b[cpos] = windLerp(from[cpos], to[cpos], kl);
        b[csize] = windLerp(from[csize], to[csize], kl);
        frames.push({ ...frame(b), offset: u });
        stretch.push(Math.max(0, kl - kt));
        sizes.push(end - start);
      }
      const main = el.animate(frames, { duration: WIND_MS, easing: "linear" });
      s.flight = { anim: main, edges, axis, pre: 0 };

      // ---- glow: gust brightens and the base tint dims, both breathing over the whole flight ----
      run(el.querySelector(".tg-wind-gust"), [{ opacity: 0, easing: WIND_SOFT }, { opacity: 0.85, offset: 0.42, easing: WIND_SOFT }, { opacity: 0 }],
        { duration: WIND_MS, easing: "linear" });
      run(el.querySelector(".tg-wind-tint"), [{ opacity: 1, easing: WIND_SOFT }, { opacity: 0.55, offset: 0.42, easing: WIND_SOFT }, { opacity: 1 }],
        { duration: WIND_MS, easing: "linear" });

      // ---- streak lines drifting toward the leading edge ----
      const sign = back ? -1 : 1;
      const tr = (val) => axis === "y" ? `translateY(${val}%)` : `translateX(${val}%)`;
      el.querySelectorAll(".tg-wind-streak").forEach((sk, i) => {
        run(sk, [
          { transform: tr(-sign * 150), opacity: 0 },
          { opacity: 0.7, offset: 0.35 },
          { opacity: 0.7, offset: 0.6 },
          { transform: tr(sign * 210), opacity: 0 },
        ], { duration: ms(0.62), delay: ms(0.04 + i * 0.06), easing: "cubic-bezier(.4,0,.45,1)", fill: "backwards" }, ["opacity"]);
      });

      // ---- destination link icon: a soft airy sway, plus a faint puff behind it when the ribbon arrives ----
      const ico = item && item.querySelector("svg");
      const puff = el.querySelector(".tg-wind-puff");
      if (ico) {
        const ir = ico.getBoundingClientRect(), xr = item.getBoundingClientRect();
        puff.style.left = (ir.left - xr.left + ir.width / 2) + "px";
        puff.style.top = (ir.top - xr.top + ir.height / 2) + "px";
        run(ico, [
          { transform: "rotate(0deg) scale(1)", easing: WIND_SOFT },
          { transform: "rotate(-10deg) scale(1.08)", offset: 0.45, easing: WIND_SOFT },
          { transform: "rotate(0deg) scale(1)" },
        ], { duration: ms(0.6), delay: ms(0.38), easing: "linear", fill: "backwards" });
        run(puff, [
          { transform: "translate(-50%,-50%) scale(.5)", opacity: 0, easing: WIND_SOFT },
          { transform: "translate(-50%,-50%) scale(1.05)", opacity: 0.4, offset: 0.45, easing: WIND_SOFT },
          { transform: "translate(-50%,-50%) scale(1.4)", opacity: 0 },
        ], { duration: ms(0.56), delay: ms(0.44), easing: "linear", fill: "backwards" });
      }
      s.navIcon = ico || null;

      // ---- the 💨 icon rides the leading edge (same keyframes as the ribbon, so it is locked to it) ----
      const icon = el.querySelector(".tg-wind-icon");
      if (axis === "y" && icon && getComputedStyle(icon).display !== "none") {
        const glyph = icon.querySelector("svg");
        // its stretch follows the ribbon's own stretch, so it grows and relaxes with it
        const peak = Math.max(...stretch);
        const d = back ? -1 : 1;
        const gk = stretch.map((st0, i) => {
          const k = peak > 0.001 ? st0 / peak : 0;
          return { transform: `translateY(${(d * 1.2 * k).toFixed(3)}px) scale(${(1 - 0.08 * k).toFixed(4)}, ${(1 + 0.24 * k).toFixed(4)})`, opacity: +(1 - 0.12 * k).toFixed(4), offset: i / WIND_FRAMES };
        });
        // ease out of whatever the idle drift / previous flight left on the glyph
        const cur = styles.get(glyph);
        if (cur && cur.transform !== "none") {
          const blend = Math.max(2, Math.round(WIND_FRAMES * 0.15));
          gk[0].transform = cur.transform; gk[0].opacity = +cur.opacity;
          for (let i = 1; i < blend; i++) gk[i] = { offset: gk[i].offset, opacity: gk[i].opacity }; // let WAAPI blend to the stretch curve
          styles.delete(glyph);
        }
        fx.push(glyph.animate(gk, { duration: WIND_MS, easing: "linear" }));
        // the idle streams finish their current stroke instead of snapping back to "drawn"
        glyph.querySelectorAll("path").forEach(pth => {
          const cur2 = styles.get(pth);
          const period = pth.classList.contains("tg-wg-p") ? 116 : 160;
          const d0 = cur2 ? cur2.dash : 0;
          styles.delete(pth);
          if (d0 > 0.5 && d0 < period - 0.5) {
            fx.push(pth.animate([{ strokeDashoffset: d0 }, { strokeDashoffset: period }], { duration: ms(0.55), easing: "cubic-bezier(.3,0,.3,1)", fill: "forwards" }));
          }
        });
        // a direction change mid-flight moves the icon to the other edge: it keeps riding the old edge
        // (same velocity, no corner) and blends over to the new leading edge
        if (snap && snap.iconTop != null) {
          const dy0 = snap.iconTop - icon.getBoundingClientRect().top;
          if (Math.abs(dy0) > 0.5) {
            const flip = snap.dir !== el.getAttribute("data-dir") ? (back ? 1 : -1) : 0; // old anchor below (+) / above (-)
            const span = 0.5, ik = [];
            for (let i = 0; i <= WIND_FRAMES; i++) {
              const u = i / WIND_FRAMES;
              if (u > span) break;
              const x = u / span, fade = 1 - x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
              const dy = (dy0 + flip * (sizes[i] - sizes[0])) * fade;
              ik.push({ transform: `translateY(${dy.toFixed(2)}px)`, offset: u / span });
            }
            ik[ik.length - 1] = { transform: "translateY(0px)", offset: 1 };
            styles.delete(icon);
            fx.push(icon.animate(ik, { duration: ms(span), easing: "linear" }));
          }
        }
        // arrival: a soft glow that fades in and out, no pop
        run(el.querySelector(".tg-wind-ipuff"), [
          { transform: "translate(-50%,-50%) scale(.6)", opacity: 0, easing: WIND_SOFT },
          { transform: "translate(-50%,-50%) scale(1.1)", opacity: 0.32, offset: 0.45, easing: WIND_SOFT },
          { transform: "translate(-50%,-50%) scale(1.45)", opacity: 0 },
        ], { duration: ms(0.42), delay: ms(0.58), easing: "linear", fill: "backwards" });
      }
      // ---- 💨 turns over for an upward flight: puff on top, streaks trailing below; turns back on arrival ----
      const cloud = icon && icon.querySelector(".tg-wg-cloud"), lines = icon && icon.querySelector(".tg-wg-lines");
      const iconOn = axis === "y" && cloud && lines && getComputedStyle(icon).display !== "none" && !el.closest(".tg-sidebar.collapsed");
      const flip0 = windFlipOf(styles.get(cloud));
      if (iconOn && (back || flip0 > 0.01)) {
        // a fresh upward flight waits for the turn; one that interrupts a moving ribbon turns while flying
        const pre = back && !moving ? Math.round(WIND_FLIP_MS * (1 - flip0)) : 0;
        if (pre > 0) {
          fx.forEach(a => {
            const t = a.effect.getTiming();
            a.effect.updateTiming({ delay: (t.delay || 0) + pre, fill: t.fill === "forwards" || t.fill === "both" ? "both" : "backwards" });
          });
          main.effect.updateTiming({ delay: pre, fill: "backwards" });
          s.flight.pre = pre;
        }
        const T = pre + WIND_MS;
        const at = (ms0) => Math.max(0, Math.min(1, ms0 / T));
        const C = (k) => `translateY(${(-WIND_FLIP_CLOUD * k).toFixed(2)}px)`;
        const L = (y, sy) => `translateY(${y}px) scaleY(${sy})`;
        const N = { transform: L(0, 1), opacity: 1 }, F = { transform: L(WIND_FLIP_LINES, 1), opacity: 1 };
        const hidTop = { transform: L(0, 0.15), opacity: 0 }, hidBot = { transform: L(WIND_FLIP_LINES, 0.15), opacity: 0 };
        const ck = [], lk = [];
        let tFlipped; // when the glyph is fully turned over
        if (back) {
          const tIn = pre || Math.round(WIND_FLIP_MS * (1 - flip0)) || 0;
          ck.push({ transform: C(flip0), offset: 0, easing: WIND_SOFT });
          if (flip0 > 0.5) lk.push({ ...F, offset: 0 }); // already (mostly) turned: streaks are below
          else lk.push({ ...N, offset: 0, easing: "cubic-bezier(.5,0,.75,0)" }, { ...hidTop, offset: at(tIn * 0.45) }, { ...hidBot, offset: at(tIn * 0.5), easing: "cubic-bezier(.25,1,.5,1)" });
          tFlipped = tIn;
        } else {
          tFlipped = 0; // turning back at the start of a downward flight
        }
        // turned over (puff up, streaks below) until the leading edge lands, then turn back
        const outStart = back ? pre + WIND_MS * 0.78 : 0, outEnd = back ? T : WIND_MS * 0.36;
        if (back) {
          ck.push({ transform: C(1), offset: at(tFlipped) }, { transform: C(1), offset: at(outStart), easing: WIND_SOFT });
          lk.push({ ...F, offset: at(tFlipped) }, { ...F, offset: at(outStart), easing: "cubic-bezier(.5,0,.75,0)" });
        } else {
          ck.push({ transform: C(flip0), offset: 0, easing: WIND_SOFT });
          lk.push({ ...F, opacity: flip0, offset: 0, easing: "cubic-bezier(.5,0,.75,0)" });
        }
        const out = outEnd - outStart;
        ck.push({ transform: C(0), offset: at(outEnd) });
        lk.push({ ...hidBot, offset: at(outStart + out * 0.45) }, { ...hidTop, offset: at(outStart + out * 0.5), easing: "cubic-bezier(.25,1,.5,1)" }, { ...N, offset: at(outEnd) });
        if (ck[ck.length - 1].offset < 1) ck.push({ transform: C(0), offset: 1 });
        if (lk[lk.length - 1].offset < 1) lk.push({ ...N, offset: 1 });
        // keep offsets non-decreasing (a zero-length turn collapses to one point)
        [ck, lk].forEach(k => k.forEach((f, i) => { if (i && f.offset < k[i - 1].offset) f.offset = k[i - 1].offset; }));
        const lcur = styles.get(lines);
        if (lcur && back && flip0 > 0.01 && flip0 <= 0.5) { lk[0].transform = lcur.transform; lk[0].opacity = +lcur.opacity; }
        styles.delete(cloud); styles.delete(lines);
        fx.push(cloud.animate(ck, { duration: T, easing: "linear" }), lines.animate(lk, { duration: T, easing: "linear" }));
      }
      // anything still mid-effect from the previous flight that this one doesn't drive: settle it softly
      // from where it was to its resting value (the old animations are already cancelled here)
      styles.forEach((cur, n) => {
        if (!n.isConnected || n.tagName.toLowerCase() === "path") return;
        const rest = getComputedStyle(n), k0 = {}, k1 = {};
        if (cur.transform !== rest.transform) { k0.transform = cur.transform; k1.transform = rest.transform; }
        if (Math.abs(+cur.opacity - +rest.opacity) > 0.01) { k0.opacity = +cur.opacity; k1.opacity = +rest.opacity; }
        if (Object.keys(k0).length) fx.push(n.animate([k0, k1], { duration: ms(0.35), easing: WIND_SOFT }));
      });
      s.anims = [main, ...fx];
    }
    // start on this frame's clock (not the next frame): no held frame between the old and the new flight
    const now = document.timeline && document.timeline.currentTime;
    if (now != null) s.anims.forEach(a => { a.startTime = now; });
    s.flying = true;
    el.setAttribute("data-flying", "1");
    const main = s.anims[0];
    main.onfinish = () => {
      if (s.anims[0] !== main) return;
      s.anims.forEach(a => { if (a !== main) a.cancel(); });
      s.anims = [];
      s.flying = false;
      s.flight = null;
      el.removeAttribute("data-flying");
      syncRef.current && syncRef.current();
    };
  };

  const sync = () => {
    const nav = navRef.current, el = windRef.current, s = st.current;
    if (!nav || !el) return;
    const axis = document.documentElement.getAttribute("data-layout") === "topnav" ? "x" : "y";
    const item = nav.querySelector('.tg-nav-item[data-active="1"]');
    let visible = !!item && item.getClientRects().length > 0;
    if (visible) {
      const grp = item.closest(".tg-nav-group-items");
      if (grp) {
        if (grp.classList.contains("tg-nav-group-closed")) visible = false;
        else if (axis === "y" && item.offsetTop + item.offsetHeight > grp.offsetTop + grp.clientHeight + 1) visible = false; // still unfolding
      }
    }
    if (!visible) {
      stopFlight();
      if (s.shown) setShown(false, s.first);
      s.path = null;
      return;
    }
    const box = windBoxOf(item, nav);
    const path = item.getAttribute("data-path");
    if (s.axis !== axis) { s.axis = axis; stopFlight(); }
    el.setAttribute("data-axis", axis);
    if (!s.shown || s.path === null) {
      stopFlight();
      apply(box);
      setShown(true, s.first);
    } else if (s.path !== path) {
      const from = s.flying ? windBoxOf(el, nav) : s.box;
      const snap = snapshot();
      stopFlight();
      fly(from, box, item, snap);
    } else if (!s.flying && !windSame(box, s.box)) {
      apply(box);
    }
    s.first = false;
    s.path = path;
    s.box = box;
  };
  syncRef.current = sync;

  // after every render of the sidebar (route, language, collapse, group toggle, role…)
  React.useLayoutEffect(() => { sync(); });

  shE(() => {
    const nav = navRef.current;
    if (!nav) return;
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => syncRef.current()); };
    const observed = new Set();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(later) : null;
    const observeAll = () => {
      if (!ro) return;
      [nav, ...nav.querySelectorAll(".tg-nav-group, .tg-nav-group-items, .tg-nav-item")].forEach(n => {
        if (!observed.has(n)) { observed.add(n); ro.observe(n); }
      });
    };
    observeAll();
    const mo = new MutationObserver(() => { observeAll(); later(); });
    mo.observe(nav, { childList: true, subtree: true });
    const rootMo = new MutationObserver(later);
    rootMo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-layout", "data-density", "dir", "lang"] });
    nav.addEventListener("scroll", later, { passive: true });
    nav.addEventListener("transitionend", later);
    window.addEventListener("resize", later);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
    return () => {
      cancelAnimationFrame(raf);
      ro && ro.disconnect();
      mo.disconnect();
      rootMo.disconnect();
      nav.removeEventListener("scroll", later);
      nav.removeEventListener("transitionend", later);
      window.removeEventListener("resize", later);
      stopFlight();
    };
  }, []);
}

function WindIndicator({ windRef }) {
  return (
    <div className="tg-wind" ref={windRef} aria-hidden="true" data-shown="0" data-axis="y">
      <div className="tg-wind-body">
        <span className="tg-wind-tint" />
        <span className="tg-wind-gust" />
        <span className="tg-wind-streak" />
        <span className="tg-wind-streak" />
        <span className="tg-wind-streak" />
        <span className="tg-wind-streak" />
        <span className="tg-wind-puff" />
      </div>
      <span className="tg-wind-bar" />
      <span className="tg-wind-icon"><WindGlyph /><span className="tg-wind-ipuff" /></span>
    </div>
  );
}

// Hand-drawn 💨 turned to blow toward the bottom of the sidebar: three speed streaks
// rush down into an open puff whose outline winds into an inner swirl.
function WindGlyph() {
  return (
    <svg className="tg-wind-glyph" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <g className="tg-wg-lines">
        <path className="tg-wg-s" pathLength="100" d="M6.2 1.5c0 2.6.4 4.8.4 6.9" />
        <path className="tg-wg-s" pathLength="100" d="M10.4 1.5c0 1.8.2 3.2.2 4.6" />
        <path className="tg-wg-s" pathLength="100" d="M14.6 2.8c0 1.4.2 2.6.2 3.7" />
      </g>
      <g className="tg-wg-cloud"><path className="tg-wg-p" pathLength="100" d="M6 11.5c-1.5.3-2.6 1.6-2.5 3.1.1 1.6 1.6 2.8 3.2 2.6.8 1.2 2.3 1.8 3.7 1.4 1.2-.3 2-1.3 2.2-2.4 1.6.3 3.2-.7 3.5-2.3.3-1.7-.8-3.2-2.4-3.5-.5-1.5-2-2.4-3.5-2.1-1.4.2-2.4 1.4-2.4 2.8 0 1.4 1.1 2.5 2.4 2.5 1 0 1.7-.7 1.7-1.6 0-.7-.6-1.2-1.2-1.1" /></g>
    </svg>
  );
}

// ---------- Sidebar ----------
function Sidebar({ route, nav, mobileOpen, setMobileOpen }) {
  const { t, sidebarCollapsed, role, data } = useApp();
  const collapsed = sidebarCollapsed && !mobileOpen;
  const [closedGroups, setClosedGroups] = shS({});
  const toggleGroup = (key) => setClosedGroups(g => ({ ...g, [key]: !g[key] }));
  const navRef = shR(null);
  const windRef = shR(null);
  useWindIndicator(navRef, windRef);
  return (
    <>
      {mobileOpen && <div className="tg-sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={"tg-sidebar" + (collapsed ? " collapsed" : "") + (mobileOpen ? " mobile-open" : "")}>
        <div className="tg-sidebar-head">
          <Logo compact={collapsed} />
        </div>
        <nav className="tg-sidebar-nav" ref={navRef}>
          <WindIndicator windRef={windRef} />
          {NAV.map(grp => {
            const items = grp.items.filter(it => canAccess(role, it.path, data));
            if (!items.length) return null;
            const isClosed = !!closedGroups[grp.group];
            return (
              <div key={grp.group} className="tg-nav-group">
                {!collapsed && (
                  <button className="tg-nav-grouptitle" onClick={() => toggleGroup(grp.group)}>
                    <span>{t(grp.group)}</span>
                    <I.chevDown size={13} className={"tg-nav-chev" + (isClosed ? " tg-nav-chev-closed" : "")} />
                  </button>
                )}
                <div className={"tg-nav-group-items" + (isClosed && !collapsed ? " tg-nav-group-closed" : "")}>
                  {items.map(it => {
                    const Ico = I[it.icon];
                    const active = route === it.path || route.startsWith(it.path + "/");
                    return (
                      <button key={it.path} className="tg-nav-item" data-path={it.path} data-active={active ? "1" : undefined}
                        title={collapsed ? t(it.key) : undefined}
                        onClick={() => { nav(it.path); setMobileOpen(false); }}>
                        <Ico size={18} />
                        {!collapsed && <span className="tg-nav-label">{t(it.key)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="tg-sidebar-foot" />
      </aside>
    </>
  );
}

// ---------- Header ----------
// Sun/moon theme switch — circular reveal via View Transitions API
function ThemeToggle() {
  const { theme, setTheme, t } = useApp();
  const isLight = resolveLight(theme);

  const onToggle = (e) => {
    const next = isLight ? "dark" : "light";
    const run = () => ReactDOM.flushSync(() => setTheme(next));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) { run(); return; }

    const x = e.clientX, y = e.clientY;
    const endR = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(run);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endR}px at ${x}px ${y}px)`] },
        { duration: 540, easing: "cubic-bezier(.4,0,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  };

  return (
    <button className="tg-theme-toggle" data-light={isLight ? "1" : "0"} onClick={onToggle}
      title={isLight ? t("common.nightMode") : t("common.dayMode")} aria-label={isLight ? t("common.nightMode") : t("common.dayMode")}>
      <span className="tg-theme-icon">{isLight ? <I.sun size={16} /> : <I.moon size={15} />}</span>
    </button>
  );
}

function Header({ route, nav, onMenu, onCmdK, custOpen, onCustToggle, onCustClose }) {
  const app = useApp();
  const { t, sidebarCollapsed, setSidebarCollapsed, role, data, logout } = app;
  const [notifOpen, setNotifOpen] = shS(false);
  const unread = data.notifications.filter(n => !n.read).length;
  const me = data.authUser || data.users.find(u => u.role === role) || data.users[0] || {
    fullName: t("common.username") || "Foydalanuvchi",
    role,
    label: t(`role.${role}`) || role,
    avatarHue: 220,
  };

  return (
    <header className="tg-header">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton icon={<I.panelLeft size={19} />} label={t("common.sidebar")} onClick={() => { if (window.innerWidth <= 1024) onMenu(); else setSidebarCollapsed(!sidebarCollapsed); }} />
        <button className="tg-cmdk-trigger" onClick={onCmdK}>
          <I.search size={16} />
          <span>{t("common.search")}</span>
          <span className="tg-kbd" style={{ marginLeft: "auto" }}>⌘K</span>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="hide-header-mobile"><QuickCreate /></span>
        <span className="hide-header-mobile"><ThemeToggle /></span>
        <span className="hide-header-mobile"><IconButton icon={<I.sliders size={19} />} label={t("customize.title")} onClick={onCustToggle} /></span>
        {custOpen && <CustomizePanel onClose={onCustClose} />}
        <span className="hide-header-mobile"><LangSelector /></span>
        <MobileHeaderMenu onCustToggle={onCustToggle} />
        {/* notifications */}
        <div style={{ position: "relative" }}>
          {canAccess(role, "/notifications", data) ? <><IconButton icon={<I.bell size={19} />} label={t("notifications.title")} badge={unread} onClick={() => setNotifOpen(o => !o)} />
          {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} nav={nav} />}</> : null}
        </div>
        {/* account */}
        <Dropdown align="right" width={230} trigger={
          <button className="tg-account-btn">
            <Avatar name={me.fullName} hue={me.avatarHue} size={32} />
            <div className="tg-account-info">
              <div className="tg-account-name">{me.fullName}</div>
              <div className="tg-account-role">{me.label || t("role." + role)}</div>
            </div>
            <I.chevDown size={15} style={{ color: "var(--text-3)" }} />
          </button>
        } items={[
          { label: me.label || t("role." + role), icon: <I.shield size={16} />, right: <I.check size={15} style={{ color: "var(--accent)" }} />, onClick: () => {} },
          { divider: true },
          { label: t("common.logout"), icon: <I.logout size={16} />, danger: true, onClick: logout },
        ]} />
      </div>
    </header>
  );
}

// ---------- Language selector ----------
const LANGS = [
  { value: "uz", label: "O'zbek",  code: "UZ", color: "#1eb53a" },
  { value: "ru", label: "Русский", code: "RU", color: "#d52b1e" },
  { value: "en", label: "English", code: "GB", color: "#012169" },
];

function FlagIcon({ code, style }) {
  const F = window.Flags && window.Flags[code];
  if (!F) return <span style={{ fontSize: 18 }}>{code}</span>;
  return React.createElement(F, { style: { width: 24, borderRadius: 3, display: "block", ...style } });
}

function LangSelector() {
  const { lang, setLang, t } = useApp();
  const [open, setOpen] = shS(false);
  const ref = shR(null);
  shE(() => {
    if (!open) return;
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [open]);
  const current = LANGS.find(l => l.value === lang) || LANGS[0];
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="tg-iconbtn" onClick={() => setOpen(o => !o)} title={t("common.changeLanguage")}>
        <FlagIcon code={current.code} />
      </button>
      {open && (
        <div className="tg-dd-menu pop-in tg-dd-right"
          style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 182, zIndex: 200 }}>
          {LANGS.map(l => (
            <button key={l.value} {...sideLine(lang === l.value ? l.color : "neutral", { active: lang === l.value, className: "tg-dd-item side-line-sm side-line-quiet", style: { gap: 10 } })}
              onClick={() => { setLang(l.value); setOpen(false); }}>
              <FlagIcon code={l.code} style={{ width: 26 }} />
              <span style={{ flex: 1, color: lang === l.value ? l.color : undefined, fontWeight: lang === l.value ? 600 : undefined }}>{l.label}</span>
              {lang === l.value && <I.check size={14} style={{ color: l.color }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileHeaderMenu({ onCustToggle }) {
  const { lang, setLang, theme, setTheme, t, role, data } = useApp();
  const [open, setOpen] = shS(false);
  const ref = shR(null);
  const isLight = resolveLight(theme);
  const qcItems = [
    { key: "qc.customer", icon: "user", to: "/customers" },
    { key: "qc.order", icon: "wallet", to: "/debtors" },
    { key: "qc.task", icon: "checkCircle", to: "/tasks" },
    { key: "qc.product", icon: "box", to: "/products" },
  ].filter((item) => canAccess(role, item.to, data));
  shE(() => {
    if (!open) return;
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [open]);
  return (
    <div style={{ position: "relative" }} ref={ref} className="show-header-mobile">
      <IconButton icon={<I.dots size={19} />} onClick={() => setOpen(o => !o)} />
      {open && (
        <div className="tg-dd-menu pop-in tg-dd-right"
          style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 210, zIndex: 200 }}>
          <div className="tg-mobile-menu-section">{t("common.quickCreate")}</div>
          {qcItems.map(it => { const Ico = I[it.icon]; return (
            <button key={it.key} className="tg-dd-item" style={{ gap: 10 }} onClick={() => { window.navTo(it.to); setOpen(false); }}>
              <Ico size={16} /><span>{t(it.key)}</span>
            </button>
          ); })}
          <div className="tg-dd-divider" />
          <div className="tg-mobile-menu-section">{t("common.changeLanguage")}</div>
          {LANGS.map(l => (
            <button key={l.value} {...sideLine(lang === l.value ? l.color : "neutral", { active: lang === l.value, className: "tg-dd-item side-line-sm side-line-quiet", style: { gap: 10 } })}
              onClick={() => { setLang(l.value); setOpen(false); }}>
              <FlagIcon code={l.code} style={{ width: 22 }} />
              <span style={{ flex: 1, color: lang === l.value ? l.color : undefined, fontWeight: lang === l.value ? 600 : undefined }}>{l.label}</span>
              {lang === l.value && <I.check size={14} style={{ color: l.color }} />}
            </button>
          ))}
          <div className="tg-dd-divider" />
          <button className="tg-dd-item" style={{ gap: 10 }} onClick={() => { setTheme(isLight ? "dark" : "light"); setOpen(false); }}>
            {isLight ? <I.moon size={16} /> : <I.sun size={16} />}
            <span>{isLight ? (t("theme.dark") || "Qorong'u") : (t("theme.light") || "Yorug'")}</span>
          </button>
          <button className="tg-dd-item" style={{ gap: 10 }} onClick={() => { onCustToggle(); setOpen(false); }}>
            <I.sliders size={16} /><span>{t("customize.title")}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function QuickCreate() {
  const { t, toast, role, data } = useApp();
  const items = [
    { key: "qc.customer", icon: "user", to: "/customers" },
    { key: "qc.order", icon: "wallet", to: "/debtors" }, { key: "qc.task", icon: "checkCircle", to: "/tasks" },
    { key: "qc.product", icon: "box", to: "/products" }, { key: "qc.call", icon: "chart", to: "/accounting" },
  ].filter((item) => canAccess(role, item.to, data));
  if (!items.length) return null;
  return (
    <Dropdown align="right" width={210} trigger={<Button variant="primary" size="sm" icon={<I.plus size={16} />}><span className="hide-sm">{t("common.quickCreate")}</span></Button>}
      items={items.map(it => { const Ico = I[it.icon]; return { label: t(it.key), icon: <Ico size={16} />, onClick: () => { window.navTo(it.to); toast(t(it.key) + " — forma ochildi"); } }; })} />
  );
}

function NotifPanel({ onClose, nav }) {
  const { data, markNotificationRead, markAllNotificationsRead, t } = useApp();
  const ref = shR(null);
  const TYPE_ICON = { client_created: "users", task_assigned: "checkCircle", task_done: "checkCircle", system: "settings" };
  const TYPE_COLOR = { client_created: "blue", task_assigned: "violet", task_done: "green", system: "slate" };
  shE(() => {
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", on), 0);
    return () => document.removeEventListener("mousedown", on);
  }, []);
  const notifs = data.notifications.slice(0, 10);
  return (
    <div className="tg-notif-panel pop-in" ref={ref}>
      <div className="tg-notif-head">
        <strong>{t("notifications.title")}</strong>
        <button className="tg-link" onClick={() => markAllNotificationsRead().catch(() => null)}>{t("common.markAllRead")}</button>
      </div>
      <div className="tg-notif-list">
        {notifs.map(n => {
          const Ico = I[TYPE_ICON[n.type] || "bell"];
          const color = TYPE_COLOR[n.type] || "slate";
          return (
            <button key={n.id} {...sideLine(n.read ? "neutral" : (color === "slate" ? "accent" : color), { className: "tg-notif-item side-line-sm" + (n.read ? " side-line-quiet" : "") })} data-unread={!n.read ? "1" : undefined}
              onClick={() => { markNotificationRead(n.id).catch(() => null); }}>
              <span className="tg-notif-icon" style={{ color: `var(--${color})`, background: `var(--${color}-bg)` }}><Ico size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tg-notif-text">{n.message || n.title}</div>
                <div className="tg-notif-time">{timeAgo(n.at)}</div>
              </div>
              {!n.read && <span className="tg-notif-dot" />}
            </button>
          );
        })}
      </div>
      <button className="tg-notif-foot" onClick={() => { nav("/notifications"); onClose(); }}>{t("notifications.viewAll")}</button>
    </div>
  );
}

// ---------- Command palette ----------
function CommandPalette({ open, onClose, nav }) {
  const { data, t, role } = useApp();
  const [q, setQ] = shS("");
  const [idx, setIdx] = shS(0);
  const inputRef = shR(null);
  shE(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);

  const results = shM(() => {
    const ql = q.toLowerCase().trim();
    const groups = [];
    const pages = NAV.flatMap(g => g.items).filter(it => canAccess(role, it.path, data)).map(it => ({ type: t("common.page"), label: t(it.key), icon: it.icon, to: it.path }));
    const matchPages = pages.filter(p => !ql || p.label.toLowerCase().includes(ql)).slice(0, 6);
    if (matchPages.length) groups.push({ title: t("common.pages"), items: matchPages });
    if (ql) {
      const custs = data.customers.filter(c => c.fullName.toLowerCase().includes(ql)).slice(0, 3).map(c => ({ type: t("common.customer"), label: c.fullName, sub: [c.district, c.mahalla].filter(Boolean).join(" / "), icon: "user", to: "/customers/" + c.id }));
      if (custs.length) groups.push({ title: t("common.customers"), items: custs });
      const prods = data.products
        .filter((p) => {
          const name = (window.productDisplayName ? window.productDisplayName(p) : (p.name || p.model || "")).toLowerCase();
          const category = (window.productDisplayCategory ? window.productDisplayCategory(p) : (p.category || "")).toLowerCase();
          return name.includes(ql) || category.includes(ql) || String(p.description || "").toLowerCase().includes(ql);
        })
        .slice(0, 4)
        .map((p) => ({
          type: t("common.product"),
          label: window.productDisplayName ? window.productDisplayName(p) : (p.name || p.model || t("common.product")),
          sub: `${window.productDisplayCategory ? window.productDisplayCategory(p) : (p.category || "Kategoriyasiz")} • ${fmtUZS(p.priceUzs)}`,
          icon: "box",
          to: "/products/" + p.id,
        }));
      if (prods.length) groups.push({ title: t("common.products"), items: prods });
      const debtors = data.orders.filter(o => o.id.toLowerCase().includes(ql) || o.customerName.toLowerCase().includes(ql)).slice(0, 3).map(o => ({ type: t("common.debtor"), label: o.customerName, sub: fmtUZS(o.remainingDebtUzs), icon: "wallet", to: "/debtors/" + o.id }));
      if (debtors.length) groups.push({ title: t("common.debtors"), items: debtors });
    }
    const actions = [
      { type: t("common.action"), label: t("qc.customer"), icon: "plus", to: "/customers" },
      { type: t("common.action"), label: t("qc.order"), icon: "wallet", to: "/debtors" },
      { type: t("common.action"), label: t("qc.task"), icon: "checkCircle", to: "/tasks" },
    ].filter(a => canAccess(role, a.to, data) && (!ql || a.label.toLowerCase().includes(ql)));
    if (actions.length && (ql || groups.length < 2)) groups.push({ title: t("common.actions"), items: actions.slice(0, 3) });
    return groups;
  }, [q, data, role]);

  const flat = results.flatMap(g => g.items);
  shE(() => { setIdx(0); }, [q]);

  const go = (item) => { nav(item.to); onClose(); };

  shE(() => {
    if (!open) return;
    const on = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, flat.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); if (flat[idx]) go(flat[idx]); }
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [open, flat, idx]);

  if (!open) return null;
  let runningIdx = -1;
  return (
    <div className="tg-overlay" style={{ alignItems: "flex-start", paddingTop: "12vh" }} onMouseDown={onClose}>
      <div className="tg-cmdk pop-in" onMouseDown={e => e.stopPropagation()}>
        <div className="tg-cmdk-input">
          <I.search size={19} style={{ color: "var(--text-3)" }} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t("common.searchAnything")} />
          <span className="tg-kbd">ESC</span>
        </div>
        <div className="tg-cmdk-results">
          {flat.length === 0 && <div className="tg-cmdk-empty">{t("common.noResults")}</div>}
          {results.map(g => (
            <div key={g.title} className="tg-cmdk-group">
              <div className="tg-cmdk-grouptitle">{g.title}</div>
              {g.items.map(item => {
                runningIdx++; const ci = runningIdx; const Ico = I[item.icon] || I.arrowRight;
                return (
                  <button key={ci} className="tg-cmdk-item" data-active={idx === ci ? "1" : undefined}
                    onMouseEnter={() => setIdx(ci)} onClick={() => go(item)}>
                    <Ico size={17} />
                    <span className="tg-cmdk-label">{item.label}</span>
                    {item.sub && <span className="tg-cmdk-sub">{item.sub}</span>}
                    <span className="tg-cmdk-type">{item.type}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Customize Panel ----------
const ACCENT_COLORS = [
  { key: "customize.color.emerald", value: "#10b981" },
  { key: "customize.color.blue",    value: "#3b82f6" },
  { key: "customize.color.violet",  value: "#6366f1" },
  { key: "customize.color.rose",    value: "#f43f5e" },
  { key: "customize.color.orange",  value: "#f97316" },
  { key: "customize.color.slate",   value: "#64748b" },
];

const DEFAULTS = { theme: "dark", accent: "#6366f1", density: "comfortable", layout: "sidebar", container: "fluid", direction: "ltr", lang: "uz" };

function CustomizePanel({ onClose }) {
  const { t, accent, setAccent, density, setDensity, layout, setLayout, container, setContainer, direction, setDirection, lang, setLang } = useApp();
  const ref = shR(null);

  // draft — tiles mutate this only; nothing touches app state until Apply
  const [draft, setDraft] = shS({ accent, density, container });
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  // snapshot of app state at panel-open time
  const snap = shR({ accent, density, container });
  const changed = draft.accent !== snap.current.accent ||
                  draft.density !== snap.current.density || draft.container !== snap.current.container;

  shE(() => {
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", on), 0);
    return () => document.removeEventListener("mousedown", on);
  }, []);

  shE(() => {
    const on = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);

  const applyDraft = () => {
    setAccent(draft.accent);
    setDensity(draft.density);
    setContainer(draft.container);
    onClose();
  };

  const resetDefaults = () => {
    setDraft({ accent: DEFAULTS.accent, density: DEFAULTS.density, container: DEFAULTS.container });
  };

  function Section({ label, children }) {
    return <div className="tg-cust-section"><div className="tg-cust-label">{label}</div><div className="tg-cust-row">{children}</div></div>;
  }

  function Tile({ icon, label, active, onClick, wide }) {
    return (
      <button className={"tg-cust-tile" + (active ? " active" : "") + (wide ? " wide" : "")} onClick={onClick}>
        {icon && <span className="tg-cust-tile-icon">{icon}</span>}
        <span className="tg-cust-tile-label">{label}</span>
      </button>
    );
  }

  return ReactDOM.createPortal(
    <div className="tg-cust-panel pop-in" ref={ref}>
        <div className="tg-cust-head">
          <div>
            <div className="tg-cust-title">{t("customize.title")}</div>
            <div className="tg-cust-sub">{t("customize.subtitle")}</div>
          </div>
          <button className="tg-cust-close" onClick={onClose}><I.x size={18} /></button>
        </div>

        <div className="tg-cust-body">
          <Section label={t("customize.section.color")}>
            {ACCENT_COLORS.map(c => (
              <button key={c.value} className={"tg-cust-color" + (draft.accent === c.value ? " active" : "")} onClick={() => set("accent", c.value)} title={t(c.key)}>
                <span className="tg-cust-color-dot" style={{ background: c.value }} />
                <span className="tg-cust-color-name">{t(c.key)}</span>
              </button>
            ))}
          </Section>

          <Section label={t("customize.section.density")}>
            <Tile icon={<I.list size={20} />}   label={t("customize.density.compact")}     active={draft.density === "compact"}     onClick={() => set("density", "compact")} />
            <Tile icon={<I.menu size={20} />}   label={t("customize.density.comfortable")} active={draft.density === "comfortable"} onClick={() => set("density", "comfortable")} />
            <Tile icon={<I.layers size={20} />} label={t("customize.density.spacious")}    active={draft.density === "spacious"}    onClick={() => set("density", "spacious")} />
          </Section>

          <Section label={t("customize.section.container")}>
            <Tile wide icon={<I.external size={20} />} label={t("customize.container.fluid")} active={draft.container === "fluid"} onClick={() => set("container", "fluid")} />
            <Tile wide icon={<I.grid size={20} />}     label={t("customize.container.boxed")} active={draft.container === "boxed"} onClick={() => set("container", "boxed")} />
          </Section>
        </div>

        <div className="tg-cust-foot" style={{ display: "flex", gap: 10 }}>
          <button className="tg-cust-reset" style={{ flex: 1 }} onClick={resetDefaults}>{t("customize.reset")}</button>
          <button
            className="tg-cust-reset"
            disabled={!changed}
            onClick={applyDraft}
            style={{
              flex: 1,
              background: changed ? "var(--accent)" : undefined,
              color: changed ? "#fff" : undefined,
              borderColor: changed ? "var(--accent)" : undefined,
              opacity: changed ? 1 : 0.4,
              cursor: changed ? "pointer" : "not-allowed",
              fontWeight: changed ? 700 : undefined,
              transition: "all .2s",
            }}>
            {t("common.apply")}
          </button>
        </div>
      </div>
    ,
    document.body
  );
}

// ---------- Toasts ----------
function Toasts() {
  const { toasts, dismissToast } = useApp();
  const iconFor = { success: { i: "checkCircle", c: "green" }, error: { i: "alert", c: "red" }, info: { i: "info", c: "blue" } };
  return (
    <div className="tg-toasts">
      {toasts.map(tt => {
        const cfg = iconFor[tt.kind] || iconFor.success; const Ico = I[cfg.i];
        return (
          <div key={tt.id} className="tg-toast" onClick={() => dismissToast(tt.id)}>
            <span className="tg-toast-icon" style={{ color: `var(--${cfg.c})`, background: `var(--${cfg.c}-bg)` }}><Ico size={16} /></span>
            <span className="tg-toast-msg">{tt.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Login ----------
// ---------- Login: "Quyosh sizning qo'lingizda" (the sun follows your hand) ----------
// The form is plain DOM and usable instantly. Behind it a floating hex island with a honeycomb of solar
// trackers hovers in the void; the sun follows the pointer and every panel turns to face it. On capable
// devices this is a lazily imported three.js scene (src/login-scene.js); the SVG version of the same art
// (SunArt below) covers no-WebGL, weak devices, low FPS and slow loads. Everything in the scene layer is
// aria-hidden.
const { useLayoutEffect: shLE, useCallback: shCB } = React;
const LOGIN_STACK_MQ = "(max-width: 959px), (max-height: 619px)";
const LOGIN_MOBILE_MQ = "(max-width: 767px)";
const LOGIN_REDUCED_MQ = "(prefers-reduced-motion: reduce)";
const LOGIN_TOUCH_MQ = "(hover: none) and (pointer: coarse)";
const LOGIN_HEX_D = 1.08, LOGIN_PIVOT = 0.66, LOGIN_SUN_R = 0.95, LOGIN_SUN_Z = 2.6;
const lgClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lgDamp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

function useLoginMedia(query) {
  const get = () => !!(window.matchMedia && window.matchMedia(query).matches);
  const [match, setMatch] = shS(get);
  shE(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on));
  }, [query]);
  return match;
}

function useDocTheme() {
  const read = () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  const [theme, setTheme] = shS(read);
  shE(() => {
    const mo = new MutationObserver(() => setTheme(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    setTheme(read());
    return () => mo.disconnect();
  }, []);
  return theme;
}

// WebGL2 present and the device is not obviously weak (few cores, little memory, software GL).
function loginCan3D() {
  try {
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || "");
    const lose = gl.getExtension("WEBGL_lose_context");
    lose && lose.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch { return false; }
}

// Where the island should sit (stage pixels) and how wide it should be. Shared by the 3D and SVG scenes.
function loginIslandSpot(sw, sh, card, stacked) {
  if (stacked) {
    const size = Math.min(sw * 0.6, sh * 0.78, 420);
    return { x: sw / 2, y: sh * 0.66, size };
  }
  const right = card ? card.left : sw * 0.62;
  const size = lgClamp(Math.min(right * 0.78, sh * 0.62), 280, 800);
  return { x: right * 0.53, y: sh * 0.625, size };
}

// Honeycomb cells (same layout as the 3D scene): axial coordinates, centre = tower, one cell = transformer.
function loginCells(rings) {
  const out = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
      if ((q === 0 && r === 0) || (q === -1 && r === 1)) continue;
      out.push({ x: LOGIN_HEX_D * (q + r / 2), z: LOGIN_HEX_D * (r * Math.sqrt(3) / 2) });
    }
  }
  return out;
}

// Panel orientation that faces a target point (world units), within tracker limits.
function loginPanelAim(p, tx, ty, tz, mode) {
  let dx = tx - p.x, dy = ty - LOGIN_PIVOT, dz = tz - p.z;
  const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  let roll = Math.atan2(-dx, Math.max(0.05, dy));
  let pitch = Math.atan2(dz, Math.max(0.05, Math.hypot(dx, dy)));
  if (mode === "droop") { roll = -roll * 0.7 + (p.x > 0 ? 0.9 : -0.9); pitch = -0.55; }
  return [lgClamp(roll, -1.12, 1.12), lgClamp(pitch, -0.6, 0.85)];
}

// Pseudo-3D projection for the SVG version (orthographic, camera ~30° above the horizon).
function sunArtModel(w, h, spot, lite) {
  const rings = lite ? 2 : 3;
  const RW = (rings * LOGIN_HEX_D + 0.62) / 0.866 + 0.28;
  const u = spot.size / (2 * (RW + 0.3));
  const cx = spot.x, cy = spot.y, KY = 0.5, KH = 0.86;
  const P = (x, y, z) => [cx + x * u, cy + z * u * KY - y * u * KH];
  const pts = (arr) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const ring = (r, y, rot = 0) => Array.from({ length: 6 }, (_, k) => { const a = rot + (k * Math.PI) / 3; return P(Math.cos(a) * r, y, Math.sin(a) * r); });
  const top = ring(RW, 0), lip = ring(RW + 0.12, -0.58);
  // front side faces (edge midpoints facing the camera: 30°, 90°, 150°)
  const sides = [0, 1, 2].map((k) => pts([top[k], top[k + 1], lip[k + 1], lip[k]]));
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const mid = Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3 + (rnd() - 0.5) * 0.3; const r = RW * (0.55 + rnd() * 0.12); return P(Math.cos(a) * r, -2.1 - rnd() * 0.5, Math.sin(a) * r); });
  const tip = P(0.2, -4.5, 0.4);
  const rock = [];
  for (let k = 0; k <= 3; k++) {
    const a = k % 6, b = (k + 1) % 6;
    if (k < 3) rock.push({ d: pts([lip[a], lip[b], mid[b], mid[a]]), s: k });
    rock.push({ d: pts([mid[a], mid[b], tip]), s: k + 3 });
  }
  const veinsRock = [0.15, 0.45, 0.75, 0.32, 0.62].map((f, i) => {
    const a = Math.PI * (0.12 + f * 0.76);
    let x = Math.cos(a) * RW, z = Math.sin(a) * RW, y = -0.6;
    let d = `M${P(x, y, z).map((v) => v.toFixed(1)).join(" ")}`;
    for (let s = 0; s < 5; s++) { x *= 0.78; z *= 0.78; y -= 0.65 + rnd() * 0.25; x += (rnd() - 0.5) * 0.5; d += ` L${P(x, y, z).map((v) => v.toFixed(1)).join(" ")}`; }
    return { d, i };
  });
  const cells = loginCells(rings);
  const panels = cells.map((c, i) => {
    const [bx, by] = P(c.x, 0, c.z), [px, py] = P(c.x, LOGIN_PIVOT, c.z);
    return { i, x: c.x, z: c.z, bx, by, px, py, ord: Math.hypot(c.x, c.z) };
  }).sort((a, b) => a.z - b.z || a.x - b.x);
  const ords = panels.slice().sort((a, b) => a.ord - b.ord);
  ords.forEach((p, k) => { p.k = k; });
  const PR = 0.455 * u;
  const hexLocal = (r) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 6 + (k * Math.PI) / 3; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const [tx, ty] = P(0, 0, 0), [ttx, tty] = P(0, 2.88, 0);
  const tr = P(-0.54, 0, 0.935);
  return {
    u, cx, cy, P, KY, KH, RW, top: pts(top), topPts: top, sides, rock, veinsRock, panels,
    plate: pts(hexLocal(PR)), frame: pts(hexLocal(0.5 * u)), PR,
    tower: { x: tx, y: ty, top: tty, topX: ttx }, transformer: { x: tr[0], y: tr[1] },
    sunR: LOGIN_SUN_R * u, vb: `0 0 ${Math.round(w)} ${Math.round(h)}`,
  };
}

function SunArt({ size, spot, anchor, lite, svgRef }) {
  const w = Math.max(1, size.w), h = Math.max(1, size.h);
  const m = shM(() => sunArtModel(w, h, spot, lite), [w, h, spot.x, spot.y, spot.size, lite]);
  const id = lite ? "tgsal" : "tgsa";
  const stars = shM(() => {
    let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    return Array.from({ length: lite ? 24 : 70 }, () => [r() * w, r() * h * 0.8, 0.5 + r() * 1.1, r() * 4]);
  }, [w, h, lite]);
  const dust = shM(() => {
    let s = 9; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    return Array.from({ length: lite ? 14 : 34 }, () => [m.cx + (r() - 0.5) * m.u * 16, m.cy - r() * m.u * 7, 0.8 + r() * 1.6, r() * 6, 5 + r() * 6]);
  }, [m, lite]);
  const tt = m.tower, r = m.sunR;
  const ribbon = anchor ? (() => {
    const x0 = tt.topX, y0 = tt.top, x1 = anchor.x, y1 = anchor.y, lift = Math.min(y0, y1) - m.u * 1.6;
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} C ${(x0 + (x1 - x0) * 0.2).toFixed(1)} ${lift.toFixed(1)}, ${(x0 + (x1 - x0) * 0.7).toFixed(1)} ${lift.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  })() : null;
  return (
    <svg ref={svgRef} className="tg-sa" viewBox={m.vb} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sa-top)" }} /><stop offset=".55" style={{ stopColor: "var(--sa-mid)" }} /><stop offset="1" style={{ stopColor: "var(--sa-low)" }} />
        </linearGradient>
        <radialGradient id={`${id}-core`}>
          <stop offset="0" style={{ stopColor: "var(--sa-sun-core)" }} /><stop offset=".55" style={{ stopColor: "var(--sa-sun-mid)" }} /><stop offset="1" style={{ stopColor: "var(--sa-sun-edge)" }} />
        </radialGradient>
        <radialGradient id={`${id}-corona`}>
          <stop offset="0" style={{ stopColor: "var(--sa-sun-mid)", stopOpacity: 0.9 }} /><stop offset=".22" style={{ stopColor: "var(--sa-sun-edge)", stopOpacity: 0.45 }} />
          <stop offset=".5" style={{ stopColor: "var(--sa-sun-edge)", stopOpacity: 0.12 }} /><stop offset="1" style={{ stopColor: "var(--sa-sun-edge)", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id={`${id}-ray`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--sa-sun-mid)", stopOpacity: 0.55 }} /><stop offset="1" style={{ stopColor: "var(--sa-sun-mid)", stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sa-top-a)" }} /><stop offset="1" style={{ stopColor: "var(--sa-top-b)" }} />
        </linearGradient>
        <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sa-rock-a)" }} /><stop offset="1" style={{ stopColor: "var(--sa-rock-b)" }} />
        </linearGradient>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sa-plate-a)" }} /><stop offset="1" style={{ stopColor: "var(--sa-plate-b)" }} />
        </linearGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={lite ? 2 : 3.2} /></filter>
        <filter id={`${id}-soft`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={lite ? 14 : 34} /></filter>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-sky)`} />
      <g className="tg-sa-nebula" filter={`url(#${id}-soft)`}>
        <ellipse cx={w * 0.22} cy={h * 0.3} rx={w * 0.2} ry={h * 0.16} /><ellipse cx={w * 0.78} cy={h * 0.18} rx={w * 0.16} ry={h * 0.12} />
      </g>
      <g className="tg-sa-stars">{stars.map(([x, y, rr, d], i) => <circle key={i} cx={x} cy={y} r={rr} style={{ animationDelay: `${d}s` }} />)}</g>

      {/* the sun (moved by JS) */}
      <g className="tg-sa-sun" data-sun="1" transform={`translate(${w * 0.62} ${h * 0.2})`}>
        <g className="tg-sa-sunbody">
          <circle r={r * 7} fill={`url(#${id}-corona)`} className="tg-sa-corona" />
          <g className="tg-sa-rays">{Array.from({ length: 12 }, (_, k) => (
            <path key={k} d={`M0 ${-r * 0.16} L${r * (k % 2 ? 5.2 : 7.6)} 0 L0 ${r * 0.16} Z`} fill={`url(#${id}-ray)`} transform={`rotate(${k * 30 + (k % 3) * 7})`} />
          ))}</g>
          <circle r={r * 1.35} className="tg-sa-halo" filter={`url(#${id}-glow)`} />
          <circle r={r} fill={`url(#${id}-core)`} />
          <g className="tg-sa-plasma">
            <circle r={r * 0.72} strokeDasharray={`${r * 0.3} ${r * 0.45}`} /><circle r={r * 0.46} strokeDasharray={`${r * 0.2} ${r * 0.34}`} />
          </g>
          <circle className="tg-sa-moon" r={r * 1.04} />
          <g className="tg-sa-cloud" filter={`url(#${id}-glow)`}>
            {[[-1.4, 0.2, 1.3], [-0.3, -0.35, 1.7], [0.9, 0, 1.45], [1.8, 0.35, 1.0], [0.1, 0.5, 1.9]].map(([dx, dy, rr], i) => (
              <ellipse key={i} cx={dx * r} cy={dy * r} rx={rr * r * 1.1} ry={rr * r * 0.72} />
            ))}
          </g>
          <path className="tg-sa-bolt" d={`M${-0.2 * r} ${0.7 * r} L${0.15 * r} ${1.35 * r} L${-0.15 * r} ${1.45 * r} L${0.25 * r} ${2.25 * r}`} />
        </g>
        <circle className="tg-sa-shock" r={r * 2} />
      </g>

      {/* beams of light sun → panels (endpoints updated by JS) */}
      <g className="tg-sa-beams">{[0, 1, 2, 3].map((k) => <line key={k} data-beam={k} x1="0" y1="0" x2="0" y2="0" />)}</g>

      <g className="tg-sa-island" data-island="1">
        <g className="tg-sa-islandin">
          {m.rock.map((f) => <polygon key={f.s} points={f.d} fill={`url(#${id}-rock)`} className={`tg-sa-rock tg-sa-rock-${f.s}`} />)}
          {m.veinsRock.map((v) => <path key={v.i} d={v.d} className="tg-sa-vein-rock" style={{ animationDelay: `${v.i * -0.7}s` }} />)}
          {m.sides.map((d, k) => <polygon key={k} points={d} className={`tg-sa-side tg-sa-side-${k}`} />)}
          <polygon points={m.top} fill={`url(#${id}-top)`} className="tg-sa-top" />
          <polygon points={m.top} className="tg-sa-rim-glow" filter={`url(#${id}-glow)`} />
          <polygon points={m.top} className="tg-sa-rim" />
          <g className="tg-sa-veins">{m.panels.map((p) => <line key={p.i} data-vein={p.i} x1={p.bx} y1={p.by} x2={m.tower.x} y2={m.tower.y} style={{ animationDelay: `${(p.i * 0.37) % 2}s` }} />)}</g>
          <g className="tg-sa-shadows">{m.panels.map((p) => <ellipse key={p.i} data-shadow={p.i} cx={p.bx} cy={p.by} rx={m.PR * 0.95} ry={m.PR * 0.42} />)}</g>
          <g className="tg-sa-transformer" transform={`translate(${m.transformer.x} ${m.transformer.y})`}>
            <rect x={-m.u * 0.3} y={-m.u * 0.42} width={m.u * 0.6} height={m.u * 0.42} rx={m.u * 0.06} />
            <rect className="tg-sa-led" x={-m.u * 0.2} y={-m.u * 0.3} width={m.u * 0.4} height={Math.max(1.5, m.u * 0.04)} />
          </g>
          {m.panels.map((p) => (
            <React.Fragment key={p.i}>
              <g className="tg-sa-panel">
                <line className="tg-sa-pole" x1={p.bx} y1={p.by} x2={p.px} y2={p.py} />
                <g data-panel={p.i} transform={`translate(${p.px} ${p.py})`}>
                  <g className="tg-sa-unfold" style={{ "--k": p.k }}>
                    <polygon points={m.frame} className="tg-sa-frame" />
                    <polygon points={m.plate} fill={`url(#${id}-plate)`} />
                    <path className="tg-sa-cells" d={`M${-0.2 * m.u} ${-0.33 * m.u}V${0.33 * m.u}M0 ${-0.42 * m.u}V${0.42 * m.u}M${0.2 * m.u} ${-0.33 * m.u}V${0.33 * m.u}M${-0.37 * m.u} ${-0.15 * m.u}H${0.37 * m.u}M${-0.37 * m.u} ${0.15 * m.u}H${0.37 * m.u}`} />
                    <polygon points={m.plate} className="tg-sa-glow" data-glow={p.i} />
                  </g>
                </g>
              </g>
              {p.z < 0.1 && p.z > -0.1 && p.x < 0 && p.x > -1.2 ? (
                <g className="tg-sa-tower">
                  <path d={`M${tt.x - m.u * 0.2} ${tt.y} L${tt.topX - m.u * 0.07} ${tt.top} L${tt.topX + m.u * 0.07} ${tt.top} L${tt.x + m.u * 0.2} ${tt.y} Z`} />
                  {[0.25, 0.47, 0.69].map((f, k) => <ellipse key={k} className="tg-sa-tower-ring" cx={tt.x} cy={tt.y + (tt.top - tt.y) * f} rx={m.u * (0.26 - k * 0.04)} ry={m.u * (0.1 - k * 0.015)} />)}
                  <circle className="tg-sa-tower-glow" cx={tt.topX} cy={tt.top} r={m.u * 0.55} filter={`url(#${id}-glow)`} />
                  <circle className="tg-sa-tower-orb" cx={tt.topX} cy={tt.top} r={m.u * 0.2} />
                </g>
              ) : null}
            </React.Fragment>
          ))}
        </g>
      </g>

      {ribbon && <>
        <path className="tg-sa-ribbon-glow" d={ribbon} />
        <path className="tg-sa-ribbon" d={ribbon} />
        <circle className="tg-sa-ribbon-pulse" r={lite ? 2.5 : 4}><animateMotion dur="2.2s" repeatCount="indefinite" path={ribbon} /></circle>
      </>}
      <g className="tg-sa-dust">{dust.map(([x, y, rr, d, dur], i) => <circle key={i} cx={x} cy={y} r={rr} style={{ animationDelay: `${-d}s`, animationDuration: `${dur}s` }} />)}</g>
    </svg>
  );
}

// Hex chip that flips to a short description (hover / tap / Enter / Space).
function LoginTile({ big, label, back, index, pos }) {
  const [flip, setFlip] = shS(false);
  const style = { "--i": index };
  if (pos) { style["--tx"] = `${pos.x.toFixed(1)}px`; style["--ty"] = `${pos.y.toFixed(1)}px`; }
  return (
    <button type="button" className="tg-login-tile" data-flip={flip ? "1" : "0"} aria-pressed={flip} onClick={() => setFlip((v) => !v)} style={style}>
      <span className="tg-login-tile-in">
        <span className="tg-login-tile-face tg-login-tile-front"><strong>{big}</strong><span>{label}</span></span>
        <span className="tg-login-tile-face tg-login-tile-back"><span>{back}</span></span>
      </span>
    </button>
  );
}

// After a successful login App swaps Login for the dashboard immediately. To finish the supernova
// without slowing anything down, the last frame of the page (and the live canvas) moves into a fixed
// overlay: the sun flares white, a shockwave runs through the island and the card, then it dissolves
// (≤1.5 s, removed from the DOM).
function runLoginAfterglow(root, scene, reduced) {
  const clone = root.cloneNode(true);
  clone.classList.add("tg-login-afterglow");
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");
  clone.setAttribute("data-phase", "success");
  clone.removeAttribute("data-gloom");
  clone.removeAttribute("data-pw");
  clone.querySelectorAll("input").forEach((inp) => {
    if (inp.type === "password" || inp.dataset.secret) { const mask = "*".repeat(inp.value.length); inp.setAttribute("value", mask); inp.value = mask; inp.type = "password"; }
    inp.removeAttribute("autocomplete"); inp.removeAttribute("name"); inp.removeAttribute("id"); inp.tabIndex = -1;
  });
  clone.querySelectorAll("button").forEach((b) => { b.tabIndex = -1; });
  const pct = clone.querySelector(".tg-login-meter-pct");
  if (pct) pct.textContent = "100%";
  const stage = clone.querySelector(".tg-login-stage");
  if (stage) stage.replaceChildren();
  document.body.appendChild(clone);
  if (scene) { if (stage && scene.adopt) scene.adopt(stage); scene.success(); }
  setTimeout(() => clone.classList.add("is-leaving"), reduced ? 250 : 880);
  setTimeout(() => { if (scene) scene.dispose(); clone.remove(); }, reduced ? 650 : 1380);
}

function Login() {
  const { login, dataLoading, t } = useApp();
  const [username, setUsername] = shS("");
  const [pw, setPw] = shS("");
  const [showPw, setShowPw] = shS(false);
  const [error, setError] = shS("");
  const [phase, setPhase] = shS("idle"); // idle | submitting | error
  const [gloom, setGloom] = shS(false);
  const [pwFocus, setPwFocus] = shS(false);
  const [can3d] = shS(loginCan3D);
  const [mode, setMode] = shS(() => (can3d ? "pending" : "svg")); // pending | 3d | svg
  const [skipIntro, setSkipIntro] = shS(false);
  const [sunlit, setSunlit] = shS(0);
  const [geo, setGeo] = shS({ w: window.innerWidth, h: window.innerHeight, spot: { x: window.innerWidth * 0.35, y: window.innerHeight * 0.66, size: 520 }, anchor: null });
  const stacked = useLoginMedia(LOGIN_STACK_MQ);
  const isMobile = useLoginMedia(LOGIN_MOBILE_MQ);
  const reduced = useLoginMedia(LOGIN_REDUCED_MQ);
  const touch = useLoginMedia(LOGIN_TOUCH_MQ);
  const theme = useDocTheme();
  const rootRef = shR(null), stageRef = shR(null), cardRef = shR(null), cardWrapRef = shR(null), ringRef = shR(null), fxRef = shR(null);
  const svgRef = shR(null), sceneRef = shR(null), phaseRef = shR("idle"), mountedRef = shR(true);
  const handedOffRef = shR(false), reducedRef = shR(reduced), timersRef = shR([]), moodRef = shR({ eclipse: 0 });
  const geoRef = shR(geo), rectsRef = shR({ stage: null, card: null }), pointerRef = shR(null), sunlitRef = shR({ v: 0, t: 0 });
  const gloomRef = shR(false);
  reducedRef.current = reduced;
  geoRef.current = geo;
  gloomRef.current = gloom;

  const later = (fn, ms) => { const id = setTimeout(fn, ms); timersRef.current.push(id); };
  shE(() => () => { mountedRef.current = false; timersRef.current.forEach(clearTimeout); }, []);

  // ----- measure: stage size, island spot, where the energy ribbon plugs into the card -----
  const measure = shCB(() => {
    const stage = stageRef.current, card = cardRef.current;
    if (!stage) return;
    const s = stage.getBoundingClientRect();
    const c = card ? card.getBoundingClientRect() : null;
    rectsRef.current = { stage: s, card: c };
    const stackedNow = window.matchMedia ? window.matchMedia(LOGIN_STACK_MQ).matches : false;
    const cardInStage = c ? { left: c.left - s.left, top: c.top - s.top, width: c.width, height: c.height } : null;
    const spot = loginIslandSpot(s.width, s.height, cardInStage, stackedNow);
    let anchor = null;
    if (cardInStage) {
      anchor = stackedNow
        ? { x: Math.min(s.width - 4, cardInStage.left + cardInStage.width / 2), y: Math.min(s.height + 40, cardInStage.top + 6) }
        : { x: cardInStage.left + 4, y: cardInStage.top + cardInStage.height * 0.42 };
    }
    const next = { w: s.width, h: s.height, spot, anchor };
    const prev = geoRef.current;
    const same = prev && Math.abs(prev.w - next.w) < 1 && Math.abs(prev.h - next.h) < 1 && Math.abs(prev.spot.x - spot.x) < 1 && Math.abs(prev.spot.y - spot.y) < 1 && Math.abs(prev.spot.size - spot.size) < 1
      && ((!prev.anchor && !anchor) || (prev.anchor && anchor && Math.abs(prev.anchor.x - anchor.x) < 1 && Math.abs(prev.anchor.y - anchor.y) < 1));
    if (!same) { geoRef.current = next; setGeo(next); sceneRef.current && sceneRef.current.refreshAnchor(); }
  }, []);
  shLE(() => {
    measure();
    const ro = new ResizeObserver(measure);
    rootRef.current && ro.observe(rootRef.current);
    cardRef.current && ro.observe(cardRef.current);
    stageRef.current && ro.observe(stageRef.current);
    const onWin = () => measure();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener("resize", onWin); window.removeEventListener("scroll", onWin); };
  }, [measure, stacked, isMobile]);
  shE(() => { measure(); }, [error, measure]);

  const flashRing = shCB(() => {
    const ring = ringRef.current;
    if (!ring || !ring.animate || reducedRef.current) return;
    ring.animate([{ filter: "brightness(2.2) saturate(1.3)" }, { filter: "brightness(1)" }], { duration: 650, easing: "ease-out" });
  }, []);

  // ----- the sun's screen position drives the card: specular highlight, tilt (≤4°), gold edge, charge -----
  const onSun = shCB((sx, sy, sr, vis) => {
    const card = cardRef.current, rects = rectsRef.current;
    if (!card || !rects.stage || !rects.card) return;
    const x = rects.stage.left + sx, y = rects.stage.top + sy, c = rects.card;
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2, dx = x - cx, dy = y - cy;
    const vw = window.innerWidth, vh = window.innerHeight;
    card.style.setProperty("--spec-x", `${(lgClamp((x - c.left) / c.width, -0.25, 1.25) * 100).toFixed(1)}%`);
    card.style.setProperty("--spec-y", `${(lgClamp((y - c.top) / c.height, -0.25, 1.25) * 100).toFixed(1)}%`);
    if (!reducedRef.current && !isMobileRef.current) {
      card.style.setProperty("--tilt-y", `${(lgClamp(dx / (vw * 0.5), -1, 1) * 4).toFixed(2)}deg`);
      card.style.setProperty("--tilt-x", `${(lgClamp(-dy / (vh * 0.6), -1, 1) * 3.2).toFixed(2)}deg`);
    }
    card.style.setProperty("--edge-a", `${((Math.atan2(dy, dx) * 180) / Math.PI + 90).toFixed(1)}deg`);
    const lit = lgClamp(1 - Math.hypot(dx, dy) / (Math.max(vw, 600) * 0.7), 0, 1) * lgClamp(vis, 0, 1);
    card.style.setProperty("--sunlit", lit.toFixed(3));
    const fxEl = fxRef.current;
    if (fxEl) { fxEl.style.setProperty("--sun-x", `${x.toFixed(1)}px`); fxEl.style.setProperty("--sun-y", `${y.toFixed(1)}px`); fxEl.style.setProperty("--sun-r", `${Math.max(8, sr).toFixed(1)}px`); }
    const now = performance.now(), q = Math.round(lit * 20) / 20, st = sunlitRef.current;
    if (q !== st.v && now - st.t > 140 && mountedRef.current) { st.v = q; st.t = now; setSunlit(q); }
  }, []);
  const isMobileRef = shR(isMobile);
  isMobileRef.current = isMobile;

  // ----- pointer: the sun follows the mouse anywhere; on touch, a drag on the scene area only -----
  shE(() => {
    const isUi = (el) => !!(el && el.closest && el.closest("input, button, a, label, .tg-login-cardwrap, .tg-login-tiles"));
    let drag = false;
    const feed = (e) => {
      const touchPtr = e.pointerType === "touch";
      pointerRef.current = { x: e.clientX, y: e.clientY, t: performance.now(), touch: touchPtr };
      sceneRef.current && sceneRef.current.setPointer(e.clientX, e.clientY, touchPtr);
    };
    const inStage = (e) => {
      const s = rectsRef.current.stage;
      return !!s && e.clientX >= s.left && e.clientX <= s.right && e.clientY >= s.top && e.clientY <= s.bottom;
    };
    const onMove = (e) => {
      if (e.pointerType === "touch") { if (drag) feed(e); return; }
      feed(e);
    };
    const onDown = (e) => { if (e.pointerType === "touch" && inStage(e) && !isUi(e.target)) { drag = true; feed(e); } };
    const onUp = () => { drag = false; };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // ----- lazy 3D scene (capable GPU). Starts after the form is on screen. -----
  shE(() => {
    if (!can3d) return undefined;
    let cancelled = false, api = null, idle = 0;
    const fallback = setTimeout(() => { if (!cancelled && !api) setMode((m) => (m === "pending" ? "svg" : m)); }, 1800);
    const kick = () => {
      if (cancelled) return;
      import("/src/login-scene.js").then((mod) => {
        if (cancelled || !stageRef.current) return;
        try {
          api = mod.createSunScene(stageRef.current, {
            theme: document.documentElement.getAttribute("data-theme"),
            still: reducedRef.current,
            lite: isMobile,
            getIslandSpot: () => geoRef.current.spot,
            getAnchor: () => geoRef.current.anchor,
            onArrive: flashRing,
            onSun,
            onLowFps: () => {
              if (cancelled || handedOffRef.current) return;
              if (sceneRef.current === api) sceneRef.current = null;
              api.dispose(); api = null;
              setMode("svg");
            },
          });
        } catch { api = null; setMode("svg"); return; }
        sceneRef.current = api;
        if (rootRef.current) rootRef.current.__loginScene = api;
        api.setMood(moodRef.current);
        if (pointerRef.current) api.setPointer(pointerRef.current.x, pointerRef.current.y, pointerRef.current.touch);
        if (skipRef.current) api.skipIntro();
        if (gloomRef.current) api.error();
        // reveal on the next frame so the canvas has drawn once
        requestAnimationFrame(() => { if (!cancelled) setMode("3d"); });
      }).catch(() => { if (!cancelled) setMode("svg"); });
    };
    idle = window.requestIdleCallback ? window.requestIdleCallback(kick, { timeout: 200 }) : setTimeout(kick, 30);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      window.cancelIdleCallback ? window.cancelIdleCallback(idle) : clearTimeout(idle);
      if (sceneRef.current === api) sceneRef.current = null;
      if (api && !handedOffRef.current) api.dispose();
      if (rootRef.current && rootRef.current.__loginScene === api) rootRef.current.__loginScene = null;
      setMode(can3d ? "pending" : "svg");
    };
  }, [can3d, isMobile, reduced, flashRing, onSun]);

  shE(() => { sceneRef.current && sceneRef.current.setTheme(theme); }, [theme, mode]);

  // Password focus: an eclipse — a dark moon slides over the sun, the world turns cool blue-violet.
  shE(() => {
    moodRef.current = { eclipse: pwFocus ? 1 : 0 };
    sceneRef.current && sceneRef.current.setMood(moodRef.current);
  }, [pwFocus, mode]);

  // ----- SVG version: the same art, driven by a small rAF loop (sun spring + trackers) -----
  shE(() => {
    if (mode !== "svg") return undefined;
    const svg = svgRef.current;
    if (!svg) return undefined;
    const m = sunArtModel(geo.w, geo.h, geo.spot, isMobile);
    const sunEl = svg.querySelector("[data-sun]");
    const islandEl = svg.querySelector("[data-island]");
    const heads = m.panels.map((p) => svg.querySelector(`[data-panel="${p.i}"]`));
    const glows = m.panels.map((p) => svg.querySelector(`[data-glow="${p.i}"]`));
    const shadows = m.panels.map((p) => svg.querySelector(`[data-shadow="${p.i}"]`));
    const veins = m.panels.map((p) => svg.querySelector(`[data-vein="${p.i}"]`));
    const beams = [0, 1, 2, 3].map((k) => svg.querySelector(`[data-beam="${k}"]`));
    const st = m.panels.map((p) => ({ roll: (p.i % 2 ? 1 : -1) * 1.1, rv: 0, pitch: -0.5, pv: 0, sx: 0, sy: 3, sz: -1.5, init: false }));
    const sun = { x: geo.w * 0.6, y: geo.h * 0.22, vx: 0, vy: 0 };
    const t0 = performance.now();
    let raf = 0, last = 0, beamPick = 0, beamT = 0;
    const still = reducedRef.current;
    const idleSun = (t) => {
      const a = Math.PI * 0.5 + Math.sin(t * 0.21) * 0.85, z = geo.spot.size, x0 = geo.spot.x, wide = x0 / geo.w < 0.45;
      const lo = wide ? x0 - z * 0.05 : x0 - z * 0.6, hi = wide ? x0 + z * 0.68 : x0 + z * 0.6;
      return { x: (lo + hi) / 2 + Math.cos(a) * (hi - lo) / 2 / Math.sin(0.85) * 0.75, y: Math.max(m.sunR + 12, geo.spot.y - z * (0.42 + 0.3 * Math.sin(a))) };
    };
    const tick = (now) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      const p = pointerRef.current, s = rectsRef.current.stage;
      const idle = !p || (p.touch && now - p.t > 4000) || still;
      let target = idle ? idleSun(still ? 0.9 : t) : { x: p.x - (s ? s.left : 0), y: p.y - (s ? s.top : 0) };
      // keep the sun above the island and within reach
      const maxY = m.cy + LOGIN_SUN_Z * m.u * m.KY - 2.3 * m.u * m.KH;
      target = { x: lgClamp(target.x, m.cx - m.u * m.RW * 2.6, m.cx + m.u * m.RW * 2.6), y: Math.min(target.y, maxY) };
      if (still || !last) { sun.x = target.x; sun.y = target.y; }
      else {
        const k = idle ? 10 : 34, c = idle ? 6.5 : 9.5;
        sun.vx = (sun.vx + (target.x - sun.x) * k * dt) * Math.exp(-c * dt);
        sun.vy = (sun.vy + (target.y - sun.y) * k * dt) * Math.exp(-c * dt);
        sun.x += sun.vx * dt; sun.y += sun.vy * dt;
      }
      if (t < 0.02 && !still) { sun.x = target.x; sun.y = target.y; }
      sunEl.setAttribute("transform", `translate(${sun.x.toFixed(1)} ${sun.y.toFixed(1)})`);
      const bob = still ? 0 : Math.sin(t * 0.9) * m.u * 0.12;
      islandEl.setAttribute("transform", `translate(0 ${bob.toFixed(2)})`);
      // sun in island world units (on a plane 1.5 behind the island)
      const wz = LOGIN_SUN_Z, wx = (sun.x - m.cx) / m.u, wy = (m.cy + wz * m.u * m.KY - (sun.y - bob)) / (m.u * m.KH);
      const ph = rootRef.current ? rootRef.current.getAttribute("data-phase") : "idle";
      const succ = ph === "success", storm = gloomRef.current, ecl = moodRef.current.eclipse;
      const vis = (still ? 1 : lgClamp((t - 0.1) / 0.6, 0, 1)) * (1 - ecl * 0.85) * (storm ? 0.2 : 1);
      let best = [];
      m.panels.forEach((pp, j) => {
        const S = st[j];
        const tgt = succ ? { x: pp.x, y: 30, z: 52 } : { x: wx, y: wy, z: wz };
        if (!S.init || still) { S.sx = tgt.x; S.sy = tgt.y; S.sz = tgt.z; S.init = true; }
        const d = Math.hypot(pp.x - wx * 0.35, pp.z - wz * 0.35), rate = succ ? 30 : 18 / (1 + 1.1 * d);
        S.sx = lgDamp(S.sx, tgt.x, rate, dt); S.sy = lgDamp(S.sy, tgt.y, rate, dt); S.sz = lgDamp(S.sz, tgt.z, rate, dt);
        const unfoldAt = 0.72 + pp.k * (0.55 / m.panels.length);
        const [tr, tp] = !still && t < unfoldAt ? [(pp.i % 2 ? 1 : -1) * 1.1, -0.6] : loginPanelAim(pp, S.sx, S.sy, S.sz, storm ? "droop" : "track");
        if (still) { S.roll = tr; S.pitch = tp; }
        else {
          const k = succ ? 260 : storm ? 70 : 46, c = succ ? 22 : 6.2;
          S.rv = (S.rv + (tr - S.roll) * k * dt) * Math.exp(-c * dt); S.roll += S.rv * dt;
          S.pv = (S.pv + (tp - S.pitch) * k * dt) * Math.exp(-c * dt); S.pitch += S.pv * dt;
        }
        const ca = Math.cos(S.roll), sa = Math.sin(S.roll), cb = Math.cos(S.pitch), sb = Math.sin(S.pitch);
        const a = ca, b = -m.KH * sa, c2 = sb * sa, d2 = m.KY * cb + m.KH * sb * ca;
        heads[j].setAttribute("transform", `translate(${pp.px.toFixed(1)} ${pp.py.toFixed(1)}) matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c2.toFixed(4)} ${d2.toFixed(4)} 0 0)`);
        // facing → glow
        const nx = -sa * cb, ny = ca * cb, nz = sb;
        let lx = wx - pp.x, ly = wy - LOGIN_PIVOT, lz = wz - pp.z; const ll = Math.hypot(lx, ly, lz) || 1;
        const facing = (nx * lx + ny * ly + nz * lz) / ll;
        const g = (succ ? 1 : Math.max(0, Math.min(1, (facing - 0.55) / 0.43))) * vis;
        glows[j].style.opacity = (g * 0.55).toFixed(3);
        veins[j].style.opacity = (0.15 + g * 0.85).toFixed(3);
        shadows[j].setAttribute("cx", (pp.bx - lgClamp(lx / Math.max(0.6, ly), -2.4, 2.4) * m.u * 0.38).toFixed(1));
        shadows[j].setAttribute("rx", (m.PR * (0.95 * Math.abs(ca) + 0.25)).toFixed(1));
        best.push([g, j]);
      });
      // beams of light toward a few of the brightest panels
      if (now - beamT > 900) { beamT = now; beamPick++; }
      best.sort((x, y) => y[0] - x[0]);
      beams.forEach((ln, k) => {
        const pick = best[(k * 3 + beamPick) % Math.min(best.length, 12)];
        if (!pick || !ln) return;
        const pp = m.panels[pick[1]];
        ln.setAttribute("x1", sun.x.toFixed(1)); ln.setAttribute("y1", sun.y.toFixed(1));
        ln.setAttribute("x2", pp.px.toFixed(1)); ln.setAttribute("y2", (pp.py + bob).toFixed(1));
        ln.style.opacity = (pick[0] * (storm || ecl > 0.5 ? 0 : 0.55)).toFixed(3);
      });
      onSun(sun.x, sun.y, m.sunR, vis);
      if (!still) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf && !still) { last = 0; raf = requestAnimationFrame(tick); } };
    document.addEventListener("visibilitychange", onVis);
    // reduced motion: redraw the still frame when the mood changes
    const mo = still ? new MutationObserver(() => requestAnimationFrame(tick)) : null;
    if (mo && rootRef.current) mo.observe(rootRef.current, { attributes: true, attributeFilter: ["data-pw", "data-gloom", "data-phase"] });
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); mo && mo.disconnect(); };
  }, [mode, geo, isMobile, reduced, onSun]);

  // Successful login unmounts this component: hand the scene to the afterglow overlay.
  shLE(() => () => {
    if (phaseRef.current !== "submitting" || !rootRef.current) return;
    handedOffRef.current = true;
    runLoginAfterglow(rootRef.current, sceneRef.current, reducedRef.current);
  }, []);

  // Typing skips the intro (it never blocks the form anyway).
  const skipRef = shR(false);
  const onKeyDown = () => {
    if (skipRef.current) return;
    skipRef.current = true;
    setSkipIntro(true);
    sceneRef.current && sceneRef.current.skipIntro();
  };

  const emitPulse = () => {
    if (sceneRef.current) sceneRef.current.pulse();
    flashRing();
  };

  const submit = async (e) => {
    e && e.preventDefault();
    setError("");
    phaseRef.current = "submitting";
    setPhase("submitting");
    sceneRef.current && sceneRef.current.setSubmitting(true);
    try {
      await login(username, pw);
    } catch (err) {
      setError(err?.message || t("auth.loginError"));
      phaseRef.current = "error";
      setPhase("error");
      setGloom(true);
      gloomRef.current = true;
      sceneRef.current && sceneRef.current.error();
      const wrap = cardWrapRef.current;
      if (wrap && wrap.animate && !reducedRef.current) {
        wrap.animate([
          { transform: "translateX(0)" }, { transform: "translateX(-14px)" }, { transform: "translateX(11px)" },
          { transform: "translateX(-7px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" },
        ], { duration: 520, easing: "cubic-bezier(.36,.07,.19,.97)" });
      }
      later(() => { gloomRef.current = false; setGloom(false); }, 950);
      later(() => { if (phaseRef.current === "error") { phaseRef.current = "idle"; setPhase("idle"); } }, 1400);
    } finally {
      sceneRef.current && sceneRef.current.setSubmitting(false);
    }
  };

  const busy = dataLoading || phase === "submitting";
  const chars = username.length + pw.length;
  const charge = Math.min(1, 0.04 + Math.min(0.62, chars * 0.045) + sunlit * 0.34);
  const pct = Math.round(charge * 100);
  const title = t("auth.sunTitle");
  const sunWord = t("auth.sunWord");
  const words = title.split(" ");
  // wide screens: the hex chips orbit the island (left, right, below); stacked: a row under the card
  const tilePos = shM(() => {
    if (stacked) return [null, null, null];
    const { spot, w, h } = geo, z = spot.size;
    const cardLeft = rectsRef.current.card ? rectsRef.current.card.left : w * 0.66;
    const fit = (x, y) => ({ x: lgClamp(x, 66, cardLeft - 72), y: lgClamp(y, 80, h - 70) });
    // right chip: beside the island if there is room before the card, otherwise lower along the orbit
    const roomRight = spot.x + z * 0.66 <= cardLeft - 72;
    return [fit(spot.x - z * 0.66, spot.y - z * 0.04), fit(spot.x + z * 0.66, spot.y + (roomRight ? z * 0.08 : z * 0.4)), fit(spot.x - z * 0.38, spot.y + z * 0.46)];
  }, [geo, stacked]);

  return (
    <div ref={rootRef} className="tg-login" data-phase={phase} data-chips={!stacked && geo.spot.size < 560 ? "s" : undefined} data-scene={mode} data-size={isMobile ? "lite" : "full"}
      data-stacked={stacked ? "1" : undefined} data-reduced={reduced ? "1" : undefined} data-pw={pwFocus ? "1" : undefined}
      data-gloom={gloom ? "1" : undefined} data-skip={skipIntro ? "1" : undefined} style={{ "--charge": charge }}>
      <div className="tg-login-scene" aria-hidden="true">
        {mode !== "3d" && <SunArt size={geo} spot={geo.spot} anchor={geo.anchor} lite={isMobile} svgRef={svgRef} />}
        <div className="tg-login-stage" ref={stageRef} />
        <div className="tg-login-veil" />
      </div>
      <div className="tg-login-fx" ref={fxRef} aria-hidden="true">
        <div className="tg-login-flash" />
        <div className="tg-login-shock" />
      </div>

      <div className="tg-login-layout">
        <section className="tg-login-hero">
          <div className="tg-login-brand"><Logo /></div>
          <p className="tg-login-kicker tg-intro">{t("auth.kicker")}</p>
          <h1 className="tg-login-title">
            {words.map((w, i) => {
              const hot = sunWord && w.toLowerCase().replace(/[^\p{L}']/gu, "") === sunWord.toLowerCase();
              return <React.Fragment key={i}><span className={`tg-login-word tg-intro${hot ? " tg-login-sunword" : ""}`} style={{ "--i": i }}>{w}</span>{i < words.length - 1 ? " " : ""}</React.Fragment>;
            })}
          </h1>
          <p className="tg-login-lead tg-intro">{t("auth.heroTitle")}</p>
          <p className="tg-login-hint tg-intro"><span className="tg-login-hint-sun" aria-hidden="true" />{touch ? t("auth.sunHintTouch") : t("auth.sunHint")}</p>
        </section>

        <div className="tg-login-cardwrap" ref={cardWrapRef}>
          <div className="tg-login-card" ref={cardRef}>
            <span className="tg-login-cells" aria-hidden="true" />
            <span className="tg-login-spec" aria-hidden="true" />
            <span className="tg-login-ring" ref={ringRef} aria-hidden="true" />
            <span className="tg-login-edge" aria-hidden="true" />
            <span className="tg-login-plug" aria-hidden="true" />
            <form onSubmit={submit} onKeyDown={onKeyDown} aria-busy={busy}>
              <div className="tg-login-cardhead">
                <div>
                  <h2>{t("auth.loginTitle")}</h2>
                  <p className="tg-login-sub">{t("auth.loginSubtitle")}</p>
                </div>
                <div className="tg-login-meter" aria-hidden="true">
                  <svg viewBox="0 0 56 56" className="tg-login-meter-ring">
                    <circle cx="28" cy="28" r="23" className="tg-login-meter-track" />
                    <circle cx="28" cy="28" r="23" className="tg-login-meter-fill" pathLength="100" />
                    <circle cx="28" cy="28" r="23" className="tg-login-meter-spin" pathLength="100" />
                  </svg>
                  <span className="tg-login-meter-txt"><span className="tg-login-meter-pct">{pct}%</span><span className="tg-login-meter-lbl">{t("auth.charge")}</span></span>
                </div>
              </div>
              <Field label={t("common.username")}><Input value={username} onChange={e => { if (e.target.value.length > username.length) emitPulse(); setUsername(e.target.value); setError(""); }} autoComplete="username" /></Field>
              <div style={{ height: 14 }} />
              <Field label={t("common.password")}>
                <div style={{ position: "relative" }}>
                  <input className="tg-input" value={pw} data-secret="1" onChange={e => { if (e.target.value.length > pw.length) emitPulse(); setPw(e.target.value); setError(""); }} onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)} type={showPw ? "text" : "password"} autoComplete="current-password" style={{ paddingRight: 40, width: "100%", boxSizing: "border-box" }} />
                  <button type="button" className="tg-login-eye" onClick={() => setShowPw(v => !v)} aria-label={showPw ? t("auth.hidePassword") : t("auth.showPassword")} aria-pressed={showPw}>
                    {showPw ? <I.eyeOff size={16} /> : <I.eye size={16} />}
                  </button>
                </div>
              </Field>
              {error && (
                <div className="tg-login-error" role="alert" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", color: "var(--red)", fontSize: 13 }}>
                  <I.alert size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
              <div style={{ height: 20 }} />
              <Button variant="primary" size="lg" full type="submit" disabled={dataLoading}>{dataLoading ? t("common.loading") : <>{t("common.login")} <I.arrowRight size={17} /></>}</Button>
            </form>
          </div>
        </div>
        <div className="tg-login-tiles">
          <LoginTile index={0} pos={tilePos[0]} big="CRM" label={t("auth.statCrm")} back={t("auth.statCrmBack")} />
          <LoginTile index={1} pos={tilePos[1]} big="AI" label={t("auth.statAi")} back={t("auth.statAiBack")} />
          <LoginTile index={2} pos={tilePos[2]} big="1" label={t("auth.statFinance")} back={t("auth.statFinanceBack")} />
        </div>
      </div>
    </div>
  );
}

// ---------- time helpers ----------
function timeAgo(iso) {
  const d = new Date(iso), now = new Date(), s = (now - d) / 1000;
  const lang = window.__TG_LANG || "uz";
  const labels = {
    uz: { now: "hozir", min: "daq oldin", hour: "soat oldin", day: "kun oldin" },
    ru: { now: "только что", min: "мин назад", hour: "ч назад", day: "дн назад" },
    en: { now: "just now", min: "min ago", hour: "h ago", day: "d ago" },
  };
  const copy = labels[lang] || labels.uz;
  if (s < 60) return copy.now;
  if (s < 3600) return Math.floor(s / 60) + " " + copy.min;
  if (s < 86400) return Math.floor(s / 3600) + " " + copy.hour;
  if (s < 604800) return Math.floor(s / 86400) + " " + copy.day;
  return window.formatUzDate ? window.formatUzDate(d, { day: "numeric", month: "short" }) : `${d.getDate()}-${d.getMonth() + 1}`;
}
function fmtDate(iso, withTime) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  return withTime ? date + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : date;
}
function fmtDuration(s) { const m = Math.floor(s / 60), ss = s % 60; return `${m}:${ss.toString().padStart(2, "0")}`; }
Object.assign(window, { Sidebar, Header, CommandPalette, Toasts, Login, CustomizePanel, timeAgo, fmtDate, fmtDuration });
