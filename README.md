# Signet by ASPIRIUM — coming-soon page (page lane)

_Build `WEB 000`, 2026-09-07. Implements `web_build_brief_v1_1.md` with the rulings in `decisions_log_v1_0.md` and Eric's build-session rulings of 2026-09-07 applied. Static files, no framework, no build step needed to run; `build.mjs` produces the hashed `dist/` for deployment._

## Deploying

The repository is `softfractal/aspirium`, **public**, default branch `main`. This folder is the repo
root — the rest of the ASPIRIUM project, Blender masters and export pipeline and 1.6 GB of it, is
deliberately outside.

**GitHub Pages, built by Actions, is the live deploy path** (Eric, 2026-09-09). Settings → Pages →
Source is set to *GitHub Actions*, a one-time manual step that no token available to this workflow
could perform — the header of `.github/workflows/pages.yml` records the two automated routes that
were tried and ruled out. Every push to `main` now builds and deploys.

The notes below on Vercel and Cloudflare are kept because the bandwidth arithmetic still applies and
this hosting choice is explicitly temporary.

**Vercel, if the plan changes back.** `vercel.json` holds the whole
configuration, so the import needs nothing typed into a form: import at vercel.com/new, grant access
to `softfractal/aspirium`, done. It builds with `node build.mjs`, serves `dist/`, and skips the
install step because there are no dependencies and no lockfile to keep in sync. Every push to `main`
is a production deployment; every other branch gets a preview URL.

Vercel serves from a domain root rather than a subpath, which means `robots.txt` is honoured
alongside the `noindex` meta tag. `vercel.json`
also carries every rule from `_headers` across — the year-long immutable caching on each
content-hashed asset, plus `nosniff`, `Referrer-Policy`, `Permissions-Policy` and `X-Robots-Tag`.

### Is a capture page "commercial"? It depends whose terms

Reading the terms, not legal advice — and the three hosts do not say the same thing.

- **Vercel** restricts its Hobby tier to *personal, non-commercial* use. The test is who benefits,
  not whether money changes hands on the page. A pre-launch capture page for a product that will be
  sold is commercial in that sense even though it takes no payment. Pro is $20/month.
- **GitHub Pages** prohibits something narrower and more specific: sites *"primarily directed at
  either facilitating commercial transactions or providing commercial software as a service."* A page
  whose only action is an email field facilitates no transaction, so it does not meet that
  description. Defensible, if not risk-free.
- **Cloudflare Pages** carries no commercial-use restriction at all, and meters static bandwidth as
  unmetered under fair use — 500 builds a month, 20,000 files, 25 MiB per asset. This build is 20
  files and its largest is 12.9 MiB.

### The cap is a symptom; the payload is the disease

A first visit costs about **13.4 MB**, and 12.9 MB of that is one file. Against any 100 GB/month
allowance that is roughly **7,600 visits**. Two pipeline-side changes, both already named in
`HANDOFF_web.md` §6, would move that more than any host switch can:

| Change | Per visit | Visits per 100 GB |
|---|---|---|
| today | 13.4 MB | 7,600 |
| assets served as files instead of base64 inside the JS (§6 item 5) | ~9.5 MB | ~10,800 |
| …plus the WebP/KTX2 texture conversion §3 already calls mandatory | ~5.5 MB | ~18,600 |

The first one is nearly free: the bundle inlines 8.96 MB of GLB, decoder and maps as base64, which
inflates them by a third to 12.9 MB. Shipping them as separate hashed files removes the inflation and
makes them independently cacheable, so a returning visitor re-downloads none of it.

### Using the GoDaddy domain

Pointing the domain at any of these does **not** require transferring the registration.

- **Vercel or GitHub Pages**: keep GoDaddy's DNS as it is and add records. Vercel wants an `A` record
  at the apex to `76.76.21.21` and a `CNAME` for `www` to `cname.vercel-dns.com`. GitHub Pages wants
  four `A` records at the apex (`185.199.108–111.153`) and a `CNAME` for `www`. GoDaddy supports both
  shapes, so this is a five-minute edit in its DNS panel.
