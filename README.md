# Event EMS Dispatch Board

Created by Charlotte Shi, EMT-B. Track team locations, dispatch status, and time in status during an event.

[Open the Dispatch Board](https://charlotteshixiaoyi.github.io/event-dispatch-board/)

## Preview locally

Run `python3 -m http.server 8000` from this directory and open `http://localhost:8000/`. No build step or external dependencies are required.

## Use with GitHub Pages

Commit the contents of this package to your Pages source folder. Keep `index.html`, `.nojekyll`, and the other files together. In **Settings → Pages**, choose **Deploy from a branch** and select the branch and folder containing the files. GitHub Pages accepts the branch root or its `/docs` folder. If Pages is already configured, a push to its publishing source can publish these files automatically.

[GitHub Pages publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Run a shift

- Add teams by radio call sign and add any field locations you need.
- Tap a tile to cycle through Roaming, On scene, Transporting, and At clinic. Use the roster to set a specific status or location.
- Move a team by dragging its tile on desktop or by using the roster's location menu.
- Level counts roaming field teams and excludes teams at fixed posts.
- Use **Board tools** to load sample teams, download or restore a backup, or clear the board. Undo is available for the current page session.

Teams, locations, timers, and shift notes save in the current browser profile for this site. Use a backup to transfer a board to another browser or device. Keep patient information out of shift notes and keep backup files out of the repository.

On supported browsers the app can be installed and reopened offline after its first successful online load.
