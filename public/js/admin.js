(function () {
  let auditPage = 1;

  function showModal(title, bodyHtml, onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal"><h3>' + title + '</h3>' + bodyHtml +
      '<div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>Cancel</button>' +
      '<button class="btn btn-primary" type="button" data-ok>Save</button></div></div>';
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-close]').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
    backdrop.querySelector('[data-ok]').addEventListener('click', async () => {
      try {
        await onConfirm(backdrop);
        backdrop.remove();
      } catch (error) {
        PharmApp.toast(PharmApp.friendlyError(error), 'error');
      }
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-tab') === name));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== 'panel-' + name));
  }

  async function loadUsers() {
    const body = document.getElementById('users-body');
    try {
      const data = await PharmAPI.get('/api/users');
      body.innerHTML = data.data.map((u) => (
        '<tr>' +
        '<td>' + PharmApp.escapeHtml(u.name) + '</td>' +
        '<td>' + PharmApp.escapeHtml(u.email) + '</td>' +
        '<td>' + PharmApp.escapeHtml(u.role) + '</td>' +
        '<td>' + (u.is_active ? '<span class="badge badge-resolved">Active</span>' : '<span class="badge badge-major">Inactive</span>') + '</td>' +
        '<td><button class="btn btn-sm btn-secondary" data-edit-user="' + u.id + '">Edit</button> ' +
        (u.is_active ? '<button class="btn btn-sm btn-ghost" data-off-user="' + u.id + '">Deactivate</button>' : '') + '</td>' +
        '</tr>'
      )).join('');
      body.querySelectorAll('[data-edit-user]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const user = data.data.find((row) => String(row.id) === btn.getAttribute('data-edit-user'));
          openUserModal(user);
        });
      });
      body.querySelectorAll('[data-off-user]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!window.confirm('Deactivate this user? Complaint history is preserved.')) return;
          try {
            await PharmAPI.del('/api/users/' + btn.getAttribute('data-off-user'));
            PharmApp.toast('User deactivated', 'success');
            loadUsers();
          } catch (error) {
            PharmApp.toast(PharmApp.friendlyError(error), 'error');
          }
        });
      });
    } catch (error) {
      body.innerHTML = '<tr><td colspan="5"><div class="error-state">' + PharmApp.escapeHtml(PharmApp.friendlyError(error)) + '</div></td></tr>';
    }
  }

  function openUserModal(existing) {
    showModal(existing ? 'Edit user' : 'Add user',
      '<label>Name</label><input id="u-name" value="' + PharmApp.escapeHtml(existing ? existing.name : '') + '">' +
      '<label>Email</label><input id="u-email" value="' + PharmApp.escapeHtml(existing ? existing.email : '') + '">' +
      '<label>Role</label><select id="u-role">' + ['ADMIN', 'QA_MANAGER', 'QA_ANALYST'].map((r) => '<option' + (existing && existing.role === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>' +
      '<label>Password' + (existing ? ' (leave blank to keep)' : '') + '</label><input id="u-pass" type="password">' +
      (existing ? '<label>Active</label><select id="u-active"><option value="1"' + (existing.is_active ? ' selected' : '') + '>Active</option><option value="0"' + (!existing.is_active ? ' selected' : '') + '>Inactive</option></select>' : ''),
      async (modal) => {
        const payload = {
          name: modal.querySelector('#u-name').value,
          email: modal.querySelector('#u-email').value,
          role: modal.querySelector('#u-role').value
        };
        const password = modal.querySelector('#u-pass').value;
        if (password) payload.password = password;
        if (existing) {
          payload.is_active = Number(modal.querySelector('#u-active').value);
          await PharmAPI.put('/api/users/' + existing.id, payload);
        } else {
          if (!payload.password) throw new Error('Password is required');
          await PharmAPI.post('/api/users', payload);
        }
        PharmApp.toast('User saved', 'success');
        loadUsers();
      });
  }

  async function loadProducts() {
    const body = document.getElementById('products-body');
    try {
      const data = await PharmAPI.get('/api/admin/products?all=1');
      body.innerHTML = data.data.map((p) => (
        '<tr>' +
        '<td>' + PharmApp.escapeHtml(p.product_name) + '</td>' +
        '<td>' + PharmApp.escapeHtml(p.product_code) + '</td>' +
        '<td>' + PharmApp.escapeHtml(p.manufacturer) + '</td>' +
        '<td>' + (p.is_active ? 'Yes' : 'No') + '</td>' +
        '<td><button class="btn btn-sm btn-secondary" data-edit-product="' + p.id + '">Edit</button></td>' +
        '</tr>'
      )).join('');
      body.querySelectorAll('[data-edit-product]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const product = data.data.find((row) => String(row.id) === btn.getAttribute('data-edit-product'));
          openProductModal(product);
        });
      });
    } catch (error) {
      body.innerHTML = '<tr><td colspan="5"><div class="error-state">' + PharmApp.escapeHtml(PharmApp.friendlyError(error)) + '</div></td></tr>';
    }
  }

  function openProductModal(existing) {
    showModal(existing ? 'Edit product' : 'Add product',
      '<label>Name</label><input id="p-name" value="' + PharmApp.escapeHtml(existing ? existing.product_name : '') + '">' +
      '<label>Code</label><input id="p-code" value="' + PharmApp.escapeHtml(existing ? existing.product_code : '') + '">' +
      '<label>Manufacturer</label><input id="p-mfr" value="' + PharmApp.escapeHtml(existing ? existing.manufacturer : '') + '">' +
      '<label>Description</label><textarea id="p-desc">' + PharmApp.escapeHtml(existing ? (existing.description || '') : '') + '</textarea>' +
      (existing ? '<label>Active</label><select id="p-active"><option value="1"' + (existing.is_active ? ' selected' : '') + '>Active</option><option value="0"' + (!existing.is_active ? ' selected' : '') + '>Inactive</option></select>' : ''),
      async (modal) => {
        const payload = {
          product_name: modal.querySelector('#p-name').value,
          product_code: modal.querySelector('#p-code').value,
          manufacturer: modal.querySelector('#p-mfr').value,
          description: modal.querySelector('#p-desc').value
        };
        if (existing) {
          payload.is_active = Number(modal.querySelector('#p-active').value);
          await PharmAPI.put('/api/admin/products/' + existing.id, payload);
        } else {
          await PharmAPI.post('/api/admin/products', payload);
        }
        PharmApp.toast('Product saved', 'success');
        loadProducts();
      });
  }

  async function loadAudit() {
    const body = document.getElementById('audit-body');
    const params = new URLSearchParams();
    params.set('page', String(auditPage));
    params.set('limit', '15');
    const search = document.getElementById('audit-search').value;
    const action = document.getElementById('audit-action').value;
    if (search) params.set('search', search);
    if (action) params.set('action', action);
    try {
      const data = await PharmAPI.get('/api/audit-logs?' + params.toString());
      body.innerHTML = data.data.map((row) => (
        '<tr>' +
        '<td>' + PharmApp.formatDate(row.created_at) + '</td>' +
        '<td>' + PharmApp.escapeHtml(row.user_name || 'System') + '</td>' +
        '<td>' + PharmApp.escapeHtml(row.action) + '</td>' +
        '<td>' + PharmApp.escapeHtml((row.entity_type || '') + ' #' + (row.entity_id || '')) + '</td>' +
        '<td>' + PharmApp.escapeHtml(typeof row.details === 'object' ? JSON.stringify(row.details) : (row.details || '')) + '</td>' +
        '</tr>'
      )).join('') || '<tr><td colspan="5"><div class="empty-state">No audit events.</div></td></tr>';
      const p = data.pagination;
      document.getElementById('audit-page-info').textContent = 'Page ' + p.page + ' of ' + p.pages;
      document.getElementById('audit-prev').disabled = p.page <= 1;
      document.getElementById('audit-next').disabled = p.page >= p.pages;
    } catch (error) {
      body.innerHTML = '<tr><td colspan="5"><div class="error-state">' + PharmApp.escapeHtml(PharmApp.friendlyError(error)) + '</div></td></tr>';
    }
  }

  window.PharmAdmin = {
    init(user) {
      if (user.role !== 'ADMIN') {
        document.getElementById('admin-root').innerHTML = '<div class="error-state">Administrator access is required.</div>';
        return;
      }
      document.querySelectorAll('.tab').forEach((btn) => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
      });
      if (window.location.hash === '#settings') switchTab('settings');
      document.getElementById('btn-add-user').addEventListener('click', () => openUserModal(null));
      document.getElementById('btn-add-product').addEventListener('click', () => openProductModal(null));
      document.getElementById('audit-filter').addEventListener('submit', (event) => {
        event.preventDefault();
        auditPage = 1;
        loadAudit();
      });
      document.getElementById('audit-prev').addEventListener('click', () => { auditPage -= 1; loadAudit(); });
      document.getElementById('audit-next').addEventListener('click', () => { auditPage += 1; loadAudit(); });
      loadUsers();
      loadProducts();
      loadAudit();
    }
  };
})();
