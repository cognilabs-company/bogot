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
// the travel direction leads (fast spring), the trailing edge follows later with
// a softer spring, so the ribbon stretches like a gust and then settles.
const WIND_MS = 600;
const WIND_FRAMES = 48;
const WIND_LEAD = { delay: 0, w: 22, z: 0.62, cap: 5 };
const WIND_TRAIL = { delay: 0.09, w: 11, z: 0.8, cap: 3 };

function windSpring(u, w, z) {
  if (u <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + (z * w / wd) * Math.sin(wd * u));
}
// Normalised spring progress: exactly 1 at the end, overshoot capped in px.
function windEdge(t, p, dist) {
  const end = WIND_MS / 1000 - p.delay;
  const u = Math.max(0, t - p.delay);
  let s = windSpring(u, p.w, p.z);
  s += (1 - windSpring(end, p.w, p.z)) * Math.pow(Math.min(1, u / end), 3);
  if (s > 1 && dist > 0) {
    const peak = Math.exp(-Math.PI * p.z / Math.sqrt(1 - p.z * p.z));
    s = 1 + (s - 1) * Math.min(1, p.cap / (dist * peak));
  }
  return s;
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
  const st = shR({ first: true, shown: false, path: null, box: null, axis: "y", flying: false, anims: [] });
  const syncRef = shR(null);

  const apply = (box) => {
    const el = windRef.current, nav = navRef.current;
    // where the accent bar sits: nav's inner left edge (sidebar) / bottom edge (topnav)
    el.style.setProperty("--wind-x", box.x + "px");
    el.style.setProperty("--wind-b", Math.max(0, nav.clientHeight - box.y - box.h + nav.scrollTop) + "px");
    el.style.transform = `translate(${box.x}px, ${box.y}px)`;
    el.style.width = box.w + "px";
    el.style.height = box.h + "px";
  };
  const stopFlight = () => {
    st.current.anims.forEach(a => a.cancel());
    st.current.anims = [];
    st.current.flying = false;
    if (windRef.current) windRef.current.removeAttribute("data-flying");
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

  const fly = (from, to, item) => {
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
      const aStart = from[pos], aEnd = from[pos] + from[size];
      const bStart = to[pos], bEnd = to[pos] + to[size];
      const leadDist = back ? Math.abs(aStart - bStart) : Math.abs(aEnd - bEnd);
      const trailDist = back ? Math.abs(aEnd - bEnd) : Math.abs(aStart - bStart);
      const frames = [];
      for (let i = 0; i <= WIND_FRAMES; i++) {
        const t = (i / WIND_FRAMES) * (WIND_MS / 1000);
        const kl = windEdge(t, WIND_LEAD, leadDist);
        const kt = windEdge(t, WIND_TRAIL, trailDist);
        let start = windLerp(aStart, bStart, back ? kl : kt);
        let end = windLerp(aEnd, bEnd, back ? kt : kl);
        if (end - start < 8) { const mid = (start + end) / 2; start = mid - 4; end = mid + 4; }
        const kc = Math.min(1, kl);
        const b = {};
        b[pos] = start; b[size] = end - start;
        b[cpos] = windLerp(from[cpos], to[cpos], kc);
        b[csize] = windLerp(from[csize], to[csize], kc);
        frames.push({ ...frame(b), offset: i / WIND_FRAMES });
      }
      const main = el.animate(frames, { duration: WIND_MS, easing: "linear" });
      const fx = [];
      const q = (sel) => el.querySelector(sel);
      // brighter gust gradient + dimmer base tint while travelling
      fx.push(q(".tg-wind-gust").animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0.85, offset: 0.5 }, { opacity: 0 }], { duration: WIND_MS, easing: "ease-out" }));
      fx.push(q(".tg-wind-tint").animate([{ opacity: 1 }, { opacity: 0.45, offset: 0.15 }, { opacity: 0.6, offset: 0.55 }, { opacity: 1 }], { duration: WIND_MS, easing: "ease-in-out" }));
      // streak lines blowing toward the leading edge
      const sign = back ? -1 : 1;
      const tr = (v) => axis === "y" ? `translateY(${v}%)` : `translateX(${v}%)`;
      el.querySelectorAll(".tg-wind-streak").forEach((sk, i) => {
        fx.push(sk.animate([
          { transform: tr(-sign * 160), opacity: 0 },
          { opacity: 0.9, offset: 0.35 },
          { transform: tr(sign * 220), opacity: 0 },
        ], { duration: 360 + i * 40, delay: 20 + i * 45, easing: "cubic-bezier(.2,.6,.3,1)", fill: "backwards" }));
      });
      // airy swirl on the destination icon + soft puff when the ribbon catches
      const ico = item && item.querySelector("svg");
      const puff = q(".tg-wind-puff");
      if (ico) {
        const ir = ico.getBoundingClientRect(), xr = item.getBoundingClientRect();
        puff.style.left = (ir.left - xr.left + ir.width / 2) + "px";
        puff.style.top = (ir.top - xr.top + ir.height / 2) + "px";
        fx.push(ico.animate([
          { transform: "rotate(0deg) scale(1)" },
          { transform: "rotate(-16deg) scale(1.14)", offset: 0.45 },
          { transform: "rotate(0deg) scale(1)" },
        ], { duration: 420, delay: 230, easing: "cubic-bezier(.3,.7,.3,1)" }));
        fx.push(puff.animate([
          { transform: "translate(-50%,-50%) scale(.3)", opacity: 0 },
          { opacity: 0.55, offset: 0.3 },
          { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 },
        ], { duration: 520, delay: 220, easing: "ease-out", fill: "backwards" }));
      }
      s.anims = [main, ...fx];
    }
    s.flying = true;
    el.setAttribute("data-flying", "1");
    const main = s.anims[0];
    main.onfinish = () => {
      if (s.anims[0] !== main) return;
      s.flying = false;
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
      stopFlight();
      fly(from, box, item);
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
    </div>
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
                        {!collapsed && <span>{t(it.key)}</span>}
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
