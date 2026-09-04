async function renderAdminReviewPage(container) {
  showSpinner(container);
  try {
    const data = await API.get('/admin/versions');
    container.innerHTML = '';

    const pending = data.versions.filter((v) => v.status === 'pending_review');

    container.appendChild(h('p', { class: 'text-sm text-slate-500 mb-4' }, 'Pending uploads awaiting Super Admin approval. Nothing here is visible to other users until approved.'));

    if (pending.length === 0) {
      container.appendChild(h('div', { class: 'kpi-card text-center py-10 text-slate-400' }, [
        h('i', { class: 'fa-solid fa-inbox text-3xl mb-3' }),
        h('div', {}, 'No pending uploads awaiting review.'),
      ]));
      return;
    }

    const list = h('div', { class: 'space-y-3 mb-6' });
    pending.forEach((v) => {
      const row = h('div', { class: 'kpi-card flex items-center justify-between cursor-pointer hover:shadow-md transition' });
      row.appendChild(h('div', {}, [
        h('div', { class: 'font-bold text-slate-900' }, `${v.month_label} — ${v.version_label}`),
        h('div', { class: 'text-xs text-slate-500' }, `Uploaded ${fmtDate(v.uploaded_at)} • ${esc(v.source_filename || '')}`),
      ]));
      row.appendChild(h('span', { class: 'badge badge-pending' }, 'PENDING REVIEW'));
      row.addEventListener('click', () => loadReviewDetail(container, v.id));
      list.appendChild(row);
    });
    container.appendChild(list);

    const detailBox = h('div', { id: 'review-detail' });
    container.appendChild(detailBox);

    if (pending.length > 0) loadReviewDetail(container, pending[0].id);
  } catch (e) {
    renderError(container, e.message);
  }
}

