/**
 * medications.js — Medication management (CRUD)
 */

let editingMedId = null;

/**
 * Render medications list in the Medications section
 */
function renderMedications(medications) {
  const container = document.getElementById('medicationsList');

  if (!medications || medications.length === 0) {
    container.innerHTML = '<p class="empty-state">No medications yet. Click "Add Medication" to start.</p>';
    return;
  }

  let html = '';
  medications.forEach(med => {
    html += `
      <div class="med-card">
        <div class="med-card-header">
          <div class="med-card-title">${med.name}</div>
          <div class="med-card-dosage">${med.dosage} — ${Scheduler.getScheduleDays(med.schedule?.days)}</div>
          <div class="med-card-schedule">
            ${(med.schedule?.times || []).map(t => `<span class="med-card-time">${Scheduler.formatTime(t)}</span>`).join('')}
          </div>
        </div>
        <div class="med-card-actions">
          <button class="btn btn-secondary btn-sm btn-edit" data-id="${med.id}" title="Edit">Edit</button>
          <button class="btn btn-danger btn-sm btn-delete" data-id="${med.id}" title="Delete">Delete</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Attach event listeners
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openMedForm(btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteMedication(btn.dataset.id));
  });
}

/**
 * Open medication form for add/edit
 * @param {string|null} medId - ID of medication to edit, or null for new
 */
function openMedForm(medId) {
  const formContainer = document.getElementById('medFormContainer');
  const form = document.getElementById('medForm');
  const title = document.getElementById('medFormTitle');

  form.reset();
  editingMedId = medId;

  if (medId) {
    // Edit mode
    title.textContent = 'Edit Medication';
    const med = window.Storage.getLocalData().medications.find(m => m.id === medId);
    if (med) {
      document.getElementById('medFormId').value = med.id;
      document.getElementById('medName').value = med.name;
      document.getElementById('medDosage').value = med.dosage;
      document.getElementById('medForm').value = med.form || 'tablet';

      // Schedule times
      const timesContainer = document.getElementById('scheduleTimes');
      timesContainer.innerHTML = '';
      (med.schedule?.times || ['08:00']).forEach((time, idx) => {
        addTimeInput(time, idx > 0);
      });

      // Days
      const days = med.schedule?.days || ['mon','tue','wed','thu','fri','sat','sun'];
      document.querySelectorAll('#scheduleDays input[type="checkbox"]').forEach(cb => {
        cb.checked = days.includes(cb.value);
      });
      document.getElementById('everyDayCheck').checked = days.length === 7 || days === 'every';

      // Inventory
      document.getElementById('medTotalPills').value = med.inventory?.totalPills || 30;
      document.getElementById('medRemainingPills').value = med.inventory?.remainingPills || 30;
      document.getElementById('medRefillThreshold').value = med.inventory?.refillThreshold || 5;

      document.getElementById('medNotes').value = med.notes || '';
    }
  } else {
    // Add mode
    title.textContent = 'Add Medication';
    document.getElementById('medFormId').value = '';
    const timesContainer = document.getElementById('scheduleTimes');
    timesContainer.innerHTML = '';
    addTimeInput('08:00', false);
    document.getElementById('everyDayCheck').checked = true;
    document.getElementById('medTotalPills').value = 30;
    document.getElementById('medRemainingPills').value = 30;
    document.getElementById('medRefillThreshold').value = 5;

    // Check all day checkboxes
    document.querySelectorAll('#scheduleDays input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
    });
  }

  formContainer.classList.remove('hidden');
  document.getElementById('medName').focus();
}

/**
 * Add a time input row to the form
 */
function addTimeInput(value, showRemove) {
  const container = document.getElementById('scheduleTimes');
  const row = document.createElement('div');
  row.className = 'time-row';
  row.innerHTML = `
    <input type="time" class="sched-time" value="${value}" required />
    <button type="button" class="btn btn-danger btn-sm remove-time" aria-label="Remove time">×</button>
  `;
  container.appendChild(row);

  row.querySelector('.remove-time').addEventListener('click', () => {
    // Don't remove if it's the only one
    if (document.querySelectorAll('.time-row').length > 1) {
      row.remove();
    }
  });
}

/**
 * Save medication from form
 */
async function saveMedication(e) {
  e.preventDefault();

  const data = window.Storage.getLocalData();
  const medId = editingMedId || generateId();

  // Get schedule times
  const times = Array.from(document.querySelectorAll('.sched-time'))
    .map(input => input.value)
    .filter(v => v);

  // Get selected days
  const everyDay = document.getElementById('everyDayCheck').checked;
  let days;
  if (everyDay) {
    days = 'every';
  } else {
    days = Array.from(document.querySelectorAll('#scheduleDays input[type="checkbox"]:checked'))
      .map(cb => cb.value);
  }

  // Inventory
  const totalPills = parseInt(document.getElementById('medTotalPills').value, 10);
  const remainingPills = parseInt(document.getElementById('medRemainingPills').value, 10);
  const refillThreshold = parseInt(document.getElementById('medRefillThreshold').value, 10);

  const med = {
    id: medId,
    name: document.getElementById('medName').value.trim(),
    dosage: document.getElementById('medDosage').value.trim(),
    form: document.getElementById('medForm').value,
    schedule: { times, days },
    inventory: { totalPills, remainingPills, refillThreshold },
    notes: document.getElementById('medNotes').value.trim(),
    startDate: editingMedId ? data.medications.find(m => m.id === editingMedId)?.startDate : new Date().toISOString().split('T')[0],
    missedDoseGracePeriodMs: 7200000
  };

  // Validate
  if (!med.name || !med.dosage) {
    toast('Please fill in required fields', 'error');
    return;
  }

  // Update or add
  if (editingMedId) {
    data.medications = data.medications.map(m => m.id === editingMedId ? med : m);
    toast('Medication updated', 'success');
  } else {
    data.medications.push(med);
    toast('Medication added', 'success');
  }

  window.Storage.saveLocalData(data);
  closeMedForm();

  // Re-render
  renderMedications(data.medications);
  window.Dashboard.renderDashboard(data.medications, data.intakeLogs);
  window.Inventory.renderInventory(data.medications);

  // Sync
  try {
    await window.Storage.syncWithGist();
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

/**
 * Delete a medication
 */
function deleteMedication(medId) {
  if (!confirm('Delete this medication? This cannot be undone.')) return;

  const data = window.Storage.getLocalData();
  data.medications = data.medications.filter(m => m.id !== medId);
  window.Storage.saveLocalData(data);

  toast('Medication deleted', 'warning');
  renderMedications(data.medications);
  window.Dashboard.renderDashboard(data.medications, data.intakeLogs);
  window.Inventory.renderInventory(data.medications);

  // Sync
  window.Storage.syncWithGist().catch(err => console.error('Sync failed:', err));
}

/**
 * Close the medication form
 */
function closeMedForm() {
  document.getElementById('medFormContainer').classList.add('hidden');
  editingMedId = null;
}

/**
 * Generate a simple unique ID
 */
function generateId() {
  return 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get medications from local storage
 */
function getMedications() {
  return window.Storage.getLocalData().medications || [];
}

/**
 * Toast wrapper
 */
function toast(msg, type) {
  window.Notifications.toast(msg, type);
}

// Wire up form submission
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('medForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveMedication(e);
    });
  }

  // Cancel button
  const cancelBtn = document.getElementById('btnCancelMed');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeMedForm);
  }

  // Add time button
  const addTimeBtn = document.getElementById('btnAddTime');
  if (addTimeBtn) {
    addTimeBtn.addEventListener('click', () => addTimeInput('00:00', true));
  }

  // Every day checkbox
  const everyDayCheck = document.getElementById('everyDayCheck');
  if (everyDayCheck) {
    everyDayCheck.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('#scheduleDays input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = everyDayCheck.checked;
      });
    });
  }

  // Add medication button
  const addBtn = document.getElementById('btnAddMed');
  if (addBtn) {
    addBtn.addEventListener('click', () => openMedForm(null));
  }
});

// Export for use in other modules
window.Medications = {
  renderMedications,
  openMedForm,
  saveMedication,
  deleteMedication,
  closeMedForm,
  getMedications
};