# Process

Design reasoning, in order, the way Pippin Barr keeps it. Newest entry last. The v0 log (when this was called "shoggoth") is at `../PROCESS-shoggoth-v0.md`.

## 2026-10-09 — Names, three forms, and the creature rebuilt from the text

**Names.** The lab is Accidental Intelligence, from Lovecraft: the shoggoths acquired "a dangerous degree of accidental intelligence." The product is Apocalypse Mascots: doom word first, object second, the MSCHF pattern (Satan Shoes, Eat the Rich popsicles); "apocalypse" is the doomers' noun and "mascots" is the vendors' product category. Both edges in two words. Checked free: no product, repo, domain or search presence under either phrase on 2026-10-09. Rejected: Cuddly Apocalypse as the product name (names the mood, not the object; kept as the first color scheme); Shoggy as the lead name (NovelAI's cluster mascot since May 2023; kept as the third form, as a continuation, with credit); Teki (didn't like it); anything with "thulhu" in it (Chaosium's "Call of Cthulhu" marks live in games).

**Three forms, three gods.** Yoggy for Yog-Sothoth, "only a congeries of iridescent globes" (the faithful mass). Shubby for Shub-Niggurath, "The Black Goat of the Woods with a Thousand Young" (the anatomy). Shoggy for the shoggoth proper (the chibi), because the meme's own history runs doodle (Dec 2022) to plush (Jul 2023), so the cute one is the shoggoth itself. Only Yoggy is built. The sign promises all three.

**The creature, rebuilt from Lovecraft rather than the meme.** The meme is an octopus; the text is a black, iridescent, bubble-surfaced mass with "myriads of temporary eyes forming and unforming as pustules of greenish light" and "no voice save the imitated accents of their bygone masters." So: the tentacle row is gone; the body is braille by density (dense interior, thinner rim, sparse bulge) rather than shade characters; color is OkLCh with hue rotating purple → teal → green at constant lightness, chroma breathing on a slow cosine; eyes are an odd count, unequal sizes, green, each on its own period and offset, re-placed every cycle, never two of a size side by side (a pair becomes a face, a face becomes cute); no mouth. While a turn runs the mass holds up a small yellow face. Hidden, only the face remains.

**Deviations from the spec in the iconography brief.** One clock, 400 ms, for both shape and hue; the 33 ms hue clock would redraw the band thirty times a second through the state store and is not worth it. Theme is a command (`/mascot theme`) rather than an OSC 11 read, since the engine does not expose the terminal background.

**Tests.** Six pass: eyes in the dark; the shell unlock on terminal and desktop; an MCP server named; the held face while working and after hiding; the form and scheme commands with their fallbacks; hide and show by command. Type-check clean against the engine's declarations.

**Decisions taken 2026-10-09.** License: MIT code, CC BY-NC 4.0 art and copy. Repository private until launch. Unbuilt forms and schemes answer in deadpan vendor voice: "Shubby is coming soon to your region." First commit local, now.

## 2026-10-09, later — The page, the preview, and a stacked pair

**Landing page.** `site/index.html`: the creature ported to the browser, same constants, with the capability toggles as checkboxes, a button that runs a fake turn, the form and scheme selectors answering in vendor voice, and the draft copy marked as draft. Verified in Chrome: no console errors; ticking eyes, hands and shell and asking it something grows the mass, opens the eyes, holds up the face and sets the spinner to "Reaching…".

**Preview.** `preview.py` renders the same algorithm to a GIF for the README, with DejaVu Sans for the braille (DejaVu Sans Mono has none). The render confirmed the color: purple at the left shoulder through blue to teal and green at the right, eyes green, the face yellow.

**A stacked pair is a face too.** The stage-six render put two big eyes one row apart in the same column, twice. The no-pair rule now rejects a same-size neighbor within two columns and one row, not just the same row.

**2026-10-09, evening.** The gradient is right; the animation needs to be more visible. Two paces now: 300 ms while a turn runs, one step every 1.8 s while idle, so it breathes between turns instead of freezing.

## 2026-10-09, night — The page becomes an Astro site; copy and design together

**Rule.** Copy and design are built together, in a live environment I can tweak. So the page moved from a static file to `site/` as an Astro project: all copy in `site/src/copy.ts`, the creature in `site/src/components/Creature.astro`, layout and the design tokens at the top of `site/src/pages/index.astro`. `npm run dev` in `site/` serves it at http://127.0.0.1:4321/ with hot reload.

**Design, first pass from the research brief.** Steel ramp (Teenage Engineering / Braun grays, Rams 2px buttons, hairline rules), IBM Plex Sans and Mono, one burst of color: a 24-point yellow violator on the terminal's corner with "AVAILABLE NOW!" in Anton. Structure from MSCHF's Dead Startup Toys and Product Hunt's tama96 launch: marquee drop bar, h1, pitch, Install button with the command line, pills for the three forms (Yoggy free, Shubby and Shoggy sold out), the terminal with the live creature and the capability toggles, three form cards with "Coming soon to your region", a specifications block ("Mascot says: nothing", "Allergens: contains no mind"), and the manifesto below the install, never above it.

**Copy, draft three.** Cold read of draft two: the technology line and the art-project line go; "A word from Yoggy" goes, because the mascot says nothing, it is an affixation; a Clawdbot line comes in, verified: Clawdbot became Moltbot on 27 Jan 2026 after Anthropic's email and OpenClaw on 30 Jan. Footer keeps a byline only.

**Verified in Chrome.** No console errors; toggles grow the creature, the fake turn stirs it and sets the spinner, the Shubby button toasts "coming soon to your region", the burst renders in Anton above the terminal.

## 2026-10-09, late — The toy page, and an editor in the browser

**First look at the Astro page.** Yoggy belongs on the yellow star, like a toy launch; the terminal was a good instinct but the mascot is the hero. The capability toggles made the creature grow sideways out of its box. "A place called todoist" was my tool call, not a feature. The fake-turn button next to a color dropdown made no sense. The whole page needs to go north-south like a product page, with the three forms shown, not described. Product sections should be mainstream, flashy, even cheap; the lab register stays for the specs. And I want to edit in the browser: click a line, change it, drag sections.

**Done.** Hero: an 18-point yellow burst with Yoggy drawn live on it in the same renderer (darker purple palette for yellow), a red "NEW!" sticker, headline, pitch, a red Anton Install button, "Collect all three!" pill. Demo: "Your new friend", a terminal with a real prompt (type, Enter, it stirs and the spinner speaks), the toggles beneath, "the apps it connects to" instead of a named server, creature width capped at 22 columns so it grows in rows and density. Forms: three cards with a dark visual panel each, Yoggy live, Shubby and Shoggy as a question mark with a red COMING SOON sticker, names in Anton. Six color swatches, one real. Specifications and the manifesto keep the mono-caps lab register.

**The editor.** `public/editor.js`, dev only. Press e or click Edit: every text with a `data-k` becomes editable in place; each section gets a drag handle to reorder; Save (or Ctrl+S) posts the whole copy object to `/__save`, a Vite middleware in `astro.config.mjs` that writes `src/copy.json`, and the page reloads from the file. The page renders sections in `copy.order`, so reordering persists. Not yet: adding or deleting elements, image uploads, color tokens. Those are the next rungs.

**Incident.** While probing the save endpoint with curl I posted a dummy body and it overwrote `copy.json` with `{"probe":true}`. Restored from the draft; a schema guard now refuses any body that is not a whole copy object (422).

## 2026-10-10 — Sticker, not star; the lab gets a front door

**Second look.** The yellow thing is a sticker, not a star or a sun. Yoggy does not read on bright yellow, so he debuts in the terminal after all: headline, terminal, install line, one viewport. The 3D sticker goes on the terminal's corner. "Collect all three" moves down to the forms. The forms alternate image and text, left and right, no card boxes, and Yoggy must be legible there, so the panel is light steel and the creature draws in a palette made for it. "What it is" moves up under the install line. The 1931 quotations join the specifications after allergens. And the lab needs its own front page: one or two lines, bare, steel.

**Done.** `site/src/layouts/Base.astro` holds the chrome. `/` is the lab: two lines, a drops ledger, a footer. `/mascots/` is the product. The sticker is a sixteen-point scalloped seal with an offset shade layer and a gloss ellipse, red Anton text. The forms are alternating rows; Yoggy's row draws him at eighteen columns on `#e5e5e5` with the light palette. Lab lines on the front page are candidates: "Accidental Intelligence is a leading AI research lab." / "We did not mean to."

**Editor bug found and fixed.** Saving read `innerText`, which carries CSS `text-transform`, so the wordmark and the spec labels were written back to the file in capitals. The editor now reads `textContent`. The file was corrected by hand.

## 2026-10-10 — Products, not drops; the front door is bare

**Notes.** The lab's home page is not a sub page: no header, no marquee. A logo, the subheader, one sentence, one big box to Products. "Products", not "drops"; it does not have to match MSCHF and should not yet. On the mascots page: more air between elements; the sticker text was off-center; the terminal wants a real drop shadow; the product's name belongs at the top as the big logo header under a small "Code with AI as it really is." kicker; and a short flavor paragraph under the install, in my words: "You've seen agents that try their best to be inoffensive and helpful… Never again forget what you're invoking from beyond the void!"

**Done.** `Base.astro` takes `bare`; `/` is logo, tagline, sentence, box. `/mascots/` has the kicker and the Anton title, section padding up to 96px, the sticker text on two centered lines, a layered shadow under the terminal, and the flavor paragraph verbatim after the install note. Nav says Products. Footer says product #001.

## 2026-10-10 — The lab is full of itself; the product title grows limbs

**Notes.** The home logo bigger, because these people run the company and know it. A longer buzzword sentence so the lab line is distinct from the non-profit joke. No "Amsterdam"; a normal legal footer, copyright from the future, and "Invest in us" linking to my site. On the product page: the terminal shadow must be properly 3D, the install line reactive, the sticker bigger, the title colorful with a tentacle out of one word and eyes out of the other, the stray rule between the flavor paragraph and "What it is" gone, more air everywhere, and "Soon to be available in three forms."

**Done.** Home: wordmark at up to 2.6rem, a satirical sentence (a placeholder, to be rewritten), footer "© 2034 Accidental Intelligence. All rights reserved." and "Invest in us" → josephbianchi.com. Product: title in a purple-to-amber gradient with a hard offset shadow drawn by pseudo-elements (a CSS filter on clipped-background text turned the gradient black, a Chrome quirk), a swaying tentacle from the lower-left of "Apocalypse", three blinking eyes over the end of "Mascots!"; the terminal is a stacked slab of four shadow layers that lifts on hover; the install line lifts on hover, turns the button red, and goes green with "Copied ✓" when clicked anywhere on it; the sticker is 196px; section rules removed; section padding 120px, rows 72px, panels 360px. Band reads "Soon to be available in three forms."

## 2026-10-10 — A tentacle that exists, proper names, and an editor with handles

**Notes.** No tentacle was visible; it should come out around the P and O, long and purple. Eyes to the left of the t. More room under the title, the give-it line too close to the terminal. I want Webflow-like control: move, resize, expand text blocks myself. Yoggy must not be called "the shoggoth as written"; Yoggy is Yog-Sothoth, Shoggy is the shoggoth; each form gets its Lovecraftian name in its subheader. And what do the caption and "12 tool calls" actually mean, and what do the real mascots show?

**Done.** A filled, tapered purple tentacle with suckers, 430px wide, swaying out from under the P and O; eyes moved to 17% from the right; title margin 150px; give-it and install rows 44px apart. Forms: Yoggy / Yog-Sothoth, Shubby / Shub-Niggurath, Shoggy / Shoggoth, descriptions rewritten to say so. Editor v2: a toolbar over the selected block with move (drag), order, width, size, spacing, alignment and reset; overrides persist in `copy.json` → `layout` and are applied on every page by `public/layout.js`. Free moves are stored as pixel offsets, so they do not reflow on other screen sizes; that is the Webflow trade-off and it is a trade-off I make per element.

## 2026-10-10 — Robust decorations; the invocation register

**Notes.** One browser tab showed enormous eyes under the title and a detached tentacle: the decorations depended on scoped styles that tab did not have. Fix: the title decorations are global rules and the SVGs carry width and height attributes, so even unstyled they stay small. Eyes to 21% from the right, left of the t. Tentacle rooted under the P and O, 270px, sweeping down-left. Title capped at 5rem; terminal to 880px and 17px type, the creature from 14 to 28 columns and 4 to 6 rows.

**Language.** The rule: the words must be the vendors' words, slightly off. "ask it something" → "beseech it something". "Give it:" → "You have given it access to:" with seeing eyes · grasping hands · your shell · the open web · your other apps · more of itself. "tool calls" → "invocations". The same caption now ships in the plugin, tests updated.

## 2026-10-10 — Title down, air under the install line, a full-growth panel, the gradient turns, and Yoggy returns to his frame

**Notes.** The eyes were cutting into "really is"; the title had to come down a smidge. More room between the install line's note and the flavor paragraph. Something to look at on the right of "What it is". The gradient should run dark purple into something orange-green, not a pleasant purple-to-orange. And Yoggy had vanished from the square frame in the forms row.

**Done.** Kicker margin 58px, so the eyes sit 28px clear of it. Flavor paragraph 96px under the note. A sticky aside beside "What it is" with a full-growth Yoggy (stage 6, 22×7) under a FULL GROWTH badge. Gradient now #2a1540 → #5b2d8a → #a63a9a → #6f8f2a → #c98b1a.

**Two bugs, both mine.** (1) The copy JSON was emitted after the page slot, so the mascots script read a null element, threw, and never reached the two mounts; the JSON now lives in the head. (2) Two stray closing braces after the `.kicker` rule swallowed the `.flavor` rule, which is why the 96px margin never applied. Found because the computed margin was 16px while the stylesheet said 96px: the rule was there and matched nothing. The dev server also had a stale style module in Vite's cache; a restart cleared it. Lesson for the editor: a CSS parse error is silent and local, so the check is the computed value, never the source.

**Next.** Shubby, Shoggy and the five unbuilt color schemes.

## 2026-10-15 — Not two dots

**Notes.** In my own terminal it started as literally two green dots, one slightly bigger than the other. Two dots is crazy. It should start as the small purple cloud of protoplasm and grow from there.

**Done.** Stage 0 is now the creature at its smallest (8×2, three eyes forming and unforming) over "You have given it nothing. Yet." The two-dots-and-"something is here" branch is gone from the plugin and from the site's renderer, where it was already unused. The first test now looks for the cloud and the empty caption, and fails against the old code.

## 2026-10-22 to 23 — Foetid-ichor, the first drop

**Notes.** Ship the ichor scheme. Picking Ichor under the color schemes should change the three forms and the full-growth panel, and the full growth under the install line should show the newest scheme. Then: ichor on the full growth and on Yoggy looked like dark gray with pink dots. It was giving the wrong impression; look at real screenshots and fix it. Then the six schemes belong above the three forms, so a pick shows on the forms as you scroll down to them, and finally directly under the full growth, so What it is leads straight into the forms.

**Done.** `/mascot scheme foetid-ichor` paints Yoggy tar in the shadow and greenish-yellow ichor in the light, with red eyes and a pale mask; the other four schemes answer "coming soon". Every scheme is one field over the body, ported from the design rounds, shared by the plugin and the site. On the site the full growth opens in the newest scheme, the built swatches draw the creature, and a click repaints every creature on the page. Page order: install, full growth, six schemes, What it is, three forms, specs. Version 0.3.0.

**The gray was mine.** Light panels darkened every colour to about half, so the eyes would clear a 4.5:1 contrast rule against the body. That rule was never in the approved scheme (in the dark terminal the eyes sit near 1.2:1 against the lit top), and halving it crushed the ichor into tar. Now a creature always sits on the terminal's dark, the ground its schemes are drawn for: the site's creature panels are dark, and on a light terminal the plugin paints its own dark box behind it. The contrast test is gone; a test now checks that light and dark carry the same colours. Found by comparing a screenshot with the round-seven brief card, not by reading the code.

**Also.** The plugin's state contract may augment only `'claude-code'`, so the `toBase64` typing moved into the module after `claude plugin validate` refused a global. Cuddly-apocalypse is now the round-five version, which stops at orange, so it changes colour for anyone already running it.

**Next.** Shubby, then scarred-bones.
