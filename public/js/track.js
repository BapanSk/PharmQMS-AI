(function () {
  const STAGES = ['New', 'AI Analyzed', 'QA Review', 'Under Investigation', 'Corrective Action', 'Resolved', 'Closed'];
  const form = document.getElementById('track-form');
  const result = document.getElementById('track-result');
  const empty = document.getElementById('track-empty');

  function renderTimeline(status) {
    const idx = STAGES.indexOf(status);
    return STAGES.map((stage, i) => {
      let cls = 'timeline-step';
      if (i < idx) cls += ' done';
      if (i === idx) cls += ' current';
      return '<div class="' + cls + '">' + stage + '</div>';
    }).join('');
  }

  async function lookup(id) {
    empty.classList.add('hidden');
    result.classList.add('hidden');
    try {
      const data = await PharmAPI.get('/api/track/' + encodeURIComponent(id));
      const c = data.complaint;
      document.getElementById('t-id').textContent = c.complaint_id;
      document.getElementById('t-product').textContent = c.product + ' (' + c.product_code + ')';
      document.getElementById('t-status').innerHTML = PharmApp.badge('status', c.status);
      document.getElementById('t-submitted').textContent = PharmApp.formatDate(c.submitted_at);
      document.getElementById('t-updated').textContent = PharmApp.formatDate(c.last_updated);
      document.getElementById('t-stage').textContent = c.current_stage;
      document.getElementById('timeline').innerHTML = renderTimeline(c.status);
      result.classList.remove('hidden');
    } catch (error) {
      empty.classList.remove('hidden');
      empty.querySelector('p').textContent = error.status === 404
        ? 'No complaint was found for that ID. Check the ID and try again.'
        : PharmApp.friendlyError(error);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = String(form.complaint_id.value || '').trim().toUpperCase();
    if (!id) {
      PharmApp.toast('Enter a complaint ID', 'error');
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('id', id);
    window.history.replaceState({}, '', url);
    lookup(id);
  });

  const preset = new URLSearchParams(window.location.search).get('id');
  if (preset) {
    form.complaint_id.value = preset;
    lookup(preset.trim().toUpperCase());
  }
})();
