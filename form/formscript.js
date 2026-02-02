/* -----------------------------------------------------------
   UNILAG CONCRETE LAB – CLIENT FORM (Front-End)
   -----------------------------------------------------------
   This script handles:
   - Form UI behaviour (input mode switching, "Other" fields)
   - Dynamic rows (Admixtures + SCMs)
   - Validation + data collection
   - Derived W/C + derived mix ratio display
   - LocalStorage saving + table rendering + record loading
   - Submit to backend (/api/submitform) + PDF generation (jsPDF)
   - CSV export + clear all
----------------------------------------------------------- */

const STORAGE_KEY = "unilag-concrete-lab-client-mixes";
let logoImageDataUrl = null;

/* -----------------------------------------------------------
   Helpers
----------------------------------------------------------- */

function loadImageAsDataURL(path) {
  return fetch(path)
    .then((resp) => resp.blob())
    .then(
      (blob) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        })
    )
    .catch(() => null);
}

function sanitizeFilename(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function setDateToToday(inputEl) {
  if (!inputEl) return;
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
  inputEl.value = todayLocal;
}

/* -----------------------------------------------------------
   Status UI
----------------------------------------------------------- */

function setStatusLine(message, type = "info") {
  const el = document.getElementById("status-line");
  if (!el) return;

  if (!message) {
    el.style.display = "none";
    return;
  }

  el.style.display = "inline-flex";
  el.textContent = message;
  el.className = "status-pill";

  if (type === "success") el.classList.add("status-success");
  else if (type === "error") el.classList.add("status-error");
  else el.classList.add("status-info");
}

/* -----------------------------------------------------------
   Application number modal
----------------------------------------------------------- */

function showAppNumberModal(appNo) {
  const overlay = document.getElementById("appno-modal");
  const numberEl = document.getElementById("appno-modal-number");
  if (!overlay || !numberEl) return;

  numberEl.textContent = appNo || "";
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
}

function hideAppNumberModal() {
  const overlay = document.getElementById("appno-modal");
  if (!overlay) return;

  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
}

/* -----------------------------------------------------------
   Dynamic rows (Admixtures + SCMs)
----------------------------------------------------------- */

function createAdmixtureRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  row.innerHTML = `
    <label>
      <span class="label-line">Admixture Name <span class="required-asterisk">*</span></span>
      <input type="text" name="adm_name" value="${data.name || ""}">
    </label>

    <label>
      <span class="label-line">Dosage (% of weight of Cement) <span class="required-asterisk">*</span></span>
      <input type="text" name="adm_dosage" value="${data.dosage || ""}">
    </label>

    <button type="button" class="remove-row-btn">×</button>
  `;

  row.querySelector(".remove-row-btn").onclick = () => row.remove();
  return row;
}

function createScmRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  row.innerHTML = `
    <label>
      <span class="label-line">SCM Name <span class="required-asterisk">*</span></span>
      <input type="text" name="scm_name" value="${data.name || ""}">
    </label>

    <label>
      <span class="label-line">Percent (%) <span class="required-asterisk">*</span></span>
      <input type="text" name="scm_percent" value="${data.percent || ""}">
    </label>

    <button type="button" class="remove-row-btn">×</button>
  `;

  row.querySelector(".remove-row-btn").onclick = () => row.remove();
  return row;
}

/* -----------------------------------------------------------
   Input Mode (Ratio vs kg/m³)
----------------------------------------------------------- */

function getSelectedInputMode() {
  const kg = document.getElementById("modeKgm3");
  const ratio = document.getElementById("modeRatio");
  if (kg && kg.checked) return "kgm3";
  if (ratio && ratio.checked) return "ratio";
  return "ratio";
}

/* -----------------------------------------------------------
   OPTIONAL SAFETY:
   Clear inactive mode values when switching modes
----------------------------------------------------------- */

function clearPanelValues(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  panel.querySelectorAll("input, select, textarea").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || "").toLowerCase();

    // Keep ratio cement fixed at 1
    if (el.id === "ratioCement") {
      el.value = "1";
      return;
    }

    // Reset radios/checkboxes carefully (none exist inside these panels right now, but safe)
    if (type === "radio" || type === "checkbox") {
      el.checked = false;
      return;
    }

    // For other inputs/selects/textareas
    if (tag === "select") el.selectedIndex = 0;
    else el.value = "";
  });
}

