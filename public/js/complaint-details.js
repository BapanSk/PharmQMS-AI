(function () {
  const STATUSES = ['New', 'AI Analyzed', 'QA Review', 'Under Investigation', 'Corrective Action', 'Resolved', 'Closed'];
  const TRANSITIONS = {
    New: ['AI Analyzed', 'QA Review'],
    'AI Analyzed': ['QA Review', 'Under Investigation'],
    'QA Review': ['Under Investigation', 'AI Analyzed', 'Corrective Action'],
    'Under Investigation': ['Corrective Action', 'QA Review'],
    'Corrective Action': ['Resolved', 'Under Investigation'],
    Resolved: ['Closed', 'Under Investigation'],
    Closed: ['QA Review', 'Under Investigation']
  };
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  let current = null;
  let analysis = null;
  let investigation = null;
  let user = null;

  function showModal(title, bodyHtml, onConfirm, okLabel) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal"><h3>' + title + '</h3>' + bodyHtml +
      '<div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>Cancel</button>' +
      '<button class="btn btn-primary" type="button" data-ok>' + (okLabel || 'Confirm') + '</button></div></div>';
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

  function canReopen() {
    return user && (user.role === 'ADMIN' || user.role === 'QA_MANAGER');
  }

  function allowedStatuses() {
    if (!current) return STATUSES;
    if (current.status === 'Closed') {
      return canReopen() ? ['QA Review', 'Under Investigation'] : [];
    }
    return TRANSITIONS[current.status] || [];
  }

  function renderAnalysis(data) {
    const card = document.getElementById('ai-card');
    analysis = data.analysis;
    if (!analysis) {
      card.innerHTML = '<h3>AI Analysis</h3><div class="empty-state">No analysis yet. Run Re-analyze to generate a recommendation.</div>';
      return;
    }
    const pending = analysis.qa_decision === 'pending';
    card.innerHTML =
      '<div class="ai-head"><h3>AI Analysis</h3><span class="ai-flag">' + PharmApp.escapeHtml(analysis.disclaimer) + '</span></div>' +
      '<p class="muted">Recommendations are not final. QA must Accept, Edit, or Reject before they become case values.</p>' +
      '<dl class="kv">' +
      '<dt>Category</dt><dd>' + PharmApp.escapeHtml(analysis.category) + '</dd>' +
      '<dt>Severity</dt><dd>' + PharmApp.badge('sev', analysis.severity) + '</dd>' +
      '<dt>Priority</dt><dd>' + PharmApp.badge('pri', analysis.priority) + '</dd>' +
      '<dt>Confidence</dt><dd>' + PharmApp.escapeHtml(String(analysis.confidence_score == null ? '—' : analysis.confidence_score + '%')) + '</dd>' +
      '<dt>QA decision</dt><dd>' + PharmApp.escapeHtml(analysis.qa_decision || 'pending') + '</dd>' +
      '</dl>' +
      '<p><strong>Summary</strong><br>' + PharmApp.escapeHtml(analysis.summary || '—') + '</p>' +
      '<p><strong>Suspected issue</strong><br>' + PharmApp.escapeHtml(analysis.suspected_issue || '—') + '</p>' +
      '<p><strong>Patient impact</strong><br>' + PharmApp.escapeHtml(analysis.patient_impact || '—') + '</p>' +
      '<p><strong>Recommended action</strong><br>' + PharmApp.escapeHtml(analysis.recommended_action || '—') + '</p>' +
      (pending
        ? '<div class="action-row"><button class="btn btn-primary" type="button" id="ai-accept">Accept</button>' +
          '<button class="btn btn-secondary" type="button" id="ai-edit">Edit</button>' +
          '<button class="btn btn-ghost" type="button" id="ai-reject">Reject</button></div>'
        : '');
    if (pending) {
      document.getElementById('ai-accept').addEventListener('click', () => reviewAnalysis('accept'));
      document.getElementById('ai-reject').addEventListener('click', () => reviewAnalysis('reject'));
      document.getElementById('ai-edit').addEventListener('click', openEditAnalysis);
    }
  }

  function renderInvestigation(data) {
    investigation = data.investigation;
    const card = document.getElementById('investigation-card');
    if (!investigation) {
      card.innerHTML = '<h3>QA Investigation</h3><p class="muted">No investigation has been opened yet.</p>' +
        '<button class="btn btn-primary" type="button" id="inv-start">Start investigation</button>';
      document.getElementById('inv-start').addEventListener('click', () => openInvestigation(null));
      return;
    }
    card.innerHTML =
      '<div class="ai-head"><h3>QA Investigation</h3>' + PharmApp.badge('status', investigation.investigation_status) + '</div>' +
      '<dl class="kv">' +
      '<dt>Investigator</dt><dd>' + PharmApp.escapeHtml(investigation.investigator_name || '—') + '</dd>' +
      '<dt>Started</dt><dd>' + PharmApp.formatDate(investigation.investigation_date) + '</dd>' +
      '<dt>Completed</dt><dd>' + PharmApp.formatDate(investigation.completed_at) + '</dd>' +
      '<dt>CAPA ref</dt><dd>' + PharmApp.escapeHtml(investigation.capa_reference || '—') + '</dd>' +
      '</dl>' +
      '<p><strong>Summary</strong><br>' + PharmApp.escapeHtml(investigation.summary || '—') + '</p>' +
      '<p><strong>Root cause</strong><br>' + PharmApp.escapeHtml(investigation.root_cause || '—') + '</p>' +
      '<p><strong>Findings</strong><br>' + PharmApp.escapeHtml(investigation.findings || '—') + '</p>' +
      '<p><strong>Corrective action</strong><br>' + PharmApp.escapeHtml(investigation.corrective_action || '—') + '</p>' +
      '<p><strong>Preventive action</strong><br>' + PharmApp.escapeHtml(investigation.preventive_action || '—') + '</p>' +
      '<p><strong>Resolution notes</strong><br>' + PharmApp.escapeHtml(investigation.resolution_notes || '—') + '</p>' +
      '<button class="btn btn-secondary" type="button" id="inv-edit">Update investigation</button>';
    document.getElementById('inv-edit').addEventListener('click', () => openInvestigation(investigation));
  }

  function render(data) {
    current = data.complaint;
    document.getElementById('title-id').textContent = current.complaint_id;
    document.getElementById('customer-card').innerHTML =
      '<dl class="kv">' +
      '<dt>Name</dt><dd>' + PharmApp.escapeHtml(current.customer_name) + '</dd>' +
      '<dt>Email</dt><dd>' + PharmApp.escapeHtml(current.customer_email) + '</dd>' +
      '<dt>Phone</dt><dd>' + PharmApp.escapeHtml(current.customer_phone || '—') + '</dd>' +
      '<dt>Country</dt><dd>' + PharmApp.escapeHtml(current.country || '—') + '</dd>' +
      '<dt>Purchase location</dt><dd>' + PharmApp.escapeHtml(current.purchase_location || '—') + '</dd>' +
      '</dl>';
    document.getElementById('product-card').innerHTML =
      '<dl class="kv">' +
      '<dt>Product</dt><dd>' + PharmApp.escapeHtml(current.product_name) + '</dd>' +
      '<dt>Code</dt><dd>' + PharmApp.escapeHtml(current.product_code) + '</dd>' +
      '<dt>Batch</dt><dd>' + PharmApp.escapeHtml(current.batch_number) + '</dd>' +
      '<dt>Mfg date</dt><dd>' + PharmApp.escapeHtml(current.manufacturing_date || '—') + '</dd>' +
      '<dt>Expiry</dt><dd>' + PharmApp.escapeHtml(current.expiry_date || '—') + '</dd>' +
      '</dl>';
    document.getElementById('desc-card').textContent = current.description;
    document.getElementById('meta-card').innerHTML =
      '<dl class="kv">' +
      '<dt>Severity</dt><dd>' + PharmApp.badge('sev', current.severity) + '</dd>' +
      '<dt>Priority</dt><dd>' + PharmApp.badge('pri', current.priority) + '</dd>' +
      '<dt>Status</dt><dd>' + PharmApp.badge('status', current.status) + '</dd>' +
      '<dt>Assigned QA</dt><dd>' + PharmApp.escapeHtml(current.assigned_to_name || 'Unassigned') + '</dd>' +
      '<dt>Submitted</dt><dd>' + PharmApp.formatDate(current.created_at) + '</dd>' +
      '<dt>Updated</dt><dd>' + PharmApp.formatDate(current.updated_at) + '</dd>' +
      '</dl>';

    document.getElementById('history-list').innerHTML = (data.history || []).map((h) => (
      '<div class="timeline-item"><div class="comment-meta">' + PharmApp.escapeHtml(h.changed_by_name || 'System') +
      ' · ' + PharmApp.formatDate(h.created_at) + '</div>' +
      '<strong>' + PharmApp.escapeHtml((h.from_status || 'Opened') + ' → ' + h.to_status) + '</strong>' +
      (h.notes ? '<div>' + PharmApp.escapeHtml(h.notes) + '</div>' : '') +
      '</div>'
    )).join('') || '<div class="empty-state">No history yet.</div>';

    document.getElementById('comment-list').innerHTML = (data.comments || []).map((c) => (
      '<div class="comment"><div class="comment-meta">' + PharmApp.escapeHtml(c.user_name) +
      ' · ' + PharmApp.escapeHtml(c.user_role) + ' · ' + PharmApp.formatDate(c.created_at) + '</div>' +
      PharmApp.escapeHtml(c.comment) + '</div>'
    )).join('') || '<div class="empty-state">No comments yet.</div>';

    document.getElementById('attachment-list').innerHTML = (data.attachments || []).map((a) => (
      '<div class="comment"><div class="comment-meta">' + PharmApp.escapeHtml(a.uploaded_by_name || 'Staff') +
      ' · ' + PharmApp.formatDate(a.created_at) + ' · ' + Math.round((a.file_size || 0) / 1024) + ' KB</div>' +
      '<a href="/api/complaints/' + id + '/attachments/' + a.id + '" data-download="' + a.id + '">' +
      PharmApp.escapeHtml(a.file_name) + '</a></div>'
    )).join('') || '<div class="empty-state">No attachments yet.</div>';

    document.querySelectorAll('[data-download]').forEach((link) => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        try {
          const token = PharmAPI.getToken();
          const response = await fetch(link.getAttribute('href'), {
            headers: token ? { Authorization: 'Bearer ' + token } : {},
            credentials: 'same-origin'
          });
          if (!response.ok) throw new Error('Download failed');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = link.textContent.trim();
          a.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          PharmApp.toast(PharmApp.friendlyError(error), 'error');
        }
      });
    });

    renderAnalysis(data);
    renderInvestigation(data);

    const closed = current.status === 'Closed';
    ['btn-edit', 'btn-assign', 'btn-reanalyze', 'comment-form', 'attach-form'].forEach((sid) => {
      const el = document.getElementById(sid);
      if (el) el.classList.toggle('hidden', closed && sid !== 'btn-edit');
    });
    const invStart = document.getElementById('inv-start');
    const invEdit = document.getElementById('inv-edit');
    if (closed && invStart) invStart.classList.add('hidden');
    if (closed && invEdit) invEdit.classList.add('hidden');
    document.getElementById('btn-status').textContent = closed ? 'Reopen complaint' : 'Change Status';
  }

  async function reload() {
    const data = await PharmAPI.get('/api/complaints/' + id);
    render(data);
  }

  async function save(payload) {
    await PharmAPI.put('/api/complaints/' + id, payload);
    await reload();
    PharmApp.toast('Complaint updated', 'success');
  }

  async function reviewAnalysis(decision, extra) {
    try {
      await PharmAPI.post('/api/complaints/' + id + '/analyze/review', Object.assign({ decision: decision }, extra || {}));
      await reload();
      PharmApp.toast('Analysis ' + decision + 'ed', 'success');
    } catch (error) {
      PharmApp.toast(PharmApp.friendlyError(error), 'error');
    }
  }

  function openEditAnalysis() {
    showModal('Edit analysis',
      '<label>Category</label><select id="m-cat">' + ['Product Quality', 'Packaging', 'Labeling', 'Adverse Event', 'Distribution', 'Manufacturing', 'Other'].map((s) => '<option' + (analysis.category === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
      '<label>Severity</label><select id="m-sev">' + ['Critical', 'Major', 'Minor'].map((s) => '<option' + (analysis.severity === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
      '<label>Priority</label><select id="m-pri">' + ['High', 'Medium', 'Low'].map((s) => '<option' + (analysis.priority === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
      '<label>Summary</label><textarea id="m-sum">' + PharmApp.escapeHtml(analysis.summary || '') + '</textarea>' +
      '<label>Recommended action</label><textarea id="m-act">' + PharmApp.escapeHtml(analysis.recommended_action || '') + '</textarea>',
      async (modal) => {
        await reviewAnalysis('edit', {
          category: modal.querySelector('#m-cat').value,
          severity: modal.querySelector('#m-sev').value,
          priority: modal.querySelector('#m-pri').value,
          summary: modal.querySelector('#m-sum').value,
          recommended_action: modal.querySelector('#m-act').value
        });
      }, 'Save edits');
  }

  function openInvestigation(existing) {
    showModal(existing ? 'Update investigation' : 'Start investigation',
      '<label>Summary</label><textarea id="i-sum">' + PharmApp.escapeHtml((existing && existing.summary) || '') + '</textarea>' +
      '<label>Root cause</label><textarea id="i-root">' + PharmApp.escapeHtml((existing && existing.root_cause) || '') + '</textarea>' +
      '<label>Findings</label><textarea id="i-find">' + PharmApp.escapeHtml((existing && existing.findings) || '') + '</textarea>' +
      '<label>Corrective action</label><textarea id="i-corr">' + PharmApp.escapeHtml((existing && existing.corrective_action) || '') + '</textarea>' +
      '<label>Preventive action</label><textarea id="i-prev">' + PharmApp.escapeHtml((existing && existing.preventive_action) || '') + '</textarea>' +
      '<label>CAPA reference</label><input id="i-capa" value="' + PharmApp.escapeHtml((existing && existing.capa_reference) || '') + '">' +
      '<label>Resolution notes</label><textarea id="i-res">' + PharmApp.escapeHtml((existing && existing.resolution_notes) || '') + '</textarea>' +
      '<label>Status</label><select id="i-st">' + ['Open', 'In Progress', 'Completed'].map((s) => '<option' + (existing && existing.investigation_status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>',
      async (modal) => {
        const payload = {
          summary: modal.querySelector('#i-sum').value,
          root_cause: modal.querySelector('#i-root').value,
          findings: modal.querySelector('#i-find').value,
          corrective_action: modal.querySelector('#i-corr').value,
          preventive_action: modal.querySelector('#i-prev').value,
          capa_reference: modal.querySelector('#i-capa').value,
          resolution_notes: modal.querySelector('#i-res').value,
          investigation_status: modal.querySelector('#i-st').value
        };
        if (existing) await PharmAPI.put('/api/complaints/' + id + '/investigation', payload);
        else await PharmAPI.post('/api/complaints/' + id + '/investigation', payload);
        await reload();
        PharmApp.toast(existing ? 'Investigation updated' : 'Investigation started', 'success');
      }, 'Save');
  }

  window.PharmDetails = {
    async init(staffUser) {
      user = staffUser;
      if (!id) {
        document.getElementById('details-root').innerHTML = '<div class="error-state">Missing complaint id.</div>';
        return;
      }
      try {
        await reload();
      } catch (error) {
        document.getElementById('details-root').innerHTML = '<div class="error-state">' + PharmApp.escapeHtml(PharmApp.friendlyError(error)) + '</div>';
        return;
      }

      document.getElementById('btn-status').addEventListener('click', () => {
        const options = allowedStatuses();
        if (!options.length) {
          PharmApp.toast('No allowed status changes from Closed unless you are a manager or admin.', 'error');
          return;
        }
        showModal(current.status === 'Closed' ? 'Reopen complaint' : 'Change status',
          '<label>Status</label><select id="m-status">' +
          options.map((s) => '<option>' + s + '</option>').join('') +
          '</select>',
          async (modal) => {
            const status = modal.querySelector('#m-status').value;
            if (['Resolved', 'Closed'].includes(status)) {
              const ok = window.confirm('Confirm changing status to ' + status + '?');
              if (!ok) return;
            }
            await save({ status: status });
          });
      });

      document.getElementById('btn-assign').addEventListener('click', async () => {
        let assignees = [];
        try {
          assignees = (await PharmAPI.get('/api/dashboard/assignees')).data;
        } catch (error) {
          PharmApp.toast(PharmApp.friendlyError(error), 'error');
          return;
        }
        showModal('Assign QA',
          '<label>Assignee</label><select id="m-user"><option value="">Unassigned</option>' +
          assignees.map((u) => '<option value="' + u.id + '"' + (current.assigned_to === u.id ? ' selected' : '') + '>' +
            PharmApp.escapeHtml(u.name + ' · ' + u.role) + '</option>').join('') + '</select>',
          async (modal) => {
            const value = modal.querySelector('#m-user').value;
            await save({ assigned_to: value ? Number(value) : null });
          });
      });

      document.getElementById('btn-edit').addEventListener('click', () => {
        if (current.status === 'Closed') {
          PharmApp.toast('Closed complaints cannot be edited. Reopen first.', 'error');
          return;
        }
        showModal('Edit complaint',
          '<label>Severity</label><select id="m-sev">' + ['Critical', 'Major', 'Minor'].map((s) => '<option' + (current.severity === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
          '<label>Priority</label><select id="m-pri">' + ['High', 'Medium', 'Low'].map((s) => '<option' + (current.priority === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
          '<label>Category</label><select id="m-cat">' + ['Product Quality', 'Packaging', 'Labeling', 'Adverse Event', 'Distribution', 'Manufacturing', 'Other'].map((s) => '<option' + (current.category === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>',
          async (modal) => {
            await save({
              severity: modal.querySelector('#m-sev').value,
              priority: modal.querySelector('#m-pri').value,
              category: modal.querySelector('#m-cat').value
            });
          });
      });

      document.getElementById('btn-reanalyze').addEventListener('click', async () => {
        try {
          await PharmAPI.post('/api/complaints/' + id + '/analyze', {});
          await reload();
          PharmApp.toast('Analysis regenerated', 'success');
        } catch (error) {
          PharmApp.toast(PharmApp.friendlyError(error), 'error');
        }
      });

      document.getElementById('comment-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = document.getElementById('comment-text');
        const comment = input.value.trim();
        if (!comment) return;
        try {
          await PharmAPI.post('/api/complaints/' + id + '/comments', { comment: comment });
          input.value = '';
          await reload();
          PharmApp.toast('Comment added', 'success');
        } catch (error) {
          PharmApp.toast(PharmApp.friendlyError(error), 'error');
        }
      });

      document.getElementById('attach-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const fileInput = document.getElementById('attach-file');
        if (!fileInput.files.length) return;
        const form = new FormData();
        form.append('file', fileInput.files[0]);
        try {
          await PharmAPI.upload('/api/complaints/' + id + '/attachments', form);
          fileInput.value = '';
          await reload();
          PharmApp.toast('Attachment uploaded', 'success');
        } catch (error) {
          PharmApp.toast(PharmApp.friendlyError(error), 'error');
        }
      });

      if (user.role === 'QA_ANALYST') {
        document.getElementById('btn-assign').classList.add('hidden');
      }
    }
  };
})();
