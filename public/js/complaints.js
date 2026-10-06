(function () {
  let page = 1;
  const limit = 10;

  function query() {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    ['search', 'status', 'severity', 'priority', 'category', 'product', 'date_from', 'date_to', 'sort', 'dir'].forEach((name) => {
      const el = document.getElementById(name);
      if (el && el.value) params.set(name, el.value);
    });
    return params.toString();
  }

  async function load() {
    const body = document.getElementById('table-body');
    body.innerHTML = '<tr><td colspan="9"><div class="loading"><span class="spinner"></span> Loading complaints...</div></td></tr>';
    try {
      const data = await PharmAPI.get('/api/complaints?' + query());
      if (!data.data.length) {
        body.innerHTML = '<tr><td colspan="9"><div class="empty-state">No complaints match the current filters.</div></td></tr>';
      } else {
        body.innerHTML = data.data.map((row) => (
          '<tr>' +
          '<td><a href="/complaint-details?id=' + row.id + '">' + PharmApp.escapeHtml(row.complaint_id) + '</a></td>' +
          '<td>' + PharmApp.escapeHtml(row.product_name) + '</td>' +
          '<td>' + PharmApp.escapeHtml(row.category) + '</td>' +
          '<td>' + PharmApp.badge('sev', row.severity) + '</td>' +
          '<td>' + PharmApp.badge('pri', row.priority) + '</td>' +
          '<td>' + PharmApp.badge('status', row.status) + '</td>' +
          '<td>' + PharmApp.formatDay(row.created_at) + '</td>' +
          '<td>' + PharmApp.escapeHtml(row.assigned_to_name || 'Unassigned') + '</td>' +
          '<td><a class="btn btn-sm btn-secondary" href="/complaint-details?id=' + row.id + '">Open</a></td>' +
          '</tr>'
        )).join('');
      }
      const p = data.pagination;
      document.getElementById('page-info').textContent = 'Page ' + p.page + ' of ' + p.pages + ' · ' + p.total + ' records';
      document.getElementById('prev').disabled = p.page <= 1;
      document.getElementById('next').disabled = p.page >= p.pages;
    } catch (error) {
      body.innerHTML = '<tr><td colspan="9"><div class="error-state">' + PharmApp.escapeHtml(PharmApp.friendlyError(error)) + '</div></td></tr>';
    }
  }

  async function loadProducts() {
    try {
      const data = await PharmAPI.get('/api/products');
      const sel = document.getElementById('product');
      data.data.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = String(p.id);
        opt.textContent = p.product_name;
        sel.appendChild(opt);
      });
    } catch (error) {
      // filters still work without product names
    }
  }

  window.PharmComplaints = {
    init() {
      const params = new URLSearchParams(window.location.search);
      ['search', 'status', 'severity', 'priority', 'category', 'product', 'date_from', 'date_to', 'sort', 'dir'].forEach((name) => {
        const el = document.getElementById(name);
        if (el && params.get(name)) el.value = params.get(name);
      });
      loadProducts();
      document.getElementById('filter-form').addEventListener('submit', (event) => {
        event.preventDefault();
        page = 1;
        load();
      });
      document.getElementById('prev').addEventListener('click', () => { page -= 1; load(); });
      document.getElementById('next').addEventListener('click', () => { page += 1; load(); });
      load();
    }
  };
})();
