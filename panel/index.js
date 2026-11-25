let statusData = null;
let dirty = false;
let saving = false;
let bridgeDirty = false;
let noticeTimer;
const $ = id => document.getElementById(id);

async function api(path, data) {
  const response = await fetch(path, {
    method: data ? 'POST' : 'GET', credentials:'same-origin',
    headers: data ? {'Content-Type':'application/json', 'X-CSRF-Token':statusData?.csrf || ''} : {},
    body: data ? JSON.stringify(data) : undefined
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error('The server did not respond correctly. Try again shortly.'); }
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') showLogin();
    throw new Error(result.error || 'Request failed');
  }
  return result;
}

function showLogin() {
  $('dashboard').hidden = true;
  $('login-view').hidden = false;
  $('setup-view').hidden = true;
  statusData = null;
  $('notice').hidden = true;
}

function notice(message, bad = false) {
  clearTimeout(noticeTimer);
  $('notice').textContent = message;
  $('notice').classList.toggle('bad', bad);
  $('notice').setAttribute('role', bad ? 'alert' : 'status');
  $('notice').hidden = false;
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, bad ? 8000 : 3000);
}

function percent(value) {
  return Number.isFinite(value) ? value.toFixed(1) + '%' : '?';
}

function renderMetrics(status) {
  const {usage, resources, settings} = status;
  $('connected-users').textContent = usage?.available && Number.isFinite(usage.users)
    ? usage.users.toLocaleString() : '?';
  $('users-detail').textContent = usage?.available && usage.users === null
    ? usage.connections.toLocaleString() + ' active connections; client count unavailable'
    : 'Estimated from active IPs';
  $('cpu-value').textContent = percent(resources?.cpu_percent);
  $('memory-value').textContent = percent(resources?.memory_percent);
  $('memory-detail').textContent = Number.isFinite(resources?.memory_used)
    ? (resources.memory_used / 1048576).toLocaleString(undefined, {maximumFractionDigits: 1}) + ' MiB used' : '';
  $('sponsor-badge').textContent = settings.enabled
    ? (settings.channel ? '@' + settings.channel : 'Enabled') : 'Disabled';
  $('total-usage').textContent = Number.isFinite(usage?.total_bytes)
    ? (usage.total_bytes / 1e9).toLocaleString(undefined, {maximumFractionDigits: 3}) + ' GB' : '?';
  $('usage-period').textContent = usage
    ? 'Since ' + new Date(usage.since * 1000).toLocaleDateString() : '';
}

async function refresh(force = false) {
  const s = await api('/api/status');
  statusData = s;
  $('login-view').hidden = true;
  $('setup-view').hidden = true;
  $('dashboard').hidden = false;
  $('running').textContent = s.running ? 'Online' : 'Starting';
  renderMetrics(s);
  const networkReady = s.network_ready !== false && Boolean(s.host);
  $('endpoint').textContent = networkReady ? s.host + ':' + s.port : 'Unavailable';
  $('network-note').textContent = networkReady ? '' : 'Waiting for a public TCP endpoint.';
  $('copy-link').disabled = !networkReady;
  $('copy-tg-link').disabled = !networkReady;
  $('tls-host').textContent = s.tls_host;
  $('web-link').value = s.web_link;
  $('tg-link').value = s.tg_link;
  $('open-telegram').hidden = !networkReady;
  $('open-telegram').href = s.tg_link;
  if (s.bridge) {
    $('railway-origin').value = s.bridge.hosting_origin || s.bridge.railway_origin || '';
    $('worker-name').textContent = s.bridge.worker_name || 'join-blueknight-net-tg-...';
    if (!bridgeDirty || force) {
      $('worker-url').value = s.bridge.worker_url;
      $('public-ip').value = s.bridge.public_ip;
      $('bridge-enabled').checked = s.bridge.enabled;
      bridgeDirty = false;
    }
    $('bridge-badge').textContent = s.bridge.enabled ? 'Enabled' : 'Disabled';
    $('bridge-link').value = s.bridge.tg_link;
    $('open-web-telegram').href = s.bridge.tg_link;
    $('open-web-telegram').hidden = !s.bridge.tg_link;
    $('copy-bridge-link').disabled = !s.bridge.tg_link;
  }
  if (!dirty || force) {
    $('channel').value = s.settings.channel;
    $('ad-tag').value = s.settings.ad_tag;
    $('enabled').checked = s.settings.enabled;
    dirty = false;
  }
  $('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  $('storage-note').hidden = s.persistent;
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter || $('login-form').querySelector('button');
  button.disabled = true;
  $('login-error').textContent = '';
  try {
    await api('/api/login', {password:$('password').value});
    $('password').value = '';
    $('notice').hidden = true;
    await refresh(true);
  } catch (error) { $('login-error').textContent = error.message; }
  finally { button.disabled = false; }
});

