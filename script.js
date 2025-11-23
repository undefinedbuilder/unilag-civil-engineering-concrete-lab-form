/* -----------------------------------------------------------
   UNILAG CONCRETE LAB – CLIENT FORM FRONT-END
----------------------------------------------------------- */

const STORAGE_KEY = "unilag-concrete-lab-client-mixes";
let logoImageDataUrl = null;

/* ---------- Basic Helpers ---------- */

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

function getSelectedInputMode() {
  const checked = document.querySelector('input[name="inputMode"]:checked');
  return checked ? checked.value : "kg";
}

function setDateToToday(inputEl) {
  if (!inputEl) return;
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
  inputEl.value = todayLocal;
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
        Dosage (% by weight of Cement) <span class="required-asterisk">*</span>
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

/* ---------- Derived Mix Calculations (Kg & Ratio) ---------- */

function toggleDerivedBoxes(show) {
  const wcBox = document.getElementById("wcratio-box");
  const mixBox = document.getElementById("mixratio-box");
  if (!wcBox || !mixBox) return;

  wcBox.style.display = show ? "" : "none";
  mixBox.style.display = show ? "" : "none";
}

/**
 * Compute wcRatio and mixRatioString from kg inputs.
 */
function computeDerivedFromKg(cementKg, waterKg, fineAggKg, coarseAggKg) {
  const c = Number(cementKg);
  const w = Number(waterKg);
  const f = Number(fineAggKg);
  const co = Number(coarseAggKg);

  if (!c || c <= 0 || [w, f, co].some((v) => isNaN(v))) {
    return { wcRatio: null, mixRatioString: "" };
  }

  const wcRatio = w / c;
  const mixRatioString = `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`;
  return { wcRatio, mixRatioString };
}

/**
 * Compute wcRatio and mixRatioString from ratio inputs.
 */
function computeDerivedFromRatio(ratioCement, ratioFine, ratioCoarse, waterCementRatio) {
  const c = Number(ratioCement);
  const f = Number(ratioFine);
  const co = Number(ratioCoarse);
  const wOverC = Number(waterCementRatio); 

  if (!c || c <= 0 || [f, co, wOverC].some((v) => isNaN(v))) {
    return { wcRatio: null, mixRatioString: "" };
  }

  const wcRatio = wOverC;
  const mixRatioString = `1 : ${(f / c).toFixed(2)} : ${(co / c).toFixed(2)}`;
  return { wcRatio, mixRatioString };
}

/**
 * Update derived W/C and mix ratio display
 */
function updateDerivedMixValues() {
  const mode = getSelectedInputMode();

  let wcRatio = null;
  let mixRatioString = "";

  if (mode === "kg") {
    const cementKg = document.getElementById("cementKg").value;
    const waterKg = document.getElementById("waterKg").value;
    const fineAggKg = document.getElementById("fineAggKg").value;
    const coarseAggKg = document.getElementById("coarseAggKg").value;

    ({ wcRatio, mixRatioString } = computeDerivedFromKg(
      cementKg,
      waterKg,
      fineAggKg,
      coarseAggKg
    ));
  } else {
    const ratioCement = document.getElementById("ratioCement").value;
    const ratioFine = document.getElementById("ratioFine").value;
    const ratioCoarse = document.getElementById("ratioCoarse").value;
    const waterCementRatio = document.getElementById("waterCementRatio").value;

    ({ wcRatio, mixRatioString } = computeDerivedFromRatio(
      ratioCement,
      ratioFine,
      ratioCoarse,
      waterCementRatio
    ));
  }

  const wcSpan = document.getElementById("wcRatioValue");
  const mixSpan = document.getElementById("mixRatioValue");

  if (wcRatio === null || !mixRatioString) {
    toggleDerivedBoxes(false);
  } else {
    if (wcSpan) wcSpan.textContent = wcRatio.toFixed(2);
    if (mixSpan) mixSpan.textContent = mixRatioString;
    toggleDerivedBoxes(true);
  }

  return { wcRatio, mixRatioString };
}

/* ---------- Input Mode UI ---------- */

function syncInputModeUI() {
  const mode = getSelectedInputMode();
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

  // Recalculate derived values when mode changes
  updateDerivedMixValues();
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
    "targetStrength",
    "notes",
  ];

  const kgRequired = ["cementKg", "waterKg", "fineAggKg", "coarseAggKg"];
  const ratioRequired = ["ratioCement", "ratioFine", "ratioCoarse", "waterCementRatio"];

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

  // If admixture rows exist, each must be complete
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

  // If SCM rows exist, each must be complete
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

  if (errorSummary) {
    errorSummary.style.display = "none";
  }
  return true;
}