function syncModePanels() {
  const mode = getSelectedInputMode();
  const ratioPanel = document.getElementById("ratioInputs");
  const kgPanel = document.getElementById("kgm3Inputs");

  if (ratioPanel) ratioPanel.style.display = mode === "ratio" ? "" : "none";
  if (kgPanel) kgPanel.style.display = mode === "kgm3" ? "" : "none";

  // When you switch to one mode, we CLEAR the other mode's values
  if (mode === "ratio") {
    clearPanelValues("kgm3Inputs");
  } else {
    clearPanelValues("ratioInputs");
  }

  // Refresh derived values display based on active mode
  updateDerivedMixValues();
}

/* -----------------------------------------------------------
   "Other" fields behaviour
----------------------------------------------------------- */

function syncConcreteTypeOther() {
  const select = document.getElementById("concreteType");
  const wrapper = document.getElementById("concreteTypeOtherWrapper");
  if (!select || !wrapper) return;
  wrapper.style.display = select.value === "Other" ? "" : "none";
}

function syncCementTypeOther() {
  const select = document.getElementById("cementType");
  const wrapper = document.getElementById("cementTypeOtherWrapper");
  if (!select || !wrapper) return;
  wrapper.style.display = select.value === "Other" ? "" : "none";
}

/* -----------------------------------------------------------
   Derived values display (W/C & Mix Ratio)
----------------------------------------------------------- */

function setWcBoxVisible(visible) {
  const box = document.getElementById("wcratio-box");
  if (!box) return;
  box.classList.toggle("is-visible", !!visible);
}

function setMixBoxVisible(visible) {
  const box = document.getElementById("mixratio-box");
  if (!box) return;
  box.classList.toggle("is-visible", !!visible);
}

function normalizeRatioText(n) {
  if (!Number.isFinite(n)) return "";
  return Number(n).toFixed(2);
}

function computeDerivedFromRatioInputs() {
  const cEl = document.getElementById("ratioCement");
  const fEl = document.getElementById("ratioFine");
  const coEl = document.getElementById("ratioCoarse");
  const wEl = document.getElementById("waterCementRatio");

  if (!cEl || !fEl || !coEl || !wEl) return { wcRatio: null, mixRatioString: "" };

  const cVal = String(cEl.value).trim() || "1";
  const fVal = String(fEl.value).trim();
  const coVal = String(coEl.value).trim();
  const wVal = String(wEl.value).trim();

  const c = Number(cVal);
  const f = Number(fVal);
  const co = Number(coVal);
  const wOverC = Number(wVal);

  let wcRatio = null;
  let mixRatioString = "";

  const partsFilled = fVal !== "" && coVal !== "" && Number.isFinite(c) && c > 0;
  if (partsFilled && Number.isFinite(f) && Number.isFinite(co)) {
    mixRatioString = `1 : ${normalizeRatioText(f / c)} : ${normalizeRatioText(co / c)}`;
  }

  if (wVal !== "" && Number.isFinite(wOverC)) {
    wcRatio = wOverC;
  }

  return { wcRatio, mixRatioString };
}

function computeDerivedFromKgm3Inputs() {
  const cEl = document.getElementById("cementKgm3");
  const wEl = document.getElementById("waterKgm3");
  const fEl = document.getElementById("fineKgm3");
  const coEl = document.getElementById("coarseKgm3");

  if (!cEl || !wEl || !fEl || !coEl) return { wcRatio: null, mixRatioString: "" };

  const cVal = String(cEl.value).trim();
  const wVal = String(wEl.value).trim();
  const fVal = String(fEl.value).trim();
  const coVal = String(coEl.value).trim();

  const c = Number(cVal);
  const w = Number(wVal);
  const f = Number(fVal);
  const co = Number(coVal);

  let wcRatio = null;
  let mixRatioString = "";

  const allFilled =
    cVal !== "" && wVal !== "" && fVal !== "" && coVal !== "" && Number.isFinite(c) && c > 0;

  if (allFilled && [w, f, co].every(Number.isFinite)) {
    wcRatio = w / c;
    mixRatioString = `1 : ${normalizeRatioText(f / c)} : ${normalizeRatioText(co / c)}`;
  }

  return { wcRatio, mixRatioString };
}

