/**
 * Loading of example machines, JSON parsing and definition validation.
 * Network and syntax failures are returned as data with Portuguese
 * messages, never thrown to the caller as user-facing errors.
 */

/**
 * Fetch the examples manifest.
 * @returns {Promise<{data?: object, errors?: string[]}>} manifest or errors
 */
export async function loadManifest() {
  try {
    const response = await fetch('./examples/index.json');
    if (!response.ok) {
      return { errors: ['Não foi possível carregar a lista de exemplos.'] };
    }
    return { data: await response.json() };
  } catch (err) {
    return {
      errors: [
        'Não foi possível carregar a lista de exemplos. Verifique se o site está sendo servido por um servidor local.',
      ],
    };
  }
}

/**
 * Fetch one example machine definition.
 * @param {string} file file name inside `examples/`
 * @returns {Promise<{data?: object, errors?: string[]}>} definition or errors
 */
export async function loadExample(file) {
  try {
    const response = await fetch(`./examples/${file}`);
    if (!response.ok) {
      return { errors: [`Exemplo "${file}" não encontrado.`] };
    }
    return { data: await response.json() };
  } catch (err) {
    return { errors: [`Não foi possível carregar o exemplo "${file}".`] };
  }
}

/**
 * Parse machine JSON typed or pasted by the user.
 * @param {string} text raw JSON text
 * @returns {{definition?: object, errors?: string[]}} definition or errors
 */
export function parseDefinitionText(text) {
  try {
    return { definition: JSON.parse(text) };
  } catch (err) {
    return { errors: [`JSON inválido: ${err.message}`] };
  }
}

/**
 * Normalize a raw definition and validate it.
 * @param {object} engine engine module with `normalize` and `validate`
 * @param {object} raw raw machine definition
 * @returns {{definition: object, errors: string[], warnings: string[]}} normalized definition with messages
 */
export function validateAndNormalize(engine, raw) {
  const definition = engine.normalize(raw);
  const { errors, warnings } = engine.validate(raw);
  return { definition, errors, warnings };
}
