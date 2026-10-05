# SPEC.md: Turing Machine and Two-Stack Machine Simulators

Version 1.0. This document is the source of truth for behavior. Read `AGENTS.md` for working rules.

## 1. Context and goals

University assignment, *Teoria da Computação e Complexidade* (UNIJUÍ, 2026/2), "Atividade – Simuladores de Modelos de Computação". The team builds two simulators and presents one in class, projected on a screen.

The assignment requires every simulator to show:

| # | Requirement (original wording) | Where it is satisfied |
|---|---|---|
| R1 | Entrada utilizada pela máquina | §7.2 input panel, §7.4 input display |
| R2 | Estado/configuração atual da máquina | §7.3 diagram highlight, §7.5 status line |
| R3 | Memória da máquina visualmente | §8.2 tape view, §9.2 stack view |
| R4 | Instrução/transição atual | §7.6 current-transition panel, diagram edge, table row |
| R5 | Botão "Executar próximo passo" | §7.2 controls |
| R6 | Botão "Executar automaticamente" | §7.2 controls |
| R7 | Botão "Reiniciar" | §7.2 controls |
| R8 | Histórico das configurações | §7.7 history |
| R9 | Indicação clara quando a computação terminar | §7.5 status banner |
| R10 | TM: fita e posição do cabeçote | §8.2 |
| R11 | Stack machines: pilha visível, com inserções e remoções durante a execução | §9.2 (animated push/pop) |

Additional goals chosen by the team: a JFLAP-style state diagram synchronized with execution, import of JFLAP `.jff` Turing machines, and publication on GitHub Pages.

## 2. Glossary

- **Machine definition:** JSON describing states, transitions, alphabets (§5).
- **Configuration:** the complete instantaneous state of a running machine (current state, memory, step count).
- **Step:** application of exactly one transition.
- **Halt result:** `accept`, `reject` or `limit` (step limit reached; possible infinite loop).
- **λ (lambda):** "nothing" (no symbol read, popped or pushed). Stored as the empty string `""` in JSON; displayed as `λ`. The literal `"λ"` in JSON is also accepted and normalized to `""` on load.
- **□:** default blank symbol of the Turing tape.

## 3. Turing Machine semantics

### 3.1 Model

Deterministic, single tape, single head. Transition function δ(state, read) = (next state, write, move), with move ∈ {`L`, `R`, `S`} (left, right, stay).

### 3.2 Tape modes

Set by `tapeMode` in the definition:

- `"infinite"` (default, JFLAP-compatible): tape unbounded in both directions. Cells are indexed by integers (negative allowed). The input is written starting at cell 0. The head starts at cell 0 (on the first input symbol, or on a blank if the input is empty).
- `"semi-infinite"`: tape bounded on the left. If `startMarker` is set (e.g. `"⊳"`), cell 0 holds the marker, the input starts at cell 1, and the head starts at cell 0. If `startMarker` is `null`, input starts at cell 0 and the head starts at cell 0. Moving left from cell 0 halts with `reject` (reason: "O cabeçote tentou sair da fita pela esquerda").

### 3.3 Step algorithm

Given configuration `{ state, tape, head, steps }`:

1. If `state` is a final state → halt with `accept`. (A machine whose initial state is final accepts at step 0.)
2. Read the symbol under the head (blank if the cell was never written).
3. Find the transition with `from === state` and `read === symbol`. If none → halt with `reject` (reason: `Não há transição definida para (q, s)`, with the real values).
4. Write `write` in the cell, move the head, set `state = to`, `steps + 1`. Return the new configuration plus the index of the transition used.
5. The runner (§6.3) halts with `limit` when `steps` reaches the step limit before a halt occurs.

### 3.4 Final tape content

For display and tests, the tape content is the sequence from the leftmost to the rightmost non-blank cell, as a string (the start marker is excluded). Empty if all cells are blank.

## 4. Two-Stack Machine semantics

### 4.1 Model

Deterministic machine with a read-only input read left to right, two unbounded stacks P1 and P2, and a finite set of states. Each transition has:

`from`, `to`, `read` (input symbol or λ), `pop1`, `push1`, `pop2`, `push2`.

### 4.2 Rules

