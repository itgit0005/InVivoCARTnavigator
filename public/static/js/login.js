function renderLogin(root) {
  root.innerHTML = '';
  const container = h('div', { class: 'min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-4' });

  const card = h('div', { class: 'bg-white rounded-2xl shadow-2xl w-full max-w-md p-8' });

  card.appendChild(h('div', { class: 'text-center mb-6' }, [
    h('div', { class: 'w-14 h-14 rounded-xl bg-blue-600 mx-auto flex items-center justify-center mb-3' }, h('i', { class: 'fa-solid fa-dna text-white text-2xl' })),
    h('h1', { class: 'text-xl font-extrabold text-slate-900' }, 'In Vivo CAR-T Intelligence Platform'),
    h('p', { class: 'text-sm text-slate-500 mt-1' }, 'Sign in to access verified competitive intelligence'),
  ]));

  const errorBox = h('div', { class: 'hidden bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4' });
  card.appendChild(errorBox);

  const usernameInput = h('input', { type: 'text', class: 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500', placeholder: 'Username', autocomplete: 'username' });
  const passwordInput = h('input', { type: 'password', class: 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500', placeholder: 'Password', autocomplete: 'current-password' });

  const submitBtn = h('button', { class: 'btn btn-primary w-full justify-center py-2.5' }, 'Sign In');

  async function doLogin() {
    errorBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width:1rem;height:1rem;border-width:2px;"></div>';
    try {
      const data = await API.post('/auth/login', { username: usernameInput.value.trim(), password: passwordInput.value });
      localStorage.setItem('ivct_token', data.token);
      setUser(data.user);
      renderApp();
    } catch (e) {
      errorBox.textContent = e.message;
      errorBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }

  submitBtn.addEventListener('click', doLogin);
  passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  const form = h('div', {}, [usernameInput, passwordInput, submitBtn]);
  card.appendChild(form);

  card.appendChild(h('div', { class: 'mt-6 pt-5 border-t border-slate-100 text-xs text-slate-500 space-y-1' }, [
    h('div', { class: 'font-semibold text-slate-600 mb-1' }, 'Demo credentials'),
    h('div', {}, 'Super Admin — admin / Admin@2026!'),
    h('div', {}, 'Demo (read-only) — demo / Demo@2026!'),
    h('div', {}, 'Single User — analyst / User@2026!'),
    h('div', {}, 'Multi User — team / Team@2026!'),
  ]));

  container.appendChild(card);
  root.appendChild(container);
}
