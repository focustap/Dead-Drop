# DEAD DROP

A first-person co-op horror game for one to four people. Run an underground operation from a shared apartment, make the deadline, and watch who comes to the door.

## Play

The GitHub Pages build supports **SOLO NIGHT** without a backend. For co-op, deploy the included `render.yaml`, enter that service's HTTPS origin under **MULTIPLAYER SERVER**, select **HOST CO-OP**, and share the six-character room code. Joiners enter the same server origin and code.

**WASD** moves relative to the camera, **mouse** looks, **Shift** runs, **E** interacts, and **Escape** exits a station/view or opens help and settings. Click the room to capture the mouse. Help contains sensitivity, volume, graphics, and **Reduce flashes, shake & audio peaks** settings, saved on that device. The night continues while menus are open.

## The operation

Six four-minute nights provide 24 minutes of active play. The crew has **three full nights** for each wallet quota: **$2,550 due after night 3**, then **$4,550 due after night 6**. There are no daily collections, rent deductions, daily quota penalties or quota heat penalties on nights 1, 2, 4 and 5. The HUD shows the required cycle quota, available wallet balance and nights remaining. Supplies, equipment and losses reduce the money available to pay.

At the end of nights 3 and 6 the authoritative room settles the full quota **exactly once**. Enough cash means the quota is deducted and the crew continues (or begins the successful Collector offer after night 6). Too little cash calls **The Collector**: a brief arrival, a shared fatal jumpscare, then the run ends. There is no normal advance or recovery after failed payment. The Collector never appears in the random encounter pool. Each dawn still shows income, purchases, losses and any actual quota payment; upgrades, supplies and growing progress carry forward.

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

**Browser** has an address bar, history, bookmarks and nine distinct local websites:

| Website | Function |
| --- | --- |
| nightjar.onion | Buy seeds, substrate and sealing sleeves; collect courier deliveries |
| wire.onion | Accept recovery, investigation, timed remote, physical delivery and asset contracts |
| exchange.onion | Trade six companies with shared holdings, price charts, news and fees |
| afterhours.onion | List sealed stock, negotiate with receivers and schedule physical pickups |
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
5. Open **afterhours.onion** and list unreserved sealed parcels. Receivers have different quantities, private budgets, personalities, patience and reliability labels. Counteroffer in whole dollars with an optional message, accept the current total, or walk away. Excessive demands exhaust patience. All economic decisions use built-in rules; there is no AI service or API key.
6. Accepting a deal reserves its quantity for the crew. Only one pickup can be scheduled at once. The receiver arrives in 18 seconds and waits **30 seconds**. Match the pickup code in the deal notification/CCTV readout and the phone beside the red tray. At the physical chute, **E** delivers the required quantity from shared stock and pays the negotiated total exactly once. Missed pickups release reservations and pay nothing. Major physical encounters pause pickup deadlines.
7. Random alley visitors are thieves, strangers, uniformed police, dumpster searchers and harmless pedestrians. They never create ordinary sales. An unconfirmed drop risks an unreserved parcel without payment; reserved inventory cannot be stolen by another player spamming the chute.

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

Caught operators see a rapid camera lunge with threat-specific models and lighting, brief camera shake and screen disruption, and hear a layered threat-specific sting, lose carried harvest, and need six seconds to recover. A major encounter charges the shared wallet **once**, capped at $240; it does not multiply the charge per player. New arrivals during an encounter get twelve seconds of protection. Hiding and remote sessions survive the existing authenticated reconnection lease. The lock is shared, and the server validates positions, zones, hiding, deadlines and payouts. Actual major encounters and digital intrusions never overlap. The rain continues underneath sparse taps, footsteps and distant impacts; all sounds obey Volume. Audio passes through a compressor, and Reduce flashes, shake & audio peaks caps transient tones and noise, disables camera shake, and reduces lighting disruption. The Collector uses a sealed metallic mask, case and low layered impact; the prowler has modeled eyes and a mouth.