- **Cloudflare Pages**: the domain stays registered at GoDaddy; only the **nameservers** change to
  Cloudflare's two. That is a nameserver update, not a registrar transfer — no 60-day lock, no auth
  code, no fee, and reversible by pasting GoDaddy's nameservers back. It is the one extra step, and
  it is what buys the unmetered bandwidth and the absent commercial clause.

Cloudflare's settings, if it is wanted: Framework preset *None*, build `node build.mjs`, output
`dist`, `NODE_VERSION` = `22`. `_headers` is already written for it.

> **Only connect one of them.** Vercel, Cloudflare Pages and the Actions workflow can all deploy this
> repo. If Cloudflare was connected earlier, disconnect it before importing to Vercel, or every push
> builds twice and two live URLs drift apart. `.github/workflows/pages.yml` is already demoted to
> `workflow_dispatch` only, so it never races — run it by hand from the Actions tab if it is ever
> needed, after enabling Settings → Pages → Source → *GitHub Actions*.

### Custom domain: aspirium.co

The domain is registered at GoDaddy and uses GoDaddy's own nameservers
(`ns15/ns16.domaincontrol.com`). Nothing has to be transferred and the nameservers do not have to
change — GitHub Pages only needs records pointing at it.

**Order matters.** Claim the domain on the repository *before* the DNS points at GitHub. A domain
whose records point at Pages while no repository claims it can be claimed by somebody else. Note
that shipping a `CNAME` file in the artifact is *not* enough on an Actions deploy: the file is
published (it is served at `/CNAME`) but Pages ignores it and keeps serving the project path. It is
kept in the build only so the two never disagree.

1. **GitHub first.** Settings → Pages → Custom domain → `aspirium.co` → Save. It will warn that DNS
   is not configured; that is expected and the claim still takes effect.
2. **Then GoDaddy.** DNS Management for `aspirium.co`, add five records. There is nothing to delete
   first — the zone currently has no A, AAAA or CNAME records at all.

   | Type | Name | Value | TTL |
   |---|---|---|---|
   | A | `@` | `185.199.108.153` | 1/2 Hour |
   | A | `@` | `185.199.109.153` | 1/2 Hour |
   | A | `@` | `185.199.110.153` | 1/2 Hour |
   | A | `@` | `185.199.111.153` | 1/2 Hour |
   | CNAME | `www` | `softfractal.github.io` | 1/2 Hour |

   GoDaddy's newer form groups the four addresses as four *values* on a single A record for `@`,
   which is the same thing as four A records. Its TTL dropdown has no 600-second option and does not
   need one: TTL governs how long resolvers cache an answer, and with an empty zone there is nothing
   cached to expire, so it has no bearing on how quickly these first appear. It only matters when a
   record *changes* — and since this host is explicitly temporary, a shorter TTL is worth a moment's
   thought before the move rather than now. *1/2 Hour* is the right default; Custom `600` would make
   a future switch propagate in ten minutes instead of thirty.

   Those four addresses are not quoted from documentation — they are what `softfractal.github.io`
   itself resolves to. There are no AAAA records to add: the Pages host publishes no IPv6. Leave
   GoDaddy's *Domain Forwarding* off, or it will re-insert its own parking records.
3. **Wait**, then check `dig +short aspirium.co`. When it returns those four addresses, GitHub
   verifies the domain and issues a Let's Encrypt certificate. Usually minutes; GitHub allows itself
   up to 24 hours.
4. **Tick Enforce HTTPS** in Settings → Pages once the checkbox stops being greyed out.

Two consequences to expect. `softfractal.github.io/aspirium/` will redirect to `aspirium.co` from
step 1 onward, so the site is unreachable between claiming the domain and the records resolving.
And once the site is served from a domain root instead of a project subpath, `robots.txt` starts
being honoured — so the `Disallow: /` in it becomes a live decision rather than an inert file, and
should be reviewed alongside the `noindex` meta tag.

**Two things that would silently break a clone.** `viewer/bundle.js` is a real 13.2 MB file, not a
symlink to the pipeline lane: git stores a symlink as its target path, so a clone or a CI checkout
would otherwise get a dangling link and the hero band would 404. `dev/sync-viewer.sh` therefore
copies rather than links, and every pipeline rebake adds another 13 MB blob to git history — worth
watching, and the reason to consider Git LFS if the bake is going to iterate. Separately, the scripts
in `dev/` that reach outside this folder (`build-fonts.sh`, `fetch-fonts.sh`, `capture-poster.mjs`,
`sync-viewer.sh`) only work inside a full ASPIRIUM project checkout; a bare clone can build and test
the page but cannot regenerate its fonts or posters.