/* ---------- Collect Form Data ---------- */

function collectFormData() {
  const mode = getSelectedInputMode();

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
  const cementKg = Number(document.getElementById("cementKg").value || 0);
  const waterKg = Number(document.getElementById("waterKg").value || 0);
  const fineAggKg = Number(document.getElementById("fineAggKg").value || 0);
  const coarseAggKg = Number(document.getElementById("coarseAggKg").value || 0);

  // Ratio inputs
  const ratioCement = Number(document.getElementById("ratioCement").value || 0);
  const ratioFine = Number(document.getElementById("ratioFine").value || 0);
  const ratioCoarse = Number(document.getElementById("ratioCoarse").value || 0);
  const waterCementRatio = Number(
    document.getElementById("waterCementRatio").value || 0
  );

  // Compute derived values (single function for both modes)
  const { wcRatio, mixRatioString } = updateDerivedMixValues();

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

    // Kg inputs
    cementKg,
    waterKg,
    fineAggKg,
    coarseAggKg,

    // Ratio inputs
    ratioCement,
    ratioFine,
    ratioCoarse,
    waterCementRatio,

    // Extra groups
    admixtures,
    scms,

    // Derived
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

function addLocalRecord(record) {
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

    let wcText = "";
    if (typeof r.wcRatio === "number" && !isNaN(r.wcRatio)) {
      wcText = r.wcRatio.toFixed(2);
    } else if (r.wcRatio) {
      wcText = String(r.wcRatio);
    }

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

  // Concrete Type
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

  // Cement Type
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

  // Input mode
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
  document.getElementById("cementKg").value = r.cementKg ?? "";
  document.getElementById("waterKg").value = r.waterKg ?? "";
  document.getElementById("fineAggKg").value = r.fineAggKg ?? "";
  document.getElementById("coarseAggKg").value = r.coarseAggKg ?? "";

  // Ratio inputs
  document.getElementById("ratioCement").value = r.ratioCement ?? "1";
  document.getElementById("ratioFine").value = r.ratioFine ?? "";
  document.getElementById("ratioCoarse").value = r.ratioCoarse ?? "";
  document.getElementById("waterCementRatio").value = r.waterCementRatio ?? "";

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

  // Sync "Other" visibility
  syncConcreteTypeOther();
  syncCementTypeOther();

  // Recompute derived values
  updateDerivedMixValues();

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
  doc.text("Clients Cube Test Intake Form", margin + 80, y + 38);
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
      ? "Material Quantities (Mix Ratio & W/C)"
      : "Material Quantities (kg/m³)",
    margin,
    y
  );
  y += 16;
  doc.setFont("helvetica", "normal");

  if (data.inputMode === "kg") {
    doc.text(`Cement (kg/m³): ${data.cementKg}`, margin, y);
    y += 14;
    doc.text(`Water (kg/m³): ${data.waterKg}`, margin, y);
    y += 14;
    doc.text(`Fine Aggregate (kg/m³): ${data.fineAggKg}`, margin, y);
    y += 14;
    doc.text(`Coarse Aggregate (kg/m³): ${data.coarseAggKg}`, margin, y);
    y += 14;
  } else {
    doc.text(`Cement : ${data.ratioCement}`, margin, y);
    y += 14;
    doc.text(`Fine Aggregate: ${data.ratioFine}`, margin, y);
    y += 14;
    doc.text(`Coarse Aggregate : ${data.ratioCoarse}`, margin, y);
    y += 14;
    doc.text(`Water–Cement Ratio (W/C): ${data.waterCementRatio}`, margin, y);
    y += 14;
  }

  const wcRatio =
    typeof data.wcRatio === "number" && !isNaN(data.wcRatio)
      ? data.wcRatio.toFixed(2)
      : String(data.wcRatio || "");

  doc.text(`Derived W/C Ratio: ${wcRatio}`, margin, y);
  y += 14;
  doc.text(`Derived Mix Ratio (C:F:C): ${data.mixRatioString || ""}`, margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.text("Admixtures", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  if (data.admixtures && data.admixtures.length) {
    data.admixtures.forEach((a, i) => {
      doc.text(
        `${i + 1}. ${a.name || ""} | ${a.dosage || ""} %`,
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
    "OrganisationType",
    "ContactPerson",
    "ProjectSite",
    "CrushDate",
    "ConcreteType",
    "CementType",
    "Slump",
    "AgeDays",
    "CubesCount",
    "TargetStrength",
    "CementKg",
    "WaterKg",
    "FineAggKg",
    "CoarseAggKg",
    "RatioCement",
    "RatioFine",
    "RatioCoarse",
    "WaterCementRatio",
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
      r.cementKg ?? "",
      r.waterKg ?? "",
      r.fineAggKg ?? "",
      r.coarseAggKg ?? "",
      r.ratioCement ?? "",
      r.ratioFine ?? "",
      r.ratioCoarse ?? "",
      r.waterCementRatio ?? "",
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

  // Load logo only once
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
    if (typeof apiResult.wcRatio !== "undefined") {
      data.wcRatio = apiResult.wcRatio;
    }
    if (typeof apiResult.mixRatioString !== "undefined") {
      data.mixRatioString = apiResult.mixRatioString;
    }
    if (apiResult.recordId) {
      data.recordId = apiResult.recordId;
    }

    data.savedAt = new Date().toISOString();

    addLocalRecord(data);
    renderSavedRecords();

    await generatePDF(data);

    setStatusLine("Submitted and saved successfully.", "success");
  } else {
    setStatusLine("Failed to submit. Please try again.", "error");
  }
}

/* ---------- Reset Form ---------- */

function resetForm() {
  const form = document.getElementById("mix-form");
  if (!form) return;
  form.reset();

  // Reset some defaults
  document.getElementById("ratioCement").value = "1";
  document.getElementById("modeKg").checked = true;

  // Clear dynamic groups
  document.getElementById("admixtures-container").innerHTML = "";
  document.getElementById("scms-container").innerHTML = "";

  syncInputModeUI();
  toggleDerivedBoxes(false);
  setStatusLine("", "info");

  const errorSummary = document.getElementById("form-error-summary");
  if (errorSummary) errorSummary.style.display = "none";
}

/* ---------- Event Wiring ---------- */

function attachEventListeners() {
  const form = document.getElementById("mix-form");
  if (form) {
    form.addEventListener("submit", submitForm);
  }

  const resetBtn = document.getElementById("reset-form-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetForm);
  }

  const exportCsvBtn = document.getElementById("export-csv-btn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportCsv);
  }

  const clearAllBtn = document.getElementById("clear-all-btn");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", clearAllRecords);
  }

  // Input mode radios
  const modeKg = document.getElementById("modeKg");
  const modeRatio = document.getElementById("modeRatio");
  if (modeKg) modeKg.addEventListener("change", syncInputModeUI);
  if (modeRatio) modeRatio.addEventListener("change", syncInputModeUI);

  // Kg inputs → recalc derived
  ["cementKg", "waterKg", "fineAggKg", "coarseAggKg"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateDerivedMixValues);
  });

  // Ratio inputs → recalc derived
  ["ratioCement", "ratioFine", "ratioCoarse", "waterCementRatio"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateDerivedMixValues);
  });

  // Admixture / SCM buttons
  const addAdmBtn = document.getElementById("add-admixture-btn");
  if (addAdmBtn) {
    addAdmBtn.addEventListener("click", () => {
      const container = document.getElementById("admixtures-container");
      container.appendChild(createAdmixtureRow());
    });
  }

  const addScmBtn = document.getElementById("add-scm-btn");
  if (addScmBtn) {
    addScmBtn.addEventListener("click", () => {
      const container = document.getElementById("scms-container");
      container.appendChild(createScmRow());
    });
  }

  // Saved table row click → load into form
  const tbody = document.getElementById("mixes-table-body");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !tr.dataset.index) return;
      const index = Number(tr.dataset.index);
      const list = getLocalRecords();
      const record = list[index];
      if (record) loadRecordIntoForm(record);
    });
  }
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", () => {
  setDateToToday(document.getElementById("crushDate"));
  syncInputModeUI();
  syncConcreteTypeOther();
  syncCementTypeOther();
  renderSavedRecords();
  attachEventListeners();
});



