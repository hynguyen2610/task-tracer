# Task Tracker spec

What the app does and the rules it follows.

## 1. Overview

A single-user time tracker. You keep an ordered list of tasks, start and pause
a timer on one task at a time, export the time spent to Excel, and copy a
daily work report into an email.

- **Frontend:** React + Vite (`frontend/`), talks to the backend over HTTP.
- **Backend:** Express + SQLite via `better-sqlite3` (`backend/`), data in
  `backend/tasks.db`.

## 2. Task

| Field          | Type                 | Notes                                                        |
|----------------|----------------------|--------------------------------------------------------------|
| `id`           | integer              | Assigned by the database.                                    |
| `title`        | string               | Required. The add form ignores blank titles; the backend and the edit form don't check. |
| `totalSeconds` | integer              | Time tracked so far. Default `0`.                            |
| `isRunning`    | boolean              | `true` while the timer is running. Default `false`.          |
| `lastStart`    | epoch ms or `null`   | When the timer last started or was last brought up to date.  |
| `position`     | integer              | Order in the list, starting at `0`.                          |
| `priority`     | [Priority](#3-priority) | Default `Normal`.                                         |
| `status`       | [Status](#4-status)  | Default `Todo`.                                              |
| `statusNote`   | string or `null`     | Optional short note shown after the status, e.g. "Waiting for Kiro". |
| `startedAt`    | epoch ms or `null`   | Set once, the first time the task leaves `Todo` (timer start or status change). |
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
| Start timer                              | `Pending`, `Done` or `Canceled` | Rejected. Backend returns `409`; the play button is disabled. |
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
- Each task shows a Status dropdown under the priority, followed by the note
  in brackets when there is one. Picking a value saves it right away, with the
  rules in 4.4; no need to open the edit form.
- The edit form has a Status dropdown and a Status note field, after Priority.
- The play button is disabled for `Pending`, `Done` and `Canceled` tasks.

### 4.6 Existing data

When the backend starts, it adds any missing column and fills it in:

| Column         | Filled with                                                    |
|----------------|----------------------------------------------------------------|
| `status`       | `In progress` for rows with `isRunning = 1`, otherwise `Todo`. |
| `statusNote`   | `null`.                                                        |
| `startedAt`    | `lastStart`, the only date older rows have. `null` if never started. |
| `lastWorkedAt` | `lastStart`, same reason.                                      |

## 5. Timer

- **At most one task runs at a time.** Starting a task stops whichever task is
  running.
- **The backend keeps the time.** On every read and every toggle it adds
  `now - lastStart` to `totalSeconds` for the running task and resets
  `lastStart` (and `lastWorkedAt`) to `now`. Nothing is counted in memory, so
  time keeps adding up while the browser is closed and survives a backend
  restart.
- **The frontend polls `GET /tasks` every second** to show the time going up.
- **The pause button in the top right only pauses polling.** It stops the
  screen from updating; it does not stop the running task's timer.
- **Editing pauses the task.** Opening the edit form on a running task pauses
  it first, so the form shows the up-to-date time and nothing is counted while
  editing. Saving doesn't restart the timer; press play to resume.
- **Editing time:** the edit form takes `HH:mm`. Saving sets `totalSeconds` to
  that value, which drops any seconds.

## 6. List order

Tasks are shown by `position`, whatever their status: `Pending`, `Done` and
`Canceled` tasks keep their place in the main list. New tasks go to the bottom.
Dragging a task saves the new order for the whole list right away.

## 7. Totals and export

- **Total Time (All Tasks)** is the sum of `totalSeconds` for every task in
  the list, whatever its status (`Done` and `Canceled` included), shown as
  `HH:mm:ss`.
- **Export to Excel** downloads `tasks.xlsx` with one sheet, "Tasks", and
  three columns: Total Time (hours, 2 decimals), Title and Status. Every task
  is exported, in list order.

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

- Tasks are numbered from 1 in the report, not by list position.
- **Status** labels match the app, except `Canceled`, shown as `CANCELLED`.
  The label has a background highlight: `Done` bright green, `In progress`
  light blue, `Pending` orange, `CANCELLED` pink. `Todo` has none.
- **ETA** is the total tracked time rounded to the nearest quarter hour, e.g.
  `1.25 hour`. Any tracked time under 7.5 minutes shows as `0.25 hour`.
- An empty section shows `None`.

### 8.3 Email text

The dialog has fields for greeting, intro, next planned tasks, issues and
signature, with a live preview. Above them it shows **Total ETA (rounded)**:
the sum of the report's rounded ETAs, so it matches what a reader adds up from
the email. It is shown in the dialog only, not copied. Next planned tasks takes one item per line; a
line starting with `-` becomes a sub-item of the line above. The fields are
saved in the browser (`localStorage`) and come back filled in next time.

### 8.4 Copy

**Copy report** puts two versions on the clipboard: HTML with inline styles
(lists and highlights survive pasting into email) and plain text, for places
that only accept text.

## 9. API

Base URL `http://localhost:4000`. All bodies are JSON.

| Method & path             | Body                                    | Response                    |
|---------------------------|-----------------------------------------|-----------------------------|
| `GET /tasks`              | none                                    | All tasks, by `position`.   |
| `POST /tasks`             | `{ title, priority }`                   | The created task, as `Todo`. |
| `PUT /tasks/:id`          | `{ title?, totalSeconds?, priority?, status?, statusNote? }`; fields left out or `null` keep their value, an empty `statusNote` clears it | `{ success: true }`. `400` if `status` isn't one of the five, `404` if not found. Applies 4.4. |
| `POST /tasks/:id/toggle`  | none                                    | All tasks, by `position`. `404` if not found; `409` when starting a `Pending`, `Done` or `Canceled` task. Applies 4.3. |
| `POST /tasks/reorder`     | `{ ids: number[] }`, the full new order | `{ success: true }`. `400` if `ids` isn't an array. |
| `DELETE /tasks/:id`       | none                                    | `{ success: true }`         |

## 10. Decisions

- `Pending`, `Done` and `Canceled` tasks stay in the main list, in their position.
- The Excel export has a Status column and includes `Canceled` tasks.
- Total Time includes `Canceled` tasks.
- `Pending` tasks can't be started; set them back to `In progress` first.
- The report's ETA is tracked time, not an estimate.
