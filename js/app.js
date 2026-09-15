/**
 * app.js — Main application controller
 * Initializes the app, handles routing, and orchestrates sync
 */

let currentSection = 'dashboard';

/**
 * Initialize the app
 */
async function initApp() {
  console.log('Initializing MedTracker...');

  // Load data from storage
  let data = window.Storage.getLocalData();

  // Initial render
  renderAllSections(data);

  // Set up navigation
  setupNavigation();

  // Request notification permission if enabled in settings
  if (data.settings?.reminderEnabled) {
    requestNotificationPermissionIfNeeded();
  }

  // Attempt initial sync with Gist (non-blocking)
  const token = window.Storage.getGistToken();
  const gistId = window.Storage.getGistId();

  if (token && gistId) {
    syncWithGist().catch(err => {
      console.warn('Initial sync failed:', err);
      updateSyncStatus('error');
    }).then(() => {
      updateSyncStatus('synced');
    });
  } else {
    updateSyncStatus('not configured');
  }

  // Set up periodic sync (every 5 minutes)
  setInterval(() => {
    const token = window.Storage.getGistToken();
    if (token) {
      syncWithGist().catch(() => {}); // Silent retry
    }
  }, 5 * 60 * 1000);

  // Schedule reminders
  scheduleReminders();

  // Handle offline/online events
  window.addEventListener('online', () => {
    syncWithGist().catch(() => {}).then(() => updateSyncStatus('synced'));
  });
  window.addEventListener('offline', () => {
    updateSyncStatus('offline');
  });

  // Focus on first input if in add mode
  if (window.location.hash === '#add-med') {
    setTimeout(() => {
      window.Medications.openMedForm(null);
    }, 100);
  }
}

/**
 * Render all sections
 */
function renderAllSections(data) {
  // Render each section with current data
  window.Dashboard.renderDashboard(data.medications || [], data.intakeLogs || []);
  window.Medications.renderMedications(data.medications || []);
  window.Inventory.renderInventory(data.medications || []);

  // Update today's date
  document.getElementById('todayDate').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Set up navigation tabs
 */
function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.dataset.section;
      showSection(section);
    });
  });
}

/**
 * Show a specific section
 */
function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Remove active class from all tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.setAttribute('aria-selected', 'false');
    tab.classList.remove('active');
  });

  // Show selected section
  const section = document.getElementById(`section-${sectionId}`);
  if (section) {
    section.classList.add('active');
  }

  // Set active tab
  const tab = document.querySelector(`.nav-tab[data-section="${sectionId}"]`);
  if (tab) {
    tab.setAttribute('aria-selected', 'true');
    tab.classList.add('active');
  }

  currentSection = sectionId;
}

/**
 * Request notification permission if needed
 */
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

/**
 * Schedule all medication reminders
 */
function scheduleReminders() {
  const data = window.Storage.getLocalData();
  window.Notifications.scheduleAllReminders(data.medications || []);
}

/**
 * Update sync status UI
 */
function updateSyncStatus(status) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');

  switch (status) {
    case 'synced':
      dot.className = 'sync-dot synced';
      label.textContent = 'Synced';
      break;
    case 'updating':
      dot.className = 'sync-dot updating';
      label.textContent = 'Syncing...';
      break;
    case 'error':
      dot.className = 'sync-dot';
      label.textContent = 'Sync error';
      break;
    case 'offline':
      dot.className = 'sync-dot';
      label.textContent = 'Offline';
      break;
    case 'not configured':
      dot.className = 'sync-dot';
      label.textContent = 'Not configured';
      break;
    default:
      dot.className = 'sync-dot';
      label.textContent = 'Unknown';
  }
}

/**
 * Sync with Gist wrapper
 */
async function syncWithGist() {
  updateSyncStatus('updating');
  const result = await window.Storage.syncWithGist();
  updateSyncStatus('synced');
  return result;
}

/**
 * Handle form submission for medication
 */
async function handleMedFormSubmit(e) {
  e.preventDefault();
  // Medications.js handles this via its own listener
}

/**
 * Export data as JSON file
 */
function exportData() {
  const data = window.Storage.getLocalData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medtracker-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import data from JSON file
 */
function importData() {
  const input = document.getElementById('importFile');
  input.click();

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    try {
      const data = JSON.parse(text);
      // Basic validation
      if (!data.medications || !Array.isArray(data.medications)) {
        throw new Error('Invalid data format');
      }

      window.Storage.saveLocalData(data);
      renderAllSections(data);
      window.Notifications.toast('Data imported successfully', 'success');
    } catch (err) {
      console.error('Import error:', err);
      window.Notifications.toast('Invalid JSON file', 'error');
    }

    // Reset input
    e.target.value = '';
  }, { once: true });
}

/**
 * Connect to Gist
 */
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
      // Test the connection by fetching existing Gist
      data = await window.Storage.fetchFromGist();
    } else {
      // Create a new private Gist for this user
      data = window.Storage.getLocalData();
      await window.Storage.createGist(data);
      window.Storage.saveGistId(data.gist_id);
    }

    window.Storage.saveLocalData(data);
    renderAllSections(data);

    window.Notifications.toast('Connected to GitHub Gist!', 'success');
    updateSyncStatus('synced');
  } catch (err) {
    console.error('Gist connection error:', err);
    window.Notifications.toast('Failed to connect: ' + err.message, 'error');
    updateSyncStatus('error');
  }
}

/**
 * Manual sync button handler
 */
async function manualSync() {
  window.Notifications.toast('Syncing with GitHub...', 'info');
  try {
    await window.Storage.syncWithGist();
    window.Notifications.toast('Sync complete!', 'success');
    updateSyncStatus('synced');
  } catch (err) {
    console.error('Sync error:', err);
    window.Notifications.toast('Sync failed: ' + err.message, 'error');
    updateSyncStatus('error');
  }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // Wire up settings buttons
  document.getElementById('btnConnectGist')?.addEventListener('click', connectGist);
  document.getElementById('btnSyncNow')?.addEventListener('click', manualSync);
  document.getElementById('btnExport')?.addEventListener('click', exportData);
  document.getElementById('btnImport')?.addEventListener('click', () => {
    // We need to recreate the input and listener each time to avoid duplicates
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.className = 'hidden';
    document.body.appendChild(input);

    const handler = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const text = await file.text();
      try {
        const data = JSON.parse(text);
        // Basic validation
        if (!data.medications || !Array.isArray(data.medications)) {
          throw new Error('Invalid data format');
        }

        window.Storage.saveLocalData(data);
        renderAllSections(data);
        window.Notifications.toast('Data imported successfully', 'success');
      } catch (err) {
        console.error('Import error:', err);
        window.Notifications.toast('Invalid JSON file', 'error');
      }

      // Clean up
      document.body.removeChild(input);
    };

    input.addEventListener('change', handler);
    input.click();
  });
});

// For debugging
window.app = {
  initApp,
  renderAllSections,
  updateSyncStatus
};