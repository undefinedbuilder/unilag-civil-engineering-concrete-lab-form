import { google } from "googleapis";

/* ---------------------------------------------------------------
   HELPER: GENERATE NEXT APPLICATION NUMBER
---------------------------------------------------------------- */
function nextRecordId(lastId) {
  if (!lastId) return `UNILAG-CL-000001`;

  const match = lastId.match(/^UNILAG-CL-(\d{6})$/);
  if (!match) return `UNILAG-CL-000001`;

  let number = parseInt(match[1], 10) + 1;
  if (number > 999999) number = 1;

  return `UNILAG-CL-${number.toString().padStart(6, "0")}`;
}

/* ---------------------------------------------------------------
   HELPER: DERIVED VALUES FROM RATIO INPUTS
---------------------------------------------------------------- */
function computeDerivedFromRatio(ratioCement, ratioFine, ratioCoarse, waterCementRatio) {
  const c = Number(ratioCement);
  const f = Number(ratioFine);
  const co = Number(ratioCoarse);
  const wOverC = Number(waterCementRatio);

  if (!c || c <= 0 || [f, co, wOverC].some((v) => isNaN(v))) {
    return { wcRatio: 0, mixRatioString: "" };
  }

  const wcRatio = wOverC;
  const mixRatioString = `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`;
  return { wcRatio, mixRatioString };
}

/* ---------------------------------------------------------------
   MAIN API HANDLER – /api/submit  (RATIO-ONLY)
---------------------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const body = req.body || {};

  /* -----------------------------------------------------------
      BASIC VALIDATION – COMMON FIELDS (NOTES OPTIONAL)
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
    if (
      body[key] === undefined ||
      body[key] === null ||
      String(body[key]).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${key}`,
      });
    }
  }

  // Ratio-specific required fields
  const ratioRequired = [
    "ratioCement",
    "ratioFine",
    "ratioCoarse",
    "waterCementRatio",
  ];

  for (const key of ratioRequired) {
    if (
      body[key] === undefined ||
      body[key] === null ||
      String(body[key]).trim?.() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: `Missing required field (ratio): ${key}`,
      });
    }
  }

  /* -----------------------------------------------------------
      DESTRUCTURE BODY
     ------------------------------------------------------------ */
  const {
    clientName,
    contactEmail,
    phoneNumber,
    organisationType,
    contactPerson,
    projectSite,
    crushDate,
    concreteType,
    cementType,
    slump,
    ageDays,
    cubesCount,
    concreteGrade,
    notes = "",

    // Ratio inputs
    ratioCement,
    ratioFine,
    ratioCoarse,
    waterCementRatio,

    // Groups
    admixtures = [],
    scms = [],
  } = body;

  /* -----------------------------------------------------------
      GOOGLE SHEETS AUTH
     ------------------------------------------------------------ */
  const sheetId = process.env.SHEET_ID;
  const credentials = process.env.GOOGLE_SERVICE_CREDENTIALS;

  if (!sheetId || !credentials) {
    return res.status(500).json({
      success: false,
      message: "Server not configured (missing Google credentials)",
    });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  // RATIO-ONLY: always use R + "Client Sheet (Ratios)"
  const modeLetter = "R";
  const mainSheetName = "Client Sheet (Ratios)";

  /* -----------------------------------------------------------
      FETCH LAST APPLICATION NUMBER FROM COLUMN A
     ------------------------------------------------------------ */
  let lastId = null;
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${mainSheetName}!A:A`,
    });

    const rows = result.data.values || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const cell = row && row[0];
      if (cell && typeof cell === "string" && cell.trim()) {
        lastId = cell.trim();
        break;
      }
    }
  } catch (err) {
    console.error("Error reading last recordId:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to read existing records",
    });
  }

  const recordId = nextRecordId(lastId, modeLetter);
  const timestamp = new Date().toISOString();

  /* -----------------------------------------------------------
      DERIVE W/C RATIO + MIX RATIO STRING (FROM RATIO INPUTS)
     ------------------------------------------------------------ */
  const { wcRatio, mixRatioString } = computeDerivedFromRatio(
    ratioCement,
    ratioFine,
    ratioCoarse,
    waterCementRatio
  );

  /* -----------------------------------------------------------
      BUILD MAIN ROW (RATIO SHEET)
      A: Record ID
      B: Timestamp
      C: Client / Company Name
      D: Contact Email
      E: Contact Phone
      F: Organisation Type
      G: Contact Person
      H: Project / Site
      I: Crushing Date
      J: Concrete Type
      K: Cement Type
      L: Slump (mm)
      M: Age (days)
      N: Cubes Count
      O: Concrete Grade
      P: Ratio Cement
      Q: Ratio Fine
      R: Ratio Coarse
      S: Water–Cement Ratio (input)
      T: Notes
     ------------------------------------------------------------ */
  const mainRow = [
    [
      recordId,
      timestamp,
      clientName,
      contactEmail,
      phoneNumber,
      organisationType,
      contactPerson,
      projectSite,
      crushDate,
      concreteType,
      cementType,
      slump,
      ageDays,
      cubesCount,
      concreteGrade,
      ratioCement,
      ratioFine,
      ratioCoarse,
      waterCementRatio,
      notes,
    ],
  ];

  /* -----------------------------------------------------------
      APPEND MAIN ROW
     ------------------------------------------------------------ */
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${mainSheetName}!A:V`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: mainRow },
    });
  } catch (err) {
    console.error("Error appending main row:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to save main record",
    });
  }

  /* -----------------------------------------------------------
      APPEND ADMIXTURES – SHEET: "Client Admixtures"
      A: Record ID
      B: Timestamp
      C: Client Name
      D: Index
      E: Admixture Name
      F: Dosage (%)
     ------------------------------------------------------------ */
  if (Array.isArray(admixtures) && admixtures.length > 0) {
    const admRows = admixtures.map((a, index) => [
      recordId,
      timestamp,
      clientName,
      index + 1,
      a.name || "",
      a.dosage || "",
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Client Admixtures!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: admRows },
      });
    } catch (err) {
      console.error("Error appending admixtures rows:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to save admixtures",
      });
    }
  }

  /* -----------------------------------------------------------
      APPEND SCMS – SHEET: "Client SCMs"
      A: Record ID
      B: Timestamp
      C: Client Name
      D: Index
      E: SCM Name
      F: Percent (%)
     ------------------------------------------------------------ */
  if (Array.isArray(scms) && scms.length > 0) {
    const scmRows = scms.map((s, index) => [
      recordId,
      timestamp,
      clientName,
      index + 1,
      s.name || "",
      s.percent || "",
    ]);

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Client SCMs!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: scmRows },
      });
    } catch (err) {
      console.error("Error appending SCM rows:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to save SCMs",
      });
    }
  }

  /* -----------------------------------------------------------
      SUCCESS RESPONSE (INCLUDES DERIVED VALUES)
     ------------------------------------------------------------ */
  return res.status(200).json({
    success: true,
    message: "Record saved successfully",
    recordId,
    wcRatio,
    mixRatioString,
  });
}
