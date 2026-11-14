# Task Tracker spec

What the app does and the rules it follows.

## 1. Overview

A single-user time tracker. You keep an ordered list of tasks, start and pause
a timer on one task at a time, export the time spent to Excel, and copy a
daily work report into an email.

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

**Browser version** (`npm run dev` in `backend/` and in `frontend/`, or
`start-windows.bat`):

- **UI:** served by Vite on `http://localhost:1420`.
- **Backend:** Express + SQLite via `better-sqlite3` (`backend/`), called over
  HTTP (10.2). Data in `backend/tasks.db`.

Both apply the same rules to the same schema, so a `tasks.db` from one can be
copied to the other. Missing columns are added when it is opened (4.6).

## 2. Task

| Field          | Type                 | Notes                                                        |
|----------------|----------------------|--------------------------------------------------------------|
| `id`           | integer              | Assigned by the database.                                    |
| `title`        | string               | Required. The add form ignores blank titles; the backends and the edit form don't check. |
| `totalSeconds` | integer              | Time tracked so far. Default `0`.                            |
| `isRunning`    | boolean              | `true` while the timer is running. Default `false`.          |
| `lastStart`    | epoch ms or `null`   | When the timer last started or was last brought up to date.  |
| `position`     | integer              | Order in the list, starting at `0`.                          |
| `priority`     | [Priority](#3-priority) | Default `Normal`.                                         |
| `status`       | [Status](#4-status)  | Default `Todo`.                                              |
| `statusNote`   | string or `null`     | Optional short note shown after the status, e.g. "Waiting for Kiro". |
| `startedAt`    | epoch ms or `null`   | Set once, the first time the task leaves `Todo` (timer start or status change), unless a start date was picked in the edit form (4.5), which always wins. |
| `lastWorkedAt` | epoch ms or `null`   | Last time work was recorded: time tracked, total time edited, or status changed. Title, priority, note and order changes don't count. |

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
  one line where they fit; longer ones wrap. From 768 px up, total time,
  priority and status sit on one line under the title; below that they stack.
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

## 5. Timer

- **At most one task runs at a time.** Starting a task stops whichever task is
  running.
- **The backend keeps the time** (the Rust core, or Express in the browser
  version). On every read, toggle and status change it adds the whole seconds
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
| Task's Total Time, Total Time (All Tasks) | `01:30:00` (seconds kept, so a running timer visibly ticks) | `1.5 h` (hours, at most 2 decimals) |
| Edit form's Total Time field | `01:30`    | `1.5`; a comma works as the decimal point |

The daily report (ETA in quarter hours) and the Excel export (hours, 2
decimals) don't change with the switch.

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

## 7. Totals and export

- **Total Time (All Tasks)** is the sum of `totalSeconds` for every task in
  the list, whatever its status (`Done` and `Canceled` included), shown in the
  chosen time format (5.1).
- **Export to Excel** writes `tasks.xlsx` with one sheet, "Tasks", and three
  columns: Total Time (hours, 2 decimals), Title and Status. Every task is
  exported, in list order. The desktop app asks where to save (cancelling
  writes nothing); the browser downloads the file.

## 8. Daily report

The mail button next to Export opens the **Daily report** dialog. It builds an
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
      ▪ ETA : <hours> hour
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
- **ETA** is the total tracked time rounded to the nearest quarter hour, e.g.
  `1.25 hour`. Any tracked time under 7.5 minutes shows as `0.25 hour`.
- An empty section shows `None`.

### 8.3 Email text

The dialog has fields for greeting, intro, next planned tasks, issues,
signature and ticket links (8.5), with a live preview. Above them it shows **Total ETA (rounded)**:
the sum of the report's rounded ETAs, so it matches what a reader adds up from
the email. It is shown in the dialog only, not copied.

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
  the task, its times and its length.
- **By task:** each task worked on that day with tracked time, adjustments
  and total, largest first. Deleted tasks are marked "(deleted)" and keep
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
| `update_task`   | `{ id, changes: { title?, totalSeconds?, priority?, status?, statusNote?, startedAt? } }`; fields left out or `null` keep their value, an empty `statusNote` clears it | Nothing. Fails with "status must be one of: …", "startedAt must be a date (epoch ms)" for a negative `startedAt`, or "Task not found". Applies 4.4. |
| `toggle_task`   | `{ id }`                                    | All tasks, by `position`. Fails with "Task not found", or "Cannot start a `<status>` task" for `Pending`, `Done` and `Canceled`. Applies 4.3. |
| `reorder_tasks` | `{ ids }`, the full new order               | Nothing.                    |
| `delete_task`   | `{ id }`                                    | Nothing.                    |
| `save_file`     | `{ defaultName, contents }` (bytes)         | Shows a save dialog and writes the file. The chosen path, or `null` if cancelled. |
| `get_activity`  | `{ from, to }` (epoch ms)                   | `{ sessions, events }` (9.1): sessions that overlap `[from, to)` and events inside it, oldest first. |

### 10.2 HTTP API

Express backend in `backend/src/index.ts`, at `VITE_API_URL` (default
`http://localhost:4000`). All bodies are JSON. The backend reads `PORT`
(default `4000`) and `TASKS_DB` (default `tasks.db`) from the environment.

| Method & path             | Body                                    | Response                    |
|---------------------------|-----------------------------------------|-----------------------------|
| `GET /tasks`              | none                                    | All tasks, by `position`.   |
| `POST /tasks`             | `{ title, priority, startedAt? }`       | The created task, as `Todo`. `400` if `startedAt` isn't a whole number ≥ 0. |
| `PUT /tasks/:id`          | Same as `update_task`'s `changes`       | `{ success: true }`. `400` if `status` isn't one of the five or `startedAt` isn't a whole number ≥ 0, `404` if not found. Applies 4.4. |
| `POST /tasks/:id/toggle`  | none                                    | All tasks, by `position`. `404` if not found; `409` when starting a `Pending`, `Done` or `Canceled` task. Applies 4.3. |
| `POST /tasks/reorder`     | `{ ids: number[] }`, the full new order | `{ success: true }`. `400` if `ids` isn't an array. |
| `DELETE /tasks/:id`       | none                                    | `{ success: true }`         |
| `GET /activity?from&to`   | none; `from`, `to` in epoch ms          | Same as `get_activity`. `400` if either isn't a whole number. |

The browser has no save dialog; exports are downloaded instead of using
`save_file`.

## 11. Tests

- **Rust core:** `cargo test` in `frontend/src-tauri/`.
- **Unit tests:** `npm test` in `frontend/` runs Vitest on `src/**/*.test.ts`
  (day statistics, task history, title matching, the report's next
  weekday and ticket links).
- **TypeScript core:** `frontend/src/core/` holds the task rules in
  TypeScript, for the coming on-device (mobile) version. Its tests
  (`core/tasks.test.ts`) are ported from the Rust core's, so both keep the
  same rules; change both together.
- **Browser version:** `npm run test:e2e` in `frontend/` runs the Playwright
  tests in `frontend/e2e/` in Chromium. They start their own backend (port
  4100, a fresh database in the temp folder) and Vite (port 1430), so a
  running dev setup and `backend/tasks.db` are not touched.

## 12. Decisions

- `Pending`, `Done` and `Canceled` tasks stay in the main list, in their position.
- The Excel export has a Status column and includes `Canceled` tasks.
- Total Time includes `Canceled` tasks.
- `Pending` tasks can't be started; set them back to `In progress` first.
- The report's ETA is tracked time, not an estimate.
- Deleted tasks keep their history in the statistics.
- A total time typed by hand is recorded as an adjustment and counts toward
  that day's work.
- Gaps under 2 minutes between sessions count as work, not breaks.
- Breaks only count inside working hours and outside lunch.
- Similar titles are offered as suggestions while typing; the user decides.
- The Statistics button replaced the old global pause button, which only
  paused screen updates.
