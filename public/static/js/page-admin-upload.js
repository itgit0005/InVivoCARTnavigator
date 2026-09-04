async function renderAdminUploadPage(container) {
  container.innerHTML = '';
  container.appendChild(h('div', { class: 'bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5 text-sm text-slate-600' }, [
    h('i', { class: 'fa-solid fa-circle-info mr-2 text-blue-500' }),
    'Upload a monthly update (XLSX, XLS or CSV). The system compares it against the current live dataset, and nothing goes live until you approve it under "Review & Approve". You may upload multiple revisions for the same month (Version 1, Version 2 Revised, Version 3 Final, etc.).',
  ]));

  const form = h('div', { class: 'kpi-card max-w-xl' });

  form.appendChild(fieldLabel('Reporting Month'));
  const monthInput = h('input', { type: 'month', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4' });
  const now = new Date();
  monthInput.value = STATE.liveMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  form.appendChild(monthInput);

  form.appendChild(fieldLabel('Data Cutoff Date'));
  const cutoffInput = h('input', { type: 'date', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4' });
  form.appendChild(cutoffInput);

  form.appendChild(fieldLabel('Version Label (optional — e.g. "Version 2 (Revised)")'));
  const labelInput = h('input', { type: 'text', placeholder: 'Auto-generated if left blank', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4' });
  form.appendChild(labelInput);

  form.appendChild(fieldLabel('File (.xlsx, .xls, .csv)'));
  const fileInput = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4' });
  form.appendChild(fileInput);

  const statusBox = h('div', { class: 'hidden' });
  form.appendChild(statusBox);

  const submitBtn = h('button', { class: 'btn btn-primary w-full justify-center' }, [h('i', { class: 'fa-solid fa-cloud-arrow-up' }), 'Upload & Stage for Review']);
  form.appendChild(submitBtn);

  submitBtn.addEventListener('click', async () => {
    if (!fileInput.files[0]) return toast('Please choose a file.', 'error');
    if (!monthInput.value) return toast('Please select the reporting month.', 'error');

    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('month_label', monthInput.value);
    if (cutoffInput.value) fd.append('data_cutoff_date', cutoffInput.value);
    if (labelInput.value) fd.append('version_label', labelInput.value);

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width:1rem;height:1rem;border-width:2px;"></div> Processing...';
    statusBox.className = '';
    statusBox.innerHTML = '';

    try {
      const result = await API.upload('/admin/upload', fd);
      statusBox.className = 'bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 mb-4 mt-2';
      statusBox.innerHTML = `
        <div class="font-bold mb-2"><i class="fa-solid fa-circle-check mr-1"></i> Uploaded and staged as ${esc(result.version_label)}</div>
        <div>Total changes detected: <strong>${result.total_changes}</strong></div>
        <div class="mt-2 text-xs">Go to <strong>Review &amp; Approve</strong> to inspect the diff and approve or reject this version.</div>
      `;
      const goBtn = h('button', { class: 'btn btn-primary mt-3', onclick: () => navigate('admin_review') }, 'Go to Review');
      statusBox.appendChild(goBtn);
      toast('File uploaded and staged successfully.', 'success');
    } catch (e) {
      statusBox.className = 'bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-4 mt-2';
      statusBox.textContent = e.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload &amp; Stage for Review';
    }
  });

  container.appendChild(form);
}

function fieldLabel(text) {
  return h('label', { class: 'block text-xs font-semibold text-slate-600 mb-1.5' }, text);
}
