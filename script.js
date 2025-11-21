/* -----------------------------------------------------------
   UNILAG CONCRETE LAB – CLIENT FORM FRONT-END
----------------------------------------------------------- */

const STORAGE_KEY = "unilag-concrete-lab-client-mixes";
let logoImageDataUrl = null;

/* ---------- Helpers ---------- */

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

function setDateToToday(inputEl) {
  if (!inputEl) return;
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
  inputEl.value = todayLocal;
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
  el.classList.remove("status-success", "status-error", "status-info");

  if (type === "success") el.classList.add("status-success");
  else if (type === "error") el.classList.add("status-error");
  else el.classList.add("status-info");
}

function getInputMode() {
  const checked = document.querySelector('input[name="inputMode"]:checked');
  return checked ? checked.value : "kg";
}

/* ---------- Admixtures & SCM Dynamic Rows ---------- */

function createAdmixtureRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  row.innerHTML = `
    <label>
      <span class="label-line">
        Admixture Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="adm_name" value="${data.name || ""}">
    </label>

    <label>
      <span class="label-line">
        Dosage (L/100kg of Cement) <span class="required-asterisk">*</span>
      </span>
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
      <span class="label-line">
        SCM Name <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="scm_name" value="${data.name || ""}">
    </label>

    <label>
      <span class="label-line">
        Percent (%) <span class="required-asterisk">*</span>
      </span>
      <input type="text" name="scm_percent" value="${data.percent || ""}">
    </label>

    <button type="button" class="remove-row-btn">×</button>
  `;

  row.querySelector(".remove-row-btn").onclick = () => row.remove();
  return row;
}

/* ---------- W/C Ratio + Mix Ratio ---------- */
// Show/hide the W/C + Mix ratio boxes
function toggleRatioBoxes(show) {
  const wcBox = document.getElementById("wcratio-box");
  const mixBox = document.getElementById("mixratio-box");

  if (!wcBox || !mixBox) return;

  wcBox.style.display = show ? "" : "none";
  mixBox.style.display = show ? "" : "none";
}

function updateWCRatioFromKg() {
  const cement = parseFloat(document.getElementById("cementContent").value);
  const water = parseFloat(document.getElementById("waterContent").value);
  const fine = parseFloat(document.getElementById("fineAgg").value);
  const medium = parseFloat(document.getElementById("mediumAgg").value);
  const coarse = parseFloat(document.getElementById("coarseAgg").value);

  // If ANY are missing → hide boxes
  if ([cement, water, fine, medium, coarse].some(v => isNaN(v) || v === "")) {
    toggleRatioBoxes(false);
    return 0;
  }

  // All filled → compute + show boxes
  const ratio = water / cement;
  document.getElementById("wcRatioValue").textContent = ratio.toFixed(2);
  toggleRatioBoxes(true);

  return ratio;
}

function updateMixRatioFromKg() {
  const cement = parseFloat(document.getElementById("cementContent").value);
  const fine = parseFloat(document.getElementById("fineAgg").value);
  const medium = parseFloat(document.getElementById("mediumAgg").value);
  const coarse = parseFloat(document.getElementById("coarseAgg").value);
  const water = parseFloat(document.getElementById("waterContent").value);

  if ([cement, fine, medium, coarse, water].some(v => isNaN(v) || v === "")) {
    toggleRatioBoxes(false);
    return "";
  }

  const mix = `1 : ${(fine / cement).toFixed(2)} : ${(medium / cement).toFixed(2)} : ${(coarse / cement).toFixed(2)} : ${(water / cement).toFixed(2)}`;
  document.getElementById("mixRatioValue").textContent = mix;
  toggleRatioBoxes(true);
  return mix;
}

