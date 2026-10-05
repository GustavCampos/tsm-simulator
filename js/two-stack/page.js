import * as engine from './engine.js';
import { edgeLabel, deltaText, explain, configText } from './format.js';
import { createRunner } from '../core/runner.js';
import { createHistory } from '../core/history.js';
import { createDiagram } from '../core/diagram.js';
import { loadManifest, loadExample, parseDefinitionText, validateAndNormalize } from '../core/loader.js';
import { clear, el, setBanner, counterText, statusLineText } from '../core/ui.js';
import {
  DEFAULT_SPEED,
  DEFAULT_STEP_LIMIT,
  SPEED_MIN,
  SPEED_MAX,
  STEP_LIMIT_MIN,
} from '../config.js';
import { createView } from './view.js';

/**
 * Get an element by id, throwing when it is missing.
 * @param {string} id element id
 * @returns {HTMLElement} the element
 */
function byId(id) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Elemento #${id} não encontrado.`);
  }
  return node;
}

/**
 * Show a symbol, displaying lambda as λ.
 * @param {string} symbol single symbol or "" for lambda
 * @returns {string} display string
 */
function show(symbol) {
  if (symbol === '' || symbol === null || symbol === undefined) {
    return 'λ';
  }
  return symbol;
}

const exampleSelect = byId('example-select');
const inputField = byId('input-field');
const loadInputButton = byId('load-input-btn');
const inputError = byId('input-error');
const chipsBox = byId('chips');
const machineName = byId('machine-name');
const machineDescription = byId('machine-description');
const stepButton = byId('btn-step');
const playButton = byId('btn-play');
const resetButton = byId('btn-reset');
const speedInput = byId('speed');
const speedValue = byId('speed-value');
const limitInput = byId('step-limit');
const stepCount = byId('step-count');
const banner = byId('banner');
const statusLine = byId('status-line');
const diagramBox = byId('diagram-view');
const memoryBox = byId('memory-view');
const transitionNow = byId('transition-now');
const historyBox = byId('history-list');
const transitionRows = byId('transition-rows');
const jsonText = byId('machine-json');
const applyJsonButton = byId('btn-apply-json');
const copyJsonButton = byId('btn-copy-json');
const jsonMessage = byId('json-message');
const jsonMessages = byId('json-messages');

let definition = null;
let currentInput = '';
let runner = null;
let memoryView = null;
let diagram = null;
let tableRowNodes = [];
const historyPanel = createHistory(historyBox, { edgeLabel });

/**
 * Build the state diagram for the loaded machine, discarding the old one.
 */
function buildDiagram() {
  if (diagram) {
    diagram.destroy();
    diagram = null;
  }
  diagramBox.replaceChildren();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  diagramBox.append(svg);
  diagram = createDiagram(svg, {
    states: definition.states,
    transitions: definition.transitions,
    initial: definition.initial,
    finals: definition.finals,
    edgeLabel,
  });
}

/**
 * Current node positions, merging diagram drags into a definition copy.
 * @param {object} base normalized definition
 * @returns {object} definition copy with updated x/y
 */
function withCurrentPositions(base) {
  const copy = JSON.parse(JSON.stringify(base));
  if (!diagram) {
    return copy;
  }
  const positions = diagram.getPositions();
  for (const state of copy.states) {
    if (positions[state.id]) {
      state.x = positions[state.id].x;
      state.y = positions[state.id].y;
    }
  }
  return copy;
}

/**
 * List validation errors and warnings below the JSON panel.
 * @param {string[]} errors blocking errors in Portuguese
 * @param {string[]} warnings non-blocking warnings in Portuguese
 */
function showValidation(errors, warnings) {
  clear(jsonMessages);
  for (const message of errors) {
    jsonMessages.append(el('li', { cls: 'error', text: message }));
  }
  for (const message of warnings) {
    jsonMessages.append(el('li', { cls: 'warning', text: message }));
  }
}

/**
 * Build the transition table rows for the loaded machine.
 */
function buildTable() {
  clear(transitionRows);
  tableRowNodes = definition.transitions.map((t) => {
    const tr = document.createElement('tr');
    tr.append(
      el('td', { text: t.from }),
      el('td', { text: show(t.read) }),
      el('td', { text: show(t.pop1) }),
      el('td', { text: show(t.push1) }),
      el('td', { text: show(t.pop2) }),
      el('td', { text: show(t.push2) }),
      el('td', { text: t.to }),
    );
    transitionRows.append(tr);
    return tr;
  });
}

