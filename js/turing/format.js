import { MOVE_LABELS } from '../config.js';

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
 * Build the JFLAP edge label for a transition: `a ; X , R`.
 * @param {object} t transition {read, write, move}
 * @returns {string} edge label
 */
export function edgeLabel(t) {
  const move = MOVE_LABELS[t.move] ?? t.move;
  return `${show(t.read)} ; ${show(t.write)} , ${move}`;
}

/**
 * Build the delta text: `δ(q0, a) = (q1, X, R)`.
 * @param {object} t transition {from, read, to, write, move}
 * @returns {string} delta text
 */
export function deltaText(t) {
  const move = MOVE_LABELS[t.move] ?? t.move;
  return `δ(${t.from}, ${show(t.read)}) = (${t.to}, ${show(t.write)}, ${move})`;
}

/**
 * Build one Portuguese sentence explaining a step.
 * @param {object} t transition {read, write, move, to}
 * @param {object} effects step effects {readSymbol, written, move}
 * @returns {string} explanation in Portuguese
 */
export function explain(t, effects) {
  const read = t.read ?? '';
  const write = effects && effects.written !== undefined ? effects.written : (t.write ?? '');
  const move = (effects && effects.move) || t.move;
  const parts = [];
  if (read === '') {
    parts.push('Não leu nada da entrada');
  } else {
    parts.push(`Leu "${read}"`);
  }
  parts.push(`escreveu "${write}"`);
  if (move === 'L') {
    parts.push('moveu o cabeçote para a esquerda');
  } else if (move === 'R') {
    parts.push('moveu o cabeçote para a direita');
  } else {
    parts.push('manteve o cabeçote parado');
  }
  parts.push(`e foi para ${t.to}.`);
  if (parts.length > 0) {
    return `${parts.slice(0, -1).join(', ')} ${parts[parts.length - 1]}`;
  }
  return `Foi para ${t.to}.`;
}

/**
 * Build the history line for a configuration: `q1 ⊢ X a [b] b`.
 * The head cell is in brackets; leading/trailing blanks are trimmed
 * but the head cell is always shown.
 * @param {object} definition machine definition (blank, tapeMode, startMarker)
 * @param {object} config configuration {state, tape, head}
 * @param {string} _input unused for Turing machines
 * @returns {string} configuration text
 */
export function configText(definition, config, _input) {
  const blank = definition.blank ?? '□';
  const keys = Object.keys(config.tape || {});
  let lo = config.head;
  let hi = config.head;
  for (const k of keys) {
    const n = Number(k);
    if (Number.isNaN(n)) {
      continue;
    }
    if (n < lo) {
      lo = n;
    }
    if (n > hi) {
      hi = n;
    }
  }
  if (definition.tapeMode === 'semi-infinite' && definition.startMarker != null) {
    if (0 < lo) {
      lo = 0;
    }
  }
  const cells = [];
  for (let i = lo; i <= hi; i += 1) {
    const sym = config.tape[String(i)] ?? blank;
    if (i === config.head) {
      cells.push(`[${sym}]`);
    } else {
      cells.push(sym);
    }
  }
  return `${config.state} ⊢ ${cells.join(' ')}`;
}
