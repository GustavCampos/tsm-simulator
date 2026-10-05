/**
 * Formatters for the Two-Stack Machine: edge labels, delta text,
 * step explanations and history lines.
 */

/**
 * Show a symbol, displaying empty as ε.
 * @param {string} symbol single symbol or "" for empty
 * @returns {string} display string
 */
function show(symbol) {
  if (symbol === '' || symbol === null || symbol === undefined) {
    return 'ε';
  }
  return symbol;
}

/**
 * Build the JFLAP edge label: `a , ε ; A | ε ; ε`.
 * @param {object} t transition {read, pop1, push1, pop2, push2}
 * @returns {string} edge label
 */
export function edgeLabel(t) {
  return `${show(t.read)} , ${show(t.pop1)} ; ${show(t.push1)} | ${show(t.pop2)} ; ${show(t.push2)}`;
}

/**
 * Build the delta text: `δ(q0, a, ε, ε) = (qa, A, ε)`.
 * @param {object} t transition {from, read, pop1, pop2, to, push1, push2}
 * @returns {string} delta text
 */
export function deltaText(t) {
  return `δ(${t.from}, ${show(t.read)}, ${show(t.pop1)}, ${show(t.pop2)}) = (${t.to}, ${show(t.push1)}, ${show(t.push2)})`;
}

/**
 * Build one Portuguese sentence explaining a step.
 * @param {object} t transition {read, pop1, push1, pop2, push2, to}
 * @param {object} effects step effects {consumed, popped1, pushed1, popped2, pushed2}
 * @returns {string} explanation in Portuguese
 */
export function explain(t, effects) {
  const e = effects ?? {};
  const read = e.consumed !== undefined ? e.consumed : (t.read ?? '');
  const popped1 = e.popped1 !== undefined ? e.popped1 : (t.pop1 ?? '');
  const pushed1 = e.pushed1 !== undefined ? e.pushed1 : (t.push1 ?? '');
  const popped2 = e.popped2 !== undefined ? e.popped2 : (t.pop2 ?? '');
  const pushed2 = e.pushed2 !== undefined ? e.pushed2 : (t.push2 ?? '');
  const parts = [];
  if (read === '') {
    parts.push('Não leu nada da entrada');
  } else {
    parts.push(`Leu "${read}"`);
  }
  if (popped1 !== '') {
    parts.push(`desempilhou "${popped1}" de P1`);
  }
  if (pushed1 !== '') {
    parts.push(`empilhou "${pushed1}" em P1`);
  }
  if (popped2 !== '') {
    parts.push(`desempilhou "${popped2}" de P2`);
  }
  if (pushed2 !== '') {
    parts.push(`empilhou "${pushed2}" em P2`);
  }
  parts.push(`e foi para ${t.to}.`);
  if (parts.length === 2 && parts[0] === 'Não leu nada da entrada') {
    return `Não leu nada da entrada ${parts[1]}`;
  }
  const head = parts.slice(0, -1);
  const tail = parts[parts.length - 1];
  if (head.length === 0) {
    return `Não fez nenhuma alteração ${tail}`;
  }
  // Lowercase the first clause after "Leu/Não" handling: keep as is, join with commas.
  const first = head[0];
  const rest = head.slice(1);
  if (rest.length === 0) {
    return `${first} ${tail}`;
  }
  // Lowercase continuation clauses that start with a verb is already lowercase.
  return `${first}, ${rest.join(', ')} ${tail}`;
}

/**
 * Build the history line: `qb | restante: bcc | P1: Z A | P2: Z B`.
 * @param {object} _definition unused
 * @param {object} config configuration {state, inputPos, stack1, stack2}
 * @param {string} input full input word
 * @returns {string} configuration text
 */
export function configText(_definition, config, input) {
  const symbols = Array.from(input ?? config.input ?? '');
  const rest = symbols.slice(config.inputPos).join('');
  const restLabel = rest === '' ? 'ε' : rest;
  const s1 = config.stack1.length === 0 ? 'vazia' : config.stack1.join(' ');
  const s2 = config.stack2.length === 0 ? 'vazia' : config.stack2.join(' ');
  return `${config.state} | restante: ${restLabel} | P1: ${s1} | P2: ${s2}`;
}
