/* ------------------------------------------------------------
   GLOBAL CONSTANTS AND SIMPLE HELPERS
------------------------------------------------------------ */
const STORAGE_KEY = "concrete-mixes";
let logoImageDataUrl = null;

function loadImageAsDataURL(path) {
  return fetch(path)
    .then(resp => {
      if (!resp.ok) throw new Error("image load failed");
      return resp.blob();
    })
    .then(
      blob =>
        new Promise(resolve => {
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
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0, 10);
  inputEl.value = todayLocal;
}

function setStatusLine(message, kind = "info") {
  const el = document.getElementById("status-line");
  if (!el) return;

  // if no message, hide the pill and stop
  if (!message) {
    el.textContent = "";
    el.style.display = "none";
    el.classList.remove("status-success", "status-error", "status-info");
    return;
  }

  // show pill with the right style
  el.style.display = "block";
  el.textContent = message;
  el.classList.remove("status-success", "status-error", "status-info");
  if (kind === "success") el.classList.add("status-success");
  else if (kind === "error") el.classList.add("status-error");
  else el.classList.add("status-info");
}


/* ------------------------------------------------------------
   DYNAMIC ROWS FOR ADMIXTURES AND SCMS
------------------------------------------------------------ */
function createAdmixtureRow(data = {}) {
  const row = document.createElement("div");
  row.className = "dynamic-row";

  row.innerHTML = `
    <label>
      <span class="label-line">Admixture Name <span class="required-asterisk">*</span></span>
      <input type="text" placeholder="e.g. SP 1000" name="adm_name" value="${data.name || ""}">
    </label>

    <label>
      <span class="label-line">Type <span class="required-asterisk">*</span></span>
      <input type="text" placeholder="e.g. PCE or Nil" name="adm_type" value="${data.type || ""}">
    </label>

    <label>
      <span class="label-line">Dosage (L/100kg of Cement) <span class="required-asterisk">*</span></span>
      <input type="number" name="adm_dosage" value="${data.dosage || ""}">
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
      <input type="text" placeholder="e.g. Fly Ash" name="scm_name" value="${data.name || ""}">
    </label>

    <label>
      <span class="label-line">Percent (%) <span class="required-asterisk">*</span></span>
      <input type="text" name="scm_percent" value="${data.percent || ""}">
    </label>

    <label>
      <span class="label-line">Quantity (kg/m³) <span class="required-asterisk">*</span></span>
      <input type="number" name="scm_quantity" value="${data.quantity || ""}">
    </label>

    <button type="button" class="remove-row-btn">×</button>
  `;

  row.querySelector(".remove-row-btn").onclick = () => row.remove();
  return row;
}

/* ------------------------------------------------------------
   WATER–CEMENT RATIO AND MIX RATIO (KG MODE)
------------------------------------------------------------ */
function updateWCRatio() {
  const cement = parseFloat(document.getElementById("cementContent").value);
  const water = parseFloat(document.getElementById("waterContent").value);
  let ratio = 0;
  if (!isNaN(cement) && cement > 0 && !isNaN(water)) {
    ratio = water / cement;
  }
  document.getElementById("wcRatioValue").textContent = ratio.toFixed(2);
  return ratio;
}

function updateMixRatio() {
  const cement = parseFloat(document.getElementById("cementContent").value);
  const water = parseFloat(document.getElementById("waterContent").value);
  const fine = parseFloat(document.getElementById("fineAgg").value);
  const medium = parseFloat(document.getElementById("mediumAgg").value);
  const coarse = parseFloat(document.getElementById("coarseAgg").value);
  const el = document.getElementById("mixRatioValue");

  if (!el) {
    return "";
  }

  if (isNaN(cement) || cement <= 0 || [water, fine, medium, coarse].some(v => isNaN(v))) {
    el.textContent = "–";
    return "";
  }

  const fineRatio = fine / cement;
  const mediumRatio = medium / cement;
  const coarseRatio = coarse / cement;
  const waterRatio = water / cement;

  const ratioText = `1 : ${fineRatio.toFixed(2)} : ${mediumRatio.toFixed(2)} : ${coarseRatio.toFixed(
    2
  )} : ${waterRatio.toFixed(2)}`;

  el.textContent = ratioText;
  return ratioText;
}

/* ------------------------------------------------------------
   VALIDATION
------------------------------------------------------------ */
function validateForm() {
  const commonFields = [
    "studentName",
    "matricNo",
    "institution",
    "supervisor",
    "projectTitle",
    "crushDate",
    "concreteType",
    "cementType",
    "slump",
    "ageDays",
    "cubesCount",
    "notes"
  ];

  let missing = [];
  let firstInvalid = null;

  document.querySelectorAll(".error").forEach(e => e.classList.remove("error"));

  commonFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add("error");
      missing.push(id);
      if (!firstInvalid) firstInvalid = el;
    }
  });

  if (document.getElementById("concreteType").value === "Other") {
    const other = document.getElementById("concreteTypeOther").value.trim();
    if (!other) {
      document.getElementById("concreteTypeOther").classList.add("error");
      missing.push("Custom Concrete Type");
      if (!firstInvalid) firstInvalid = document.getElementById("concreteTypeOther");
    }
  }

  if (document.getElementById("cementType").value === "Other") {
    const other = document.getElementById("cementTypeOther").value.trim();
    if (!other) {
      document.getElementById("cementTypeOther").classList.add("error");
      missing.push("Custom Cement Type");
      if (!firstInvalid) firstInvalid = document.getElementById("cementTypeOther");
    }
  }

  const inputModeEl = document.querySelector('input[name="inputMode"]:checked');
  const inputMode = inputModeEl ? inputModeEl.value : "kg";

  if (inputMode === "kg") {
    const kgFields = [
      "cementContent",
      "waterContent",
      "fineAgg",
      "mediumAgg",
      "coarseAgg"
    ];
    kgFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.classList.add("error");
        missing.push(id);
        if (!firstInvalid) firstInvalid = el;
      }
    });
  } else {
    const ratioFields = [
      "ratioCement",
      "ratioFine",
      "ratioMedium",
      "ratioCoarse",
      "ratioWater"
    ];
    ratioFields.forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.classList.add("error");
        missing.push(id);
        if (!firstInvalid) firstInvalid = el;
      }
    });
  }

  const admFirst = document.querySelector("#admixtures-container .dynamic-row");
  if (admFirst) {
    admFirst.querySelectorAll("input").forEach(inp => {
      if (!inp.value.trim()) {
        inp.classList.add("error");
        missing.push("Admixture field");
        if (!firstInvalid) firstInvalid = inp;
      }
    });
  }

  const scmFirst = document.querySelector("#scms-container .dynamic-row");
  if (scmFirst) {
    scmFirst.querySelectorAll("input").forEach(inp => {
      if (!inp.value.trim()) {
        inp.classList.add("error");
        missing.push("SCM field");
        if (!firstInvalid) firstInvalid = inp;
      }
    });
  }

  const summary = document.getElementById("form-error-summary");

  if (missing.length > 0) {
    summary.style.display = "block";
    summary.textContent = "Please fill the required fields.";
    if (firstInvalid) firstInvalid.focus();
    return false;
  }

  summary.style.display = "none";
  return true;
}

