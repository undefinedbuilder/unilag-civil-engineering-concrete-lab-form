// SECTION: Lightweight analytics wrapper; safely no-ops if Vercel Analytics isn't present
function track(name, data = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.va === 'function') {
      window.va('event', { name, ...data });
    }
  } catch (_) {}
}

// SECTION: Validation utilities used to gate submission and show inline errors
function allFieldsFilled(form) {
  const fields = form.querySelectorAll('input, select, textarea');
  for (const el of fields) {
    if (el.type === 'hidden') continue;
    if (!el.checkValidity()) return false;
    if (el.value === '' || el.value === null || el.value === undefined) return false;
  }
  return true;
}

function highlightInvalids(form) {
  let firstInvalid = null;
  const fields = form.querySelectorAll('input, select, textarea');
  fields.forEach(el => {
    el.classList.remove('invalid');
    el.removeAttribute('aria-invalid');
    const msg = el.parentElement.querySelector('.invalid-message');
    if (msg) msg.remove();

    const empty = (el.value === '' || el.value === null || el.value === undefined);
    if (!el.checkValidity() || empty) {
      el.classList.add('invalid');
      el.setAttribute('aria-invalid', 'true');
      if (!firstInvalid) firstInvalid = el;

      const small = document.createElement('div');
      small.className = 'invalid-message';
      small.textContent = 'Please fill this field (use 0 if not applicable).';
      el.parentElement.appendChild(small);
    }
  });
  if (firstInvalid) firstInvalid.focus({ preventScroll: true });
  return !!firstInvalid;
}

function wireInvalidClearing(form) {
  form.addEventListener('input', e => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.matches('input, select, textarea')) {
      if (el.value !== '' && el.checkValidity()) {
        el.classList.remove('invalid');
        el.removeAttribute('aria-invalid');
        const msg = el.parentElement.querySelector('.invalid-message');
        if (msg) msg.remove();
      }
    }
  });
}

// SECTION: Top banner controller for transient success/error notifications
const banner = (() => {
  const el = document.getElementById('banner');
  let hideTimer = null;

  function show(message, kind = 'ok', autoHideMs = 4000) {
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('hidden', 'ok', 'err');
    el.classList.add(kind === 'err' ? 'err' : 'ok');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (hideTimer) clearTimeout(hideTimer);
    if (autoHideMs) {
      hideTimer = setTimeout(() => {
        el.classList.add('hidden');
        el.textContent = '';
      }, autoHideMs);
    }
  }

  function hide() {
    if (!el) return;
    el.classList.add('hidden');
    el.textContent = '';
  }

  return { show, hide };
})();

// SECTION: General utilities (image loading, date handling, filenames, derived metrics)
function loadImageAsDataURL(path) {
  return fetch(path)
    .then(resp => {
      if (!resp.ok) throw new Error('image load failed');
      return resp.blob();
    })
    .then(blob => new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    }))
    .catch(() => null);
}

function setDateToToday(inputEl) {
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0,10);
  inputEl.value = todayLocal;
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeWc(water, cement) {
  const w = Number(water);
  const c = Number(cement);
  if (!isFinite(w) || !isFinite(c) || c <= 0) return 0;
  return w / c;
}

// SECTION: Brand to Manufacturer Types mapping used to populate second select
const MANUFACTURER_TYPES = {
  DANGOTE: ['Dangote 3X', 'Dangote BlocMaster', 'Dangote Falcon'],
  LAFARGE: [
    'Lafarge Supaset',
    'Lafarge EcoPlanet Unicem',
    'Lafarge Elephant Supaset',
    'Lafarge Elephant Classic Cement',
    'Lafarge Powermax',
    'Lafarge AshakaCem'
  ],
  BUA: ['BUA']
};

