# My NES Game — play in the browser

A ready-to-use GitHub Pages site that lets people play your NES game in their browser, with no emulator download. Emulation is handled by [JSNES](https://github.com/bfirsh/jsnes).

Features:
- **Online 2-player rooms.** One player creates a room and shares the code or invite link; a friend joins as Player 2.
- Keyboard and gamepad support, plus same-keyboard 2-player (Player 2 on the number pad).
- An on-screen touch gamepad on phones and tablets, with a side-by-side layout when the phone is held sideways.
- Pause/reset, fullscreen, and save/load state (stored in the player's browser).

## How online play works

Each player's browser runs its own copy of the game, and the two browsers send each other
their controller presses every frame, so both screens show the same game. Connections go
directly between the players' browsers; the free [PeerJS](https://peerjs.com) cloud service
only introduces them, so there's no server for you to run or pay for.

- The person who creates the room is Player 1; whoever joins is Player 2. The game restarts
  from the beginning for both when Player 2 joins.
- Pause, reset and save/load are turned off during an online match, since they'd put the
  two players out of step.
- Every second the two games are compared. If they ever drift apart, Player 2's game is
  automatically corrected from Player 1's.
- If the connection is slow, the game briefly waits for the other player instead of
  drifting apart. For players far apart, raise `INPUT_DELAY` (near the bottom of `index.html`)
  to 6–8.
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

- JSNES is loaded from the unpkg CDN, pinned to version 2.1.0.
- Only publish ROMs you have the right to distribute (your own homebrew is fine).
- Sound starts after the player clicks **Play**; browsers require that.

## License

JSNES is © its authors and licensed under the Apache License 2.0; see `JSNES-LICENSE.txt`.
Your game and the rest of this site are yours to license however you like.
