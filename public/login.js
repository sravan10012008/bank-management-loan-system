const form = document.getElementById('login-form');
const message = document.getElementById('login-message');
const button = document.getElementById('login-button');

function showMessage(text, type = 'error') {
  message.textContent = text;
  message.className = `message ${type}`;
}
async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

(async () => {
  try {
    const session = await request('/api/session');
    if (session.authenticated) location.replace('/dashboard.html');
  } catch (_) { /* Login page remains available if the session check fails. */ }
})();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.className = 'message hidden';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) return showMessage('Enter both username and password.');
  button.disabled = true;
  button.textContent = 'Signing in…';
  try {
    await request('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    location.replace('/dashboard.html');
  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in securely';
  }
});