function updateWcAndMixFromRatio() {
  const c = parseFloat(document.getElementById("ratioCement").value);
  const f = parseFloat(document.getElementById("ratioFine").value);
  const m = parseFloat(document.getElementById("ratioMedium").value);
  const co = parseFloat(document.getElementById("ratioCoarse").value);
  const w = parseFloat(document.getElementById("ratioWater").value);

  if ([c, f, m, co, w].some(v => isNaN(v) || v === "")) {
    toggleRatioBoxes(false);
    return { wcRatio: 0, mixRatioString: "" };
  }

  const wc = w / c;
  const mix = `1 : ${(f / c).toFixed(2)} : ${(m / c).toFixed(2)} : ${(co / c).toFixed(2)} : ${(w / c).toFixed(2)}`;

  document.getElementById("wcRatioValue").textContent = wc.toFixed(2);
  document.getElementById("mixRatioValue").textContent = mix;

  toggleRatioBoxes(true);

  return { wcRatio: wc, mixRatioString: mix };
}

/* ---------- Input Mode UI ---------- */

function syncInputModeUI() {
  const mode = getInputMode();
  const kgInputs = document.getElementById("kgInputs");
  const ratioInputs = document.getElementById("ratioInputs");
  const kgHeading = document.getElementById("kgHeading");
  const ratioHeading = document.getElementById("ratioHeading");

  if (mode === "kg") {
    if (kgInputs) kgInputs.style.display = "";
    if (kgHeading) kgHeading.style.display = "";
    if (ratioInputs) ratioInputs.style.display = "none";
    if (ratioHeading) ratioHeading.style.display = "none";
  } else {
    if (kgInputs) kgInputs.style.display = "none";
    if (kgHeading) kgHeading.style.display = "none";
    if (ratioInputs) ratioInputs.style.display = "";
    if (ratioHeading) ratioHeading.style.display = "";
  }
}

/* ---------- Show / Hide "Other" fields ---------- */

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

/* ---------- Validation ---------- */

function validateForm() {
  const mode = getInputMode();

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
    "targetStrength",
    "notes",
  ];

  const kgRequired = ["cementContent", "waterContent", "fineAgg", "mediumAgg", "coarseAgg"];
  const ratioRequired = ["ratioCement", "ratioFine", "ratioMedium", "ratioCoarse", "ratioWater"];

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

  // If "Other" is selected, ensure details are given
  const concreteType = document.getElementById("concreteType");
  if (concreteType && concreteType.value === "Other") {
    checkId("concreteTypeOther");
  }

  const cementType = document.getElementById("cementType");
  if (cementType && cementType.value === "Other") {
    checkId("cementTypeOther");
  }

  if (mode === "kg") {
    kgRequired.forEach(checkId);
  } else {
    ratioRequired.forEach(checkId);
  }

    // If user has added any admixture rows, both fields in each row are required
  const admRows = document.querySelectorAll("#admixtures-container .dynamic-row");
  if (admRows.length > 0) {
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
  }

  // If user has added any SCM rows, both fields in each row are required
  const scmRows = document.querySelectorAll("#scms-container .dynamic-row");
  if (scmRows.length > 0) {
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
  }

  const errorSummary = document.getElementById("form-error-summary");

  if (missing.length) {
    if (errorSummary) {
      errorSummary.textContent = "Please fill all required fields.";
      errorSummary.style.display = "block";
    }
    if (firstBad) firstBad.focus();
    return false;
  }

  if (errorSummary) {
    errorSummary.style.display = "none";
  }
  return true;
}

/* ---------- Collect Form Data ---------- */