/* ------------------------------------------------------------
   COLLECT FORM DATA
------------------------------------------------------------ */
function collectFormData() {
  const admixtures = [];
  const scms = [];

  document.querySelectorAll("#admixtures-container .dynamic-row").forEach(row => {
    const name = row.querySelector('input[name="adm_name"]').value.trim();
    const type = row.querySelector('input[name="adm_type"]').value.trim();
    const dosage = row.querySelector('input[name="adm_dosage"]').value.trim();
    if (name || type || dosage) {
      admixtures.push({ name, type, dosage });
    }
  });

  document.querySelectorAll("#scms-container .dynamic-row").forEach(row => {
    const name = row.querySelector('input[name="scm_name"]').value.trim();
    const percent = row.querySelector('input[name="scm_percent"]').value.trim();
    const quantity = row.querySelector('input[name="scm_quantity"]').value.trim();
    if (name || percent || quantity) {
      scms.push({ name, percent, quantity });
    }
  });

  const inputModeEl = document.querySelector('input[name="inputMode"]:checked');
  const inputMode = inputModeEl ? inputModeEl.value : "kg";

  let wcRatio = 0;
  let mixRatioString = "";

  if (inputMode === "kg") {
    wcRatio = updateWCRatio();
    mixRatioString = updateMixRatio();
  } else {
    const c = parseFloat(document.getElementById("ratioCement").value);
    const f = parseFloat(document.getElementById("ratioFine").value);
    const m = parseFloat(document.getElementById("ratioMedium").value);
    const co = parseFloat(document.getElementById("ratioCoarse").value);
    const w = parseFloat(document.getElementById("ratioWater").value);

    if (!isNaN(c) && c > 0 && [f, m, co, w].every(v => !isNaN(v))) {
      wcRatio = w / c;

      const fineN = f / c;
      const mediumN = m / c;
      const coarseN = co / c;
      const waterN = w / c;

      mixRatioString = `1 : ${fineN.toFixed(2)} : ${mediumN.toFixed(2)} : ${coarseN.toFixed(
        2
      )} : ${waterN.toFixed(2)}`;
    } else {
      wcRatio = 0;
      mixRatioString = "";
    }
  }

  return {
    inputMode,
    studentName: document.getElementById("studentName").value.trim(),
    matricNo: document.getElementById("matricNo").value.trim(),
    institution: document.getElementById("institution").value.trim(),
    supervisor: document.getElementById("supervisor").value.trim(),
    projectTitle: document.getElementById("projectTitle").value.trim(),
    crushDate: document.getElementById("crushDate").value,
    concreteType:
      document.getElementById("concreteType").value === "Other"
        ? document.getElementById("concreteTypeOther").value.trim()
        : document.getElementById("concreteType").value,
    cementType:
      document.getElementById("cementType").value === "Other"
        ? document.getElementById("cementTypeOther").value.trim()
        : document.getElementById("cementType").value,
    slump: Number(document.getElementById("slump").value),
    ageDays: Number(document.getElementById("ageDays").value),
    cubesCount: Number(document.getElementById("cubesCount").value),
    notes: document.getElementById("notes").value.trim(),
    cementContent: Number(document.getElementById("cementContent").value),
    waterContent: Number(document.getElementById("waterContent").value),
    fineAgg: Number(document.getElementById("fineAgg").value),
    mediumAgg: Number(document.getElementById("mediumAgg").value),
    coarseAgg: Number(document.getElementById("coarseAgg").value),
    ratioCement: Number(document.getElementById("ratioCement").value),
    ratioFine: Number(document.getElementById("ratioFine").value),
    ratioMedium: Number(document.getElementById("ratioMedium").value),
    ratioCoarse: Number(document.getElementById("ratioCoarse").value),
    ratioWater: Number(document.getElementById("ratioWater").value),
    wcRatio,
    mixRatioString,
    admixtures,
    scms
  };
}

