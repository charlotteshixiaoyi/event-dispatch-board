# Event EMS Dispatch Board

Created by: Charlotte Shi, EMT-B (<charlotteshixiaoyi@berkeley.edu>)

A browser-based status board for event medical dispatch. Displays team call signs, operational status, assigned locations, time in status, and the current Level number. Runs locally from a single HTML file without internet connection.

## Features

- **Unit status:** Color-coded indicators for Roaming, On scene, Transporting, and At clinic.
- **Time in status:** An elapsed timer beneath each call sign, reset upon a status change.
- **Status and assignment updates:** Click or tap a team to cycle its status. Reassign locations by drag and drop or through the team roster dropdowns.
- **Field assignments:** Configurable field locations and a separate main medical clinic area.
- **Fixed posts:** A crosshatched area for teams assigned to stationary posts, including pit or table service. These teams remain at their assigned post and are unavailable to respond to calls elsewhere.
- **Level number:** A live count of teams marked Roaming in field operations, excluding fixed-post assignments.
- **Other Helpful Features:** Pacific time with seconds, shift notes, undo, and automatic browser-local saving.

## Operation

1. Download the HTML file and open it in a browser with JavaScript enabled.
2. Remove the sample teams and enter the assigned call signs.
3. Configure field locations and update team status and assignments throughout the operational period.

Selecting a team tile cycles through **Roaming → On scene → Transporting → At clinic → Roaming**. Use the roster's Status dropdown for direct selection. Teams marked At clinic appear in the main medical clinic area.

## Data storage

Team assignments, statuses, status start times, and shift notes save in the current browser when local storage is available. Saved data does not modify the HTML file or synchronize across devices. Distributing the file does not transfer the active board. Undo history is limited to the current page session.

Mobile use requires a browser that executes JavaScript. Static file previews do not support board controls or timers.
