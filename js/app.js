/**
 * app.js — Main application controller
 * Auth check, navigation, sync, theme, and UI wiring
 */

let currentSection = 'dashboard';
let isAppReady = false;

/* ===== INITIALIZATION ===== */

async function initApp() {
  console.log('Initializing MedTracker v0.2...');

  // Check authentication
  const authOk = await checkAuth();
  if (!authOk) return;

  // Load data
  const data = window.Storage.getLocalData();

  // Load theme preference
  applyTheme(data.settings?.theme || 'system');

  // Render everything
  renderAllSections(data);

  // Set up navigation
  setupNavigation();

  // Set up all event listeners
  setupEventListeners();

  // Check notification permission
  if (data.settings?.reminderEnabled) {
    requestNotificationPermissionIfNeeded();
  }

  // Attempt initial Gist sync (non-blocking)
  const token = window.Storage.getGistToken();
  const gistId = window.Storage.getGistId();
  if (token && gistId) {
    window.Storage.syncWithGist()
      .then(() => updateSyncStatus('synced'))
      .catch(() => updateSyncStatus('error'));
  } else {
    updateSyncStatus('not configured');
  }

  // Periodic sync every 5 minutes
  setInterval(() => {
    if (window.Storage.getGistToken()) {
      window.Storage.syncWithGist().catch(() => {});
    }
  }, 5 * 60 * 1000);

  // Schedule reminders
  scheduleReminders();

  // Offline/online events
  window.addEventListener('online', () => {
    window.Storage.syncWithGist().catch(() => {}).then(() => updateSyncStatus('synced'));
  });
  window.addEventListener('offline', () => updateSyncStatus('offline'));

  // Show the app
  document.getElementById('appRoot').style.display = '';
  isAppReady = true;
}

/* ===== AUTH ===== */

async function checkAuth() {
  if (!window.Auth.hasPassword()) {
    // First time setup — set default password "medtracker"
    try {
      await window.Auth.setNewPassword('medtracker');
    } catch (err) {
      console.error('Default password setup failed:', err);
    }
    document.getElementById('loginSubtitle').textContent = 'Your default password is: medtracker (please change it!)';
    // Show login overlay and wait for user to unlock
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';
    document.getElementById('loginPassword').focus();
    return false;
  }

  if (window.Auth.isUnlocked()) {
    return true;
  }

  // Show login overlay (password exists but session is locked)
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginPassword').focus();
  return false;
}

function attemptUnlock() {
  const password = document.getElementById('loginPassword').value;
  window.Auth.verifyPassword(password)
    .then(valid => {
      if (valid) {
        window.Auth.unlock();
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('appRoot').style.display = '';
        document.getElementById('appRoot').style.display = 'flex';
        document.getElementById('appRoot').style.flexDirection = 'column';
        isAppReady = true;
        // Initialize everything after unlock
        initAppUnlocked();
      } else {
        document.getElementById('loginError').textContent = 'Incorrect password. Please try again.';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginPassword').focus();
      }
    })
    .catch(err => {
      document.getElementById('loginError').textContent = err.message;
    });
}

function initAppUnlocked() {
  initApp();
}

function lockApp() {
  window.Auth.lock();
  isAppReady = false;
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginPassword').focus();
  window.Notifications.toast('App locked', 'info');
}

/* ===== EVENT LISTENERS ===== */

