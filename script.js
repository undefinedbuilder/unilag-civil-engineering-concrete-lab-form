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

// --- Utilities ---
function loadImageAsDataURL(path) {
  return fetch(path)
    .then(resp => resp.blob())
    .then(blob => new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    }));
}

// Set the Date input to today's local date (YYYY-MM-DD)
function setDateToToday(inputEl) {
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const todayLocal = new Date(Date.now() - tzOffset).toISOString().slice(0,10);
  inputEl.value = todayLocal;
}

// Sanitize filename: remove illegal chars and trim
function sanitizeFilename(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  const testDate = document.getElementById('testDate');
  setDateToToday(testDate);

  const brandSelect = document.getElementById('cementBrand');
  const manuSelect = document.getElementById('manufacturerCementType');

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
      manuSelect.appendChild(o);
    });
    manuSelect.disabled = false;
  });

  // Form submit + Retry Save
  const form = document.getElementById('mixForm');
  const status = document.getElementById('status');
  const submitBtn = document.getElementById('submitBtn');
  const retryBtn = document.getElementById('retryBtn');

  let lastPayload = null; // stores last submission data for retry

  function setStatus(msg, kind) {
    status.textContent = msg;
    status.classList.remove('ok','err');
    if (kind === 'ok') status.classList.add('ok');
    if (kind === 'err') status.classList.add('err');
  }
  function showRetry(show) {
    retryBtn.classList.toggle('hidden', !show);
    retryBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', null);
    showRetry(false);

    if (!allFieldsFilled(form)) {
      setStatus('Please complete all fields (use 0 where not applicable).', 'err');
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());

    // Normalize numeric fields
    const numericKeys = [
      'cement','slag','flyAsh','silicaFume','limestone','water','superplasticizer','coarseAgg','fineAgg',
      'slump','ageDays','targetMPa'
    ];
    numericKeys.forEach(k => data[k] = Number(data[k]));

    // Remember this payload for potential retry
    lastPayload = { ...data };

    submitBtn.disabled = true;
    setStatus('Submitting...', null);

    let savedToSheets = false;

    try {
      // 1) Save to Google Sheets via Vercel function
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const out = await res.json();
      if (!out.success) throw new Error(out.message || 'Unknown error');

      savedToSheets = true;
      setStatus('Saved. Generating PDF...', 'ok');
    } catch (err) {
      console.error(err);
      // Continue to PDF generation even if Sheets save failed
      setStatus(`Could not save to Google Sheets (${err.message}). Generating PDF anyway...`, 'err');
      showRetry(true);
    }

    try {
      // 2) PDF (UNILAG logo + 3-line header)
      const logoDataURL = await loadImageAsDataURL('/unilag-logo.png');
      await generatePDF(data, logoDataURL);

      // 3) Reset form & date regardless of Sheets success
      form.reset();
      resetManuSelect();
      manuSelect.disabled = true;
      setDateToToday(testDate);

      if (savedToSheets) {
        setStatus('PDF downloaded and data saved to Google Sheets.', 'ok');
      } else {
        setStatus('PDF downloaded. Note: data was NOT saved to Google Sheets. You can retry.', 'err');
      }
    } catch (pdfErr) {
      console.error(pdfErr);
      setStatus(`PDF generation failed: ${pdfErr.message}`, 'err');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Retry Save handler (uses lastPayload)
  retryBtn.addEventListener('click', async () => {
    if (!lastPayload) {
      setStatus('Nothing to retry. Please submit the form first.', 'err');
      return;
    }
    retryBtn.disabled = true;
    submitBtn.disabled = true;
    setStatus('Retrying save to Google Sheets...', null);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(lastPayload),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const out = await res.json();
      if (!out.success) throw new Error(out.message || 'Unknown error');

      setStatus('Data saved to Google Sheets successfully.', 'ok');
      showRetry(false);
    } catch (err) {
      console.error(err);
      setStatus(`Retry failed: ${err.message}`, 'err');
      showRetry(true);
    } finally {
      retryBtn.disabled = false;
      submitBtn.disabled = false;
    }
  });
});