/**
 * Build the quick-pick chips for the suggested inputs.
 */
function buildChips() {
  clear(chipsBox);
  for (const suggestion of definition.suggestedInputs ?? []) {
    const chip = el('button', {
      text: suggestion === '' ? 'ε (vazia)' : suggestion,
      attrs: { type: 'button', title: `Usar a entrada "${suggestion}"` },
    });
    chip.addEventListener('click', () => {
      inputField.value = suggestion;
      loadInput();
    });
    chipsBox.append(chip);
  }
}

/**
 * Render the current transition panel from the runner state.
 * @param {object} state runner state
 */
function renderTransition(state) {
  clear(transitionNow);
  const lastEntry = state.history[state.history.length - 1];
  if (lastEntry.transitionIndex === null || lastEntry.transitionIndex === undefined) {
    if (state.status === 'halted') {
      transitionNow.append(el('p', { text: state.haltReason }));
    } else {
      transitionNow.append(el('p', { cls: 'empty', text: 'Nenhuma transição executada ainda.' }));
    }
    return;
  }
  if (state.status === 'halted' && state.haltResult !== 'accept') {
    transitionNow.append(el('p', { text: state.haltReason }));
    return;
  }
  const t = definition.transitions[lastEntry.transitionIndex];
  transitionNow.append(
    el('p', { cls: 'step-no', text: `Passo ${lastEntry.step}` }),
    el('p', { cls: 'delta', text: deltaText(t) }),
    el('p', { text: explain(t, lastEntry.effects) }),
  );
}

/**
 * Highlight the active table row and scroll it into view.
 * @param {object} state runner state
 */
function renderTableActive(state) {
  tableRowNodes.forEach((tr, i) => {
    tr.classList.toggle('active-row', i === state.lastTransitionIndex);
  });
  if (state.lastTransitionIndex !== null && tableRowNodes[state.lastTransitionIndex]) {
    tableRowNodes[state.lastTransitionIndex].scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Render every panel from the runner state. Views read only this object.
 * @param {object} state runner state
 */
function renderAll(state) {
  setBanner(banner, state);
  statusLine.textContent = statusLineText(state.config);
  stepCount.textContent = counterText(state.config.steps);
  const halted = state.status === 'halted';
  stepButton.disabled = halted || state.status === 'running';
  playButton.disabled = halted;
  playButton.textContent = state.status === 'running' ? 'Pausar' : 'Executar automaticamente';
  resetButton.disabled = state.config.steps === 0 && state.status !== 'running';
  renderTransition(state);
  historyPanel.render(state, definition);
  renderTableActive(state);
  memoryView.render(state, currentInput);
  if (diagram) {
    diagram.highlight({
      stateId: state.config.state,
      transitionIndex: state.lastTransitionIndex,
      status: state.status === 'halted' ? state.haltResult : null,
    });
  }
}

/**
 * Load a machine definition and reset execution with the given input.
 * @param {object} rawDefinition machine definition (raw or normalized)
 * @param {string} input input word
 * @returns {boolean} true when loaded, false when blocked by errors
 */
function loadMachine(rawDefinition, input) {
  const { definition: normalized, errors, warnings } = validateAndNormalize(engine, rawDefinition);
  showValidation(errors, warnings);
  if (errors.length > 0) {
    return false;
  }
  definition = normalized;
  currentInput = input;
  machineName.textContent = definition.name ?? 'Máquina de Duas Pilhas';
  machineDescription.textContent = definition.description ?? '';
  jsonText.value = JSON.stringify(definition, null, 2);
  buildTable();
  buildChips();
  memoryView = createView(memoryBox, definition);
  buildDiagram();
  if (!runner) {
    runner = createRunner({
      engine,
      definition,
      input: currentInput,
      stepLimit: Number(limitInput.value) || DEFAULT_STEP_LIMIT,
      speed: Number(speedInput.value) || DEFAULT_SPEED,
      configText,
      onUpdate: renderAll,
    });
    renderAll(runner.getState());
  } else {
    runner.load({ definition, input: currentInput });
  }
  return true;
}

/**
 * Validate the input field and reload the machine with it.
 */
function loadInput() {
  const { errors } = engine.validateInput(definition, inputField.value);
  if (errors.length > 0) {
    inputError.textContent = errors[0];
    inputError.hidden = false;
    return;
  }
  inputError.hidden = true;
  currentInput = inputField.value;
  runner.load({ definition, input: currentInput });
}

/**
 * Choose an input when the machine changes: keep the current one when
 * valid, otherwise fall back to the first suggestion or the empty word.
 * @returns {string} input word to use
 */
function pickInputForMachine() {
  if (engine.validateInput(definition, inputField.value).errors.length === 0) {
    return inputField.value;
  }
  const fallback = (definition.suggestedInputs ?? [])[0] ?? '';
  inputField.value = fallback;
  inputError.hidden = true;
  return fallback;
}

/**
 * Load an example file and run it.
 * @param {string} file file name inside `examples/`
 */
async function loadExampleFile(file) {
  const { data, errors } = await loadExample(file);
  if (errors) {
    showValidation(errors, []);
    return;
  }
  const { definition: normalized } = validateAndNormalize(engine, data);
  definition = normalized;
  loadMachine(data, pickInputForMachine());
}

stepButton.addEventListener('click', () => runner.step());
playButton.addEventListener('click', () => {
  if (runner.getState().status === 'running') {
    runner.pause();
  } else {
    runner.play();
  }
});
resetButton.addEventListener('click', () => runner.reset());
speedInput.addEventListener('input', () => {
  runner.setSpeed(Number(speedInput.value));
  speedValue.textContent = `${speedInput.value} ms`;
});
limitInput.addEventListener('change', () => {
  const value = Math.max(STEP_LIMIT_MIN, Math.floor(Number(limitInput.value)) || STEP_LIMIT_MIN);
  limitInput.value = String(value);
  runner.setStepLimit(value);
});
loadInputButton.addEventListener('click', loadInput);
inputField.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loadInput();
  }
});
exampleSelect.addEventListener('change', () => {
  loadExampleFile(exampleSelect.value);
});
applyJsonButton.addEventListener('click', () => {
  const { definition: parsed, errors } = parseDefinitionText(jsonText.value);
  if (errors) {
    showValidation(errors, []);
    return;
  }
  const { definition: normalized, errors: validationErrors, warnings } = validateAndNormalize(
    engine,
    parsed,
  );
  showValidation(validationErrors, warnings);
  if (validationErrors.length > 0) {
    return;
  }
  definition = normalized;
  loadMachine(parsed, pickInputForMachine());
});
copyJsonButton.addEventListener('click', async () => {
  jsonMessage.textContent = '';
  try {
    await navigator.clipboard.writeText(JSON.stringify(withCurrentPositions(definition), null, 2));
    jsonMessage.textContent = 'JSON copiado.';
  } catch (err) {
    jsonMessage.textContent = 'Não foi possível copiar. Selecione o texto manualmente.';
  }
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable) {
    return;
  }
  if (target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) {
    return;
  }
  if (event.key === 'ArrowRight' || event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    runner.step();
  } else if (event.key === ' ') {
    event.preventDefault();
    if (runner.getState().status === 'running') {
      runner.pause();
    } else {
      runner.play();
    }
  } else if (event.key === 'r' || event.key === 'R') {
    runner.reset();
  }
});

