(function () {
  function drawBar(canvas, labels, values) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * 2;
    const h = canvas.height = 440;
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, ...values);
    const gap = 18;
    const barW = (w - 80) / Math.max(values.length, 1) - gap;
    ctx.font = '22px Segoe UI';
    values.forEach((value, i) => {
      const x = 40 + i * (barW + gap);
      const bh = (value / max) * (h - 90);
      const y = h - 50 - bh;
      ctx.fillStyle = '#1b6fd4';
      ctx.fillRect(x, y, barW, bh);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-500') || '#64748b';
      ctx.fillText(String(value), x, y - 8);
      ctx.fillText(String(labels[i] || '').slice(-12), x, h - 18);
    });
  }

  function drawDonut(canvas, items, colors) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * 2;
    const h = canvas.height = 440;
    ctx.clearRect(0, 0, w, h);
    const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
    let angle = -Math.PI / 2;
    const cx = w / 2 - 80;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 30;
    items.forEach((item, i) => {
      const slice = (item.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      angle += slice;
    });
    ctx.beginPath();
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--white') || '#fff';
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '22px Segoe UI';
    items.forEach((item, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(w - 210, 40 + i * 36, 18, 18);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-700') || '#334155';
      ctx.fillText(item.label + ' (' + item.count + ')', w - 184, 56 + i * 36);
    });
  }

  async function render(user) {
    document.getElementById('welcome').textContent = 'Welcome back, ' + user.name.split(' ')[0];
    const range = document.getElementById('range-filter').value;
    try {
      const data = await PharmAPI.get('/api/dashboard/stats?range=' + encodeURIComponent(range));
      const s = data.stats;
      document.getElementById('s-total').textContent = s.total;
      document.getElementById('s-new').textContent = s.new_complaints;
      document.getElementById('s-ai').textContent = s.ai_analyzed;
      document.getElementById('s-inv').textContent = s.under_investigation;
      document.getElementById('s-res').textContent = s.resolved;
      document.getElementById('s-crit').textContent = s.critical + ' / ' + s.high_priority;

      drawBar(
        document.getElementById('chart-month'),
        data.charts.by_month.map((r) => r.month),
        data.charts.by_month.map((r) => r.count)
      );
      drawDonut(
        document.getElementById('chart-category'),
        data.charts.by_category.map((r) => ({ label: r.category, count: r.count })),
        ['#1b6fd4', '#0f766e', '#c2410c', '#7c3aed', '#0369a1', '#b45309', '#334155']
      );
      drawDonut(
        document.getElementById('chart-severity'),
        data.charts.by_severity.map((r) => ({ label: r.severity, count: r.count })),
        ['#b42318', '#c2410c', '#0369a1']
      );
      drawDonut(
        document.getElementById('chart-priority'),
        data.charts.by_priority.map((r) => ({ label: r.priority, count: r.count })),
        ['#9f1239', '#b45309', '#0369a1']
      );
      drawBar(
        document.getElementById('chart-status'),
        data.charts.by_status.map((r) => r.status),
        data.charts.by_status.map((r) => r.count)
      );

      const body = document.getElementById('recent-body');
      if (!data.recent.length) {
        body.innerHTML = '<tr><td colspan="6"><div class="empty-state">No complaints yet.</div></td></tr>';
        return;
      }
      body.innerHTML = data.recent.map((row) => (
        '<tr>' +
        '<td><a href="/complaint-details?id=' + row.id + '">' + PharmApp.escapeHtml(row.complaint_id) + '</a></td>' +
        '<td>' + PharmApp.escapeHtml(row.product_name) + '</td>' +
        '<td>' + PharmApp.escapeHtml(row.category) + '</td>' +
        '<td>' + PharmApp.badge('sev', row.severity) + '</td>' +
        '<td>' + PharmApp.badge('status', row.status) + '</td>' +
        '<td>' + PharmApp.formatDay(row.created_at) + '</td>' +
        '</tr>'
      )).join('');
    } catch (error) {
      PharmApp.toast(PharmApp.friendlyError(error), 'error');
    }
  }

  window.PharmDashboard = {
    init(user) {
      document.getElementById('range-filter').addEventListener('change', () => render(user));
      render(user);
    }
  };
})();