**Faces on the Landing** are rare harmless 3D peephole events: a close face, distant watcher, passerby who stops and turns, or a delayed face after an empty view. An eligible physical peephole check has a 16% chance, with a two-minute crew cooldown. No wallet penalty applies.

**The Other Occupant** is an extremely rare alternate failed-curtain outcome (2.5%, at most once per campaign run). If nobody is already hiding, the human prowler may enter quietly, visibly cross the room and occupy the wardrobe for about 95 seconds. Watch for the ajar door and faint scratches. Attempting to hide inside catches that operator; other crew members remain unaffected by the personal scare. Stay away until the door settles. No new window encounter can begin while the wardrobe is occupied. A hiding operator always retains the ordinary wardrobe defense.

### Remote computers and evidence work

Visit **wire.onion → LATTICE / REMOTE CONTRACTS → ACCEPT & MOUNT**. REMOTE opens an invented desktop inside the existing OS; the original terminal remains separate. No external computer is contacted.

1. Link voltage relays from lowest to highest. Three circuit/key mistakes burn the target and charge the displayed penalty ($65–$105). Disconnecting preserves trace, owner presence and the original deadline.
2. **Double-click** desktop icons (or focus and press Enter) for Computer, Documents, Mail, Downloads, Notes and Recycle Bin. Explore nested personal documents as well as brief, mail, logs and vault. Some sources are obsolete or misleading.
3. Click/double-click files to read them in a separate document window. **Drag title bars**, or focus a title bar and use **arrow keys**, to reposition windows. Close buttons and taskbar buttons hide/reopen applications. **Right-click** for document, copy, extraction and notes actions. Windows retain their positions across shared-state updates.
4. **Rotated archive:** reconstruct the rotation key from mail and logs; copy the key memo, seal log and unlocked payload into the local recovery bundle before extracting.
5. **Counterfeit handoff:** read both dispatch and audit, compare sender and batch, and submit the correct manifest. Wrong evidence fails immediately; the server never publishes the correct path or solution.
6. **Three-hop dead signal:** reconstruct a chronological route across three logs and a dispatch, then unlock and extract before the shorter 95-second lease expires.
7. Sell extracted bundles under LOCAL EVIDENCE on ledger.onion or RECORDS **before the original job deadline**. Another operator can settle them, once per crew. Base payouts are $340–$520. Recovered bundles can expire; extraction alone does not mint money.

Remote jobs normally allow 150 seconds (95 for timed routes), bounded by dawn. Physical encounters and outages pause deadlines. Explicitly disconnecting does not reroll the owner or reset suspicion, trace or lease. Accepted work still expires while disconnected. A network reconnection retains the mounted session.

About **20% of generated targets** have an active owner. A four-second warning precedes the first activity, then ten seconds of visible cursor movement, window movement and typing alternate with fourteen seconds away. The owner status banner shows when it is safe to work. Wait, continue carefully or disconnect. Actions during active use and moving/closing windows raise visible suspicion; idle periods slowly lower it. At 100%, the owner terminates the connection, the disclosed job penalty applies once, heat rises, and a hallway patrol is queued after encounter exclusion and recovery. Check the peephole and remain inside until it passes. Detection is based on actions, never an unavoidable random roll.

### Contract obligations and investing

Memory/pulse reward buttons have been replaced by connected objectives. WIRE shows difficulty, payout, deadline, failure amount and the actual objective. Accepting never pays. Remote recovery/investigation/timed jobs use the desktop above. A physical delivery contract needs two produced parcels, a negotiation with its verified receiver, a scheduled pickup and a correct chute handoff; missing the job deadline cancels the pickup and forfeits its bonus. An economic job requires two shares under a price limit, purchased **after acceptance across two different quote revisions**, then surrendered. It refunds the qualifying purchase cost plus a commission; there is no reward without shares to transfer. Crew members can assist with purchasing or handoff. Deadlines and abandon penalties are authoritative and settle once. Physical danger and outages pause accepted contract clocks. Unfinished work clears at dawn; it never pays automatically.

