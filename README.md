# MedTracker 💊

A medicine intake tracker for caregivers — track your mother's medication schedule, inventory, and get reorder alerts. Hosted on GitHub Pages with GitHub Gist sync.

## Features

- **Medication scheduling**: Complex schedules (multiple times per day, specific days of week)
- **Intake tracking**: Mark pills as taken/missed with one tap
- **Missed dose detection**: Automatically flags doses not taken within 2-hour grace period
- **Inventory management**: Track remaining pills, set refill thresholds
- **Reorder estimation**: Calculate days until empty based on actual usage
- **Browser notifications**: Pill reminders at scheduled times
- **GitHub Gist sync**: Data stored in your private Gist, synced across devices
- **Offline-first**: Works offline, syncs when back online
- **PWA ready**: Install as app on mobile

## Quick Start

### 1. Deploy to GitHub Pages

1. Fork or clone this repo
2. Go to Settings → Pages → Source: "GitHub Actions"
3. Push to `main` branch — GitHub Actions will deploy automatically

### 2. Set up GitHub Gist sync (optional but recommended)

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens/new?scopes=gist) with `gist` scope
2. Open the deployed site
3. Go to **Settings** tab
4. Paste your token in "Personal Access Token"
5. Click **Connect / Save** — it will create a new private Gist automatically

### 3. Add medications

1. Go to **Medications** tab
2. Click **Add Medication**
3. Fill in name, dosage, schedule times, days, and inventory
4. Save

### 4. Enable notifications

1. Go to **Settings** tab
2. Check "Enable browser notifications"
3. Click "Allow" when browser prompts

## Usage

### Dashboard
See today's schedule, missed doses, and reorder alerts at a glance. Tap the pill button to mark doses taken.

### Medications
Add, edit, delete medications with complex schedules.

### Inventory
See remaining pills, progress bars, and when to reorder. Click "Refill" after getting a new prescription.

### Settings
- GitHub Gist token management
- Notification preferences
- Export/import data as JSON

## Data Storage

All data is stored in a GitHub Gist named `medtracker.json`:
- Your GitHub token is stored **only in localStorage** (never uploaded)
- Data syncs automatically on load, save, and every 5 minutes
- Works offline — changes sync when back online

## Project Structure

```
├── index.html          # Main HTML
├── css/styles.css      # All styling
├── js/
│   ├── app.js          # Main controller
│   ├── storage.js      # localStorage + Gist API
│   ├── dashboard.js    # Dashboard rendering
│   ├── medications.js  # Medication CRUD
│   ├── intake.js       # Intake logging
│   ├── inventory.js    # Inventory & reorder logic
│   ├── notifications.js # Browser notifications
│   └── scheduler.js    # Time/scheduling logic
├── manifest.json       # PWA manifest
└── .github/workflows/  # GitHub Pages deploy
```

## Customization

### Change grace period
Edit `missedDoseGracePeriodMs` in medication object (default: 7200000 = 2 hours)

### Change reminder lead time
In Settings tab, set "Reminder lead time" (default: 15 minutes)

### Styling
Edit `css/styles.css` — uses CSS custom properties for easy theming

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires localStorage and Notification API
- PWA features need HTTPS (GitHub Pages provides this)

## License

MIT — free for personal use# medtracker
