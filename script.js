/* -----------------------------------------------------------
   UNILAG CONCRETE LAB – CLIENT FORM (Front-End)
   -----------------------------------------------------------
   This script handles:
   - Dynamic form UI (Other fields, admixtures, SCMs, input modes)
   - Validation and form data collection
   - Derived W/C + derived mix ratio display
   - LocalStorage saving + table rendering + record loading
   - Submit to backend and PDF generation
   - CSV export and clear functions
----------------------------------------------------------- */

const STORAGE_KEY = "unilag-concrete-lab-client-mixes";
let logoImageDataUrl = null;

/* -----------------------------
   Helpers and status UI
------------------------------ */

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
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function setDateToToday(inputEl) {
  if (!inputEl) return;
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
  inputEl.value = todayLocal;
}

/* -----------------------------
   Application number modal
------------------------------ */

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

/* -----------------------------
   Dynamic rows (Admixtures and SCMs)
------------------------------ */

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

/* -----------------------------
   Mix input mode and derived calculations
------------------------------ */

function getSelectedInputMode() {
  const kgRadio = document.getElementById("modeKgm3");
  const ratioRadio = document.getElementById("modeRatio");
  if (kgRadio && kgRadio.checked) return "kgm3";
  if (ratioRadio && ratioRadio.checked) return "ratio";
  return "ratio";
}

function normalizeRatioText(n) {
  if (!isFinite(n)) return "";
  return Number(n).toFixed(2);
}

function computeDerivedFromRatioInputs() {
  const cEl = document.getElementById("ratioCement");
  const fEl = document.getElementById("ratioFine");
  const coEl = document.getElementById("ratioCoarse");
  const wOverCEl = document.getElementById("waterCementRatio");

  if (!cEl || !fEl || !coEl || !wOverCEl) return { wcRatio: null, mixRatioString: "" };

  const cVal = String(cEl.value).trim();
  const fVal = String(fEl.value).trim();
  const coVal = String(coEl.value).trim();
  const wVal = String(wOverCEl.value).trim();

  const cNum = Number(cVal || "1");
  const fNum = Number(fVal);
  const coNum = Number(coVal);
  const wNum = Number(wVal);

  let mixRatioString = "";
  let wcRatio = null;

  const mixInputsFilled = cVal !== "" && fVal !== "" && coVal !== "";
  if (mixInputsFilled && cNum > 0 && isFinite(fNum) && isFinite(coNum)) {
    mixRatioString = `1 : ${normalizeRatioText(fNum / cNum)} : ${normalizeRatioText(coNum / cNum)}`;
  }

  if (wVal !== "" && isFinite(wNum)) wcRatio = wNum;

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

  if (cVal !== "" && wVal !== "" && c > 0 && isFinite(w)) wcRatio = w / c;

  if (cVal !== "" && fVal !== "" && coVal !== "" && c > 0 && isFinite(f) && isFinite(co)) {
    mixRatioString = `1 : ${normalizeRatioText(f / c)} : ${normalizeRatioText(co / c)}`;
  }

  return { wcRatio, mixRatioString };
}

function setWcBoxVisible(show) {
  const wcBox = document.getElementById("wcratio-box");
  if (!wcBox) return;
  wcBox.classList.toggle("is-visible", Boolean(show));
}

function setMixBoxVisible(show) {
  const mixBox = document.getElementById("mixratio-box");
  if (!mixBox) return;
  mixBox.classList.toggle("is-visible", Boolean(show));
}

function updateDerivedMixValues() {
  const wcSpan = document.getElementById("wcRatioValue");
  const mixSpan = document.getElementById("mixRatioValue");

  const mode = getSelectedInputMode();
  const derived = mode === "kgm3" ? computeDerivedFromKgm3Inputs() : computeDerivedFromRatioInputs();

  if (derived.mixRatioString) {
    if (mixSpan) mixSpan.textContent = derived.mixRatioString;
    setMixBoxVisible(true);
  } else {
    if (mixSpan) mixSpan.textContent = "";
    setMixBoxVisible(false);
  }

  if (typeof derived.wcRatio === "number" && isFinite(derived.wcRatio)) {
    if (wcSpan) wcSpan.textContent = derived.wcRatio.toFixed(2);
    setWcBoxVisible(true);
  } else {
    if (wcSpan) wcSpan.textContent = "";
    setWcBoxVisible(false);
  }

  return derived;
}

