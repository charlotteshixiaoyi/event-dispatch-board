# Event EMS Dispatch Board

[Open the Dispatch Board](https://charlotteshixiaoyi.github.io/event-dispatch-board/)

Created by Charlotte Shi, EMT-B.

Tracks unit status, post assignments, status timers, meal breaks, and shift notes.
**Time stamp** records unit activity in Pacific time, newest first.

- **Level** counts roaming field units, excluding fixed posts and meal breaks.
- **Undo** reverses changes during the current session.
- **Board tools** contains backups, sample units, and the clear action.

Board data saves in the current browser. Existing saved boards and JSON backups remain compatible.

## Files

- `index.html`, `board.css`, and `board.js` are the shared app sources.
- `Event_EMS_Dispatch_Board.html` is the self-contained version.
- `sw.js` provides offline caching for the hosted app.

After editing the shared sources, rebuild the standalone page with `python3 scripts/build-standalone.py`.

Deploy the repo to GitHub Pages, or open `Event_EMS_Dispatch_Board.html` directly.
