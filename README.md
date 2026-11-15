# Event EMS Dispatch Board

[Open the board](https://charlotteshixiaoyi.github.io/event-dispatch-board/)

Track teams, post assignments, statuses, and meal breaks during an event.

[Dispatcher guide](#for-dispatchers) · [Development](#development)

## For Dispatchers

### Start a shift

1. Select your **Venue**. Leave it blank if you need custom posts.
2. Enter each team's call sign and select **Add unit**.
3. In **Unit roster**, choose each team's **Status** and **Post**.

### During the event

- **Move a team:** Drag its card to another post, or choose a new **Post** in the roster. Hold near the top or bottom of the screen to scroll while dragging.
- **Update status:** Use the **Status** dropdown, or tap a team card or map ball to cycle through statuses.
- **Main Medical:** Assigning a team here also sets its status to **At Medical**.
- **Fix a mistake:** Select **Undo**.

**Level** shows the number of available roaming teams. Teams at fixed posts or on a meal break are not included.

Teams without a post stay under **No post assigned** at the bottom of the board. Use **Add post** when you need another post section.

### Use the venue map

Select Bill Graham as the venue, then open **Venue 3D**. The board and map show the same teams.

Drag a team onto its destination. You can also select it from the **Units** list, then tap the destination. Tapping a team ball changes its status.

The map starts with the 1st, 2nd, and 4th floors. Under **Add additional location**, check **Outside of Venue**, **Basement**, or **Third floor** as needed. Hiding a location keeps its team assignments.

For **Pit**, choose **Stage left · Polk** or **Stage right · Larkin**. This moves the Pit area and all teams assigned there.

### Track meal breaks

Select **Start meal** beside a team to begin its 30-minute break. The board shows its return time and marks it overdue if needed.

When the team returns, select **Clear break**. On the map, use **Return from meal break**. Then check its status and post.

### Keep notes

Use **Shift notes** for coverage changes or other event notes. **Time stamp** shows recent team updates.

### Back up the board

The board saves automatically in the browser you're using. Look for **Saved** near **Add unit**.

To keep a backup, open **Board tools** and select **Download backup**.

To recover a saved board, select **Restore backup** and choose your backup file. Restoring replaces the board currently on screen.

Download a backup before clearing the board or browser data. If the board says it could not save, download a backup before closing it.

---

## Development

### Stack and prerequisites

Static application built with vanilla JavaScript, HTML, and CSS. The venue map is rendered as SVG. Application state and persistence are handled in the browser; there is no backend or external API integration.

You need a modern browser, Python 3 for the local server and standalone build, and Node.js for tests. There are no package dependencies to install.

### Local development

From the project root, start a static HTTP server:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Refresh the page after source changes; there is no development bundler or hot reload.

For standalone use, open `Event_EMS_Dispatch_Board.html` directly. Service worker registration is disabled for `file:` URLs, so use HTTP to test the hosted app's offline behavior.

### Repository layout

| Path | Responsibility |
| --- | --- |
| `index.html` | Page markup, controls, and asset references. |
| `board.css` | Responsive layouts, component styles, and SVG styles. |
| `board.js` | State transitions, DOM rendering, drag handling, timers, and persistence. |
| `Event_EMS_Dispatch_Board.html` | Generated HTML with embedded CSS, JavaScript, and SVG icon. |
| `scripts/build-standalone.py` | Standalone HTML generator. |
| `tests/venue-state.test.mjs` | State and interaction regression suite. |
| `tests/dom-fixture.mjs` | In-memory DOM and event fixture used by the suite. |
| `sw.js`, `manifest.webmanifest` | Service worker caching and install metadata. |
| `.github/workflows/static.yml` | GitHub Pages deployment workflow. |

### Build

Edit the shared sources in `index.html`, `board.css`, and `board.js`, then regenerate the standalone artifact:

```bash
python3 scripts/build-standalone.py
```

The script writes `Event_EMS_Dispatch_Board.html`. Treat this file as generated output and commit it with the corresponding source changes. The multi-file app can be served directly without a build step.

### Tests

Run the regression suite from the project root:

```bash
node tests/venue-state.test.mjs
```

The suite currently contains 59 checks for assignments, status transitions, drag events, persistence, backup compatibility, and Undo. It runs with Node's built-in modules and an in-memory DOM, without launching a browser.

For UI changes, also verify responsive layout, keyboard interaction, native and pointer dragging, edge scrolling, and service worker behavior in a browser.

### State and persistence

Both views render the same `teams` array. Route team reassignment through `moveTeam()` and status changes through `updateStatus()`. These functions handle Undo snapshots, activity logging, rendering, and saving. A field-post move preserves `statusSince` unless the move also changes status.

`localStorage` uses the key `charlotte-dispatch-board-v1`. Its value and downloaded JSON backups share the structure produced by `serializeBoard()`. State is local to the browser origin; separate devices and open copies do not synchronize.

| Snapshot field | Contents |
| --- | --- |
| `teams` | Records containing `id`, `name`, `status`, `zone`, `location`, `statusSince`, and `mealBreak`. |
| `locations` | Custom posts with `id` and `name`. |
| `notes` | Shift notes. |
| `handoffLog` | Activity entries with `at`, `team`, and `message`. |
| `venue`, `venueBoardPosts` | Venue selection and configured venue post IDs. |
| `pitSide` | `stage-left` or `stage-right`. |
| `additionalVenueLocations` | Enabled optional IDs: `outside`, `b`, and `3`. |

Status values are `roaming`, `onscene`, `transporting`, and `atclinic`. Timestamps are Unix milliseconds; displayed times use `America/Los_Angeles`.

For current placement, use `zone` together with `location`: `clinic-zone` means Main Medical, while `location` can retain the previous field post. `mealBreak` is `null` before a break; an active break has `startedAt` and a null `returnedAt`.

`readBoard()` validates and normalizes persisted state and imported backups. Preserve the storage key and support older snapshots when changing the schema. Current migrations merge legacy basement side posts into `venue-b-basement`; absent Pit and optional-location settings default to stage left and no optional locations.

Undo history is session-only and limited to 100 changes. It is not included in backups. `handoffLog` contains human-readable activity messages and can be rolled back by Undo; it is not an immutable event log.

### Deployment and caching

The GitHub Pages workflow deploys the repository root on pushes to `main` or a manual workflow run. Configure the repository's Pages source as **GitHub Actions**. For another static host, serve `index.html` and its relative assets together.

Navigation requests use the network with a cached fallback. Listed assets use the cache first. When changing hosted CSS or JavaScript, increment the cache version in `sw.js` and keep its asset URLs aligned with the versioned references in `index.html`. Include the regenerated standalone artifact in the same change.

### Contributing

Keep changes focused. Add regression coverage for changed behavior, run the suite, and rebuild the standalone artifact when shared sources change. For state changes, include save/reload, legacy backup restoration, and Undo in verification. Describe any manual browser checks in the pull request.

---

Created by Charlotte Shi, EMT-B.
