// File: api/submit.js
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const {
      // Client / Project
      clientName, projectSite, email, phone, testDate,
      // Cement
      cementBrand, manufacturerCementType, cementType,
      // Superplasticizer Name
      spName,
      // Mix composition
      cement, slag, flyAsh, silicaFume, limestone, water, superplasticizer, coarseAgg, fineAgg,
      // Slump
      slump,
      // Age & Target
      ageDays, targetMPa,
      // Notes
      notes
    } = req.body || {};

    const requiredKeys = [
      'clientName','projectSite','email','phone','testDate',
      'cementBrand','manufacturerCementType','cementType','spName',
      'cement','slag','flyAsh','silicaFume','limestone','water','superplasticizer','coarseAgg','fineAgg',
      'slump','ageDays','targetMPa','notes'
    ];
    for (const k of requiredKeys) {
      if (req.body[k] === undefined || req.body[k] === '') {
        return res.status(400).json({ success:false, message:`Missing field: ${k}` });
      }
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.SHEET_ID;

    const when = new Date().toISOString();
    const values = [[
      // Timestamp (server) & user-provided Date
      when, testDate,
      // Client
      clientName, projectSite, email, phone,
      // Cement fields
      cementBrand, manufacturerCementType, cementType, spName,
      // Mix composition
      cement, slag, flyAsh, silicaFume, limestone, water, superplasticizer, coarseAgg, fineAgg,
      // Slump, Age, Target
      slump, ageDays, targetMPa,
      // Derived
      (Number(cement) > 0 ? (Number(water)/Number(cement)) : 0),
      // Notes
      notes
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:Z',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message: err.message });
  }
}