function collectFormData() {
  const mode = getInputMode();

  // Concrete type (handling "Other")
  let concreteType = document.getElementById("concreteType").value;
  if (concreteType === "Other") {
    concreteType = document.getElementById("concreteTypeOther").value.trim();
  }

  // Cement type (handling "Other")
  let cementType = document.getElementById("cementType").value;
  if (cementType === "Other") {
    cementType = document.getElementById("cementTypeOther").value.trim();
  }

  // Admixtures
  const admixtures = [];
  document.querySelectorAll("#admixtures-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="adm_name"]').value.trim();
    const dosage = row.querySelector('input[name="adm_dosage"]').value.trim();
    if (name || dosage) {
      admixtures.push({ name, dosage });
    }
  });

  // SCMs
  const scms = [];
  document.querySelectorAll("#scms-container .dynamic-row").forEach((row) => {
    const name = row.querySelector('input[name="scm_name"]').value.trim();
    const percent = row.querySelector('input[name="scm_percent"]').value.trim();
    if (name || percent) {
      scms.push({ name, percent });
    }
  });

  // Kg inputs
  const cementContent = Number(document.getElementById("cementContent").value || 0);
  const waterContent = Number(document.getElementById("waterContent").value || 0);
  const fineAgg = Number(document.getElementById("fineAgg").value || 0);
  const mediumAgg = Number(document.getElementById("mediumAgg").value || 0);
  const coarseAgg = Number(document.getElementById("coarseAgg").value || 0);

  // Ratio inputs
  const ratioCement = Number(document.getElementById("ratioCement").value || 0);
  const ratioFine = Number(document.getElementById("ratioFine").value || 0);
  const ratioMedium = Number(document.getElementById("ratioMedium").value || 0);
  const ratioCoarse = Number(document.getElementById("ratioCoarse").value || 0);
  const ratioWater = Number(document.getElementById("ratioWater").value || 0);

  // Compute W/C + mix ratio
  let wcRatio = 0;
  let mixRatioString = "";

    if (mode === "kg") {
    wcRatio = updateWCRatioFromKg();
    mixRatioString = updateMixRatioFromKg();
  } else {
    const result = updateWcAndMixFromRatio();
    wcRatio = result.wcRatio;
    mixRatioString = result.mixRatioString;
  }

  // Main payload
  const data = {
    inputMode: mode,
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
    targetStrength: Number(document.getElementById("targetStrength").value || 0),
    notes: document.getElementById("notes").value.trim(),

    cementContent,
    waterContent,
    fineAgg,
    mediumAgg,
    coarseAgg,

    ratioCement,
    ratioFine,
    ratioMedium,
    ratioCoarse,
    ratioWater,

    admixtures,
    scms,

    wcRatio,
    mixRatioString,
  };

  return data;
}

/* ---------- Local Storage ---------- */

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

function saveLocal(record) {
  const list = getLocalRecords();
  list.push(record);
  saveLocalRecords(list);
}

/* ---------- Render Saved Table ---------- */