## Run · tune · check

| What | Where |
|---|---|
| the page, served | http://localhost:8734/site/ — the project's launch config (`python3 -m http.server 8734` at the project root) |
| the page, from disk | double-click `index.html`. Works too: the scripts are classic (no ES modules) and the viewer bridge uses postMessage. Chrome refuses web fonts on `file://`, so from disk the page falls back to any *installed* ASPIRIUM / Literata / Source Serif 4, then to the system mono and Georgia |
| band tuner, fold gauge, viewer switches (R2) | http://localhost:8734/site/dev/tune.html |
| acceptance run, headless Chrome (74 checks, screenshots) | `node dev/check.mjs [base-url] [out-dir]` — base may be `http://…/site/`, `…/site/dist/` or `file:///…/site/` |
| viewer shell after a rebake | `dev/sync-viewer.sh` (regenerates `viewer/index.html`, re-points `viewer/bundle.js`) |
| fallback posters from the current bake | `node dev/capture-poster.mjs --w 2000 --h 1000 --out assets/poster/signet-end-pose-2x1.png`, then `--w 1200 --h 1200 --out …-1x1.png`; convert with `sips -s format jpeg -s formatOptions 82 in.png --out out.jpg` |
| web fonts | `dev/fetch-fonts.sh` once, then `dev/build-fonts.sh` |
| deployable output | `node build.mjs` → `dist/` (content-hashed `assets/ css/ js/ viewer/bundle.js`, `_headers`, `robots.txt`; PNG poster masters excluded) |

The Claude Code browser pane keeps its tab hidden, which suspends `requestAnimationFrame` — the intro cannot advance there. Judge the choreography in a normal browser tab or through `dev/check.mjs`.

## The hero band — live bundle

The band shows the pipeline's **current bake**: `viewer/bundle.js` is a symlink to `three-viewer/demo/bundle.js`, so a `build.sh` run in the pipeline is what the site shows next. `viewer/index.html` is the demo page's shell (generated by `dev/sync-viewer.sh`: black body, panel hidden, no external font) plus a small reporter script that watches the bundle's hooks (`__prewarmMs`, `__unlocked`, `__stateDbg`) and posts `ready / introEnd / wordmarkLit / error` to the page; the page answers with `play / pause`. `js/viewer-embed.js` mounts that shell in an iframe sized to the band — the bundle is a full-window renderer, so the frame is its container and nothing in the renderer changed. Rendering, calibration and timing are byte-identical to the reference build.

One line did change in the pipeline source (`three-viewer/demo/src/demo.js`, 2026-09-07): the canvas `touch-action` is now `pan-y` instead of `none` — the R3 amendment. `pointercancel` was already handled. Both demo pages were rebuilt from it.

Still pipeline work (HANDOFF §6): separate hashed WebP/KTX2 assets (the bundle is one 13.5 MB file — brotli helps little with base64), stripping debug keys and URL params (they answer only while the frame has focus), a native `restart()`, the phone Blender project.

## Two panels, one scroll

The page is two screens (Eric, 2026-09-09). Panel 1 holds the ring and the lockup; panel 2 holds the
capture form and the footer. The hero is `position: sticky`, so the capture panel rises over it while
the hero's own contents lift at 1.5x the page and dissolve — the two layers moving at different rates
is the parallax. `js/main.js` writes `--p` (linear, 0…1 across the first screen) and `--pf` (the same
remapped to finish at 60%) onto the hero; `css/site.css` spends them on transform and opacity. One
passive scroll listener, one write per frame, nothing under `prefers-reduced-motion`. Knobs in
`js/config.js` → `parallax`: `drift` 80 vh, `fade` 0.95 by `fadeEnd` 0.4, `cueFade` 4, `pauseAt` 0.9.