/* ------------------------------------------------------------
   LOCAL STORAGE HELPERS
------------------------------------------------------------ */
function getLocalMixes() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveLocalMixes(mixes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mixes));
}

function saveLocal(mix) {
  const mixes = getLocalMixes();
  mixes.push(mix);
  saveLocalMixes(mixes);
}

/* ------------------------------------------------------------
   RENDER SAVED MIXES AND LOAD BACK
------------------------------------------------------------ */
function renderSavedMixes() {
  const mixes = getLocalMixes();
  const body = document.getElementById("mixes-table-body");

  body.innerHTML = "";

  if (mixes.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="no-data">No mixes saved yet.</td></tr>`;
    return;
  }

  mixes.forEach((m, index) => {
    const row = document.createElement("tr");
    row.dataset.index = String(index);
    row.innerHTML = `
      <td>${m.applicationNumber || "-"}</td>
      <td>${m.inputMode === "ratio" ? "Ratios" : "Kg/m³"}</td>
      <td>${m.studentName}</td>
      <td>${m.concreteType}</td>
      <td>${(m.wcRatio ?? 0).toFixed(2)}</td>
      <td>${m.timestamp}</td>
    `;
    body.appendChild(row);
  });
}

/* ------------------------------------------------------------
   APPLY INPUT MODE TO UI (updated to toggle headings too)
------------------------------------------------------------ */
function applyInputModeToUI(inputMode) {
  const kgDiv = document.getElementById("kgInputs");
  const ratioDiv = document.getElementById("ratioInputs");
  const modeKg = document.getElementById("modeKg");
  const modeRatio = document.getElementById("modeRatio");
  const kgHeading = document.getElementById("kgHeading");
  const ratioHeading = document.getElementById("ratioHeading");

  if (inputMode === "ratio") {
    if (ratioDiv) ratioDiv.style.display = "block";
    if (kgDiv) kgDiv.style.display = "none";
    if (ratioHeading) ratioHeading.style.display = "block";
    if (kgHeading) kgHeading.style.display = "none";
    if (modeRatio) modeRatio.checked = true;
  } else {
    if (ratioDiv) ratioDiv.style.display = "none";
    if (kgDiv) kgDiv.style.display = "block";
    if (ratioHeading) ratioHeading.style.display = "none";
    if (kgHeading) kgHeading.style.display = "block";
    if (modeKg) modeKg.checked = true;
  }
}

function loadMixIntoForm(mix) {
  document.getElementById("studentName").value = mix.studentName || "";
  document.getElementById("matricNo").value = mix.matricNo || "";
  document.getElementById("institution").value = mix.institution || "";
  document.getElementById("supervisor").value = mix.supervisor || "";
  document.getElementById("projectTitle").value = mix.projectTitle || "";
  document.getElementById("crushDate").value = mix.crushDate || "";
  document.getElementById("slump").value = mix.slump ?? "";
  document.getElementById("ageDays").value = mix.ageDays ?? "";
  document.getElementById("cubesCount").value = mix.cubesCount ?? "";
  document.getElementById("notes").value = mix.notes || "";

  const concreteSelect = document.getElementById("concreteType");
  const concreteOtherWrapper = document.getElementById("concreteTypeOtherWrapper");
  const concreteOther = document.getElementById("concreteTypeOther");
  if ([...concreteSelect.options].some(o => o.value === mix.concreteType)) {
    concreteSelect.value = mix.concreteType;
    concreteOtherWrapper.style.display = "none";
    concreteOther.value = "";
  } else {
    concreteSelect.value = "Other";
    concreteOtherWrapper.style.display = "block";
    concreteOther.value = mix.concreteType || "";
  }

  const cementSelect = document.getElementById("cementType");
  const cementOtherWrapper = document.getElementById("cementTypeOtherWrapper");
  const cementOther = document.getElementById("cementTypeOther");
  if ([...cementSelect.options].some(o => o.value === mix.cementType)) {
    cementSelect.value = mix.cementType;
    cementOtherWrapper.style.display = "none";
    cementOther.value = "";
  } else {
    cementSelect.value = "Other";
    cementOtherWrapper.style.display = "block";
    cementOther.value = mix.cementType || "";
  }

  const mode = mix.inputMode === "ratio" ? "ratio" : "kg";
  applyInputModeToUI(mode);

  if (mode === "kg") {
    document.getElementById("cementContent").value = mix.cementContent ?? "";
    document.getElementById("waterContent").value = mix.waterContent ?? "";
    document.getElementById("fineAgg").value = mix.fineAgg ?? "";
    document.getElementById("mediumAgg").value = mix.mediumAgg ?? "";
    document.getElementById("coarseAgg").value = mix.coarseAgg ?? "";
    updateWCRatio();
    updateMixRatio();
  } else {
    document.getElementById("cementContent").value = "";
    document.getElementById("waterContent").value = "";
    document.getElementById("fineAgg").value = "";
    document.getElementById("mediumAgg").value = "";
    document.getElementById("coarseAgg").value = "";

    document.getElementById("ratioCement").value = mix.ratioCement ?? 1;
    document.getElementById("ratioFine").value = mix.ratioFine ?? "";
    document.getElementById("ratioMedium").value = mix.ratioMedium ?? "";
    document.getElementById("ratioCoarse").value = mix.ratioCoarse ?? "";
    document.getElementById("ratioWater").value = mix.ratioWater ?? "";
  }

  const admContainer = document.getElementById("admixtures-container");
  admContainer.innerHTML = "";
  if (mix.admixtures && mix.admixtures.length) {
    mix.admixtures.forEach(a => admContainer.appendChild(createAdmixtureRow(a)));
  } else {
    admContainer.appendChild(createAdmixtureRow());
  }

  const scmContainer = document.getElementById("scms-container");
  scmContainer.innerHTML = "";
  if (mix.scms && mix.scms.length) {
    mix.scms.forEach(s => scmContainer.appendChild(createScmRow(s)));
  } else {
    scmContainer.appendChild(createScmRow());
  }

  setStatusLine(`Loaded mix with Application Number: ${mix.applicationNumber || "N/A"}`, "info");
}

/* ------------------------------------------------------------
   PDF GENERATION
------------------------------------------------------------ */
async function generatePDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "A4" });

  const pageW = 595;
  const pageH = 842;
  const margin = 32;
  const gapX = 12;

  const topY = 40;
  const logoW = 56;
  const logoH = 56;
  const textX = margin + logoW + gapX;
  const textW = pageW - margin - textX;

  let drewLogo = false;
  if (logoImageDataUrl) {
    try {
      doc.addImage(logoImageDataUrl, "PNG", margin, topY, logoW, logoH);
      drewLogo = true;
    } catch {
      drewLogo = false;
    }
  }
  if (!drewLogo) {
    doc.setDrawColor(100);
    doc.rect(margin, topY, logoW, logoH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("UNILAG", margin + logoW / 2, topY + logoH / 2 + 3, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    "DEPARTMENT OF CIVIL AND ENVIRONMENTAL ENGINEERING",
    textX,
    topY + 14,
    { maxWidth: textW }
  );
  doc.setFontSize(10);
  doc.text("FACULTY OF ENGINEERING", textX, topY + 30, { maxWidth: textW });
  doc.text("CONCRETE LABORATORY (RESEARCH MIX)", textX, topY + 46, { maxWidth: textW });

  doc.setDrawColor(40);
  doc.line(margin, topY + logoH + 10, pageW - margin, topY + logoH + 10);

  const bodyStartY = topY + logoH + 26;
  let y = bodyStartY;
  const lh = 14;
  const leftColX = margin;
  const rightColX = 315;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);

  if (data.applicationNumber) {
    doc.text(`Application Number: ${data.applicationNumber}`, margin, y);
    y += lh;
  }
  doc.text(`Date/Time Generated: ${new Date().toLocaleString()}`, margin, y);
  y += lh;
  doc.text(`Crushing Date: ${data.crushDate}`, margin, y);
  y += lh + 4;

  doc.setFont("helvetica", "bold");
  doc.text("Student & Project Details", leftColX, y);
  y += lh;
  doc.setFont("helvetica", "normal");
  doc.text(`Student: ${data.studentName}`, leftColX, y);
  y += lh;
  doc.text(`Matric / Reg. No.: ${data.matricNo}`, leftColX, y);
  y += lh;
  doc.text(`Institution: ${data.institution}`, leftColX, y);
  y += lh;
  doc.text(`Supervisor: ${data.supervisor}`, leftColX, y);
  y += lh;
  doc.text(`Project Title: ${data.projectTitle}`, leftColX, y);
  y += lh + 4;

  doc.setFont("helvetica", "bold");
  doc.text("Mix Design Overview", leftColX, y);
  y += lh;
  doc.setFont("helvetica", "normal");
  doc.text(`Concrete Type: ${data.concreteType}`, leftColX, y);
  doc.text(`Cement Type: ${data.cementType}`, rightColX, y);
  y += lh;
  doc.text(`Slump / Flow (mm): ${data.slump}`, leftColX, y);
  doc.text(`Age (days): ${data.ageDays}`, rightColX, y);
  y += lh;
  doc.text(`Number of Cubes: ${data.cubesCount}`, leftColX, y);
  y += lh + 4;

  doc.setFont("helvetica", "bold");
  doc.text("Material Quantities", leftColX, y);
  y += lh;
  doc.setFont("helvetica", "normal");

  if (data.inputMode === "kg") {
    doc.text("Mode: Ratios", leftColX, y);
    y += lh;
    const rows = [
      ["Cement (kg/m³)", data.cementContent],
      ["Water (kg/m³)", data.waterContent],
      ["Fine Aggregate (kg/m³)", data.fineAgg],
      ["Medium Aggregate (kg/m³)", data.mediumAgg],
      ["Coarse Aggregate (kg/m³)", data.coarseAgg]
    ];
    rows.forEach(([k, v]) => {
      doc.text(`${k}: ${Number(v).toFixed(2)}`, leftColX, y);
      y += lh;
    });
    doc.text(
      `Derived Water–Cement Ratio: ${(data.wcRatio ?? 0).toFixed(2)}`,
      leftColX,
      y
    );
    y += lh;
    if (data.mixRatioString) {
      doc.text(
        `Normalized Mix Ratio (by cement): ${data.mixRatioString}`,
        leftColX,
        y
      );
      y += lh;
    }
  } else {
    doc.text("Mode: Ratios", leftColX, y);
    y += lh;
    doc.text(
      `Cement : Fine : Medium : Coarse : Water (parts)`,
      leftColX,
      y
    );
    y += lh;
    const ratioText = data.mixRatioString || "";
    if (ratioText) {
      doc.text(`Normalized Mix Ratio (by cement): ${ratioText}`, leftColX, y);
      y += lh;
    } else {
      doc.text(
        `Cement (parts): ${data.ratioCement}, Fine: ${data.ratioFine}, Medium: ${data.ratioMedium}, Coarse: ${data.ratioCoarse}, Water: ${data.ratioWater}`,
        leftColX,
        y
      );
      y += lh;
    }
    doc.text(
      `Derived Water–Cement Ratio (from parts): ${(data.wcRatio ?? 0).toFixed(2)}`,
      leftColX,
      y
    );
    y += lh;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Chemical Admixtures", leftColX, y);
  y += lh;
  doc.setFont("helvetica", "normal");

  if (data.admixtures && data.admixtures.length) {
    data.admixtures.forEach((a, idx) => {
      doc.text(`Admixture ${idx + 1}:`, leftColX, y);
      y += lh;

      if (a.name && a.name.trim().length > 0) {
        doc.text(`Name: ${a.name}`, leftColX + 12, y);
        y += lh;
      }
      if (a.type && a.type.trim().length > 0) {
        doc.text(`Type: ${a.type}`, leftColX + 12, y);
        y += lh;
      }
      if (a.dosage && a.dosage.trim().length > 0) {
        doc.text(
          `Dosage (L/100kg of cement): ${a.dosage}`,
          leftColX + 12,
          y
        );
        y += lh;
      }

      y += 4;
    });
  } else {
    doc.text("None specified.", leftColX, y);
    y += lh;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Partial Cement Replacements (SCMs)", leftColX, y);
  y += lh;
  doc.setFont("helvetica", "normal");

  if (data.scms && data.scms.length) {
    data.scms.forEach((r, idx) => {
      doc.text(`SCM ${idx + 1}:`, leftColX, y);
      y += lh;

      if (r.name && r.name.trim().length > 0) {
        doc.text(
          `SCM Name: ${r.name}`,
          leftColX + 12,
          y
        );
        y += lh;
      }
      if (r.percent && r.percent.trim().length > 0) {
        doc.text(`Percentage: ${r.percent}%`, leftColX + 12, y);
        y += lh;
      }
      if (r.quantity && r.quantity.trim().length > 0) {
        doc.text(`Quantity: ${r.quantity} kg/m³`, leftColX + 12, y);
        y += lh;
      }

      y += 4;
    });
  } else {
    doc.text("None specified.", leftColX, y);
    y += lh;
  }

  if (data.notes && data.notes.trim().length > 0) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("General Notes", leftColX, y);
    y += lh;
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(data.notes, pageW - margin * 2);
    doc.text(wrapped, leftColX, y);
    y += wrapped.length * (lh - 2);
  }

  const boxHeight = 78;
  const boxY = pageH - 32 - boxHeight;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setDrawColor(0);
  doc.rect(32, boxY, pageW - 32 * 2, boxHeight);
  doc.text("FOR OFFICE USE ONLY", 40, boxY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const line1 =
    "Recorded Compressive Strength Results: ______________________________";
  const line2 = "Tested on: ____________________";
  const line3 =
    "Remarks: ___________________________________________________________";
  doc.text(line1, 40, boxY + 34);
  doc.text(line2, 40, boxY + 50);
  doc.text(line3, 40, boxY + 66);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "This document was generated electronically by the Concrete Laboratory, University of Lagos.",
    pageW / 2,
    pageH - 10,
    { align: "center" }
  );

  const student = sanitizeFilename(data.studentName || "Student");
  const date = sanitizeFilename(
    data.crushDate || new Date().toISOString().slice(0, 10)
  );
  doc.save(`${student}_${date}.pdf`);
}

/* ------------------------------------------------------------
   CSV EXPORT AND CLEAR ALL
------------------------------------------------------------ */
function exportCsv() {
  const mixes = getLocalMixes();
  if (!mixes.length) return;

  const headers = [
    "RecordType",              // "MIX", "ADM", or "SCM"
    "ApplicationNumber",
    "InputMode",
    "Timestamp",
    "StudentName",
    "MatricNo",
    "Institution",
    "Supervisor",
    "ProjectTitle",
    "CrushingDate",
    "ConcreteType",
    "CementType",
    "Slump_mm",
    "Age_days",
    "CubesCount",
    "Cement_kgm3",
    "Water_kgm3",
    "FineAgg_kgm3",
    "MediumAgg_kgm3",
    "CoarseAgg_kgm3",
    "Ratio_Cement",
    "Ratio_Fine",
    "Ratio_Medium",
    "Ratio_Coarse",
    "Ratio_Water",
    "WCRatio",
    "MixRatioString",
    "Notes",
    "AdmIndex",
    "AdmName",
    "AdmType",
    "AdmDosage_Lper100kg",
    "ScmIndex",
    "ScmName",
    "ScmPercent",
    "ScmQuantity_kgm3"
  ];

  const lines = [headers.join(",")];

  mixes.forEach(m => {
    const appNo = m.applicationNumber || "";
    const mode = m.inputMode || "";
    const ts = m.timestamp || "";
    const student = m.studentName || "";
    const matric = m.matricNo || "";
    const inst = m.institution || "";
    const sup = m.supervisor || "";
    const title = m.projectTitle || "";
    const crushDate = m.crushDate || "";
    const concType = m.concreteType || "";
    const cemType = m.cementType || "";
    const slump = m.slump ?? "";
    const age = m.ageDays ?? "";
    const cubes = m.cubesCount ?? "";
    const cemKg = m.cementContent ?? "";
    const waterKg = m.waterContent ?? "";
    const fineKg = m.fineAgg ?? "";
    const medKg = m.mediumAgg ?? "";
    const coarseKg = m.coarseAgg ?? "";
    const rC = m.ratioCement ?? "";
    const rF = m.ratioFine ?? "";
    const rM = m.ratioMedium ?? "";
    const rCo = m.ratioCoarse ?? "";
    const rW = m.ratioWater ?? "";
    const wc = m.wcRatio ?? "";
    const mixString = m.mixRatioString || "";
    const notes = (m.notes || "").replace(/\r?\n/g, " ");

    // -----------------------
    // 1) Main MIX row
    // -----------------------
    const mixRow = [
      "MIX",
      appNo,
      mode,
      ts,
      student,
      matric,
      inst,
      sup,
      title,
      crushDate,
      concType,
      cemType,
      slump,
      age,
      cubes,
      cemKg,
      waterKg,
      fineKg,
      medKg,
      coarseKg,
      rC,
      rF,
      rM,
      rCo,
      rW,
      wc,
      mixString,
      notes,
      "",   // AdmIndex
      "",   // AdmName
      "",   // AdmType
      "",   // AdmDosage_Lper100kg
      "",   // ScmIndex
      "",   // ScmName
      "",   // ScmPercent
      ""    // ScmQuantity_kgm3
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);

    lines.push(mixRow.join(","));

    // -----------------------
    // 2) Admixture rows
    // -----------------------
    if (Array.isArray(m.admixtures)) {
      m.admixtures.forEach((a, idx) => {
        const admRow = [
          "ADM",           // RecordType
          appNo,
          mode,
          ts,
          student,
          "",              // MatricNo (can leave blank here)
          "",              // Institution
          "",              // Supervisor
          "",              // ProjectTitle
          "",              // CrushingDate
          "",              // ConcreteType
          "",              // CementType
          "",              // Slump_mm
          "",              // Age_days
          "",              // CubesCount
          "", "", "", "",  // kg/m3 fields
          "", "", "", "", "", // ratio fields
          "",              // WCRatio
          "",              // MixRatioString
          "",              // Notes
          idx + 1,         // AdmIndex (1-based)
          a.name || "",
          a.type || "",
          a.dosage || "",
          "",              // ScmIndex
          "",              // ScmName
          "",              // ScmPercent
          ""               // ScmQuantity_kgm3
        ].map(v => `"${String(v).replace(/"/g, '""')}"`);

        lines.push(admRow.join(","));
      });
    }

    // -----------------------
    // 3) SCM rows
    // -----------------------
    if (Array.isArray(m.scms)) {
      m.scms.forEach((s, idx) => {
        const scmRow = [
          "SCM",           // RecordType
          appNo,
          mode,
          ts,
          student,
          "",              // MatricNo
          "",              // Institution
          "",              // Supervisor
          "",              // ProjectTitle
          "",              // CrushingDate
          "",              // ConcreteType
          "",              // CementType
          "",              // Slump_mm
          "",              // Age_days
          "",              // CubesCount
          "", "", "", "",  // kg/m3 fields
          "", "", "", "", "", // ratio fields
          "",              // WCRatio
          "",              // MixRatioString
          "",              // Notes
          "",              // AdmIndex
          "",              // AdmName
          "",              // AdmType
          "",              // AdmDosage_Lper100kg
          idx + 1,         // ScmIndex (1-based)
          s.name || "",
          s.percent || "",
          s.quantity || ""
        ].map(v => `"${String(v).replace(/"/g, '""')}"`);

        lines.push(scmRow.join(","));
      });
    }
  });

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unilag_research_mixes_full.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearAllMixes() {
  saveLocalMixes([]);
  renderSavedMixes();
  setStatusLine("All local mixes cleared.", "info");
}

