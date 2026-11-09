# Event EMS Dispatch Board

[Open the Dispatch Board](https://charlotteshixiaoyi.github.io/event-dispatch-board/)

Created by Charlotte Shi, EMT-B. Track unit post assignments, dispatch status, and time in status during an event.

## Preview locally

Run `python3 -m http.server 8000` from this directory and open `http://localhost:8000/`. No build step or external dependencies are required.

## Use with GitHub Pages

Commit the contents of this package to your Pages source folder. Keep `index.html`, `.nojekyll`, and the other files together. In **Settings → Pages**, choose **Deploy from a branch** and select the branch and folder containing the files. GitHub Pages accepts the branch root or its `/docs` folder. If Pages is already configured, a push to its publishing source can publish these files automatically.

[GitHub Pages publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Run a shift

- Add units by radio call sign and set up field posts.
- Tap a tile to cycle through Roaming, On scene, Transporting, and At Medical. Use the roster to set a specific unit status or post.
- Reassign a unit by dragging its tile or using the roster’s post menu.
- Level counts available roaming field units and stays visible beside the Pacific clock as you scroll. It excludes units at fixed posts or on meal break.
- Under **Meal breaks**, click **Start meal** to begin a 30-minute countdown for a unit. The unit’s tile and roster row turn gray. The tracker shows the expected return time in Pacific time and flags overdue units. Click **Clear break** when the unit is back on assignment.
- The **Shift handoff log** records post reassignments, status changes, and meal breaks with Pacific timestamps, newest first. Undo removes the entries created by the change it reverses.
- Use **Board tools** to load sample units, download or restore a backup, or clear the board. Undo is available for the current page session.

Units, posts, timers, meal breaks, shift notes, and the handoff log save in the current browser profile for this site. Use a backup to transfer a board to another browser or device. Keep patient information out of shift notes and keep backup files out of the repository.

On supported browsers the app can be installed and reopened offline after its first successful online load.
