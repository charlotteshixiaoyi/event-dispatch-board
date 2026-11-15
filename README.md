# Event EMS Dispatch Board

[Open the Dispatch Board](https://charlotteshixiaoyi.github.io/event-dispatch-board/)

Created by Charlotte Shi, EMT-B.

Tracks unit status, post assignments, status timers, meal breaks, and shift notes.
**Time stamp** records unit activity in Pacific time, newest first.

- **Level** counts roaming field units, excluding fixed posts and meal breaks.
- **Undo** reverses changes during the current session.
- **Board tools** contains backups, sample units, and the clear action.

Board data saves in the current browser. Existing saved boards and JSON backups remain compatible.

## Venue 3D

The top Venue selector controls venue-specific posts and the 3D view. With no venue selected, the 3D tab shows **No view**.

Bill Graham includes these primary posts on the first tab, even before teams are placed:

- 1st floor Grove, Polk, and Larkin.
- 2nd floor Grove, Polk, and Larkin.
- 1st roaming and 2nd roaming.

Pit and Table Service are options under **Fixed posts**. Pit has a side selector in both tabs: Stage left near Polk, or Stage right near Larkin, inside the first-floor auditorium. The Pit area and assigned teams move together; the setting saves with the board and backups and supports Undo. Table Service appears on first-floor Grove nearest Larkin. Both stay nested inside the Fixed posts section. Their map areas and team markers use light gray, with pale cards on the board. Meal breaks use darker gray, including when the team is assigned to Pit. Fixed-post teams do not count toward dispatch availability.

Larkin is on the left and Polk is on the right in the map. Main Medical follows the Polk side on the 4th floor. Both roaming posts sit along Grove on their respective floors. Tapping a map team cycles its status just like the first tab. Dragging changes its post without changing status.

Basement is one area with no street-side divisions or team limit. Its floor area grows to fit additional rows. Older basement side assignments merge into Basement while keeping their teams, statuses, and timers.

Post headings, roster post selectors, and map movements update the same assignments. Changing a post heading moves that group's field teams. Duplicate posts merge. Venue selection and post configuration are included in saved data, backups, and Undo.

The map shows Basement, 1st, 2nd, and 4th floors by default. A third-floor toggle reveals that level without changing assignments. Main Medical remains on 4th floor, Polk. Each placed team is a colored ball with its call sign above it. The map fits the available viewport, and unit lists scroll separately.

Main Medical retains the original **At Medical** behavior. Other field moves preserve status timers and meal breaks. Existing custom posts and older backups remain compatible. Clearing the venue preserves assignments.

The model uses local SVG and JavaScript without external runtime dependencies.

## Files

- `index.html`, `board.css`, and `board.js` are the shared app sources.
- `Event_EMS_Dispatch_Board.html` is the self-contained version.
- `sw.js` provides offline caching for the hosted app.

After editing the shared sources, rebuild the standalone page with `python3 scripts/build-standalone.py`.

Deploy the repo to GitHub Pages, or open `Event_EMS_Dispatch_Board.html` directly.

## Checks

Run `node tests/venue-state.test.mjs` for the 47 state and event checks. These cover venue selection, both assignment directions, fixed-post grouping and availability, saved Pit-side selection, Pit, Table Service, street orientation, roaming on Grove, map status taps, drag suppression, unified Basement assignments and large groups, hidden floors, named ball markers, Main Medical transitions, meal breaks, Undo, legacy backups, escaping, and move event handlers using an in-memory DOM fixture. They do not replace visual or device testing in a real browser.
