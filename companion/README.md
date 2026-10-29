# Apocalypse Mascots, beside any agent

**Code with AI as it really is.** Now in Codex, Gemini CLI, Cursor, Copilot, OpenCode, Windsurf and the rest.

In Claude Code the creature lives above your prompt: that is the plugin, one folder up. Every other agent keeps its own screen to itself, so here the creature takes a pane of its own beside it, and grows from the agent's hooks: one stage for each kind of thing you let the agent do.

## Install

```
npm install -g apocalypse-mascots
apocalypse-mascots setup codex --write
apocalypse-mascots
```

The second line wires the agent's hooks; the third opens the pane. Run it in a split beside the agent: a tmux or WezTerm pane, a second tab, or the terminal panel of your editor. `q` closes it; `f`, `s` and `t` change the form, the scheme and the theme.

## The agents

| Agent | `setup <agent> --write` adds | Then |
|-------|------------------------------|------|
| Codex CLI | four hooks to `~/.codex/hooks.json` | open `/hooks` in Codex and trust them; Codex runs no hook it has not been told to trust |
| Gemini CLI | four hooks to `~/.gemini/settings.json` | |
| Cursor, the editor and `cursor-agent` | four hooks to `~/.cursor/hooks.json` | |
| GitHub Copilot CLI | `~/.copilot/hooks/apocalypse-mascots.json` | |
| OpenCode | a small plugin, `~/.config/opencode/plugins/apocalypse-mascots.js` | restart OpenCode |
| Windsurf (Devin Desktop) | six hooks to `~/.codeium/windsurf/hooks.json` | |
| Qwen Code | four hooks to `~/.qwen/settings.json` | |
| Factory Droid | four hooks to `~/.factory/hooks.json` | |

Without `--write`, `setup <agent>` prints what it would add and where, and touches nothing. With it, the file as it was is kept beside it as `<file>.before-mascots`; a file that is not plain JSON is left alone. `apocalypse-mascots setup` lists the rest, Cline and Kiro among them, with what to add by hand.

## What it never does

It never stops your agent: it reads each tool call after the tool has run, says nothing, and exits cleanly whatever it is handed. No network calls. A hook writes one line per event, holding the event, the agent and the tool's name (never your prompt, never the model's answer), to a log in `~/.apocalypse-mascots/`, and a log a week old is deleted. Your agent's config changes only when you pass `--write`.

## How it is built

The same drawing code as the plugin and the site (`../plugins/apocalypse-mascots/hooks/mascot.ts` and `figures.ts`), bundled into one file with no dependencies. Truecolor where the terminal has it, the 256-colour cube where it does not. Tests: `npm test`.

Site: https://accidentalintelligence.org/mascots/