**A full-page pager was tried and reverted (2026-09-09).** Mandatory scroll snapping plus a wheel pager, modelled on shenzhen-world.com, made the page stick on the capture panel in a real browser. The cause was the pager's lock: it re-armed on every wheel event so that one flick's inertia could not spend two panels, but real trackpad momentum keeps firing for far longer than the 620 ms timer, so the lock never released. Snapping alone also fights any programmatic jump. If this is attempted again, the lock needs a time budget from the gesture's *start* rather than a timer that any event can extend, and it needs testing with real trackpad inertia rather than synthetic wheel events, which passed all 71 checks while the page was unusable.

Two consequences worth holding:

- **The form is no longer above the fold.** The brief's §2 item 5 required it on any viewport ≥ 768 px
  tall, because capture is the page's one job. It is now one screen of scroll away, so a `SCROLL` cue
  (mono, muted, gone after a third of a screen) signposts it. The wording is provisional. If the trade
  turns out badly, the cheapest reversal is moving the form back into panel 1 under the lockup.
- **The band stays ~1:1 on phones inside the full-screen hero.** The camera is vertical-fit, so a
  full-portrait band would crop the ring's sides (R4). The panel is a full screen; the band is not.

The form is centred on both axes of panel 2: the panel is a centring flex box and the footer is taken
out of flow (`position: absolute; bottom: 0`) so it cannot pull the centring off-axis. `.capture` is
`margin: 0 auto` with `text-align: center`, so the label, the field row and the consent line read as
one centred unit rather than a centred box with left-flush contents. Left-flush internals are a
one-line revert (drop `text-align: center` from `.capture`).

The viewer stops rendering once the hero is 90% covered, which is checked, not assumed.

## The lockup and its decode effect

Panel 1 carries one mark. The house wordmark that briefly sat over the render was removed on 2026-09-09 — Eric is placing it elsewhere — so `assets/mark/` is retained on disk but excluded from the build, and the band clips its overflow again.

**The lockup** is live text (it was a PNG before 2026-09-09, and a serial line plus a headline before that): two lines in Literata, both white, sitting below the band and clear of the render. "The Signet by" is the large line and "ASPIRIUM" the small one, the two sizes having been swapped and then both halved, the gap between them doubled to `1em` of the smaller line, and the block dropped by `--mark-drop` (25% of the band height). The characters in `index.html` are the copy source; the `<h1>` carries an `aria-label` because letter-split text is otherwise read out one letter at a time.

`js/mark.js` splits every non-space character into a cell holding two layers. The real character alone drives layout; the random code glyph rides over it absolutely. So nothing is ever measured, nothing reflows at any font size or viewport, and the line keeps its final width from the first frame — letters do not shuffle sideways as they resolve. Going from a raster to text retired the whole measuring step: `dev/measure-wordmark.mjs` and `wordmark.rows` are gone, and changing the copy needs no re-measure.

**One letter at a time, held until the ring is in focus.** The run is driven by the viewer's own clock: it reports `onIntroProgress` (~every 150 ms from the live bundle, per frame from the stub), and the first letter waits for `startAtSec` = **2.0**. That started as `RACK_LAND` in `demo.js` at 5.0 s, where the viewer declares the focus rack resolved, and was walked back to the half-lights mark: per `HANDOFF_web.md` §3 the ring has been out of the black for 0.8 s at that point, its lights reach full at 4 s and the blur clears by about 5 s, so the first letters land against a ring that is still soft. The whole run lasts `runForIntro` = **0.75** of the 15 s intro — 11.25 s, finishing around 13.25 s. `js/main.js` derives the milliseconds from `timeline.introEnd`, so a re-timed intro carries the lockup with it.

`mode: "sequential"` is what makes it one by one: cells before the resolve point show their real character, `activeCells` (1) scrambles at the point, and every cell after it renders **nothing**. Nineteen cells over 11.25 s is about 590 ms each. `mode: "scramble"` is the reference nav's all-at-once behaviour (unajartera.com: 450 ms hover, 220 ms tap, charset `ACEFGHIJKLPRSTUVY23456789`) and is what the short hover and tap runs still use — one-by-one over 450 ms would read as a wipe across a mostly empty lockup. Unresolved cells hold a glyph for `churnMs` (80 ms) so a long run reads as code rather than static.

