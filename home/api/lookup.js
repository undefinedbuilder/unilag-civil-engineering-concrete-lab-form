import { google } from "googleapis";

/* Sheet candidates */
const SHEET_RATIO_CANDIDATES = ["Client Master Sheet - Ratio"];
const SHEET_KGM3_CANDIDATES = ["Client Master Sheet - kgm3", "Client Master Sheet - kg/m3"];
const SHEET_ADMIXTURES = "Client Admixtures";
const SHEET_SCMS = "Client SCMs";

function isMissing(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

function normTitle(x) {
  return String(x).toLowerCase().replace(/\s+/g, " ").replace(/\//g, "").trim();
}

async function getAllSheetTitles(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title))",
  });

  return (meta.data.sheets || [])
    .map((s) => s?.properties?.title)
    .filter(Boolean);
}

function resolveSheetTitleFromTitles(allTitles, candidates) {
  for (const c of candidates) {
    if (allTitles.includes(c)) return c;
  }

  const map = new Map(allTitles.map((t) => [normTitle(t), t]));
  for (const c of candidates) {
    const hit = map.get(normTitle(c));
    if (hit) return hit;
  }
  return null;
}

async function findRowByRecordId(sheets, spreadsheetId, sheetName, recordId) {
  // Get whole sheet range A:Z (enough for your row + office-use columns)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = res.data.values || [];
  if (rows.length === 0) return null;

  // Find row where column A matches recordId
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]?.[0];
    if (String(a || "").trim() === recordId) return rows[i];
  }

  return null;
}

async function getChildRowsByRecordId(sheets, spreadsheetId, sheetName, recordId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = res.data.values || [];
  if (!rows.length) return [];

  // assumes first row may be headers; we just filter A column equals recordId
  return rows.filter((r) => String(r?.[0] || "").trim() === recordId);
}

/* Parse row into a normalized “form data” shape */
function parseMainRow(sheetType, row) {
  // Common columns (both sheets)
  // 0 recordId
  // 1 timestamp
  // 2 clientName
  // 3 contactEmail
  // 4 phoneNumber
  // 5 organisationType
  // 6 contactPerson
  // 7 projectSite
  // 8 crushDate
  // 9 concreteType
  // 10 cementType
  // 11 slump
  // 12 ageDays
  // 13 cubesCount
  // 14 concreteGrade

  const common = {
    recordId: row?.[0] || "",
    timestamp: row?.[1] || "",
    clientName: row?.[2] || "",
    contactEmail: row?.[3] || "",
    phoneNumber: row?.[4] || "",
    organisationType: row?.[5] || "",
    contactPerson: row?.[6] || "",
    projectSite: row?.[7] || "",
    crushDate: row?.[8] || "",
    concreteType: row?.[9] || "",
    cementType: row?.[10] || "",
    slump: row?.[11] || "",
    ageDays: row?.[12] || "",
    cubesCount: row?.[13] || "",
    concreteGrade: row?.[14] || "",
  };

  // Office-use-only fields:
  // We’ll support either sheet having these columns after the “notes”
  // testedBy, testedDate, compressiveStrength, remarks
  function parseOfficeUse(startIndex) {
    return {
      testedBy: row?.[startIndex] || "",
      testedDate: row?.[startIndex + 1] || "",
      compressiveStrength: row?.[startIndex + 2] || "",
      officeRemarks: row?.[startIndex + 3] || "",
    };
  }

  if (sheetType === "ratio") {
    // Ratio sheet layout (from our optimized submit.js):
    // 15 ratioCement
    // 16 ratioFine
    // 17 ratioCoarse
    // 18 waterCementRatio (ONLY once)
    // 19 mixRatioString
    // 20 notes
    // 21..24 optional office-use fields (if you added them)
    const office = parseOfficeUse(21);

    return {
      ...common,
      inputMode: "ratio",
      ratioCement: row?.[15] ?? "1",
      ratioFine: row?.[16] ?? "",
      ratioCoarse: row?.[17] ?? "",
      waterCementRatio: row?.[18] ?? "",
      mixRatioString: row?.[19] ?? "",
      notes: row?.[20] ?? "",
      cementKgm3: "",
      waterKgm3: "",
      fineKgm3: "",
      coarseKgm3: "",
      wcRatio: row?.[18] ?? "", // in ratio mode wcRatio equals waterCementRatio for PDF display
      officeUse: office,
    };
  }

  // kgm3 sheet layout:
  // 15 cementKgm3
  // 16 waterKgm3
  // 17 fineKgm3
  // 18 coarseKgm3
  // 19 wcRatio
  // 20 mixRatioString
  // 21 notes
  // 22..25 optional office-use fields
  const office = parseOfficeUse(22);

  return {
    ...common,
    inputMode: "kgm3",
    cementKgm3: row?.[15] ?? "",
    waterKgm3: row?.[16] ?? "",
    fineKgm3: row?.[17] ?? "",
    coarseKgm3: row?.[18] ?? "",
    wcRatio: row?.[19] ?? "",
    mixRatioString: row?.[20] ?? "",
    notes: row?.[21] ?? "",
    ratioCement: "1",
    ratioFine: "",
    ratioCoarse: "",
    waterCementRatio: "",
    officeUse: office,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const recordId = String(req.query.appNo || "").trim();
    if (isMissing(recordId)) {
      return res.status(400).json({ success: false, message: "Missing appNo" });
    }

    const spreadsheetId = process.env.SHEET_ID;
    const rawCreds = process.env.GOOGLE_SERVICE_CREDENTIALS;

    if (isMissing(spreadsheetId) || isMissing(rawCreds)) {
      return res.status(500).json({ success: false, message: "Server not configured" });
    }

    const credentials = JSON.parse(rawCreds);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const titles = await getAllSheetTitles(sheets, spreadsheetId);
    const ratioSheet = resolveSheetTitleFromTitles(titles, SHEET_RATIO_CANDIDATES);
    const kgm3Sheet = resolveSheetTitleFromTitles(titles, SHEET_KGM3_CANDIDATES);

    if (!ratioSheet || !kgm3Sheet) {
      return res.status(500).json({
        success: false,
        message: "Main sheets not found. Check tab names.",
      });
    }

    // Look for the record in Ratio sheet first, then kgm3
    let mainRow = await findRowByRecordId(sheets, spreadsheetId, ratioSheet, recordId);
    let mainType = "ratio";

    if (!mainRow) {
      mainRow = await findRowByRecordId(sheets, spreadsheetId, kgm3Sheet, recordId);
      mainType = "kgm3";
    }

    if (!mainRow) {
      return res.status(404).json({ success: false, message: "Application number not found." });
    }

    const data = parseMainRow(mainType === "ratio" ? "ratio" : "kgm3", mainRow);

    // Fetch admixtures + scms for this recordId
    const admRows = await getChildRowsByRecordId(sheets, spreadsheetId, SHEET_ADMIXTURES, recordId);
    const scmRows = await getChildRowsByRecordId(sheets, spreadsheetId, SHEET_SCMS, recordId);

    // Expected child schema:
    // Admixtures: [recordId, timestamp, clientName, index, name, dosage]
    const admixtures = admRows.map((r) => ({
      name: r?.[4] || "",
      dosage: r?.[5] || "",
    })).filter((a) => a.name || a.dosage);

    // SCMs: [recordId, timestamp, clientName, index, name, percent]
    const scms = scmRows.map((r) => ({
      name: r?.[4] || "",
      percent: r?.[5] || "",
    })).filter((s) => s.name || s.percent);

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        admixtures,
        scms,
      },
    });
  } catch (err) {
    console.error("Lookup API error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
}
