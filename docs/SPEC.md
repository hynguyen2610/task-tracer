# Task Tracker spec

What the app does and the rules it follows.

## 1. Overview

A single-user time tracker. You keep an ordered list of tasks, start and pause
a timer on one task at a time, and export the time spent to Excel.

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

A new database starts with one task, "First task of the day".

## 3. Priority

Values, highest first: `Highest`, `High`, `Normal`, `Low`. Default `Normal`.

Priority only affects how a task looks: each value has its own background and
left-border color. It doesn't change ordering or the timer.

## 4. Status

### 4.1 Values

| Value         | Meaning                                    |
|---------------|--------------------------------------------|
| `Todo`        | Not started yet. Default for new tasks.    |
| `In progress` | Being worked on. The timer may or may not be running. |
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
| Start timer                              | `Done` or `Canceled`     | Rejected. Backend returns `409`; the play button is disabled.  |
| Pause timer                              | `In progress`            | Timer stops, status stays `In progress`.                       |
| Start another task while this one runs   | `In progress`            | This task's timer stops (time added), status stays `In progress`. |
| Open the edit form while this one runs   | `In progress`            | Timer stops (time added) before the form opens, status stays `In progress`. See 5. |

### 4.4 Changing status by hand

The user can set any status from any status.

| New status                | Task running? | Result                                                              |
|---------------------------|---------------|---------------------------------------------------------------------|
| `Done` or `Canceled`      | yes           | Elapsed time is added to `totalSeconds` first, then the timer stops. |
| `Todo`                    | yes           | Same: time added, timer stops (a running task can't be `Todo`).     |
| `In progress`             | any           | Status changes, timer left as it is.                                |
| Any                       | no            | Status changes, nothing else.                                       |

Reopening a `Done` or `Canceled` task (setting it back to `Todo` or
`In progress`) keeps its `totalSeconds`. The timer stays stopped until started.

### 4.5 Display

- View mode shows the status under the priority, as `Status: <value>`.
- The edit form gets a Status dropdown with the four values, next to Priority.
- The play button is disabled for `Done` and `Canceled` tasks.

### 4.6 Existing data

When the backend starts, it adds the `status` column if it is missing
(`TEXT NOT NULL DEFAULT 'Todo'`). Rows with `isRunning = 1` get `In progress`;
every other existing row gets `Todo`.

## 5. Timer

- **At most one task runs at a time.** Starting a task stops whichever task is
  running.
- **The backend keeps the time.** On every read and every toggle it adds
  `now - lastStart` to `totalSeconds` for the running task and resets
  `lastStart` to `now`. Nothing is counted in memory, so time keeps adding up
  while the browser is closed and survives a backend restart.
- **The frontend polls `GET /tasks` every second** to show the time going up.
- **The pause button in the top right only pauses polling.** It stops the
  screen from updating; it does not stop the running task's timer.
- **Editing pauses the task.** Opening the edit form on a running task pauses
  it first, so the form shows the up-to-date time and nothing is counted while
  editing. Saving doesn't restart the timer; press play to resume.
- **Editing time:** the edit form takes `HH:mm`. Saving sets `totalSeconds` to
  that value, which drops any seconds.

## 6. List order

Tasks are shown by `position`, whatever their status: `Done` and `Canceled`
tasks keep their place in the main list. New tasks go to the bottom. Dragging a task
saves the new order for the whole list right away.

## 7. Totals and export

- **Total Time (All Tasks)** is the sum of `totalSeconds` for every task in
  the list, whatever its status (`Done` and `Canceled` included), shown as
  `HH:mm:ss`.
- **Export to Excel** downloads `tasks.xlsx` with one sheet, "Tasks", and
  three columns: Total Time (hours, 2 decimals), Title and Status. Every task
  is exported, in list order.

## 8. API

Base URL `http://localhost:4000`. All bodies are JSON.

| Method & path             | Body                                    | Response                    |
|---------------------------|-----------------------------------------|-----------------------------|
| `GET /tasks`              | none                                    | All tasks, by `position`.   |
| `POST /tasks`             | `{ title, priority }`                   | The created task, as `Todo`. |
| `PUT /tasks/:id`          | `{ title, totalSeconds?, priority?, status? }` | `{ success: true }`. `400` if `status` isn't one of the four. Applies 4.4. |
| `POST /tasks/:id/toggle`  | none                                    | All tasks, by `position`. `404` if not found; `409` when starting a `Done` or `Canceled` task. Applies 4.3. |
| `POST /tasks/reorder`     | `{ ids: number[] }`, the full new order | `{ success: true }`. `400` if `ids` isn't an array. |
| `DELETE /tasks/:id`       | none                                    | `{ success: true }`         |

## 9. Decisions

- `Done` and `Canceled` tasks stay in the main list, in their position.
- The Excel export has a Status column and includes `Canceled` tasks.
- Total Time includes `Canceled` tasks.
