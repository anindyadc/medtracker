/**
 * notifications.js — Browser Notification API wrapper and toast notifications
 */
const NOTIF_ENABLED_KEY = 'medtracker_notif_enabled';
const NOTIF_LEAD_KEY = 'medtracker_notif_lead';

/**
 * Show a toast notification
 */
function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type === 'info' ? 'success' : type}`;
  toastEl.textContent = message;
  toastEl.setAttribute('role', 'status');

  container.appendChild(toastEl);

  setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transition = 'opacity 0.3s';
    setTimeout(() => toastEl.remove(), 300);
  }, duration);
}

/**
 * Request notification permission
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { granted: false, reason: 'Browser does not support notifications' };
  }

  if (Notification.permission === 'granted') {
    return { granted: true };
  }

  const permission = await Notification.requestPermission();
  return { granted: permission === 'granted' };
}

/**
 * Check if notifications are enabled in settings
 */
function isNotificationEnabled() {
  return localStorage.getItem(NOTIF_ENABLED_KEY) !== 'false';
}

/**
 * Save notification enabled state
 */
function setNotificationEnabled(enabled) {
  localStorage.setItem(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Get reminder lead time in minutes
 */
function getReminderLeadMinutes() {
  const saved = localStorage.getItem(NOTIF_LEAD_KEY);
  return saved ? parseInt(saved, 10) : 15;
}

/**
 * Set reminder lead time in minutes
 */
function setReminderLeadMinutes(minutes) {
  localStorage.setItem(NOTIF_LEAD_KEY, minutes.toString());
}

/**
 * Schedule a notification for a specific time
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Date} fireAt - When to fire the notification
 * @param {string} tag - Unique tag for notification
 */
function scheduleNotification(title, body, fireAt, tag) {
  const now = new Date();
  const delay = fireAt.getTime() - now.getTime();

  if (delay <= 0) {
    // Fire immediately
    fireNotification(title, body, tag);
    return;
  }

  // Schedule with setTimeout (max ~24h safe)
  setTimeout(() => {
    fireNotification(title, body, tag);
  }, delay);
}

/**
 * Fire a browser notification
 */
function fireNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body: body,
      tag: tag || 'medtracker',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png'
    });

    notification.onclick = function() {
      window.focus();
      notification.close();
    };
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
}

/**
 * Schedule notifications for all medications
 * @param {Array} medications - List of medication objects
 */
function scheduleAllReminders(medications) {
  if (!isNotificationEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const today = new Date();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayName = dayNames[today.getDay()];
  const leadMinutes = getReminderLeadMinutes();

  medications.forEach(med => {
    // Check if medication is scheduled for today
    const days = med.schedule.days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    if (days.includes(todayName)) {
      (med.schedule.times || []).forEach(time => {
        const [hours, minutes] = time.split(':').map(Number);
        const fireTime = new Date(today);
        fireTime.setHours(hours, minutes, 0, 0);
        fireTime.setMinutes(fireTime.getMinutes() - leadMinutes);

        if (fireTime > now) {
          scheduleNotification(
            '💊 Time for ' + med.name,
            `${med.dosage} at ${time}`,
            fireTime,
            `${med.id}_${time}`
          );
        }
      });
    }
  });
}

// Export for use in other modules
window.Notifications = {
  toast,
  requestNotificationPermission,
  isNotificationEnabled,
  setNotificationEnabled,
  getReminderLeadMinutes,
  setReminderLeadMinutes,
  scheduleNotification,
  fireNotification,
  scheduleAllReminders
};