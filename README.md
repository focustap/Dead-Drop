# DEAD DROP

A first-person co-op horror game for one to four people. Run an underground operation from a shared apartment, make the deadline, and watch who comes to the door.

## Play

The GitHub Pages build supports **SOLO NIGHT** without a backend. For co-op, deploy the included `render.yaml`, enter that service's HTTPS origin under **MULTIPLAYER SERVER**, select **HOST CO-OP**, and share the six-character room code. Joiners enter the same server origin and code.

**WASD** moves relative to the camera, **mouse** looks, **Shift** runs, **E** interacts, and **Escape** exits a station/view or opens help and settings. Click the room to capture the mouse. Help contains sensitivity, volume, and graphics settings, saved on that device. The night continues while menus are open.

## The operation

Six four-minute nights provide 24 minutes of active play, plus time reviewing shift summaries. Daily gross-income quotas are **$650, $850, $1,050, $1,250, $1,500, $1,800**. A missed daily quota incurs a fee and extra heat; earnings are pooled across each three-night cycle, allowing the crew to recover. Fail a cycle's combined quota and the operation closes. Clear both cycles to win. Wallet, upgrades, supplies and growing progress carry into the next night. Supplies and equipment spending does not subtract from gross quota income, but does reduce the shared wallet.

Each night ends with hacking income, contract income, delivery income, expenses, wallet losses, net earnings and quota progress. Rent starts at $55 and rises $10 each night. One crew member can advance from the shared summary.

### Computers

The existing shell commands remain available:

```text
help
targets
connect NOVA-17
ls
cd finances
cat budget.txt
scrape
cd scrape backups
disconnect
training
```

Read files and dispatches, recover REC codes, verify them and sell the useful fragments. Decoys pay nothing, and a record can be sold only once by the whole crew. Targets and contracts replenish every 40 seconds. Later nights introduce higher-value archives and hidden cache folders; tier 3 requires the decoder upgrade. Repeated scans attract arrow/WASD intrusions. Later nights lengthen their sequences; a firewall gives four extra seconds and a vault reduces losses.

**Browser** has an address bar, history, bookmarks and six distinct local websites:

| Website | Function |
| --- | --- |
| nightjar.onion | Buy seeds, substrate and sealing sleeves; collect courier deliveries |
| wire.onion | Reserve memory relays or timing-based intercepts; inspect archive tiers |
| ledger.onion | Verify and sell recovered records |
| relay.onion | Buy permanent security and production upgrades |
| hush.onion | Read dispatches and send messages to the crew |
| signal.onion | Learn visitor behavior, electrical warnings and archive hints |

These addresses are internal routes. All targets and records are generated game data; no external networks or personal financial records are accessed.

### Physical production and delivery

1. Buy seed capsules from the computer. The apartment starts with substrate and two sleeves.
2. Walk to the actual supply door and use its peephole. A courier carries a taped parcel, approaches, waits, then leaves. Open only when they are waiting. Uncollected orders return on a later courier route.
3. At the grow tent, tip substrate into the pot, place a capsule, pour water and keep the lamp on. Growth requires moisture and power. A crop takes 60 seconds of growing time, or 42 with the lamp upgrade.
4. Cut the mature crop and carry it to the separate packing table. Set the harvest down, then fold and seal sleeves. The shared inventory shows the resulting packages.
5. Inspect the live alley feed. Buyers check a glowing phone beside the red tray; thieves look around from the shadows. Walk to the chute to release a package after the visitor reaches the tray. A legitimate pickup pays $210 on night one, rising $20 each night. A thief takes the package without payment.

The tent, plants, packages, carried harvest and player movements are visible to teammates. Production controls are available only at the appropriate physical station. The server checks distance, inventory and reward ownership.

### Threats and observation

- Wallet intrusions use arrows or WASD. A wrong key or expired timer loses a bounded percentage of the wallet.
- Empty-handed visitors lean toward the lock. Opening for one loses cash and trips the breaker; setting the chain sends them away.
- A buzzing ballast gives twelve seconds to reset the fuse box beside the door. An outage stops computer work and plant growth until repaired.
- Camera interference clears after ten seconds, or four with shielded wiring. Wait for a clear view before dropping goods.
- Heat and later nights shorten the interval between incidents.

The hallway extends past multiple numbered apartments, with approach/leave animations, fixtures and a distorted circular peephole. The wall monitor and fullscreen CCTV share one live render target. No UI marks visitors GOOD or BAD; observation text describes visible behavior.

## Architecture and deployment

- `shared/core.js`: authoritative actions, generated targets, contracts, visitors and simulation ticks.
- `shared/campaign.js`: campaign rules, economy, catalog and visitor phases.
- `shared/layout.js`: furniture collision and station interaction positions, shared by client and server.
- `server/index.js`: Express/Socket.IO rooms, rate limits, authoritative movement and reconnect leases.
- `src/app.js`, `src/browser.js`: OS, station UI, browser routes, HUD and input.
- `src/world.js`, `src/security.js`, `src/surfaces.js`: Three.js geometry, character animation, camera rendering and procedural surface maps.
- `src/audio.js`: synthesized rain, hum and event feedback, with no audio downloads.

The frontend bundles Three.js and Socket.IO locally; no paid services or AI APIs are required. Pages publishes the compiled `dist/` directory. Select **GitHub Actions** as the Pages deployment source. Render runs the Node backend and also serves the built frontend.

Co-op state lives in server memory. A disconnected player's slot, terminal and carried inventory are retained for **two minutes**, with automatic token-based reconnection while the page remains open. After expiry, carried harvest returns to shared stock. Rooms are removed when their final lease expires. A page reload creates a new player session; a backend restart loses active rooms. Solo progress lasts for the current page session.

## Development and verification

Use Node 20 or newer (CI uses Node 22):

```bash
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm start
```

Open `http://localhost:3000/`. On Linux CI, install Chromium with `npx playwright install --with-deps chromium`.

Mechanics tests cover the campaign's win/loss conditions, economy, growing, resource ownership, collision, power counterplay, contract timing and four-client reconnection. Browser tests cover the original terminal flows, websites, memory contracts, shared rooms, campaign summaries, startup failures and a complete co-op physical production/delivery route. The physical browser fixture advances visitor travel and crop maturity; the unit tests separately advance the actual growth simulation. Screenshots are written to `test-results/` for visual review.

## Remaining polish

The integrated loop is implemented. Further art and balance work remains: richer clothing meshes and hand animations, more varied procedural documents and contract types, spatial/recorded ambient audio, and broad hardware/browser performance testing. Wet surfaces use inexpensive specular shading rather than planar reflections. Persistent saves and recovery across backend restarts are not included. Touch/gamepad controls are not implemented. Playtesting with a full crew is still needed to tune the 24-minute economy beyond automated coverage.
