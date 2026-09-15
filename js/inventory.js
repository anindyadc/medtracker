/**
 * inventory.js — Inventory tracking and reorder estimation
 */

/**
 * Render inventory view
 */
function renderInventory(medications) {
  const container = document.getElementById('inventoryContent');

  if (!medications || medications.length === 0) {
    container.innerHTML = '<p class="empty-state">No medications configured.</p>';
    return;
  }

  let html = '';

  medications.forEach(med => {
    const inv = med.inventory || {};
    const totalPills = inv.totalPills || 0;
    const remainingPills = inv.remainingPills || 0;
    const threshold = inv.refillThreshold || 5;
    const consumed = totalPills - remainingPills;

    // Calculate daily consumption
    const startDate = med.startDate || new Date().toISOString().split('T')[0];
    const daysSinceStart = Math.max(1, Math.ceil((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24)));
    const dailyConsumption = consumed / daysSinceStart;
    const daysUntilEmpty = dailyConsumption > 0 ? Math.ceil(remainingPills / dailyConsumption) : null;

    // Reorder status
    const isLow = remainingPills <= threshold;
    const isCritical = remainingPills === 0;
    const reorderIn = daysUntilEmpty !== null ? `Order ${Math.max(0, daysUntilEmpty)} days` : '—';
    const isLowRemaining = Math.max(0, daysUntilEmpty) <= 14;

    // Progress bar
    const percent = totalPills > 0 ? Math.round((remainingPills / totalPills) * 100) : 100;
    const progressClass = percent <= 20 ? 'danger' : percent <= 50 ? 'warning' : '';

    // Status class
    const statusClass = isCritical ? 'critical' : isLow ? 'low' : 'ok';
    const remainingText = isCritical ? '🚨 OUT OF STOCK' : isLow ? `⚠️ ${remainingPills} remaining` : `✅ ${remainingPills} remaining`;

    html += `
      <div class="inventory-card" data-med="${med.id}">
        <div class="inventory-info">
          <h4>${med.name} (${med.dosage})</h4>
          <div class="inventory-remaining ${statusClass}">${remainingText}</div>
          <div class="progress-bar">
            <div class="progress-bar-fill ${progressClass}" style="width: ${percent}%"></div>
          </div>
          <div style="font-size: 0.875rem; color: var(--color-secondary); margin-top: 0.25rem;">
            Total: ${totalPills} | Used: ${consumed} | ${reorderIn} until empty
          </div>
        </div>
        <div class="med-card-actions">
          <button class="btn btn-secondary btn-sm btn-refill" data-id="${med.id}" title="Refill">Refill</button>
          <button class="btn btn-danger btn-sm btn-remove" data-id="${med.id}" title="Remove">Remove</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Attach event listeners
  document.querySelectorAll('.btn-refill').forEach(btn => {
    btn.addEventListener('click', () => refillMedication(btn.dataset.id));
  });
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => removeMedication(btn.dataset.id));
  });
}

/**
 * Refill medication — increase remaining to total
 */
function refillMedication(medId) {
  const data = window.Storage.getLocalData();
  const med = data.medications.find(m => m.id === medId);
  if (!med) return;

  const prevRemaining = med.inventory.remainingPills;
  const total = med.inventory.totalPills || 30;

  med.inventory.remainingPills = total;
  med.inventory.totalPills = total; // Reset total for fresh count
  data.medications = data.medications.map(m => m.id === medId ? med : m);

  window.Storage.saveLocalData(data);
  window.Inventory.renderInventory(data.medications);

  toast(`${med.name} refilled to ${total} pills`, 'success');

  // Sync
  window.Storage.syncWithGist().catch(err => console.error('Sync failed:', err));
}

/**
 * Remove medication from inventory
 */
function removeMedication(medId) {
  if (!confirm('Remove this medication?')) return;
  window.Medications.deleteMedication(medId);
}

/**
 * Get reorder alert list
 */
function getReorderAlerts(medications) {
  return medications.filter(med => {
    const inv = med.inventory || {};
    return inv.remainingPills <= (inv.refillThreshold || 5);
  });
}

// Export for use in other modules
window.Inventory = {
  renderInventory,
  refillMedication,
  removeMedication,
  getReorderAlerts
};