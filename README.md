# UNILAG Concrete Lab – Mix Intake & PDF Report System

A free web application built for the  
**Department of Civil and Environmental Engineering, Concrete Laboratory, University of Lagos.**

This system allows clients and researchers to submit **concrete mix proportions** through a form. Submitted data is:

- ✅ Saved into a **Google Sheet** (for lab records)  
- ✅ Exported into a professional **PDF report** (with UNILAG logo & letterhead)  
- ✅ Automatically downloaded to the client’s device  

Even if saving to Google Sheets fails, the app **still generates the PDF** and provides a **Retry Save** button so staff can re-submit the same data without retyping the form.

---

## ✨ Features

### 🔹 Form Sections
The form is divided into clear sections:

1. **Client / Project Details**
   - Client / Requester Name  
   - Project / Site  
   - Contact Email  
   - Contact Phone  
   - **Crushing Date** (defaults to today, always full-width)

2. **Cement Information**
   - Cement Brand (Dangote, Lafarge, BUA)  
   - Manufacturer’s Cement Type (options update dynamically by brand)  
   - Cement Type (CEM I / CEM II options)

3. **Superplasticizer Information**
   - Superplasticizer Name  

4. **Mix Composition (kg/m³)**
   - Cement  
   - Blast Furnace Slag  
   - Fly Ash  
   - Silica Fume  
   - Limestone Filler  
   - Water  
   - Superplasticizer dosage (kg/m³)  
   - Coarse Aggregate  
   - Fine Aggregate  

   🔹 **Live Water/Cement Ratio Display**  
   - As the user enters water and cement, the system calculates and shows the **w/c ratio** in real-time on the webpage.

5. **Slump / Workability**
   - Slump (mm)

6. **Age & Target Strength Information**
   - Age (days)  
   - Target Compressive Strength (MPa)  
   - Number of Cubes to be Crushed  

7. **Additional Notes**
   - Free text (enter “Nil” if none)

---

### 🔹 Validation Rules
- Every field is **required**.  
- All numeric fields must be filled (enter **0** if not applicable).  
- Notes must contain either text or “Nil”.  
- The form **cannot submit** unless all fields are completed.  

---

### 🔹 Submission & Storage
- On submission, data is posted to a **Vercel serverless function (`/api/submit`)**.  
- Data is appended to a connected **Google Sheet**.  
- A derived **water/cement ratio** is also stored in the sheet.  

If saving fails:
- ❌ An error message appears in **red**.  
- ✅ The PDF is still generated.  
- 🔄 A **Retry Save** button appears, allowing staff to re-attempt sending the same data.

---

### 🔹 PDF Report
The PDF is auto-generated using [jsPDF](https://github.com/parallax/jsPDF).  
It is **always one page** and includes:

- **Header:**
  - UNILAG Logo (left)
  - Department, Faculty, and Lab name (stacked right)

- **Sections:**
  - Client & Project Info  
  - Cement Information  
  - Superplasticizer Information  
  - Mix Composition  
  - Slump / Workability  
  - Age, Target Strength, Cube Count  
  - Derived w/c ratio  
  - Additional Notes  

- **Office Use Only Box (bottom of page):**
FOR OFFICE USE ONLY

Crushed Compressive Strength (MPa): ______________________________

Tested on: ____________________

Remarks: ___________________________________________________________


---

### 🔹 User Experience
- **Crushing Date** always resets to today after submission.  
- **Submit button** is large, bold, and pinned at the bottom of the form.  
- **Retry Save** button only appears when Google Sheets save fails.  
- Status messages:
- ✅ Green = Success
- ❌ Red = Error

---

## 📊 Google Sheet Setup

Create a Google Sheet with headers in row 1:

Timestamp (server) | Crushing Date | Client | Project | Email | Phone |
Cement Brand | Manufacturer's Cement Type | Cement Type | SP Name |
Cement | Slag | Fly Ash | Silica Fume | Limestone Filler | Water | SP (kg/m³) |
Coarse Agg | Fine Agg | Slump (mm) | Age (days) | Target (MPa) | Cubes Count |
Derived w/c | Notes


---

