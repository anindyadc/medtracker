/**
 * storage.js — Data persistence layer
 * Manages localStorage caching and GitHub Gist API sync
 */
const STORAGE_KEY = 'medtracker_data';
const GIST_TOKEN_KEY = 'medtracker_gist_token';
const GIST_ID_KEY = 'medtracker_gist_id';
const LAST_SYNC_KEY = 'medtracker_last_sync';

/**
 * Default data structure when no data exists
 */
function defaultData() {
  return {
    version: 1,
    lastSync: null,
    medications: [],
    intakeLogs: [],
    settings: {
      reminderEnabled: true,
      reminderLeadMinutes: 15
    }
  };
}

/**
 * Get data from localStorage cache
 */
function getLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local data:', e);
    return defaultData();
  }
}

/**
 * Save data to localStorage cache
 */
function saveLocalData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save local data:', e);
    // Could be quota exceeded — warn user
    if (window.Notifications) {
      window.Notifications.toast('Storage full! Consider cleaning up old intake logs.', 'error');
    }
  }
}

/**
 * Get GitHub Gist token from localStorage
 */
function getGistToken() {
  return localStorage.getItem(GIST_TOKEN_KEY) || '';
}

/**
 * Save GitHub Gist token to localStorage
 */
function saveGistToken(token) {
  localStorage.setItem(GIST_TOKEN_KEY, token);
}

/**
 * Get GitHub Gist ID from localStorage
 */
function getGistId() {
  return localStorage.getItem(GIST_ID_KEY) || '';
}

/**
 * Save GitHub Gist ID to localStorage
 */
function saveGistId(id) {
  localStorage.setItem(GIST_ID_KEY, id);
}

/**
 * Get last sync timestamp
 */
function getLastSync() {
  return localStorage.getItem(LAST_SYNC_KEY);
}

/**
 * Update last sync timestamp
 */
function saveLastSync(ts) {
  localStorage.setItem(LAST_SYNC_KEY, ts);
}

/**
 * Fetch data from GitHub Gist API
 * Returns parsed JSON data or null on failure
 */
async function fetchFromGist() {
  const token = getGistToken();
  const gistId = getGistId();

  if (!token || !gistId) {
    throw new Error('Gist token or ID not configured');
  }

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Gist fetch failed: ${response.status} ${response.statusText}`);
  }

  const gist = await response.json();
  const file = gist.files['medtracker.json'];

  if (!file) {
    throw new Error('medtracker.json not found in Gist');
  }

  return JSON.parse(file.content);
}

/**
 * Save data to GitHub Gist API
 * Creates new Gist if no ID exists, updates otherwise
 */
async function saveToGist(data) {
  const token = getGistToken();
  const gistId = getGistId();

  if (!token) {
    throw new Error('No GitHub token configured');
  }

  const body = {
    description: 'MedTracker data',
    public: false,
    files: {
      'medtracker.json': {
        content: JSON.stringify(data, null, 2)
      }
    }
  };

  let response;

  if (gistId) {
    // Update existing Gist
    response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });
  } else {
    // Create new Gist
    response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gist save failed: ${response.status} ${error.message || ''}`);
  }

  const result = await response.json();

  // If newly created, save the Gist ID
  if (!gistId) {
    saveGistId(result.id);
  }

  return result;
}

/**
 * Sync: fetch from Gist, merge with local, save back to both
 * Returns { success, merged, conflict }
 */
async function syncWithGist() {
  const token = getGistToken();
  const gistId = getGistId();

  if (!token) {
    return { success: false, message: 'No token configured' };
  }

  try {
    const remoteData = await fetchFromGist();
    const localData = getLocalData();

    // Merge: remote takes precedence for medications, but preserve local intake logs
    // Strategy: if remote has more recent lastSync, use remote; otherwise push local
    const remoteTime = remoteData.lastSync || 0;
    const localTime = localData.lastSync || 0;

    let merged;
    if (remoteTime >= localTime) {
      // Remote is newer or equal — use remote
      merged = remoteData;
    } else {
      // Local is newer — keep local but update meds from remote (safer)
      merged = {
        ...localData,
        medications: remoteData.medications || localData.medications,
        // Merge intake logs — combine both, dedupe by scheduledAt+medId
        intakeLogs: mergeIntakeLogs(localData.intakeLogs || [], remoteData.intakeLogs || [])
      };
    }

    // Update timestamp
    merged.lastSync = new Date().toISOString();

    // Save to both
    saveLocalData(merged);
    await saveToGist(merged);
    saveLastSync(merged.lastSync);

    return { success: true, merged, conflict: false };
  } catch (e) {
    console.error('Sync error:', e);
    throw e;
  }
}

/**
 * Merge intake logs from two sources — dedupe by scheduledAt+medId
 */
function mergeIntakeLogs(localLogs, remoteLogs) {
  const map = new Map();

  // Add remote logs first (assume they're authoritative)
  (remoteLogs || []).forEach(log => {
    const key = `${log.scheduledAt}_${log.medId}`;
    map.set(key, log);
  });

  // Add local logs that aren't in remote
  (localLogs || []).forEach(log => {
    const key = `${log.scheduledAt}_${log.medId}`;
    if (!map.has(key)) {
      map.set(key, log);
    }
  });

  return Array.from(map.values());
}

/**
 * Initialize Gist: create a new Gist if no ID exists
 */
async function initGist(data) {
  const token = getGistToken();
  if (!token) {
    throw new Error('No GitHub token configured');
  }

  const body = {
    description: 'MedTracker data',
    public: false,
    files: {
      'medtracker.json': {
        content: JSON.stringify(data, null, 2)
      }
    }
  };

  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gist init failed: ${response.status} ${error.message || ''}`);
  }

  const result = await response.json();
  saveGistId(result.id);
  saveLastSync(new Date().toISOString());

  return result;
}

/**
 * Create Gist for the first time (convenience wrapper)
 */
async function createGist(data) {
  return await initGist(data);
}

// Export for use in other modules
window.Storage = {
  getLocalData,
  saveLocalData,
  getGistToken,
  saveGistToken,
  getGistId,
  saveGistId,
  getLastSync,
  fetchFromGist,
  saveToGist,
  syncWithGist,
  initGist,
  defaultData
};