/* ------------------------------------------------------------
   APPLICATION NUMBER MODAL
------------------------------------------------------------ */
function openModal(appNo) {
  const modal = document.getElementById("appModal");
  const modalNumber = document.getElementById("modalNumber");
  if (!modal || !modalNumber) return;
  modalNumber.textContent = appNo;
  setTimeout(() => modal.classList.remove("hidden"), 80);
}

function closeModal() {
  const modal = document.getElementById("appModal");
  if (!modal) return;
  modal.classList.add("hidden");
}

/* ------------------------------------------------------------
   FORM SUBMISSION
------------------------------------------------------------ */
async function submitForm(event) {
  event.preventDefault();

  if (!validateForm()) return;

  const data = collectFormData();
  setStatusLine("Saving to server...", "info");

  let response;
  try {
    response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  } catch {
    setStatusLine(
      "Network error. Please check your connection and try again.",
      "error"
    );
    return;
  }

  let result;
  try {
    result = await response.json();
  } catch {
    setStatusLine("Unexpected server response. Please try again.", "error");
    return;
  }

  if (!result.success) {
    setStatusLine("Failed to save to Google Sheets. Please try again.", "error");
    return;
  }

  data.applicationNumber = result.recordId;
  data.timestamp = new Date().toLocaleString();
  if (typeof result.wcRatio === "number") {
    data.wcRatio = result.wcRatio;
  }
  if (typeof result.mixRatioString === "string" && result.mixRatioString) {
    data.mixRatioString = result.mixRatioString;
  }

  saveLocal(data);
  renderSavedMixes();

  if (!logoImageDataUrl) {
    logoImageDataUrl = await loadImageAsDataURL("unilag-logo.png");
  }
  await generatePDF(data);

  openModal(data.applicationNumber);
  setStatusLine(
    `Saved successfully. Application Number: ${data.applicationNumber}`,
    "success"
  );
}

