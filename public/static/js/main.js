(async function init() {
  const root = document.getElementById('app');
  const token = API.token();
  if (!token) {
    renderLogin(root);
    return;
  }
  try {
    const data = await API.get('/auth/me');
    if (data.user) {
      setUser(data.user);
      renderApp();
    } else {
      localStorage.removeItem('ivct_token');
      renderLogin(root);
    }
  } catch (e) {
    localStorage.removeItem('ivct_token');
    renderLogin(root);
  }
})();