- `read`: if non-λ, the next unread input symbol must equal it, and it is consumed. If λ, input is neither checked nor consumed.
- `pop1` / `pop2`: if non-λ, the top of that stack must equal it, and it is removed. If λ, the stack is not checked or popped. Popping an empty stack never matches.
- `push1` / `push2`: a string of zero or more symbols pushed after the pop. **The leftmost symbol ends on top** (JFLAP convention): pushing `"AB"` onto `Z` gives `Z B A` (bottom → top), with `A` on top. Push λ pushes nothing.
- `bottom`: if set (default `"Z"`), both stacks start containing that single symbol; testing "stack is empty" is done by popping and re-pushing it (`pop1: "Z", push1: "Z"`). If `null`, stacks start empty.

### 4.3 Step algorithm

Given configuration `{ state, inputPos, stack1, stack2, steps }` (stacks are arrays, bottom at index 0):

1. If `state` is final **and** the entire input has been consumed → halt with `accept`.
2. Collect transitions from `state` that are applicable under §4.2. Because definitions are validated as deterministic (§4.4), there is at most one.
3. If none → halt with `reject`. Reason, in order of precedence: if the state is final but input remains, `Estado final atingido, mas a entrada não foi totalmente lida`; otherwise `Não há transição aplicável no estado q (entrada: x, topo P1: y, topo P2: z)`.
4. Apply it: consume input, pop, push, change state, `steps + 1`. Return the new configuration, the transition index, and an `effects` object `{ consumed, popped1, pushed1, popped2, pushed2 }` used by the view for animations.
5. Step limit as in §3.3.

### 4.4 Determinism validation

On load, two transitions from the same state **conflict** when all three pairs are compatible: `read`, `pop1`, `pop2`. Two values are compatible if they are equal or either is λ. Any conflict is a load error: `Máquina não determinística: as transições i e j podem ser aplicadas ao mesmo tempo.`

### 4.5 Alternative definition (not implemented)

Some textbooks define the two-stack machine as a flowchart program (instructions such as *Partida, Leia/Desvie, Empilhe, Desempilhe, Aceita, Rejeita*). This project uses the state-diagram form above, because it maps directly to JFLAP. If the course requires the flowchart form, each instruction can be modeled as a state; that change is out of scope for v1 and should be noted in the README under "Questões em aberto".

## 5. Machine definition format (JSON)

All symbols are **single Unicode characters**. State ids are short strings without spaces (`q0`, `q1`, …).

### 5.1 Turing Machine

```json
{
  "type": "turing",
  "name": "aⁿbⁿ",
  "description": "Aceita palavras com n símbolos a seguidos de n símbolos b (n ≥ 0).",
  "inputAlphabet": ["a", "b"],
  "tapeAlphabet": ["a", "b", "X", "Y", "□"],
  "blank": "□",
  "tapeMode": "infinite",
  "startMarker": null,
  "states": [{ "id": "q0", "x": 80, "y": 160 }],
  "initial": "q0",
  "finals": ["q4"],
  "transitions": [
    { "from": "q0", "read": "a", "to": "q1", "write": "X", "move": "R" }
  ],
  "suggestedInputs": ["aabb", "aab", ""],
  "tests": [
    { "input": "aabb", "expect": "accept" },
    { "input": "aab", "expect": "reject" }
  ]
}
```

Optional test fields: `"expectTape": "1100"` (checks §3.4 content after halting) and `"stepLimit": 100` (overrides the limit for that test).

### 5.2 Two-Stack Machine

```json
{
  "type": "two-stack",
  "name": "aⁿbⁿcⁿ",
  "description": "...",
  "inputAlphabet": ["a", "b", "c"],
  "stackAlphabet": ["A", "B", "Z"],
  "bottom": "Z",
  "states": [{ "id": "q0", "x": 80, "y": 160 }],
  "initial": "q0",
  "finals": ["q0", "qf"],
  "transitions": [
    { "from": "q0", "to": "qa", "read": "a", "pop1": "", "push1": "A", "pop2": "", "push2": "" }
  ],
  "suggestedInputs": ["aabbcc", "aabbc"],
  "tests": [{ "input": "aabbcc", "expect": "accept" }]
}
```

### 5.3 Validation (both types)

`validate(definition)` returns `{ errors: string[], warnings: string[] }` with Portuguese messages. Errors block loading; warnings are shown but allow loading.

