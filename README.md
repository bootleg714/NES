# My NES Game — play in the browser

A ready-to-use GitHub Pages site that lets people play your NES game in their browser, with no emulator download. Emulation is handled by [JSNES](https://github.com/bfirsh/jsnes).

Features:
- **4 players with a Four Score.** The site emulates the NES Four Score adapter, so games
  that support it (like yours) see controllers 3 and 4. See `fourscore.js`.
- **Online rooms for up to 4 players.** One player creates a room and shares the code or
  invite link; friends join as Players 2, 3 and 4 and can drop in or out mid-game.
- Up to four gamepads on one computer (Players 1–4), keyboard play, and same-keyboard
  2-player (Player 2 on the number pad).
- An on-screen touch gamepad on phones and tablets, with a side-by-side layout when the phone is held sideways.
- Pause/reset, fullscreen, and save/load state (stored in the player's browser).

## Settings

Near the bottom of `index.html`:

- `ROM_URL`: your ROM's file name (default `game/game.nes`).
- `FOUR_SCORE`: `true` plugs in the Four Score (4 players). Set it to `false` for a game that
  doesn't support it; rooms then hold 2 players.
- `INPUT_DELAY`: online input delay in frames (default 5). Raise it to 6–8 if players are far apart.

## How online play works

Each player's browser runs its own copy of the game. Every frame, each player's controller
presses are sent to the host (Player 1), who passes them on to everyone else, so every
screen shows the same game. Connections go directly between browsers; the free
[PeerJS](https://peerjs.com) cloud service only introduces them, so there's no server for
you to run or pay for.

- The person who creates the room is Player 1. Friends who join take the lowest free seat
  (2, 3, then 4). A fifth person is told the room is full.
- **Drop in, drop out.** Joining doesn't restart the game: the newcomer gets a copy of the
  host's game as it is right now and takes over their controller a moment later. When
  someone leaves, their controller goes idle and the seat opens up for someone else.
- Each person controls one player from their device (keyboard, gamepad or touch).
- Pause, reset and save/load are turned off during an online match, since they'd put the
  players out of step. They come back when everyone else has left.
- Every second, each guest's game is compared with the host's. If one ever drifts apart,
  it's automatically corrected from the host's copy.
- If someone's connection is slow, the game briefly waits for them instead of drifting apart.
- If the host leaves, the room closes; everyone else keeps playing offline.
- Some strict networks (certain workplaces, schools or mobile carriers) block direct
  browser-to-browser connections, so a room may not connect there.
- Keep the game tab in front while playing; browsers slow down background tabs.

## Setup

1. **Add your ROM.** Put your game's `.nes` file in the `game/` folder and name it `game.nes`.
   (Using a different name? Change `ROM_URL` near the bottom of `index.html`.)
2. **Personalize the page.** In `index.html`, change the `<title>`, the `<h1>`, and the tagline.
3. **Create the repo.** On GitHub, create a new public repository and upload all of these files
   (including the hidden `.nojekyll` file). Or from a terminal:

   ```bash
   git init
   git add .
   git commit -m "NES game page"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

4. **Turn on Pages.** In the repo, go to **Settings → Pages**, set **Source** to
   "Deploy from a branch", pick `main` and `/ (root)`, and save.
5. After a minute or two your game is live at
   `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

## Testing locally

Browsers won't load the ROM from a `file://` page, so run a tiny local server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Notes

- JSNES and PeerJS are loaded from the unpkg CDN, pinned to versions 2.1.0 and 1.5.5.
- Only publish ROMs you have the right to distribute (your own homebrew is fine).
- Sound starts after the player clicks **Play**; browsers require that.

## License

JSNES is © its authors and licensed under the Apache License 2.0; see `JSNES-LICENSE.txt`.
Your game and the rest of this site are yours to license however you like.
