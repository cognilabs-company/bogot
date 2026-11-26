/* data.jsx - shared UI formatters and static option maps */

const fmtUZS = (n) => n == null ? "—" : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
const fmtNum = (n) => n == null ? "—" : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fmtShort = (n) => {
  const value = Number(n) || 0;
  const abs = Math.abs(value);
  const compact = (divisor, suffix) => `${(value / divisor).toFixed(1).replace(/\.0$/, "")} ${suffix}`;
  if (abs >= 999.95e6) {
    // Show billions together with the millions so 1 512 000 000 is not rounded to "1.5 mlrd".
    const sign = value < 0 ? "-" : "";
    let mlrd = Math.floor(abs / 1e9);
    let mln = Math.round((abs - mlrd * 1e9) / 1e6);
    if (mln >= 1000) { mlrd += 1; mln -= 1000; }
    return mln ? `${sign}${mlrd} mlrd ${mln} mln` : `${sign}${mlrd} mlrd`;
  }
  if (abs >= 1e6) return compact(1e6, "mln");
  if (abs >= 1e3) return compact(1e3, "K");
  return String(value);
};

// Compact form for tight spaces (chart axes, bar labels): 1.5 mlrd, 315.5 mln.
const fmtCompact = (n) => {
  const value = Number(n) || 0;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, "")} mlrd`;
  return fmtShort(value);
};

window.fmtUZS = fmtUZS;
window.fmtNum = fmtNum;
window.fmtShort = fmtShort;
window.fmtCompact = fmtCompact;

const TUMAN_MAHALLA = {};

const DISTRICTS = Object.keys(TUMAN_MAHALLA);
function cloneLocationMap(source = TUMAN_MAHALLA) {
  return Object.fromEntries(
    Object.entries(source || {}).map(([district, mahallas]) => [district, [...mahallas]])
  );
}

function productDisplayName(product = {}) {
  return String(product.name || product.model || "Mahsulot").trim() || "Mahsulot";
}

function productDisplayCategory(product = {}) {
  return String(product.categoryName || product.category || "").trim() || "Kategoriyasiz";
}

function accentColorFromText(value) {
  const text = String(value || "").trim();
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 72% 48%)`;
}

function productAccentColor(product = {}) {
  return accentColorFromText(productDisplayCategory(product) || productDisplayName(product));
}

const PIPELINE_STAGES = ["greeted", "need_identified", "info_collected", "ready_to_order", "completed", "cancelled"];
const PIPELINE_STAGE_UZ = {
  greeted: "Yangi murojaat",
  need_identified: "Ehtiyoj aniqlandi",
  info_collected: "Texnik ma'lumot yig'ildi",
  ready_to_order: "Taklif / shartnoma",
  completed: "Sotuv yopildi",
  cancelled: "Yo'qotildi",
};
const OP_STATUSES = ["contacted", "sold", "rejected"];
const OP_STATUS_UZ = { contacted: "Aloqada", sold: "Sotildi", rejected: "Yo'qotildi" };
const SOURCES = ["instagram", "telegram", "phone", "manual"];
const SOURCE_UZ = { instagram: "Instagram", telegram: "Telegram", phone: "Telefon", manual: "Qo'lda" };
const PAYMENT_TYPES = ["cash", "credit"];
const PAYMENT_TYPE_UZ = { cash: "Naqd", credit: "Kredit" };

function username() {
  return "@user" + Math.floor(Math.random() * 100000);
}

window.DISTRICTS = DISTRICTS;
window.TUMAN_MAHALLA = TUMAN_MAHALLA;
window.cloneLocationMap = cloneLocationMap;
window.productDisplayName = productDisplayName;
window.productDisplayCategory = productDisplayCategory;
window.accentColorFromText = accentColorFromText;
window.productAccentColor = productAccentColor;
window.PIPELINE_STAGES = PIPELINE_STAGES;
window.PIPELINE_STAGE_UZ = PIPELINE_STAGE_UZ;
window.OP_STATUSES = OP_STATUSES;
window.OP_STATUS_UZ = OP_STATUS_UZ;
window.SOURCES = SOURCES;
window.SOURCE_UZ = SOURCE_UZ;
window.PAYMENT_TYPES = PAYMENT_TYPES;
window.PAYMENT_TYPE_UZ = PAYMENT_TYPE_UZ;
window.username = username;