function renderSavedRecords() {
  const list = getLocalRecords();
  const tbody = document.getElementById("mixes-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>`;
    return;
  }

  list.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.dataset.index = i;

    const wcText =
      typeof r.wcRatio === "number" && !isNaN(r.wcRatio)
        ? r.wcRatio.toFixed(2)
        : r.wcRatio || "";

    const when = r.savedAt ? new Date(r.savedAt).toLocaleString() : "";

    tr.innerHTML = `
      <td>${r.recordId || "—"}</td>
      <td>${r.inputMode === "ratio" ? "Ratio" : "Kg/m³"}</td>
      <td>${r.clientName || ""}</td>
      <td>${r.concreteType || ""}</td>
      <td>${wcText}</td>
      <td>${when}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* ---------- Load Record Back Into Form ---------- */

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
  document.getElementById("targetStrength").value = r.targetStrength ?? "";
  document.getElementById("notes").value = r.notes || "";

  // Restore Concrete Type
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

  // Restore Cement Type
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

  // Mix / mode
  const mode = r.inputMode === "ratio" ? "ratio" : "kg";
  const modeKg = document.getElementById("modeKg");
  const modeRatio = document.getElementById("modeRatio");
  if (mode === "kg") {
    if (modeKg) modeKg.checked = true;
  } else if (modeRatio) {
    modeRatio.checked = true;
  }
  syncInputModeUI();

  // Kg inputs
  document.getElementById("cementContent").value = r.cementContent ?? "";
  document.getElementById("waterContent").value = r.waterContent ?? "";
  document.getElementById("fineAgg").value = r.fineAgg ?? "";
  document.getElementById("mediumAgg").value = r.mediumAgg ?? "";
  document.getElementById("coarseAgg").value = r.coarseAgg ?? "";

  // Ratio inputs
  document.getElementById("ratioCement").value = r.ratioCement ?? "1";
  document.getElementById("ratioFine").value = r.ratioFine ?? "";
  document.getElementById("ratioMedium").value = r.ratioMedium ?? "";
  document.getElementById("ratioCoarse").value = r.ratioCoarse ?? "";
  document.getElementById("ratioWater").value = r.ratioWater ?? "";

  // Update W/C + mix according to current mode
  if (mode === "kg") {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  } else {
    updateWcAndMixFromRatio();
  }

  // Admixtures
  const admContainer = document.getElementById("admixtures-container");
  admContainer.innerHTML = "";
  if (Array.isArray(r.admixtures) && r.admixtures.length) {
    r.admixtures.forEach((a) => admContainer.appendChild(createAdmixtureRow(a)));
  }

  // SCMs
  const scmContainer = document.getElementById("scms-container");
  scmContainer.innerHTML = "";
  if (Array.isArray(r.scms) && r.scms.length) {
    r.scms.forEach((s) => scmContainer.appendChild(createScmRow(s)));
  }

  // “Other” visibility
  syncConcreteTypeOther();
  syncCementTypeOther();

  setStatusLine("Saved record loaded into form.", "info");
}

/* ---------- PDF Generation ---------- */

async function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });

  const pageW = 595;
  const margin = 32;
  let y = 40;

  // Logo
  if (logoImageDataUrl) {
    doc.addImage(logoImageDataUrl, "PNG", margin, y, 60, 60);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CONCRETE LABORATORY – UNIVERSITY OF LAGOS", margin + 80, y + 20);
  doc.setFontSize(10);
  doc.text("Cube Testing Request – External Clients", margin + 80, y + 38);
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
  doc.text(`Client Name: ${data.clientName}`, margin, y);
  y += 14;
  doc.text(`Contact Email: ${data.contactEmail}`, margin, y);
  y += 14;
  doc.text(`Contact Phone: ${data.phoneNumber}`, margin, y);
  y += 14;
  doc.text(`Organisation Type: ${data.organisationType}`, margin, y);
  y += 14;
  doc.text(`Contact Person: ${data.contactPerson}`, margin, y);
  y += 14;
  doc.text(`Project / Site: ${data.projectSite}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Test Information", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.text(`Crushing Date: ${data.crushDate}`, margin, y);
  y += 14;
  doc.text(`Concrete Type: ${data.concreteType}`, margin, y);
  y += 14;
  doc.text(`Cement Type: ${data.cementType}`, margin, y);
  y += 14;
  doc.text(`Slump (mm): ${data.slump}`, margin, y);
  y += 14;
  doc.text(`Age at Testing (days): ${data.ageDays}`, margin, y);
  y += 14;
  doc.text(`Number of Cubes: ${data.cubesCount}`, margin, y);
  y += 14;
  doc.text(`Target Strength (MPa): ${data.targetStrength}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text(
    data.inputMode === "ratio"
      ? "Material Quantities (Ratios by Cement)"
      : "Material Quantities (kg/m³)",
    margin,
    y
  );
  y += 16;
  doc.setFont("helvetica", "normal");

  if (data.inputMode === "kg") {
    doc.text(`Cement: ${data.cementContent}`, margin, y);
    y += 14;
    doc.text(`Water: ${data.waterContent}`, margin, y);
    y += 14;
    doc.text(`Fine Aggregate: ${data.fineAgg}`, margin, y);
    y += 14;
    doc.text(`Medium Aggregate: ${data.mediumAgg}`, margin, y);
    y += 14;
    doc.text(`Coarse Aggregate: ${data.coarseAgg}`, margin, y);
    y += 14;
  } else {
    doc.text(`Cement: ${data.ratioCement}`, margin, y);
    y += 14;
    doc.text(`Fine Aggregate: ${data.ratioFine}`, margin, y);
    y += 14;
    doc.text(`Medium Aggregate: ${data.ratioMedium}`, margin, y);
    y += 14;
    doc.text(`Coarse Aggregate: ${data.ratioCoarse}`, margin, y);
    y += 14;
    doc.text(`Water: ${data.ratioWater}`, margin, y);
    y += 14;
  }

  const wcRatio =
    typeof data.wcRatio === "number" && !isNaN(data.wcRatio)
      ? data.wcRatio.toFixed(2)
      : String(data.wcRatio || "");

  doc.text(`W/C Ratio: ${wcRatio}`, margin, y);
  y += 14;
  doc.text(`Mix Ratio: ${data.mixRatioString || ""}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Admixtures", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  if (data.admixtures && data.admixtures.length) {
    data.admixtures.forEach((a, i) => {
      doc.text(
        `${i + 1}. ${a.name || ""} | ${a.dosage || ""} L/100kg`,
        margin,
        y
      );
      y += 14;
    });
  } else {
    doc.text("None", margin, y);
    y += 14;
  }
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("SCMs", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  if (data.scms && data.scms.length) {
    data.scms.forEach((s, i) => {
      doc.text(`${i + 1}. ${s.name || ""} | ${s.percent || ""}%`, margin, y);
      y += 14;
    });
  } else {
    doc.text("None", margin, y);
    y += 14;
  }
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Notes", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  const notesLines = doc.splitTextToSize(
    data.notes || "",
    pageW - margin * 2
  );
  doc.text(notesLines, margin, y);

  const filename = `${sanitizeFilename(
    data.clientName || "Client"
  )}_${sanitizeFilename(data.projectSite || "CubeTest")}.pdf`;
  doc.save(filename);
}

