import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  validate,
  validateInput,
  initialConfig,
  step,
  tapeContent,
} from '../js/turing/engine.js';
import { edgeLabel, deltaText, explain, configText } from '../js/turing/format.js';

function baseDef(overrides = {}) {
  return normalize({
    type: 'turing',
    inputAlphabet: ['a', 'b'],
    tapeAlphabet: ['a', 'b', 'X', 'Y', '□'],
    blank: '□',
    tapeMode: 'infinite',
    startMarker: null,
    states: [{ id: 'q0', x: 0, y: 0 }, { id: 'q1', x: 10, y: 10 }],
    initial: 'q0',
    finals: ['q1'],
    transitions: [{ from: 'q0', read: 'a', to: 'q1', write: 'X', move: 'R' }],
    ...overrides,
  });
}

describe('turing normalize', () => {
  it('converts ε and λ to empty string and fills defaults', () => {
    const def = normalize({
      type: 'turing',
      states: [{ id: 'q0' }],
      initial: 'q0',
      finals: [],
      transitions: [{ from: 'q0', read: 'ε', to: 'q0', write: 'λ', move: 'R' }],
    });
    assert.equal(def.transitions[0].read, '');
    assert.equal(def.transitions[0].write, '');
    assert.equal(def.tapeMode, 'infinite');
    assert.equal(def.blank, '□');
  });
});

describe('turing validate', () => {
  it('accepts a valid definition', () => {
    const { errors } = validate(baseDef());
    assert.deepEqual(errors, []);
  });

  it('rejects wrong type and duplicate states', () => {
    const { errors } = validate(baseDef({ type: 'two-stack' }));
    assert.ok(errors.some((e) => e.includes('Tipo de máquina inválido')));
    const dup = baseDef({ states: [{ id: 'q0' }, { id: 'q0' }] });
    assert.ok(validate(dup).errors.some((e) => e.includes('duplicado')));
  });

  it('rejects unknown states, invalid move and duplicate transitions', () => {
    const unknown = baseDef({ transitions: [{ from: 'qx', read: 'a', to: 'q1', write: 'a', move: 'R' }] });
    assert.ok(validate(unknown).errors.length > 0);
    const badMove = baseDef({ transitions: [{ from: 'q0', read: 'a', to: 'q1', write: 'a', move: 'X' }] });
    assert.ok(validate(badMove).errors.some((e) => e.includes('Movimento inválido')));
    const dupTrans = baseDef({
      transitions: [
        { from: 'q0', read: 'a', to: 'q1', write: 'X', move: 'R' },
        { from: 'q0', read: 'a', to: 'q1', write: 'X', move: 'R' },
      ],
    });
    assert.ok(validate(dupTrans).errors.some((e) => e.includes('duplicadas')));
  });

  it('rejects blank inside inputAlphabet and symbols outside tapeAlphabet', () => {
    const bad = baseDef({ inputAlphabet: ['a', '□'] });
    assert.ok(validate(bad).errors.some((e) => e.includes('branco')));
    const outside = baseDef({ transitions: [{ from: 'q0', read: 'z', to: 'q1', write: 'z', move: 'R' }] });
    assert.ok(validate(outside).errors.some((e) => e.includes('alfabeto da fita')));
  });

  it('rejects multi-character symbols', () => {
    const bad = baseDef({ inputAlphabet: ['ab'] });
    assert.ok(validate(bad).errors.length > 0);
  });

  it('warns about unreachable states and missing positions', () => {
    const def = baseDef({
      states: [{ id: 'q0', x: 0, y: 0 }, { id: 'q1', x: 1, y: 1 }, { id: 'q2' }],
      finals: [],
      transitions: [{ from: 'q0', read: 'a', to: 'q1', write: 'a', move: 'R' }],
    });
    const { warnings } = validate(def);
    assert.ok(warnings.some((w) => w.includes('q2') && w.includes('inalcançável')));
    assert.ok(warnings.some((w) => w.includes('layout automático')));
  });
});

describe('turing validateInput', () => {
  it('accepts valid input and rejects invalid symbols', () => {
    assert.deepEqual(validateInput(baseDef(), 'ab').errors, []);
    const { errors } = validateInput(baseDef(), 'ax');
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes('"x"'));
  });
});

