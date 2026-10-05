/**
 * UI constants shared by the runner and the views.
 * User interface text is in Portuguese; code identifiers are in English.
 */

/** Default delay in ms between automatic steps. */
export const DEFAULT_SPEED = 600;
/** Minimum delay in ms for the speed slider. */
export const SPEED_MIN = 50;
/** Maximum delay in ms for the speed slider. */
export const SPEED_MAX = 2000;
/** Default step limit before halting with `limit`. */
export const DEFAULT_STEP_LIMIT = 1000;
/** Minimum allowed step limit. */
export const STEP_LIMIT_MIN = 1;
/**
 * Labels used to display head moves.
 * Switch to `{ L: "E", R: "D", S: "P" }` for Portuguese textbook notation.
 */
export const MOVE_LABELS = { L: 'L', R: 'R', S: 'S' };
/** Symbol shown when the input word is empty. */
export const EMPTY_WORD_LABEL = 'ε';
/** Symbol shown for lambda (empty) transition fields. */
export const LAMBDA_LABEL = 'λ';
