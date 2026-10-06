(function (window, document) {
  function applyTheme() {
    const saved = localStorage.getItem('pharmqms_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pharmqms_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  function toast(message, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function friendlyError(error) {
    if (!error) return 'Something went wrong. Please try again.';
    if (error.status === 401) return 'Your session expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to do that.';
    if (error.status === 404) return 'The requested record was not found.';
    if (error.status === 0) return error.message;
    return error.message || 'Something went wrong. Please try again.';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function formatDay(value) {
    if (!value) return '—';
    return String(value).slice(0, 10);
  }

  function badge(kind, value) {
    const cls = String(value || '').toLowerCase().replace(/\s+/g, '-');
    return '<span class="badge badge-' + cls + '">' + escapeHtml(value || kind) + '</span>';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setButtonLoading(button, loading) {
    if (!button) return;
    if (loading) {
      button.dataset.label = button.textContent;
      button.disabled = true;
      button.textContent = 'Please wait...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.label || button.textContent;
    }
  }

  function initPublicNav() {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', () => links.classList.toggle('open'));
    }
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
  }

  applyTheme();
  document.addEventListener('DOMContentLoaded', initPublicNav);

  window.PharmApp = {
    toast,
    friendlyError,
    formatDate,
    formatDay,
    badge,
    escapeHtml,
    setButtonLoading,
    toggleTheme,
    applyTheme
  };
})(window, document);