Errors: missing or wrong `type`; duplicate state ids; `initial` or a final state not in `states`; transition referencing an unknown state; symbol with more than one character; transition symbols not in the declared alphabets (λ excepted); blank or start marker inside `inputAlphabet`; invalid `move`; TM with two transitions for the same `(from, read)`; two-stack determinism conflicts (§4.4).

Warnings: unreachable states; states with no outgoing transitions that are not final; missing `x`/`y` (automatic layout will be used, §7.3).

### 5.4 Examples manifest

`examples/index.json`:

```json
{
  "turing": [
    { "file": "tm-anbn.json", "name": "aⁿbⁿ" },
    { "file": "tm-binary-increment.json", "name": "Incremento binário" },
    { "file": "tm-loop.json", "name": "Laço infinito (limite de passos)" }
  ],
  "two-stack": [
    { "file": "2p-anbncn.json", "name": "aⁿbⁿcⁿ" },
    { "file": "2p-copy.json", "name": "w#w" }
  ]
}
```

## 6. Module interfaces

### 6.1 Engines (pure; `js/turing/engine.js`, `js/two-stack/engine.js`)

Both export the same functions:

```js
/** Normalize λ, fill defaults. Returns a new definition. */
export function normalize(definition) {}
/** @returns {{errors: string[], warnings: string[]}} */
export function validate(definition) {}
/** @returns {{errors: string[]}} empty errors if every symbol is in inputAlphabet */
export function validateInput(definition, input) {}
/** @returns {Configuration} configuration with steps = 0 */
export function initialConfig(definition, input) {}
/**
 * @returns {{kind: "moved", config, transitionIndex, effects}
 *         | {kind: "halt", result: "accept" | "reject", reason: string, transitionIndex: number | null}}
 */
export function step(definition, config) {}
```

Turing configuration: `{ state, tape, head, steps }`, where `tape` is a plain object mapping cell index (string key) to symbol, holding only non-blank cells. Copy it on write.

Two-stack configuration: `{ state, inputPos, stack1, stack2, steps }` (input itself stays in the runner).

Turing `effects`: `{ readSymbol, written, from, to, move, headBefore, headAfter }`.

### 6.2 Formatters (`format.js` in each machine folder)

- `edgeLabel(t)`: JFLAP label. TM: `a ; X , R`. Two-stack: `a , λ ; A | λ ; λ` meaning `read , pop1 ; push1 | pop2 ; push2`.
- `deltaText(t)`: TM `δ(q0, a) = (q1, X, R)`. Two-stack `δ(q0, a, λ, λ) = (qa, A, λ)`.
- `explain(t, effects)`: one Portuguese sentence, e.g. `Leu "a", escreveu "X", moveu o cabeçote para a direita e foi para q1.` / `Leu "b", desempilhou "A" de P1, empilhou "B" em P2 e foi para qb.` Use "não leu nada da entrada" for read λ.
- `configText(definition, config, input)`: history line.
  - TM: `q1 ⊢ X a [b] b`. The head cell is in brackets; trim leading and trailing blanks but always show the head cell (and the start marker in semi-infinite mode).
  - Two-stack: `qb | restante: bcc | P1: Z A | P2: Z B` (stacks bottom → top; `restante: ε` when input is consumed).
- Move display uses `config.js` `MOVE_LABELS`, default `{ L: "L", R: "R", S: "S" }`; changing it to `{ L: "E", R: "D", S: "P" }` switches to Portuguese textbook notation everywhere.

### 6.3 Runner (`js/core/runner.js`)

```js
export function createRunner({ engine, definition, input, stepLimit, onUpdate }) {}
// returns { step(), play(), pause(), reset(), setSpeed(ms), setStepLimit(n),
//           getState() }
```

- Status values: `ready`, `running` (auto), `paused`, `halted`.
- Keeps `history`: array of `{ step, config, transitionIndex, effects, text }`; entry 0 is the initial configuration.
- `step()` calls `engine.step`; on `moved` it appends to history; on `halt` it sets the halt result. Before calling the engine, if `config.steps >= stepLimit`, it halts with `limit`.
- `play()` steps every `speed` ms using `setTimeout` chaining (not `setInterval`) until halted or paused.
- `reset()` stops auto-run and returns to entry 0 with status `ready`.
- `onUpdate(state)` is called after every change with `{ status, haltResult, haltReason, config, lastTransitionIndex, lastEffects, history }`. Views render only from this object.

