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
   HELPER: MIX RATIO FROM KG/m³
---------------------------------------------------------------- */
function computeKgMixRatio(cementContent, waterContent, fineAgg, mediumAgg, coarseAgg) {
  const cement = Number(cementContent);
  const water = Number(waterContent);
  const fine = Number(fineAgg);
  const medium = Number(mediumAgg);
  const coarse = Number(coarseAgg);

  if (!cement || cement <= 0 || [water, fine, medium, coarse].some((v) => isNaN(v))) {
    return "";
  }

  const fineRatio = fine / cement;
  const mediumRatio = medium / cement;
  const coarseRatio = coarse / cement;
  const waterRatio = water / cement;

  return `1 : ${fineRatio.toFixed(2)} : ${mediumRatio.toFixed(2)} : ${coarseRatio.toFixed(
    2
  )} : ${waterRatio.toFixed(2)}`;
}

/* ---------------------------------------------------------------
   HELPER: MIX RATIO FROM "RATIOS"
---------------------------------------------------------------- */
function computeRatioMix(ratioCement, ratioFine, ratioMedium, ratioCoarse, ratioWater) {
  const c = Number(ratioCement);
  const f = Number(ratioFine);
  const m = Number(ratioMedium);
  const co = Number(ratioCoarse);
  const w = Number(ratioWater);

  if (!c || c <= 0 || [f, m, co, w].some((v) => isNaN(v))) {
    return { mixRatioString: "", wcRatio: 0 };
  }

  const fineN = f / c;
  const mediumN = m / c;
  const coarseN = co / c;
  const waterN = w / c;
  const wcRatio = w / c;

  const mixRatioString = `1 : ${fineN.toFixed(2)} : ${mediumN.toFixed(2)} : ${coarseN.toFixed(
    2
  )} : ${waterN.toFixed(2)}`;

  return { mixRatioString, wcRatio };
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
     IDs mapped from HTML
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
    const kgRequired = ["cementContent", "waterContent", "fineAgg", "mediumAgg", "coarseAgg"];
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
      "ratioMedium",
      "ratioCoarse",
      "ratioWater",
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
    cementContent,
    waterContent,
    fineAgg,
    mediumAgg,
    coarseAgg,
    ratioCement,
    ratioFine,
    ratioMedium,
    ratioCoarse,
    ratioWater,
    admixtures,
    scms,
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
  let wcRatioNumber = 0;
  let mixRatioString = "";

  if (inputMode === "kg") {
    const cementNum = Number(cementContent);
    const waterNum = Number(waterContent);
    if (cementNum && cementNum > 0 && !isNaN(waterNum)) {
      wcRatioNumber = waterNum / cementNum;
    } else {
      wcRatioNumber = 0;
    }
    mixRatioString = computeKgMixRatio(
      cementContent,
      waterContent,
      fineAgg,
      mediumAgg,
      coarseAgg
    );
  } else {
    const ratioResult = computeRatioMix(
      ratioCement,
      ratioFine,
      ratioMedium,
      ratioCoarse,
      ratioWater
    );
    wcRatioNumber = ratioResult.wcRatio;
    mixRatioString = ratioResult.mixRatioString;
  }

  /* -----------------------------------------------------------
     BUILD MAIN ROW
     Columns:
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
     P–T: Mix inputs (kg or parts)
     U: W/C Ratio
     V: Mix Ratio (string)
     W: Notes
  ------------------------------------------------------------ */
  let mainRow;

  if (inputMode === "kg") {
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
        cementContent,
        waterContent,
        fineAgg,
        mediumAgg,
        coarseAgg,
        wcRatioNumber,
        mixRatioString,
        notes,
      ],
    ];
  } else {
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
        ratioMedium,
        ratioCoarse,
        ratioWater,
        wcRatioNumber,
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
      range: `${mainSheetName}!A:W`,
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
     Columns:
     A: Record ID
     B: Timestamp
     C: Client Name
     D: Contact Email
     E: Index
     F: Admixture Name
     G: Dosage (L/100kg)
  ------------------------------------------------------------ */
  if (Array.isArray(admixtures) && admixtures.length > 0) {
    const admRows = admixtures.map((a, index) => [
      recordId,
      timestamp,
      clientName,
      contactEmail,
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
     Columns:
     A: Record ID
     B: Timestamp
     C: Client Name
     D: Contact Email
     E: Index
     F: SCM Name
     G: Percent (%)
  ------------------------------------------------------------ */
  if (Array.isArray(scms) && scms.length > 0) {
    const scmRows = scms.map((s, index) => [
      recordId,
      timestamp,
      clientName,
      contactEmail,
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
     DONE – RETURN TO FRONT-END
  ------------------------------------------------------------ */
  return res.status(200).json({
    success: true,
    recordId,
    mixRatioString,
    wcRatio: wcRatioNumber,
  });
}