$('sponsor-form').addEventListener('input', () => { dirty = true; });
$('sponsor-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || !statusData) return;
  const payload = {enabled:$('enabled').checked, channel:$('channel').value.trim(), ad_tag:$('ad-tag').value.trim()};
  if (payload.enabled && !/^[a-fA-F0-9]{32}$/.test(payload.ad_tag)) {
    notice('Enter the 32-character promotion tag from @MTProxybot before enabling sponsorship.', true);
    $('ad-tag').focus();
    return;
  }
  const needsRestart = payload.enabled !== statusData.settings.enabled || (payload.enabled && payload.ad_tag.toLowerCase() !== statusData.settings.ad_tag);
  if (needsRestart && !confirm('Applying this change restarts Meow. Clients may briefly reconnect. Continue?')) return;
  saving = true;
  $('save').disabled = true;
  $('save').textContent = 'Applying...';
  try {
    await api('/api/settings', payload);
    dirty = false;
    await refresh();
    notice(payload.enabled ? 'Sponsor configuration saved. Telegram controls channel delivery; allow time for the promotion to update.' : 'Settings saved. Sponsorship is disabled.');
  } catch (error) { notice(error.message, true); }
  finally { saving = false; $('save').disabled = false; $('save').textContent = 'Save changes'; }
});

$('refresh').addEventListener('click', async () => {
  $('refresh').disabled = true;
  try { await refresh(); } catch (error) { notice(error.message, true); }
  finally { $('refresh').disabled = false; }
});

$('logout').addEventListener('click', async () => {
  try { await api('/api/logout', {}); }
  catch (error) { notice(error.message, true); return; }
  dirty = false;
  $('sponsor-form').reset();
  $('web-link').value = '';
  $('tg-link').value = '';
  $('bridge-token').value = '';
  $('worker-source').value = '';
  $('bridge-link').value = '';
  $('open-web-telegram').href = '#/bridge';
  bridgeDirty = false;
  $('notice').hidden = true;
  showLogin();
});

async function copy(value, label, input) {
  if (!value) { notice('Connection details are not loaded yet. Refresh and try again.', true); return; }
  try {
    await navigator.clipboard.writeText(value);
    notice(label + ' copied.');
  } catch {
    if (input) { const details = input.closest('details'); if (details) details.open = true; input.focus(); input.select(); }
    notice('Automatic copying is unavailable. ' + (input ? 'The link is selected; press Ctrl+C or use your device\'s Copy command.' : 'Copy the key from your deployment logs.'), true);
  }
}

$('copy-link').addEventListener('click', () => copy(statusData?.web_link, 'HTTPS link', $('web-link')));
$('copy-tg-link').addEventListener('click', () => copy(statusData?.tg_link, 'Direct Telegram link', $('tg-link')));
$('copy-key').addEventListener('click', () => copy(statusData?.registration_secret, 'Registration key'));
$('copy-bridge-link').addEventListener('click', () => copy(statusData?.bridge?.tg_link, 'Telegram WEB link', $('bridge-link')));
for (const id of ['web-link', 'tg-link', 'bridge-link']) $(id).addEventListener('click', () => $(id).select());
$('bridge-form').addEventListener('input', () => { bridgeDirty = true; });
$('worker-url').addEventListener('input', () => { $('public-ip').value = ''; });
$('bridge-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  saving = true;
  $('save-bridge').disabled = true;
  try {
    await api('/api/bridge/settings', {worker_url:$('worker-url').value.trim(), enabled:$('bridge-enabled').checked, public_ip:$('public-ip').value.trim()});
    bridgeDirty = false;
    await refresh();
    notice('WEB settings saved. Use the WEB link in a compatible Telegram client after deploying the Worker.');
  } catch (error) { notice(error.message, true); }
  finally { saving = false; $('save-bridge').disabled = false; }
});
async function loadWorkerCode(reveal = false) {
  const response = await fetch('/api/bridge/standalone', {credentials:'same-origin'});
  if (!response.ok) throw new Error('Could not load Worker code. Sign in again and retry.');
  const source = await response.text();
  $('worker-source').value = source;
  $('worker-source-box').open = reveal;
  return source;
}
$('copy-worker-code').addEventListener('click', async () => {
  try { await copy(await loadWorkerCode(), 'Ready-to-deploy Worker code', $('worker-source')); }
  catch (error) { notice(error.message, true); }
});
$('load-worker-code').addEventListener('click', () => loadWorkerCode(true).catch(error => notice(error.message, true)));
$('copy-bridge-token').addEventListener('click', async () => {
  try {
    const result = await api('/api/bridge/token');
    $('bridge-token').value = result.token;
    await copy(result.token, 'Private bridge token', $('bridge-token'));
  } catch (error) { notice(error.message, true); }
});
async function initialize() {
  try {
    const setup = await api('/api/setup/status');
    if (setup.required) {
      $('login-view').hidden = true;
      $('dashboard').hidden = true;
      $('setup-view').hidden = false;
      return;
    }
    await refresh();
  } catch { showLogin(); }
}
$('setup-form').addEventListener('submit', async event => {
  event.preventDefault();
  const password = $('setup-password').value;
  if (password !== $('setup-confirm').value) { $('setup-error').textContent = 'Passwords do not match.'; return; }
  const button = $('setup-form').querySelector('button');
  button.disabled = true;
  $('setup-error').textContent = '';
  try {
    await api('/api/setup', {code:$('setup-code').value.trim(), password});
    $('setup-form').reset();
    await api('/api/login', {password});
    await refresh(true);
  } catch (error) { $('setup-error').textContent = error.message; }
  finally { button.disabled = false; }
});
initialize();
setInterval(() => { if (statusData && !saving) refresh().catch(error => notice(error.message, true)); }, 15000);
