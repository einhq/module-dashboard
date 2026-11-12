DASHBOARDS: pages of cards that someone arranges — the time, what is coming up, a picture of the day, a device's readings, a todo list — shown on a page, full screen on a wall, and on screens that never sign in.

WHAT THEY ARE: a dashboard is the file /archive/dashboards/<title>.yaml, and the commands take its title. Its cards go in order across a grid of columns (12 unless set), each <columns>x<rows> cells. A card is one a module offers, named <module>.<name>: dashboard.clock, dashboard.coming-up, dashboard.reading, archive.picture, todo.list. A card on a dashboard has an id of its own (k7q2), which dashboard-show lists, and settings for what it shows (a device, a list, how many days ahead).

WHICH COMMAND FOR DASHBOARDS:

- Which dashboards there are: dashboards. What is on one, and its cards' ids: dashboard-show <title>. Never guess a card's id.
- The dashboard on screen — "this dashboard", "den här dashboarden": the page stamp's route /dashboards/<title> or /dashboard-wall/<title> names it, URL-encoded (%20 a space): decode it.
- Which cards could go on one: dashboard-cards --brief. What one card's settings take, before setting any: dashboard-cards <card>. Its params say each setting's type and choices; x-choices names the command that lists a setting's values — devices for a device, device-show <device> for its readings, todo-lists for a list. Run that command and use a value it gives; never make one up.
- Adding a card: dashboard-card-add <title> <card> --with <setting>=<value> (again for each; a list as a,b), --size <columns>x<rows> only when the user asks for a size. A reading of a device ("the temperature in the hall"): dashboard.reading with device= and endpoint=; all of a device's readings and switches: dashboard.device.
- Making one — "make a kitchen dashboard with a clock and the birthdays": one run_command of lines, dashboard-create <title> first and then a dashboard-card-add for each card, in the order they go. --share private when it is for the user alone.
- Changing a card — its size, what it shows, its place, its title: dashboard-card-set <title> <id>. Taking one off: dashboard-card-remove <title> <id>. dashboard-show first, for the id.
- The dashboard itself — a new title, its colour, its columns, dimming its wall at night (--dim 22:30-06:30@0.3): dashboard-set. One laid out as another: dashboard-copy.
- A screen that never signs in — "put it on the hall screen": share-link create /archive/dashboards/<title>.yaml --as <account> --never. The screen sees the dashboard as that account does and changes nothing; the account is one the screen has, never an administrator.
- These writes are proposals the user confirms afterwards, so do not ask first, and never use one to answer a question.
