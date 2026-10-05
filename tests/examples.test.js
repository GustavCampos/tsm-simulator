import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as turing from '../js/turing/engine.js';
import * as twoStack from '../js/two-stack/engine.js';
import { DEFAULT_STEP_LIMIT } from '../js/config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'examples', 'index.json'), 'utf8'));

/**
 * Run a machine until halt or the step limit.
 * @param {object} engine engine module
 * @param {object} def machine definition
 * @param {string} input input word
 * @param {number} limit step limit
 * @returns {{result: string, config: object}} final result and last configuration
 */
function runToHalt(engine, def, input, limit) {
  let config = engine.initialConfig(def, input);
  for (let i = 0; i < limit; i += 1) {
    let res;
    if (def.type === 'two-stack') {
      res = engine.step(def, config, input);
    } else {
      res = engine.step(def, config);
    }
    if (res.kind === 'halt') {
      return { result: res.result, config };
    }
    config = res.config;
  }
  return { result: 'limit', config };
}

const allFiles = [
  ...manifest.turing.map((e) => ({ ...e, type: 'turing' })),
  ...manifest['two-stack'].map((e) => ({ ...e, type: 'two-stack' })),
];

describe('examples manifest', () => {
  it('lists exactly the five machines from the spec', () => {
    assert.equal(manifest.turing.length, 3);
    assert.equal(manifest['two-stack'].length, 2);
  });
});

for (const entry of allFiles) {
  describe(`example ${entry.file}`, () => {
    const filePath = path.join(root, 'examples', entry.file);
    const def = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const engine = def.type === 'turing' ? turing : twoStack;

    it('validates without errors', () => {
      const { errors } = engine.validate(def);
      assert.deepEqual(errors, []);
    });

    for (const t of def.tests ?? []) {
      it(`input ${JSON.stringify(t.input)} -> ${t.expect}`, () => {
        const limit = t.stepLimit ?? DEFAULT_STEP_LIMIT;
        const { result, config } = runToHalt(engine, def, t.input, limit);
        assert.equal(result, t.expect);
        if (t.expectTape !== undefined) {
          assert.equal(turing.tapeContent(def, config), t.expectTape);
        }
      });
    }
  });
}