/* ------------------------------------------------------------
   PAGE INITIALISATION
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  const crushDateEl = document.getElementById("crushDate");
  setDateToToday(crushDateEl);

  loadImageAsDataURL("unilag-logo.png").then(d => {
    logoImageDataUrl = d;
  });

  document
    .getElementById("admixtures-container")
    .appendChild(createAdmixtureRow());
  document
    .getElementById("scms-container")
    .appendChild(createScmRow());

  document.getElementById("concreteType").onchange = function () {
    const wrapper = document.getElementById("concreteTypeOtherWrapper");
    if (this.value === "Other") {
      wrapper.style.display = "block";
    } else {
      wrapper.style.display = "none";
      document.getElementById("concreteTypeOther").value = "";
    }
  };

  document.getElementById("cementType").onchange = function () {
    const wrapper = document.getElementById("cementTypeOtherWrapper");
    if (this.value === "Other") {
      wrapper.style.display = "block";
    } else {
      wrapper.style.display = "none";
      document.getElementById("cementTypeOther").value = "";
    }
  };

  document.getElementById("cementContent").oninput = () => {
    updateWCRatio();
    updateMixRatio();
  };
  document.getElementById("waterContent").oninput = () => {
    updateWCRatio();
    updateMixRatio();
  };
  document.getElementById("fineAgg").oninput = updateMixRatio;
  document.getElementById("mediumAgg").oninput = updateMixRatio;
  document.getElementById("coarseAgg").oninput = updateMixRatio;

  document.getElementById("mix-form").onsubmit = submitForm;

  document.getElementById("add-admixture-btn").onclick = () =>
    document
      .getElementById("admixtures-container")
      .appendChild(createAdmixtureRow());

  document.getElementById("add-scm-btn").onclick = () =>
    document
      .getElementById("scms-container")
      .appendChild(createScmRow());

  const modeKg = document.getElementById("modeKg");
  const modeRatio = document.getElementById("modeRatio");

  modeKg.onchange = () => applyInputModeToUI("kg");
  modeRatio.onchange = () => applyInputModeToUI("ratio");

  document.getElementById("reset-form-btn").onclick = () => {
    document.getElementById("mix-form").reset();
    setDateToToday(crushDateEl);

    document.getElementById("admixtures-container").innerHTML = "";
    document.getElementById("scms-container").innerHTML = "";
    document
      .getElementById("admixtures-container")
      .appendChild(createAdmixtureRow());
    document
      .getElementById("scms-container")
      .appendChild(createScmRow());

    applyInputModeToUI("kg");
    updateWCRatio();
    updateMixRatio();
    document.getElementById("form-error-summary").style.display = "none";
    setStatusLine("", "info");
  };

  document.getElementById("export-csv-btn").onclick = exportCsv;
  document.getElementById("clear-all-btn").onclick = clearAllMixes;

  document.getElementById("mixes-table-body").onclick = e => {
    const row = e.target.closest("tr");
    if (!row || row.classList.contains("no-data")) return;
    const idx = row.dataset.index;
    if (idx == null) return;
    const mixes = getLocalMixes();
    const mix = mixes[Number(idx)];
    if (mix) {
      loadMixIntoForm(mix);
    }
  };

  document.getElementById("modalClose").onclick = closeModal;
  document.getElementById("appModal").addEventListener("click", e => {
    if (e.target === e.currentTarget) closeModal();
  });
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") closeModal();
  });

  applyInputModeToUI("kg");
  renderSavedMixes();
  document.getElementById("year").textContent = new Date().getFullYear();
});