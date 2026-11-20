# Frontend refactor checklist

Goal: split `src/App.tsx` (359 lines) into small, single-purpose files.
Pure refactor: no behavior or styling changes.

## Target structure

```
src/
  api/
    tasks.ts              API_URL + one function per endpoint
  constants/
    priority.ts           PRIORITIES list + priority color classes
  utils/
    time.ts               formatTime, secondsToHHmm, hhmmToSeconds
    exportToExcel.ts      xlsx/file-saver export
  hooks/
    useTasks.ts           tasks state, 1s polling, pause/resume, CRUD actions
  components/
    PlayPauseButton.tsx   round play/pause button (global + per task)
    PrioritySelect.tsx    Highest/High/Normal/Low <select>
    NewTaskForm.tsx       title input + priority + Add button
    TasksSummary.tsx      total time + Excel export button
    TaskList.tsx          drag-and-drop list, owns "which task is being edited"
    TaskItem.tsx          one row: index badge, view/edit body, action buttons
    TaskEditForm.tsx      title / duration / priority inputs
    DurationInput.tsx     moved from src/
  App.tsx                 layout only, wires hook to components
  types.ts                unchanged (+ Priority type alias)
```

## Steps

- [x] 1. Add `Priority` type alias to `types.ts`
- [x] 2. Extract `utils/time.ts`
- [x] 3. Extract `constants/priority.ts`
- [x] 4. Extract `api/tasks.ts`
- [x] 5. Extract `utils/exportToExcel.ts`
- [x] 6. Extract `hooks/useTasks.ts`
- [x] 7. Create `PlayPauseButton` and `PrioritySelect`
- [x] 8. Create `NewTaskForm`
- [x] 9. Create `TasksSummary`
- [x] 10. Create `TaskEditForm`, `TaskItem`, `TaskList`
- [x] 11. Move `DurationInput.tsx` into `components/`
- [x] 12. Slim `App.tsx` down to layout
- [x] 13. Verify: `npm run build` and `npm run lint` pass
- [ ] 14. Manual check in the browser: add, toggle, edit, delete, reorder, export, global pause

## Notes / follow-ups (out of scope for this refactor)

- `API_URL` is hardcoded to `http://localhost:4000`; will become `/api` for Vercel.
- Blurring the title input saves and closes the edit form, so you can't tab
  from title to duration without the form closing. Existing behavior, kept as is.
- Polling refetches every second even when nothing is running.