/* ---------- CSV Export & Clear ---------- */

function exportCsv() {
  const list = getLocalRecords();
  if (!list.length) return;

  const headers = [
    "RecordId",
    "InputMode",
    "ClientName",
    "Email",
    "Phone",
    "organisationType",
    "ContactPerson",
    "ProjectSite",
    "CrushDate",
    "ConcreteType",
    "CementType",
    "Slump",
    "AgeDays",
    "CubesCount",
    "TargetStrength",
    "CementContent",
    "WaterContent",
    "FineAgg",
    "MediumAgg",
    "CoarseAgg",
    "RatioCement",
    "RatioFine",
    "RatioMedium",
    "RatioCoarse",
    "RatioWater",
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
      r.targetStrength ?? "",
      r.cementContent ?? "",
      r.waterContent ?? "",
      r.fineAgg ?? "",
      r.mediumAgg ?? "",
      r.coarseAgg ?? "",
      r.ratioCement ?? "",
      r.ratioFine ?? "",
      r.ratioMedium ?? "",
      r.ratioCoarse ?? "",
      r.ratioWater ?? "",
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

/* ---------- Form Submit ---------- */

async function submitForm(event) {
  event.preventDefault();
  if (!validateForm()) return;

  setStatusLine("Submitting...", "info");

  const data = collectFormData();

  // Try to load logo for PDF if not already done
  if (!logoImageDataUrl) {
    logoImageDataUrl = await loadImageAsDataURL("unilag-logo.png");
  }

  let apiResult = null;

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      apiResult = await res.json();
    } else {
      console.error("API error", res.status);
    }
  } catch (err) {
    console.error("Network error submitting to API:", err);
  }

  if (apiResult && apiResult.success) {
    // update wc/mix ratio from server if returned
    if (typeof apiResult.wcRatio !== "undefined") {
      data.wcRatio = apiResult.wcRatio;
      const span = document.getElementById("wcRatioValue");
      if (span && !isNaN(apiResult.wcRatio)) {
        span.textContent = apiResult.wcRatio.toFixed(2);
      }
    }
    if (apiResult.mixRatioString) {
      data.mixRatioString = apiResult.mixRatioString;
      const span = document.getElementById("mixRatioValue");
      if (span) span.textContent = apiResult.mixRatioString;
    }

    data.recordId = apiResult.recordId;

    // Show modal with application number
    const modal = document.getElementById("appModal");
    const modalNumber = document.getElementById("modalNumber");
    if (modal && modalNumber) {
      modalNumber.textContent = apiResult.recordId;
      modal.classList.remove("hidden");
    }

    setStatusLine("Submitted to lab and saved locally.", "success");
  } else {
    setStatusLine(
      "Saved locally and PDF generated, but could not submit to server.",
      "error"
    );
  }

  // Save locally
  const localRecord = {
    ...data,
    recordId: data.recordId || null,
    savedAt: new Date().toISOString(),
  };
  saveLocal(localRecord);
  renderSavedRecords();

  // Generate PDF
  await generatePDF(data);
}