### 6.4 Diagram (`js/core/diagram.js`)

```js
export function createDiagram(svgElement, { states, transitions, initial, finals, edgeLabel }) {}
// returns { highlight({ stateId, transitionIndex, status }), clearHighlight(),
//           getPositions(), relayout(), destroy() }
```

Machine-agnostic: it only knows states, transitions and a label function.

### 6.5 Views

Each `view.js` exports `createView(container, definition)` returning `{ render(runnerState, input) }`.

## 7. Shared user interface

### 7.1 Pages and layout

- `index.html`: title "Simuladores de Modelos de Computação", course name, two cards linking to `turing.html` and `duas-pilhas.html` with a one-line description each, team names placeholder in the footer.
- Both simulator pages share the same layout, with a header containing the page title and a link back to the home page.
- Desktop (≥ 1024 px): left column (controls and input, ~300 px); main area with the diagram on top and the memory view below; right column with current transition, transition table and history. Tablet and phone: single column in the order controls → status → diagram → memory → current transition → history → table.
- Must be readable on a projector: base font 16 px minimum, tape and stack cells at least 40 px, high contrast. Support light and dark color schemes through `prefers-color-scheme`.

### 7.2 Controls panel

- **Exemplo:** `<select>` loaded from `examples/index.json`. Changing it loads the definition and resets.
- **Entrada:** text field plus "Carregar entrada" button (Enter also loads). Empty field means the empty word, displayed as `ε (palavra vazia)`. Invalid symbols show an inline error listing them and prevent loading. Quick-pick chips for `suggestedInputs`.
- **Buttons (exact labels):** `Executar próximo passo`, `Executar automaticamente` (becomes `Pausar` while running), `Reiniciar`.
- **Velocidade:** range slider, 50–2000 ms per step, default 600 ms (`config.js`). Shows the value.
- **Limite de passos:** number input, default 1000, minimum 1.
- **Contador:** `Passo: N`.
- Buttons are disabled when meaningless (no step or play after halting; reset disabled at step 0 when not running).
- Keyboard shortcuts when focus is not in a text field: `→` or `N` next step, `Space` play/pause, `R` reset. Listed in a small help line.
- **Definição da máquina** (collapsible `<details>`): textarea with the current JSON, buttons `Aplicar JSON` (validate and load) and `Copiar JSON` (includes current node positions from the diagram). Validation errors and warnings are listed below the textarea.

### 7.3 State diagram (JFLAP style)

- Rendered in SVG with a `viewBox` that fits all nodes plus margin; it scales with the container.
- **States:** circles, radius 24, state id centered. Final states: double circle (inner radius 19). Initial state: a hollow triangle pointing at the circle from its left, as in JFLAP.
- **Transitions:** arrows with arrowheads (SVG `marker`), ending at the circle border. Transitions with the same `from` and `to` share one arrow, with labels stacked vertically (one line per transition, in definition order).
  - **Self-loop:** a loop arc above the node, labels stacked above the arc.
  - **Opposite pair** (A→B and B→A both exist): both drawn as quadratic curves bending to opposite sides, so they don't overlap.
  - Otherwise a straight line, label placed at the midpoint offset perpendicular to the line, kept horizontal and readable.
- **Positions:** from `x`/`y` in the definition. If any are missing, place all states evenly on a circle (initial state on the left).
- **Dragging:** nodes can be dragged with mouse and touch (pointer events); edges and labels follow live. Positions are kept in memory and exported by `Copiar JSON`.
- **Highlighting:**
  - Current state: filled with `--state-current` (yellow, as in JFLAP).
  - The edge of the transition just taken: thicker stroke in `--edge-active`, and the specific label line bold and colored; it stays highlighted until the next step.
  - On halt: the current state filled `--state-accept` (green) for accept, `--state-reject` (red) for reject, `--state-limit` (orange) for limit.
- Diagram must remain legible for machines with up to 12 states and 30 transitions.

### 7.4 Input display

Always visible above the memory view: `Entrada: aabb` (or `ε`). For the two-stack machine this is the input tape described in §9.2.

### 7.5 Status banner and status line

