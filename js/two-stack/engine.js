/**
 * Pure Two-Stack Machine engine.
 * No DOM, window, timers or fetch. Configurations are immutable.
 * Stacks are arrays with the bottom at index 0 and the top at the end.
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
 * Normalize an empty field ("ε" and legacy "λ" become "").
 * @param {unknown} value raw field value
 * @returns {string} normalized string
 */
function normField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (value === 'ε' || value === 'λ') {
    return '';
  }
  return value;
}

/**
 * Check if two transition values are compatible (equal or either is empty).
 * @param {string} a first value ("" means empty)
 * @param {string} b second value
 * @returns {boolean} true when compatible
 */
function compatible(a, b) {
  return a === b || a === '' || b === '';
}

/**
 * Normalize a machine definition, filling defaults. Returns a new definition.
 * @param {object} definition raw machine definition
 * @returns {object} normalized definition copy
 */
export function normalize(definition) {
  const def = { ...definition };
  def.type = def.type ?? 'two-stack';
  def.inputAlphabet = Array.isArray(def.inputAlphabet) ? [...def.inputAlphabet] : [];
  def.stackAlphabet = Array.isArray(def.stackAlphabet) ? [...def.stackAlphabet] : [];
  if (def.bottom === undefined) {
    def.bottom = 'Z';
  } else if (def.bottom === 'λ' || def.bottom === 'ε') {
    def.bottom = null;
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
      read: normField(t.read),
      pop1: normField(t.pop1),
      push1: normField(t.push1),
      pop2: normField(t.pop2),
      push2: normField(t.push2),
    }))
    : [];
  def.suggestedInputs = Array.isArray(def.suggestedInputs) ? [...def.suggestedInputs] : [];
  def.tests = Array.isArray(def.tests) ? def.tests.map((t) => ({ ...t })) : [];
  return def;
}

/**
 * Validate a Two-Stack Machine definition.
 * @param {object} definition machine definition (raw or normalized)
 * @returns {{errors: string[], warnings: string[]}} errors block loading, warnings do not
 */
export function validate(definition) {
  const errors = [];
  const warnings = [];
  const def = normalize(definition);

  if (def.type !== 'two-stack') {
    errors.push(`Tipo de máquina inválido: esperado "two-stack", encontrado "${definition.type}".`);
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

  for (const sym of def.inputAlphabet) {
    if (!isSingleChar(sym)) {
      errors.push(`Símbolo inválido no alfabeto de entrada: "${sym}" precisa ter um único caractere.`);
    }
  }
  for (const sym of def.stackAlphabet) {
    if (!isSingleChar(sym)) {
      errors.push(`Símbolo inválido no alfabeto da pilha: "${sym}" precisa ter um único caractere.`);
    }
  }
  if (def.bottom !== null && def.bottom !== '' && !isSingleChar(def.bottom)) {
    errors.push('Símbolo de fundo inválido: precisa ter um único caractere ou null.');
  }
  if (def.bottom !== null && def.bottom !== '' && !def.stackAlphabet.includes(def.bottom)) {
    errors.push(`Símbolo de fundo "${def.bottom}" não está no alfabeto da pilha.`);
  }

  const inputSet = new Set(def.inputAlphabet);
  const stackSet = new Set(def.stackAlphabet);
  def.transitions.forEach((t, i) => {
    if (!ids.has(t.from)) {
      errors.push(`Transição ${i} referencia estado desconhecido "${t.from}".`);
    }
    if (!ids.has(t.to)) {
      errors.push(`Transição ${i} referencia estado desconhecido "${t.to}".`);
    }
    if (t.read !== '' && !isSingleChar(t.read)) {
      errors.push(`Símbolo de leitura inválido na transição ${i}: precisa ter um único caractere.`);
    } else if (t.read !== '' && !inputSet.has(t.read)) {
      errors.push(`Símbolo "${t.read}" da transição ${i} não está no alfabeto de entrada.`);
    }
    for (const field of ['pop1', 'pop2']) {
      const v = t[field];
      if (v !== '' && !isSingleChar(v)) {
        errors.push(`Símbolo inválido em ${field} na transição ${i}: precisa ter um único caractere.`);
      } else if (v !== '' && !stackSet.has(v)) {
        errors.push(`Símbolo "${v}" da transição ${i} (${field}) não está no alfabeto da pilha.`);
      }
    }
    for (const field of ['push1', 'push2']) {
      const v = t[field] ?? '';
      if (typeof v !== 'string') {
        errors.push(`Campo ${field} inválido na transição ${i}: precisa ser uma string.`);
        continue;
      }
      for (const ch of Array.from(v)) {
        if (!stackSet.has(ch)) {
          errors.push(`Símbolo "${ch}" da transição ${i} (${field}) não está no alfabeto da pilha.`);
          break;
        }
      }
    }
  });

  // Determinism conflicts (§4.4).
  const byFrom = new Map();
  def.transitions.forEach((t, i) => {
    if (!byFrom.has(t.from)) {
      byFrom.set(t.from, []);
    }
    byFrom.get(t.from).push({ t, i });
  });
  for (const list of byFrom.values()) {
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const ta = list[a].t;
        const tb = list[b].t;
        if (compatible(ta.read, tb.read) && compatible(ta.pop1, tb.pop1) && compatible(ta.pop2, tb.pop2)) {
          errors.push(`Máquina não determinística: as transições ${list[a].i} e ${list[b].i} podem ser aplicadas ao mesmo tempo.`);
        }
      }
    }
  }

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
  const finalsSet = new Set(def.finals);
  const withOutgoing = new Set(def.transitions.map((t) => t.from));
  for (const id of ids.keys()) {
    if (!withOutgoing.has(id) && !finalsSet.has(id)) {
      warnings.push(`Estado "${id}" não tem transições de saída e não é final.`);
    }
  }
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
 * @returns {{state: string, inputPos: number, stack1: string[], stack2: string[], steps: number, input: string}} configuration with steps = 0
 */
