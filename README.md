# UNILAG Concrete Lab – Mix Intake & PDF Report System

---

## What the System Does (End‑to‑End)

1. **User fills the web form** (`index.html`) and clicks **Submit**.
2. **Styling** (`style.css`) keeps the UI clear, responsive, and accessible.
3. **Client script** (`script.js`):
   - Validates that all fields are filled (numerics can be `0` where not applicable).
   - Sends the payload to the server endpoint (`/api/submit`).
   - If the server saves successfully, receives an **Application Number**.
   - Generates a **one‑page PDF** with the logo, all data, and an “Office Use Only” box.
   - Shows a **modal** with the assigned **Application Number**.
4. **Server function** (`/api/submit` in `submit.js`):
   - Checks that the request is **POST** and all required fields are present.
   - Reads the **last used Application Number** from **column C** of the Google Sheet.
   - Computes the **next ID** in the format `UNILAG-CL-[A-Z][6 digits]` (rolls over digits and letters A→Z→A).
   - Appends the full row to the sheet (timestamps, mix, derived w/c).
   - Returns `{ success: true, applicationNumber }` to the browser.
5. **Dependencies** (`package.json`) declares `googleapis` for server-side Sheets access.

---
---

## Environment & Deployment

- **Required env vars** (set in Environment Variables):
  - `GOOGLE_SERVICE_CREDENTIALS` – the **entire** service account JSON (stringified).
  - `SHEET_ID` – the Google Spreadsheet ID (the long ID in the Sheet URL).

- ## Google Sheets setup

  Create a Google Sheet and note its ID. Use a sheet named **Sheet1** with headers (row 1). Suggested columns (A→Z) to match the saved row order:

  1. **Timestamp (server)**
  2. **Crushing Date**
  3. **Application Number**
  4. **Client**
  5. **Project**
  6. **Email**
  7. **Phone**
  8. **Cement Brand**
  9. **Manufacturer's Cement Type**
  10. **Cement Type**
  11. **SP Name**
  12. **Cement**
  13. **Slag**
  14. **Fly Ash**
  15. **Silica Fume**
  16. **Limestone Filler**
  17. **Water**
  18. **Superplasticizer**
  19. **Coarse Agg**
  20. **Fine Agg**
  21. **Derived w/c**
  22. **Slump (mm)**
  23. **Age (days)**
  24. **Target (MPa)**
  25. **Cubes Count**
  26. **Notes**

> The API writes to `Sheet1!A:Z`. Ensure the sheet name and range match or adjust in `submit.js`.

---

## Local Testing (Vercel)
```bash
npm i
npm run dev
# Open http://localhost:3000 to test
```

---

## Notes on Validation & Safety

- The client blocks submit until **all fields** are valid; numeric fields allow `0`.
- On any server error, the UI insists on **Retry Save** and does **not** generate a PDF or display an Application Number.
- Application Numbers are **server-assigned** and monotonically increase with rollover from `A999999` → `B000001`, through `Z999999` → `A000001`.

---

## Credits
- 
- University of Lagos – Department of Civil & Environmental Engineering, Concrete Laboratory.
- jsPDF for client‑side PDF generation.