- A banner at the top of the main area. States and texts:
  - ready: neutral, `Pronta. Clique em "Executar próximo passo" ou "Executar automaticamente".`
  - running/paused: neutral, `Executando…` / `Pausada no passo N.`
  - accept: green, large text `✔ ACEITA`, plus `A máquina parou no estado final q4 após N passos.`
  - reject: red, `✘ REJEITA`, plus the reason from the engine.
  - limit: orange, `⚠ LIMITE DE PASSOS ATINGIDO`, plus `A máquina executou N passos sem parar. Pode estar em laço infinito.`
- Below it, a status line: `Estado atual: q2 · Passo: 7`.
- The banner uses `role="status"` / `aria-live="polite"` and includes the icon and text, never color alone.

### 7.6 Current transition panel

Shows, for the last step: `Passo N`, `deltaText`, and `explain` sentence. Before the first step: `Nenhuma transição executada ainda.` On reject by missing transition, shows the reason instead.

### 7.7 History

- Scrollable list, newest at the bottom, auto-scrolls to the latest entry. Each entry: step number, `configText`, and the edge label of the transition that produced it (none for entry 0). Monospace font.
- The latest entry is highlighted. After halting, a final line shows the result (`ACEITA`, `REJEITA` or `LIMITE`).
- Clicking an entry is optional (stretch goal §12).

### 7.8 Transition table

Table of all transitions, the active one highlighted and scrolled into view.
- TM columns: `Estado`, `Lê`, `Escreve`, `Move`, `Próximo`.
- Two-stack columns: `Estado`, `Lê`, `Desempilha P1`, `Empilha P1`, `Desempilha P2`, `Empilha P2`, `Próximo`.
- λ shown as `λ`, blank as the definition's blank symbol.

## 8. Turing Machine page (`turing.html`)

### 8.1 Page specifics

Title: `Máquina de Turing`. Controls panel additionally has an `Importar .jff (JFLAP)` file input (§10).

### 8.2 Tape view

- Horizontal row of square cells (≥ 40 px), symbol centered, monospace. Cell index shown small below each cell.
- Shows every cell from the leftmost to the rightmost visited or non-blank cell, plus 3 blank cells of padding on each side (none to the left of cell 0 in semi-infinite mode, where the left edge is drawn as a thick wall).
- The head is a triangle/arrow above the current cell, labeled with the current state id. The head cell has a highlighted border.
- When the head moves, the head marker slides (CSS transition, duration `min(250, speed × 0.6)` ms). The cell just written flashes briefly.
- The tape container scrolls horizontally and keeps the head in view, centered when possible.
- After halting, show `Conteúdo final da fita: ...` (§3.4).

## 9. Two-Stack Machine page (`duas-pilhas.html`)

### 9.1 Page specifics

Title: `Máquina de Duas Pilhas`. A small legend explains the label format: `leitura , desempilha P1 ; empilha P1 | desempilha P2 ; empilha P2`.

### 9.2 Memory view

- **Input tape:** row of cells with the input; consumed symbols greyed out; a pointer under the next symbol to read; text `Entrada totalmente lida` when finished.
- **Stacks:** two vertical columns side by side labeled `Pilha 1 (P1)` and `Pilha 2 (P2)`. Bottom at the bottom, each element a box (≥ 40 px), the top element highlighted with a `topo` label. Empty stack shows `vazia`.
- **Animations (R11):** pushed elements slide in from above and fade in; popped elements slide up and fade out before being removed. Duration `min(250, speed × 0.6)` ms. When a step pops and pushes on the same stack, the pop animation runs before the push. Under `prefers-reduced-motion`, animations are disabled.
- A line below each stack shows the last operation: `Empilhou "A"`, `Desempilhou "B"`, or `Sem alteração`.

## 10. JFLAP `.jff` import (Turing Machine only)

- Accept a `.jff` file chosen by the user; read it with `FileReader` and parse with `DOMParser`.
- Supported: `<structure><type>turing</type><automaton>…</automaton></structure>` with `<state id name>` containing `<x>`, `<y>`, optional `<initial/>` and `<final/>`, and `<transition>` with `<from>`, `<to>`, `<read>`, `<write>`, `<move>`. Also tolerate the JFLAP 7 wrapper where `<automaton>` holds the states directly.
- Mapping: state `name` becomes the id (fallback `q` + id); empty `<read>` or `<write>` means the blank; `move` R/L/S maps directly; coordinates are kept, scaled down if the machine is wider than the diagram.
- Alphabets: `.jff` files don't declare them, so infer them. `inputAlphabet` = all non-blank symbols read by transitions leaving the initial state; `tapeAlphabet` = every symbol in reads and writes, plus the blank. Show a warning that the input alphabet was inferred and can be corrected in the JSON panel.
- Reject with a clear Portuguese message: non-Turing types (`fa`, `pda`, …), multi-tape machines (`tapes` attribute greater than 1), building blocks (`<block>` elements), malformed XML.
- Optional (stretch §12): `Exportar .jff` that produces a file JFLAP can open.

