/**
 * Pure Turing Machine engine.
 * No DOM, window, timers or fetch. Configurations are immutable.
 */

/**
 * Check if a value is a single Unicode character.
 * @param {unknown} value value to check
 * @returns {boolean} true when value is a one-character string
 */
function isSingleChar(value) {
  return typeof value === 'string' && Array.from(value).length === 1;
}

/**
 * Normalize empty notation ("ε" and legacy "λ" become "") in a transition field.
 * @param {unknown} value raw field value
 * @returns {string} normalized string ("ε", "λ", null and undefined become "")
 */
function normSymbol(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (value === 'ε' || value === 'λ') {
    return '';
  }
  return value;
}

/**
 * Normalize a machine definition, filling defaults. Returns a new definition.
 * @param {object} definition raw machine definition
 * @returns {object} normalized definition copy
 */
export function normalize(definition) {
  const def = { ...definition };
  def.type = def.type ?? 'turing';
  def.inputAlphabet = Array.isArray(def.inputAlphabet) ? [...def.inputAlphabet] : [];
  def.tapeAlphabet = Array.isArray(def.tapeAlphabet) ? [...def.tapeAlphabet] : [];
  def.blank = def.blank ?? '□';
  if (def.blank === 'λ' || def.blank === 'ε' || def.blank === '') {
    def.blank = '□';
  }
  def.tapeMode = def.tapeMode ?? 'infinite';
  if (def.startMarker === undefined) {
    def.startMarker = null;
  }
  if (def.startMarker === 'λ' || def.startMarker === 'ε' || def.startMarker === '') {
    def.startMarker = null;
  }
  def.states = Array.isArray(def.states)
    ? def.states.map((s) => ({ ...s }))
    : [];
  def.initial = def.initial ?? null;
  def.finals = Array.isArray(def.finals) ? [...def.finals] : [];
  def.transitions = Array.isArray(def.transitions)
    ? def.transitions.map((t) => ({
      from: t.from ?? '',
      to: t.to ?? '',
      read: normSymbol(t.read),
      write: normSymbol(t.write),
      move: t.move ?? '',
    }))
    : [];
  def.suggestedInputs = Array.isArray(def.suggestedInputs) ? [...def.suggestedInputs] : [];
  def.tests = Array.isArray(def.tests) ? def.tests.map((t) => ({ ...t })) : [];
  return def;
}

/**
 * Validate a Turing Machine definition.
 * @param {object} definition machine definition (raw or normalized)
 * @returns {{errors: string[], warnings: string[]}} errors block loading, warnings do not
 */
