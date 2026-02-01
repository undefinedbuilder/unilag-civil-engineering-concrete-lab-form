import { google } from "googleapis";

/* ---------------------------------------------------------------
   UNILAG CONCRETE LAB – SUBMIT HANDLER
   ---------------------------------------------------------------
   - Saves Ratio mode records to: Client Master Sheet - Ratio
   - Saves kg/m³ mode records to: Client Master Sheet - kgm3
   - Uses application numbers:
       * CLR-000001  (Ratio mode)
       * CLK-000001  (kg/m³ mode)
   - Keeps Admixtures and SCMs in their own sheets
---------------------------------------------------------------- */

/* ---------------------------------------------------------------
   Sheet names
---------------------------------------------------------------- */
const SHEET_RATIO = "Client Master Sheet - Ratio";
const SHEET_KGM3 = "Client Master Sheet - kgm3";
const SHEET_ADMIXTURES = "Client Admixtures";
const SHEET_SCMS = "Client SCMs";

/* ---------------------------------------------------------------
   Generate next application number
---------------------------------------------------------------- */
function nextRecordId(lastId, prefix) {
  if (!lastId) return `${prefix}-000001`;

  const regex = new RegExp(`^${prefix}-(\\d{6})$`);
  const match = String(lastId).match(regex);

  if (!match) return `${prefix}-000001`;

  let number = parseInt(match[1], 10) + 1;
  if (!Number.isFinite(number) || number < 1) number = 1;
  if (number > 999999) number = 1;

  return `${prefix}-${number.toString().padStart(6, "0")}`;
}

/* ---------------------------------------------------------------
   Compute derived values – Ratio mode
---------------------------------------------------------------- */
function computeDerivedFromRatio(ratioCement, ratioFine, ratioCoarse, waterCementRatio) {
  const c = Number(ratioCement);
  const f = Number(ratioFine);
  const co = Number(ratioCoarse);
  const wc = Number(waterCementRatio);

  if (!c || c <= 0 || [f, co, wc].some(Number.isNaN)) {
    return { wcRatio: 0, mixRatioString: "" };
  }

  return {
    wcRatio: wc,
    mixRatioString: `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`,
  };
}

/* ---------------------------------------------------------------
   Compute derived values – kg/m³ mode
---------------------------------------------------------------- */
function computeDerivedFromKgm3(cementKgm3, waterKgm3, fineKgm3, coarseKgm3) {
  const c = Number(cementKgm3);
  const w = Number(waterKgm3);
  const f = Number(fineKgm3);
  const co = Number(coarseKgm3);

  if (!c || c <= 0 || [w, f, co].some(Number.isNaN)) {
    return { wcRatio: 0, mixRatioString: "" };
  }

  return {
    wcRatio: w / c,
    mixRatioString: `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`,
  };
}

/* ---------------------------------------------------------------
   Read last application number from a sheet
---------------------------------------------------------------- */
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

/* ---------------------------------------------------------------
   API handler – /api/submit
---------------------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const body = req.body || {};

  /* -----------------------------------------------------------
     Determine input mode
  ------------------------------------------------------------ */
  const inputMode = body.inputMode === "kgm3" ? "kgm3" : "ratio";

  const mainSheetName = inputMode === "kgm3" ? SHEET_KGM3 : SHEET_RATIO;
  const recordPrefix = inputMode === "kgm3" ? "CLK" : "CLR";

  /* -----------------------------------------------------------
     Basic validation
  ------------------------------------------------------------ */
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
    if (!body[key] || String(body[key]).trim() === "") {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${key}`,
      });
    }
  }

  /* -----------------------------------------------------------
     Mode-specific validation
  ------------------------------------------------------------ */
  const ratioRequired = ["ratioCement", "ratioFine", "ratioCoarse", "waterCementRatio"];
  const kgRequired = ["cementKgm3", "waterKgm3", "fineKgm3", "coarseKgm3"];
  const required = inputMode === "kgm3" ? kgRequired : ratioRequired;

  for (const key of required) {
    if (!body[key] || String(body[key]).trim() === "") {
      return res.status(400).json({
        success: false,
        message: `Missing required field (${inputMode}): ${key}`,
      });
    }
  }

  /* -----------------------------------------------------------
     Google Sheets setup
  ------------------------------------------------------------ */
  const spreadsheetId = process.env.SHEET_ID;
  const credentials = process.env.GOOGLE_SERVICE_CREDENTIALS;

  if (!spreadsheetId || !credentials) {
    return res.status(500).json({ success: false, message: "Server not configured" });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  /* -----------------------------------------------------------
     Generate application number
  ------------------------------------------------------------ */
  let lastId;
  try {
    lastId = await getLastRecordId(sheets, spreadsheetId, mainSheetName);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to read records" });
  }

  const recordId = nextRecordId(lastId, recordPrefix);
  const timestamp = new Date().toISOString();

  /* -----------------------------------------------------------
     Compute derived values
  ------------------------------------------------------------ */
  const derived =
    inputMode === "kgm3"
      ? computeDerivedFromKgm3(body.cementKgm3, body.waterKgm3, body.fineKgm3, body.coarseKgm3)
      : computeDerivedFromRatio(body.ratioCement, body.ratioFine, body.ratioCoarse, body.waterCementRatio);

  const { wcRatio, mixRatioString } = derived;

  /* -----------------------------------------------------------
     Build main row (same column layout in both sheets)
  ------------------------------------------------------------ */
  const mainRow = [[
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
    body.cementType,
    body.slump,
    body.ageDays,
    body.cubesCount,
    body.concreteGrade,
    body.ratioCement || "",
    body.ratioFine || "",
    body.ratioCoarse || "",
    body.waterCementRatio || "",
    body.notes || "",
    inputMode,
    body.cementKgm3 || "",
    body.waterKgm3 || "",
    body.fineKgm3 || "",
    body.coarseKgm3 || "",
    wcRatio,
    mixRatioString,
  ]];

  /* -----------------------------------------------------------
     Save main record
  ------------------------------------------------------------ */
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${mainSheetName}!A:AA`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: mainRow },
  });

  /* -----------------------------------------------------------
     Save admixtures
  ------------------------------------------------------------ */
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

  /* -----------------------------------------------------------
     Save SCMs
  ------------------------------------------------------------ */
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

  /* -----------------------------------------------------------
     Success response
  ------------------------------------------------------------ */
  return res.status(200).json({
    success: true,
    recordId,
    wcRatio,
    mixRatioString,
    inputMode,
    savedToSheet: mainSheetName,
  });
}
