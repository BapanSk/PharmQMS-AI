(function () {
  const form = document.getElementById('complaint-form');
  const success = document.getElementById('success-panel');
  const productSelect = document.getElementById('product_id');

  async function loadProducts() {
    try {
      const data = await PharmAPI.get('/api/products');
      productSelect.innerHTML = '<option value="">Select a product</option>' +
        data.data.map((p) => '<option value="' + p.id + '">' + PharmApp.escapeHtml(p.product_name) + ' (' + PharmApp.escapeHtml(p.product_code) + ')</option>').join('');
    } catch (error) {
      productSelect.innerHTML = '<option value="">Unable to load products</option>';
      PharmApp.toast(PharmApp.friendlyError(error), 'error');
    }
  }

  function clearErrors() {
    form.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.input-error').forEach((el) => el.classList.remove('input-error'));
  }

  function setError(name, message) {
    const input = form.elements[name];
    const err = document.querySelector('[data-error="' + name + '"]');
    if (input) input.classList.add('input-error');
    if (err) err.textContent = message;
  }

  function validate() {
    clearErrors();
    const values = Object.fromEntries(new FormData(form).entries());
    let ok = true;
    const required = ['customer_name', 'customer_email', 'product_id', 'batch_number', 'category', 'description'];
    required.forEach((name) => {
      if (!String(values[name] || '').trim()) {
        setError(name, 'This field is required');
        ok = false;
      }
    });
    if (values.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customer_email)) {
      setError('customer_email', 'Enter a valid email address');
      ok = false;
    }
    if (values.customer_phone && values.customer_phone.trim() && !/^[0-9+()\-\s]{7,50}$/.test(values.customer_phone.trim())) {
      setError('customer_phone', 'Enter a valid phone number');
      ok = false;
    }
    if (values.description && values.description.trim().length < 20) {
      setError('description', 'Please describe the issue in at least 20 characters');
      ok = false;
    }
    return ok;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate()) return;
    const button = form.querySelector('button[type="submit"]');
    PharmApp.setButtonLoading(button, true);
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.product_id = Number(payload.product_id);
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '') payload[key] = null;
    });
    try {
      const data = await PharmAPI.post('/api/complaints', payload);
      const c = data.complaint;
      document.getElementById('ok-id').textContent = c.complaint_id;
      document.getElementById('ok-date').textContent = PharmApp.formatDate(c.created_at);
      document.getElementById('ok-status').textContent = c.status;
      document.getElementById('track-link').href = '/track?id=' + encodeURIComponent(c.complaint_id);
      form.classList.add('hidden');
      success.classList.remove('hidden');
      PharmApp.toast('Complaint submitted successfully', 'success');
    } catch (error) {
      PharmApp.toast(PharmApp.friendlyError(error), 'error');
    } finally {
      PharmApp.setButtonLoading(button, false);
    }
  });

  loadProducts();
})();
