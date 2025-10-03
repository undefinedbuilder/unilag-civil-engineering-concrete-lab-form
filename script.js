// --- Lightweight Analytics helper (Vercel Web Analytics) ---
function track(name, data = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.va === 'function') {
      window.va('event', { name, ...data });
    }
  } catch (_) { /* no-op if analytics not available */ }
}

// --- Validation helpers ---
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

// --- Top banner ---
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

// --- Utilities ---
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
    .catch(() => null); // return null if logo missing
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

// --- Brand → Manufacturer Type map ---
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  const crushingDate = document.getElementById('crushingDate');
  setDateToToday(crushingDate);

  const brandSelect = document.getElementById('cementBrand');
  const manuSelect = document.getElementById('manufacturerCementType');

  // Live w/c ratio elements
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

  const form = document.getElementById('mixForm');
  wireInvalidClearing(form);

  const status = document.getElementById('status');
  const submitBtn = document.getElementById('submitBtn');
  const retryBtn = document.getElementById('retryBtn');
  const actionsBar = document.getElementById('actionsBar');
  const preButtonNote = document.getElementById('preButtonNote');
  const validationNote = document.getElementById('validationNote');

  // Modal elements
  const modal = document.getElementById('appModal');
  const modalNumber = document.getElementById('modalNumber');
  const modalClose = document.getElementById('modalClose');

  // --- SAFEGUARD: keep modal hidden on load ---
  if (modal) {
    modal.classList.add('hidden');
  }

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
    if (!appNo) return; // guard: never open without a valid ID
    modalNumber.textContent = appNo;
    setTimeout(() => modal.classList.remove('hidden'), 100);
    track('app_number_shown');
  }
  function closeModal() {
    modal.classList.add('hidden');
  }

  // Modal interactions
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('hidden') && e.key === 'Escape') closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', null);
    banner.hide();
    showRetry(false);
    showPreNote(false);
    showValidationNote(false);
    closeModal(); // ensure it’s closed before any operation

    // Validate before any server work
    const hasInvalids = highlightInvalids(form);
    if (hasInvalids || !allFieldsFilled(form)) {
      setStatus('', 'err');
      showValidationNote(true); // red note above the button
      track('form_validation_error');
      return;
    }

    // Collect form data (NO applicationNumber here — server will assign)
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
      // Submission failed: DO NOT generate PDF, DO NOT show app number
      setStatus('', null);
      showPreNote(true);
      showRetry(true);
      submitBtn.disabled = false;
      track('form_submit_error', { reason: 'save_failed' });
      return;
    }

    // If we get here, the row was saved successfully and the server assigned the app number
    const applicationNumber = out.applicationNumber;

    try {
      const logoDataURL = await loadImageAsDataURL('/unilag-logo.png');
      await generatePDF({ ...data, applicationNumber }, logoDataURL);

      openModal(applicationNumber);

      // Reset form and UI
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
    } catch (pdfErr) {
      // Save succeeded but PDF failed → allow user to try again
      setStatus(`PDF generation failed. Please try again.`, 'err');
      banner.show('PDF generation failed. Please try again.', 'err');
      track('pdf_generation_error');
    } finally {
      submitBtn.disabled = false;
    }

    // Retry handler (only used when initial save failed)
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

// --- PDF creator (one-page) ---
async function generatePDF(d, logoDataURL) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'A4' }); // 595 x 842 pt

  const pageW = 595;
  const pageH = 842;
  const margin = 32;
  const gapX = 12;

  // Header
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

  // Body (compact)
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

  // Client / Project
  doc.setFont('helvetica','bold'); doc.text('Client / Project', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Client: ${d.clientName}`, leftColX, y); y += lh;
  doc.text(`Project/Site: ${d.projectSite}`, leftColX, y); y += lh;
  doc.text(`Email: ${d.email}`, leftColX, y); y += lh;
  doc.text(`Phone: ${d.phone}`, leftColX, y); y += lh + 4;

  // Cement Info
  doc.setFont('helvetica','bold'); doc.text('Cement Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Cement Brand: ${d.cementBrand}`, leftColX, y); y += lh;
  doc.text(`Manufacturer's Cement Type: ${d.manufacturerCementType}`, leftColX, y);
  doc.text(`Cement Type: ${d.cementType}`, rightColX, y); y += lh + 4;

  // Superplasticizer Info
  doc.setFont('helvetica','bold'); doc.text('Superplasticizer Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Superplasticizer Name: ${d.spName}`, leftColX, y); y += lh + 4;

  // Mix Composition
  doc.setFont('helvetica','bold'); doc.text('Mix Composition (kg/m³)', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  const rows = [
    ['Cement', d.cement], ['Blast Furnace Slag', d.slag], ['Fly Ash', d.flyAsh],
    ['Silica Fume', d.silicaFume], ['Limestone Filler', d.limestone],
    ['Water', d.water], ['Superplasticizer', d.superplasticizer],
    ['Coarse Aggregate', d.coarseAgg], ['Fine Aggregate', d.fineAgg]
  ];
  rows.forEach(([k,v]) => { doc.text(`${k}: ${Number(v).toFixed(2)}`, leftColX, y); y += lh; });

  // Slump
  y += 4;
  doc.setFont('helvetica','bold'); doc.text('Slump / Workability', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Slump (mm): ${Number(d.slump).toFixed(1)}`, leftColX, y); y += lh;

  // Age & Target & Cubes
  y += 4;
  doc.setFont('helvetica','bold'); doc.text('Age & Target Strength Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Age (days): ${d.ageDays}`, leftColX, y);
  doc.text(`Target Strength (MPa): ${Number(d.targetMPa).toFixed(2)}`, rightColX, y); y += lh;
  doc.text(`Number of cubes to be crushed: ${d.cubesCount}`, leftColX, y); y += lh;

  // Derived metric
  const wc = (d.cement > 0) ? (Number(d.water) / Number(d.cement)) : 0;
  doc.text(`Derived w/c ratio: ${wc.toFixed(2)}`, leftColX, y); y += lh;

  // Notes
  if (d.notes && d.notes.trim().length > 0) {
    y += 4;
    doc.setFont('helvetica','bold'); doc.text('Additional Notes', leftColX, y); y += lh;
    doc.setFont('helvetica','normal');
    const wrapped = doc.splitTextToSize(d.notes, 595 - 32*2);
    doc.text(wrapped, leftColX, y);
    y += wrapped.length * (lh - 2);
  }

  // FOR OFFICE USE ONLY (one-page)
  const boxHeight = 78;
  const boxY = 842 - 32 - boxHeight;
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

  // Footer
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text('This document was generated electronically by the Concrete Laboratory, University of Lagos.', 297.5, 842 - 10, { align: 'center' });

  const client = sanitizeFilename(d.clientName || 'Client');
  const date = sanitizeFilename(d.crushingDate || new Date().toISOString().slice(0,10));
  doc.save(`${client}_${date}.pdf`);
}
