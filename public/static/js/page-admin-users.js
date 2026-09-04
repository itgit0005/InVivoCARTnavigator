async function renderAdminUsersPage(container) {
  showSpinner(container);
  try {
    const [usersData, orgsData] = await Promise.all([API.get('/admin/users'), API.get('/admin/organizations')]);
    container.innerHTML = '';

    const addBtn = h('button', { class: 'btn btn-primary mb-4' }, [h('i', { class: 'fa-solid fa-user-plus' }), 'Add User']);
    container.appendChild(addBtn);

    const table = h('table', { class: 'data-table' });
    table.appendChild(h('thead', {}, h('tr', {}, ['User', 'Role', 'Org', 'Can Upload', 'Can Export', 'Status', 'Last Login', 'Actions'].map((c) => h('th', {}, c)))));
    const tbody = h('tbody', {});

    function orgName(id) { return orgsData.organizations.find((o) => o.id === id)?.name || '—'; }

    usersData.users.forEach((u) => {
      const tr = h('tr', {});
      tr.appendChild(h('td', {}, [h('div', { class: 'font-semibold' }, u.display_name || u.username), h('div', { class: 'text-xs text-slate-400' }, u.username)]));
      tr.appendChild(h('td', {}, h('span', { class: 'badge badge-verified' }, roleLabel(u.role))));
      tr.appendChild(h('td', {}, u.role === 'multi_user' ? orgName(u.org_id) : '—'));
      tr.appendChild(h('td', {}, u.can_upload ? '✅' : '—'));
      tr.appendChild(h('td', {}, u.can_export ? '✅' : '—'));
      tr.appendChild(h('td', {}, u.is_active ? h('span', { class: 'badge badge-new' }, 'Active') : h('span', { class: 'badge badge-discontinued' }, 'Inactive')));
      tr.appendChild(h('td', { class: 'text-xs' }, u.last_login_at ? fmtDate(u.last_login_at) : 'Never'));

      const actions = h('td', { class: 'flex gap-1' });
      const editBtn = h('button', { class: 'btn btn-secondary text-xs py-1' }, 'Edit');
      editBtn.addEventListener('click', () => openEditUserModal(u, orgsData.organizations, () => renderAdminUsersPage(container)));
      actions.appendChild(editBtn);
      if (u.is_active && u.role !== 'super_admin') {
        const deactivateBtn = h('button', { class: 'btn btn-danger text-xs py-1' }, 'Deactivate');
        deactivateBtn.addEventListener('click', async () => {
          if (!confirm(`Deactivate ${u.username}?`)) return;
          await API.del(`/admin/users/${u.id}`);
          toast('User deactivated.', 'success');
          renderAdminUsersPage(container);
        });
        actions.appendChild(deactivateBtn);
      }
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(h('div', { class: 'kpi-card overflow-x-auto' }, table));

    addBtn.addEventListener('click', () => openAddUserModal(orgsData.organizations, () => renderAdminUsersPage(container)));
  } catch (e) {
    renderError(container, e.message);
  }
}

function modalShell(title, bodyEl) {
  const overlay = h('div', { class: 'modal-overlay' });
  const box = h('div', { class: 'modal-box w-full max-w-md p-6' });
  box.appendChild(h('div', { class: 'flex items-center justify-between mb-4' }, [
    h('h3', { class: 'text-base font-bold' }, title),
    h('button', { class: 'text-slate-400 hover:text-slate-700', html: '<i class="fa-solid fa-xmark"></i>', onclick: () => overlay.remove() }),
  ]));
  box.appendChild(bodyEl);
  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

function openAddUserModal(orgs, onDone) {
  const body = h('div', {});
  const username = h('input', { placeholder: 'Username', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' });
  const displayName = h('input', { placeholder: 'Display name', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' });
  const email = h('input', { placeholder: 'Email (optional)', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' });
  const password = h('input', { type: 'password', placeholder: 'Temporary password', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' });
  const role = h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' }, [
    h('option', { value: 'demo' }, 'Demo'),
    h('option', { value: 'single_user' }, 'Single User'),
    h('option', { value: 'multi_user' }, 'Multi User'),
    h('option', { value: 'super_admin' }, 'Super Admin'),
  ]);
  const orgSelect = h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' }, [h('option', { value: '' }, 'No organization'), ...orgs.map((o) => h('option', { value: o.id }, o.name))]);
  const canUploadLabel = h('label', { class: 'flex items-center gap-2 text-sm mb-3' });
  const canUploadCheck = h('input', { type: 'checkbox' });
  canUploadLabel.appendChild(canUploadCheck);
  canUploadLabel.appendChild(document.createTextNode('Explicitly allow upload access (Multi User override)'));

  [username, displayName, email, password, role, orgSelect, canUploadLabel].forEach((el) => body.appendChild(el));

  const submitBtn = h('button', { class: 'btn btn-primary w-full justify-center' }, 'Create User');
  submitBtn.addEventListener('click', async () => {
    try {
      await API.post('/admin/users', {
        username: username.value.trim(), display_name: displayName.value.trim() || username.value.trim(),
        email: email.value.trim() || null, password: password.value, role: role.value,
        org_id: orgSelect.value ? Number(orgSelect.value) : null, can_upload: canUploadCheck.checked,
      });
      toast('User created.', 'success');
      document.querySelector('.modal-overlay')?.remove();
      onDone();
    } catch (e) { toast(e.message, 'error'); }
  });
  body.appendChild(submitBtn);

  modalShell('Add User', body);
}

function openEditUserModal(user, orgs, onDone) {
  const body = h('div', {});
  const role = h('select', { class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' }, [
    h('option', { value: 'demo' }, 'Demo'),
    h('option', { value: 'single_user' }, 'Single User'),
    h('option', { value: 'multi_user' }, 'Multi User'),
    h('option', { value: 'super_admin' }, 'Super Admin'),
  ]);
  role.value = user.role;
  const canUploadLabel = h('label', { class: 'flex items-center gap-2 text-sm mb-3' });
  const canUploadCheck = h('input', { type: 'checkbox' });
  canUploadCheck.checked = !!user.can_upload;
  canUploadLabel.appendChild(canUploadCheck);
  canUploadLabel.appendChild(document.createTextNode('Allow upload access'));

  const canExportLabel = h('label', { class: 'flex items-center gap-2 text-sm mb-3' });
  const canExportCheck = h('input', { type: 'checkbox' });
  canExportCheck.checked = !!user.can_export;
  canExportLabel.appendChild(canExportCheck);
  canExportLabel.appendChild(document.createTextNode('Allow export access'));

  const newPassword = h('input', { type: 'password', placeholder: 'Reset password (leave blank to keep)', class: 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3' });

  body.appendChild(fieldLabel('Role'));
  body.appendChild(role);
  body.appendChild(canUploadLabel);
  body.appendChild(canExportLabel);
  body.appendChild(fieldLabel('Reset Password'));
  body.appendChild(newPassword);

  const submitBtn = h('button', { class: 'btn btn-primary w-full justify-center' }, 'Save Changes');
  submitBtn.addEventListener('click', async () => {
    try {
      const payload = { role: role.value, can_upload: canUploadCheck.checked, can_export: canExportCheck.checked };
      if (newPassword.value) payload.password = newPassword.value;
      await API.put(`/admin/users/${user.id}`, payload);
      toast('User updated.', 'success');
      document.querySelector('.modal-overlay')?.remove();
      onDone();
    } catch (e) { toast(e.message, 'error'); }
  });
  body.appendChild(submitBtn);

  modalShell(`Edit ${user.username}`, body);
}
