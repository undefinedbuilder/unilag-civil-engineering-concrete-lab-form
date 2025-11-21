# UNILAG Concrete Lab – Research Mix Intake Webform

---

## What the System Does

1. **User fills the Research Mix Form** (`index.html`) with all required student, mix, and project details.
2. **Styling** (`style.css`) ensures a clean, responsive, professional UNILAG-branded interface.
3. **Client script** (`script.js`):
   - Validates all required fields (text, numeric, dates, ratios, kg/m³ values).
   - Dynamically handles **Admixtures** and **SCMs** with add/remove rows.
   - Auto-calculates:
     - **Water–Cement Ratio**
     - **Normalized Mix Ratio** (for both kg/m³ mode and ratio mode)
   - Allows switching between:
     - **Kg/m³ Input Mode**, or  
     - **Ratio Input Mode**
   - Sends data to the backend (`/api/submit`) for Sheets storage.
   - Saves a full local copy inside **LocalStorage** for offline retrieval.
   - Generates a **UNILAG-header PDF** with logo, details, and an “Office Use Only” section.
   - Shows a modal containing the **Application Number** assigned by the server.

4. **Server function** (`submit.js`):
   - Ensures request method is **POST** and validates all required fields.
   - Determines whether data belongs to:
     - **Research Sheet (Kg/m3)** or  
     - **Research Sheet (Ratios)**
   - Reads the **last used Application Number** from the correct sheet.
   - Computes the next ID using the format:  
     **`UNILAG-CR-Kxxxxxx`** or **`UNILAG-CR-Rxxxxxx`**
   - Calculates w/c ratio and mix ratio (if missing).
   - Saves:
     - 1 main record row  
     - All **Admixtures** to *Research Admixtures*  
     - All **SCMs** to *Research SCMs*
   - Returns `{ success: true, recordId, wcRatio, mixRatioString }`.

5. **package.json**
   - Declares `googleapis` for server-side Sheets integration.

---

---

## Environment & Deployment

### Required Environment Variables

Set these in your deployment platform:
GOOGLE_SERVICE_CREDENTIALS = (Stringified JSON of Google Service Account)
SHEET_ID = (Google Spreadsheet ID)

### Google Sheets Setup

You must create **three sheets** in the same spreadsheet:

1. **Research Sheet (Kg/m3)**  
2. **Research Sheet (Ratios)**  
3. **Research Admixtures**  
4. **Research SCMs**

Ensure the column structure matches the `submit.js` layout for each sheet.

#### Required Column Sections (Main Research Sheets)

Columns typically include:

- Application Number  
- Timestamp  
- Student & Project Info  
- Concrete Type, Cement Type, Slump  
- Either **kg/m³ values** or **ratio values**  
- Derived W/C  
- Derived Mix Ratio  
- Notes

> The API writes to ranges like:  
> `Research Sheet (Kg/m3)!A:U` or  
> `Research Sheet (Ratios)!A:U`  
> Make sure the ranges match your actual sheet names.

---

---

## Notes on Validation, Calculations & Safety

- The form **blocks submission** until all mandatory fields are valid.
- Errors are shown clearly using highlighted fields and a summary box.
- **Offline saving** is automatic — every successful submission is stored in LocalStorage.
- W/C ratio and Mix Ratio are re-computed both client-side and server-side to ensure consistency.
- The Application Number is assigned **exclusively on the server**, ensuring uniqueness.
- A modal confirms successful save with the generated **Application Number**.
- No PDF is created unless the Google Sheets save succeeds.

---

## Credits

- **University of Lagos – Department of Civil & Environmental Engineering, Concrete Laboratory**  
- Built with:  
  - jsPDF for PDF generation  
  - Google Sheets API for cloud storage  
  - Vanilla JavaScript for client logic  
  - Custom UNILAG-themed UI styling

---