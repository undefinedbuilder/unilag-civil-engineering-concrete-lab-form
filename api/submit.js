import { google } from 'googleapis';

// Reuseable helper to compute the next ID from the last one.
// Format: UNILAG-CL-[A-Z][6 digits], e.g., UNILAG-CL-A000001
function nextIdFrom(last) {
  if (!last || typeof last !== 'string') return 'UNILAG-CL-A000001';
  const m = last.trim().match(/^UNILAG-CL-([A-Z])(\d{6})$/);
  if (!m) return 'UNILAG-CL-A000001';
  let letter = m[1].charCodeAt(0);
  let num = parseInt(m[2], 10) + 1;
  if (num > 999999) {
    num = 1;
    letter = letter + 1;
  }
  if (letter > 90) letter = 65; // wrap to A after Z
  return `UNILAG-CL-${String.fromCharCode(letter)}${String(num).padStart(6, '0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const {
      // Client / Project
      clientName, projectSite, email, phone, crushingDate,
      // Cement
      cementBrand, manufacturerCementType, cementType,
      // Superplasticizer Name
      spName,
      // Mix composition
      cement, slag, flyAsh, silicaFume, limestone, water, superplasticizer, coarseAgg, fineAgg,
      // Slump
      slump,
      // Age & Target & Cubes
      ageDays, targetMPa, cubesCount,
      // Notes
      notes
    } = req.body || {};

    // Application number is NO LONGER required in the request body (server will assign)
    const requiredKeys = [
      'clientName','projectSite','email','phone','crushingDate',
      'cementBrand','manufacturerCementType','cementType','spName',
      'cement','slag','flyAsh','silicaFume','limestone','water','superplasticizer','coarseAgg','fineAgg',
      'slump','ageDays','targetMPa','cubesCount','notes'
    ];
    for (const k of requiredKeys) {
      if (req.body[k] === undefined || req.body[k] === '') {
        return res.status(400).json({ success:false, message:`Missing field: ${k}` });
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.SHEET_ID;

    // 1) Read the last non-empty Application Number from column C to assign a new one
    const rangeAppCol = 'Sheet1!C:C';
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: rangeAppCol,
    });
    const values = resp.data.values || [];
    let lastVal = null;
    for (let i = values.length - 1; i >= 0; i--) {
      const v = (values[i] && values[i][0]) ? String(values[i][0]).trim() : '';
      if (v) { lastVal = v; break; }
    }
    const applicationNumber = nextIdFrom(lastVal);

    // 2) Append the row with the newly assigned application number
    const when = new Date().toISOString();
    const derivedWc = (Number(cement) > 0 ? (Number(water)/Number(cement)) : 0);

    const row = [[
      // Timestamp (server) & Crushing Date
      when, crushingDate,
      // Application Number (server-assigned)
      applicationNumber,
      // Client
      clientName, projectSite, email, phone,
      // Cement fields
      cementBrand, manufacturerCementType, cementType, spName,
      // Mix composition
      cement, slag, flyAsh, silicaFume, limestone, water, superplasticizer, coarseAgg, fineAgg,
      // Derived w/c
      derivedWc,
      // Slump, Age, Target, Cubes
      slump, ageDays, targetMPa, cubesCount,
      // Notes
      notes
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: row }
    });

    // 3) Return success + the assigned application number
    res.status(200).json({ success: true, applicationNumber });
  } catch (err) {
    console.error('submit error:', err);
    res.status(500).json({ success:false, message: 'Save failed' });
  }
}