function syncMixModeUI() {
  const mode = getSelectedInputMode();
  const ratioPanel = document.getElementById("ratioInputs");
  const kgPanel = document.getElementById("kgm3Inputs");

  if (ratioPanel) ratioPanel.style.display = mode === "ratio" ? "" : "none";
  if (kgPanel) kgPanel.style.display = mode === "kgm3" ? "" : "none";

  updateDerivedMixValues();
}

/* -----------------------------
   Show / hide “Other” fields
------------------------------ */

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

/* -----------------------------
   Validation
------------------------------ */

function validateForm() {
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

  const mode = getSelectedInputMode();
  const ratioRequired = ["ratioCement", "ratioFine", "ratioCoarse", "waterCementRatio"];
  const kgRequired = ["cementKgm3", "waterKgm3", "fineKgm3", "coarseKgm3"];

  document.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));

  const missing = [];
  let firstBad = null;

  function checkId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!String(el.value).trim()) {
      el.classList.add("error");
      missing.push(id);
      if (!firstBad) firstBad = el;
    }
  }

  commonRequired.forEach(checkId);

  const concreteType = document.getElementById("concreteType");
  if (concreteType && concreteType.value === "Other") checkId("concreteTypeOther");

  const cementType = document.getElementById("cementType");
  if (cementType && cementType.value === "Other") checkId("cementTypeOther");

  (mode === "kgm3" ? kgRequired : ratioRequired).forEach(checkId);

  const admRows = document.querySelectorAll("#admixtures-container .dynamic-row");
  admRows.forEach((row) => {
    const nameInput = row.querySelector('input[name="adm_name"]');
    const dosageInput = row.querySelector('input[name="adm_dosage"]');

    const nameEmpty = !nameInput || !nameInput.value.trim();
    const dosageEmpty = !dosageInput || !dosageInput.value.trim();

    if (nameEmpty || dosageEmpty) {
      if (nameEmpty && nameInput) nameInput.classList.add("error");
      if (dosageEmpty && dosageInput) dosageInput.classList.add("error");
      missing.push("admixtures");
      if (!firstBad) firstBad = nameInput || dosageInput;
    }
  });

  const scmRows = document.querySelectorAll("#scms-container .dynamic-row");
  scmRows.forEach((row) => {
    const nameInput = row.querySelector('input[name="scm_name"]');
    const percentInput = row.querySelector('input[name="scm_percent"]');

    const nameEmpty = !nameInput || !nameInput.value.trim();
    const percentEmpty = !percentInput || !percentInput.value.trim();

    if (nameEmpty || percentEmpty) {
      if (nameEmpty && nameInput) nameInput.classList.add("error");
      if (percentEmpty && percentInput) percentInput.classList.add("error");
      missing.push("scms");
      if (!firstBad) firstBad = nameInput || percentInput;
    }
  });

  const errorSummary = document.getElementById("form-error-summary");

  if (missing.length) {
    if (errorSummary) {
      errorSummary.textContent = "Please fill all required fields.";
      errorSummary.style.display = "block";
    }
    if (firstBad) firstBad.focus();
    return false;
  }

  if (errorSummary) errorSummary.style.display = "none";
  return true;
}

/* -----------------------------
   Data collection
------------------------------ */

