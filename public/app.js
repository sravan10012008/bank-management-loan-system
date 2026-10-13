const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    location.replace('/index.html');
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
}
function message(element, text, type = 'success') {
  element.textContent = text;
  element.className = `message ${type}`;
  element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideMessage(element) { element.className = 'message hidden'; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function money(value) { return currency.format(Number(value || 0)); }
async function logout() {
  try { await api('/api/logout', { method: 'POST', body: '{}' }); }
  finally { location.replace('/index.html'); }
}
document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', logout));

async function initSession() {
  const data = await api('/api/session');
  if (!data.authenticated) { location.replace('/index.html'); return false; }
  const welcome = document.getElementById('welcome-user');
  if (welcome) welcome.textContent = `Signed in as ${data.username}`;
  return true;
}

async function loadDashboard() {
  const data = await api('/api/dashboard');
  document.getElementById('stat-total').textContent = number.format(data.total);
  document.getElementById('stat-eligible').textContent = number.format(data.eligible);
  document.getElementById('stat-rejected').textContent = number.format(data.rejected);
}

function readForm() {
  const fields = [
    'applicantName', 'age', 'employmentType', 'currentBankBalance',
    'averageMonthlyBalance', 'monthlyIncome', 'monthlyExpenses',
    'existingMonthlyLoanPayments', 'monthlyTurnover', 'yearlyTurnover'
  ];
  const data = {};
  for (const id of fields) {
    const element = document.getElementById(id);
    data[id] = element.value;
    if (!element.checkValidity()) {
      element.reportValidity();
      element.focus();
      throw new Error('Please correct the highlighted form field.');
    }
    if (id !== 'applicantName' && id !== 'employmentType' && data[id] === '') {
      element.reportValidity();
      throw new Error('Please complete every required field.');
    }
  }
  data.applicantName = data.applicantName.trim();
  if (data.applicantName.length < 2) throw new Error('Applicant name must contain at least 2 characters.');
  return data;
}
function renderAssessment(result, saved) {
  const panel = document.getElementById('assessment-result');
  const eligible = result.eligibilityStatus === 'Eligible';
  const input = result.input || result.application || {};
  const reasons = result.reasons || [];
  panel.className = 'panel result-panel';
  panel.innerHTML = `
    <div class="result-header"><div><p class="eyebrow blue">ASSESSMENT REPORT</p><h2>Loan eligibility result</h2></div>
    <span class="status ${eligible ? 'eligible' : 'rejected'}">${eligible ? '✓ Eligible' : '× Not Eligible'}</span></div>
    <div class="result-metrics">
      <div class="result-metric"><span>Maximum eligible loan amount</span><strong>${money(result.maxEligibleLoanAmount)}</strong></div>
      <div class="result-metric"><span>Monthly disposable income</span><strong>${money(result.disposableIncome)}</strong></div>
    </div>
    <div class="result-detail"><h3>Assessment explanation</h3><p>${escapeHtml(result.assessmentExplanation)}</p>
    ${reasons.length ? `<ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
    <h3>Additional information (not independently verified)</h3>
    <div class="detail-grid">
      <div><span>Employment type</span><strong>${escapeHtml(input.employmentType || '—')}</strong></div>
      <div><span>Average monthly balance</span><strong>${money(input.averageMonthlyBalance)}</strong></div>
      <div><span>Monthly turnover</span><strong>${money(input.monthlyTurnover)}</strong></div>
      <div><span>Yearly turnover</span><strong>${money(input.yearlyTurnover)}</strong></div>
    </div></div>
    <div class="result-footer"><span>${saved ? 'Application saved to the database.' : 'Preview only — not saved yet.'}</span>
    <a class="btn outline small" href="/history.html">Open application history →</a></div>
    <p class="disclaimer">Illustrative college-project calculation only. Not actual bank lending policy or a loan offer.</p>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function initApplication() {
  const form = document.getElementById('application-form');
  const formMessage = document.getElementById('form-message');
  const resultPanel = document.getElementById('assessment-result');
  const params = new URLSearchParams(location.search);
  const editId = params.get('edit');
  if (editId) {
    try {
      const item = await api(`/api/applications/${encodeURIComponent(editId)}`);
      const values = {
        applicantName: item.applicantName, age: item.age, employmentType: item.employmentType,
        currentBankBalance: item.currentBankBalance, averageMonthlyBalance: item.averageMonthlyBalance,
        monthlyIncome: item.monthlyIncome, monthlyExpenses: item.monthlyExpenses,
        existingMonthlyLoanPayments: item.existingMonthlyLoanPayments,
        monthlyTurnover: item.monthlyTurnover, yearlyTurnover: item.yearlyTurnover
      };
      Object.entries(values).forEach(([id, value]) => { document.getElementById(id).value = value; });
      document.getElementById('application-id').value = item.applicationId;
      document.getElementById('form-title').textContent = `Edit application #${item.applicationId}`;
      document.getElementById('save-button').textContent = 'Reassess & update application';
    } catch (error) { message(formMessage, error.message, 'error'); }
  }

  form.addEventListener('reset', () => {
    setTimeout(() => { document.getElementById('application-id').value = ''; hideMessage(formMessage); resultPanel.className = 'panel result-panel hidden'; }, 0);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideMessage(formMessage);
    let input;
    try { input = readForm(); }
    catch (error) { return message(formMessage, error.message, 'error'); }
    const saveButton = document.getElementById('save-button');
    saveButton.disabled = true;
    saveButton.textContent = 'Assessing…';
    try {
      const preview = await api('/api/assess', { method: 'POST', body: JSON.stringify(input) });
      const id = document.getElementById('application-id').value;
      let response;
      if (id) {
        response = await api(`/api/applications/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
      } else {
        response = await api('/api/applications', { method: 'POST', body: JSON.stringify(input) });
      }
      const saved = response.application;
      renderAssessment({
        disposableIncome: saved.disposableIncome,
        eligibilityStatus: saved.eligibilityStatus,
        maxEligibleLoanAmount: saved.maxEligibleLoanAmount,
        assessmentExplanation: saved.assessmentExplanation,
        input: saved,
        reasons: preview.reasons
      }, true);
      message(formMessage, response.message, 'success');
      document.getElementById('application-id').value = saved.applicationId;
      document.getElementById('form-title').textContent = `Edit application #${saved.applicationId}`;
      saveButton.textContent = 'Reassess & update application';
    } catch (error) {
      message(formMessage, error.message, 'error');
    } finally {
      saveButton.disabled = false;
      if (!document.getElementById('application-id').value) saveButton.textContent = 'Assess & save application';
      else saveButton.textContent = 'Reassess & update application';
    }
  });
}

async function loadHistory() {
  const tbody = document.getElementById('history-body');
  const status = document.getElementById('status-filter').value;
  const items = await api(`/api/applications?status=${encodeURIComponent(status)}`);
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">No applications found. Create a new application to get started.</td></tr>';
  } else {
    tbody.innerHTML = items.map(item => `
      <tr>
        <td>#${item.applicationId}</td><td><strong>${escapeHtml(item.applicantName)}</strong></td>
        <td>${item.age}</td><td>${money(item.monthlyIncome)}</td><td>${money(item.disposableIncome)}</td>
        <td><span class="status ${item.eligibilityStatus === 'Eligible' ? 'eligible' : 'rejected'}">${escapeHtml(item.eligibilityStatus)}</span></td>
        <td><strong>${money(item.maxEligibleLoanAmount)}</strong></td>
        <td><div class="table-actions"><a class="action-link" href="/application.html?edit=${item.applicationId}">Edit</a><button class="action-link danger" data-delete="${item.applicationId}" data-name="${escapeHtml(item.applicantName)}">Delete</button></div></td>
      </tr>`).join('');
  }
  document.getElementById('history-count').textContent = `${items.length} application${items.length === 1 ? '' : 's'} shown`;
  tbody.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    const name = button.dataset.name;
    if (!confirm(`Delete the application for "${name}"? This cannot be undone.`)) return;
    try {
      const result = await api(`/api/applications/${button.dataset.delete}`, { method: 'DELETE' });
      message(document.getElementById('history-message'), result.message, 'success');
      await loadHistory();
    } catch (error) { message(document.getElementById('history-message'), error.message, 'error'); }
  }));
}

(async function boot() {
  const page = document.body.dataset.page;
  try {
    if (!await initSession()) return;
    if (page === 'dashboard') await loadDashboard();
    if (page === 'application') await initApplication();
    if (page === 'history') {
      document.getElementById('status-filter').addEventListener('change', () => loadHistory().catch(error => message(document.getElementById('history-message'), error.message, 'error')));
      await loadHistory();
    }
  } catch (error) {
    const target = document.getElementById('page-message') || document.getElementById('history-message') || document.getElementById('form-message');
    if (target) message(target, error.message, 'error');
    else console.error(error);
  }
})();
