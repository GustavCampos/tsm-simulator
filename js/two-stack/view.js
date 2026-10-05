import { clear, el, inputDisplayText } from '../core/ui.js';

/**
 * Text shown below a stack for its last operation.
 * @param {string} popped symbol popped ("" for none)
 * @param {string} pushed string pushed ("" for none)
 * @returns {string} Portuguese operation text
 */
function stackOpText(popped, pushed) {
  const hasPop = popped !== '' && popped !== null && popped !== undefined;
  const hasPush = pushed !== '' && pushed !== null && pushed !== undefined;
  if (hasPop && hasPush) {
    return `Desempilhou "${popped}", empilhou "${pushed}"`;
  }
  if (hasPush) {
    return `Empilhou "${pushed}"`;
  }
  if (hasPop) {
    return `Desempilhou "${popped}"`;
  }
  return 'Sem alteração';
}

/**
 * Check if animations should run.
 * @returns {boolean} true when motion is allowed
 */
function motionAllowed() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Create the Two-Stack Machine memory view: input tape with consumed
 * highlight and read pointer, plus two animated stacks (bottom at the
 * bottom, top highlighted with a `topo` label).
 * @param {HTMLElement} container view container
 * @param {object} _definition normalized two-stack definition (unused, kept for interface parity)
 * @returns {{render: Function}} view with `render(state, input)`
 */
export function createView(container, _definition) {
  const inputLine = el('p', { cls: 'input-display' });
  const tapeBox = el('div', {
    cls: 'input-tape-box',
    attrs: { tabindex: '0', role: 'group', 'aria-label': 'Fita de entrada' },
  });
  const tapeRow = el('div', { cls: 'input-tape' });
  const tapeStatus = el('p', { cls: 'input-status' });
  tapeBox.append(tapeRow, tapeStatus);

  const stacksBox = el('div', { cls: 'stacks' });

  /**
   * Build one stack column.
   * @param {string} title column title (`Pilha 1 (P1)`)
   * @param {string} label short label for aria
   * @returns {{column: HTMLElement, stack: HTMLElement, op: HTMLElement}} nodes
   */
  function buildColumn(title, label) {
    const column = el('div', { cls: 'stack-column' });
    column.append(el('h3', { cls: 'stack-title', text: title }));
    const stack = el('div', {
      cls: 'stack',
      attrs: { role: 'group', 'aria-label': title },
    });
    stack.dataset.stack = label;
    const op = el('p', { cls: 'stack-op' });
    op.textContent = 'Sem alteração';
    column.append(stack, op);
    return { column, stack, op };
  }

  const col1 = buildColumn('Pilha 1 (P1)', 'P1');
  const col2 = buildColumn('Pilha 2 (P2)', 'P2');
  stacksBox.append(col1.column, col2.column);
  container.replaceChildren(inputLine, tapeBox, stacksBox);

  /**
   * Render one stack (bottom at index 0, top rendered first).
   * @param {HTMLElement} stackNode stack container
   * @param {string[]} values stack values bottom → top
   * @param {object} anim animation info `{entering: number, exiting: string|null, duration: number}`
   */
  function renderStack(stackNode, values, anim) {
    clear(stackNode);
    if (values.length === 0) {
      stackNode.append(el('div', { cls: 'stack-empty', text: 'vazia' }));
      return;
    }
    if (anim.exiting !== null && anim.exiting !== undefined && anim.exiting !== '') {
      const ghost = el('div', { cls: 'stack-cell stack-exit', text: anim.exiting });
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.setProperty('--stack-duration', `${anim.duration}ms`);
      stackNode.append(ghost);
      window.setTimeout(() => {
        ghost.remove();
      }, anim.duration + 50);
    }
    for (let i = values.length - 1; i >= 0; i -= 1) {
      const isTop = i === values.length - 1;
      const fromTop = values.length - 1 - i;
      const cell = el('div', { cls: isTop ? 'stack-cell stack-top' : 'stack-cell' });
      cell.append(el('span', { cls: 'stack-symbol', text: values[i] }));
      if (isTop) {
        cell.append(el('span', { cls: 'topo-label', text: 'topo' }));
      }
      if (fromTop < anim.entering) {
        cell.classList.add('stack-enter');
        cell.style.setProperty('--stack-duration', `${anim.duration}ms`);
        if (anim.enterDelay > 0) {
          cell.style.setProperty('animation-delay', `${anim.enterDelay}ms`);
        }
      }
      stackNode.append(cell);
    }
  }

  /**
   * Render the view from the runner state only.
   * @param {object} state runner state `{config, lastEffects, speed}`
   * @param {string} input current input word
   */
  function render(state, input) {
    const symbols = Array.from(input ?? '');
    const pos = state.config.inputPos ?? 0;
    inputLine.textContent = inputDisplayText(input);
    clear(tapeRow);
    if (symbols.length === 0) {
      tapeRow.append(el('div', { cls: 'input-cell input-empty', text: 'ε' }));
    } else {
      symbols.forEach((symbol, index) => {
        const cell = el('div', {
          cls:
            index < pos ? 'input-cell consumed' : index === pos ? 'input-cell next' : 'input-cell',
        });
        cell.append(el('span', { cls: 'input-symbol', text: symbol }));
        if (index === pos) {
          const pointer = el('span', { cls: 'input-pointer', text: '▼' });
          pointer.setAttribute('aria-hidden', 'true');
          cell.append(pointer);
          cell.setAttribute('aria-current', 'true');
        }
        if (index < pos) {
          cell.setAttribute('aria-label', `${symbol} (lida)`);
        }
        tapeRow.append(cell);
      });
    }
    if (pos >= symbols.length) {
      tapeStatus.textContent = 'Entrada totalmente lida';
    } else if (symbols.length === 0) {
      tapeStatus.textContent = 'Entrada totalmente lida';
    } else {
      tapeStatus.textContent = `Próxima a ler: "${symbols[pos]}" (posição ${pos})`;
    }

    const effects = state.lastEffects ?? null;
    const duration = Math.min(250, (state.speed ?? 600) * 0.6);
    const animate = motionAllowed() && effects !== null && duration > 0;
    const pushed1 = effects && effects.pushed1 ? String(effects.pushed1) : '';
    const popped1 = effects && effects.popped1 ? String(effects.popped1) : '';
    const pushed2 = effects && effects.pushed2 ? String(effects.pushed2) : '';
    const popped2 = effects && effects.popped2 ? String(effects.popped2) : '';
    const entering1 = animate ? Array.from(pushed1).length : 0;
    const entering2 = animate ? Array.from(pushed2).length : 0;
    const exiting1 = animate ? popped1 : '';
    const exiting2 = animate ? popped2 : '';
    renderStack(col1.stack, state.config.stack1 ?? [], {
      entering: entering1,
      exiting: exiting1,
      duration,
      enterDelay: exiting1 !== '' && entering1 > 0 ? duration : 0,
    });
    renderStack(col2.stack, state.config.stack2 ?? [], {
      entering: entering2,
      exiting: exiting2,
      duration,
      enterDelay: exiting2 !== '' && entering2 > 0 ? duration : 0,
    });
    if (effects === null) {
      col1.op.textContent = 'Sem alteração';
      col2.op.textContent = 'Sem alteração';
    } else {
      col1.op.textContent = stackOpText(popped1, pushed1);
      col2.op.textContent = stackOpText(popped2, pushed2);
    }
  }

  return { render };
}
