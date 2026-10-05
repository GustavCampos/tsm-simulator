/**
 * Import of JFLAP `.jff` Turing machines.
 * Pure string parsing (no DOM, window or FileReader), so it runs in Node
 * tests as well as in the browser. The page uses FileReader to read the
 * file text and calls `parseJff` with it.
 */

const BLANK = '□';
const MAX_WIDTH = 600;
const MAX_HEIGHT = 340;

/**
 * Extract the first occurrence of `<tag>...</tag>` inside text.
 * @param {string} text XML fragment to search
 * @param {string} tag tag name without brackets
 * @returns {string|null} inner text trimmed, or null when absent
 */
function tagContent(text, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = re.exec(text);
  if (!match) {
    return null;
  }
  return match[1].trim();
}

/**
 * Extract all occurrences of `<tag ...>...</tag>` blocks inside text.
 * @param {string} text XML fragment to search
 * @param {string} tag tag name without brackets
 * @returns {string[]} inner contents (without the outer tags)
 */
function tagBlocks(text, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  let match = re.exec(text);
  while (match) {
    out.push(match[1]);
    match = re.exec(text);
  }
  return out;
}

/**
 * Get the value of an attribute in an opening tag string.
 * @param {string} openingTag opening tag such as `<state id="0" name="q0">`
 * @param {string} name attribute name
 * @returns {string|null} attribute value or null
 */
function attrValue(openingTag, name) {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
  const match = re.exec(openingTag);
  return match ? match[1] : null;
}

/**
 * Map a JFLAP read/write cell to a project symbol.
 * Empty cells (or `λ`) mean the blank symbol.
 * @param {string|null} raw raw cell content or null when the tag is missing
 * @returns {string} single symbol (`□` for blank)
 */
function jffSymbol(raw) {
  if (raw === null || raw === undefined) {
    return BLANK;
  }
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'λ') {
    return BLANK;
  }
  return trimmed;
}

/**
 * Check that a text looks like XML with a single `<structure>` root.
 * This is a lightweight well-formedness check so malformed files get a
 * clear Portuguese message without needing DOMParser in Node.
 * @param {string} text raw file content
 * @returns {boolean} true when the text is too broken to parse
 */
function looksMalformed(text) {
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, '');
  const withoutDecl = withoutComments.replace(/<\?[\s\S]*?\?>/g, '').trim();
  if (!/^<structure[\s>]/i.test(withoutDecl)) {
    return true;
  }
  if (!/<\/structure\s*>\s*$/i.test(withoutDecl)) {
    return true;
  }
  const opens = withoutDecl.match(/<(structure|automaton|state|transition|block)\b[^>]*>/gi) ?? [];
  const closes = withoutDecl.match(/<\/(structure|automaton|state|transition|block)\s*>/gi) ?? [];
  const count = (list, name) => list.filter((t) => new RegExp(`^<\\/?${name}\\b`, 'i').test(t)).length;
  for (const name of ['structure', 'automaton', 'state', 'transition']) {
    if (count(opens, name) !== count(closes, name)) {
      return true;
    }
  }
  return false;
}

/**
 * Parse a JFLAP `.jff` file content into a Turing Machine definition.
 * @param {string} xmlText raw `.jff` file content
 * @returns {{definition?: object, errors: string[], warnings: string[]}} definition or blocking errors
 */