function updateDerivedMixValues() {
  const wcSpan = document.getElementById("wcRatioValue");
  const mixSpan = document.getElementById("mixRatioValue");

  const mode = getSelectedInputMode();
  const derived = mode === "kgm3" ? computeDerivedFromKgm3Inputs() : computeDerivedFromRatioInputs();

  const { wcRatio, mixRatioString } = derived;

  // W/C
  if (wcSpan && typeof wcRatio === "number" && Number.isFinite(wcRatio)) {
    wcSpan.textContent = wcRatio.toFixed(2);
    setWcBoxVisible(true);
  } else {
    if (wcSpan) wcSpan.textContent = "";
    setWcBoxVisible(false);
  }

  // Mix ratio
  if (mixSpan && mixRatioString) {
    mixSpan.textContent = mixRatioString;
    setMixBoxVisible(true);
  } else {
    if (mixSpan) mixSpan.textContent = "";
    setMixBoxVisible(false);
  }

  return { wcRatio, mixRatioString };
}

/* -----------------------------------------------------------
   Validation
----------------------------------------------------------- */

function validateForm() {
  document.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));

  const errorSummary = document.getElementById("form-error-summary");
  if (errorSummary) errorSummary.style.display = "none";

  const mode = getSelectedInputMode();

  const commonRequired = [
    "clientName",
    "contactEmail",
    "organisationType",
    "contactPerson",
    "phoneNumber",
    "projectSite",
    "crushDate",
    "concreteType",
    "cementType",
    "slump",
    "ageDays",
    "cubesCount",
    "concreteGrade",
  ];

  const ratioRequired = ["ratioFine", "ratioCoarse", "waterCementRatio"]; // ratioCement fixed
  const kgRequired = ["cementKgm3", "waterKgm3", "fineKgm3", "coarseKgm3"];

  const missing = [];
  let firstBad = null;

  function markBad(el, idForMissing) {
    if (!el) return;
    el.classList.add("error");
    missing.push(idForMissing || el.id || "field");
    if (!firstBad) firstBad = el;
  }

  function checkId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!String(el.value).trim()) markBad(el, id);
  }

  commonRequired.forEach(checkId);

  const concreteType = document.getElementById("concreteType");
  if (concreteType && concreteType.value === "Other") checkId("concreteTypeOther");

  const cementType = document.getElementById("cementType");
  if (cementType && cementType.value === "Other") checkId("cementTypeOther");

  if (mode === "kgm3") kgRequired.forEach(checkId);
  else ratioRequired.forEach(checkId);

  const admRows = document.querySelectorAll("#admixtures-container .dynamic-row");
  admRows.forEach((row) => {
    const nameInput = row.querySelector('input[name="adm_name"]');
    const dosageInput = row.querySelector('input[name="adm_dosage"]');
    const nameEmpty = !nameInput || !nameInput.value.trim();
    const dosageEmpty = !dosageInput || !dosageInput.value.trim();

    if (nameEmpty || dosageEmpty) {
      if (nameEmpty) markBad(nameInput, "admixtures");
      if (dosageEmpty) markBad(dosageInput, "admixtures");
    }
  });

  const scmRows = document.querySelectorAll("#scms-container .dynamic-row");
  scmRows.forEach((row) => {
    const nameInput = row.querySelector('input[name="scm_name"]');
    const percentInput = row.querySelector('input[name="scm_percent"]');
    const nameEmpty = !nameInput || !nameInput.value.trim();
    const percentEmpty = !percentInput || !percentInput.value.trim();

    if (nameEmpty || percentEmpty) {
      if (nameEmpty) markBad(nameInput, "scms");
      if (percentEmpty) markBad(percentInput, "scms");
    }
  });

  if (missing.length) {
    if (errorSummary) {
      errorSummary.textContent = "Please fill all required fields.";
      errorSummary.style.display = "block";
    }
    if (firstBad) firstBad.focus();
    return false;
  }

  return true;
}

/* -----------------------------------------------------------
   Collect form data
----------------------------------------------------------- */

