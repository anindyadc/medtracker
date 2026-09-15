/**
 * auth.js — Authentication layer for app-level password protection
 * Uses SHA-256 hashing via SubtleCrypto (browser native)
 * Password hash stored ONLY in localStorage (never in Gist)
 */
const AUTH_PASSWORD_KEY = 'medtracker_auth_hash';
const AUTH_UNLOCKED_KEY = 'medtracker_unlocked';
const AUTH_SALT_KEY = 'medtracker_auth_salt';

/**
 * Generate a random salt (16 bytes hex)
 */
function generateSalt() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password with salt using SHA-256
 */
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a password unlocks the app
 */
async function verifyPassword(password) {
  const storedHash = localStorage.getItem(AUTH_PASSWORD_KEY);
  const salt = localStorage.getItem(AUTH_SALT_KEY);

  if (!storedHash || !salt) {
    // No password set — set this one as the password
    return setNewPassword(password);
  }

  const hash = await hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Set a new password (first-time setup)
 */
async function setNewPassword(password) {
  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  localStorage.setItem(AUTH_PASSWORD_KEY, hash);
  localStorage.setItem(AUTH_SALT_KEY, salt);
  localStorage.setItem(AUTH_UNLOCKED_KEY, 'true');

  return true;
}

/**
 * Check if app is unlocked (session persistence)
 */
function isUnlocked() {
  return localStorage.getItem(AUTH_UNLOCKED_KEY) === 'true';
}

/**
 * Unlock the app (for session persistence)
 */
function unlock() {
  localStorage.setItem(AUTH_UNLOCKED_KEY, 'true');
}

/**
 * Lock the app (logout)
 */
function lock() {
  localStorage.removeItem(AUTH_UNLOCKED_KEY);
}

/**
 * Change password
 */
async function changePassword(oldPassword, newPassword) {
  const storedHash = localStorage.getItem(AUTH_PASSWORD_KEY);
  const salt = localStorage.getItem(AUTH_SALT_KEY);

  if (!storedHash || !salt) {
    throw new Error('No password is set');
  }

  // Verify old password
  const oldHash = await hashPassword(oldPassword, salt);
  if (oldHash !== storedHash) {
    throw new Error('Current password is incorrect');
  }

  await setNewPassword(newPassword);
}

/**
 * Check if password is configured
 */
function hasPassword() {
  return !!localStorage.getItem(AUTH_PASSWORD_KEY);
}

/**
 * Remove password (disable auth)
 */
function removePassword() {
  localStorage.removeItem(AUTH_PASSWORD_KEY);
  localStorage.removeItem(AUTH_SALT_KEY);
  localStorage.removeItem(AUTH_UNLOCKED_KEY);
}

// Export for use in other modules
window.Auth = {
  verifyPassword,
  setNewPassword,
  isUnlocked,
  unlock,
  lock,
  changePassword,
  hasPassword,
  removePassword,
  hashPassword,
  generateSalt
};