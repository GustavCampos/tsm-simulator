import { DEFAULT_SPEED, DEFAULT_STEP_LIMIT } from '../config.js';

/**
 * Build one history entry for a configuration.
 * @param {object} definition normalized machine definition
 * @param {object} config configuration to describe
 * @param {string} input current input word
 * @param {Function|null} configText formatter `(definition, config, input) => string`
 * @param {number|null} transitionIndex index of the transition that produced it
 * @param {object|null} effects engine effects of that transition
 * @returns {{step: number, config: object, transitionIndex: number|null, effects: object|null, text: string}} history entry
 */
function makeEntry(definition, config, input, configText, transitionIndex, effects) {
  return {
    step: config.steps,
    config,
    transitionIndex,
    effects,
    text: typeof configText === 'function' ? configText(definition, config, input) : '',
  };
}

/**
 * Create a step runner for a machine. The runner owns the current
 * configuration, the history and the auto-run timer. Views render only
 * from the state object passed to `onUpdate`.
 * @param {object} args runner arguments
 * @param {object} args.engine engine module with `initialConfig` and `step`
 * @param {object} args.definition normalized machine definition
 * @param {string} args.input input word
 * @param {number} [args.stepLimit] halts with `limit` at this many steps
 * @param {number} [args.speed] delay in ms between automatic steps
 * @param {Function} [args.configText] formatter `(definition, config, input) => string`
 * @param {Function} [args.onUpdate] called with the state after every change
 * @returns {{step: Function, play: Function, pause: Function, reset: Function, load: Function, setSpeed: Function, setStepLimit: Function, getState: Function, destroy: Function}} runner controls
 */
export function createRunner({
  engine,
  definition,
  input,
  stepLimit = DEFAULT_STEP_LIMIT,
  speed = DEFAULT_SPEED,
  configText = null,
  onUpdate = null,
}) {
  let currentDefinition = definition;
  let currentInput = input;
  let limit = stepLimit;
  let delay = speed;
  let status = 'ready';
  let haltResult = null;
  let haltReason = '';
  let lastTransitionIndex = null;
  let lastEffects = null;
  let timerId = null;
  let history = [
    makeEntry(
      currentDefinition,
      engine.initialConfig(currentDefinition, currentInput),
      currentInput,
      configText,
      null,
      null,
    ),
  ];

  /**
   * Take a snapshot of the current runner state for the views.
   * @returns {{status: string, haltResult: string|null, haltReason: string, config: object, lastTransitionIndex: number|null, lastEffects: object|null, history: object[], speed: number, stepLimit: number}} runner state
   */
  function getState() {
    return {
      status,
      haltResult,
      haltReason,
      config: history[history.length - 1].config,
      lastTransitionIndex,
      lastEffects,
      history,
      speed: delay,
      stepLimit: limit,
    };
  }

  /**
   * Notify the views of a change.
   */
  function notify() {
    if (typeof onUpdate === 'function') {
      onUpdate(getState());
    }
  }

  /**
   * Stop the auto-run timer without changing the status.
   */
  function stopTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  /**
   * Halt the machine with a result and stop auto-run.
   * @param {string} result `accept`, `reject` or `limit`
   * @param {string} reason Portuguese explanation shown to the user
   */
  function doHalt(result, reason) {
    stopTimer();
    status = 'halted';
    haltResult = result;
    haltReason = reason;
    notify();
  }

  /**
   * Advance exactly one step. When the step limit was reached, halts
   * with `limit` instead of calling the engine.
   * @returns {object} the new runner state
   */
  function advance() {
    const config = history[history.length - 1].config;
    if (config.steps >= limit) {
      doHalt(
        'limit',
        `A máquina executou ${config.steps} passos sem parar. Pode estar em laço infinito.`,
      );
      return getState();
    }
    const res = engine.step(currentDefinition, config);
    if (res.kind === 'halt') {
      doHalt(res.result, res.reason);
      return getState();
    }
    lastTransitionIndex = res.transitionIndex;
    lastEffects = res.effects;
    history.push(
      makeEntry(currentDefinition, res.config, currentInput, configText, res.transitionIndex, res.effects),
    );
    return getState();
  }

  /**
   * Schedule the next automatic step with setTimeout chaining.
   */
  function schedule() {
    stopTimer();
    timerId = setTimeout(() => {
      timerId = null;
      if (status !== 'running') {
        return;
      }
      advance();
      if (status === 'running') {
        schedule();
      }
    }, delay);
  }

  /**
   * Execute the next step manually. Ignored while auto-running or halted.
   * @returns {object} the new runner state
   */
  function stepOnce() {
    if (status === 'running' || status === 'halted') {
      return getState();
    }
    advance();
    if (status !== 'halted') {
      status = 'paused';
      notify();
    }
    return getState();
  }

  /**
   * Start automatic execution until halted or paused.
   */
  function play() {
    if (status === 'running' || status === 'halted') {
      return;
    }
    status = 'running';
    notify();
    schedule();
  }

  /**
   * Pause automatic execution.
   */
  function pause() {
    if (status !== 'running') {
      return;
    }
    stopTimer();
    status = 'paused';
    notify();
  }

  /**
   * Stop auto-run and return to the initial configuration.
   */
  function reset() {
    stopTimer();
    history = [
      makeEntry(
        currentDefinition,
        engine.initialConfig(currentDefinition, currentInput),
        currentInput,
        configText,
        null,
        null,
      ),
    ];
    lastTransitionIndex = null;
    lastEffects = null;
    status = 'ready';
    haltResult = null;
    haltReason = '';
    notify();
  }

  /**
   * Load a new definition and/or input, resetting to step 0.
   * @param {object} args new machine to run
   * @param {object} [args.definition] normalized machine definition
   * @param {string} [args.input] input word
   */
  function load({ definition: nextDefinition, input: nextInput }) {
    stopTimer();
    if (nextDefinition !== undefined) {
      currentDefinition = nextDefinition;
    }
    if (nextInput !== undefined) {
      currentInput = nextInput;
    }
    history = [
      makeEntry(
        currentDefinition,
        engine.initialConfig(currentDefinition, currentInput),
        currentInput,
        configText,
        null,
        null,
      ),
    ];
    lastTransitionIndex = null;
    lastEffects = null;
    status = 'ready';
    haltResult = null;
    haltReason = '';
    notify();
  }

  /**
   * Change the delay between automatic steps.
   * @param {number} ms delay in ms
   */
  function setSpeed(ms) {
    delay = ms;
    if (status === 'running') {
      schedule();
    }
    notify();
  }

  /**
   * Change the step limit that halts the machine with `limit`.
   * @param {number} n new step limit
   */
  function setStepLimit(n) {
    limit = n;
    notify();
  }

  /**
   * Stop the auto-run timer. Call when the page is discarded.
   */
  function destroy() {
    stopTimer();
  }

  return {
    step: stepOnce,
    play,
    pause,
    reset,
    load,
    setSpeed,
    setStepLimit,
    getState,
    destroy,
  };
}