function collectFormData() {
  let concreteType = document.getElementById("concreteType")?.value || "";
  if (concreteType === "Other") {
    concreteType = document.getElementById("concreteTypeOther")?.value.trim() || "";
  }

  let cementType = document.getElementById("cementType")?.value || "";
  if (cementType === "Other") {
    cementType = document.getElementById("cementTypeOther")?.value.trim() || "";
  }

  const admixtures = [];
  document.querySelectorAll("#admixtures-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="adm_name"]')?.value.trim() || "";
    const dosage = row.querySelector('input[name="adm_dosage"]')?.value.trim() || "";
    if (name || dosage) admixtures.push({ name, dosage });
  });

  const scms = [];
  document.querySelectorAll("#scms-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="scm_name"]')?.value.trim() || "";
    const percent = row.querySelector('input[name="scm_percent"]')?.value.trim() || "";
    if (name || percent) scms.push({ name, percent });
  });

  const inputMode = getSelectedInputMode();
  const { wcRatio, mixRatioString } = updateDerivedMixValues();

  return {
    inputMode,

    clientName: document.getElementById("clientName")?.value.trim() || "",
    contactEmail: document.getElementById("contactEmail")?.value.trim() || "",
    organisationType: document.getElementById("organisationType")?.value.trim() || "",
    contactPerson: document.getElementById("contactPerson")?.value.trim() || "",
    phoneNumber: document.getElementById("phoneNumber")?.value.trim() || "",
    projectSite: document.getElementById("projectSite")?.value.trim() || "",

    crushDate: document.getElementById("crushDate")?.value || "",
    concreteType,
    cementType,

    slump: Number(document.getElementById("slump")?.value || 0),
    ageDays: Number(document.getElementById("ageDays")?.value || 0),
    cubesCount: Number(document.getElementById("cubesCount")?.value || 0),
    concreteGrade: document.getElementById("concreteGrade")?.value.trim() || "",
    notes: document.getElementById("notes")?.value.trim() || "",

    // Ratio (will be blank if mode is kgm3 because we clear on switch)
    ratioCement: Number(document.getElementById("ratioCement")?.value || 1),
    ratioFine: Number(document.getElementById("ratioFine")?.value || 0),
    ratioCoarse: Number(document.getElementById("ratioCoarse")?.value || 0),
    waterCementRatio: Number(document.getElementById("waterCementRatio")?.value || 0),

    // kg/m³ (will be blank if mode is ratio because we clear on switch)
    cementKgm3: Number(document.getElementById("cementKgm3")?.value || 0),
    waterKgm3: Number(document.getElementById("waterKgm3")?.value || 0),
    fineKgm3: Number(document.getElementById("fineKgm3")?.value || 0),
    coarseKgm3: Number(document.getElementById("coarseKgm3")?.value || 0),

    admixtures,
    scms,

    wcRatio,
    mixRatioString,
  };
}

/* -----------------------------------------------------------
   LocalStorage records
----------------------------------------------------------- */

function getLocalRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalRecords(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function addLocalRecord(record) {
  const list = getLocalRecords();
  list.push(record);
  saveLocalRecords(list);
}

/* -----------------------------------------------------------
   Render Saved Table
----------------------------------------------------------- */

function renderSavedRecords() {
  const list = getLocalRecords();
  const tbody = document.getElementById("mixes-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="no-data">No mixes saved yet.</td></tr>`;
    return;
  }

  list.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.dataset.index = String(i);

    const wcText =
      typeof r.wcRatio === "number" && Number.isFinite(r.wcRatio) ? r.wcRatio.toFixed(2) : "";

    const when = r.savedAt ? new Date(r.savedAt).toLocaleString() : "";

    tr.innerHTML = `
      <td>${r.recordId || "—"}</td>
      <td>${r.clientName || ""}</td>
      <td>${r.inputMode === "kgm3" ? "kg/m³" : "Ratio"}</td>
      <td>${wcText}</td>
      <td>${when}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* -----------------------------------------------------------
   Load Record Back Into Form
----------------------------------------------------------- */

function setSelectWithOther(selectEl, otherInputEl, value) {
  if (!selectEl) return;

  const saved = String(value || "").trim();
  let matched = false;

  for (const opt of selectEl.options) {
    if (opt.value === saved || opt.text === saved) {
      selectEl.value = opt.value;
      matched = true;
      break;
    }
  }

  if (!matched) {
    if (saved) {
      selectEl.value = "Other";
      if (otherInputEl) otherInputEl.value = saved;
    } else {
      selectEl.value = "";
      if (otherInputEl) otherInputEl.value = "";
    }
  } else {
    if (otherInputEl) otherInputEl.value = "";
  }
}

function loadRecordIntoForm(r) {
  document.getElementById("clientName").value = r.clientName || "";
  document.getElementById("contactEmail").value = r.contactEmail || "";
  document.getElementById("organisationType").value = r.organisationType || "";
  document.getElementById("contactPerson").value = r.contactPerson || "";
  document.getElementById("phoneNumber").value = r.phoneNumber || "";
  document.getElementById("projectSite").value = r.projectSite || "";
  document.getElementById("crushDate").value = r.crushDate || "";
  document.getElementById("slump").value = r.slump ?? "";
  document.getElementById("ageDays").value = r.ageDays ?? "";
  document.getElementById("cubesCount").value = r.cubesCount ?? "";
  document.getElementById("concreteGrade").value = r.concreteGrade ?? "";
  document.getElementById("notes").value = r.notes || "";

  setSelectWithOther(
    document.getElementById("concreteType"),
    document.getElementById("concreteTypeOther"),
    r.concreteType || ""
  );

  setSelectWithOther(
    document.getElementById("cementType"),
    document.getElementById("cementTypeOther"),
    r.cementType || ""
  );

  const ratioRadio = document.getElementById("modeRatio");
  const kgRadio = document.getElementById("modeKgm3");
  const mode = r.inputMode === "kgm3" ? "kgm3" : "ratio";
  if (ratioRadio) ratioRadio.checked = mode === "ratio";
  if (kgRadio) kgRadio.checked = mode === "kgm3";

  // We set values first, then call syncModePanels() which will clear the inactive panel.
  // That keeps the form consistent with the record's mode.
  document.getElementById("ratioCement").value = r.ratioCement ?? "1";
  document.getElementById("ratioFine").value = r.ratioFine ?? "";
  document.getElementById("ratioCoarse").value = r.ratioCoarse ?? "";
  document.getElementById("waterCementRatio").value = r.waterCementRatio ?? "";

  const cementKgm3 = document.getElementById("cementKgm3");
  const waterKgm3 = document.getElementById("waterKgm3");
  const fineKgm3 = document.getElementById("fineKgm3");
  const coarseKgm3 = document.getElementById("coarseKgm3");
  if (cementKgm3) cementKgm3.value = r.cementKgm3 ?? "";
  if (waterKgm3) waterKgm3.value = r.waterKgm3 ?? "";
  if (fineKgm3) fineKgm3.value = r.fineKgm3 ?? "";
  if (coarseKgm3) coarseKgm3.value = r.coarseKgm3 ?? "";

  const admContainer = document.getElementById("admixtures-container");
  admContainer.innerHTML = "";
  if (Array.isArray(r.admixtures) && r.admixtures.length) {
    r.admixtures.forEach((a) => admContainer.appendChild(createAdmixtureRow(a)));
  }

  const scmContainer = document.getElementById("scms-container");
  scmContainer.innerHTML = "";
  if (Array.isArray(r.scms) && r.scms.length) {
    r.scms.forEach((s) => scmContainer.appendChild(createScmRow(s)));
  }

  syncConcreteTypeOther();
  syncCementTypeOther();
  syncModePanels();

  setStatusLine("Saved record loaded into form.", "info");
}

/* -----------------------------------------------------------
   PDF Generation (jsPDF)
----------------------------------------------------------- */

function pdfEnsureSpace(doc, y, needed, margin, pageH) {
  if (y + needed <= pageH - margin) return { y, pageAdded: false };
  doc.addPage();
  return { y: margin, pageAdded: true };
}

async function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  let y = 40;

  if (logoImageDataUrl) {
    doc.addImage(logoImageDataUrl, "PNG", margin, y, 60, 60);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CONCRETE LABORATORY – UNIVERSITY OF LAGOS", margin + 80, y + 20);
  doc.setFontSize(10);
  doc.text("Client's Cube Test Intake Form", margin + 80, y + 38);
  y += 80;

  if (data.recordId) {
    doc.setFont("helvetica", "bold");
    doc.text(`Application No: ${data.recordId}`, margin, y);
    y += 18;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Client Details", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  const clientLines = [
    `Client Name: ${data.clientName || ""}`,
    `Contact Email: ${data.contactEmail || ""}`,
    `Contact Phone: ${data.phoneNumber || ""}`,
    `Organisation Type: ${data.organisationType || ""}`,
    `Contact Person: ${data.contactPerson || ""}`,
    `Project / Site: ${data.projectSite || ""}`,
  ];

  clientLines.forEach((line) => {
    ({ y } = pdfEnsureSpace(doc, y, 18, margin, pageH));
    doc.text(line, margin, y);
    y += 14;
  });

  y += 6;

  ({ y } = pdfEnsureSpace(doc, y, 80, margin, pageH));
  doc.setFont("helvetica", "bold");
  doc.text("Test Information", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  const testLines = [
    `Crushing Date: ${data.crushDate || ""}`,
    `Concrete Type: ${data.concreteType || ""}`,
    `Cement Type: ${data.cementType || ""}`,
    `Slump / Flow (mm): ${data.slump ?? ""}`,
    `Age at Testing (days): ${data.ageDays ?? ""}`,
    `Number of Cubes: ${data.cubesCount ?? ""}`,
    `Concrete Grade: ${data.concreteGrade ?? ""}`,
  ];

  testLines.forEach((line) => {
    ({ y } = pdfEnsureSpace(doc, y, 18, margin, pageH));
    doc.text(line, margin, y);
    y += 14;
  });

  y += 6;

  ({ y } = pdfEnsureSpace(doc, y, 120, margin, pageH));
  doc.setFont("helvetica", "bold");
  doc.text("Mix Design", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");

  const modeLabel = data.inputMode === "kgm3" ? "kg/m³" : "Ratio";
  doc.text(`Input Mode: ${modeLabel}`, margin, y);
  y += 14;

  if (data.inputMode === "kgm3") {
    const kgLines = [
      `Cement (kg/m³): ${data.cementKgm3 ?? ""}`,
      `Water (kg/m³): ${data.waterKgm3 ?? ""}`,
      `Fine Aggregate (kg/m³): ${data.fineKgm3 ?? ""}`,
      `Coarse Aggregate (kg/m³): ${data.coarseKgm3 ?? ""}`,
    ];
    kgLines.forEach((line) => {
      ({ y } = pdfEnsureSpace(doc, y, 18, margin, pageH));
      doc.text(line, margin, y);
      y += 14;
    });
  } else {
    const ratioLines = [
      `Mix Ratio Parts (Cement : Fine : Coarse): ${data.ratioCement ?? ""} : ${data.ratioFine ?? ""} : ${data.ratioCoarse ?? ""}`,
      `Water–Cement Ratio (W/C): ${data.waterCementRatio ?? ""}`,
    ];
    ratioLines.forEach((line) => {
      ({ y } = pdfEnsureSpace(doc, y, 18, margin, pageH));
      doc.text(line, margin, y);
      y += 14;
    });
  }

  const wcRatioText =
    typeof data.wcRatio === "number" && Number.isFinite(data.wcRatio)
      ? data.wcRatio.toFixed(2)
      : (data.wcRatio || "");

  ({ y } = pdfEnsureSpace(doc, y, 40, margin, pageH));
  doc.text(`Derived W/C Ratio: ${wcRatioText}`, margin, y);
  y += 14;
  doc.text(`Derived Mix Ratio (C:F:C): ${data.mixRatioString || ""}`, margin, y);
  y += 20;

  ({ y } = pdfEnsureSpace(doc, y, 60, margin, pageH));
  doc.setFont("helvetica", "bold");
  doc.text("Admixtures", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  if (Array.isArray(data.admixtures) && data.admixtures.length) {
    data.admixtures.forEach((a, i) => {
      ({ y } = pdfEnsureSpace(doc, y, 18, margin, pageH));
      doc.text(`${i + 1}. ${a.name || ""} | ${a.dosage || ""}%`, margin, y);
      y += 14;
    });
  } else {
    doc.text("None", margin, y);
    y += 14;
  }
  y += 10;

  ({ y } = pdfEnsureSpace(doc, y, 60, margin, pageH));
  doc.setFont("helvetica", "bold");
  doc.text("SCMs", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  if (Array.isArray(data.scms) && data.scms.length) {
    data.scms.forEach((s, i) => {
      ({ y } = pdfEnsureSpace(doc, y, 18, margin, pageH));
      doc.text(`${i + 1}. ${s.name || ""} | ${s.percent || ""}%`, margin, y);
      y += 14;
    });
  } else {
    doc.text("None", margin, y);
    y += 14;
  }
  y += 10;

  ({ y } = pdfEnsureSpace(doc, y, 60, margin, pageH));
  doc.setFont("helvetica", "bold");
  doc.text("Notes", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  const notesLines = doc.splitTextToSize(data.notes || "", pageW - margin * 2);
  ({ y } = pdfEnsureSpace(doc, y, notesLines.length * 12 + 20, margin, pageH));
  doc.text(notesLines, margin, y);

  const boxWidth = pageW - margin * 2;
  const copyrightGap = 24;
  const boxHeight = 140;
  const boxX = margin;
  const boxY = pageH - margin - boxHeight - copyrightGap;

  doc.setDrawColor(0);
  doc.rect(boxX, boxY, boxWidth, boxHeight);

  const innerMargin = 12;
  let boxInnerY = boxY + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FOR OFFICE USE ONLY", boxX + innerMargin, boxInnerY);

  boxInnerY += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text("Tested by:  _________________________________________", boxX + innerMargin, boxInnerY);
  doc.text("Date:  _____________________________________________", boxX + boxWidth / 2, boxInnerY);

  boxInnerY += 22;
  doc.text(
    "Compressive Strength (MPa): _____________________________________________________________________________",
    boxX + innerMargin,
    boxInnerY
  );

  boxInnerY += 22;
  doc.text("Remarks:", boxX + innerMargin, boxInnerY);

  boxInnerY += 18;
  doc.text(
    "_____________________________________________________________________________________________________",
    boxX + innerMargin,
    boxInnerY
  );

  boxInnerY += 18;
  doc.text(
    "_____________________________________________________________________________________________________",
    boxX + innerMargin,
    boxInnerY
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("© Concrete Laboratory, University of Lagos", pageW / 2, pageH - margin, { align: "center" });

  const filename = `${sanitizeFilename(data.clientName || "Client")}_${sanitizeFilename(
    data.projectSite || "CubeTest"
  )}.pdf`;

  doc.save(filename);
}

/* -----------------------------------------------------------
   CSV Export + Clear all
----------------------------------------------------------- */

function exportCsv() {
  const list = getLocalRecords();
  if (!list.length) return;

  const headers = [
    "RecordId",
    "InputMode",
    "ClientName",
    "Email",
    "Phone",
    "OrganisationType",
    "ContactPerson",
    "ProjectSite",
    "CrushDate",
    "ConcreteType",
    "CementType",
    "Slump",
    "AgeDays",
    "CubesCount",
    "ConcreteGrade",
    "RatioCement",
    "RatioFine",
    "RatioCoarse",
    "WaterCementRatio",
    "CementKgm3",
    "WaterKgm3",
    "FineKgm3",
    "CoarseKgm3",
    "DerivedWCRatio",
    "DerivedMixRatio",
    "Notes",
    "SavedAt",
  ];

  const lines = [headers.join(",")];

  list.forEach((r) => {
    const row = [
      r.recordId || "",
      r.inputMode || "",
      r.clientName || "",
      r.contactEmail || "",
      r.phoneNumber || "",
      r.organisationType || "",
      r.contactPerson || "",
      r.projectSite || "",
      r.crushDate || "",
      r.concreteType || "",
      r.cementType || "",
      r.slump ?? "",
      r.ageDays ?? "",
      r.cubesCount ?? "",
      r.concreteGrade ?? "",
      r.ratioCement ?? "",
      r.ratioFine ?? "",
      r.ratioCoarse ?? "",
      r.waterCementRatio ?? "",
      r.cementKgm3 ?? "",
      r.waterKgm3 ?? "",
      r.fineKgm3 ?? "",
      r.coarseKgm3 ?? "",
      r.wcRatio ?? "",
      r.mixRatioString || "",
      (r.notes || "").replace(/\n/g, " "),
      r.savedAt || "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);

    lines.push(row.join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cube_test_records.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function clearAllRecords() {
  saveLocalRecords([]);
  renderSavedRecords();
  setStatusLine("All saved records cleared.", "info");
}

/* -----------------------------------------------------------
   Submit handler
----------------------------------------------------------- */

async function submitForm(event) {
  event.preventDefault();
  if (!validateForm()) return;

  setStatusLine("Submitting...", "info");

  const data = collectFormData();

  if (!logoImageDataUrl) {
    logoImageDataUrl = await loadImageAsDataURL("../unilag-logo.png");
  }

  let apiResult = null;

  try {
    const res = await fetch("/api/submitform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) apiResult = await res.json();
    else apiResult = await res.json().catch(() => null);
  } catch (err) {
    console.error("Network/API error:", err);
  }

  if (apiResult && apiResult.success) {
    // Backend is the source of truth for recordId, wcRatio, mixRatioString, inputMode routing
    if (typeof apiResult.wcRatio !== "undefined") data.wcRatio = apiResult.wcRatio;
    if (typeof apiResult.mixRatioString !== "undefined") data.mixRatioString = apiResult.mixRatioString;
    if (apiResult.recordId) data.recordId = apiResult.recordId;

    data.savedAt = new Date().toISOString();

    addLocalRecord(data);
    renderSavedRecords();

    if (data.recordId) showAppNumberModal(data.recordId);

    await generatePDF(data);

    setStatusLine("Submitted and saved successfully.", "success");
  } else {
    const msg = apiResult?.message ? `Failed: ${apiResult.message}` : "Failed to submit. Please try again.";
    setStatusLine(msg, "error");
  }
}

/* -----------------------------------------------------------
   Reset form
----------------------------------------------------------- */

function resetForm() {
  const form = document.getElementById("mix-form");
  if (!form) return;
  form.reset();

  const ratioC = document.getElementById("ratioCement");
  if (ratioC) ratioC.value = "1";

  const adm = document.getElementById("admixtures-container");
  const scm = document.getElementById("scms-container");
  if (adm) adm.innerHTML = "";
  if (scm) scm.innerHTML = "";

  setWcBoxVisible(false);
  setMixBoxVisible(false);

  syncConcreteTypeOther();
  syncCementTypeOther();
  syncModePanels();

  document.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));
  const errorSummary = document.getElementById("form-error-summary");
  if (errorSummary) errorSummary.style.display = "none";

  setStatusLine("", "info");
}

/* -----------------------------------------------------------
   Event wiring
----------------------------------------------------------- */

function attachEventListeners() {
  const grade = document.getElementById("concreteGrade");
  if (grade) {
    grade.addEventListener("input", () => {
      grade.value = grade.value.toUpperCase();
    });
  }

  const form = document.getElementById("mix-form");
  if (form) form.addEventListener("submit", submitForm);

  const resetBtn = document.getElementById("reset-form-btn");
  if (resetBtn) resetBtn.addEventListener("click", resetForm);

  const exportBtn = document.getElementById("export-csv-btn");
  if (exportBtn) exportBtn.addEventListener("click", exportCsv);

  const clearAllBtn = document.getElementById("clear-all-btn");
  if (clearAllBtn) clearAllBtn.addEventListener("click", clearAllRecords);

  const modeRatio = document.getElementById("modeRatio");
  const modeKgm3 = document.getElementById("modeKgm3");
  if (modeRatio) modeRatio.addEventListener("change", syncModePanels);
  if (modeKgm3) modeKgm3.addEventListener("change", syncModePanels);

  ["ratioFine", "ratioCoarse", "waterCementRatio"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateDerivedMixValues);
  });

  ["cementKgm3", "waterKgm3", "fineKgm3", "coarseKgm3"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateDerivedMixValues);
  });

  const addAdmBtn = document.getElementById("add-admixture-btn");
  if (addAdmBtn) {
    addAdmBtn.addEventListener("click", () => {
      const container = document.getElementById("admixtures-container");
      if (container) container.appendChild(createAdmixtureRow());
    });
  }

  const addScmBtn = document.getElementById("add-scm-btn");
  if (addScmBtn) {
    addScmBtn.addEventListener("click", () => {
      const container = document.getElementById("scms-container");
      if (container) container.appendChild(createScmRow());
    });
  }

  const concreteSelect = document.getElementById("concreteType");
  if (concreteSelect) concreteSelect.addEventListener("change", syncConcreteTypeOther);

  const cementSelect = document.getElementById("cementType");
  if (cementSelect) cementSelect.addEventListener("change", syncCementTypeOther);

  const tbody = document.getElementById("mixes-table-body");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || typeof tr.dataset.index === "undefined") return;
      const index = Number(tr.dataset.index);
      const list = getLocalRecords();
      const record = list[index];
      if (record) loadRecordIntoForm(record);
    });
  }

  const overlay = document.getElementById("appno-modal");
  const closeBtn = document.getElementById("appno-modal-close");

  if (closeBtn) closeBtn.addEventListener("click", hideAppNumberModal);

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) hideAppNumberModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAppNumberModal();
  });
}

/* -----------------------------------------------------------
   Init
----------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  setDateToToday(document.getElementById("crushDate"));
  syncConcreteTypeOther();
  syncCementTypeOther();
  syncModePanels();
  setWcBoxVisible(false);
  setMixBoxVisible(false);
  renderSavedRecords();
  attachEventListeners();
});