**The opening screen is empty.** Nothing is lit until the ring's animation starts. An inline script in `<head>` adds `is-opening` to the root element *before first paint*, so the lockup can never flash in ahead of the ring; `js/main.js` keeps that hold only when a decode is actually coming and drops it immediately otherwise (reduced motion, trigger off). The hold is lifted by the `signet:decode-start` event `mark.js` fires on its first frame. Two backstops exist so the page can never sit blank: `blankMaxMs` (20 s) in main.js, and a matching timeout in the inline script for the case where main.js never loads at all.

## The drag hint

The ring is a live render, and nothing on screen said so. `#drag` is the pipeline check page's
pointer cue (`three-viewer/demo`, `#cue`) ported into the void the lockup's `--mark-drop` opens up:
a swiping pointing hand and a small label. The check page's hand was redrawn: its index finger was only ~1.2 units wide in a 24-unit box, which is why it read as a malformed spike at this size. The replacement is stroked rather than filled, so the finger separations survive at 30 px. The dashed trail stays dropped, and so do the pill, blur and drop shadows — the brand law allows no glow. Its position is derived rather than guessed — the
band occupies `0..--band-h` and the gap runs from there to `--band-h * (1 + drop)`, so the centre of
that gap is `--band-h * (1 + drop/2)`. The check page's pill, backdrop blur and drop shadows are
dropped; the brand law allows no glow, and white on black needs none.

It is honest about when rotation is available. It appears on `onIntroEnd`, which is the same signal
that unlocks dragging, so it never invites a gesture the viewer would ignore. It never appears on
the poster path, because a poster does not rotate. It retires the moment someone actually drags,
and otherwise after `dragHint.autoHideMs` (12 s) so it does not nag.

That last part needed a new signal. The viewer runs in an iframe, so a pointer landing on the canvas
is invisible to the page. The shell's reporter now listens for `pointerdown` and posts `dragged`,
which `js/viewer-embed.js` surfaces as `onDragged`. It only fires once rotation has unlocked, so an
idle click during the intro does not count as having found it. `.drag` itself takes no pointer
events, so the hint can never intercept the gesture it is advertising.

## Typefaces

Three faces, all SIL Open Font License 1.1 — free for commercial use and web embedding, never sellable on their own, licence text shipped beside the files in `assets/fonts/`. `dev/fetch-fonts.sh` pulls the upstream sources into `dev/font-src/` once; `dev/build-fonts.sh` subsets them to Latin and writes the WOFF2s.

| Face | Role | Shipped |
|---|---|---|
| ASPIRIUM Light | Nothing on the page today — the scroll cue became an arrow. Kept because it is the house face and the next copy element will want it | 59 KB |
| Literata | The lockup | 155 KB, variable `opsz` 7–72 and `wght` 200–900 |
| Source Serif 4 | Body and UI: field label, submit, consent, footer, privacy link, build serial | 75 KB, variable `wght` 200–900 |

The field label, the submit control and the whole footer moved to Source Serif 4 on 2026-09-09. The build serial has since been removed and the scroll cue became an arrow, so **no ASPIRIUM remains on the page** — the file still ships because it is the house face and the next copy element will want it. Drop it from `dev/build-fonts.sh` and the preload if that stays true.

The footer sits at `.375rem` (6 px), set by Eric as "half their sizes". That is below the 12 px accessibility guidance treats as a floor. It looks intentional at desktop scale and is one value to raise. The submit label was briefly halved too and has since been reverted to `.8125rem`.

Literata keeps its optical-size axis because the lockup runs from about 24 px to 64 px in one composition, and `font-optical-sizing: auto` picks the right cut at each. Source Serif's optical-size axis is pinned at 20, its default, because body copy sits at one size — that alone took it from 190 KB to 75 KB, which matters on the cellular traffic the brief expects. Source Serif carries the reserved name "Source", so it ships unmodified, exactly as the licence requires; the same clause is why ASPIRIUM had to be renamed away from Source Code Pro. Source Code Pro itself is no longer built or shipped, having been the provisional body face Source Serif replaces. An italic is one commented line away in `dev/build-fonts.sh` the day body copy needs one.

## What is where
## What is where