// --- PDF creator ---
async function generatePDF(d, logoDataURL) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'A4' }); // 595 x 842 pt

  const pageW = 595;
  const margin = 36;
  const gapX = 14;

  // Header
  const topY = 46;
  const logoW = 60;
  const logoH = 60;
  const textX = margin + logoW + gapX;
  const textW = pageW - margin - textX;

  try {
    doc.addImage(logoDataURL, 'PNG', margin, topY, logoW, logoH);
  } catch (e) {
    console.warn('Logo failed to load in PDF:', e);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DEPARTMENT OF CIVIL AND ENVIRONMENTAL ENGINEERING', textX, topY + 16, { maxWidth: textW });
  doc.setFontSize(11);
  doc.text('FACULTY OF ENGINEERING', textX, topY + 34, { maxWidth: textW });
  doc.text('CONCRETE LABORATORY', textX, topY + 52, { maxWidth: textW });

  doc.setDrawColor(40);
  doc.line(margin, topY + logoH + 12, pageW - margin, topY + logoH + 12);

  // Body
  const bodyStartY = topY + logoH + 32;
  let y = bodyStartY;
  const lh = 16;
  const leftColX = margin;
  const rightColX = 320;

  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.text(`Date/Time Generated: ${new Date().toLocaleString()}`, margin, y); y += lh;
  doc.text(`Date: ${d.testDate}`, margin, y); y += lh + 6;

  // Client / Project
  doc.setFont('helvetica','bold'); doc.text('Client / Project', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Client: ${d.clientName}`, leftColX, y); y += lh;
  doc.text(`Project/Site: ${d.projectSite}`, leftColX, y); y += lh;
  doc.text(`Email: ${d.email}`, leftColX, y); y += lh;
  doc.text(`Phone: ${d.phone}`, leftColX, y); y += lh + 6;

  // Cement Info
  doc.setFont('helvetica','bold'); doc.text('Cement Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Cement Brand: ${d.cementBrand}`, leftColX, y); y += lh;
  doc.text(`Manufacturer's Cement Type: ${d.manufacturerCementType}`, leftColX, y);
  doc.text(`Cement Type: ${d.cementType}`, rightColX, y); y += lh + 6;

  // Superplasticizer Info (Name only)
  doc.setFont('helvetica','bold'); doc.text('Superplasticizer Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Superplasticizer Name: ${d.spName}`, leftColX, y); y += lh + 6;

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
  y += 6;
  doc.setFont('helvetica','bold'); doc.text('Slump / Workability', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Slump (mm): ${Number(d.slump).toFixed(1)}`, leftColX, y); y += lh;

  // Age & Target
  y += 6;
  doc.setFont('helvetica','bold'); doc.text('Age & Target Strength Information', leftColX, y); y += lh;
  doc.setFont('helvetica','normal');
  doc.text(`Age (days): ${d.ageDays}`, leftColX, y);
  doc.text(`Target Strength (MPa): ${Number(d.targetMPa).toFixed(2)}`, rightColX, y); y += lh;

  // Derived metric
  const wc = (d.cement > 0) ? (Number(d.water) / Number(d.cement)) : 0;
  doc.text(`Derived w/c ratio: ${wc.toFixed(3)}`, leftColX, y); y += lh;

  // Notes
  if (d.notes && d.notes.trim().length > 0) {
    y += 6;
    doc.setFont('helvetica','bold'); doc.text('Additional Notes', leftColX, y); y += lh;
    doc.setFont('helvetica','normal');
    const wrapped = doc.splitTextToSize(d.notes, 595 - margin*2);
    doc.text(wrapped, leftColX, y);
  }

  // Footer
  doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text('This document was generated electronically by the Concrete Laboratory, University of Lagos.', 297.5, 820, { align: 'center' });

  // File name: <ClientName>_<Date>.pdf (sanitized)
  const client = sanitizeFilename(d.clientName || 'Client');
  const date = sanitizeFilename(d.testDate || new Date().toISOString().slice(0,10));
  doc.save(`${client}_${date}.pdf`);
}