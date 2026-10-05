import { tapeContent } from './engine.js';
import { clear, el, inputDisplayText } from '../core/ui.js';

/**
 * Number of blank cells shown as padding on each side of the visited area.
 */
const PADDING = 3;

/**
 * Create the Turing Machine memory view: input display, tape with head
 * marker and final content line. The head marker node persists across
 * renders so it slides with a CSS transition.
 * @param {HTMLElement} container view container
 * @param {object} definition normalized Turing definition
 * @returns {{render: Function}} view with `render(state, input)`
 */
export function createView(container, definition) {
  const inputLine = el('p', { cls: 'input-display' });
  const scroll = el('div', { cls: 'tape-scroll', attrs: { tabindex: '0', role: 'group', 'aria-label': 'Fita da máquina de Turing' } });
  const content = el('div', { cls: 'tape-content' });
  const marker = el('div', { cls: 'head-marker', attrs: { 'aria-hidden': 'true' } });
  const arrow = el('div', { cls: 'head-arrow' });
  const markerLabel = el('span', { cls: 'head-state' });
  marker.append(arrow, markerLabel);
  const row = el('div', { cls: 'tape-row' });
  content.append(marker, row);
  scroll.append(content);
  const finalLine = el('p', { cls: 'tape-final' });
  finalLine.hidden = true;
  container.replaceChildren(inputLine, scroll, finalLine);
  let markerPlaced = false;

  /**
   * Find the tape range: leftmost to rightmost visited or non-blank
   * cell, plus padding (never left of cell 0 in semi-infinite mode).
   * @param {object} state runner state
   * @returns {{lo: number, hi: number}} cell range
   */
  function tapeRange(state) {
    let lo = state.config.head;
    let hi = state.config.head;
    for (const entry of state.history) {
      if (entry.config.head < lo) {
        lo = entry.config.head;
      }
      if (entry.config.head > hi) {
        hi = entry.config.head;
      }
    }
    for (const key of Object.keys(state.config.tape)) {
      const n = Number(key);
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
    lo -= PADDING;
    hi += PADDING;
    if (definition.tapeMode === 'semi-infinite') {
      lo = Math.max(lo, 0);
    }
    return { lo, hi };
  }

  /**
   * Render the view from the runner state only.
   * @param {object} state runner state
   * @param {string} input current input word
   */
  function render(state, input) {
    const blank = definition.blank ?? '□';
    inputLine.textContent = inputDisplayText(input);
    const { lo, hi } = tapeRange(state);
    clear(row);
    if (definition.tapeMode === 'semi-infinite') {
      row.append(el('div', { cls: 'tape-wall', attrs: { 'aria-hidden': 'true' } }));
    }
    const lastEntry = state.history[state.history.length - 1];
    const writtenCell =
      lastEntry.transitionIndex !== null &&
      lastEntry.transitionIndex !== undefined &&
      lastEntry.effects
        ? lastEntry.effects.headBefore
        : null;
    const cells = new Map();
    for (let i = lo; i <= hi; i += 1) {
      const cell = el('div', { cls: 'tape-cell' });
      cell.append(
        el('span', { cls: 'tape-symbol', text: state.config.tape[String(i)] ?? blank }),
        el('span', { cls: 'tape-index', text: String(i) }),
      );
      if (i === state.config.head) {
        cell.classList.add('head-cell');
      }
      if (i === writtenCell) {
        cell.classList.add('just-written');
      }
      cells.set(i, cell);
      row.append(cell);
    }
    const duration = Math.min(250, (state.speed ?? 600) * 0.6);
    row.style.setProperty('--flash-duration', `${duration}ms`);
    markerLabel.textContent = state.config.state;
    const headCell = cells.get(state.config.head);
    if (headCell) {
      const x = headCell.offsetLeft + headCell.offsetWidth / 2;
      if (!markerPlaced) {
        marker.style.transition = 'none';
      }
      marker.style.transform = `translateX(${x}px) translateX(-50%)`;
      if (!markerPlaced) {
        void marker.offsetWidth;
        marker.style.transition = '';
        markerPlaced = true;
      }
      marker.style.setProperty('transition-duration', `${duration}ms`);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroll.scrollTo({
        left: x - scroll.clientWidth / 2,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    }
    if (state.status === 'halted') {
      const contentText = tapeContent(definition, state.config);
      finalLine.textContent = `Conteúdo final da fita: ${contentText === '' ? 'ε' : contentText}`;
      finalLine.hidden = false;
    } else {
      finalLine.hidden = true;
    }
  }

  return { render };
}
