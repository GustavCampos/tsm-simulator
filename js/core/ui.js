/**
 * Small DOM helpers and the status banner shared by both simulators.
 * Only `textContent` and `createElement` are used, never `innerHTML`,
 * so user-provided machine data cannot inject markup.
 */

/**
 * Create an element with an optional class, text and attributes.
 * @param {string} tag tag name
 * @param {object} [options] element options
 * @param {string} [options.cls] class name
 * @param {string} [options.text] text content
 * @param {object} [options.attrs] attributes set with setAttribute
 * @returns {HTMLElement} the new element
 */
export function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.cls) {
    node.className = options.cls;
  }
  if (options.text !== undefined) {
    node.textContent = options.text;
  }
  for (const [key, value] of Object.entries(options.attrs ?? {})) {
    node.setAttribute(key, value);
  }
  return node;
}

/**
 * Remove all children of a node.
 * @param {HTMLElement} node parent node
 */
export function clear(node) {
  node.replaceChildren();
}

/**
 * Text shown above the memory view for the current input word.
 * @param {string} input input word
 * @returns {string} `Entrada: ...` line, with ε for the empty word
 */
export function inputDisplayText(input) {
  if (input === '') {
    return 'Entrada: ε (palavra vazia)';
  }
  return `Entrada: ${input}`;
}

/**
 * Update the status banner from the runner state. The banner always
 * combines an icon with text, never color alone.
 * @param {HTMLElement} banner banner container with title/detail children
 * @param {object} state runner state `{status, haltResult, haltReason, config}`
 */
export function setBanner(banner, state) {
  const title = banner.querySelector('.banner-title');
  const detail = banner.querySelector('.banner-detail');
  banner.classList.remove('banner-neutral', 'banner-accept', 'banner-reject', 'banner-limit');
  let cls = 'banner-neutral';
  let titleText = '';
  let detailText = '';
  if (state.status === 'ready') {
    titleText = 'Pronta';
    detailText = 'Pronta. Clique em "Executar próximo passo" ou "Executar automaticamente".';
  } else if (state.status === 'running') {
    titleText = 'Executando…';
  } else if (state.status === 'paused') {
    titleText = `Pausada no passo ${state.config.steps}.`;
  } else if (state.haltResult === 'accept') {
    cls = 'banner-accept';
    titleText = '✔ ACEITA';
    detailText = state.haltReason;
  } else if (state.haltResult === 'reject') {
    cls = 'banner-reject';
    titleText = '✘ REJEITA';
    detailText = state.haltReason;
  } else {
    cls = 'banner-limit';
    titleText = '⚠ LIMITE DE PASSOS ATINGIDO';
    detailText = state.haltReason;
  }
  banner.classList.add(cls);
  title.textContent = titleText;
  detail.textContent = detailText;
  detail.hidden = detailText === '';
}

/**
 * Text of the step counter.
 * @param {number} steps current step count
 * @returns {string} `Passo: N`
 */
export function counterText(steps) {
  return `Passo: ${steps}`;
}

/**
 * Text of the status line below the banner.
 * @param {object} config current configuration `{state, steps}`
 * @returns {string} `Estado atual: q · Passo: N`
 */
export function statusLineText(config) {
  return `Estado atual: ${config.state} · Passo: ${config.steps}`;
}
