/**
 * dashboard.js — Dashboard view rendering
 */

/**
 * Render the dashboard view
 * @param {Array} medications - Full medication list
 * @param {Array} intakeLogs - Full intake logs
 */
function renderDashboard(medications, intakeLogs) {
  const content = document.getElementById('dashboardContent');
  const todayStr = new Date().toISOString().split('T')[0];

  // Get today's schedule
  const schedule = Scheduler.getTodaySchedule(medications);
  const missed = Scheduler.findMissedDoses(medications, intakeLogs);

  // Build dashboard HTML
  let html = '';

  // Missed doses alert
  const missedToday = missed.filter(m => m.status === 'missed');
  const missedAlert = document.getElementById('missedDoses');
  if (missedToday.length > 0) {
    missedAlert.classList.remove('hidden');
    missedAlert.innerHTML = `
      <strong>⚠️ Missed Doses (${missedToday.length}):</strong><br>
      ${missedToday.map(m => `${m.name} at ${Scheduler.formatTime(m.time)}`).join('<br>')}
    `;
  } else {
    missedAlert.classList.add('hidden');
  }

  // Reorder alerts
  const reorderAlerts = medications.filter(m => m.inventory && m.inventory.remainingPills <= (m.inventory.refillThreshold || 0));
  const reorderAlert = document.getElementById('reorderAlerts');
  if (reorderAlerts.length > 0) {
    reorderAlert.classList.remove('hidden');
    reorderAlert.innerHTML = `
      <strong>🚨 Reorder Needed:</strong><br>
      ${reorderAlerts.map(m => `${m.name}: ${m.inventory.remainingPills} remaining, order soon!`).join('<br>')}
    `;
  } else {
    reorderAlert.classList.add('hidden');
  }

  // Today's schedule
  if (schedule.length === 0 && medications.length > 0) {
    html = `<p class="empty-state">No doses scheduled for today. Check back later!</p>`;
  } else if (schedule.length === 0) {
    html = `<p class="empty-state">No medications configured yet.</p>`;
  } else {
    html = '<div class="schedule-list">';
    schedule.forEach(dose => {
      const isTaken = isTaken(intakeLogs, dose.medId, dose.time);
      const isLate = missed.find(m => m.medId === dose.medId && m.time === dose.time && m.status === 'late');
      const pillClass = isTaken ? 'taken' : isLate ? 'missed' : '';
      const pillSymbol = isTaken ? '✔' : isLate ? '⚠' : '○';
      const med = medications.find(m => m.id === dose.medId);

      html += `
        <div class="med-card" data-med="${dose.medId}">
          <div class="med-card-header">
            <div class="med-card-title">${dose.name}</div>
            <div class="med-card-dosage">${dose.dosage}</div>
            <div class="med-card-schedule">
              <span class="med-card-time">${Scheduler.formatTime(dose.time)}</span>
              ${med && med.schedule.days ? `<span class="med-card-day">${Scheduler.getScheduleDays(med.schedule.days)}</span>` : ''}
            </div>
          </div>
          <div class="med-card-actions">
            <button class="intake-btn ${pillClass}"
                    data-med="${dose.medId}"
                    data-time="${dose.time}"
                    aria-label="${isTaken ? 'Mark as not taken' : 'Mark as taken'}"
                    title="${isTaken ? 'Mark as not taken' : 'Mark as taken'}">
              ${pillSymbol}
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  content.innerHTML = html;

  // Attach event listeners to intake buttons
  document.querySelectorAll('.intake-btn').forEach(btn => {
    btn.addEventListener('click', handleIntakeToggle);
  });
}

/**
 * Check if a dose is marked as taken
 */
function isTaken(intakeLogs, medId, time) {
  const todayStr = new Date().toISOString().split('T')[0];
  return intakeLogs.some(log =>
    log.medId === medId &&
    log.scheduledAt.includes(todayStr) &&
    log.scheduledAt.includes(time) &&
    log.taken === true
  );
}

/**
 * Handle intake button click
 */
function handleIntakeToggle(e) {
  const btn = e.currentTarget;
  const medId = btn.dataset.med;
  const time = btn.dataset.time;

  // Find existing log or create new one
  const todayStr = new Date().toISOString().split('T')[0];
  const scheduledAt = `${todayStr}T${time}:00`;
  const data = window.Storage.getLocalData();
  const intakeLogs = data.intakeLogs || [];

  const existingIdx = intakeLogs.findIndex(log =>
    log.medId === medId && log.scheduledAt === scheduledAt
  );

  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    // Toggle: if taken, mark as not taken; if not taken, mark as taken
    intakeLogs[existingIdx].taken = !intakeLogs[existingIdx].taken;
    intakeLogs[existingIdx].takenAt = intakeLogs[existingIdx].taken ? now : null;
    window.Notifications.toast(`${intakeLogs[existingIdx].taken ? '✓ Marked as taken' : '○ Marked as not taken'}`, intakeLogs[existingIdx].taken ? 'success' : 'warning');
  } else {
    // New log entry — mark as taken
    intakeLogs.push({
      medId: medId,
      scheduledAt: scheduledAt,
      taken: true,
      takenAt: now,
      notes: ''
    });
    window.Notifications.toast('✓ Marked as taken', 'success');
  }

  // Save and refresh
  data.intakeLogs = intakeLogs;
  window.Storage.saveLocalData(data);
  window.Dashboard.renderDashboard(data.medications, data.intakeLogs);

  // Sync with Gist
  window.Storage.syncWithGist().catch(err => console.error('Sync failed:', err));
}

// Export for use in other modules
window.Dashboard = { renderDashboard };