export function parseJff(xmlText) {
  if (typeof xmlText !== 'string' || xmlText.trim() === '') {
    return { errors: ['Arquivo .jff inválido: XML malformado.'], warnings: [] };
  }
  if (looksMalformed(xmlText)) {
    return { errors: ['Arquivo .jff inválido: XML malformado.'], warnings: [] };
  }

  const type = tagContent(xmlText, 'type');
  if (type === null) {
    return { errors: ['Arquivo .jff inválido: XML malformado.'], warnings: [] };
  }
  if (type.trim().toLowerCase() !== 'turing') {
    return {
      errors: [`Tipo de autômato "${type.trim()}" não suportado: importe apenas Máquinas de Turing.`],
      warnings: [],
    };
  }

  const tapesMatch = /<[^>]*\btapes\s*=\s*"([^"]*)"/i.exec(xmlText);
  if (tapesMatch && Number(tapesMatch[1]) > 1) {
    return {
      errors: ['Máquinas de Turing com várias fitas não são suportadas.'],
      warnings: [],
    };
  }
  if (/<block[\s>]/i.test(xmlText)) {
    return {
      errors: ['Blocos de construção (<block>) não são suportados.'],
      warnings: [],
    };
  }

  const automaton = tagContent(xmlText, 'automaton');
  if (automaton === null) {
    return { errors: ['Arquivo .jff inválido: XML malformado.'], warnings: [] };
  }

  const stateOpenings = [];
  const stateOpenRe = /<state\b[^>]*>/gi;
  let openMatch = stateOpenRe.exec(automaton);
  while (openMatch) {
    stateOpenings.push({ tag: openMatch[0], index: openMatch.index });
    openMatch = stateOpenRe.exec(automaton);
  }
  const stateCloses = [];
  const stateCloseRe = /<\/state\s*>/gi;
  let closeMatch = stateCloseRe.exec(automaton);
  while (closeMatch) {
    stateCloses.push(closeMatch.index);
    closeMatch = stateCloseRe.exec(automaton);
  }
  if (stateOpenings.length === 0) {
    return { errors: ['Arquivo .jff inválido: nenhum estado encontrado.'], warnings: [] };
  }
  if (stateOpenings.length !== stateCloses.length) {
    return { errors: ['Arquivo .jff inválido: XML malformado.'], warnings: [] };
  }

  const states = [];
  const idToName = new Map();
  const seenNames = new Set();
  for (const opening of stateOpenings) {
    const end = automaton.indexOf('</state>', opening.index);
    const inner = automaton.slice(opening.index + opening.tag.length, end);
    const rawId = attrValue(opening.tag, 'id');
    const rawName = attrValue(opening.tag, 'name');
    const name = rawName !== null && rawName.trim() !== '' ? rawName.trim() : `q${rawId ?? states.length}`;
    const xRaw = tagContent(inner, 'x');
    const yRaw = tagContent(inner, 'y');
    const x = xRaw === null || xRaw === '' ? 0 : Math.round(Number(xRaw));
    const y = yRaw === null || yRaw === '' ? 0 : Math.round(Number(yRaw));
    states.push({
      id: name,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      initial: /<initial\s*\/>/i.test(inner) || /<initial\s*>[\s\S]*?<\/initial\s*>/i.test(inner),
      final: /<final\s*\/>/i.test(inner) || /<final\s*>[\s\S]*?<\/final\s*>/i.test(inner),
    });
    if (rawId !== null) {
      idToName.set(rawId.trim(), name);
    }
    if (seenNames.has(name)) {
      return { errors: [`Arquivo .jff inválido: estado duplicado "${name}".`], warnings: [] };
    }
    seenNames.add(name);
  }

  const initials = states.filter((s) => s.initial);
  if (initials.length === 0) {
    return { errors: ['Arquivo .jff inválido: nenhum estado inicial encontrado.'], warnings: [] };
  }
  const initial = initials[0].id;
  const finals = states.filter((s) => s.final).map((s) => s.id);

  const transitionBlocks = tagBlocks(automaton, 'transition');
  const transitions = [];
  for (let i = 0; i < transitionBlocks.length; i += 1) {
    const block = transitionBlocks[i];
    const fromRaw = tagContent(block, 'from');
    const toRaw = tagContent(block, 'to');
    if (fromRaw === null || toRaw === null) {
      return { errors: ['Arquivo .jff inválido: XML malformado.'], warnings: [] };
    }
    const from = idToName.get(fromRaw.trim()) ?? `q${fromRaw.trim()}`;
    const to = idToName.get(toRaw.trim()) ?? `q${toRaw.trim()}`;
    if (!seenNames.has(from) || !seenNames.has(to)) {
      return {
        errors: [`Arquivo .jff inválido: transição ${i} referencia estado desconhecido.`],
        warnings: [],
      };
    }
    const read = jffSymbol(tagContent(block, 'read'));
    const write = jffSymbol(tagContent(block, 'write'));
    const moveRaw = tagContent(block, 'move');
    const move = (moveRaw ?? '').trim().toUpperCase();
    if (move !== 'L' && move !== 'R' && move !== 'S') {
      return {
        errors: [`Arquivo .jff inválido: movimento "${moveRaw ?? ''}" inválido na transição ${i}: use R, L ou S.`],
        warnings: [],
      };
    }
    transitions.push({ from, read, to, write, move });
  }

  const scaled = states.map((s) => ({ id: s.id, x: s.x, y: s.y }));
  const maxX = Math.max(...scaled.map((s) => s.x));
  const maxY = Math.max(...scaled.map((s) => s.y));
  if (maxX > MAX_WIDTH || maxY > MAX_HEIGHT) {
    const factor = Math.min(MAX_WIDTH / Math.max(maxX, 1), MAX_HEIGHT / Math.max(maxY, 1));
    for (const s of scaled) {
      s.x = Math.round(s.x * factor);
      s.y = Math.round(s.y * factor);
    }
  }

  const tapeSet = new Set([BLANK]);
  for (const t of transitions) {
    tapeSet.add(t.read);
    tapeSet.add(t.write);
  }
  const inputSet = new Set();
  for (const t of transitions) {
    if (t.from === initial && t.read !== BLANK) {
      inputSet.add(t.read);
    }
  }

  const definition = {
    type: 'turing',
    name: 'Máquina importada do JFLAP',
    description: 'Importada de arquivo .jff.',
    inputAlphabet: [...inputSet],
    tapeAlphabet: [...tapeSet],
    blank: BLANK,
    tapeMode: 'infinite',
    startMarker: null,
    states: scaled,
    initial,
    finals,
    transitions,
    suggestedInputs: [],
    tests: [],
  };

  return {
    definition,
    errors: [],
    warnings: ['Alfabeto de entrada inferido a partir das transições do estado inicial; confira no painel JSON.'],
  };
}