function collectFormData() {
  const inputMode = getSelectedInputMode();

  let concreteType = document.getElementById("concreteType").value;
  if (concreteType === "Other") concreteType = document.getElementById("concreteTypeOther").value.trim();

  let cementType = document.getElementById("cementType").value;
  if (cementType === "Other") cementType = document.getElementById("cementTypeOther").value.trim();

  const admixtures = [];
  document.querySelectorAll("#admixtures-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="adm_name"]').value.trim();
    const dosage = row.querySelector('input[name="adm_dosage"]').value.trim();
    if (name || dosage) admixtures.push({ name, dosage });
  });

  const scms = [];
  document.querySelectorAll("#scms-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="scm_name"]').value.trim();
    const percent = row.querySelector('input[name="scm_percent"]').value.trim();
    if (name || percent) scms.push({ name, percent });
  });

  const ratioCement = Number(document.getElementById("ratioCement")?.value || 0);
  const ratioFine = Number(document.getElementById("ratioFine")?.value || 0);
  const ratioCoarse = Number(document.getElementById("ratioCoarse")?.value || 0);
  const waterCementRatio = Number(document.getElementById("waterCementRatio")?.value || 0);

  const cementKgm3 = Number(document.getElementById("cementKgm3")?.value || 0);
  const waterKgm3 = Number(document.getElementById("waterKgm3")?.value || 0);
  const fineKgm3 = Number(document.getElementById("fineKgm3")?.value || 0);
  const coarseKgm3 = Number(document.getElementById("coarseKgm3")?.value || 0);

  const { wcRatio, mixRatioString } = updateDerivedMixValues();

  return {
    inputMode,

    clientName: document.getElementById("clientName").value.trim(),
    contactEmail: document.getElementById("contactEmail").value.trim(),
    organisationType: document.getElementById("organisationType").value.trim(),
    contactPerson: document.getElementById("contactPerson").value.trim(),
    phoneNumber: document.getElementById("phoneNumber").value.trim(),
    projectSite: document.getElementById("projectSite").value.trim(),
    crushDate: document.getElementById("crushDate").value,

    concreteType,
    cementType,

    slump: Number(document.getElementById("slump").value || 0),
    ageDays: Number(document.getElementById("ageDays").value || 0),
    cubesCount: Number(document.getElementById("cubesCount").value || 0),
    concreteGrade: document.getElementById("concreteGrade").value.trim(),
    notes: document.getElementById("notes").value.trim(),

    ratioCement,
    ratioFine,
    ratioCoarse,
    waterCementRatio,

    cementKgm3,
    waterKgm3,
    fineKgm3,
    coarseKgm3,

    admixtures,
    scms,

    wcRatio,
    mixRatioString,
  };
}

