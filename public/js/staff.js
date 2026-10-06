(function () {
  function sidebar(active) {
    return `
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="/dashboard"><span class="brand-mark">PQ</span> PharmQMS</a>
        <nav class="side-nav">
          <a class="${active === 'dashboard' ? 'active' : ''}" href="/dashboard">Dashboard</a>
          <a class="${active === 'complaints' ? 'active' : ''}" href="/complaints">Complaints</a>
          <a class="${active === 'investigations' ? 'active' : ''}" href="/complaints?status=Under%20Investigation">Investigations</a>
          <a class="${active === 'reports' ? 'active' : ''}" href="/dashboard">Reports</a>
          <a class="admin-only ${active === 'admin' ? 'active' : ''}" href="/admin">Users</a>
          <a class="admin-only ${active === 'admin' ? 'active' : ''}" href="/admin#settings">Settings</a>
          <a class="admin-only ${active === 'admin' ? 'active' : ''}" href="/admin">Admin panel</a>
          <button type="button" id="logout-btn">Logout</button>
        </nav>
        <div class="sidebar-foot">Quality workspace · Phase 3</div>
      </aside>`;
  }

  async function boot(page, afterAuth) {
    const user = await PharmAuth.requireStaff();
    if (!user) return;
    const shell = document.getElementById('app-shell');
    const existing = shell.innerHTML;
    shell.className = 'app-shell';
    shell.innerHTML = sidebar(page) + '<div class="app-main">' + existing + '</div>';

    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatar = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role.replace('_', ' ');
    if (avatar) avatar.textContent = user.name.charAt(0);

    document.getElementById('logout-btn').addEventListener('click', () => PharmAuth.logout());
    if (user.role !== 'ADMIN') {
      document.querySelectorAll('.admin-only').forEach((el) => el.classList.add('hidden'));
    }
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    }
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) themeBtn.addEventListener('click', PharmApp.toggleTheme);
    if (afterAuth) afterAuth(user);
  }

  window.PharmStaff = { boot };
})();
