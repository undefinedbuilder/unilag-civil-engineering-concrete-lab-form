import { google } from "googleapis";
/* ---------------------------------------------------------------
   UNILAG CONCRETE LAB – SUBMIT HANDLER (Back-End)
   ---------------------------------------------------------------
/* ---------------------------------------------------------------
   Sheet names
---------------------------------------------------------------- */
const SHEET_RATIO = "Client Master Sheet - Ratio";
const SHEET_KGM3 = "Client Master Sheet - kg/m3";
const SHEET_ADMIXTURES = "Client Admixtures";
const SHEET_SCMS = "Client SCMs";

/* ---------------------------------------------------------------
   Generate next application number with prefix
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
   Derived calculations
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
   Read last application number from Column A of a sheet
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
  const inputMode = body.inputMode === "kgm3" ? "kgm3" : "ratio";

  const mainSheetName = inputMode === "kgm3" ? SHEET_KGM3 : SHEET_RATIO;
  const recordPrefix = inputMode === "kgm3" ? "CLK" : "CLR";

  /* -----------------------------------------------------------
     Validate common fields
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
    if (body[key] === undefined || body[key] === null || String(body[key]).trim() === "") {
      return res.status(400).json({ success: false, message: `Missing required field: ${key}` });
    }
  }

  /* -----------------------------------------------------------
     Validate mode-specific fields
  ------------------------------------------------------------ */
  const ratioRequired = ["ratioFine", "ratioCoarse", "waterCementRatio"];
  const kgRequired = ["cementKgm3", "waterKgm3", "fineKgm3", "coarseKgm3"];
  const required = inputMode === "kgm3" ? kgRequired : ratioRequired;

  for (const key of required) {
    if (body[key] === undefined || body[key] === null || String(body[key]).trim() === "") {
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

  let parsedCredentials;
  try {
    parsedCredentials = JSON.parse(credentials);
  } catch {
    return res.status(500).json({ success: false, message: "Invalid Google credentials JSON" });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: parsedCredentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  /* -----------------------------------------------------------
     Generate application number from ONLY the destination sheet
  ------------------------------------------------------------ */
  let lastId = null;
  try {
    lastId = await getLastRecordId(sheets, spreadsheetId, mainSheetName);
  } catch (err) {
    console.error("Error reading last recordId:", err);
    return res.status(500).json({ success: false, message: "Failed to read existing records" });
  }

  const recordId = nextRecordId(lastId, recordPrefix);
  const timestamp = new Date().toISOString();

  /* -----------------------------------------------------------
     Normalize labels
  ------------------------------------------------------------ */
  const cementType = normalizeCementType(body.cementType);

  /* -----------------------------------------------------------
     Build mode-specific row (NO BLANK MODE COLUMNS)
     Ratio sheet schema (example):
       A recordId
       B timestamp
       C clientName
       D contactEmail
       E phoneNumber
       F organisationType
       G contactPerson
       H projectSite
       I crushDate
       J concreteType
       K cementType
       L slump
       M ageDays
       N cubesCount
       O concreteGrade
       P ratioCement
       Q ratioFine
       R ratioCoarse
       S waterCementRatio
       T derivedWcRatio
       U derivedMixRatio
       V notes

     kgm3 sheet schema (example):
       A recordId
       B timestamp
       C clientName
       D contactEmail
       E phoneNumber
       F organisationType
       G contactPerson
       H projectSite
       I crushDate
       J concreteType
       K cementType
       L slump
       M ageDays
       N cubesCount
       O concreteGrade
       P cementKgm3
       Q waterKgm3
       R fineKgm3
       S coarseKgm3
       T derivedWcRatio
       U derivedMixRatio
       V notes
  ------------------------------------------------------------ */
  let wcRatio = 0;
  let mixRatioString = "";
  let rowValues = [];

  if (inputMode === "ratio") {
    const ratioCement = body.ratioCement ?? 1;
    const ratioFine = body.ratioFine;
    const ratioCoarse = body.ratioCoarse;
    const waterCementRatio = body.waterCementRatio;

    const derived = computeDerivedFromRatio(ratioCement, ratioFine, ratioCoarse, waterCementRatio);
    wcRatio = derived.wcRatio;
    mixRatioString = derived.mixRatioString;

    rowValues = [
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
      ratioCement,
      ratioFine,
      ratioCoarse,
      waterCementRatio,
      wcRatio,
      mixRatioString,
      body.notes || "",
    ];
  } else {
    const cementKgm3 = body.cementKgm3;
    const waterKgm3 = body.waterKgm3;
    const fineKgm3 = body.fineKgm3;
    const coarseKgm3 = body.coarseKgm3;

    const derived = computeDerivedFromKgm3(cementKgm3, waterKgm3, fineKgm3, coarseKgm3);
    wcRatio = derived.wcRatio;
    mixRatioString = derived.mixRatioString;

    rowValues = [
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
      cementKgm3,
      waterKgm3,
      fineKgm3,
      coarseKgm3,
      wcRatio,
      mixRatioString,
      body.notes || "",
    ];
  }

  /* -----------------------------------------------------------
     Append main row to the correct sheet ONLY
  ------------------------------------------------------------ */
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${mainSheetName}!A:V`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
  } catch (err) {
    console.error("Error appending main row:", err);
    return res.status(500).json({ success: false, message: "Failed to save main record" });
  }

  /* -----------------------------------------------------------
     Save Admixtures
---------------------------------------------------------------- */
  const admixtures = Array.isArray(body.admixtures) ? body.admixtures : [];
  if (admixtures.length > 0) {
    const rows = admixtures.map((a, i) => [
      recordId,
      timestamp,
      body.clientName,
      i + 1,
      a?.name || "",
      a?.dosage || "",
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_ADMIXTURES}!A:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    } catch (err) {
      console.error("Error saving admixtures:", err);
      return res.status(500).json({ success: false, message: "Failed to save admixtures" });
    }
  }

  /* -----------------------------------------------------------
     Save SCMs
---------------------------------------------------------------- */
  const scms = Array.isArray(body.scms) ? body.scms : [];
  if (scms.length > 0) {
    const rows = scms.map((s, i) => [
      recordId,
      timestamp,
      body.clientName,
      i + 1,
      s?.name || "",
      s?.percent || "",
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_SCMS}!A:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });
    } catch (err) {
      console.error("Error saving SCMs:", err);
      return res.status(500).json({ success: false, message: "Failed to save SCMs" });
    }
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
