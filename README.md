# UNILAG Concrete Lab – Mix Intake Form

A free web application for the **Department of Civil and Environmental Engineering, Concrete Laboratory, University of Lagos**.  

This app allows clients and researchers to submit details of their concrete mix proportions, automatically save the data to a Google Sheet, and download a PDF report with UNILAG’s letterhead and logo.  

If saving to Google Sheets fails (e.g., network or authentication issues), the app **still generates the PDF** and provides a **Retry Save** button to attempt saving again without retyping the form.

---

## ✨ Features

- **Form Sections**
  - Client / Project Details (with Date field, defaults to today)
  - Cement Information (Brand, Manufacturer’s Cement Type, Cement Type)
  - Superplasticizer Information (Name only)
  - Mix Composition (Cement, Slag, Fly Ash, Silica Fume, Limestone Filler, Water, Superplasticizer dosage, Coarse Aggregate, Fine Aggregate — all in kg/m³)
  - Slump / Workability (mm)
  - Age & Target Strength Information (Age in days, Target Compressive Strength in MPa)
  - Additional Notes (enter **Nil** if none)

- **Validation**
  - All fields are required.
  - Numeric fields must be filled (use **0** where a component is not included).
  - Notes must contain text or “Nil”.
  - Form cannot submit unless all sections are filled.

- **Submission & Storage**
  - Data is sent to a Vercel serverless function (`/api/submit`) and stored in a Google Sheet.
  - A derived **water/cement (w/c) ratio** is calculated and stored.

- **PDF Generation**
  - Automatically downloaded after submission.
  - Header includes:
    - UNILAG Logo
    - `DEPARTMENT OF CIVIL AND ENVIRONMENTAL ENGINEERING`
    - `FACULTY OF ENGINEERING`
    - `CONCRETE LABORATORY`
  - Body includes:
    - All submitted data
    - Derived w/c ratio
    - Notes
  - Footer: “Generated electronically by the Concrete Laboratory, University of Lagos.”
  - Filename format: **`<ClientName>_<Date>.pdf`**

- **Retry Save**
  - If Google Sheets save fails, PDF still downloads.
  - A **Retry Save** button appears, using the same data payload (no retyping required).

- **User Experience**
  - Date resets to today after each submission.
  - Success messages shown in **green**, error messages in **red**.

---

## 📊 Google Sheet Setup

1. Create a Google Sheet with the following headers in row 1:
Timestamp (server) | Date | Client | Project | Email | Phone | Cement Brand | Manufacturer's Cement Type | Cement Type | SP Name |
Cement | Slag | Fly Ash | Silica Fume | Limestone Filler | Water | SP (kg/m³) | Coarse Agg | Fine Agg |
Slump (mm) | Age (days) | Target (MPa) | Derived w/c | Notes