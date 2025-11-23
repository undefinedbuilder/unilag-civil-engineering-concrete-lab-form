import { google } from "googleapis";

/* ---------------------------------------------------------------
   HELPER: GENERATE NEXT APPLICATION NUMBER
   Pattern: UNILAG-CL-K000001 / UNILAG-CL-R000001
---------------------------------------------------------------- */
function nextRecordId(lastId, modeLetter) {
  if (!lastId) return `UNILAG-CL-${modeLetter}000001`;

  const match = lastId.match(/^UNILAG-CL-[KR](\d{6})$/);
  if (!match) return `UNILAG-CL-${modeLetter}000001`;

  let number = parseInt(match[1], 10) + 1;
  if (number > 999999) {
    number = 1;
  }
  return `UNILAG-CL-${modeLetter}${number.toString().padStart(6, "0")}`;
}

/* ---------------------------------------------------------------
   HELPER: DERIVED VALUES FROM Kg INPUTS
---------------------------------------------------------------- */
function computeDerivedFromKg(cementKg, waterKg, fineAggKg, coarseAggKg) {
  const c = Number(cementKg);
  const w = Number(waterKg);
  const f = Number(fineAggKg);
  const co = Number(coarseAggKg);

  if (!c || c <= 0 || [w, f, co].some((v) => isNaN(v))) {
    return { wcRatio: 0, mixRatioString: "" };
  }

  const wcRatio = w / c;
  const mixRatioString = `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`;
  return { wcRatio, mixRatioString };
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
   MAIN API HANDLER – /api/submit
---------------------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const body = req.body || {};
  const inputMode = body.inputMode; // "kg" or "ratio"

  if (inputMode !== "kg" && inputMode !== "ratio") {
    return res.status(400).json({
      success: false,
      message: "Invalid input mode",
    });
  }

  /* -----------------------------------------------------------
     BASIC VALIDATION – COMMON FIELDS
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
    "targetStrength",
    "notes",
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

  if (inputMode === "kg") {
    const kgRequired = ["cementKg", "waterKg", "fineAggKg", "coarseAggKg"];
    for (const key of kgRequired) {
      if (
        body[key] === undefined ||
        body[key] === null ||
        String(body[key]).trim?.() === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `Missing required field (kg mode): ${key}`,
        });
      }
    }
  } else {
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
          message: `Missing required field (ratio mode): ${key}`,
        });
      }
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
    targetStrength,
    notes,

    // Kg inputs
    cementKg,
    waterKg,
    fineAggKg,
    coarseAggKg,

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

  // Separate sheet tabs for kg vs ratio
  const modeLetter = inputMode === "kg" ? "K" : "R";
  const mainSheetName =
    inputMode === "kg" ? "Client Sheet (Kg/m3)" : "Client Sheet (Ratios)";

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
      const cell = rows[i][0];
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
     DERIVE W/C RATIO + MIX RATIO STRING
  ------------------------------------------------------------ */
  let wcRatio = 0;
  let mixRatioString = "";

  if (inputMode === "kg") {
    const result = computeDerivedFromKg(cementKg, waterKg, fineAggKg, coarseAggKg);
    wcRatio = result.wcRatio;
    mixRatioString = result.mixRatioString;
  } else {
    const result = computeDerivedFromRatio(
      ratioCement,
      ratioFine,
      ratioCoarse,
      waterCementRatio
    );
    wcRatio = result.wcRatio;
    mixRatioString = result.mixRatioString;
  }

  /* -----------------------------------------------------------
     BUILD MAIN ROW
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
     O: Target Strength (MPa)
     Then mode-specific columns, plus:
     - Derived W/C Ratio
     - Mix Ratio (string)
     - Notes
  ------------------------------------------------------------ */

  let mainRow;

  if (inputMode === "kg") {
    // P: cementKg
    // Q: waterKg
    // R: fineAggKg
    // S: coarseAggKg
    // T: wcRatio
    // U: mixRatioString
    // V: notes
    mainRow = [
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
        targetStrength,
        cementKg,
        waterKg,
        fineAggKg,
        coarseAggKg,
        wcRatio,
        mixRatioString,
        notes,
      ],
    ];
  } else {
    // P: ratioCement
    // Q: ratioFine
    // R: ratioCoarse
    // S: waterCementRatio (input)
    // T: wcRatio (derived)
    // U: mixRatioString
    // V: notes
    mainRow = [
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
        targetStrength,
        ratioCement,
        ratioFine,
        ratioCoarse,
        waterCementRatio,
        wcRatio,
        mixRatioString,
        notes,
      ],
    ];
  }

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
     E: Index
     F: Admixture Name
     G: Dosage (%)
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
        range: "Client Admixtures!A:G",
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
     E: Index
     F: SCM Name
     G: Percent (%)
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
        range: "Client SCMs!A:G",
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
     SUCCESS RESPONSE
  ------------------------------------------------------------ */
  return res.status(200).json({
    success: true,
    message: "Record saved successfully",
    recordId,
    wcRatio,
    mixRatioString,
  });
}

