# UNILAG Concrete Laboratory – Research Mix Cube Test System

This project provides a comprehensive **end-to-end intake system** for student and research concrete cube tests at the University of Lagos. It includes a vintage-style web form, automatic validation, Google Sheets integration, a local archive of mixes, and a one-page PDF report generator.

---

## What the System Does (Simple Overview)

1. **Student / researcher fills the form** and clicks **Submit, Save & Generate PDF**.  
   - Captures student details, supervisor, thesis title, mix overview, and cube testing parameters.
   - Supports **chemical admixtures** and **partial cement replacements (SCMs)** as dynamic rows.

3. **Front-end script**
   - Validates all required fields (student info, mix details, kg/ratio inputs, and any partially filled admixture/SCM rows). 
   - Supports **two input modes**:  
     - **Kg/m³ mode** – Cement, water, fine/medium/coarse aggregates as absolute quantities.
     - **Ratio mode** – Cement-based ratios for aggregates and water (cement defaults to 1).
   - Computes and displays:  
     - **Water–Cement Ratio** (W/C).
     - **Normalized Mix Ratio (by cement)** from either kg/m³ or ratio inputs.
   - Manages **dynamic rows** for chemical admixtures and SCMs (add/remove with buttons).
   - Saves each submitted mix to **browser localStorage** under a dedicated key and shows them in the **Saved Research Mixes** table.
   - Allows users to:  
     - **Click a saved row** to load that mix back into the form.
     - **Export all saved mixes as CSV**.
     - **Clear all local records** from the browser.
   - Sends the mix data to the server endpoint **`/api/submit`** as JSON.
   - Receives a unique **Application Number** and shows it in a modal dialog (Application Number card).
   - Generates a **one-page PDF** with the UNILAG logo and all submitted data (research-specific layout). 

4. **Server function** (`submit.js`):
   - Accepts only `POST` requests and rejects all other methods with `405`.  
   - Validates `inputMode` (must be `"kg"` or `"ratio"`).
   - Checks for missing required fields using three lists:  
     - **Common** (student, supervisor, mix, and cube test info).
     - **Kg/m³-specific** fields.
     - **Ratio-specific** fields. 
   - Uses `GOOGLE_SERVICE_CREDENTIALS` and `SHEET_ID` to authenticate with the Google Sheets API via `googleapis`.
   - Reads the **last Application Number** from the appropriate sheet and generates the next ID in the format:  
     - **`UNILAG-CR-K######`** – kg/m³ submissions  
     - **`UNILAG-CR-R######`** – ratio submissions
   - Computes **server-side** W/C ratio and normalized mix ratio using:  
     - `kgRatioCalc()` for kg/m³ values.  
     - `ratioCalc()` for ratio values.
   - Appends the main record to the correct Google Sheet tab:  
     - **`Research Sheet (Kg/m3)`** or **`Research Sheet (Ratios)`**.
   - Appends any **admixtures** to `Research Admixtures` and any **SCMs** to `Research SCMs`.
   - Returns JSON:  
     ```json
     {
       "success": true,
       "recordId": "UNILAG-CR-K000001",
       "mixRatioString": "1 : ...",
       "wcRatio": 0.45
     }
5. **Dependencies** (`package.json`)  
   - Uses the **Google Sheets API** via the official `googleapis` client.

---

## Environment Setup

Set these environment variables in your hosting platform:

- **`GOOGLE_SERVICE_CREDENTIALS`**  
  The full **service account JSON**, stringified (e.g. `JSON.stringify({...})`).

- **`SHEET_ID`**  
  The ID of your Google Spreadsheet (the long ID in the Sheet URL).

If either is missing or invalid, the server responds with a **500 – Server misconfigured: Missing sheet or credentials** error. 

---

## Google Sheets Requirements

Create a Google Sheet and **share it with the service account email** from your `GOOGLE_SERVICE_CREDENTIALS`. The system uses **four tabs**:

1. **Research Sheet (Kg/m3)** – for kg/m³-based research mixes.
2. **Research Sheet (Ratios)** – for ratio-based research mixes.
3. **Research Admixtures** – for per-mix admixture rows.
4. **Research SCMs** – for per-mix partial cement replacements (SCMs).

Each main **Research Sheet** row stores:

- Application Number (e.g. `UNILAG-CR-K000123`)  
- Timestamp (ISO string)  
- Student & contact info (name, matric number, phone, programme, supervisor)  
- Thesis title  
- Crushing date and concrete/cement type  
- Slump/flow, age at testing, number of cubes, target strength  
- Either:  
  - Cement, water, fine/medium/coarse aggregates (kg/m³), or  
  - Cement, fine/medium/coarse aggregates, water (ratios)  
- Computed **W/C ratio**  
- Computed **normalized mix ratio string**  
- Notes (e.g., grade of concrete or special remarks)

Each **Research Admixtures** row stores:

- Application Number, timestamp  
- Student name, matric number  
- Admixture index (1, 2, 3, …)  
- Admixture name  
- Dosage (L/100 kg of cement)

Each **Research SCMs** row stores:

- Application Number, timestamp  
- Student name, matric number  
- SCM index (1, 2, 3, …)  
- SCM name  
- SCM replacement percentage (%)

---

## Local Research Archive (Browser Storage)

To make it easy for students and lab staff to manage multiple mixes **before** or **alongside** server submission, the front-end keeps a **local archive**:

- All successfully submitted mixes are saved in `localStorage` under the key:  
  `unilag-concrete-lab-research-mixes`.
- The **Saved Research Mixes** table shows a compact list with:  
  - Application Number  
  - Input mode (Kg/m³ or Ratio)  
  - Student / Researcher name  
  - Concrete type  
  - W/C ratio (formatted to 2 d.p.)  
  - Date/time when it was saved.
- Clicking a row **loads that record back into the form**, including admixtures and SCMs so that it can be edited or re-submitted.
- Users can **Export CSV** of all locally stored research mixes or **Clear All** records from the browser.

---

## Validation & Safety

- The frontend blocks submission until **all required fields** are filled, including conditionally required fields when “Other” is selected for concrete or cement type.
- Any partially filled **admixture** or **SCM** rows are treated as incomplete and flagged until both name and dosage/percent are entered. 
- The server **re-validates everything**, ensuring no record is written to the Sheet with missing critical data.
- Both front-end and back-end compute W/C ratio and mix ratio; the server result is treated as the **source of truth** and used to update the UI before generating the PDF.   
- Application numbers **always increase** and are robust to gaps or malformed old entries:  
  `UNILAG-CR-K999999 → UNILAG-CR-K000001`. 
- If the API call fails for any reason, the system still:  
  - Saves the mix locally,  
  - Generates the PDF, and  
  - Shows a clear status message that the server submission did not succeed.

---

## Credits

- **Jesuto Ilugbo** – Project Lead & App Developer
- **University of Lagos** – Department of Civil & Environmental Engineering  
- **jsPDF** – for client-side PDF generation of the Research Mix Cube Test Intake Form.
- **Google Sheets API (`googleapis`)** – for secure cloud data storage of research mixes, admixtures, and SCMs.


