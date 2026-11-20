# Task Tracker spec

What the app does and the rules it follows.

## 1. Overview

A single-user time tracker. You keep an ordered list of tasks, start and pause
a timer on one task at a time, and copy a daily work report into an email.

The same UI (React + Vite, `frontend/src/`) runs in two ways.
`frontend/src/api/tasks.ts` picks the right one at runtime with `isTauri()`.

**Desktop app**, built with [Tauri](https://tauri.app) v2 (`npm run tauri dev`
in `frontend/`):

- **UI:** shown in the system webview (WebView2 on Windows).
- **Core:** Rust (`frontend/src-tauri/`). The task rules run as Tauri commands
  that the UI calls with `invoke` (10.1); there is no HTTP server or port.
- **Data:** SQLite (compiled into the app), in `tasks.db` in the app data
  folder: `%APPDATA%\com.hy.tasktracker\` on Windows. Every command runs in a
  transaction.

**Browser version** (`npm run dev` in `frontend/`):

- **UI:** served by Vite on `http://localhost:1420`.
- **Core:** TypeScript (`frontend/src/core/`), running in the page; no server.
- **Data:** IndexedDB, in the browser's storage on this device (10.2). Each
  browser, and each device, has its own data.
- **Online:** deployed to Vercel as a static site
  (https://task-tracker-beta-dusky.vercel.app), installable on a phone and
  usable offline (13).

Both cores apply the same rules (11). The desktop app's `tasks.db` gets
missing columns added when it is opened (4.6). The Express backend in
`backend/` is no longer used by the UI.

## 2. Task

| Field          | Type                 | Notes                                                        |
|----------------|----------------------|--------------------------------------------------------------|
| `id`           | integer              | Assigned by the database.                                    |
| `title`        | string               | Required. The add form ignores blank titles; the backends and the edit form don't check. |
| `totalSeconds` | integer              | Time tracked so far, shown as **Consumed Time**. Default `0`. |
| `isRunning`    | boolean              | `true` while the timer is running. Default `false`.          |
| `lastStart`    | epoch ms or `null`   | When the timer last started or was last brought up to date.  |
| `position`     | integer              | Order in the list, starting at `0`.                          |
| `priority`     | [Priority](#3-priority) | Default `Normal`.                                         |
| `status`       | [Status](#4-status)  | Default `Todo`.                                              |
| `statusNote`   | string or `null`     | Optional short note shown after the status, e.g. "Waiting for Kiro". |
| `startedAt`    | epoch ms or `null`   | Set once, the first time the task leaves `Todo` (timer start or status change), unless a start date was picked in the edit form (4.5), which always wins. |
| `lastWorkedAt` | epoch ms or `null`   | Last time work was recorded: time tracked, consumed time edited, or status changed. Title, priority, note, ETA, due date and order changes don't count. |
| `etaHours`     | integer or `null`    | **ETA**: the estimated hours to finish the task, a whole number from 1 to 2000, set in the edit form. Default `null` (none). Shown in the app and in the report (8.2). |
| `dueAt`        | epoch ms or `null`   | **Due date**: local midnight of the day the task is due by (it is due until the end of that day), set in the edit form. Default `null` (none). |

A new database starts with one task, "First task of the day".

## 3. Priority

Values, highest first: `Highest`, `High`, `Normal`, `Low`. Default `Normal`.

Priority only affects how a task looks: each value has its own background and
left-border color. It doesn't change ordering or the timer. `In progress`,
`Pending` and `Done` tasks show their status color instead (see 4.5), so the
priority color only shows on `Todo` and `Canceled` tasks.

## 4. Status

### 4.1 Values

| Value         | Meaning                                    |
|---------------|--------------------------------------------|
| `Todo`        | Not started yet. Default for new tasks.    |
| `In progress` | Being worked on. The timer may or may not be running. |
| `Pending`     | Blocked or waiting on something; the note says what. |
| `Done`        | Finished.                                  |
| `Canceled`    | Dropped and won't be finished.             |

The API and the database store these exact strings, the same way they store
priority.

### 4.2 Rule that always holds

**A running task is always `In progress`.** In other words, if `isRunning` is
`true`, then `status` is `In progress`. Every rule below keeps this true.

### 4.3 Timer and status

| Action                                   | Status before            | Result                                                         |
|------------------------------------------|--------------------------|----------------------------------------------------------------|
| Start timer                              | `Todo`                   | Timer starts, status becomes `In progress`.                    |
| Start timer                              | `In progress`            | Timer starts, status unchanged.                                |
| Start timer                              | `Pending`, `Done` or `Canceled` | Rejected (`toggle_task` fails, HTTP `409`); the play button is disabled. |
| Pause timer                              | `In progress`            | Timer stops, status stays `In progress`.                       |
| Start another task while this one runs   | `In progress`            | This task's timer stops (time added), status stays `In progress`. |
| Open the edit form while this one runs   | `In progress`            | Timer stops (time added) before the form opens, status stays `In progress`. See 5. |

### 4.4 Changing status by hand

The user can set any status from any status.

| New status                | Task running? | Result                                                              |
|---------------------------|---------------|---------------------------------------------------------------------|
| `Pending`, `Done` or `Canceled` | yes     | Elapsed time is added to `totalSeconds` first, then the timer stops. |
| `Todo`                    | yes           | Same: time added, timer stops (a running task can't be `Todo`).     |
| `In progress`             | any           | Status changes, timer left as it is.                                |
| Any                       | no            | Status changes, nothing else.                                       |

Reopening a `Pending`, `Done` or `Canceled` task (setting it back to `Todo` or
`In progress`) keeps its `totalSeconds`. The timer stays stopped until started.

The status note is independent of the status: it stays when the status changes
and is only changed or cleared from the edit form.

### 4.5 Display

- Some statuses have their own row color, which replaces the priority color:
  - `In progress`: light blue. The running task also pulses (the glow).
  - `Pending`: amber.
  - `Done`: green, stronger than the `Normal` priority green.
  - `Todo` and `Canceled` keep the priority color.
- The page grows with the window up to 1280 px wide, so long titles stay on
  one line where they fit; longer ones wrap. From 768 px up, consumed time,
  priority, ETA, start date, due date and status sit on one line under the
  title; below that they stack.
- Each task shows a Status dropdown after the priority, followed by the note
  in brackets when there is one. Picking a value saves it right away, with the
  rules in 4.4; no need to open the edit form.
- The edit form has a Status dropdown and a Status note field, after Priority,
  then a **Start date** picker. It shows the task's start date, or today if
  it has none, and can't go past today. A picked date is saved as local
  midnight of that day; picking one isn't work (`lastWorkedAt` and the status
  stay as they are). If the picker isn't touched, nothing is saved, so a
  `Todo` task still gets its start date when it really starts.
- A task with a start date shows **Started: 06 Nov** after its priority.
- A task with an ETA shows **ETA: 8 h**, and one with a due date **Due: 25 Nov**.
- After the start date picker come **ETA (hours to finish)**, a whole number,
  and a **Due date** picker (any date, past ones too). Each is saved only if
  it was changed; emptying a field clears it. An ETA that isn't a whole number
  from 1 to 2000 is saved as none.
- Under the details, the time to the due date (4.7).
- The play button is disabled for `Pending`, `Done` and `Canceled` tasks.

### 4.6 Existing data

When the app or the Express backend starts, it adds any missing column and
fills it in:

| Column         | Filled with                                                    |
|----------------|----------------------------------------------------------------|
| `status`       | `In progress` for rows with `isRunning = 1`, otherwise `Todo`. |
| `statusNote`   | `null`.                                                        |
| `startedAt`    | `lastStart`, the only date older rows have. `null` if never started. |
| `lastWorkedAt` | `lastStart`, same reason.                                      |

### 4.7 Time to the due date

A task with a due date shows how far it is from it
(`utils/dueProgress.ts`, `components/DueProgressBar.tsx`):

- **Started tasks** (with a start date) get a bar that fills from the start
  of the start date to the end of the due date, and the days left by the
  calendar: `6 days left`, `1 day left`, `Due today`, `Overdue by 2 days`.
  It is green, amber from 75% of the time used or on the due date, and red
  and full once the due date has passed.
- **Tasks not started yet** show only the days, as `Due in 3 days`,
  `Due today` or `Overdue by 1 day`, with no bar.
- **Done and Canceled tasks** show no progress; the due date no longer
  matters.
- It refreshes every minute.

## 5. Timer

- **At most one task runs at a time.** Starting a task stops whichever task is
  running.
- **The core keeps the time** (the Rust core, or the TypeScript core in the
  browser). On every read, toggle and status change it adds the whole seconds
  elapsed since `lastStart` to `totalSeconds`, moves `lastStart` forward by
  exactly those seconds (so the leftover fraction counts next time instead of
  being lost), and sets `lastWorkedAt` to now. Nothing is counted in memory, so
  time keeps adding up while the app or browser is closed.
- **The UI reads the tasks every second** to show the time going up.
- **Editing pauses the task.** Opening the edit form on a running task pauses
  it first, so the form shows the up-to-date time and nothing is counted while
  editing. Saving doesn't restart the timer; press play to resume.
- **Editing time:** the edit form takes the time in the chosen format (5.1).
  Saving sets `totalSeconds` to that value, which drops any seconds (`HH:mm`)
  or rounds to the second (decimal). If the time field wasn't changed, saving
  leaves `totalSeconds` as it is, seconds included.

### 5.1 Time format

A switch above the list, **hh:mm** / **Decimal**, picks how times are shown
and typed. Default `hh:mm`. The choice is saved in `localStorage` and comes
back next time.

| Where                        | hh:mm      | Decimal                      |
|------------------------------|------------|------------------------------|
| Task's Consumed Time, Consumed Time (All Tasks) | `01:30:00` (seconds kept, so a running timer visibly ticks) | `1.5 h` (hours, at most 2 decimals) |
| Edit form's Consumed Time field | `01:30`    | `1.5`; a comma works as the decimal point |

The daily report (ETA in whole hours, total consumed in quarter hours) doesn't change with the switch.

## 6. List order

Tasks are shown by `position`, whatever their status: `Pending`, `Done` and
`Canceled` tasks keep their place in the main list. New tasks go to the bottom.
Dragging a task saves the new order for the whole list right away.

### 6.1 Adding a task

- **Suggestions:** from the second character typed, the title field lists up
  to 6 existing tasks with a similar title, each with its status and start
  date. Best first: same title, title starting with what was typed, title
  containing it, then titles a few typos away (1 edit per 5 characters, at
  least 1). Case and extra spaces are ignored, and each title is listed once
  (the task started earliest). Arrow keys move through the list, Enter or a
  click picks one, Escape closes it.
- **Reusing a start date:** when the title matches an existing task exactly
  (ignoring case and spaces) and that task has a start date, a checkbox under
  the field offers to give the new task the same start date. If several tasks
  match, the earliest start date is offered. Picking a suggestion ticks the
  box; typing the title by hand leaves it unticked. The new task is still
  `Todo`.
- Only tasks in the list are matched; deleted tasks aren't suggested.

## 7. Totals

- **Consumed Time (All Tasks)** is the sum of `totalSeconds` for every task in
  the list, whatever its status (`Done` and `Canceled` included), shown in the
  chosen time format (5.1).

## 8. Daily report

The mail button next to the total opens the **Daily report** dialog (on a phone,
**Report** in the bottom bar opens it as a full-screen page, 14.1). It builds an
email body for today and copies it to the clipboard, formatted, so it can be
pasted into Gmail or Outlook.

### 8.1 Which tasks

A task is in the report if any of these is true, in list order:

- its `lastWorkedAt` is today (local time), or
- its status is `In progress` or `Pending`, whatever the date.

So untouched `Todo` tasks, and tasks finished or canceled on an earlier day,
are left out.

### 8.2 Layout

```
<greeting>
<intro, with {date} replaced by e.g. "06 Nov">

1. Task in Review/Task in Progress
   o Task #<n>: <title>
      ▪ Status : <status> (<note>)
      ▪ Start date : <startedAt as "06 Nov", or "-">
      ▪ ETA : <etaHours> hour, or "-"
2. Next Planned tasks
   o <line>
      ▪ <line starting with "-">
3. Issue/Concerns/Blocks
   <text>

<signature>
```

- Tasks are numbered from 1 in the report, not by list position. A task
  whose title starts with a ticket id (8.5) is headed by that id instead:
  `Task #ABC-12: <rest of the title>`.
- **Status** labels match the app, except `In progress`, shown as
  `InProgress`, and `Canceled`, shown as `CANCELLED`. The label has a
  background highlight: `Done` bright green, `InProgress` yellow, `Pending`
  orange, `CANCELLED` pink. `Todo` has none.
- **ETA** is the task's estimate, in whole hours. The layout above is fixed:
  the due date and the consumed (tracked) time are not in the report.
- An empty section shows `None`.

### 8.3 Email text

The dialog has fields for greeting, intro, next planned tasks, issues,
signature and ticket links (8.5), with a live preview. Above them it shows **Total consumed (rounded)**:
the consumed time of the report's tasks, each rounded to the nearest quarter
hour (any time under 7.5 minutes counts as `0.25`). It is shown in the dialog only, not copied.

Next planned tasks takes one item per line; a line starting with `-` becomes a
sub-item of the line above. The fields are saved in `localStorage` (the
webview's or the browser's) and come back filled in next time.

When the dialog opens, a weekday heading on the first line of next planned
tasks (any weekday name followed by `:`, e.g. the default `Monday:`) is set to
the next weekday after today: Monday to Thursday give the next day; Friday,
Saturday and Sunday give Monday. Other text, and weekday names anywhere else,
are left as typed.

### 8.4 Copy

**Copy report** puts two versions on the clipboard: HTML with inline styles
(lists and highlights survive pasting into email) and plain text, for places
that only accept text.

### 8.5 Ticket links

**Ticket links** defines ticket ids (for example Jira keys) and where they
link to, one rule per line: the id prefix, a space, then an `http`/`https`
URL containing `{id}` (the whole id, e.g. `ABC-12`) and/or `{num}` (its
digits, e.g. `12`):

```
ABC- https://yourcompany.atlassian.net/browse/{id}
#    https://redmine.example.com/issues/{num}
```

- An id is the prefix followed by digits, matched without regard to case,
  and not part of a longer word or number (`XABC-1` doesn't match; `ABC-1234`
  matches whole). When prefixes overlap, the longer one wins.
- Every id anywhere in the email (task titles and status notes, greeting,
  intro, next planned tasks, issues, signature) is shown with `#` before it:
  `MAIL-1234` becomes `#MAIL-1234`. A `#` already typed before the id is
  kept, not doubled. In the HTML version the `#` and id together are the
  link; the plain-text version shows them without a link.
- A task title starting with an id, optionally followed by `:` or `-`, is
  headed by that id (8.2).
- Lines that aren't a valid rule are listed under the field and ignored.
  Saved with the other fields. Empty by default: no links.
- Links in the preview don't open, so the app isn't navigated away.

## 9. Statistics

The **Statistics** button (chart icon, top right of the main screen) opens a
separate screen; the arrow at its top left goes back. It shows one day at a
time, today by default.

### 9.1 Work history

Both backends record, in the same database:

- **Work sessions:** one row per stretch of the timer running on one task,
  from start to stop. Every way a timer stops ends its session: pause,
  starting another task, opening the edit form, a status change that stops it
  (4.4), and deleting the task. A session still running has no end yet.
- **Task events:** a status change (any status, including the automatic
  `Todo` → `In progress` on start), or an **adjustment**: a total time typed in
  the edit form, stored as the total before and after.

Each row keeps the task's id and its title at that moment, and nothing is
removed when a task is deleted, so its history stays in the statistics. History
starts when this version is first run; earlier days have none.

### 9.2 The day

All times are local. A session that crosses midnight is split there.

| Figure        | Meaning                                                          |
|---------------|------------------------------------------------------------------|
| **Work**      | Tracked time plus that day's adjustments, never below 0. Tracked time is the sessions' time, plus gaps between sessions shorter than 2 minutes. |
| **Break**     | Gaps of 2 minutes or more between one session's end and the next one's start, counting only the part inside working hours and outside lunch (9.4). Time before the first start and after the last stop doesn't count. |
| **Day span**  | First start to last stop (or now, if a session is running).      |
| **Adjustments** | Sum of that day's adjustments (after − before), signed.        |

- **Timeline bar:** from the hour before the first start to the hour after
  the last stop. One bar per session, coloured by task (the first 8 tasks of
  the day get their own colour, the rest share grey). Hovering a bar shows
  the task, its times and its length. On a phone, a tap anywhere on the
  track shows the nearest session (a short one is too thin to hit), and a
  tap elsewhere hides it.
- **By task:** each task worked on that day with tracked time, adjustments
  and total, largest first. On a phone only the task and total are shown. Deleted tasks are marked "(deleted)" and keep
  their last known title; other tasks show their current title.
- **Timeline list:** in time order, "Started", "Paused … after", "Break of …,
  until …", status changes ("… → Done") and adjustments ("Adjusted … by
  +00:15:00 (01:25:00 → 01:40:00)"). At the same minute, a stop comes first,
  then the status change that caused it, then the break, then the next start.
- Durations follow the time format switch (5.1) and are rounded down to whole
  seconds, like the timer. While today is shown, the screen re-reads the
  history every 5 seconds.

### 9.3 Calendar

A month grid, weeks starting on Monday, next to the day (above it on narrow
screens). Days with tracked work or an adjustment have a dot; today is
outlined; the chosen day is filled. Days after today, and months after this
one, can't be picked.

### 9.4 Workday hours

The **Workday hours** button (clock icon, top right of the Statistics screen,
showing the current start–end) opens a dialog with four times: workday start,
lunch start, lunch end and workday end. Defaults: 08:30, 12:00, 13:30, 18:00.

- Only the part of a gap between 08:30 and 12:00 or between 13:30 and 18:00
  (with the defaults) is a break. A gap from 11:30 to 14:00 is a 1-hour break;
  a gap that is exactly lunch, or entirely outside working hours, isn't listed.
- The 2-minute minimum (9.2) applies to the whole gap, before this cut.
- The workday must end after it starts, and lunch must be inside it. Lunch
  start equal to lunch end means no lunch. Save is disabled while the times
  are invalid; **Reset to defaults** fills in the defaults.
- Saved in `localStorage`; unreadable or invalid saved values fall back to
  the defaults. Work time isn't affected, only breaks.

### 9.5 Task history

Clicking a task's name in **By task** opens its work history: every day that
task has a session, status change or adjustment, from the first to the last,
oldest first. It loads the whole history once when it opens (`get_activity`
from 0 to now) and keeps that task's rows; a running session counts up to that
moment.

- **Summary:** total (tracked plus all adjustments, never below 0), days
  worked, the day it began, and **Finished** / **Canceled** with the day, if
  its latest status is `Done` / `Canceled`; otherwise **Last worked**. If
  there are adjustments, the tracked time and the signed adjustment total are
  shown below.
- **Each day:** its date and total, then in time order each session
  ("09:00–10:30 Worked 01:30:00", "… –now" and "· running" while it runs),
  status changes ("→ Done") and adjustments. A session that crosses midnight
  is split there. At the same minute a status change comes before the session
  that starts then.
- Clicking a day's date closes the dialog and shows that day.
- Deleted tasks are marked "(deleted)". Durations follow the time format
  switch (5.1). Work hours (9.4) don't apply: every running minute counts.

## 10. Backend interface

The UI goes through `frontend/src/api/tasks.ts`, which uses 10.1 in the
desktop app and 10.2 in a browser. Either way, a failed call rejects with the
error message.

### 10.1 Tauri commands

Rust commands in `frontend/src-tauri/src/lib.rs`. Arguments are camelCase in
TypeScript.

| Command         | Arguments                                   | Returns / errors            |
|-----------------|---------------------------------------------|-----------------------------|
| `get_tasks`     | none                                        | All tasks, by `position`.   |
| `create_task`   | `{ title, priority?, startedAt? }`          | The created task, as `Todo` (priority defaults to `Normal`). `startedAt` reuses an earlier start date (6.1); fails with "startedAt must be a date (epoch ms)" if negative. |
| `update_task`   | `{ id, changes: { title?, totalSeconds?, priority?, status?, statusNote?, startedAt? } }` (the desktop app doesn't store ETA or due date yet); fields left out or `null` keep their value, an empty `statusNote` clears it | Nothing. Fails with "status must be one of: …", "startedAt must be a date (epoch ms)" for a negative `startedAt`, or "Task not found". Applies 4.4. |
| `toggle_task`   | `{ id }`                                    | All tasks, by `position`. Fails with "Task not found", or "Cannot start a `<status>` task" for `Pending`, `Done` and `Canceled`. Applies 4.3. |
| `reorder_tasks` | `{ ids }`, the full new order               | Nothing.                    |
| `delete_task`   | `{ id }`                                    | Nothing.                    |
| `save_file`     | `{ defaultName, contents }` (bytes)         | Shows a save dialog and writes the file. The chosen path, or `null` if cancelled. |
| `get_activity`  | `{ from, to }` (epoch ms)                   | `{ sessions, events }` (9.1): sessions that overlap `[from, to)` and events inside it, oldest first. |

### 10.2 On-device store

`frontend/src/core/idbStore.ts`: the same calls as 10.1, with the same
results and error messages, run by the TypeScript rules in
`core/tasks.ts` and `core/activity.ts`. The current time is passed in by
`api/tasks.ts`.

- **Database:** IndexedDB `task-tracker`, version 1, with three stores:
  `tasks`, `sessions` (indexed by `startedAt`, and by `open` while a session
  runs) and `events` (indexed by `at`). Ids are assigned by the stores. A new
  database starts with one task, "First task of the day".
- **Transactions:** every call reads all tasks and the open sessions, runs
  the rule, and saves its changes in one read-write transaction. A refused
  call saves nothing. Calls from several tabs run one after another, so
  running time is never added twice.

The browser has no save dialog; exports are downloaded instead of using
`save_file`.

### 10.3 Backup

Browser only (the desktop app keeps `tasks.db`). The **Backup** button next
to Statistics opens a dialog to export and import all data as one JSON file
(`core/backup.ts`, `api/backup.ts`, `components/BackupDialog.tsx`).

- **File:** `task-tracker-backup-YYYY-MM-DD.json`:
  `{ format: "task-tracker-backup", version: 1, exportedAt, tasks, sessions,
  events, settings }`. Rows are as stored, with their ids; a running task
  keeps `isRunning` and `lastStart`, so after an import its time counts on
  from where it was. `settings` holds the localStorage values `timeFormat`,
  `dailyReportSettings` and `workday`, as text.
- **Export** downloads the file and remembers when, in localStorage
  `lastBackupAt`.
- **Import** checks the whole file first and names the first problem (not
  JSON, not a backup, newer version, a field of the wrong type, a repeated id,
  more than one running task, a session ending before it starts). Missing
  optional fields are read as not set, and `0`/`1` as booleans, as in
  `tasks.db`. It then asks before replacing everything (tasks, history and
  those settings) in one transaction, and reloads the page.
- **Reminder:** an amber dot on the Backup button while there is work (a task
  with time or a start date) and no export in the last 7 days.
- **From a database:** `npm run export:json -- <db> <out.json>` in `backend/`
  writes this format from any `tasks.db` (Express, desktop app, or older
  schemas, filled in as in 4.6). `npm run sample:json` writes the sample
  data as `backend/sample.json`.

## 11. Tests

- **Rust core:** `cargo test` in `frontend/src-tauri/`.
- **Unit tests:** `npm test` in `frontend/` runs Vitest on `src/**/*.test.ts`
  (day statistics, task history, title matching, the report's next
  weekday and ticket links).
- **TypeScript core:** `core/tasks.test.ts` runs the task rules against the
  in-memory store and the IndexedDB store (`fake-indexeddb`). Its tests are
  ported from the Rust core's, so both keep the same rules; change both
  together.
- **Browser version:** `npm run test:e2e` in `frontend/` runs the Playwright
  tests in `frontend/e2e/` in Chromium. They start their own Vite (port
  1430), so a running dev server is not touched. Each test gets a new
  browser context, and so a new, empty database. The `pwa` project runs
  `e2e/pwa.spec.ts` on a phone-sized screen against the built app on
  `vite preview` (port 1431), since the service worker only exists in a
  build (13). The `phone` project runs `e2e/mobile.spec.ts` at iPhone SE
  size with touch (14).

## 12. Decisions

- `Pending`, `Done` and `Canceled` tasks stay in the main list, in their position.
- There is no Excel export; the daily report replaced it.
- Consumed Time (All Tasks) includes `Canceled` tasks.
- `Pending` tasks can't be started; set them back to `In progress` first.
- ETA is an estimate typed by hand, in whole hours. The report keeps its
  layout (status, start date, ETA); the due date and consumed time stay in the
  app, and the report dialog totals the consumed time, outside the email.
- The progress bar measures time to the due date, not consumed time against
  the ETA.
- Deleted tasks keep their history in the statistics.
- A total time typed by hand is recorded as an adjustment and counts toward
  that day's work.
- Gaps under 2 minutes between sessions count as work, not breaks.
- Breaks only count inside working hours and outside lunch.
- Similar titles are offered as suggestions while typing; the user decides.
- The Statistics button replaced the old global pause button, which only
  paused screen updates.

## 13. Installable web app

The browser version is a PWA, made with `vite-plugin-pwa`
(`frontend/vite.config.ts`). Not in the desktop app: `src/main.tsx` skips
the service worker there, since its files ship with the app.

- **Install:** Android Chrome: menu, **Install app**. iPhone: Safari,
  **Share**, **Add to Home Screen**. Desktop Chrome or Edge: the install icon
  in the address bar. It opens full screen as "Tasks", with the stopwatch
  icon.
- **Manifest:** name "Task Tracker", short name "Tasks", `display:
  standalone`, start and scope `/`, theme `#4f46e5`, background `#f1f5f9`.
- **Icons:** made from `public/logo.svg` by `npm run icons`
  (`pwa-assets.config.ts`): 64, 192 and 512 px, a 512 px maskable icon and a
  180 px Apple icon, both on a solid background, and `favicon.ico`.
- **Offline:** the service worker precaches the built app, so it opens with
  no connection; the data is on the device anyway (10.2). A new version
  installs in the background and is used from the next visit.
- **Keeping the data:** at startup the app asks the browser to keep its
  storage (`navigator.storage.persist()`). The Backup dialog shows the answer:
  kept, may be cleared, or unknown. Safari deletes the data of a site unused
  for 7 days unless it is added to the home screen, and an installed iPhone
  app has storage separate from Safari's: move data across with a backup
  (10.3).

## 14. Phone layout

Below 640 px wide (Tailwind `sm`), down to 375 px, the app switches to a
layout of its own, with nothing scrolling sideways. Wider screens keep the
card layout above, unchanged.

- **Page:** edge to edge on a light grey background, 16 px side margins, no
  card. A header stays at the top with the title, a **Settings** button (16)
  and a **Backup** button, which shows the backup reminder dot (10.3).
- **Running task:** starting or pausing a task changes only that card's
  Start/Pause button and its glow; nothing appears, disappears or moves
  elsewhere on the page.
- **Totals:** one line with the total of all tasks and the time format
  toggle.
- **Task card:** the title in full on the first line, between a drag handle
  and a ⋮ menu (Edit task, Delete task). Below it, chips for the status, the
  priority (with its colour dot), the ETA, the start date and the due date,
  then the status note and the time to the due date (4.7). The last line has
  the consumed time in large digits, labelled **Consumed**, and one
  Start/Pause button of 48 px. The card keeps the row colours of 4.5. Editing opens the edit form
  in the card, with a full-width Save button.
- **Status:** tapping the status chip opens a sheet from the bottom listing
  the five statuses; a tap picks one and closes it.
- **Finished tasks:** Done and Canceled tasks move to a **Finished (n)**
  section under the open ones, folded by default. They can't be dragged.
- **Reordering:** only by a card's handle (keyboard too: Space, arrows,
  Space), so a swipe on the card scrolls the list. Open tasks move among
  themselves; finished tasks keep their place in the saved order (6).
- **Add task:** a round ＋ button at the bottom right opens a sheet with the
  title field (focused, so the keyboard opens), priority chips and an Add
  button. Suggestions and the start date offer work as in 6.1. The sheet
  closes after adding, and moves up above the on-screen keyboard.
- **Bottom bar:** always shows **Tasks**, **Report** and **Statistics**,
  one tap each, with nothing hidden in a menu. Tasks and Statistics switch
  screens; Report opens the daily report page over the current screen, and
  Back returns to it. The Statistics screen has no back arrow there. On Statistics the Workday hours
  button wraps under the title; the By task table and the timeline as in 9.2.
- **Notch and home indicator:** the page uses `viewport-fit=cover`, and the
  header and bottom bar are padded by the safe-area insets.
- **Full-screen pages:** the Daily report and Backup open as pages that
  cover the screen instead of floating dialogs (14.1). The workday and task
  history dialogs are the same as on wide screens and fit the width.

### 14.1 Full-screen pages

- **Header:** stays at the top: a 44 px **Back** button (←) and the title.
  The content scrolls under it, so Back is always in reach.
- **Phone back:** opening a page adds a browser history entry, so the
  phone's back button or back swipe closes the page instead of leaving the
  app. Back, Escape and the phone's back all close it the same way.
- **Daily report:**
  - Two tabs under the title: **Preview** (shown first) and **Edit**.
  - **Preview:** the task count and Total consumed (8.3), then the email
    preview at full width, scrolling with the page (no scroll box of its own).
  - **Edit:** Next planned tasks and Issue / Concerns / Blocks, which change
    from day to day. Greeting, intro, signature and ticket links are under
    **Report settings**, folded by default; a ticket link line that isn't
    used (8.5) is reported under the section either way.
  - **Copy report** stays at the bottom of the screen at full width, on both
    tabs, with "Copied" or the copy error shown just above it.
- **Backup:** the same content as the dialog (10.3) under the header.

## 15. Themes

Five themes, picked by hand; nothing switches on its own (not by the
system's dark mode, not by the time of day). A theme changes colours, and
later also fonts, shapes, background graphics and animations.

| Theme | Look |
| --- | --- |
| Classic | today's look: indigo and blue, clean sans-serif (the default) |
| Midnight | dark navy, cyan accent |
| Notebook | warm paper, ink blue, handwritten titles |
| Terminal | black and green, monospace |
| Zen | soft greens and sand, rounded |

All five are done (15.2, 15.3).

### 15.1 Colour roles

- Components use colour **roles**, never fixed colours: page and surfaces
  (`page`, `surface`, `fill`, `line`), five text levels (`fg-strong` to
  `fg-ghost`), `on-color` for text on coloured buttons, the actions
  (`primary`, `accent`, `selected`, `go`/`stop` for start and pause, `edit`,
  `neutral`), the meanings (`danger`, `success`, `warn`), and the task row
  colours by priority and status (`row-*` and `row-*-edge`, see 4.5).
- Each role is a CSS variable set per theme in `src/theme/themes.css`, under
  `<html data-theme="…">`. Classic is the default.
- Tailwind's own palette is not available (`tailwind.config.js`), and a unit
  test (`src/theme/noRawColors.test.ts`) fails if a component uses a palette
  class such as `bg-blue-500`.
- Fixed in every theme: the report preview looks like the email (`email-paper`,
  `email-ink`), the status highlights and link colour inside the email (8.2),
  and the task colours in Statistics (9.2).
- Text on buttons meets 4.5:1 contrast: Classic's primary blue is `blue-600`.

### 15.2 Choosing a theme

- The themes are listed under **Theme** in Settings (16).
- Each theme is shown as a small task card drawn in that theme, with its name
  and a line about its look. A tap applies it at once; the current one is
  checked.
- The choice is saved on the device (`localStorage` key `theme`) and
  applied by a script in `index.html` before the first paint, so the page
  never flashes another theme. The phone's status bar colour (`theme-color`)
  follows the theme.
- A theme sets the colour roles (15.1), the fonts (`--font-body`,
  `--font-display` for headings), the page background (`.app-bg`) and the
  animations for three moments, in `src/theme/effects.css`:
  - the running task (`.glow`),
  - a task just added (`data-new`, for 1.5 s; not when the list loads or a
    screen is opened again),
  - a task just set to Done (`data-just-done`, for 1.5 s). On a phone the
    task moves to the folded Finished section, so that section's header
    shows the moment too.
- Fonts are stored with the app (`@fontsource` packages). Latin and
  Vietnamese work offline; Cyrillic and Greek parts load only when such text
  appears, and are not kept for offline use.
- When the device asks for reduced motion, no theme animates; only the
  colours change.
- Every theme is checked for text contrast (4.5:1) on the task list, the
  report and Statistics, on both layouts (`e2e/themes.spec.ts`, with axe),
  with motion reduced so the check sees the settled screen.
- The picker's preview tiles (`.theme-swatch`) carry their own
  `data-theme` and get that theme's background, whatever theme the page
  uses.

### 15.3 The themes

- **Classic:** the look before themes. The running task pulses red; nothing
  else animates.
- **Midnight:** dark navy cards, cyan buttons with dark text, violet accents,
  Space Grotesk. The page is a sky of small stars with a faint glow at the
  top. A light travels round the running task's border; a new task fades in
  out of the dark; Done sweeps a band of light across the card. Form fields
  and the browser's controls are dark (`color-scheme: dark`). The report
  preview stays white, like the email.
- **Notebook:** ruled paper with a red margin line (the page on a phone, the
  sheet on desktop), ink-blue text, a red pen accent, task titles in Patrick
  Hand. Tasks are sticky notes in pastel colours, slightly tilted, with a
  strip of tape on top (on desktop the tilt is much smaller). The running
  task flutters inside a dashed pencil outline; a new task drops onto the
  page; Done tasks are struck through in red pen, and the stroke is drawn when
  a task is set to Done.
- **Terminal:** green phosphor text on black with amber highlights, JetBrains
  Mono throughout, every corner square. The page has scanlines and a faint
  green glow; text glows slightly (not in the email preview). Headings start
  with `>` and task titles with `$`. The running task's time ends in a
  blinking cursor; a new task's title types itself out; Done flashes
  `[ OK ]` on the card.
- **Zen:** sand and sage with clay accents, Nunito, softer and rounder
  corners. A leaf sits beside the app's name; the page has two soft shapes
  and sage waves along the bottom; on a phone the bottom bar has a wavy top
  edge. The running task breathes slowly; a new task rises gently into place;
  Done lets a leaf fall from the card.

## 16. Settings and UI modes

- **Settings** (gear icon) opens one place for the look of the app: in the
  header next to Backup on a phone (as a sheet from the bottom), next to
  Backup and Statistics on desktop (as a dialog). It has two parts:
  **UI mode** and **Theme** (15.2). Each choice applies at once.
- **UI mode** is **Full** (the default: everything described in 4.5 and 14)
  or **Compact**. The choice is saved on the device (`localStorage` key
  `uiMode`) and, like the theme, is not part of a backup.
- **Compact:** each task is one line with only a status icon, the title
  (cut short with … when it doesn't fit) and the Start/Pause button. The row
  keeps its colours (4.5) and the theme's moments (15.2). The status icons:
  Todo ○, In progress ◉, Pending ⧗, Done ✓, Canceled ⊘; the status name is
  the icon's label and tooltip. Editing, deleting and changing the status
  need Full mode. On desktop a row is dragged to reorder as in Full mode; on
  a phone there is no handle, so compact rows can't be reordered. The rest
  of the page (adding a task, totals, Finished section, bottom bar) stays
  the same.
