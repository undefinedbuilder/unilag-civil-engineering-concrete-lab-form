import { google } from "googleapis";

/* ===========================================================
   UNILAG CONCRETE LAB – SUBMIT API
   =========================================================== */

/* Preferred tab names (backend will auto-pick the one that exists) */
const SHEET_RATIO_CANDIDATES = ["Client Master Sheet - Ratio"];
const SHEET_KGM3_CANDIDATES = ["Client Master Sheet - kg/m3"];

const SHEET_ADMIXTURES = "Client Admixtures";
const SHEET_SCMS = "Client SCMs";

/* Generate next application number (UNILAG-CLR / UNILAG-CLK) */
function nextRecordId(lastId, prefix) {
  if (!lastId) return `${prefix}-000001`;

  // Expect: UNILAG-CLR-000001 or UNILAG-CLK-000001
  const match = String(lastId).match(new RegExp(`^${prefix}-(\\d{6})$`));
  if (!match) return `${prefix}-000001`;

  let num = parseInt(match[1], 10) + 1;
  if (!Number.isFinite(num) || num < 1) num = 1;
  if (num > 999999) num = 1;

  return `${prefix}-${num.toString().padStart(6, "0")}`;
}

/* Compute ratio-derived values */
function computeFromRatio(c, f, co, wc) {
  const C = Number(c);
  const F = Number(f);
  const CO = Number(co);
  const WC = Number(wc);

  if (!C || C <= 0 || [F, CO, WC].some(Number.isNaN)) {
    return { wcRatio: 0, mixRatioString: "" };
  }

  return {
    wcRatio: WC,
    mixRatioString: `1 : ${(F / C).toFixed(2)} : ${(CO / C).toFixed(2)}`,
  };
}

/* Compute kg/m³-derived values */
function computeFromKgm3(c, w, f, co) {
  const C = Number(c);
  const W = Number(w);
  const F = Number(f);
  const CO = Number(co);

  if (!C || C <= 0 || [W, F, CO].some(Number.isNaN)) {
    return { wcRatio: 0, mixRatioString: "" };
  }

  return {
    wcRatio: W / C,
    mixRatioString: `1 : ${(F / C).toFixed(2)} : ${(CO / C).toFixed(2)}`,
  };
}

/* Read last record ID from Column A */
async function getLastRecordId(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const rows = res.data.values || [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const cell = rows[i]?.[0];
    if (cell && String(cell).trim()) return String(cell).trim();
  }
  return null;
}

/* Pick the first sheet title that exists from a list of candidates */
async function resolveSheetTitle(sheets, spreadsheetId, candidates) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });

  const titles = (meta.data.sheets || [])
    .map((s) => s?.properties?.title)
    .filter(Boolean);

  // exact match
  for (const c of candidates) {
    if (titles.includes(c)) return c;
  }

  // fallback: loose match (case-insensitive + ignores / vs nothing)
  const norm = (x) => String(x).toLowerCase().replace(/\s+/g, " ").replace(/\//g, "").trim();
  const normTitles = new Map(titles.map((t) => [norm(t), t]));

  for (const c of candidates) {
    const hit = normTitles.get(norm(c));
    if (hit) return hit;
  }

  throw new Error(`No matching sheet tab found for: ${candidates.join(" | ")}`);
}

/* Safe required-field check (doesn't reject numbers like 0 incorrectly) */
function isMissing(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

/* ===========================================================
   API HANDLER
   =========================================================== */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const body = req.body || {};
    const inputMode = body.inputMode === "