```
index.html            the page — all copy lives here (works with JS off once an endpoint exists)
js/mark.js            the lockup's decode effect — window.SignetMark.attach(el, config.wordmark)
assets/mark/          the retired lockup PNG — kept for reference, excluded from the build
privacy.html          minimal provisional notice for the capture form (footer link)
css/site.css          Mode B tokens as custom properties, --band-h, the light wiring; no divider rules
js/config.js          window.SIGNET_CONFIG — endpoint (R5), timeline, DPR caps, ?c= tag, session key
js/main.js            fallback ladder, pause-when-unseen, light wiring, return visits, the form
js/viewer-embed.js    the live viewer bridge — window.SignetViewer.mount(el, …)
js/viewer-stub.js     stand-in viewer (poster + timeline) for the tuner and the check
viewer/index.html     generated embed shell + reporter (dev/sync-viewer.sh)
viewer/bundle.js      → ../../three-viewer/demo/bundle.js (symlink)
assets/fonts/         ASPIRIUM Light + Literata + Source Serif 4, Latin subsets as WOFF2, with all three OFL texts
assets/poster/        interim posters rendered from the reference build (2:1 desktop, 1:1 phone)
dev/                  tune.html · check.mjs · cdp.mjs · capture-poster.mjs · sync-viewer.sh · build-fonts.sh — never deployed
_headers              Cloudflare Pages headers (immutable hashed assets, noindex, nosniff) — only honoured there
robots.txt            Allow: / and the sitemap, since 2026-10-26 (§1a cleared)
sitemap.xml           the two public pages; privacy.html stays noindex until its notice is reviewed
```

## Rulings applied

| Ruling | Where it landed |
|---|---|
| R1 name | Title `Signet by ASPIRIUM — Edition 001`; "Signet" set in ASPIRIUM in the serial. `noindex` meta, `X-Robots-Tag`, `robots.txt`, no OG image, no favicon mark. |
| R2 band | `--band-h: clamp(360px, 48vh, 640px)`; the tuner slider sets it live (40–55 vh) and reads the fold at the consent line. |
| R3 touch | Canvas `touch-action: pan-y` (bundle source + reporter insurance), `pointercancel` springs back. Verified under emulated touch on the live canvas: a vertical finger from the band scrolls the page. |
| R4 mobile | Band `min(100vw, 60svh)` below 768 px (1:1, never full-screen); `variant: "phone"`, DPR cap 1.5; 1:1 poster. |
| R5 provider | `config.js` `capture.endpoint` empty → the form simulates the round trip and logs the payload. |
| R6 mechanic | Serial renders `SIGNET BY ASPIRIUM — EDITION 001`; the QTY/DATE slots are in the markup and render nothing while empty. |
| R7 ring size | Nothing to do; judged on the tuner. |
| **2026-09-09 pm, replay (Eric)** | The wordmark moves almost flush with the band's top so it stops overlapping the ring. Every page load replays the whole opening: the sessionStorage "return visit" skip from the brief's §2 is retired, the page now stores nothing in the browser, and `privacy.html` says so. Reduced motion is still the one path that skips. |
| **2026-09-09, pager tried and reverted (Eric)** | Mandatory snapping plus a wheel pager made the page stick on the capture panel; reverted in full. The parallax remains a continuous scroll at `drift` 80 / `fadeEnd` 0.4. |
| **2026-09-09, pills + pace (Eric)** | The submit pill takes the field's grey and both go white on hover and focus, with the border as the focus indicator. The submit was then taken to 75% of its size on both axes (36 px tall, 30 px side padding, 9.75 px type) and its label to the consent line's grey, brightening to white with the pill on hover. Parallax made snappier: `drift` 50 → 80, `fadeEnd` 0.6 → 0.4, `cueFade` 3 → 4. |
| **2026-09-09, wordmark out (Eric)** | The house wordmark is removed from the page; it will be placed elsewhere. The lockup's decode is held until `startAtSec` 5.0, the viewer's own focus-rack landing, so nothing appears until the ring is sharp and on screen. |
| **2026-09-09 pm, tuning (Eric)** | Submit label size reverted to 13 px and its pill turned white instead of gold, which retires the §2 warm-accent wiring on that control (`.received` still carries it). Wordmark up 50% to `--logo-top` (0.25%); lockup down 25% of the band height via `--mark-drop`. |
| **2026-09-09, layout (Eric)** | The house wordmark PNG goes on top of the ring render and takes the focus-rack fade; the text lockup returns below the band, keeping its swapped and halved sizes. `SCROLL` becomes an arrow. Submit moves to its own line under the consent line, twice the padding, half the size, white text. Build serial `WEB 000` removed ahead of deployment; copyright and privacy move to the bottom corners at half size. *Not yet in `decisions_log_v1_0.md`.* |
| **2026-09-09, fonts (Eric)** | Body and UI move to Source Serif 4, and so do the field label, submit, footer and privacy link. The PNG lockup becomes live text in Literata, which retired the raster-measuring step entirely. Its two line sizes are swapped and both halved, both white; it moves on top of the ring render and fades up on the viewer's focus rack. Source Code Pro dropped. *Not yet in `decisions_log_v1_0.md`.* |
| **2026-09-09 pm (Eric)** | The lockup renders nothing at all until the ring's animation starts (the scroll cue waits with it). First letter at 5% of the intro (0.75 s); the run lasts 75% of the intro (11.25 s, ending at 12 s) and plays **one letter at a time**, letters past the resolve point drawing nothing. Capture form centred on both axes of panel 2. *Not yet in `decisions_log_v1_0.md`.* |
| **2026-09-09, build session (Eric)** | Two panels, one screen each: ring + lockup, then the capture form, with parallax between them. The lockup's decode is held until the ring's intro is 15% in and slowed to land with the ring's wordmark. **Supersedes the brief's §2 item 5** (form above the fold). *Not yet in `decisions_log_v1_0.md`.* |
| **2026-09-07, build session (Eric)** | Field is pure black `#000000` (was `#141414`). No divider rules anywhere. Submit label `SUBMIT` (was `TELL ME FIRST`). Consent line "Sign up for our latest development updates." Product intro sentence removed; slot kept in `index.html` for the new one. Serial line and headline replaced by the PNG lockup with the decode effect (the R6 QTY/DATE slots went with the serial line; their markup is in a comment). *Not yet in `decisions_log_v1_0.md`.* |