/**
 * Initialize the page: controls, manifest, first example and runner.
 */
async function init() {
  speedInput.min = String(SPEED_MIN);
  speedInput.max = String(SPEED_MAX);
  speedInput.value = String(DEFAULT_SPEED);
  speedValue.textContent = `${DEFAULT_SPEED} ms`;
  limitInput.min = String(STEP_LIMIT_MIN);
  limitInput.value = String(DEFAULT_STEP_LIMIT);
  const { data, errors } = await loadManifest();
  const entries = data ? data['two-stack'] : null;
  if (errors || !entries || !Array.isArray(entries) || entries.length === 0) {
    showValidation(errors ?? ['Nenhum exemplo de Máquina de Duas Pilhas encontrado.'], []);
    loadMachine(
      {
        type: 'two-stack',
        name: 'Máquina vazia',
        description: 'Cole uma definição no painel JSON.',
        inputAlphabet: [],
        stackAlphabet: ['Z'],
        bottom: 'Z',
        states: [{ id: 'q0', x: 80, y: 170 }],
        initial: 'q0',
        finals: ['q0'],
        transitions: [],
        suggestedInputs: [],
        tests: [],
      },
      '',
    );
    return;
  }
  clear(exampleSelect);
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry.file;
    option.textContent = entry.name;
    exampleSelect.append(option);
  }
  const { data: first, errors: firstErrors } = await loadExample(entries[0].file);
  if (firstErrors) {
    showValidation(firstErrors, []);
    return;
  }
  inputField.value = (first.suggestedInputs ?? [])[0] ?? '';
  loadMachine(first, inputField.value);
}

init();
