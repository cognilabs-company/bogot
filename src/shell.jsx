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
function Login() {
  const { login, dataLoading, t } = useApp();
  const [username, setUsername] = shS("");
  const [pw, setPw] = shS("");
  const [showPw, setShowPw] = shS(false);
  const [error, setError] = shS("");
  const submit = async (e) => {
    e && e.preventDefault();
    setError("");
    try {
      await login(username, pw);
    } catch (err) {
      setError(err?.message || t("auth.loginError"));
    }
  };
  return (
    <div className="tg-login">
      <div className="tg-login-art">
        <div className="tg-login-art-inner">
          <Logo />
          <h1>{t("auth.heroTitle")}</h1>
          <p>{t("auth.heroText")}</p>
          <div className="tg-login-stats">
            <div><strong>CRM</strong><span>{t("auth.statCrm")}</span></div>
            <div><strong>AI</strong><span>{t("auth.statAi")}</span></div>
            <div><strong>1</strong><span>{t("auth.statFinance")}</span></div>
          </div>
        </div>
        <div className="tg-login-glow" />
      </div>
      <div className="tg-login-form">
        <form onSubmit={submit}>
          <h2>{t("auth.loginTitle")}</h2>
          <Field label={t("common.username")}><Input value={username} onChange={e => { setUsername(e.target.value); setError(""); }} autoComplete="username" /></Field>
          <div style={{ height: 14 }} />
          <Field label={t("common.password")}>
            <div style={{ position: "relative" }}>
              <input className="tg-input" value={pw} onChange={e => { setPw(e.target.value); setError(""); }} type={showPw ? "text" : "password"} autoComplete="current-password" style={{ paddingRight: 40, width: "100%", boxSizing: "border-box" }} />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center", padding: 0, lineHeight: 1 }}>
                {showPw ? <I.eyeOff size={16} /> : <I.eye size={16} />}
              </button>
            </div>
          </Field>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red)", color: "var(--red)", fontSize: 13 }}>
              <I.alert size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          <div style={{ height: 20 }} />
          <Button variant="primary" size="lg" full type="submit" disabled={dataLoading}>{dataLoading ? t("common.loading") : <>{t("common.login")} <I.arrowRight size={17} /></>}</Button>
        </form>
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
