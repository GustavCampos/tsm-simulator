import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  validate,
  validateInput,
  initialConfig,
  step,
} from '../js/two-stack/engine.js';
import { edgeLabel, deltaText, explain, configText } from '../js/two-stack/format.js';

function baseDef(overrides = {}) {
  return normalize({
    type: 'two-stack',
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['A', 'Z'],
    bottom: 'Z',
    states: [{ id: 'q0', x: 0, y: 0 }, { id: 'q1', x: 10, y: 10 }],
    initial: 'q0',
    finals: ['q1'],
    transitions: [{ from: 'q0', to: 'q1', read: 'a', pop1: '', push1: 'A', pop2: '', push2: '' }],
    ...overrides,
  });
}

describe('two-stack normalize', () => {
  it('converts λ to empty string and defaults bottom to Z', () => {
    const def = normalize({
      type: 'two-stack',
      states: [{ id: 'q0' }],
      initial: 'q0',
      finals: [],
      transitions: [{ from: 'q0', to: 'q0', read: 'λ', pop1: 'λ', push1: 'λ', pop2: 'λ', push2: 'λ' }],
    });
    assert.equal(def.transitions[0].read, '');
    assert.equal(def.bottom, 'Z');
  });
});

describe('two-stack validate', () => {
  it('accepts a valid definition', () => {
    assert.deepEqual(validate(baseDef()).errors, []);
  });

  it('detects determinism conflicts', () => {
    const def = baseDef({
      transitions: [
        { from: 'q0', to: 'q1', read: 'a', pop1: '', push1: '', pop2: '', push2: '' },
        { from: 'q0', to: 'q1', read: '', pop1: '', push1: '', pop2: '', push2: '' },
      ],
    });
    const { errors } = validate(def);
    assert.ok(errors.some((e) => e.includes('não determinística')));
    assert.ok(errors[0].includes('0 e 1'));
  });

  it('does not flag distinct reads as conflict', () => {
    assert.deepEqual(validate(baseDef()).errors, []);
  });

  it('rejects symbols outside the alphabets', () => {
    const bad = baseDef({
      transitions: [{ from: 'q0', to: 'q1', read: 'z', pop1: '', push1: '', pop2: '', push2: '' }],
    });
    assert.ok(validate(bad).errors.some((e) => e.includes('alfabeto de entrada')));
    const badStack = baseDef({
      transitions: [{ from: 'q0', to: 'q1', read: 'a', pop1: 'Q', push1: '', pop2: '', push2: '' }],
    });
    assert.ok(validate(badStack).errors.some((e) => e.includes('alfabeto da pilha')));
  });

  it('rejects multi-character pop symbols', () => {
    const bad = baseDef({
      transitions: [{ from: 'q0', to: 'q1', read: 'a', pop1: 'AB', push1: '', pop2: '', push2: '' }],
    });
    assert.ok(validate(bad).errors.length > 0);
  });
});

describe('two-stack validateInput', () => {
  it('rejects symbols outside the input alphabet', () => {
    assert.deepEqual(validateInput(baseDef(), 'ab').errors, []);
    const { errors } = validateInput(baseDef(), 'ax');
    assert.ok(errors[0].includes('"x"'));
  });
});

describe('two-stack initialConfig and step', () => {
  it('starts with bottom Z on both stacks by default', () => {
    const cfg = initialConfig(baseDef(), 'a');
    assert.deepEqual(cfg.stack1, ['Z']);
    assert.deepEqual(cfg.stack2, ['Z']);
    assert.equal(cfg.inputPos, 0);
  });

  it('starts empty when bottom is null', () => {
    const cfg = initialConfig(baseDef({ bottom: null }), 'a');
    assert.deepEqual(cfg.stack1, []);
    assert.deepEqual(cfg.stack2, []);
  });

  it('accepts when final and input is consumed', () => {
    const def = baseDef({ initial: 'q1' });
    const cfg = initialConfig(def, '');
    const res = step(def, cfg);
    assert.equal(res.kind, 'halt');
    assert.equal(res.result, 'accept');
  });

  it('rejects when final but input remains', () => {
    const def = baseDef({ initial: 'q1' });
    const cfg = initialConfig(def, 'a');
    const res = step(def, cfg);
    assert.equal(res.kind, 'halt');
    assert.equal(res.result, 'reject');
    assert.ok(res.reason.includes('não foi totalmente lida'));
  });

  it('rejects with applicable-transition message otherwise', () => {
    const def = baseDef();
    const cfg = initialConfig(def, 'b');
    const res = step(def, cfg);
    assert.equal(res.kind, 'halt');
    assert.equal(res.result, 'reject');
    assert.ok(res.reason.includes('Não há transição aplicável no estado q0'));
  });

  it('pushes with leftmost symbol on top (AB -> A on top)', () => {
    const def = baseDef({
      transitions: [{ from: 'q0', to: 'q1', read: 'a', pop1: '', push1: 'AB', pop2: '', push2: '' }],
    });
    const cfg = initialConfig(def, 'a');
    const res = step(def, cfg);
    assert.equal(res.kind, 'moved');
    assert.deepEqual(res.config.stack1, ['Z', 'B', 'A']);
    assert.equal(res.effects.pushed1, 'AB');
  });

  it('popping an empty stack never matches', () => {
    const def = baseDef({
      bottom: null,
      transitions: [{ from: 'q0', to: 'q1', read: 'a', pop1: 'Z', push1: '', pop2: '', push2: '' }],
    });
    const cfg = initialConfig(def, 'a');
    const res = step(def, cfg);
    assert.equal(res.kind, 'halt');
    assert.equal(res.result, 'reject');
  });

  it('does not mutate the previous configuration', () => {
    const def = baseDef();
    const cfg = initialConfig(def, 'a');
    const snapshot = JSON.parse(JSON.stringify(cfg));
    const res = step(def, cfg);
    assert.equal(res.kind, 'moved');
    assert.deepEqual(cfg, snapshot);
  });
});

describe('two-stack format', () => {
  it('formats edgeLabel and deltaText', () => {
    const t = { from: 'q0', to: 'qa', read: 'a', pop1: '', push1: 'A', pop2: '', push2: '' };
    assert.equal(edgeLabel(t), 'a , λ ; A | λ ; λ');
    assert.equal(deltaText(t), 'δ(q0, a, λ, λ) = (qa, A, λ)');
  });

  it('explains lambda reads in Portuguese', () => {
    const t = { from: 'qc', to: 'qf', read: '', pop1: 'Z', push1: 'Z', pop2: 'Z', push2: 'Z' };
    const s = explain(t, { consumed: '', popped1: 'Z', pushed1: 'Z', popped2: 'Z', pushed2: 'Z' });
    assert.ok(s.includes('não leu nada da entrada') || s.includes('Não leu nada da entrada'));
    assert.ok(s.includes('qf'));
  });

  it('formats configText with ε when input is consumed', () => {
    const cfg = { state: 'qb', inputPos: 3, stack1: ['Z', 'A'], stack2: ['Z', 'B'], steps: 1 };
    assert.equal(configText({}, cfg, 'abc'), 'qb | restante: ε | P1: Z A | P2: Z B');
    const cfg2 = { state: 'qb', inputPos: 1, stack1: ['Z'], stack2: [], steps: 1 };
    const text = configText({}, cfg2, 'abc');
    assert.ok(text.includes('restante: bc'));
    assert.ok(text.includes('vazia'));
  });
});