## 11. Milestones

Each milestone ends with `npm test` passing and is committed separately.

1. **Skeleton and engines.** Folder structure, `package.json`, `config.js`, both engines with `normalize`, `validate`, `validateInput`, `initialConfig`, `step`, both formatters, all example files of §13, `tests/*.test.js` covering §3, §4, §5.3 and every example's `tests`.
2. **Turing page without diagram.** Shared layout and CSS, runner, controls, status banner, current transition panel, history, transition table, tape view. All of R1–R10 work on the TM page except the diagram.
3. **Diagram.** `diagram.js` with layout, all edge kinds, dragging and highlighting, integrated in the TM page.
4. **Two-stack page.** Views with input tape and animated stacks, reusing everything shared.
5. **JFLAP import.** `jff.js` with `tests/jff.test.js` (use small inline XML strings as fixtures).
6. **Polish and publish.** Home page, keyboard shortcuts, responsive and projector check, dark mode, README (how to use, label formats, how to run locally, GitHub Pages instructions, team, "Uso de IA generativa" section left for the team to fill, "Questões em aberto").

## 12. Stretch goals (only after milestone 6)

- Click a history entry to view that configuration (read-only), or a `Voltar passo` button.
- `Exportar .jff` for the Turing Machine.
- Pan and zoom in the diagram.
- Setting toggle between `L/R/S` and `E/D/P` notation in the UI.

Out of scope: nondeterministic machines, multi-tape machines, visual machine editor, Post machine and one-stack machine simulators, backend or storage.

## 13. Example machines

Positions are suggestions in a ~600×340 coordinate space; adjust for readability. All expected results below must be encoded in each file's `tests` array.

### 13.1 `tm-anbn.json`: aⁿbⁿ, n ≥ 0

`tapeMode: "infinite"`, blank `□`, tape alphabet `a b X Y □`, initial `q0`, final `q4`.

| From | Read | To | Write | Move |
|---|---|---|---|---|
| q0 | a | q1 | X | R |
| q0 | Y | q3 | Y | R |
| q0 | □ | q4 | □ | R |
| q1 | a | q1 | a | R |
| q1 | Y | q1 | Y | R |
| q1 | b | q2 | Y | L |
| q2 | a | q2 | a | L |
| q2 | Y | q2 | Y | L |
| q2 | X | q0 | X | R |
| q3 | Y | q3 | Y | R |
| q3 | □ | q4 | □ | R |

Positions: q0 (80,170), q1 (260,170), q2 (260,300), q3 (440,170), q4 (560,170).

Tests: `""` accept; `ab` accept; `aabb` accept; `aaabbb` accept; `a` reject; `b` reject; `aab` reject; `abb` reject; `ba` reject; `abab` reject.

### 13.2 `tm-binary-increment.json`: adds 1 to a binary number

Input alphabet `0 1`, initial `q0`, final `q2`. Head starts at the leftmost digit, runs right to the end, then adds with carry.

| From | Read | To | Write | Move |
|---|---|---|---|---|
| q0 | 0 | q0 | 0 | R |
| q0 | 1 | q0 | 1 | R |
| q0 | □ | q1 | □ | L |
| q1 | 1 | q1 | 0 | L |
| q1 | 0 | q2 | 1 | L |
| q1 | □ | q2 | 1 | L |

Positions: q0 (100,170), q1 (300,170), q2 (500,170).

Tests (all accept): `1011` → expectTape `1100`; `111` → `1000`; `0` → `1`; `""` → `1`; `100` → `101`.

### 13.3 `tm-loop.json`: demonstrates the step limit

Input alphabet `a`, single state `q0` (initial, not final), transitions `q0, a → q0, a, R` and `q0, □ → q0, □, R`. Tests: `aa` with `stepLimit: 50` expect `limit`; `""` with `stepLimit: 50` expect `limit`.