## Provisional, flagged

- **Headline** — the recommended option; proposed, awaiting ruling. One line in `index.html`.
- **Product intro** — removed 2026-09-07; the previous sentence is in a comment at the slot.
- **Body face** — Source Serif 4, chosen 2026-09-09. It is the designed sibling of the Source Code Pro that ASPIRIUM is cut from, so the page runs on two voices rather than three. The brief still records the body face as OPEN; this is a build-session pick, not a ruling.
- **Display face** — the rev 8 CAL build of ASPIRIUM Light, subset to Latin. Swap the WOFF2 when calibration locks; `dev/build-fonts.sh` re-cuts it.
- **Posters** — rendered from the current three.js bake, not Cycles. Re-run the capture after every rebake.
- **Legal line** `© 2026 ASPIRIUM` and the privacy notice — for someone licensed to review before public.
- **Error/validation copy** on the form (`data-copy-*` on the form element) — not in the brief; sincere, no exclamation marks.
- **Hosting** — `_headers` assumes Cloudflare Pages (proposed). GitHub Pages ignores it; everything else is identical. A 13.5 MB viewer file clears Cloudflare's 25 MiB limit and would burn GitHub's soft bandwidth cap in ~7,000 visits.
- **Analytics** — commented slot in `<head>`; cookieless only.

## Review gate (§10) — status

| Gate | Status |
|---|---|
| Clearance on both names | open — page is `noindex`, robots disallowed, no OG |
| Brand-law pass on the render (screen glow vs rig, chrome sparkle, flicker) | Eric, on the live band |
| Which face is the baked wordmark; A-mark provenance | pipeline |
| No capability, price, date, mechanic in DOM / meta / alt | done — description "Signet by ASPIRIUM. Edition 001.", alt "Signet ring, lit from within" |
| Form end to end with double opt-in, export, `?c=` tag in the list | blocked on R5; `?c=` → source field verified |
| Mobile field test (in-app browsers, cellular) | open — needs a phone on cellular; the 13.5 MB bundle is the number to watch |
| Touch: vertical scroll from the band reaches the form | verified on the live canvas under emulated touch (Chrome); re-check on iOS Safari |