/* ---------- Reset Form ---------- */

function resetFormFields() {
  const form = document.getElementById("mix-form");
  if (!form) return;
  form.reset();

  // Reset ratio mode UI, date, default ratio cement
  setDateToToday(document.getElementById("crushDate"));
  document.getElementById("ratioCement").value = "1";
  document.getElementById("wcRatioValue").textContent = "0.00";
  document.getElementById("mixRatioValue").textContent = "–";

  syncInputModeUI();
  syncConcreteTypeOther();
  syncCementTypeOther();

  // Reset dynamic rows (containers empty – user must click "Add")
  const admContainer = document.getElementById("admixtures-container");
  admContainer.innerHTML = "";

  const scmContainer = document.getElementById("scms-container");
  scmContainer.innerHTML = "";

  setStatusLine("", "info");
}

/* ---------- Modal Wiring ---------- */

function initModal() {
  const modal = document.getElementById("appModal");
  const closeBtn = document.getElementById("modalClose");
  if (!modal || !closeBtn) return;

  function close() {
    modal.classList.add("hidden");
  }

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  // Year in footer
  const yearSpan = document.getElementById("year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // Date default
  setDateToToday(document.getElementById("crushDate"));

  // Load logo early
  loadImageAsDataURL("unilag-logo.png").then((d) => (logoImageDataUrl = d));

  // Add-row buttons
  document.getElementById("add-admixture-btn").onclick = () =>
    document
      .getElementById("admixtures-container")
      .appendChild(createAdmixtureRow());

  document.getElementById("add-scm-btn").onclick = () =>
    document.getElementById("scms-container").appendChild(createScmRow());

  // Mode radio
  document.getElementById("modeKg").addEventListener("change", syncInputModeUI);
  document.getElementById("modeRatio").addEventListener("change", syncInputModeUI);
  syncInputModeUI();

  // "Other" selectors
  document
    .getElementById("concreteType")
    .addEventListener("change", syncConcreteTypeOther);
  document
    .getElementById("cementType")
    .addEventListener("change", syncCementTypeOther);
  syncConcreteTypeOther();
  syncCementTypeOther();

  // Kg fields updates
  document.getElementById("cementContent").addEventListener("input", () => {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  });
  document.getElementById("waterContent").addEventListener("input", () => {
    updateWCRatioFromKg();
    updateMixRatioFromKg();
  });
  document.getElementById("fineAgg").addEventListener("input", updateMixRatioFromKg);
  document.getElementById("mediumAgg").addEventListener("input", updateMixRatioFromKg);
  document.getElementById("coarseAgg").addEventListener("input", updateMixRatioFromKg);

   // Ratio fields updates
  document
    .getElementById("ratioCement")
    .addEventListener("input", updateWcAndMixFromRatio);
  document
    .getElementById("ratioFine")
    .addEventListener("input", updateWcAndMixFromRatio);
  document
    .getElementById("ratioMedium")
    .addEventListener("input", updateWcAndMixFromRatio);
  document
    .getElementById("ratioCoarse")
    .addEventListener("input", updateWcAndMixFromRatio);
  document
    .getElementById("ratioWater")
    .addEventListener("input", updateWcAndMixFromRatio);

  // Submit
  document.getElementById("mix-form").addEventListener("submit", submitForm);

  // Reset
  document
    .getElementById("reset-form-btn")
    .addEventListener("click", resetFormFields);

  // CSV + Clear
  document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
  document.getElementById("clear-all-btn").addEventListener("click", clearAllRecords);

  // Table row click
  document.getElementById("mixes-table-body").addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr || tr.classList.contains("no-data")) return;
    const idx = tr.dataset.index;
    if (typeof idx === "undefined") return;
    const record = getLocalRecords()[idx];
    if (record) loadRecordIntoForm(record);
  });

  // Modal
  initModal();

  // First render of saved records
  renderSavedRecords();
});