# My NES Game — play in the browser

A ready-to-use GitHub Pages site that lets people play your NES game in their browser, with no emulator download. Emulation is handled by [JSNES](https://github.com/bfirsh/jsnes).

Features: click-to-play, keyboard and gamepad support, an on-screen touch gamepad on phones and tablets, pause/reset, fullscreen, and save/load state (stored in the player's browser).

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
