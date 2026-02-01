import { google } from "googleapis";

/* ===========================================================
   UNILAG CONCRETE LAB – SUBMIT API
   =========================================================== */

/* Sheet tab names (must exist in your Google Sheet) */
const SHEET_RATIO_CANDIDATES = ["Client Master Sheet - Ratio"];
const SHEET_KGM3_CANDIDATES = ["Client Master Sheet - kg/m3"];

const SHEET_ADMIXTURES = "Client Admixtures";
const SHEET_SCMS = "Client SCMs";

/* Check if a value is missing */
function isMissing(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

/* Generate next application number */
function nextRecordId(lastId, prefix) {
  if (!lastId) return `${prefix}-000001`;

  const match = String(lastId).trim().match(new RegExp(`^${prefix}-(\\d{6})$`));
  if (!match) return `${prefix}-000001`;

  let num = parseInt(match[1], 10) + 1;
  if (!Number.isFinite(num) || num < 1) num = 1;
  if (num > 999999) num = 1;

  return `${prefix}-${String(num).padStart(6, "0")}`;
}

/* Compute derived values (ratio mode) */
function computeFromRatio(c, f, co, wc) {
  const C = Number(c);
  const F = Number(f);
  const CO = Number(co);
  const WC = Number(wc);

  if (!Number.isFinite(C) || C <= 0) return { wcRatio: 0, mixRatioString: "" };
  if (![F, CO, WC].every(Number.isFinite)) return { wcRatio: 0, mixRatioString: "" };

  return {
    wcRatio: WC,
    mixRatioString: `1 : ${(F / C).toFixed(2)} : ${(CO / C).toFixed(2)}`,
  };
}

/* Compute derived values (kg/m³ mode) */
function computeFromKgm3(c, w, f, co) {
  const C = Number(c);
  const W = Number(w);
  const F = Number(f);
  const CO = Number(co);

  if (!Number.isFinite(C) || C <= 0) return { wcRatio: 0, mixRatioString: "" };
  if (![W, F, CO].every(Number.isFinite)) return { wcRatio: 0, mixRatioString: "" };

  return {
    wcRatio: W / C,
    mixRatioString: `1 : ${(F / C).toFixed(2)} : ${(CO / C).toFixed(2)}`,
  };
}

/* Read last record ID from Column A of a given sheet */
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

/* Resolve sheet names once (single spreadsheets.get call) */
function resolveSheetTitleFromTitles(allTitles, candidates) {
  // Exact match
  for (const c of candidates) {
    if (allTitles.includes(c)) return c;
  }

  // Loose match (ignore slash differences)
  const norm = (x) => String(x).toLowerCase().replace(/\s+/g, " ").replace(/\//g, "").trim();
  const normTitles = new Map(allTitles.map((t) => [norm(t), t]));

  for (const c of candidates) {
    const hit = normTitles.get(norm(c));
    if (hit) return hit;
  }

  return null;
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
    const inputMode = body.inputMode === "kgm3" ? "kgm3" : "ratio";

    /* Validate common required fields */
    const commonRequired = [
      "clientName",
      "contactEmail",
      "phoneNumber",
      "organisationType",
      "contactPerson",
      "projectSite",
      "crushDate",
      "concreteType",
      "cementType",
      "slump",
      "ageDays",
      "cubesCount",
      "concreteGrade",
    ];

    for (const key of commonRequired) {
      if (isMissing(body[key])) {
        return res.status(400).json({ success: false, message: `Missing field: ${key}` });
      }
    }

    /* Validate mode-specific required fields */
    if (inputMode === "ratio") {
      const required = ["ratioFine", "ratioCoarse", "waterCementRatio"];
      for (const key of required) {
        if (isMissing(body[key])) {
          return res.status(400).json({ success: false, message: `Missing ratio field: ${key}` });
        }
      }
    } else {
      const required = ["cementKgm3", "waterKgm3", "fineKgm3", "coarseKgm3"];
      for (const key of required) {
        if (isMissing(body[key])) {
          return res.status(400).json({ success: false, message: `Missing kg/m³ field: ${key}` });
        }
      }
    }

    /* Google Sheets env vars */
    const spreadsheetId = process.env.SHEET_ID;
    const rawCreds = process.env.GOOGLE_SERVICE_CREDENTIALS;

    if (isMissing(spreadsheetId) || isMissing(rawCreds)) {
      return res.status(500).json({
        success: false,
        message: "Server not configured (SHEET_ID / GOOGLE_SERVICE_CREDENTIALS missing)",
      });
    }

    let credentials;
    try {
      credentials = JSON.parse(rawCreds);
    } catch {
      return res.status(500).json({ success: false, message: "Invalid GOOGLE_SERVICE_CREDENTIALS JSON" });
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    /* Fetch all sheet titles once */
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(title))",
    });

    const titles = (meta.data.sheets || [])
      .map((s) => s?.properties?.title)
      .filter(Boolean);

    const ratioSheet = resolveSheetTitleFromTitles(titles, SHEET_RATIO_CANDIDATES);
    const kgm3Sheet = resolveSheetTitleFromTitles(titles, SHEET_KGM3_CANDIDATES);

    if (!ratioSheet) {
      return res.status(500).json({
        success: false,
        message: `Could not find Ratio sheet tab: ${SHEET_RATIO_CANDIDATES.join(" | ")}`,
      });
    }

    if (!kgm3Sheet) {
      return res.status(500).json({
        success: false,
        message: `Could not find kg/m³ sheet tab: ${SHEET_KGM3_CANDIDATES.join(" | ")}`,
      });
    }

    const sheetName = inputMode === "kgm3" ? kgm3Sheet : ratioSheet;
    const prefix = inputMode === "kgm3" ? "UNILAG-CLK" : "UNILAG-CLR";

    /* Generate application number based on destination sheet */
    const lastId = await getLastRecordId(sheets, spreadsheetId, sheetName);
    const recordId = nextRecordId(lastId, prefix);
    const timestamp = new Date().toISOString();

    /* No cement-type transformation: store exactly what the form sends */
    const cementType = body.cementType;

    /* Build row (no blanks; and NO duplicate WC in ratio mode) */
    let wcRatio = 0;
    let mixRatioString = "";
    let row = [];
    let appendRange = "A:V"; // kg row length

    if (inputMode === "ratio") {
      const derived = computeFromRatio(
        body.ratioCement ?? 1,
        body.ratioFine,
        body.ratioCoarse,
        body.waterCementRatio
      );

      wcRatio = derived.wcRatio; // returned to frontend, but not stored as a separate column
      mixRatioString = derived.mixRatioString;

      // Ratio schema (A..U) — W/C stored only once as waterCementRatio
      row = [
        recordId,
        timestamp,
        body.clientName,
        body.contactEmail,
        body.phoneNumber,
        body.organisationType,
        body.contactPerson,
        body.projectSite,
        body.crushDate,
        body.concreteType,
        cementType,
        body.slump,
        body.ageDays,
        body.cubesCount,
        body.concreteGrade,
        body.ratioCement ?? 1,
        body.ratioFine,
        body.ratioCoarse,
        body.waterCementRatio, // W/C stored once
        mixRatioString,
        body.notes || "",
      ];

      appendRange = "A:U";
    } else {
      const derived = computeFromKgm3(body.cementKgm3, body.waterKgm3, body.fineKgm3, body.coarseKgm3);
      wcRatio = derived.wcRatio;
      mixRatioString = derived.mixRatioString;

      // kg/m³ schema (A..V) — W/C is truly derived
      row = [
        recordId,
        timestamp,
        body.clientName,
        body.contactEmail,
        body.phoneNumber,
        body.organisationType,
        body.contactPerson,
        body.projectSite,
        body.crushDate,
        body.concreteType,
        cementType,
        body.slump,
        body.ageDays,
        body.cubesCount,
        body.concreteGrade,
        body.cementKgm3,
        body.waterKgm3,
        body.fineKgm3,
        body.coarseKgm3,
        wcRatio,
        mixRatioString,
        body.notes || "",
      ];

      appendRange = "A:V";
    }

    /* Append main record */
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!${appendRange}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    /* Save admixtures */
    if (Array.isArray(body.admixtures) && body.admixtures.length) {
      const rows = body.admixtures.map((a, i) => [
        recordId,
        timestamp,
        body.clientName,
        i + 1,
        a?.name || "",
        a?.dosage || "",
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_ADMIXTURES}!A:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }

    /* Save SCMs */
    if (Array.isArray(body.scms) && body.scms.length) {
      const rows = body.scms.map((s, i) => [
        recordId,
        timestamp,
        body.clientName,
        i + 1,
        s?.name || "",
        s?.percent || "",
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_SCMS}!A:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    }

    return res.status(200).json({
      success: true,
      recordId,
      wcRatio,
      mixRatioString,
      inputMode,
      savedToSheet: sheetName,
    });
  } catch (err) {
    console.error("Submit API error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
}

