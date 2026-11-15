# Event EMS Dispatch Board

[Open the Dispatch Board](https://charlotteshixiaoyi.github.io/event-dispatch-board/)

Created by Charlotte Shi, EMT-B.

## Start a shift

1. Open the [board link](https://charlotteshixiaoyi.github.io/event-dispatch-board/) or open `Event_EMS_Dispatch_Board.html` from the downloaded app folder.
2. Select **Bill Graham Civic Auditorium** from **Venue** if you are working that venue. Leave the venue unselected to use the general dispatch board with custom posts.
3. Enter a call sign, such as `341`, and select **Add unit**. Repeat for each team.
4. In **Unit roster**, set each team's **Status** and **Post**.
5. For Bill Graham, confirm the **Pit** side (stage left or right) if that post is in use.

The **Dispatch board** and **Venue 3D** tabs show the same units. Changes in either tab update the other view.

## Read the status and counts

### Unit statuses

| Status | Use it when | Usual color |
| --- | --- | --- |
| **Roaming** | The team is ready for a field assignment. | Green |
| **On scene** | The team is responding to or on scene at an incident. | Red |
| **Transporting** | The team is transporting to Main Medical. | Amber |
| **At Medical** | The team is at Main Medical. | Blue |

Fixed-post teams (table service or pit) use pale cards on the board and light gray markers on the map. Teams on a meal break use darker gray. Check the status text or **Status** dropdown for their actual status.

### Overview counts

| Counter | What it counts |
| --- | --- |
| **Level / Available** | Field units with **Roaming** status that are *outside Fixed posts and are not on a meal break.* |
| **On scene** | All units with **On scene** selected. |
| **Transporting** | All units with **Transporting** selected. |
| **At Medical** | All units with **At Medical** selected. |

For example, a roaming team assigned to Pit is excluded from **Level** because Pit is a fixed post. A roaming field team on a meal break is also excluded.

The counts beside **Field units**, individual posts, and **Main Medical** show how many units are assigned there. Those counts include units on a meal break.

### Status timers and clock

The timer on a unit card shows how long the unit has been in its current status.

- Changing status restarts the timer.
- Changing a field post keeps the timer running if the status stays the same.
- Starting or ending a meal break keeps the status timer running.
- Saved timer start times carry over when you reopen the board.

The header clock, activity times, and meal return times use **Pacific time**, including PST or PDT as applicable.

## Add, update, or remove a unit

Enter the team's call sign and select **Add unit**. New units start as **Roaming** with **No post assigned**. Call signs must be unique. `sam1` and `SAM1` count as the same call sign.

The **Unit roster** below the two views gives you direct controls:

| Control | Action |
| --- | --- |
| **Status** | Choose the exact status you want. |
| **Post** | Assign or move that unit to a post. |
| **×** in the unit's row | Remove that unit from the board. |

Use **Undo** if you remove the wrong unit.

### Tap to change status

Tap a unit card on the Dispatch board or a team ball on the map to advance through this cycle:

**Roaming → On scene → Transporting → At Medical → Roaming**

To choose a status directly, use its **Status** dropdown. For an accidental tap, use **Undo** to restore the previous status and timer.

### Move one unit

Use the unit's **Post** dropdown in the roster. On a computer, you can also drag its card into another post section or Main Medical.

Hold a dragged team near the top or bottom edge of the screen to scroll in that direction. Scrolling continues while you hold there and stops when you move away, drop, or cancel. A long **Units** list also scrolls near its own edges.

A field-to-field move keeps the team's status, status timer, and meal-break record. End a meal break separately when the team returns.

Choose **No post assigned** to remove a geographic assignment while keeping the unit on the board.

**No post assigned** always stays below every other post section, including newly added or restored posts.

### Add or change post sections

With Bill Graham selected, choose a destination from **Post name**, then select **Add post**. This adds the post section if it is not already shown. 

Without a venue selected, type a name in **Post name** and select **Add post**. You can edit a custom post's name in its heading.

Selecting **×** beside a removable post sends its assigned field units to **No post assigned**. The units remain on the board. Use **Undo** to restore the post and assignments.

## Main Medical

Main Medical assignments and **At Medical** status are linked:

| Action | Result |
| --- | --- |
| Assign a unit to **Main Medical** | Its status becomes **At Medical**. |
| Change a unit's status to **At Medical** | It moves into Main Medical. |
| Move a unit from Main Medical to a field post | Its status becomes **Roaming**. |
| Change **At Medical** to another status | It returns to its previous field post, or **No post assigned** if that post is no longer available. |

Check the post after releasing a unit from Main Medical. If it needs a new assignment, choose that post in the roster.

## Use the Bill Graham 3D view

Select **Bill Graham Civic Auditorium** under **Venue**, then open **Venue 3D**. If no venue is selected, the tab shows **No view**.

The default view shows the 1st, 2nd, and 4th floors at a larger size, with less empty space. All three floors fit inside the map area. Enabling additional locations makes room for those locations.

### Move a team on the map

On a computer, drag a team ball or a unit from the **Units** list onto the destination area.

For moves by tap:

1. Select the team in the **Units** list. On smaller screens, you can use the **Unit** dropdown above the map.
2. Tap an open part of the destination area.
3. Check the team's new post in the roster or selected-unit panel.

You can also select a unit and use **Move to** in its selected-unit panel. That panel includes a direct **Status** dropdown and meal-break controls.

**Tapping a team ball changes its status.** Use the Units list or Unit dropdown to select a team for a move without cycling its status.

Select **×** in the selected-unit panel to cancel the selection. This keeps the unit on the board.

### Pit and Table Service

Choose **Pit** or **Table Service** under **Fixed posts** in a unit's Post dropdown. Their teams appear inside Fixed posts on the Dispatch board and at their locations on the map. You can also drag a team into either fixed-post area.

Both areas and their map markers use light gray. A team on a meal break uses a darker gray marker. Fixed-post teams are excluded from **Level**, even when their status says **Roaming**.

### Choose the Pit side

Use the Pit selector inside the Fixed posts section or in the map toolbar.

| Choice | Pit location |
| --- | --- |
| **Stage left · Polk** | Near Polk inside the first-floor auditorium. |
| **Stage right · Larkin** | Near Larkin inside the first-floor auditorium. |

The choice moves the Pit area and **all teams assigned to Pit** together. It keeps their statuses, timers, and meal breaks. The setting saves with the board, is included in backups, and supports Undo.

### Map controls

| Control | What it does |
| --- | --- |
| **All** | Show all currently enabled floors. |
| **1, 2, 4** | Show only the selected level. |
| **Add additional location** | Open checkboxes for **Outside of Venue**, **Basement**, and **Third floor**. Each starts hidden. |
| **Outside of Venue** | Show a separate drop box below the floors and an Outside of Venue post on the Dispatch board. Drag teams into either box. |
| **Basement / Third floor** | Show the optional floor, its floor button (**B** or **3**), and its post sections on the Dispatch board. |
| **Rotate arrows** | Turn the map view. |
| **Reset** | Restore the default angle and show All. Your Pit side and additional locations stay selected. |
| **Find a call sign** | Search the Units list. |
| **All units / Not placed on map / On meal break** | Filter the Units list. |

Filtering or rotating the view keeps assignments in place. A team assigned to a hidden floor is still assigned there. Show that floor to see its marker.

Additional-location choices save with the board and backups. Unchecking a location hides it on the map and removes its empty board sections. Assigned teams stay in their existing posts, and the menu shows their count. Check the location again to see its markers. The Outside of Venue box stays visible when switching between floor filters while it is enabled.

The **placed** count shows how many units have a mapped location out of all units. It includes teams on floors that are currently hidden. Long call signs may be shortened above a ball; the full call sign is available in the Units list and roster.

### Units that are not on the map

Units at **No post assigned**, a custom post, or the general **Fixed posts** assignment appear as **Not placed** in the Units list. Choose a specific venue post, such as Pit, Table Service, or a floor and side, to place them on the map.

Leaving the venue unselected keeps existing assignments and returns the 3D tab to **No view**.

## Track meal breaks

Each meal break is timed for **30 minutes**.

1. On the Dispatch board, find the unit under **Meal breaks** and select **Start meal**. On the map, select the unit from the Units list and select **Start meal break**.
2. Check its **Return ETA** and countdown. The unit is excluded from Level while the break is active.
3. When the team returns, select **Clear break** on the Dispatch board or **Return from meal break** in the map's selected-unit panel.
4. Confirm that the team's status and post are current.

**Clear break** records the team's return and keeps the meal-break entry. An early return shows **Back early**. At 30 minutes, an active break changes to **Overdue** and shows how long it has been overdue. It remains active until you mark the team returned.

The returned count shows how many listed units have completed their meal break. **Break pending** means that unit has not started its break.

Meal breaks are separate from status and post. Starting a break does not change either one. The status totals still count the selected status while the team is on break.

The board tracks **one meal break per unit**. After the break is completed, another Start meal button does not appear for that unit. A new shift's unit records start with fresh meal-break tracking.

## Review activity and add shift notes

**Time stamp** records status changes, post reassignments, meal-break starts, and returns. Entries show the call sign and Pacific date and time. Newest entries appear first; scroll inside the panel for older activity.

Use **Shift notes** for operational notes such as coverage changes, radio issues, or handoff details. Notes save as you type and are included in backups.

## Undo a mistake

Select **Undo** to reverse the latest board change. This covers unit changes, post assignments, meal breaks, notes, venue selection, and Pit side. Related activity entries are also rolled back.

You can use **Ctrl+Z** on Windows or **Cmd+Z** on Mac when focus is outside a text field or dropdown. Use the Undo button while editing a field.

Undo keeps up to 100 changes during the current page session. Its history clears when you close or reload the page. Use a downloaded backup for recovery after that point.

On the map, **Escape** cancels an active marker drag or clears the selected unit. Arrow Left, Arrow Right, Home, and End switch the view tabs when a tab has keyboard focus.

## Save, back up, and hand off the board

The board saves automatically in the current browser on the current device. Look for **Saved** near the Add unit controls.

The two app views stay in sync within the open board. Separate devices, browsers, or open copies do not share live updates. Use one active board for your event and transfer it with a backup when needed.

### Download a backup

1. Open **Board tools** near the bottom of the page.
2. Select **Download backup**.
3. Keep the downloaded `.json` file for handoff or recovery.

A backup includes units, statuses, posts, timer start times, meal breaks, custom posts, notes, activity, venue selection, Pit side, and additional locations.

### Restore a backup

1. Open the board on the receiving device or browser.
2. Under **Board tools**, select **Restore backup**.
3. Choose the saved `.json` file.
4. Confirm replacement of the current board.
5. Check the roster, posts, meal breaks, notes, and Pit side.

Download a backup of the current board first if you need to keep it. Restore replaces its contents. Older compatible backups can also be restored; older basement side posts are combined into Basement, and backups without a Pit-side setting use Stage left near Polk.

If the save indicator reports that changes could not be saved, download a backup before closing the board. Private browsing, clearing browser data, or changing browsers can affect access to saved boards.

### Offline use

The self-contained `Event_EMS_Dispatch_Board.html` file includes the board and map for offline use. Keep that file available on the device you plan to use.

The hosted version can reopen offline after its files have been cached successfully. Check offline access on your event device before the shift.

## Practice or start a new shift

Under **Board tools**:

| Button | What it does |
| --- | --- |
| **Load sample units** | Replace the current units, custom posts, notes, and activity with demo data. The selected venue and Pit side are kept. |
| **Clear board** | Remove all units, meal-break records, custom posts, notes, and activity. Restore the default venue post sections. The selected venue and Pit side are kept. |

Both actions ask for confirmation. Download a backup first if you need the current shift's records. Check the venue and Pit side again when preparing the next shift.

## Quick troubleshooting

| What you see | What to check |
| --- | --- |
| **No view** in Venue 3D | Select Bill Graham Civic Auditorium under Venue. |
| A unit is **Not placed** | Choose a specific venue post in its Post dropdown. |
| An assigned unit seems missing from the map | Check the floor filter, **Add additional location** checkboxes, and Units list. |
| Level is lower than the field-unit count | Level includes only roaming field units outside Fixed posts and off meal break. |
| A tap sends a unit to Main Medical | At Medical is part of the tap cycle. Use Undo for an accidental status change. |
| A completed meal has no Start meal button | Each unit has one tracked meal break for that board. |
| Changes seem absent on another device | Download and restore a backup to transfer the board. |

---

## Files

- `index.html`, `board.css`, and `board.js` are the shared app sources.
- `Event_EMS_Dispatch_Board.html` is the self-contained version.
- `sw.js` provides offline caching for the hosted app.

After editing the shared sources, rebuild the standalone page with `python3 scripts/build-standalone.py`.

Deploy the repo to GitHub Pages, or open `Event_EMS_Dispatch_Board.html` directly.

## Checks

Run `node tests/venue-state.test.mjs` for the 59 state and event checks. These cover venue selection, both assignment directions, fixed-post grouping and availability, saved Pit-side selection, Pit, Table Service, street orientation, roaming on Grove, map status taps, drag suppression, unified Basement assignments and large groups, optional locations and persistence, Outside of Venue drops and crowded groups, Unassigned ordering, page and list scrolling during native and pointer drags, the larger fitted three-floor layout, hidden floors, named ball markers, Main Medical transitions, meal breaks, Undo, legacy backups, escaping, and move event handlers using an in-memory DOM fixture. They do not replace visual or device testing in a real browser.