export function validate(definition) {
  const errors = [];
  const warnings = [];
  const def = normalize(definition);

  if (def.type !== 'turing') {
    errors.push(`Tipo de máquina inválido: esperado "turing", encontrado "${definition.type}".`);
  }
  if (!Array.isArray(definition.states) || definition.states.length === 0) {
    errors.push('A máquina precisa ter pelo menos um estado.');
  }

  const ids = new Map();
  for (const s of def.states) {
    if (!s.id || typeof s.id !== 'string') {
      errors.push('Todo estado precisa ter um id.');
      continue;
    }
    if (ids.has(s.id)) {
      errors.push(`Estado duplicado: "${s.id}".`);
    } else {
      ids.set(s.id, s);
    }
  }

  if (def.initial === null || !ids.has(def.initial)) {
    errors.push(`Estado inicial "${definition.initial}" não está na lista de estados.`);
  }
  for (const f of def.finals) {
    if (!ids.has(f)) {
      errors.push(`Estado final "${f}" não está na lista de estados.`);
    }
  }

  if (!isSingleChar(def.blank)) {
    errors.push('Símbolo de branco inválido: precisa ter um único caractere.');
  }
  if (def.startMarker !== null && !isSingleChar(def.startMarker)) {
    errors.push('Marcador de início inválido: precisa ter um único caractere ou null.');
  }
  if (def.tapeMode !== 'infinite' && def.tapeMode !== 'semi-infinite') {
    errors.push('Modo de fita inválido: use "infinite" ou "semi-infinite".');
  }

  for (const sym of def.inputAlphabet) {
    if (!isSingleChar(sym)) {
      errors.push(`Símbolo inválido no alfabeto de entrada: "${sym}" precisa ter um único caractere.`);
    }
  }
  for (const sym of def.tapeAlphabet) {
    if (!isSingleChar(sym)) {
      errors.push(`Símbolo inválido no alfabeto da fita: "${sym}" precisa ter um único caractere.`);
    }
  }
  if (def.inputAlphabet.includes(def.blank)) {
    errors.push(`O símbolo de branco "${def.blank}" não pode estar no alfabeto de entrada.`);
  }
  if (def.startMarker !== null && def.inputAlphabet.includes(def.startMarker)) {
    errors.push(`O marcador de início "${def.startMarker}" não pode estar no alfabeto de entrada.`);
  }

  const tapeSet = new Set(def.tapeAlphabet);
  const seen = new Map();
  def.transitions.forEach((t, i) => {
    if (!ids.has(t.from)) {
      errors.push(`Transição ${i} referencia estado desconhecido "${t.from}".`);
    }
    if (!ids.has(t.to)) {
      errors.push(`Transição ${i} referencia estado desconhecido "${t.to}".`);
    }
    if (t.read !== '' && !isSingleChar(t.read)) {
      errors.push(`Símbolo de leitura inválido na transição ${i}: precisa ter um único caractere.`);
    } else if (t.read !== '' && !tapeSet.has(t.read)) {
      errors.push(`Símbolo "${t.read}" da transição ${i} não está no alfabeto da fita.`);
    }
    if (t.write !== '' && !isSingleChar(t.write)) {
      errors.push(`Símbolo de escrita inválido na transição ${i}: precisa ter um único caractere.`);
    } else if (t.write !== '' && !tapeSet.has(t.write)) {
      errors.push(`Símbolo "${t.write}" da transição ${i} não está no alfabeto da fita.`);
    }
    if (t.move !== 'L' && t.move !== 'R' && t.move !== 'S') {
      errors.push(`Movimento inválido "${t.move}" na transição ${i}: use L, R ou S.`);
    }
    const key = `${t.from}\u0000${t.read}`;
    if (seen.has(key)) {
      errors.push(`Transições duplicadas para (${t.from}, ${t.read === '' ? 'ε' : t.read}): transições ${seen.get(key)} e ${i}.`);
    } else {
      seen.set(key, i);
    }
  });

  // Warnings: unreachable states.
  if (ids.has(def.initial)) {
    const reachable = new Set([def.initial]);
    const queue = [def.initial];
    while (queue.length > 0) {
      const cur = queue.pop();
      for (const t of def.transitions) {
        if (t.from === cur && !reachable.has(t.to) && ids.has(t.to)) {
          reachable.add(t.to);
          queue.push(t.to);
        }
      }
    }
    for (const id of ids.keys()) {
      if (!reachable.has(id)) {
        warnings.push(`Estado "${id}" é inalcançável a partir do estado inicial.`);
      }
    }
  }
  // Warnings: states with no outgoing transitions that are not final.
  const finalsSet = new Set(def.finals);
  const withOutgoing = new Set(def.transitions.map((t) => t.from));
  for (const id of ids.keys()) {
    if (!withOutgoing.has(id) && !finalsSet.has(id)) {
      warnings.push(`Estado "${id}" não tem transições de saída e não é final.`);
    }
  }
  // Warnings: missing x/y.
  for (const s of def.states) {
    if (typeof s.x !== 'number' || typeof s.y !== 'number') {
      warnings.push(`Estado "${s.id}" sem posição x/y: o layout automático será usado.`);
    }
  }

  return { errors, warnings };
}

/**
 * Validate an input word against the input alphabet.
 * @param {object} definition machine definition
 * @param {string} input input word
 * @returns {{errors: string[]}} empty errors when valid
 */
export function validateInput(definition, input) {
  const def = normalize(definition);
  const allowed = new Set(def.inputAlphabet);
  const invalid = [];
  for (const ch of Array.from(input)) {
    if (!allowed.has(ch) && !invalid.includes(ch)) {
      invalid.push(ch);
    }
  }
  if (invalid.length === 0) {
    return { errors: [] };
  }
  const listed = invalid.map((s) => `"${s}"`).join(', ');
  return { errors: [`Símbolos inválidos na entrada: ${listed}. Use apenas símbolos do alfabeto de entrada.`] };
}

