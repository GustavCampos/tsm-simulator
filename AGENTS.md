# AGENTS.md

Instructions for AI coding agents working on this repository. Read this file and `SPEC.md` completely before writing any code. `SPEC.md` is the source of truth for behavior; this file covers how to work.

## Project in one paragraph

A static website, published on GitHub Pages, with two step-by-step simulators of abstract computation models: a **Turing Machine** and a **Two-Stack Machine**. Each simulator shows a JFLAP-style state diagram, the machine's memory (tape or stacks), the current transition, a configuration history, and clear halting status. It is a university assignment (Teoria da Computação e Complexidade, UNIJUÍ, 2026/2) built by a team of four students and presented in class.

## Hard constraints (never violate)

1. **Plain HTML, CSS and JavaScript only.** No frameworks (React, Vue, Svelte…), no TypeScript, no bundlers, no transpilers, no CSS preprocessors, no Tailwind.
2. **No runtime dependencies and no CDNs.** Everything the site needs lives in this repository. Draw the diagram with hand-written SVG; do not use graph or diagram libraries.
3. **ES modules** (`<script type="module">`, `import`/`export`). One responsibility per file.
4. **Relative paths only** (`./js/core/runner.js`, never `/js/core/runner.js`). GitHub Pages serves the site under `/<repo-name>/`, so absolute paths break.
5. **Engines are pure.** Files in `js/turing/engine.js` and `js/two-stack/engine.js` must not touch the DOM, `window`, timers or `fetch`. They take data and return new data. This is what makes them testable in Node.
6. **Configurations are immutable.** `step()` returns a new configuration object; never mutate the previous one (the history depends on this).
7. **User interface text in Brazilian Portuguese; code in English.** Identifiers, comments, commit messages and file names (except the HTML page names listed in the spec) are in English. Every string the user sees is in Portuguese.
8. `package.json` exists only to run tests. It must have **zero dependencies** and `"type": "module"`.

## Repository layout

```
/
├── index.html                 home page (choose a simulator)
├── turing.html                Turing Machine simulator
├── duas-pilhas.html           Two-Stack Machine simulator
├── css/
│   ├── base.css               design tokens (CSS variables), layout, buttons, banner
│   └── machines.css           tape, stacks, diagram, tables, history
├── js/
│   ├── config.js              UI constants (default speed, step limit, notation)
│   ├── core/
│   │   ├── runner.js          step / auto-run / reset / speed / step limit
│   │   ├── history.js         configuration history panel
│   │   ├── diagram.js         SVG state diagram, shared by both machines
│   │   ├── loader.js          example loading, JSON panel, input validation
│   │   └── ui.js              small DOM helpers, status banner
│   ├── turing/
│   │   ├── engine.js          pure TM logic
│   │   ├── format.js          labels, δ text, configuration strings
│   │   ├── view.js            tape + head rendering
│   │   ├── page.js            wires everything on turing.html
│   │   └── jff.js             JFLAP .jff import (and optional export)
│   └── two-stack/
│       ├── engine.js          pure two-stack logic
│       ├── format.js
│       ├── view.js            input tape + two animated stacks
│       └── page.js
├── examples/
│   ├── index.json             manifest of examples per machine type
│   └── *.json                 machine definitions (format in SPEC.md)
├── tests/
│   ├── turing.test.js
│   ├── two-stack.test.js
│   ├── jff.test.js
│   └── examples.test.js       runs the "tests" array of every example file
├── package.json
├── README.md
├── AGENTS.md
└── SPEC.md
```

Do not add folders or top-level files beyond these without a reason written in the README.

## Running and testing

- **Run locally:** ES modules and `fetch` do not work from `file://`. Serve the folder with `python3 -m http.server 8000` (or VS Code Live Server) and open `http://localhost:8000/`.
- **Tests:** `npm test`, which runs `node --test tests/`. Uses Node's built-in test runner and `node:assert`; requires Node 18+. No test libraries.
- **Before finishing any task:** run `npm test` and confirm all tests pass. If you changed the UI, open the affected page through the local server and check the browser console has no errors.

## Coding conventions

- `const` by default, `let` when reassigned, never `var`. Strict equality. Semicolons.
- Named exports only; no default exports.
- Small functions with JSDoc comments on every exported function, including the shape of objects passed in and out.
- Errors meant for the user are returned as data (`{ errors: [...] }`) with Portuguese messages; they are never shown with `alert()`.
- Colors, spacing and fonts come from CSS variables declared in `css/base.css`. No hard-coded colors in JS except reading CSS variables.
- Accessibility: every control has a visible label or `aria-label`; status is communicated with text as well as color; buttons are real `<button>` elements; the page is usable with the keyboard.
- No `innerHTML` with data that came from user JSON or `.jff` files. Use `textContent` and `createElement`/`createElementNS`.
- Keep symbols as single Unicode characters (the spec relies on this). Use `Array.from(str)` rather than indexing strings, so characters like `□`, `⊳` and `λ` are handled correctly.

## Module boundaries (team ownership)

The team splits work by area. Keep each area's code inside its folder and interact only through the interfaces defined in `SPEC.md` §6.

| Owner | Area |
|---|---|
| Person A | `index.html`, page layouts, `css/`, `js/core/runner.js`, `history.js`, `loader.js`, `ui.js`, README, GitHub Pages |
| Person B | `js/turing/*`, Turing examples |
| Person C | `js/two-stack/*`, two-stack examples |
| Person D | `js/core/diagram.js` |

## Implementation order

Follow the milestones in `SPEC.md` §11. Finish and test each one before starting the next. Engines and their tests come first, because every visual part depends on them.

## Things not to do

- Do not change the machine semantics in `SPEC.md` §3 and §4 because another textbook defines them differently. If something seems wrong, keep the spec's behavior and leave a note in the README under "Questões em aberto".
- Do not add nondeterminism, a visual machine editor, user accounts, analytics, or a backend. These are out of scope.
- Do not use `localStorage` for anything essential; the site must work with storage disabled.
- Do not invent example machines beyond those in the spec without also adding a `tests` array that proves they work.
- Do not leave placeholder text, `TODO` stubs, or commented-out code in finished milestones.

## Definition of done

A milestone is done when: its acceptance criteria in `SPEC.md` are met, `npm test` passes, the pages load from a local server with no console errors, the layout works at 1366×768 (projector) and at 390 px wide, and the README reflects any new behavior.
