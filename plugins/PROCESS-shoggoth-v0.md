# Process

Design reasoning, in order, the way Pippin Barr keeps it: what was decided, why, and what was tested. Newest entry last.

## 2026-10-07 — Drop one is the terminal, not the browser

**Where it started.** The idea was a browser extension that reskins the cuddly agent mascots as a Lovecraftian monster. Research the same day found two things. First, the big chat surfaces (claude.ai, chatgpt.com) show no avatar at all next to an assistant turn; the mascots live in the agent products, the terminal and the marketing. So the honest move is to add a presence where the vendors chose to show nothing, not to swap an icon. Second, the two text-side de-anthropomorphizing extensions shipped in 2026 have about ten users between them; a skin alone does not travel.

**Why the terminal first.** Claude Code's plugin system can draw a live band above the prompt, rewrite the spinner, raise toasts and read every tool call. That is enough to make the thesis mechanical: the creature grows with what you have granted. It needs no store review, touches nobody's trademark, costs an afternoon, and lands with the audience that already knows the shoggoth meme.

**The rule for the object.** Hit in one sentence, hit harder in three (MSCHF's test). One: your cute AI is a monster. Three: the vendors sell a mind buddy because an actual mind would be terrifying; the doomers say it is a mind and keep using it anyway; here is a small, comprehensible one so both can look at what they claim to be talking to. Both edges are named in the README so the image is not read as doomer iconography alone.

**What was built.** Six capability classes, a stage per class, a deterministic braille creature sized to the band and swayed by a 600 ms tick while a turn runs, unlock toasts, spinner verbs by mode, `/shoggoth` to hide and to print the manifesto. State in `$.state` so a reload keeps the tally.

**What was tested.** `claude plugin validate .` passes. `tsc` passes against the engine's declaration file. Four tests pass under `claude plugin test .`: the dormant band, a Bash call unlocking the shell on the terminal and desktop surfaces, an MCP call naming its server, and hide then `/shoggoth` bringing it back.

**Open.** The name. The creature's look at stage 5 and 6 on a narrow band. Whether the toasts are too many on a busy session. Whether the manifesto should be 300 words or 30.

## 2026-10-08 — First sight

**What I saw.** "A web of purple clouds with orange dots." The caption's "38 acts" meant nothing to me. The animation was there but easy to miss.

**What changed.** The body is now filled cells on a dark purple background, braille only at the rim, so it reads as a mass rather than a cloud. Eyes are wide (◉) while a turn runs and half-lidded (◡) when idle. "acts" became "tool calls so far". The animation ticker now starts once at session start and only advances while a turn runs.

**Still open.** Whether a solid mass at stage five or six is too much band for a narrow terminal. Whether the wriggle should be slower. The name.

**2026-10-08, later.** I preferred the braille body ("squares with purple dots" for the filled version). Reverted to braille; kept the caption wording, the eyes-open-while-working and the session-start ticker. Aesthetic iteration parked until the iconography research lands.