### 13.4 `2p-anbncn.json`: aⁿbⁿcⁿ, n ≥ 0 (not context-free; one stack cannot do it)

`bottom: "Z"`, stack alphabet `A B Z`, initial `q0`, finals `q0` and `qf`. Labels in `read , pop1 ; push1 | pop2 ; push2` form:

| From | To | Label |
|---|---|---|
| q0 | qa | `a , λ ; A | λ ; λ` |
| qa | qa | `a , λ ; A | λ ; λ` |
| qa | qb | `b , A ; λ | λ ; B` |
| qb | qb | `b , A ; λ | λ ; B` |
| qb | qc | `c , Z ; Z | B ; λ` |
| qc | qc | `c , Z ; Z | B ; λ` |
| qc | qf | `λ , Z ; Z | Z ; Z` |

Idea: count a's on P1, move each to P2 as B while reading b's, check P1 is empty and remove a B for each c, then check P2 is empty.

Positions: q0 (60,170), qa (180,170), qb (300,170), qc (420,170), qf (540,170).

Tests: `""` accept; `abc` accept; `aabbcc` accept; `aaabbbccc` accept; `a` reject; `ab` reject; `aabbc` reject; `abcc` reject; `aabcc` reject; `abbc` reject; `acb` reject; `abcabc` reject.

### 13.5 `2p-copy.json`: w#w, w ∈ {a,b}* (not context-free)

`bottom: "Z"`, input alphabet `a b #`, stack alphabet `a b Z`, initial `q0`, final `q3`.

| From | To | Label |
|---|---|---|
| q0 | q0 | `a , λ ; a | λ ; λ` |
| q0 | q0 | `b , λ ; b | λ ; λ` |
| q0 | q1 | `# , λ ; λ | λ ; λ` |
| q1 | q1 | `λ , a ; λ | λ ; a` |
| q1 | q1 | `λ , b ; λ | λ ; b` |
| q1 | q2 | `λ , Z ; Z | λ ; λ` |
| q2 | q2 | `a , λ ; λ | a ; λ` |
| q2 | q2 | `b , λ ; λ | b ; λ` |
| q2 | q3 | `λ , λ ; λ | Z ; Z` |

Idea: push w onto P1, transfer P1 to P2 (which reverses it, putting w's first symbol on top), then match the second w against P2.

Positions: q0 (90,170), q1 (240,170), q2 (390,170), q3 (530,170).

Tests: `#` accept; `a#a` accept; `ab#ab` accept; `abba#abba` accept; `ab#ba` reject; `ab` reject; `a#` reject; `#a` reject; `a#ab` reject; `ab#a` reject; `a#a#a` reject.

## 14. Testing requirements

- `tests/examples.test.js` loads every file listed in `examples/index.json` with `node:fs`, checks `validate` returns no errors, runs each test case to a halt using the default step limit (or the case's `stepLimit`), and compares the result and `expectTape`.
- Engine tests also cover: TM accept at step 0 when initial is final; reject on missing transition with the correct reason; semi-infinite left-edge reject; start marker placement; multi-symbol push order (`"AB"` → `A` on top); pop on empty stack never matches; determinism conflict detection; λ normalization; `validateInput` with invalid symbols; immutability (the previous configuration is unchanged after `step`).
- Formatter tests: `edgeLabel`, `deltaText` and `configText` for at least one TM and one two-stack case, including blank trimming and the `ε` display.

## 15. Conventions to confirm with the course material

The course book (from page 102) and the indicated videos may use different conventions. Defaults are listed so the agent can proceed; the team confirms and adjusts the JSON or `config.js`, not the engine:

| Topic | Default in this spec | Possible textbook variant |
|---|---|---|
| TM tape | Infinite both ways (`tapeMode: "infinite"`) | Semi-infinite with start marker `⊳` (already supported) |
| Blank symbol | `□` | `β` (change `blank` in the JSON) |
| Move letters | `L`, `R`, `S` | `E`, `D` (change `MOVE_LABELS`) |
| TM acceptance | Halt as soon as a final state is reached | Same in most books |
| Two-stack form | State diagram with JFLAP-like labels | Flowchart program (§4.5) |
| Two-stack acceptance | Final state with input fully consumed | Explicit `Aceita` instruction |
