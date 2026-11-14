# Task Tracker (web app)

Track time on tasks and write the daily report. The app runs in the browser and
keeps its data in the browser's IndexedDB on the device, so it needs no server.
The behaviour is described in [docs/SPEC.md](../docs/SPEC.md).

Live version: https://task-tracker-beta-dusky.vercel.app

## Requirements

- Node.js 22
- Run `npm install` in this folder once.

## Try it in a browser on your PC

```powershell
npm run dev
```

Open http://localhost:1420. Changes to the code reload the page as you save.

**Phone layout:** below 640 px wide the app switches to its phone layout
([SPEC 14](../docs/SPEC.md#14-phone-layout)). To see it on the PC:

1. Open DevTools (F12).
2. Turn on the device toolbar (Ctrl+Shift+M).
3. Pick a phone, for example iPhone SE or Pixel 7.

The device toolbar also emulates touch, so you can try tapping the timeline
and the sheets. Turn it off to get the desktop layout back.

**Your data:** tasks are saved in the browser, separately for each address.
`localhost:1420` and `localhost:4173` (below) each have their own data, and
neither shares data with the live site.
- **Start from an empty list:** DevTools → **Application** → **Storage** →
  **Clear site data**.
- **Move data between them:** use **Backup** to export a JSON file in one and
  import it in the other.

**Sample data:** to try every screen with made-up tasks and work history:

```powershell
cd ../backend
npm install
npm run sample:json
```

This writes `backend/sample.json` (ignored by git). Import it with **Backup →
Import backup…**. Importing replaces everything in that browser's data.

## Try the installable, offline app

The service worker that makes the app installable and usable offline only
exists in a production build:

```powershell
npm run build
npm run preview
```

Open http://localhost:4173.
- **Install:** Chrome or Edge offers **Install** in the address bar.
- **Offline:** DevTools → **Network** → **Offline**, then reload. The app
  still opens and saves tasks.
- **Inspect:** DevTools → **Application** → **Service workers** and
  **Manifest** show what was registered.

After a new build, reload twice (or close and reopen the tab) to get the new
version, since the old service worker serves the first load.

## Try it on your phone over Wi-Fi

To open the dev server from a phone on the same network:

```powershell
npm run dev -- --host
```

Vite prints a `Network:` address, for example `http://192.168.1.20:1420`. Open
it on the phone. Windows may ask to allow Node.js through the firewall.

Over plain `http://` on a network address, browsers don't run the service
worker, so you can't install the app this way. To install it, use the live
version.

## Tests

| Command | What it checks |
| --- | --- |
| `npm test` | Unit tests (Vitest): the task rules, the on-device store, backup |
| `npm run test:e2e` | Browser tests (Playwright); see below |
| `npm run lint` | ESLint |
| `npm run build` | Type check and production build |

The browser tests start their own servers on ports 1430 and 1431, so a running
`npm run dev` is not touched. Each test starts with an empty database. There
are three projects:

- `chromium`: the desktop layout
- `phone`: the phone layout at iPhone SE size, with touch
- `pwa`: the built app with its service worker, at Pixel 7 size

Useful variants:

```powershell
npx playwright install chromium          # once, to download the browser
npx playwright test --project=phone      # one project
npx playwright test -g "daily report"    # tests whose name matches
npx playwright test --ui                 # watch them run, step by step
npx playwright show-trace test-results/<test>/trace.zip   # after a failure
```

## Deploy

Vercel builds this folder (`vercel.json`) from the GitHub repository. A
manual production deploy runs from the repository root:

```powershell
vercel deploy --prod
```

## Desktop app

The Tauri desktop app (`src-tauri/`) uses the same screens with a local
SQLite file instead of the browser's storage. See
[SPEC 10](../docs/SPEC.md#10-backend-interface).
