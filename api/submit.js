import { google } from "googleapis";

/* ===========================================================
   UNILAG CONCRETE LAB – SUBMIT API
   =========================================================== */

/* Sheet names (must match Google Sheet tabs exactly) */
const SHEET_RATIO = "Client Master Sheet - Ratio";
const SHEET_KGM3 = "Client Master Sheet - kg/m3";
const SHEET_ADMIXTURES = "Client Admixtures";
const SHEET_SCMS = "Client SCMs";

/* Normalize cement label */
function normalizeCementType(value) {
  if (value === "Blended (CEMII)") return "Blended";
  return String(value || "").trim();
}

/* Generate next application number */
function nextRecordId(lastId, prefix) {
  if (!lastId) return `${prefix}-000001`;

  const match = String(lastId).match(new RegExp(`^${prefix}-(\\d{6})$`));
  if (!match) return `${prefix}-000001`;

  const num = parseInt(match[1], 10) + 1;
  return `${prefix}-${num.toString().padStart(6, "0")}`;
}

/* Compute ratio-derived values */
function computeFromRatio(c, f, co, wc) {
  return {
    wcRatio: wc,
    mixRatioString: `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`,
  };
}

/* Compute kg/m³-derived values */
function computeFromKgm3(c, w, f, co) {
  return {
    wcRatio: w / c,
    mixRatioString: `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`,
  };
}

/* Get last record ID from a sheet */
async function getLastRecordId(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const rows = res.data.values || [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i]?.[0]) return rows[i][0];
  }
  return null;
}

/* ===========================================================
   API HANDLER
   =========================================================== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const body = req.body || {};
  const inputMode = body.inputMode === "kgm3" ? "kgm3" : "ratio";

  const sheetName = inputMode === "kgm3" ? SHEET_KGM3 : SHEET_RATIO;
  const prefix = inputMode === "kgm3" ? "CLK" : "CLR";

  /* Validate common fields */
  const requiredCommon = [
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

  for (const key of requiredCommon) {
    if (!body[key]) {
      return res.status(400).json({ success: false, message: `Missing field: ${key}` });
    }
  }

  /* Validate mode-specific fields */
  if (inputMode === "ratio") {
    if (!body.ratioFine || !body.ratioCoarse || !body.waterCementRatio) {
      return res.status(400).json({ success: false, message: "Missing ratio values" });
    }
  } else {
    if (!body.cementKgm3 || !body.waterKgm3 || !body.fineKgm3 || !body.coarseKgm3) {
      return res.status(400).json({ success: false, message: "Missing kg/m³ values" });
    }
  }

  /* Google Sheets setup */
  const spreadsheetId = process.env.SHEET_ID;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_CREDENTIALS);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  /* Generate application number */
  const lastId = await getLastRecordId(sheets, spreadsheetId, sheetName);
  const recordId = nextRecordId(lastId, prefix);
  const timestamp = new Date().toISOString();

  const cementType = normalizeCementType(body.cementType);

  /* Build row */
  let wcRatio, mixRatioString, row;

  if (inputMode === "ratio") {
    const derived = computeFromRatio(
      body.ratioCement ?? 1,
      body.ratioFine,
      body.ratioCoarse,
      body.waterCementRatio
    );

    wcRatio = derived.wcRatio;
    mixRatioString = derived.mixRatioString;

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
      body.waterCementRatio,
      wcRatio,
      mixRatioString,
      body.notes || "",
    ];
  } else {
    const derived = computeFromKgm3(
      body.cementKgm3,
      body.waterKgm3,
      body.fineKgm3,
      body.coarseKgm3
    );

    wcRatio = derived.wcRatio;
    mixRatioString = derived.mixRatioString;

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
  }

  /* Save main record */
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:V`,
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
      a.name || "",
      a.dosage || "",
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
      s.name || "",
      s.percent || "",
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_SCMS}!A:F`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }

  /* Done */
  return res.status(200).json({
    success: true,
    recordId,
    wcRatio,
    mixRatioString,
    inputMode,
    savedToSheet: sheetName,
  });
}
