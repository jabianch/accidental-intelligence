# Accidental Intelligence

Small objects about what we are actually talking to.

A non-profit, for now. An art project by Joseph Bianchi, Amsterdam. https://accidentalintelligence.org

## Products

| # | Object | Status |
|---|--------|--------|
| 1 | [Apocalypse Mascots](plugins/apocalypse-mascots/) — Code with AI as it really is. | available |

## The site

`cd site && npm install && npm run dev` serves the lab page at http://127.0.0.1:4321/ with hot reload. All copy is `site/src/copy.json`. In the browser, press **e** (or click Edit, bottom-left): click any text to change it in place; a toolbar appears over the selected block with ✥ (drag to move), ↑↓ (order among its neighbors), W−/W+ (width), A−/A+ (text size), S−/S+ (space above), L/C/R (alignment) and reset; drag the section handles to reorder whole sections. **Save** or Ctrl+S writes everything back to `copy.json` (text, section order, and a `layout` block of per-element overrides that `public/layout.js` applies on every page). The editor only appears on localhost; the built site carries the layout but no editor.

## Install

### Claude Code

From a terminal session of Claude Code:

```
/plugin install apocalypse-mascots --marketplace jabianch/accidental-intelligence
```

Answer `y` to add the marketplace, then pick the user scope.

### Codex, Gemini CLI, Cursor, Copilot, OpenCode, Windsurf, Qwen Code, Factory Droid

```
npm install -g apocalypse-mascots
apocalypse-mascots setup codex --write
```

Put your agent's name where `codex` is. In Codex, also open `/hooks` and trust the four hooks: Codex runs no hook until you do. Run `apocalypse-mascots` in a terminal beside the agent; the creature lives in that pane. Details: [companion/](companion/).