function setupEventListeners() {
  // Password toggle function (top-level so it works anytime)
  window.togglePwd = function(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = iconId ? document.getElementById(iconId) : null;
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.textContent = '🙈';
    } else {
      input.type = 'password';
      if (icon) icon.textContent = '👁';
    }
  };

  // Lock button
  document.getElementById('btnLock')?.addEventListener('click', lockApp);

  // Login form
  document.getElementById('loginForm')?.addEventListener('submit', e => {
    e.preventDefault();
    attemptUnlock();
  });

  // Toggle password visibility
  document.getElementById('togglePassword')?.addEventListener('click', () => {
    window.togglePwd('loginPassword', 'toggleIcon');
  });

  // Change password modal — login overlay
  document.getElementById('btnChangePass')?.addEventListener('click', () => {
    openChangePassModal();
  });

  // Toggle new password visibility
  document.getElementById('toggleNewPass')?.addEventListener('click', () => {
    window.togglePwd('newPassword', null);
  });

  // Change password form
  document.getElementById('changePassForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveNewPassword();
  });

  document.getElementById('btnCancelPass')?.addEventListener('click', () => {
    document.getElementById('changePassModal').close();
  });

  // Settings: change password
  document.getElementById('btnChangePassSettings')?.addEventListener('click', () => {
    openChangePassModal();
  });

  // Settings: lock app
  document.getElementById('btnLogout')?.addEventListener('click', lockApp);

  // Settings: toggle theme
  document.getElementById('btnToggleTheme')?.addEventListener('click', () => {
    cycleTheme();
  });

  // Settings: Gist buttons
  document.getElementById('btnConnectGist')?.addEventListener('click', connectGist);
  document.getElementById('btnSyncNow')?.addEventListener('click', manualSync);

  // Settings: Notifications
  document.getElementById('notifEnabled')?.addEventListener('change', e => {
    window.Notifications.setNotificationEnabled(e.target.checked);
    scheduleReminders();
  });
  document.getElementById('notifLeadMinutes')?.addEventListener('change', e => {
    window.Notifications.setReminderLeadMinutes(parseInt(e.target.value, 10));
    scheduleReminders();
  });

  // Settings: Data export/import
  document.getElementById('btnExport')?.addEventListener('click', exportData);
  document.getElementById('btnImport')?.addEventListener('click', triggerImport);

  // Inventory: batch refill
  document.getElementById('btnBatchRefill')?.addEventListener('click', batchRefill);

  // Adjust inventory modal
  document.getElementById('btnCancelAdjust')?.addEventListener('click', () => {
    document.getElementById('adjustInvModal').close();
  });
  document.getElementById('adjustInvForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveAdjustInventory();
  });

  // Close medication form
  document.getElementById('btnCloseForm')?.addEventListener('click', () => {
    window.Medications.closeMedForm();
  });
  document.getElementById('btnCancelMed')?.addEventListener('click', () => {
    window.Medications.closeMedForm();
  });

  // Add time button
  document.getElementById('btnAddTime')?.addEventListener('click', () => {
    addTimeInput('00:00', true);
  });

  // Every day checkbox
  document.getElementById('everyDayCheck')?.addEventListener('change', e => {
    document.querySelectorAll('#scheduleDays input[type="checkbox"]').forEach(cb => {
      cb.checked = e.target.checked;
    });
  });

  // Password: toggle visibility helper
  window.togglePwd = function(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = iconId ? document.getElementById(iconId) : null;
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.textContent = '🙈';
    } else {
      input.type = 'password';
      if (icon) icon.textContent = '👁';
    }
  };
}

/* ===== THEME ===== */

function applyTheme(theme) {
  if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

function cycleTheme() {
  const data = window.Storage.getLocalData();
  const themes = ['light', 'dark', 'system'];
  const current = data.settings?.theme || 'system';
  const next = themes[(themes.indexOf(current) + 1) % themes.length];
  if (!data.settings) data.settings = {};
  data.settings.theme = next;
  window.Storage.saveLocalData(data);
  applyTheme(next);
  window.Notifications.toast(`Theme: ${next}`, 'info');
}

/* ===== NAVIGATION ===== */

function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.dataset.section;
      showSection(section);
    });
  });
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.setAttribute('aria-selected', 'false');
    tab.classList.remove('active');
  });

  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add('active');

  const tab = document.querySelector(`.nav-tab[data-section="${sectionId}"]`);
  if (tab) {
    tab.setAttribute('aria-selected', 'true');
    tab.classList.add('active');
  }
  currentSection = sectionId;
}

/* ===== NOTIFICATIONS ===== */

async function requestNotificationPermissionIfNeeded() {
  if (!('Notification' in window)) return;
  const permission = Notification.permission;
  if (permission === 'default') {
    const result = await window.Notifications.requestNotificationPermission();
    if (result.granted) {
      window.Notifications.setNotificationEnabled(true);
      scheduleReminders();
    }
  }
}

function scheduleReminders() {
  const data = window.Storage.getLocalData();
  if (data.settings?.reminderEnabled) {
    window.Notifications.scheduleAllReminders(data.medications || []);
  }
}

/* ===== SYNC ===== */

