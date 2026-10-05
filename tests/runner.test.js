import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRunner } from '../js/core/runner.js';
import * as engine from '../js/turing/engine.js';
import { configText } from '../js/turing/format.js';

/**
 * Build a tiny accepting machine: q0 -a-> q1 (final).
 * @param {object} overrides definition overrides
 * @returns {object} normalized definition
 */
function acceptDef(overrides = {}) {
  return engine.normalize({
    type: 'turing',
    inputAlphabet: ['a'],
    tapeAlphabet: ['a', '□'],
    blank: '□',
    tapeMode: 'infinite',
    startMarker: null,
    states: [
      { id: 'q0', x: 0, y: 0 },
      { id: 'q1', x: 10, y: 10 },
    ],
    initial: 'q0',
    finals: ['q1'],
    transitions: [{ from: 'q0', read: 'a', to: 'q1', write: 'a', move: 'R' }],
    ...overrides,
  });
}

/**
 * Build an endless right-moving machine used for limit tests.
 * @returns {object} normalized definition
 */
function loopDef() {
  return acceptDef({
    finals: [],
    transitions: [
      { from: 'q0', read: 'a', to: 'q0', write: 'a', move: 'R' },
      { from: 'q0', read: '□', to: 'q0', write: '□', move: 'R' },
    ],
  });
}

describe('runner', () => {
  it('starts ready with the initial configuration in history', () => {
    const seen = [];
    const runner = createRunner({
      engine,
      definition: acceptDef(),
      input: 'a',
      stepLimit: 10,
      configText,
      onUpdate: (state) => seen.push(state.status),
    });
    const state = runner.getState();
    assert.equal(state.status, 'ready');
    assert.equal(state.config.steps, 0);
    assert.equal(state.history.length, 1);
    assert.equal(state.history[0].text, 'q0 ⊢ [a]');
    assert.equal(state.lastTransitionIndex, null);
    runner.destroy();
  });

  it('steps manually, pauses, then halts with accept', () => {
    const runner = createRunner({
      engine,
      definition: acceptDef(),
      input: 'a',
      stepLimit: 10,
      configText,
    });
    let state = runner.step();
    assert.equal(state.status, 'paused');
    assert.equal(state.config.state, 'q1');
    assert.equal(state.history.length, 2);
    assert.equal(state.lastTransitionIndex, 0);
    state = runner.step();
    assert.equal(state.status, 'halted');
    assert.equal(state.haltResult, 'accept');
    const frozen = state.config.steps;
    state = runner.step();
    assert.equal(state.config.steps, frozen);
    runner.destroy();
  });

  it('halts with limit once steps reach the step limit', () => {
    const runner = createRunner({
      engine,
      definition: loopDef(),
      input: 'a',
      stepLimit: 2,
      configText,
    });
    runner.step();
    runner.step();
    const state = runner.step();
    assert.equal(state.status, 'halted');
    assert.equal(state.haltResult, 'limit');
    assert.ok(state.haltReason.includes('laço infinito'));
    runner.destroy();
  });

  it('resets to step 0 and loads new inputs', () => {
    const runner = createRunner({
      engine,
      definition: acceptDef(),
      input: 'a',
      stepLimit: 10,
      configText,
    });
    runner.step();
    runner.reset();
    let state = runner.getState();
    assert.equal(state.status, 'ready');
    assert.equal(state.config.steps, 0);
    assert.equal(state.history.length, 1);
    runner.load({ input: '' });
    state = runner.getState();
    assert.equal(state.history[0].text, 'q0 ⊢ [□]');
    runner.destroy();
  });

  it('notifies on speed and step limit changes', () => {
    const seen = [];
    const runner = createRunner({
      engine,
      definition: acceptDef(),
      input: 'a',
      stepLimit: 10,
      configText,
      onUpdate: (state) => seen.push({ speed: state.speed, limit: state.stepLimit }),
    });
    runner.setSpeed(100);
    runner.setStepLimit(5);
    assert.equal(seen[seen.length - 1].speed, 100);
    assert.equal(seen[seen.length - 1].limit, 5);
    runner.destroy();
  });
});
