(function (window) {
  const TOKEN_KEY = 'pharmqms_token';
  const USER_KEY = 'pharmqms_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }

  function setSession(token, user, remember) {
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
    other.removeItem(TOKEN_KEY);
    other.removeItem(USER_KEY);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  async function request(method, url, body) {
    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }
    const options = { method, headers, credentials: 'same-origin' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      const networkError = new Error('Unable to reach PharmQMS. Check your connection and try again.');
      networkError.status = 0;
      throw networkError;
    }

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = { error: 'Unexpected server response' };
      }
    }

    if (!response.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = response.status;
      err.payload = data;
      throw err;
    }

    return data;
  }

  window.PharmAPI = {
    getToken,
    setSession,
    clearSession,
    getUser,
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body),
    put: (url, body) => request('PUT', url, body),
    del: (url) => request('DELETE', url),
    upload: async (url, formData) => {
      const headers = { Accept: 'application/json' };
      const token = getToken();
      if (token) headers.Authorization = 'Bearer ' + token;
      let response;
      try {
        response = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'same-origin' });
      } catch (error) {
        const networkError = new Error('Unable to reach PharmQMS. Check your connection and try again.');
        networkError.status = 0;
        throw networkError;
      }
      const text = await response.text();
      let data = {};
      if (text) {
        try { data = JSON.parse(text); } catch (error) { data = { error: 'Unexpected server response' }; }
      }
      if (!response.ok) {
        const err = new Error(data.error || 'Request failed');
        err.status = response.status;
        err.payload = data;
        throw err;
      }
      return data;
    }
  };
})(window);