function updateSyncStatus(status) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (!dot || !label) return;

  switch (status) {
    case 'synced': dot.className = 'sync-dot synced'; label.textContent = 'Synced'; break;
    case 'updating': dot.className = 'sync-dot updating'; label.textContent = 'Syncing...'; break;
    case 'error': dot.className = 'sync-dot'; label.textContent = 'Sync error'; break;
    case 'offline': dot.className = 'sync-dot'; label.textContent = 'Offline'; break;
    default: dot.className = 'sync-dot'; label.textContent = 'Not synced';
  }
}

async function syncWithGist() {
  updateSyncStatus('updating');
  try {
    await window.Storage.syncWithGist();
    updateSyncStatus('synced');
  } catch (err) {
    updateSyncStatus('error');
  }
}

/* ===== CONNECT TO GIST ===== */

async function connectGist() {
  const token = document.getElementById('gistToken').value.trim();
  const gistId = document.getElementById('gistId').value.trim();

  if (!token) {
    window.Notifications.toast('Please enter your GitHub token', 'error');
    return;
  }

  window.Notifications.toast('Connecting to GitHub...', 'info');

  try {
    window.Storage.saveGistToken(token);

    let data;
    if (gistId) {
      window.Storage.saveGistId(gistId);
      data = await window.Storage.fetchFromGist();
    } else {
      data = window.Storage.getLocalData();
      const result = await window.Storage.saveToGist(data);
      window.Storage.saveGistId(result.id);
    }

    window.Storage.saveLocalData(data);
    window.Storage.saveLastSync(new Date().toISOString());
    renderAllSections(data);
    scheduleReminders();

    window.Notifications.toast('Connected to GitHub Gist!', 'success');
    updateSyncStatus('synced');
  } catch (err) {
    console.error('Gist error:', err);
    window.Notifications.toast('Failed: ' + err.message, 'error');
    updateSyncStatus('error');
  }
}

function manualSync() {
  syncWithGist();
  window.Notifications.toast('Syncing...', 'info');
}

/* ===== EXPORT / IMPORT ===== */

function exportData() {
  const data = window.Storage.getLocalData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medtracker-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  window.Notifications.toast('Data exported', 'success');
}

function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.medications || !Array.isArray(data.medications)) {
        throw new Error('Invalid data format');
      }
      window.Storage.saveLocalData(data);
      renderAllSections(data);
      scheduleReminders();
      window.Notifications.toast('Data imported successfully', 'success');
    } catch (err) {
      window.Notifications.toast('Invalid JSON file', 'error');
    }

    document.body.removeChild(input);
  });

  input.click();
}

/* ===== CHANGE PASSWORD ===== */

function openChangePassModal() {
  document.getElementById('changePassError').textContent = '';
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('changePassModal').showModal();
  document.getElementById('oldPassword').focus();
}

async function saveNewPassword() {
  const oldPwd = document.getElementById('oldPassword').value;
  const newPwd = document.getElementById('newPassword').value;
  const errEl = document.getElementById('changePassError');

  if (newPwd.length < 4) {
    errEl.textContent = 'New password must be at least 4 characters';
    return;
  }

  try {
    if (window.Auth.hasPassword()) {
      await window.Auth.changePassword(oldPwd, newPwd);
    } else {
      await window.Auth.setNewPassword(newPwd);
    }
    document.getElementById('changePassModal').close();
    window.Notifications.toast('Password updated', 'success');
  } catch (err) {
    errEl.textContent = err.message;
  }
}

/* ===== INVENTORY MANAGEMENT ===== */

function batchRefill() {
  const data = window.Storage.getLocalData();
  if (!data.medications || data.medications.length === 0) {
    window.Notifications.toast('No medications to refill', 'warning');
    return;
  }
  const count = data.medications.length;
  data.medications.forEach(med => {
    if (med.inventory) {
      med.inventory.remainingPills = med.inventory.totalPills || 30;
    }
  });
  window.Storage.saveLocalData(data);
  renderAllSections(data);
  window.Notifications.toast(`${count} medication(s) refilled`, 'success');
}

function openAdjustInventory(medId) {
  const data = window.Storage.getLocalData();
  const med = data.medications.find(m => m.id === medId);
  if (!med) return;

  document.getElementById('adjustMedId').value = medId;
  document.getElementById('adjustPills').value = med.inventory?.remainingPills || 0;
  document.getElementById('adjustNotes').value = '';
  document.getElementById('adjustInvModal').showModal();
}