/* -----------------------------
   LocalStorage saving and table rendering
------------------------------ */

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

    const wcText = typeof r.wcRatio === "number" && isFinite(r.wcRatio) ? r.wcRatio.toFixed(2) : "";
    const when = r.savedAt ? new Date(r.savedAt).toLocaleString() : "";

    tr.innerHTML = `
      <td>${r.recordId || "—"}</td>
      <td>${r.clientName || ""}</td>
      <td>${r.concreteType || ""}</td>
      <td>${wcText}</td>
      <td>${when}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* -----------------------------
   Loading a saved record back into the form
------------------------------ */

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

  const mode = r.inputMode === "kgm3" ? "kgm3" : "ratio";
  const ratioRadio = document.getElementById("modeRatio");
  const kgRadio = document.getElementById("modeKgm3");
  if (ratioRadio) ratioRadio.checked = mode === "ratio";
  if (kgRadio) kgRadio.checked = mode === "kgm3";

  const concreteSelect = document.getElementById("concreteType");
  const concreteOther = document.getElementById("concreteTypeOther");
  if (concreteSelect) {
    const saved = r.concreteType || "";
    let matched = false;

    for (const opt of concreteSelect.options) {
      if (opt.value === saved || opt.text === saved) {
        concreteSelect.value = opt.value;
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (saved) {
        concreteSelect.value = "Other";
        if (concreteOther) concreteOther.value = saved;
      } else {
        concreteSelect.value = "";
        if (concreteOther) concreteOther.value = "";
      }
    } else if (concreteOther) {
      concreteOther.value = "";
    }
  }

  const cementSelect = document.getElementById("cementType");
  const cementOther = document.getElementById("cementTypeOther");
  if (cementSelect) {
    const saved = r.cementType || "";
    let matched = false;

    for (const opt of cementSelect.options) {
      if (opt.value === saved || opt.text === saved) {
        cementSelect.value = opt.value;
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (saved) {
        cementSelect.value = "Other";
        if (cementOther) cementOther.value = saved;
      } else {
        cementSelect.value = "";
        if (cementOther) cementOther.value = "";
      }
    } else if (cementOther) {
      cementOther.value = "";
    }
  }

  const ratioCementEl = document.getElementById("ratioCement");
  if (ratioCementEl) ratioCementEl.value = r.ratioCement ?? "1";
  const ratioFineEl = document.getElementById("ratioFine");
  if (ratioFineEl) ratioFineEl.value = r.ratioFine ?? "";
  const ratioCoarseEl = document.getElementById("ratioCoarse");
  if (ratioCoarseEl) ratioCoarseEl.value = r.ratioCoarse ?? "";
  const wcrEl = document.getElementById("waterCementRatio");
  if (wcrEl) wcrEl.value = r.waterCementRatio ?? "";

  const cK = document.getElementById("cementKgm3");
  if (cK) cK.value = r.cementKgm3 ?? "";
  const wK = document.getElementById("waterKgm3");
  if (wK) wK.value = r.waterKgm3 ?? "";
  const fK = document.getElementById("fineKgm3");
  if (fK) fK.value = r.fineKgm3 ?? "";
  const coK = document.getElementById("coarseKgm3");
  if (coK) coK.value = r.coarseKgm3 ?? "";

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
  syncMixModeUI();
  updateDerivedMixValues();

  setStatusLine("Saved record loaded into form.", "info");
}

/* -----------------------------
   PDF generation
------------------------------ */

async function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  let y = 40;

  if (logoImageDataUrl) doc.addImage(logoImageDataUrl, "PNG", margin, y, 60, 60);

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
  doc.text(`Client Name: ${data.clientName || ""}`, margin, y); y += 14;
  doc.text(`Contact Email: ${data.contactEmail || ""}`, margin, y); y += 14;
  doc.text(`Contact Phone: ${data.phoneNumber || ""}`, margin, y); y += 14;
  doc.text(`Organisation Type: ${data.organisationType || ""}`, margin, y); y += 14;
  doc.text(`Contact Person: ${data.contactPerson || ""}`, margin, y); y += 14;
  doc.text(`Project / Site: ${data.projectSite || ""}`, margin, y); y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Test Information", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.text(`Crushing Date: ${data.crushDate || ""}`, margin, y); y += 14;
  doc.text(`Concrete Type: ${data.concreteType || ""}`, margin, y); y += 14;
  doc.text(`Cement Type: ${data.cementType || ""}`, margin, y); y += 14;
  doc.text(`Slump / Flow (mm): ${data.slump ?? ""}`, margin, y); y += 14;
  doc.text(`Age at Testing (days): ${data.ageDays ?? ""}`, margin, y); y += 14;
  doc.text(`Number of Cubes: ${data.cubesCount ?? ""}`, margin, y); y += 14;
  doc.text(`Concrete Grade: ${data.concreteGrade ?? ""}`, margin, y); y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Mix Design", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");

  if (data.inputMode === "kgm3") {
    doc.text("Input mode: kg/m³", margin, y); y += 14;
    doc.text(`Cement (kg/m³): ${data.cementKgm3 ?? ""}`, margin, y); y += 14;
    doc.text(`Water (kg/m³): ${data.waterKgm3 ?? ""}`, margin, y); y += 14;
    doc.text(`Fine aggregate (kg/m³): ${data.fineKgm3 ?? ""}`, margin, y); y += 14;
    doc.text(`Coarse aggregate (kg/m³): ${data.coarseKgm3 ?? ""}`, margin, y); y += 14;
  } else {
    doc.text("Input mode: Mix ratio", margin, y); y += 14;
    doc.text(`Cement (part): ${data.ratioCement ?? ""}`, margin, y); y += 14;
    doc.text(`Fine aggregate (part): ${data.ratioFine ?? ""}`, margin, y); y += 14;
    doc.text(`Coarse aggregate (part): ${data.ratioCoarse ?? ""}`, margin, y); y += 14;
    doc.text(`Water–Cement Ratio (W/C): ${data.waterCementRatio ?? ""}`, margin, y); y += 14;
  }

  const wcRatioText =
    typeof data.wcRatio === "number" && isFinite(data.wcRatio) ? data.wcRatio.toFixed(2) : (data.wcRatio || "");
  doc.text(`Derived W/C Ratio: ${wcRatioText}`, margin, y); y += 14;
  doc.text(`Derived Mix Ratio (C:F:C): ${data.mixRatioString || ""}`, margin, y); y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Admixtures", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  if (data.admixtures && data.admixtures.length) {
    data.admixtures.forEach((a, i) => { doc.text(`${i + 1}. ${a.name || ""} | ${a.dosage || ""}%`, margin, y); y += 14; });
  } else {
    doc.text("None", margin, y); y += 14;
  }
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("SCMs", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  if (data.scms && data.scms.length) {
    data.scms.forEach((s, i) => { doc.text(`${i + 1}. ${s.name || ""} | ${s.percent || ""}%`, margin, y); y += 14; });
  } else {
    doc.text("None", margin, y); y += 14;
  }
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Notes", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  const notesLines = doc.splitTextToSize(data.notes || "", pageW - margin * 2);
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
  doc.text("Compressive Strength (MPa): _____________________________________________________________________________", boxX + innerMargin, boxInnerY);

  boxInnerY += 22;
  doc.text("Remarks:", boxX + innerMargin, boxInnerY);
  boxInnerY += 18;
  doc.text("_____________________________________________________________________________________________________", boxX + innerMargin, boxInnerY);
  boxInnerY += 18;
  doc.text("_____________________________________________________________________________________________________", boxX + innerMargin, boxInnerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("© Concrete Laboratory, University of Lagos", pageW / 2, pageH - margin, { align: "center" });

  const filename = `${sanitizeFilename(data.clientName || "Client")}_${sanitizeFilename(data.projectSite || "CubeTest")}.pdf`;
  doc.save(filename);
}

/* -----------------------------
   CSV export and clear functions
------------------------------ */

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
    "WCRatio",
    "MixRatio",
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

/* -----------------------------
   Submit handler (client -> server)
------------------------------ */

async function submitForm(event) {
  event.preventDefault();
  if (!validateForm()) return;

  setStatusLine("Submitting...", "info");

  const data = collectFormData();

  if (!logoImageDataUrl) logoImageDataUrl = await loadImageAsDataURL("unilag-logo.png");

  let apiResult = null;

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) apiResult = await res.json();
  } catch (err) {
    console.error("Network error submitting to API:", err);
  }

  if (apiResult && apiResult.success) {
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
    setStatusLine("Failed to submit. Please try again.", "error");
  }
}

/* -----------------------------
   Reset form
------------------------------ */

function resetForm() {
  const form = document.getElementById("mix-form");
  if (!form) return;

  form.reset();

  const ratioC = document.getElementById("ratioCement");
  if (ratioC) ratioC.value = "1";

  const ratioRadio = document.getElementById("modeRatio");
  const kgRadio = document.getElementById("modeKgm3");
  if (ratioRadio) ratioRadio.checked = true;
  if (kgRadio) kgRadio.checked = false;

  syncMixModeUI();

  document.getElementById("admixtures-container").innerHTML = "";
  document.getElementById("scms-container").innerHTML = "";

  setWcBoxVisible(false);
  setMixBoxVisible(false);

  setStatusLine("", "info");

  const errorSummary = document.getElementById("form-error-summary");
  if (errorSummary) errorSummary.style.display = "none";
}

/* -----------------------------
   Event wiring and initialization
------------------------------ */

function attachEventListeners() {
  const concreteGradeInput = document.getElementById("concreteGrade");
  if (concreteGradeInput) {
    concreteGradeInput.addEventListener("input", () => {
      concreteGradeInput.value = concreteGradeInput.value.toUpperCase();
    });
  }

  const form = document.getElementById("mix-form");
  if (form) form.addEventListener("submit", submitForm);

  const resetBtn = document.getElementById("reset-form-btn");
  if (resetBtn) resetBtn.addEventListener("click", resetForm);

  const exportCsvBtn = document.getElementById("export-csv-btn");
  if (exportCsvBtn) exportCsvBtn.addEventListener("click", exportCsv);

  const clearAllBtn = document.getElementById("clear-all-btn");
  if (clearAllBtn) clearAllBtn.addEventListener("click", clearAllRecords);

  const ratioRadio = document.getElementById("modeRatio");
  const kgRadio = document.getElementById("modeKgm3");
  if (ratioRadio) ratioRadio.addEventListener("change", syncMixModeUI);
  if (kgRadio) kgRadio.addEventListener("change", syncMixModeUI);

  ["ratioCement", "ratioFine", "ratioCoarse", "waterCementRatio"].forEach((id) => {
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
      document.getElementById("admixtures-container").appendChild(createAdmixtureRow());
    });
  }

  const addScmBtn = document.getElementById("add-scm-btn");
  if (addScmBtn) {
    addScmBtn.addEventListener("click", () => {
      document.getElementById("scms-container").appendChild(createScmRow());
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
      if (!tr || tr.dataset.index === undefined) return;
      const index = Number(tr.dataset.index);
      const list = getLocalRecords();
      const record = list[index];
      if (record) loadRecordIntoForm(record);
    });
  }

  const appnoOverlay = document.getElementById("appno-modal");
  const appnoCloseBtn = document.getElementById("appno-modal-close");

  if (appnoCloseBtn) appnoCloseBtn.addEventListener("click", hideAppNumberModal);

  if (appnoOverlay) {
    appnoOverlay.addEventListener("click", (e) => {
      if (e.target === appnoOverlay) hideAppNumberModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideAppNumberModal();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setDateToToday(document.getElementById("crushDate"));
  syncConcreteTypeOther();
  syncCementTypeOther();
  syncMixModeUI();
  setWcBoxVisible(false);
  setMixBoxVisible(false);
  renderSavedRecords();
  attachEventListeners();
});
