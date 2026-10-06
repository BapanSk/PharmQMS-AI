(function (window) {
  const STAFF_PAGES = ['/dashboard', '/complaints', '/complaint-details', '/admin'];

  function currentPath() {
    return window.location.pathname.replace(/\/+$/, '') || '/';
  }

  function isStaffPage() {
    const path = currentPath();
    return STAFF_PAGES.some((page) => path === page);
  }

  async function requireStaff() {
    const token = PharmAPI.getToken();
    if (!token) {
      window.location.replace('/login');
      return null;
    }
    try {
      const data = await PharmAPI.get('/api/auth/me');
      PharmAPI.setSession(token, data.user, Boolean(localStorage.getItem('pharmqms_token')));
      return data.user;
    } catch (error) {
      PharmAPI.clearSession();
      window.location.replace('/login');
      return null;
    }
  }

  async function logout() {
    try {
      await PharmAPI.post('/api/auth/logout', {});
    } catch (error) {
      // ignore network errors on logout
    }
    PharmAPI.clearSession();
    window.location.replace('/login');
  }

  window.PharmAuth = {
    requireStaff,
    logout,
    isStaffPage,
    currentPath
  };
})(window);
