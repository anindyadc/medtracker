/**
 * intake.js — Intake logging helpers
 */

/**
 * Mark a dose as taken or not taken
 */
function toggleIntake(medId, time) {
  const data = window.Storage.getLocalData();
  const todayStr = new Date().toISOString().split('T')[0];
  const scheduledAt = `${todayStr}T${time}:00`;
  const intakeLogs = data.intakeLogs || [];

  const existingIdx = intakeLogs.findIndex(log =>
    log.medId === medId && log.scheduledAt === scheduledAt
  );

  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    intakeLogs[existingIdx].taken = !intakeLogs[existingIdx].taken;
    intakeLogs[existingIdx].takenAt = intakeLogs[existingIdx].taken ? now : null;
  } else {
    intakeLogs.push({
      medId: medId,
      scheduledAt: scheduledAt,
      taken: true,
      takenAt: now,
      notes: ''
    });
  }

  data.intakeLogs = intakeLogs;
  window.Storage.saveLocalData(data);

  return data;
}

/**
 * Get intake status for a dose
 */
function getIntakeStatus(intakeLogs, medId, time) {
  const todayStr = new Date().toISOString().split('T')[0];
  const scheduledAt = `${todayStr}T${time}:00`;
  return intakeLogs.find(log => log.medId === medId && log.scheduledAt === scheduledAt);
}

// Export for use in other modules
window.Intake = {
  toggleIntake,
  getIntakeStatus
};