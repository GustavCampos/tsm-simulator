import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseJff } from '../js/turing/jff.js';
import { validate, initialConfig, step } from '../js/turing/engine.js';

const SIMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<structure>
  <type>turing</type>
  <automaton>
    <state id="0" name="q0">
      <x>80</x>
      <y>170</y>
      <initial/>
    </state>
    <state id="1" name="q1">
      <x>260</x>
      <y>170</y>
      <final/>
    </state>
    <transition>
      <from>0</from>
      <to>1</to>
      <read>a</read>
      <write>X</write>
      <move>R</move>
    </transition>
    <transition>
      <from>0</from>
      <to>0</to>
      <read></read>
      <write></write>
      <move>R</move>
    </transition>
  </automaton>
</structure>`;

describe('jff valid import', () => {
  it('maps states, transitions and coordinates', () => {
    const { definition, errors, warnings } = parseJff(SIMPLE);
    assert.deepEqual(errors, []);
    assert.equal(definition.type, 'turing');
    assert.deepEqual(definition.states, [
      { id: 'q0', x: 80, y: 170 },
      { id: 'q1', x: 260, y: 170 },
    ]);
    assert.equal(definition.initial, 'q0');
    assert.deepEqual(definition.finals, ['q1']);
    assert.deepEqual(definition.transitions[0], {
      from: 'q0', read: 'a', to: 'q1', write: 'X', move: 'R',
    });
  });

  it('maps empty read/write to the blank symbol', () => {
    const { definition } = parseJff(SIMPLE);
    assert.equal(definition.transitions[1].read, '□');
    assert.equal(definition.transitions[1].write, '□');
  });

  it('infers alphabets and warns about it', () => {
    const { definition, warnings } = parseJff(SIMPLE);
    assert.deepEqual(definition.inputAlphabet, ['a']);
    assert.ok(definition.tapeAlphabet.includes('a'));
    assert.ok(definition.tapeAlphabet.includes('X'));
    assert.ok(definition.tapeAlphabet.includes('□'));
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('inferido'));
  });

  it('produces a definition that validates and runs', () => {
    const { definition } = parseJff(SIMPLE);
    assert.deepEqual(validate(definition).errors, []);
    const moved = step(definition, initialConfig(definition, 'a'));
    assert.equal(moved.kind, 'moved');
    assert.equal(moved.config.state, 'q1');
  });

  it('falls back to q+id when name is missing', () => {
    const xml = SIMPLE.replace('name="q1"', '');
    const { definition, errors } = parseJff(xml);
    assert.deepEqual(errors, []);
    assert.ok(definition.states.some((s) => s.id === 'q1'));
  });

  it('scales down coordinates wider than the diagram', () => {
    const xml = SIMPLE.replace('<x>260</x>', '<x>1200</x>').replace('<y>170</y>', '<y>680</y>');
    const { definition } = parseJff(xml);
    const maxX = Math.max(...definition.states.map((s) => s.x));
    const maxY = Math.max(...definition.states.map((s) => s.y));
    assert.ok(maxX <= 600);
    assert.ok(maxY <= 340);
  });
});

describe('jff rejections', () => {
  it('rejects non-Turing types', () => {
    const { errors } = parseJff(SIMPLE.replace('<type>turing</type>', '<type>fa</type>'));
    assert.equal(errors.length, 1);
    assert.ok(errors[0].includes('fa'));
  });

  it('rejects multi-tape machines', () => {
    const xml = SIMPLE.replace('<automaton>', '<automaton tapes="2">');
    const { errors } = parseJff(xml);
    assert.ok(errors.some((e) => e.includes('várias fitas')));
  });

  it('rejects building blocks', () => {
    const xml = SIMPLE.replace('</automaton>', '<block><name>b</name></block></automaton>');
    const { errors } = parseJff(xml);
    assert.ok(errors.some((e) => e.includes('block')));
  });

  it('rejects malformed XML', () => {
    const { errors } = parseJff('<structure><type>turing');
    assert.ok(errors.some((e) => e.includes('malformado')));
  });

  it('rejects files without an initial state', () => {
    const { errors } = parseJff(SIMPLE.replace('<initial/>', ''));
    assert.ok(errors.some((e) => e.includes('inicial')));
  });
});