/**
 * Build the initial configuration for an input word.
 * @param {object} definition machine definition
 * @param {string} input input word
 * @returns {{state: string, tape: object, head: number, steps: number}} configuration with steps = 0
 */
export function initialConfig(definition, input) {
  const def = normalize(definition);
  const symbols = Array.from(input);
  const tape = {};
  let base = 0;
  if (def.tapeMode === 'semi-infinite' && def.startMarker !== null) {
    tape['0'] = def.startMarker;
    base = 1;
  }
  symbols.forEach((sym, i) => {
    if (sym !== def.blank) {
      tape[String(base + i)] = sym;
    }
  });
  return { state: def.initial, tape, head: 0, steps: 0 };
}

/**
 * Execute one deterministic step. Never mutates the given configuration.
 * @param {object} definition machine definition
 * @param {object} config current configuration {state, tape, head, steps}
 * @returns {{kind: "moved", config: object, transitionIndex: number, effects: object} | {kind: "halt", result: "accept" | "reject", reason: string, transitionIndex: number | null}} step result
 */
export function step(definition, config) {
  const def = normalize(definition);
  const finals = new Set(def.finals);
  if (finals.has(config.state)) {
    return {
      kind: 'halt',
      result: 'accept',
      reason: `Máquina parou no estado final ${config.state} após ${config.steps} passos.`,
      transitionIndex: null,
    };
  }
  const readSymbol = config.tape[String(config.head)] ?? def.blank;
  let foundIndex = -1;
  for (let i = 0; i < def.transitions.length; i += 1) {
    const t = def.transitions[i];
    if (t.from === config.state && t.read === readSymbol) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex === -1) {
    return {
      kind: 'halt',
      result: 'reject',
      reason: `Não há transição definida para (${config.state}, ${readSymbol})`,
      transitionIndex: null,
    };
  }
  const t = def.transitions[foundIndex];
  let headAfter = config.head;
  if (t.move === 'L') {
    headAfter = config.head - 1;
  } else if (t.move === 'R') {
    headAfter = config.head + 1;
  }
  if (def.tapeMode === 'semi-infinite' && headAfter < 0) {
    return {
      kind: 'halt',
      result: 'reject',
      reason: 'O cabeçote tentou sair da fita pela esquerda',
      transitionIndex: foundIndex,
    };
  }
  const nextTape = { ...config.tape };
  const written = t.write === '' ? def.blank : t.write;
  if (written === def.blank) {
    delete nextTape[String(config.head)];
  } else {
    nextTape[String(config.head)] = written;
  }
  const nextConfig = {
    state: t.to,
    tape: nextTape,
    head: headAfter,
    steps: config.steps + 1,
  };
  const effects = {
    readSymbol,
    written,
    from: config.state,
    to: t.to,
    move: t.move,
    headBefore: config.head,
    headAfter,
  };
  return { kind: 'moved', config: nextConfig, transitionIndex: foundIndex, effects };
}

/**
 * Compute the final tape content from the leftmost to the rightmost non-blank cell.
 * The start marker is excluded. Empty when all cells are blank.
 * @param {object} definition machine definition
 * @param {object} config configuration {tape, head}
 * @returns {string} tape content as a string
 */
export function tapeContent(definition, config) {
  const def = normalize(definition);
  const entries = Object.entries(config.tape).filter(([, sym]) => sym !== def.blank);
  const filtered = entries.filter(([key]) => !(
    def.tapeMode === 'semi-infinite' && def.startMarker !== null && Number(key) === 0
  ));
  if (filtered.length === 0) {
    return '';
  }
  const indices = filtered.map(([key]) => Number(key));
  const lo = Math.min(...indices);
  const hi = Math.max(...indices);
  let out = '';
  for (let i = lo; i <= hi; i += 1) {
    out += config.tape[String(i)] ?? def.blank;
  }
  return out;
}