export function initialConfig(definition, input) {
  const def = normalize(definition);
  const hasBottom = def.bottom !== null && def.bottom !== '';
  const stack1 = hasBottom ? [def.bottom] : [];
  const stack2 = hasBottom ? [def.bottom] : [];
  return {
    state: def.initial,
    inputPos: 0,
    stack1,
    stack2,
    steps: 0,
    input,
  };
}

/**
 * Get the symbols of an input word as an array of single characters.
 * @param {string} input input word
 * @returns {string[]} symbols
 */
function inputSymbols(input) {
  return Array.from(input ?? '');
}

/**
 * Check if a transition is applicable to a configuration.
 * @param {object} t transition
 * @param {string[]} symbols input symbols
 * @param {object} config configuration
 * @returns {boolean} true when applicable
 */
function isApplicable(t, symbols, config) {
  const readOk = t.read === '' || (config.inputPos < symbols.length && symbols[config.inputPos] === t.read);
  const pop1Ok = t.pop1 === '' || (config.stack1.length > 0 && config.stack1[config.stack1.length - 1] === t.pop1);
  const pop2Ok = t.pop2 === '' || (config.stack2.length > 0 && config.stack2[config.stack2.length - 1] === t.pop2);
  return readOk && pop1Ok && pop2Ok;
}

/**
 * Execute one deterministic step. Never mutates the given configuration.
 * The input word is read from `config.input` unless a third argument is given.
 * @param {object} definition machine definition
 * @param {object} config current configuration {state, inputPos, stack1, stack2, steps, input?}
 * @param {string} [inputOverride] optional input word, overrides config.input
 * @returns {{kind: "moved", config: object, transitionIndex: number, effects: object} | {kind: "halt", result: "accept" | "reject", reason: string, transitionIndex: number | null}} step result
 */
export function step(definition, config, inputOverride) {
  const def = normalize(definition);
  const input = inputOverride !== undefined ? inputOverride : (config.input ?? '');
  const symbols = inputSymbols(input);
  const finals = new Set(def.finals);
  const consumedAll = config.inputPos >= symbols.length;
  if (finals.has(config.state) && consumedAll) {
    return {
      kind: 'halt',
      result: 'accept',
      reason: `Máquina parou no estado final ${config.state} após ${config.steps} passos.`,
      transitionIndex: null,
    };
  }
  let foundIndex = -1;
  for (let i = 0; i < def.transitions.length; i += 1) {
    const t = def.transitions[i];
    if (t.from !== config.state) {
      continue;
    }
    if (isApplicable(t, symbols, config)) {
      foundIndex = i;
      break;
    }
  }
  if (foundIndex === -1) {
    if (finals.has(config.state) && !consumedAll) {
      return {
        kind: 'halt',
        result: 'reject',
        reason: 'Estado final atingido, mas a entrada não foi totalmente lida',
        transitionIndex: null,
      };
    }
    const nextSym = config.inputPos < symbols.length ? symbols[config.inputPos] : 'ε';
    const top1 = config.stack1.length > 0 ? config.stack1[config.stack1.length - 1] : 'vazia';
    const top2 = config.stack2.length > 0 ? config.stack2[config.stack2.length - 1] : 'vazia';
    return {
      kind: 'halt',
      result: 'reject',
      reason: `Não há transição aplicável no estado ${config.state} (entrada: ${nextSym}, topo P1: ${top1}, topo P2: ${top2})`,
      transitionIndex: null,
    };
  }
  const t = def.transitions[foundIndex];
  const consumed = t.read === '' ? '' : t.read;
  const popped1 = t.pop1 === '' ? '' : t.pop1;
  const popped2 = t.pop2 === '' ? '' : t.pop2;
  const pushed1 = t.push1 ?? '';
  const pushed2 = t.push2 ?? '';
  const nextStack1 = [...config.stack1];
  if (popped1 !== '') {
    nextStack1.pop();
  }
  // Leftmost symbol ends on top: push rightmost first.
  const push1Syms = Array.from(pushed1);
  for (let i = push1Syms.length - 1; i >= 0; i -= 1) {
    nextStack1.push(push1Syms[i]);
  }
  const nextStack2 = [...config.stack2];
  if (popped2 !== '') {
    nextStack2.pop();
  }
  const push2Syms = Array.from(pushed2);
  for (let i = push2Syms.length - 1; i >= 0; i -= 1) {
    nextStack2.push(push2Syms[i]);
  }
  const nextConfig = {
    state: t.to,
    inputPos: t.read === '' ? config.inputPos : config.inputPos + 1,
    stack1: nextStack1,
    stack2: nextStack2,
    steps: config.steps + 1,
    input,
  };
  const effects = { consumed, popped1, pushed1, popped2, pushed2 };
  return { kind: 'moved', config: nextConfig, transitionIndex: foundIndex, effects };
}
