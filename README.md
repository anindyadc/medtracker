# MedTracker 💊

A medicine intake tracker for caregivers — track your mother's medication schedule, inventory, and get reorder alerts. Hosted on GitHub Pages with GitHub Gist sync.

## Features

- **🔐 App Lock** — Password-protected with SHA-256 hashing. Your data stays private even if the page is shared.
- **Medication scheduling** — Complex schedules (multiple times per day, specific days of week)
- **Intake tracking** — Mark pills as taken/missed with one tap
- **Missed dose detection** — Automatically flags doses not taken within 2-hour grace period
- **Inventory management** — Track remaining pills, set refill thresholds, adjust with notes
- **Reorder estimation** — Calculate days until empty based on actual usage
- **Browser notifications** — Pill reminders at scheduled times
- **GitHub Gist sync** — Data stored in your private Gist, synced across devices
- **Offline-first** — Works offline, syncs when back online
- **PWA ready** — Install as app on mobile
- **Dark mode** — Light/dark theme with system preference

## Quick Start

### 1. Deploy to GitHub Pages

1. Fork or clone this repo
2. Go to Settings → Pages → Source: "GitHub Actions"
3. Push to `main` branch — GitHub Actions will deploy automatically

### 2. First Run — Set Up Password

When you first open the app, you'll see a login screen.

- **Default password:** `medtracker`
- **Change it immediately** — click "Change Password" in the login screen
- The password is hashed with SHA-256 and stored **only in your browser's localStorage** (never in the Gist)

### 3. Add Medications

1. Go to **Medications** tab
2. Click **Add Medication**
3. Fill in name, dosage, schedule times, days of week, and inventory
4. Save

### 4. Enable Notifications

1. Go to **Settings** tab
2. Check "Enable browser notifications"
3. Click "Allow" when browser prompts

## Usage

### 🔐 App Lock
- **First run:** Default password is `medtracker` — change it immediately
- **Lock app:** Click 🔒 in the top-right header
- **Change password:** Click "Change Password" in the login screen or Settings
- **Session persistence:** The app stays unlocked until you manually lock it or clear your browser data

### 📊 Dashboard
See today's schedule, missed doses, and reorder alerts at a glance. Tap the pill button to mark doses taken.

- Summary cards show total medications, doses today, taken count, missed count, and reorder alerts
- Missed doses show in a red alert box
- Reorder alerts show in a critical alert box

### 💊 Medications
Add, edit, delete medications with complex schedules.

- **Schedule times:** Add multiple times per day (e.g., 08:00, 20:00)
- **Days of week:** Select specific days or check "Every day"
- **Inventory:** Set total pills, remaining pills, and refill threshold

### 📦 Inventory
Track medication stock levels and reorder dates.

- **Inventory summary:** Total medications, total pills remaining, reorder count
- **Adjust inventory:** Click any medication card to manually update remaining pills (e.g., after a refill)
- **Batch refill:** Refill all medications at once
- **Progress bars:** Visual indicator of remaining stock (green → yellow → red)

### ⚙️ Settings
- **Account security:** Change password, lock app
- **Theme:** Toggle light/dark mode (or follow system preference)
- **GitHub Gist sync:** Configure token and Gist ID
- **Notifications:** Enable/disable, set reminder lead time
- **Data:** Export/import JSON backup

## Data Storage

All data is stored in a GitHub Gist named `medtracker.json`:
- Your GitHub token is stored **only in localStorage** (never uploaded to Gist)
- Your password hash is stored **only in localStorage** (never in the Gist)
- Data syncs automatically on load, save, and every 5 minutes
- Works offline — changes sync when back online

## Project Structure

```
├── index.html              # Main HTML
├── css/styles.css          # All styling (modernized, responsive, dark mode)
├── js/
│   ├── app.js              # Main controller (auth, routing, sync, theme)
│   ├── auth.js             # Password hashing and authentication
│   ├── storage.js          # localStorage + Gist API
│   ├── dashboard.js        # Dashboard rendering
│   ├── medications.js      # Medication CRUD
│   ├── intake.js           # Intake logging
│   ├── inventory.js        # Inventory & reorder logic
│   ├── notifications.js    # Browser notifications
│   └── scheduler.js        # Time/scheduling logic
├── manifest.json           # PWA manifest
└── .github/workflows/      # GitHub Pages deploy
```

## Customization

### Change grace period
Edit `missedDoseGracePeriodMs` in medication object (default: 7200000 = 2 hours)

### Change reminder lead time
In Settings tab, set "Reminder lead time" (default: 15 minutes)

### Change theme
In Settings tab, click "Toggle" to cycle light/dark/system

### Styling
Edit `css/styles.css` — uses CSS custom properties for easy theming

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires localStorage and Notification API
- PWA features need HTTPS (GitHub Pages provides this)

## License

MIT — free for personal use