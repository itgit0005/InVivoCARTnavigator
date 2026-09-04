// Lightweight API client wrapper around axios, with auth token injection.
const API = {
  base: '/api',
  token() { return localStorage.getItem('ivct_token') || ''; },

  _headers() {
    const t = this.token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  },

  async get(path, params) {
    try {
      const res = await axios.get(this.base + path, { params, headers: this._headers() });
      return res.data;
    } catch (e) {
      throw this._err(e);
    }
  },
  async post(path, body) {
    try {
      const res = await axios.post(this.base + path, body, { headers: this._headers() });
      return res.data;
    } catch (e) {
      throw this._err(e);
    }
  },
  async put(path, body) {
    try {
      const res = await axios.put(this.base + path, body, { headers: this._headers() });
      return res.data;
    } catch (e) {
      throw this._err(e);
    }
  },
  async del(path) {
    try {
      const res = await axios.delete(this.base + path, { headers: this._headers() });
      return res.data;
    } catch (e) {
      throw this._err(e);
    }
  },
  async upload(path, formData) {
    try {
      const res = await axios.post(this.base + path, formData, {
        headers: { ...this._headers(), 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch (e) {
      throw this._err(e);
    }
  },
  _err(e) {
    const msg = e?.response?.data?.error || e.message || 'Request failed';
    return new Error(msg);
  },
};