async function saveAdjustInventory(e) {
  e.preventDefault();
  const medId = document.getElementById('adjustMedId').value;
  const remainingPills = parseInt(document.getElementById('adjustPills').value, 10);

  const data = window.Storage.getLocalData();
  const med = data.medications.find(m => m.id === medId);
  if (!med) return;

  med.inventory.remainingPills = remainingPills;
  window.Storage.saveLocalData(data);
  document.getElementById('adjustInvModal').close();
  renderAllSections(data);
  window.Notifications.toast('Inventory updated', 'success');
}

/* ===== DASHBOARD SUMMARY ===== */

function renderDashboardSummary(medications, intakeLogs) {
  const summaryEl = document.getElementById('dashboardSummary');
  if (!summaryEl) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const missed = Scheduler.findMissedDoses(medications, intakeLogs);
  const missedToday = missed.filter(m => m.status === 'missed');
  const reorderAlerts = medications.filter(m => m.inventory && m.inventory.remainingPills <= (m.inventory.refillThreshold || 0));

  let html = '';
  // Total medications
  html += `<div class="summary-card"><div class="summary-value">${medications.length}</div><div class="summary-label">Medications</div></div>`;
  // Doses today
  const dosesToday = Scheduler.getTodaySchedule(medications).length;
  html += `<div class="summary-card"><div class="summary-value">${dosesToday}</div><div class="summary-label">Doses Today</div></div>`;
  // Taken
  const takenCount = intakeLogs.filter(l => l.scheduledAt.includes(todayStr) && l.taken).length;
  html += `<div class="summary-card"><div class="summary-value">${takenCount}</div><div class="summary-label">Taken</div></div>`;
  // Missed
  html += `<div class="summary-card ${missedToday.length > 0 ? 'alert' : ''}"><div class="summary-value">${missedToday.length}</div><div class="summary-label">Missed</div></div>`;
  // Low stock
  html += `<div class="summary-card ${reorderAlerts.length > 0 ? 'warning' : ''}"><div class="summary-value">${reorderAlerts.length}</div><div class="summary-label">Reorder</div></div>`;

  summaryEl.innerHTML = html;
}

/* ===== RENDER ALL ===== */

function renderAllSections(data) {
  const medications = data.medications || [];
  const intakeLogs = data.intakeLogs || [];

  renderDashboardSummary(medications, intakeLogs);
  window.Dashboard.renderDashboard(medications, intakeLogs);
  window.Medications.renderMedications(medications);
  window.Inventory.renderInventory(medications);

  // Inventory summary
  const invSummaryEl = document.getElementById('inventorySummary');
  if (invSummaryEl && medications.length > 0) {
    const lowStock = medications.filter(m => m.inventory && m.inventory.remainingPills <= (m.inventory.refillThreshold || 0)).length;
    const totalRemaining = medications.reduce((sum, m) => sum + (m.inventory?.remainingPills || 0), 0);
    invSummaryEl.innerHTML = `
      <div class="summary-card"><div class="summary-value">${medications.length}</div><div class="summary-label">Medications</div></div>
      <div class="summary-card"><div class="summary-value">${totalRemaining}</div><div class="summary-label">Total Pills</div></div>
      <div class="summary-card ${lowStock > 0 ? 'warning' : ''}"><div class="summary-value">${lowStock}</div><div class="summary-label">Reorder</div></div>
    `;
  } else if (invSummaryEl) {
    invSummaryEl.innerHTML = '';
  }

  // Date
  const todayEl = document.getElementById('todayDate');
  if (todayEl) {
    todayEl.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
}

/* ===== INIT ON DOM LOAD ===== */

document.addEventListener('DOMContentLoaded', async () => {
  // Show login overlay first (or skip if already unlocked)
  const unlocked = window.Auth.hasPassword() && window.Auth.isUnlocked();
  if (!unlocked) {
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';
    document.getElementById('loginError').textContent = '';
    document.getElementById('loginPassword').focus();
  }

  // Always run checkAuth to handle first-time setup
  const authOk = await checkAuth();
  if (authOk) {
    isAppReady = true;
    initApp();
  }
});