// SECTION: Main bootstrapping — wire UI, validation, submission, modal, and PDF generation
document.addEventListener('DOMContentLoaded', () => {
  // SUBSECTION: Footer year and default date
  document.getElementById('year').textContent = new Date().getFullYear();
  const crushingDate = document.getElementById('crushingDate');
  setDateToToday(crushingDate);

  // SUBSECTION: Brand-driven select and live w/c ratio
  const brandSelect = document.getElementById('cementBrand');
  const manuSelect = document.getElementById('manufacturerCementType');
  const waterEl = document.getElementById('water');
  const cementEl = document.getElementById('cement');
  const wcDisplay = document.getElementById('wcDisplay');

  function updateWcDisplay() {
    const wc = computeWc(waterEl.value, cementEl.value);
    wcDisplay.textContent = (wc || 0).toFixed(2);
  }
  ['input','change'].forEach(evt => {
    waterEl.addEventListener(evt, updateWcDisplay);
    cementEl.addEventListener(evt, updateWcDisplay);
  });
  updateWcDisplay();

  function resetManuSelect() {
    manuSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = "Select Manufacturer's Type";
    manuSelect.appendChild(opt);
  }

  brandSelect.addEventListener('change', () => {
    const brand = brandSelect.value;
    resetManuSelect();

    if (!brand || !MANUFACTURER_TYPES[brand]) {
      manuSelect.disabled = true;
      return;
    }

    MANUFACTURER_TYPES[brand].forEach(v => {
      const o = document.createElement('option');
      o.textContent = v;
      o.value = v;
      o.selected = false;
      manuSelect.appendChild(o);
    });
    manuSelect.disabled = false;
  });

  // SUBSECTION: Form, status, actions, and modal references
  const form = document.getElementById('mixForm');
  wireInvalidClearing(form);
  const status = document.getElementById('status');
  const submitBtn = document.getElementById('submitBtn');
  const retryBtn = document.getElementById('retryBtn');
  const actionsBar = document.getElementById('actionsBar');
  const preButtonNote = document.getElementById('preButtonNote');
  const validationNote = document.getElementById('validationNote');

  const modal = document.getElementById('appModal');
  const modalNumber = document.getElementById('modalNumber');
  const modalClose = document.getElementById('modalClose');

  // SUBSECTION: Ensure modal is hidden on initial load
  if (modal) {
    modal.classList.add('hidden');
  }

  // SUBSECTION: Small helpers for toggling UI state
  function setStatus(msg, kind) {
    status.textContent = msg || '';
    status.classList.remove('ok','err');
    if (kind === 'ok') status.classList.add('ok');
    if (kind === 'err') status.classList.add('err');
  }
  function showRetry(show) {
    retryBtn.classList.toggle('hidden', !show);
    retryBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
    actionsBar.classList.toggle('two-cols', !!show);
  }
  function showPreNote(show) {
    preButtonNote.classList.toggle('hidden', !show);
  }
  function showValidationNote(show) {
    validationNote.classList.toggle('hidden', !show);
  }
  function openModal(appNo) {
    if (!appNo) return;
    modalNumber.textContent = appNo;
    setTimeout(() => modal.classList.remove('hidden'), 100);
    track('app_number_shown');
  }
  function closeModal() {
    modal.classList.add('hidden');
  }

  // SUBSECTION: Modal interactions (click outside, ESC, header button)
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('hidden') && e.key === 'Escape') closeModal();
  });

  // SUBSECTION: Main submit handler — validates, posts to API, handles save failure/success and PDF
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', null);
    banner.hide();
    showRetry(false);
    showPreNote(false);
    showValidationNote(false);
    closeModal();

    const hasInvalids = highlightInvalids(form);
    if (hasInvalids || !allFieldsFilled(form)) {
      setStatus('', 'err');
      showValidationNote(true);
      track('form_validation_error');
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const numericKeys = [
      'cement','slag','flyAsh','silicaFume','limestone','water','superplasticizer','coarseAgg','fineAgg',
      'slump','ageDays','targetMPa','cubesCount'
    ];
    numericKeys.forEach(k => data[k] = Number(data[k]));

    submitBtn.disabled = true;
    setStatus('Submitting...', null);
    track('form_submit_attempt');

    let out;
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      out = await res.json();
      if (!out.success || !out.applicationNumber) throw new Error(out.message || 'Unknown error');
    } catch {
      // Save failed ⇒ do not generate PDF or show application number; invite retry
      setStatus('', null);
      showPreNote(true);
      showRetry(true);
      submitBtn.disabled = false;
      track('form_submit_error', { reason: 'save_failed' });
      return;
    }

    // Save succeeded ⇒ fetch logo, generate PDF, show app number modal, reset form
    const applicationNumber = out.applicationNumber;

    try {
      const logoDataURL = await loadImageAsDataURL('/unilag-logo.png');
      await generatePDF({ ...data, applicationNumber }, logoDataURL);

      openModal(applicationNumber);

      form.reset();
      resetManuSelect();
      manuSelect.disabled = true;
      setDateToToday(crushingDate);
      updateWcDisplay();

      setStatus('PDF downloaded and Data Saved.', 'ok');
      banner.show('Success: Data saved and PDF downloaded.', 'ok');
      showRetry(false);
      showPreNote(false);
      track('form_submit_success');
    } catch {
      setStatus('PDF generation failed. Please try again.', 'err');
      banner.show('PDF generation failed. Please try again.', 'err');
      track('pdf_generation_error');
    } finally {
      submitBtn.disabled = false;
    }

    // SUBSECTION: Retry handler wires the same payload to the API when initial save fails
    retryBtn.onclick = async () => {
      retryBtn.disabled = true;
      submitBtn.disabled = true;
      setStatus('Retrying save to Google Sheets...', null);
      track('retry_attempt');

      try {
        const res = await fetch('/api/submit', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const retryOut = await res.json();
        if (!retryOut.success || !retryOut.applicationNumber) throw new Error(retryOut.message || 'Unknown error');

        const appNo = retryOut.applicationNumber;
        const logoDataURL = await loadImageAsDataURL('/unilag-logo.png');
        await generatePDF({ ...data, applicationNumber: appNo }, logoDataURL);
        openModal(appNo);

        setStatus('Data saved and PDF downloaded.', 'ok');
        banner.show('Data saved and PDF downloaded.', 'ok');
        showRetry(false);
        showPreNote(false);
        track('retry_success');
      } catch {
        setStatus('Retry failed. Please try again later.', 'err');
        banner.show('Retry failed. Please try again later.', 'err');
        showRetry(true);
        showPreNote(true);
        track('retry_error');
      } finally {
        retryBtn.disabled = false;
        submitBtn.disabled = false;
      }
    };
  });
});

