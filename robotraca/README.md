# Robotraca Music Player

## Overview
Robotraca is a static web project that features a retro sci-fi themed music player. The player allows users to listen to two MP3 tracks and is designed to auto-play when accessed via a QR code.

## Project Structure
The project consists of the following files and directories:

- `index.html`: The main HTML document that sets up the structure of the web page.
- `css/style.css`: Contains styles for the web page, providing a retro sci-fi aesthetic.
- `js/player.js`: JavaScript code that manages the audio player functionality, including auto-play.
- `audio/track1.mp3`: The first audio track.
- `audio/track2.mp3`: The second audio track.
- `README.md`: Documentation for the project.
- `.nojekyll`: Prevents GitHub Pages from processing the site with Jekyll.

## Setup Instructions
1. Clone the repository to your local machine.
2. Navigate to the `robotraca` directory.
3. Open `index.html` in a web browser to view the music player.

## Deploying to GitHub Pages

Option A — Deploy this folder as a GitHub Pages site:

1. Create a GitHub repository from the contents of this folder (or make this folder the repository root).
2. Push to `main` (or `master`).
3. If you added the workflow at `.github/workflows/deploy.yml`, it will publish the site to the `gh-pages` branch on push.
4. In the repository Settings → Pages, select the `gh-pages` branch as the source (if necessary). Your site will be available at `https://<username>.github.io/<repository>/`.

Option B — Serve from `main` branch / docs/ or use repository Pages settings directly.

Note: The included workflow publishes the current folder. If you keep this project as a subfolder in a larger repo, adjust `publish_dir` in the workflow or create a workflow at the repository root that points to this subfolder (for example `publish_dir: ./robotraca`).

## Autoplay via QR code

To trigger autoplay from a QR code (or any link), append query parameters to the page URL:

- `?autoplay=1` — attempt to autoplay when the page opens
- `&track=2` — choose which track to start (1 or 2)

Example: `https://<username>.github.io/<repo>/index.html?autoplay=1&track=2`

Important: Many browsers restrict autoplay with sound unless the user interacted with the page. The player attempts to play automatically; if the browser blocks it, an overlay will prompt the user to tap to start playback.

## Adding your MP3s

Place your files in the `audio/` folder with these filenames:

- `audio/track1.mp3`
- `audio/track2.mp3`

You can rename files and update `js/player.js` if you prefer different names.

## Notes

- UI inspired by the CassettePlayer demo (Tympanus) but implemented here as a lightweight custom player with a retro sci‑fi aesthetic.
 - Uses the original CassettePlayer demo assets (adapted) from Tympanus/Codrops. Visual assets credited in the demo (cassette PSD by Mauricio Estrella). Please check the demo page for original license notes.
- If you want help generating QR codes or deploying to GitHub Pages from this workspace, tell me and I can add a small action or generate PNGs for you.

Enjoy the retro vibes!