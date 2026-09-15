/**
 * scheduler.js — Time and scheduling logic
 */

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
  fri: 'Fri', sat: 'Sat', sun: 'Sun'
};

/**
 * Get today's day name
 */
function todayName() {
  return DAY_NAMES[new Date().getDay()];
}

/**
 * Check if a medication is scheduled for a specific day
 */
function isScheduledForDay(med, dayName) {
  const days = med.schedule.days;
  if (!days || days === 'every') return true;
  return days.includes(dayName);
}

/**
 * Get today's scheduled times for a medication
 */
function todayTimes(med) {
  if (!isScheduledForDay(med, todayName())) return [];
  return med.schedule.times || [];
}

/**
 * Get all scheduled times for today across all medications
 * @param {Array} medications
 * @returns {Array} [{medId, time, name, dosage}]
 */
function getTodaySchedule(medications) {
  const today = todayName();
  const schedule = [];

  medications.forEach(med => {
    const times = todayTimes(med);
    times.forEach(time => {
      schedule.push({
        medId: med.id,
        time: time,
        name: med.name,
        dosage: med.dosage,
        med: med
      });
    });
  });

  // Sort by time
  schedule.sort((a, b) => a.time.localeCompare(b.time));
  return schedule;
}

/**
 * Get next scheduled dose after a given time
 * @param {Array} medications
 * @param {Date} afterTime - Only return doses after this time
 * @returns {Object|null}
 */
function getNextDose(medications, afterTime) {
  const schedule = getTodaySchedule(medications);
  for (const dose of schedule) {
    const [hours, minutes] = dose.time.split(':').map(Number);
    const doseTime = new Date(afterTime);
    doseTime.setHours(hours, minutes, 0, 0);

    if (doseTime > afterTime) {
      return { ...dose, doseTime };
    }
  }
  return null;
}

/**
 * Check for missed doses in intake logs
 * @param {Array} medications
 * @param {Array} intakeLogs
 * @returns {Array} missed dose entries
 */
function findMissedDoses(medications, intakeLogs) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const missed = [];

  medications.forEach(med => {
    const times = todayTimes(med);
    const gracePeriod = med.missedDoseGracePeriodMs || 7200000; // 2 hours default

    times.forEach(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledAt = new Date(today);
      scheduledAt.setHours(hours, minutes, 0, 0);

      // Check if there's a taken log for this time
      const logEntry = intakeLogs.find(log =>
        log.medId === med.id &&
        log.scheduledAt.startsWith(todayStr) &&
        log.scheduledAt.includes(time) &&
        log.taken === true
      );

      if (logEntry) {
        // Taken within grace period → not missed
        const takenTime = new Date(logEntry.takenAt);
        const elapsed = takenTime - scheduledAt;
        if (elapsed > gracePeriod) {
          missed.push({
            medId: med.id,
            name: med.name,
            time: time,
            scheduledAt: scheduledAt.toISOString(),
            status: 'late' // taken but late
          });
        }
      } else {
        // Check if it's still within grace period
        const now = Date.now();
        if (now - scheduledAt.getTime() > gracePeriod) {
          // Past grace period and not taken → missed
          missed.push({
            medId: med.id,
            name: med.name,
            time: time,
            scheduledAt: scheduledAt.toISOString(),
            status: 'missed'
          });
        }
      }
    });
  });

  return missed;
}

/**
 * Format HH:MM time for display
 */
function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get next dose display string for dashboard
 */
function getNextDoseDisplay(medications) {
  const nextDose = getNextDose(medications, new Date());
  if (!nextDose) return 'No upcoming doses';
  return `${nextDose.name} at ${formatTime(nextDose.time)}`;
}

/**
 * Get day names for schedule
 */
function getScheduleDays(days) {
  if (!days || days === 'every') return 'Every day';
  return days.map(d => DAY_LABELS[d] || d).join(', ');
}

/**
 * Days until a date from today
 */
function daysUntil(dateStr) {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// Export for use in other modules
window.Scheduler = {
  todayName,
  isScheduledForDay,
  todayTimes,
  getTodaySchedule,
  getNextDose,
  getNextDoseDisplay,
  findMissedDoses,
  formatTime,
  getScheduleDays,
  daysUntil,
  DAY_LABELS,
  DAY_NAMES
};