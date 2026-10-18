# DEAD DROP

A first-person co-op horror game for one to four people. Run an underground operation from a shared apartment, make the deadline, and watch who comes to the door.

## Play

The GitHub Pages build supports **SOLO NIGHT** without a backend. For co-op, deploy the included `render.yaml`, enter that service's HTTPS origin under **MULTIPLAYER SERVER**, select **HOST CO-OP**, and share the six-character room code. Joiners enter the same server origin and code.

**WASD** moves relative to the camera, **mouse** looks, **Shift** runs, **E** interacts, and **Escape** exits a station/view or opens help and settings. Click the room to capture the mouse. Help contains sensitivity, volume, and graphics settings, saved on that device. The night continues while menus are open.

## The operation

Six four-minute nights provide 24 minutes of active play. The crew has **three full nights** for each wallet quota: **$2,550 due after night 3**, then **$4,550 due after night 6**. There are no daily collections, rent deductions, daily quota penalties or quota heat penalties on nights 1, 2, 4 and 5. The HUD shows the required cycle quota, available wallet balance and nights remaining. Supplies, equipment and losses reduce the money available to pay.

At the end of nights 3 and 6 the authoritative room settles the full quota **exactly once**. Enough cash means the quota is deducted and the crew continues (or wins after night 6). Too little cash calls **The Collector**: a brief arrival, a shared fatal jumpscare, then the run ends. There is no normal advance or recovery after failed payment. The Collector never appears in the random encounter pool. Each dawn still shows income, purchases, losses and any actual quota payment; upgrades, supplies and growing progress carry forward.

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

Read files and dispatches, recover REC codes, verify them and sell the useful fragments. Decoys pay nothing, and a record can be sold only once by the whole crew. Targets and contracts replenish every 40 seconds. Later nights introduce higher-value archives and hidden cache folders; tier 3 requires the decoder upgrade. Scraping has an eight-second cooldown; the first probe recovers its folder reliably, while later probes have a 55% recovery chance. Record prices are lower ($85/$115/$185 base). A rare probe can attract an arrow/WASD intrusion; hacks have a shared 90-second cooldown and can start only while an operator is actively using a nearby computer. The server clears computer activity on exit, movement, hiding or disconnect. Leaving a live real attack settles its loss once; it does not reset the cooldown or queue a future attack. Training requires the computer too and pays no reward. Later nights lengthen their sequences; a firewall gives four extra seconds and a vault reduces losses.

**Browser** has an address bar, history, bookmarks and seven distinct local websites:

| Website | Function |
| --- | --- |
| nightjar.onion | Buy seeds, substrate and sealing sleeves; collect courier deliveries |
| wire.onion | Reserve memory relays or timing-based intercepts; inspect archive tiers |
| ledger.onion | Verify and sell recovered records |
| relay.onion | Buy permanent security and production upgrades |
| hush.onion | Read dispatches and send messages to the crew |
| signal.onion | Learn visitor behavior, electrical warnings and archive hints |
| threats.onion | Operator field notes covering every threat, warning, counter and consequence |

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
- Empty-handed visitors test the lock. An unlocked door breaches after ten seconds of waiting; locking or setting the chain prevents it. Deliberately opening for one also triggers a scare, loss and damaged breaker.
- A buzzing ballast gives twelve seconds to visit the hallway fuse box opposite apartment 204. Use the peephole, unlock the bolt, and select ENTER HALLWAY. Walk to the fuse box and press E. Return to door 204 and press E; it locks behind you. Waiting for a hallway threat to leave is safe: the outage has no repair deadline. An outage stops computer work and plant growth until repaired.
- Camera interference clears after ten seconds, or four with shielded wiring. Wait for a clear view before dropping goods.
- Later nights shorten encounter spacing, from roughly 74–88 seconds to 51–65 seconds, with at least 30 seconds of recovery after a major encounter. Window and hallway threats join the pool from night two. Harmless bangs and distant courtyard pedestrians provide uncertainty between attacks.

The hallway extends past multiple numbered apartments, with approach/leave animations, fixtures and a distorted circular peephole. The wall monitor and fullscreen CCTV share one live render target. No UI marks visitors GOOD or BAD; observation text describes visible behavior.

### Surviving the new encounters

**The Window Prowler** is a modeled person who crosses the courtyard over eight seconds, stops at the glass and looks inside. Approach the window and **hold E continuously for five seconds** to pull and keep both curtains shut. Animated fabric, sleeves and hands show the physical action. One operator protects the entire crew. Releasing early resets progress and advances the intrusion deadline to at most 6.5 seconds away. A different operator starts a fresh hold; progress cannot be pooled. Movement, another station, lost key contact or disconnection interrupts the hold. A successful hold makes the prowler turn and walk back through the courtyard. The wardrobe remains a last-resort individual hiding place after a breach.