// SECTION: One-page PDF generator using jsPDF; draws header, sections, and an office-use box
async function generatePDF(d, logoDataURL) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'A4' });

  const pageW = 595;
  const pageH = 842;
  const margin = 32;
  const gapX = 12;

  // SUBSECTION: Header area with logo (or placeholder) and department text
  const topY = 40;
  const logoW = 56;
  const logoH = 56;
  const textX = margin + logoW + gapX;
  const textW = pageW - margin - textX;

  let drewLogo = false;
  if (logoDataURL) {
    try {
      doc.addImage(logoDataURL, 'PNG', margin, topY, logoW, logoH);
      drewLogo = true;
    } catch { drewLogo = false; }
  }
  if (!drewLogo) {
    doc.setDrawColor(100);
    doc.rect(margin, topY, logoW, logoH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('UNILAG', margin + logoW/2, topY + logoH/2 + 3, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DEPARTMENT OF CIVIL AND ENVIRONMENTAL ENGINEERING', textX, topY + 14, { maxWidth: textW });
  doc.setFontSize(10);
  doc.text('FACULTY OF ENGINEERING', textX, topY + 30, { maxWidth: textW });
  doc.text('CONCRETE LABORATORY', textX, topY + 46, { maxWidth: textW });

  doc.setDrawColor(40);
  doc.line(margin, topY + logoH + 10, pageW - margin, topY + logoH + 10);

  // SUBSECTION: Document body with tightly packed rows
  const bodyStartY = topY + logoH + 26;
  let y = bodyStartY;
  const lh = 14;
  const leftColX = margin;
  const rightColX = 315;

  doc.setFont('helvetica','normal');
  doc.setFontSize(9.5);
  doc.text(`Application Number: ${d.applicationNumber}`, margin, y); y += lh;
  doc.text(`Date/Time Generated: ${new Date().toLocaleString()}`, margin, y); y += lh;
  doc.text(`Crushing Date: ${d.crushingDate}`, margin, y); y += lh + 4;

  // SUBSECTION: Client / Project
  doc.setFont('helvetica','bold'); doc.text('Client / Project', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Client: ${d.clientName}`, leftColX, y); y += lh;
  doc.text(`Project/Site: ${d.projectSite}`, leftColX, y); y += lh;
  doc.text(`Email: ${d.email}`, leftColX, y); y += lh;
  doc.text(`Phone: ${d.phone}`, leftColX, y); y += lh + 4;

  // SUBSECTION: Cement Information
  doc.setFont('helvetica','bold'); doc.text('Cement Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Cement Brand: ${d.cementBrand}`, leftColX, y); y += lh;
  doc.text(`Manufacturer's Cement Type: ${d.manufacturerCementType}`, leftColX, y);
  doc.text(`Cement Type: ${d.cementType}`, rightColX, y); y += lh + 4;

  // SUBSECTION: Superplasticizer
  doc.setFont('helvetica','bold'); doc.text('Superplasticizer Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Superplasticizer Name: ${d.spName}`, leftColX, y); y += lh + 4;

  // SUBSECTION: Mix Composition
  doc.setFont('helvetica','bold'); doc.text('Mix Composition (kg/m³)', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  const rows = [
    ['Cement', d.cement], ['Blast Furnace Slag', d.slag], ['Fly Ash', d.flyAsh],
    ['Silica Fume', d.silicaFume], ['Limestone Filler', d.limestone],
    ['Water', d.water], ['Superplasticizer', d.superplasticizer],
    ['Coarse Aggregate', d.coarseAgg], ['Fine Aggregate', d.fineAgg]
  ];
  rows.forEach(([k,v]) => { doc.text(`${k}: ${Number(v).toFixed(2)}`, leftColX, y); y += lh; });

  // SUBSECTION: Slump
  y += 4;
  doc.setFont('helvetica','bold'); doc.text('Slump / Workability', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Slump (mm): ${Number(d.slump).toFixed(1)}`, leftColX, y); y += lh;

  // SUBSECTION: Age & Target & Cubes
  y += 4;
  doc.setFont('helvetica','bold'); doc.text('Age & Target Strength Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Age (days): ${d.ageDays}`, leftColX, y);
  doc.text(`Target Strength (MPa): ${Number(d.targetMPa).toFixed(2)}`, rightColX, y); y += lh;
  doc.text(`Number of cubes to be crushed: ${d.cubesCount}`, leftColX, y); y += lh;

  // SUBSECTION: Derived metric
  const wc = (d.cement > 0) ? (Number(d.water) / Number(d.cement)) : 0;
  doc.text(`Derived w/c ratio: ${wc.toFixed(2)}`, leftColX, y); y += lh;

  // SUBSECTION: Notes (wrapped to page width)
  if (d.notes && d.notes.trim().length > 0) {
    y += 4;
    doc.setFont('helvetica','bold'); doc.text('Additional Notes', leftColX, y); y += lh;
    doc.setFont('helvetica','normal');
    const wrapped = doc.splitTextToSize(d.notes, 595 - 32*2);
    doc.text(wrapped, leftColX, y);
    y += wrapped.length * (lh - 2);
  }

  // SUBSECTION: For Office Use block at bottom
  const boxHeight = 78;
  const boxY = pageH - 32 - boxHeight;
  doc.setFont('helvetica','bold');
  doc.setFontSize(10.5);
  doc.setDrawColor(0);
  doc.rect(32, boxY, 595 - 32*2, boxHeight);
  doc.text('FOR OFFICE USE ONLY', 40, boxY + 16);

  doc.setFont('helvetica','normal');
  doc.setFontSize(9.5);
  const line1 = 'Crushed Compressive Strength (MPa): ______________________________';
  const line2 = 'Tested on: ____________________';
  const line3 = 'Remarks: ___________________________________________________________';
  doc.text(line1, 40, boxY + 34);
  doc.text(line2, 40, boxY + 50);
  doc.text(line3, 40, boxY + 66);

  // SUBSECTION: Footer and file save
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text('This document was generated electronically by the Concrete Laboratory, University of Lagos.', 297.5, pageH - 10, { align: 'center' });

  const client = sanitizeFilename(d.clientName || 'Client');
  const date = sanitizeFilename(d.crushingDate || new Date().toISOString().slice(0,10));
  doc.save(`${client}_${date}.pdf`);
}
