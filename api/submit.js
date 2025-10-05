import { google } from 'googleapis';

/* SECTION: Helper to compute the next Application Number
   Format UNILAG-CL-[A-Z][6 digits], wraps A..Z and rolls digits */
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
  if (letter > 90) letter = 65;
  return `UNILAG-CL-${String.fromCharCode(letter)}${String(num).padStart(6, '0')}`;
}

/* SECTION: Serverless entry – only accepts POST, validates fields,
   assigns application number, saves to Google Sheets, returns JSON */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const {
      clientName, projectSite, email, phone, crushingDate,
      cementBrand, manufacturerCementType, cementType,
      spName,
      cement, slag, flyAsh, silicaFume, limestone, water, superplasticizer, coarseAgg, fineAgg,
      slump,
      ageDays, targetMPa, cubesCount,
      notes
    } = req.body || {};

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

    /* SUBSECTION: Authorize Google Sheets API */
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.SHEET_ID;

    /* SUBSECTION: Read last used App Number from column C and compute the next */
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

    /* SUBSECTION: Compose and append the row */
    const when = new Date().toISOString();
    const derivedWc = (Number(cement) > 0 ? (Number(water)/Number(cement)) : 0);
    const row = [[
      when, crushingDate,
      applicationNumber,
      clientName, projectSite, email, phone,
      cementBrand, manufacturerCementType, cementType, spName,
      cement, slag, flyAsh, silicaFume, limestone, water, superplasticizer, coarseAgg, fineAgg,
      derivedWc,
      slump, ageDays, targetMPa, cubesCount,
      notes
    ]];
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: row }
    });

    /* SUBSECTION: Return success payload with assigned number */
    res.status(200).json({ success: true, applicationNumber });
  } catch (err) {
    console.error('submit error:', err);
    res.status(500).json({ success:false, message: 'Save failed' });
  }
}