describe('turing initialConfig and step', () => {
  it('accepts at step 0 when initial is final', () => {
    const def = baseDef({ initial: 'q1' });
    const cfg = initialConfig(def, '');
    const res = step(def, cfg);
    assert.equal(res.kind, 'halt');
    assert.equal(res.result, 'accept');
  });

  it('rejects on missing transition with correct reason', () => {
    const def = baseDef();
    const cfg = initialConfig(def, 'b');
    const res = step(def, cfg);
    assert.equal(res.kind, 'halt');
    assert.equal(res.result, 'reject');
    assert.ok(res.reason.includes('Não há transição definida para (q0, b)'));
  });

  it('moves, writes and does not mutate the previous config', () => {
    const def = baseDef();
    const cfg = initialConfig(def, 'a');
    const snapshot = JSON.parse(JSON.stringify(cfg));
    const res = step(def, cfg);
    assert.equal(res.kind, 'moved');
    assert.equal(res.config.state, 'q1');
    assert.equal(res.config.head, 1);
    assert.equal(res.config.tape['0'], 'X');
    assert.deepEqual(cfg, snapshot);
    assert.equal(res.effects.readSymbol, 'a');
  });

  it('rejects when leaving the tape on the left in semi-infinite mode', () => {
    const def = baseDef({
      tapeMode: 'semi-infinite',
      startMarker: null,
      transitions: [{ from: 'q0', read: 'a', to: 'q0', write: 'a', move: 'L' }],
      finals: [],
    });
    const cfg = initialConfig(def, 'a');
    const res = step(def, cfg);
    assert.equal(res.kind, 'halt');
    assert.equal(res.result, 'reject');
    assert.ok(res.reason.includes('sair da fita pela esquerda'));
  });

  it('places the start marker at cell 0 with input from cell 1', () => {
    const def = baseDef({
      tapeMode: 'semi-infinite',
      startMarker: '⊳',
      tapeAlphabet: ['a', 'b', 'X', 'Y', '□', '⊳'],
      transitions: [],
      finals: [],
    });
    const cfg = initialConfig(def, 'ab');
    assert.equal(cfg.tape['0'], '⊳');
    assert.equal(cfg.tape['1'], 'a');
    assert.equal(cfg.tape['2'], 'b');
    assert.equal(cfg.head, 0);
  });

  it('computes final tape content trimmed', () => {
    const def = baseDef();
    const cfg = { state: 'q1', tape: { 0: 'X', 1: 'a', 3: 'b' }, head: 1, steps: 1 };
    assert.equal(tapeContent(def, cfg), 'Xa□b');
    assert.equal(tapeContent(def, { state: 'q1', tape: {}, head: 0, steps: 0 }), '');
  });

  it('excludes the start marker from tape content', () => {
    const def = baseDef({ tapeMode: 'semi-infinite', startMarker: '⊳' });
    const cfg = { state: 'q0', tape: { 0: '⊳', 1: 'a' }, head: 1, steps: 0 };
    assert.equal(tapeContent(def, cfg), 'a');
  });
});

describe('turing format', () => {
  it('formats edgeLabel and deltaText', () => {
    const t = { from: 'q0', read: 'a', to: 'q1', write: 'X', move: 'R' };
    assert.equal(edgeLabel(t), 'a ; X , R');
    assert.equal(deltaText(t), 'δ(q0, a) = (q1, X, R)');
    assert.equal(edgeLabel({ ...t, read: '' }), 'ε ; X , R');
  });

  it('explains a step in Portuguese', () => {
    const t = { from: 'q0', read: 'a', to: 'q1', write: 'X', move: 'R' };
    const s = explain(t, { written: 'X', move: 'R' });
    assert.ok(s.includes('Leu "a"'));
    assert.ok(s.includes('escreveu "X"'));
    assert.ok(s.includes('direita'));
    assert.ok(s.includes('q1'));
  });

  it('formats configText with head brackets and blank trimming', () => {
    const def = baseDef();
    const cfg = { state: 'q1', tape: { 0: 'X', 1: 'a' }, head: 1, steps: 1 };
    assert.equal(configText(def, cfg, ''), 'q1 ⊢ X [a]');
    const empty = { state: 'q0', tape: {}, head: 0, steps: 0 };
    assert.equal(configText(def, empty, ''), 'q0 ⊢ [□]');
  });
});
