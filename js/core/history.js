import { clear, el } from './ui.js';

/**
 * Create the configuration history panel. Entries use monospace text,
 * the newest entry is at the bottom and highlighted, and the panel
 * auto-scrolls to the latest entry.
 * @param {HTMLElement} container scrollable panel element
 * @param {object} args panel arguments
 * @param {Function} args.edgeLabel label function for transitions
 * @returns {{render: Function}} panel with `render(state, definition)`
 */
export function createHistory(container, { edgeLabel }) {
  const list = el('ol', { cls: 'history-list' });
  container.replaceChildren(list);

  /**
   * Render the runner history. Entry 0 has no transition label.
   * @param {object} state runner state `{history, status, haltResult}`
   * @param {object} definition normalized machine definition
   */
  function render(state, definition) {
    clear(list);
    const last = state.history[state.history.length - 1];
    for (const entry of state.history) {
      const row = document.createElement('li');
      row.className = entry === last ? 'history-entry history-current' : 'history-entry';
      const stepNo = el('span', { cls: 'history-step', text: `Passo ${entry.step}` });
      const body = el('span', { cls: 'history-text', text: entry.text });
      row.append(stepNo, body);
      if (entry.transitionIndex !== null && entry.transitionIndex !== undefined) {
        const transition = definition.transitions[entry.transitionIndex];
        if (transition) {
          row.append(el('span', { cls: 'history-label', text: edgeLabel(transition) }));
        }
      }
      list.append(row);
    }
    if (state.status === 'halted') {
      const label =
        state.haltResult === 'accept' ? 'ACEITA' : state.haltResult === 'reject' ? 'REJEITA' : 'LIMITE';
      list.append(el('li', { cls: `history-entry history-result history-${state.haltResult}`, text: label }));
    }
    container.scrollTop = container.scrollHeight;
  }

  return { render };
}