async function loadReviewDetail(container, versionId) {
  let detailBox = document.getElementById('review-detail');
  if (!detailBox) {
    detailBox = h('div', { id: 'review-detail' });
    container.appendChild(detailBox);
  }
  showSpinner(detailBox);
  try {
    const data = await API.get(`/admin/versions/${versionId}/review`);
    detailBox.innerHTML = '';

    const v = data.version;
    detailBox.appendChild(h('h3', { class: 'text-base font-bold text-slate-900 mt-6 mb-3' }, `Reviewing: ${v.month_label} — ${v.version_label}`));

    // Summary counts
    const summaryGrid = h('div', { class: 'grid grid-cols-5 gap-3 mb-5' });
    const totals = { new: 0, updated: 0, discontinued: 0, conflicting: 0, unchanged: 0 };
    for (const stats of Object.values(data.summary)) {
      totals.new += stats.new; totals.updated += stats.updated; totals.discontinued += stats.discontinued;
      totals.conflicting += stats.conflicting; totals.unchanged += stats.unchanged;
    }
    [['New', totals.new, 'badge-new'], ['Updated', totals.updated, 'badge-updated'], ['Discontinued', totals.discontinued, 'badge-discontinued'], ['Conflicting', totals.conflicting, 'badge-conflicting'], ['Unchanged', totals.unchanged, 'badge-unchanged']].forEach(([label, val, cls]) => {
      summaryGrid.appendChild(h('div', { class: 'kpi-card text-center' }, [
        h('div', { class: `badge ${cls} mb-2` }, label),
        h('div', { class: 'text-2xl font-bold text-slate-900' }, String(val)),
      ]));
    });
    detailBox.appendChild(summaryGrid);

    // Change list with filter tabs
    const filterBar = h('div', { class: 'flex gap-2 mb-4' });
    const filters = ['all', 'new', 'updated', 'discontinued', 'conflicting'];
    let activeFilter = 'all';
    const changeListBox = h('div', { class: 'space-y-2 mb-6' });

    function renderChangeList() {
      changeListBox.innerHTML = '';
      const filtered = activeFilter === 'all' ? data.changes : data.changes.filter((c) => c.change_type === activeFilter);
      if (filtered.length === 0) {
        changeListBox.appendChild(h('div', { class: 'text-sm text-slate-400 text-center py-6' }, 'No changes in this category.'));
        return;
      }
      filtered.forEach((chg) => changeListBox.appendChild(renderChangeCard(chg)));
    }

    filters.forEach((f) => {
      const btn = h('button', { class: 'tab-btn' + (f === activeFilter ? ' active' : ''), textContent: f.charAt(0).toUpperCase() + f.slice(1) });
      btn.addEventListener('click', () => {
        activeFilter = f;
        filterBar.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderChangeList();
      });
      filterBar.appendChild(btn);
    });
    detailBox.appendChild(filterBar);
    detailBox.appendChild(changeListBox);
    renderChangeList();

    // Approve / Reject actions
    const actionBar = h('div', { class: 'flex items-center gap-3 kpi-card' });
    const notesInput = h('input', { type: 'text', placeholder: 'Review notes (optional)', class: 'flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm' });
    const approveBtn = h('button', { class: 'btn btn-success' }, [h('i', { class: 'fa-solid fa-check' }), 'Approve & Publish Live']);
    const rejectBtn = h('button', { class: 'btn btn-danger' }, [h('i', { class: 'fa-solid fa-xmark' }), 'Reject']);

    approveBtn.addEventListener('click', async () => {
      if (!confirm(`Approve ${v.month_label} — ${v.version_label} and make it the live dataset for all users? Historical versions are preserved.`)) return;
      try {
        await API.post(`/admin/versions/${versionId}/approve`, { notes: notesInput.value });
        toast('Version approved and published live.', 'success');
        renderAdminReviewPage(document.getElementById('page-container'));
        populateMonthSelector(document.getElementById('global-month-select'));
      } catch (e) { toast(e.message, 'error'); }
    });
    rejectBtn.addEventListener('click', async () => {
      const reason = prompt('Reason for rejection:');
      if (reason === null) return;
      try {
        await API.post(`/admin/versions/${versionId}/reject`, { reason });
        toast('Version rejected.', 'success');
        renderAdminReviewPage(document.getElementById('page-container'));
      } catch (e) { toast(e.message, 'error'); }
    });

    actionBar.appendChild(notesInput);
    actionBar.appendChild(approveBtn);
    actionBar.appendChild(rejectBtn);
    detailBox.appendChild(actionBar);
  } catch (e) {
    renderError(detailBox, e.message);
  }
}

function renderChangeCard(chg) {
  const card = h('div', { class: 'kpi-card' });
  card.appendChild(h('div', { class: 'flex items-center justify-between mb-2' }, [
    h('div', { class: 'font-semibold text-sm text-slate-800' }, [MODULE_LABEL_MAP[chg.module] || chg.module, ' — ', chg.record_key]),
    h('span', { html: changeTypeBadge(chg.change_type) }),
  ]));

  if (chg.change_type === 'updated' && chg.field_diffs?.length) {
    const diffList = h('div', { class: 'text-xs space-y-1' });
    chg.field_diffs.forEach((d) => {
      diffList.appendChild(h('div', {}, [
        h('span', { class: 'font-medium text-slate-500' }, d.field + ': '),
        h('span', { class: 'field-diff-old' }, String(d.before ?? '—')),
        ' → ',
        h('span', { class: 'field-diff-new' }, String(d.after ?? '—')),
      ]));
    });
    card.appendChild(diffList);
  } else if (chg.change_type === 'new') {
    card.appendChild(h('div', { class: 'text-xs text-slate-600' }, 'New record added to the database.'));
  } else if (chg.change_type === 'discontinued') {
    card.appendChild(h('div', { class: 'text-xs text-slate-600' }, 'Present in the live dataset but absent from this upload — will be marked discontinued if approved.'));
  }

  return card;
}
