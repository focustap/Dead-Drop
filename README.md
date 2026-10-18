# DEAD DROP

A browser-based co-op horror game set in one claustrophobic hideout.

## Play
Host the front end with **GitHub Pages**. Solo is playable without a server; select **SOLO NIGHT**.

For co-op, deploy the included **Render** `render.yaml` as a new Node web service. Paste that service's HTTPS origin into **MULTIPLAYER SERVER**, choose **HOST CO-OP**, and share your room code (up to four players). Players move through the same 3D room and share the bank, the supply inventory, the door and alley visitors.

**No changes to Cold Call Chaos are required.**

## Controls
WASD to move; mouse to look; E to interact; Escape to exit the workstation. At a terminal, enter `help` to see all commands.

Try:
```text
targets
connect NOVA-17
ls
cd finances
cat budget.txt
scrape
cd scrape backups
```

Scan folders, test recovered REC codes in Black Market, and sell verified records. Wrong numbers produce nothing. Every third scan triggers an intrusion: complete the displayed arrow/WASD sequence in time to secure your wallet.

Order supplies from Production, inspect the supply entrance, and collect parcels. Start a crop, harvest, wrap inventory, watch the CCTV feed, and release a package to a waiting buyer. Some visitors are thieves or intruders; inspect the door before opening.

## Architecture
- Three.js: the room and moving players, rendered in each browser.
- HTML/CSS: in-game terminal and market interface.
- Shared JavaScript logic: `shared/core.js` contains state, generated computers, scoring, inventory and threats.
- Socket.IO + Node: optional server-authoritative co-op; solo runs the same core in-browser.
- Three.js and the multiplayer client are bundled locally into `dist/`; no external runtime CDN is needed. No AI API or paid services are required.

This is **prototype 0.1**: the 3D room, navigation, customer-data searching, market verification, supply loop and one intrusion type. Persistence, sound design, threat animations, procedural complexity and production-grade reconnection will come later.

## Development
```bash
npm install
npm test
npm run build
npm start
```
Open `http://localhost:3000/`.

## Deployment
GitHub Pages builds from `.github/workflows/pages.yml`. Set Pages **Build and deployment** source to **GitHub Actions** if not already enabled. Render uses `render.yaml` for a new service. Render Free may sleep when inactive and rooms are currently kept in memory.