The window overlooks an actual 3D service courtyard with wet paving, puddles, animated rain, lit apartment windows, worn brick buildings, fire escapes, dumpsters, rubbish, fencing and shadow-casting exterior lights. Distant pedestrians and occasional motionless observers follow shared room time. Fixed courtyard meshes are batched by material to limit rendering overhead; no images or external assets are used as scenery.

**The Tenant** approaches with heavy footsteps and a red hallway light. Check the peephole and wait inside through its ten-second patrol. Operators already in the hallway have twelve seconds to return to door 204. Being caught forces the operator inside. The corridor retains its existing architecture; entering and returning use the physical door interaction rather than opening free movement through walls.

Caught operators see a close-up figure, hear a distinctive sting, lose carried harvest, and need six seconds to recover. A major encounter charges the shared wallet **once**, capped at $240; it does not multiply the charge per player. New arrivals during an encounter get twelve seconds of protection. Hiding and remote sessions survive the existing authenticated reconnection lease. The lock is shared, and the server validates positions, zones, hiding, deadlines and payouts. Actual major encounters and digital intrusions never overlap. The rain continues underneath sparse taps, footsteps and distant impacts; all sounds obey Volume.

### Remote computers and evidence work

Visit **wire.onion → LATTICE / DIRECT CONNECTIONS → MOUNT**. The **REMOTE** application provides the circuit, folders, file list and document viewer. These `lattice://` addresses are invented internal game routes; no external computer is contacted.

1. Link the voltage relays from lowest to highest. Three mistakes across the whole job burn the target; disconnecting does not erase its trace.
2. Read `brief/read-first.txt`, then inspect the mail, logs and vault folders.
3. **Rotated archive:** decode an alphabet-rotation seal using a separate key memo, submit it and extract the payload.
4. **Counterfeit handoff:** cross-check the sender and batch across documents, then extract the one matching manifest. Lookalike manifests contain invalid evidence.
5. **Three-hop dead signal:** reconstruct a chronological route from three logs and a dispatch, submit it and extract the bundle before the shorter lease expires.
6. Sell extracted evidence under **LOCAL EVIDENCE** on **ledger.onion** or the existing RECORDS tab. The whole crew can settle an extraction, but only once. Payouts ($240–$370) count toward contract income and campaign quotas.

Remote leases run for 150 seconds (95 for timed routes); physical encounters and power outages pause them. Leave the computer with Escape to handle danger, then resume through REMOTE. Memory and carrier contracts remain available and can be abandoned with their new button. Contacts replenish with the existing archive cycle; tiers unlock by night, and tier three requires the decoder. The server keeps puzzle solutions and other players' file sessions out of public state.

## Architecture and deployment

- `shared/core.js`: authoritative actions, generated targets, contracts, visitors and simulation ticks.
- `shared/campaign.js`: three-night wallet settlement, fatal Collector phase, catalog and visitor phases.
- `shared/horror.js`, `shared/remote.js`, `shared/npc.js`: coordinated encounters, remote jobs, and direction-aware visitor routes.
- `shared/layout.js`: furniture collision and station interaction positions, shared by client and server.
- `server/index.js`: Express/Socket.IO rooms, rate limits, authoritative movement and reconnect leases.
- `src/app.js`, `src/browser.js`: OS, station UI, browser routes, HUD and input.
- `src/world.js`, `src/security.js`, `src/courtyard.js`, `src/surfaces.js`: Three.js geometry, character animation, camera rendering and procedural surface maps.
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

Mechanics tests cover the campaign's win/loss conditions, economy, growing, resource ownership, collision, power counterplay, contract timing and four-client reconnection. Mechanics/socket tests also cover per-player hiding, shared breach penalties, threat exclusion/recovery, circuit mistakes, evidence ownership, secret-state boundaries and remote reconnection. Browser tests cover the original terminal flows, websites, memory contracts, shared rooms, campaign summaries, startup failures a remote archive solved by reading its documents and selling its evidence, an on-screen window scare, and a complete co-op physical production/delivery route including the hallway breaker, courtyard, a real five-second E hold on the curtains, and wardrobe. A separate browser flow verifies that attacks stop when the computer closes. The physical browser fixture advances visitor travel and crop maturity and holds visitor/night deadlines open during slow software-rendered captures; the unit tests separately advance the actual growth simulation. Screenshots are written to `test-results/` for visual review.

## Remaining polish

The integrated loop is implemented. Further art and balance work remains: richer clothing meshes and hand animations, further procedural document and puzzle variety, spatial/recorded ambient audio, and broad hardware/browser performance testing. Wet surfaces use inexpensive specular shading rather than planar reflections. Persistent saves and recovery across backend restarts are not included. Touch/gamepad controls are not implemented. Playtesting with a full crew is still needed to tune the 24-minute economy beyond automated coverage.
