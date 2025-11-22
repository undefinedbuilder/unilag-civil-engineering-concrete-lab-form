# UNILAG Concrete Laboratory – External Client Cube Test System

This project provides a comprehensive **end-to-end intake system** for external client/commercial concrete cube tests at the University of Lagos. It includes a responsive UNILAG-branded web form, automatic validation, Google Sheets integration, a local archive of client mixes, and a one-page PDF report generator.   

---

## What the System Does (Simple Overview)

1. **Client fills the form** and clicks **Submit, Save & Generate PDF**.  
   - Captures company/client details, contact person, project/site, mix overview, and cube testing parameters.
   - Supports **chemical admixtures** and **partial cement replacements (SCMs)** as dynamic add/remove rows.

3. **Front-end script** (`script.js`):
   - Validates all required fields for client, project, mix, and cube test information before submitting.  
   - Supports **two input modes**:  
     - **Kg/m³ mode** – Cement, water, fine/medium/coarse aggregates as absolute quantities.
     - **Ratio mode** – Material ratios by cement (cement defaults to 1).
   - Computes and displays:  
     - **Water–Cement Ratio** (W/C).  
     - **Normalized Mix Ratio (by cement)** from kg/m³ inputs.
   - Manages **dynamic rows** for:  
     - Chemical admixtures (name + dosage L/100 kg).
     - SCMs (name + replacement percentage).
   - Saves each submitted mix to **browser localStorage** under a dedicated key and shows them in the **Saved Research Mixes** table
   - Renders the **Saved Client Mixes** table with: App No, input mode, client/company, type, W/C, and saved timestamp; clicking a row reloads that mix into the form.
   - Provides buttons to **Export CSV** and **Clear All** saved records.   
   - Sends the mix data to the server endpoint **`/api/submit`** as JSON and receives a unique **Application Number**.
   - Shows the Application Number in a modal dialog and generates a **one-page PDF** with the UNILAG logo and all submitted data.   

4. **Server function** (`submit.js`):
   - Accepts only `POST` requests and returns `405` for other methods.  
   - Validates `inputMode` (must be `"kg"` or `"ratio"`).
   - Checks for missing required fields using:  
     - A **common** field list (client, contact, organisation type, project, crush date, concrete/cement type, slump, age, cube count, target strength, notes).
     - **Kg/m³-specific** fields: cementContent, waterContent, fineAgg, mediumAgg, coarseAgg.
     - **Ratio-specific** fields: ratioCement, ratioFine, ratioMedium, ratioCoarse, ratioWater.
   - Uses `GOOGLE_SERVICE_CREDENTIALS` and `SHEET_ID` with `googleapis` to talk to the Google Sheets API.
   - Reads the **last Application Number** from the correct sheet and generates the next ID in the format:  
     - **`UNILAG-CL-K######`** – kg/m³ submissions  
     - **`UNILAG-CL-R######`** – ratio submissions   
   - Computes server-side **W/C ratio** and **normalized mix ratio string** for both kg and ratio modes.
   - Appends the main record to the correct Google Sheet tab:  
     - **`Client Sheet (Kg/m3)`** or **`Client Sheet (Ratios)`**.
   - Appends any **admixtures** to `Client Admixtures` and any **SCMs** to `Client SCMs`.
   - Returns JSON such as:  
     ```json
     {
       "success": true,
       "recordId": "UNILAG-CL-K000001",
       "mixRatioString": "1 : ...",
       "wcRatio": 0.45
     }
     ```  

5. **Dependencies** (`package.json`)  
   - Uses the **Google Sheets API** via the official `googleapis` client library.

---

## Environment Setup

Set these environment variables in your hosting platform (Vercel, Netlify, etc.):

- **`GOOGLE_SERVICE_CREDENTIALS`**  
  The full **service account JSON**, stringified (for example: `JSON.stringify({ ... })`).

- **`SHEET_ID`**  
  The ID of your Google Spreadsheet (the long ID inside the sheet URL).

If either is missing or invalid, the server responds with a **500 – Server not configured (missing Google credentials)** error.

---

## Google Sheets Requirements

Create a Google Sheet and **share it with the service account email** from your `GOOGLE_SERVICE_CREDENTIALS`.

The system uses **four tabs**:

1. **Client Sheet (Kg/m3)** – for kg/m³-based client mixes.
2. **Client Sheet (Ratios)** – for ratio-based client mixes.
3. **Client Admixtures** – for per-mix admixture rows (optional).
4. **Client SCMs** – for per-mix partial cement replacement rows (SCMs).

Each main **Client Sheet** row stores (columns A–W):

- Application Number (e.g. `UNILAG-CL-K000123`)  
- Timestamp (ISO string)  
- Client/company name, contact email, phone  
- Organisation type  
- Contact person  
- Project/site  
- Crushing date  
- Concrete type  
- Cement type  
- Slump (mm)  
- Age at testing (days)  
- Number of cubes submitted  
- Target compressive strength (MPa)  
- Either:  
  - Cement, water, fine, medium, and coarse aggregates (kg/m³), or  
  - Cement, fine, medium, coarse aggregates, and water (ratios)  
- Computed **W/C ratio** (numeric)  
- **Normalized mix ratio** string  
- Notes (e.g., grade of concrete, site information)  

Each **Client Admixtures** row stores:

- Application Number, timestamp  
- Client name  
- Contact email  
- Admixture index (1, 2, 3, …)  
- Admixture name  
- Dosage (L/100 kg of cement)  

Each **Client SCMs** row stores:

- Application Number, timestamp  
- Client name  
- Contact email  
- SCM index (1, 2, 3, …)  
- SCM name  
- SCM replacement percentage (%)  

---

## Local Client Archive (Browser Storage)

To help clients and lab staff manage multiple submissions **before** or alongside server submission, the front-end maintains a **local archive**:

- All successfully submitted mixes are saved in `localStorage` under:  
  `unilag-concrete-lab-client-mixes`.
- The **Saved Client Mixes** table displays:  
  - Application Number  
  - Input mode (Kg/m³ or Ratio)  
  - Client / Company  
  - Concrete type  
  - W/C ratio (formatted)  
  - Date/time saved.   
- Clicking a row **loads that record back into the form**, including admixtures and SCMs, so that it can be edited or re-submitted.   
- Users can:  
  - **Export CSV** of all locally stored client mixes.
  - **Clear All** saved records from the browser.

---

## Validation & Safety

- The front-end blocks submission until **all required fields** are filled, including conditional “Other” text boxes for concrete or cement type when selected.   
- Any partially filled **admixture** or **SCM** rows are treated as incomplete and not included unless both name and dosage/percent are supplied.
- The server **re-validates everything** and rejects requests with any missing critical data.
- Both front-end and back-end compute W/C ratio and normalized mix ratio; the server result is treated as the **source of truth** and is used to update the UI before generating the PDF.   
- Application numbers **always increase** and safely roll over if they reach `999999` (e.g., `UNILAG-CL-K999999 → UNILAG-CL-K000001`).
- If the API call fails for any reason, the system still:
  - Saves the mix locally,  
  - Generates the PDF, and  
  - Shows a clear status message that the server submission did not succeed.  

---

## Credits

- **Jesuto Ilugbo** – Project Lead & App Developer
- **University of Lagos** – Department of Civil & Environmental Engineering  
- **jsPDF** – for client-side PDF generation of the External Client Cube Test Report.
- **Google Sheets API (`googleapis`)** – for secure cloud data storage of client mixes, admixtures, and SCMs.
