# UNILAG Concrete Laboratory – External Client Cube Test System

This project provides a complete **end-to-end intake system** for external client concrete cube tests at the University of Lagos. It includes a responsive web form, automatic validation, Google Sheets integration, and a one-page PDF report generator.

---

## What the System Does (Simple Overview)

1. **User fills the form** and clicks **Submit**.  
   (Form structure and UI: `index.html`)

2. **Styling** keeps the interface clean, responsive, and UNILAG-branded.  
   (Theme and layout: `style.css`)

3. **Client script** (`script.js`):
   - Validates all required fields.
   - Supports **kg/m³** or **ratio** input modes.
   - Computes **Water–Cement Ratio** and **Normalized Mix Ratio**.
   - Sends data to the server endpoint `/api/submit`.
   - Receives a unique **Application Number**.
   - Generates a **one-page PDF** with the UNILAG logo and all submitted data.  
     (Front-end logic: `script.js`)

4. **Server function** (`submit.js`):
   - Accepts only `POST` requests.
   - Validates payload fields.
   - Retrieves the **last issued Application Number**.
   - Generates the next ID in the format:  
     **`UNILAG-CL-K######`** (kg mode) or  
     **`UNILAG-CL-R######`** (ratio mode)
   - Computes server-side W/C and mix ratios.
   - Appends the new row to the correct Google Sheet tab.
   - Returns `{ success: true, applicationNumber }`.  
     (API handler: `submit.js`)

5. **Dependencies** (`package.json`)  
   - Uses the Google Sheets API via `googleapis`.  
     (Dependencies: `package.json`)

---

## Environment Setup

Set these environment variables in your hosting platform:

- **`GOOGLE_SERVICE_CREDENTIALS`**  
  The full service account JSON, stringified.

- **`SHEET_ID`**  
  The ID of your Google Spreadsheet.

If either is missing, the server returns a configuration error.

---

## Google Sheets Requirements

Create a Google Sheet and share it with the service account.

The system uses two tabs:

- **Client Sheet (Kg/m3)** – for kg/m³ submissions  
- **Client Sheet (Ratios)** – for ratio-based submissions  

Each row stored includes:

- Timestamp  
- Client & contact info  
- Project/site details  
- Cube testing parameters  
- Raw mix values + derived W/C ratio  
- Normalized mix ratio string  
- Notes

Admixtures and SCMs are appended to their respective sheets when present.

---

## Validation & Safety

- The frontend blocks submission until **all required fields** are filled.  
  (Validation: `script.js`)

- The server re-validates before saving.  
  (Backend validation: `submit.js`)

- If saving fails, **no PDF is generated** and the user must retry.

- Application numbers always increase and rollover safely (e.g., `K999999 → K000001`).  
  (ID generator: `submit.js` → `nextRecordId()`)

---

## Credits
- **Jesuto Ilugbo** – Project Lead & App Developer 
- **University of Lagos** – Department of Civil & Environmental Engineering  
- **jsPDF** for client-side PDF generation  
- **Google Sheets API** for cloud data storage