**exchange.onion** lists GhostWire, BlackVault, Night Courier, Redline Labs, Phantom Systems and Hollow Market. Quotes change every ten seconds, with different volatility and occasional company news. Local pickups, outages and major trace alerts also create modest market reactions; those signals are smaller than the round-trip fees and do not guarantee arbitrage. Charts support pointing or focusing and using left/right arrows to inspect history. Buy/sell whole shares using the shared wallet. Each side costs **2%** (rounded against the trader); an immediate round trip loses money. Quotes use revisions to reject stale orders. No short selling, borrowing or client-supplied prices. Holdings and cost basis persist across nights and authenticated reconnects. Shares must be sold to make their value available for quota collection. Trading is speculative; news and price paths do not guarantee a profit. The ledger records share sale receipts as trading income and purchases as expenses, so net results include capital and fees.

### The last envelope

After the successful night-six payment, the debt-cleared dispatch is followed by silence, three knocks, the Collector's visit and a new envelope. This is separate from the fatal unpaid-quota attack. After twelve seconds the connected crew votes **Leave** or **Continue**. All connected ballots resolve together, or a sixty-second voting window expires. A strict majority continues; ties and missing votes leave safely. Disconnecting cannot hold the offer open indefinitely, and duplicate votes cannot start multiple campaigns.

Leave shows results, crew totals and credits. Continue begins **New Game+** at night one, preserving the wallet, holdings, equipment, supplies and crops. Each loop raises quotas by 35% of the base amounts and normal remote/sale offers by 20%, with shorter encounter spacing. Quota settlement identifiers reset for the new six-night cycle. The base campaign still collects only $2,550 after night three and $4,550 after night six.

## Architecture and deployment

- `shared/core.js`: authoritative actions, generated targets, contracts, visitors and simulation ticks.
- `shared/campaign.js`: three-night wallet settlement, fatal Collector phase, catalog and visitor phases.
- `shared/exchange.js`, `shared/sales.js`, `shared/contracts.js`: shared custody, negotiations/reservations/pickups and objective-driven contracts.
- `shared/horror.js`, `shared/remote.js`, `shared/npc.js`: coordinated encounters, remote jobs, and direction-aware visitor routes.
- `shared/layout.js`: furniture collision and station interaction positions, shared by client and server.
- `server/index.js`: Express/Socket.IO rooms, rate limits, authoritative movement and reconnect leases.
- `src/app.js`, `src/browser.js`, `src/blackmarket.js`, `src/remote.js`: OS, station UI, browser routes, HUD and input.
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

Mechanics/socket tests cover campaign payments and endings, growing, inventory ownership, collision, horror exclusion/recovery, rare wardrobe counterplay, private negotiation budgets, shared reservations and duplicate pickup attempts, quote revisions/fees/invalid trades, multi-revision economic work, remote evidence bundles/decoys/penalties/owner activity and authenticated reconnects. Browser tests exercise terminal and browser flows, physical production and negotiated chute delivery, curtain defense, the courtyard/hallway/peephole, visible scares, interactive exchange charts, desktop icons/dragging/keyboard movement/context actions, active owner cues, accessibility persistence and both successful ending choices. Screenshots are written to `test-results/` for visual review. Physical fixtures advance crop maturity/visitor travel and hold deadlines during software-rendered captures; mechanics tests separately verify real growth and normal deadlines.

## Remaining polish

The integrated loop is implemented. Further art and balance work remains: richer clothing meshes and hand animations, further procedural document and puzzle variety, spatial/recorded ambient audio, and broad hardware/browser performance testing. Wet surfaces use inexpensive specular shading rather than planar reflections. Persistent saves and recovery across backend restarts are not included. Touch/gamepad controls are not implemented. Playtesting with a full crew is still needed to tune the 24-minute economy beyond automated coverage.
