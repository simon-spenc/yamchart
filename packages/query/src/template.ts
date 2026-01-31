import nunjucks from 'nunjucks';

// Configure Nunjucks environment
const env = new nunjucks.Environment(null, {
  autoescape: false, // SQL doesn't need HTML escaping
  throwOnUndefined: true, // Fail fast on missing variables
});

export interface TemplateContext {
  [key: string]: unknown;
  ref: (name: string) => string;
}

export interface ModelRefs {
  [modelName: string]: string; // model name -> table/subquery
}

/**
 * Create a template context with parameters and ref() function.
 */
export function createTemplateContext(
  params: Record<string, unknown>,
  refs: ModelRefs = {}
): TemplateContext {
  return {
    ...params,
    ref: (name: string): string => {
      const resolved = refs[name];
      if (resolved === undefined) {
        throw new Error(`Unknown model reference: ${name}`);
      }
      return resolved;
    },
  };
}

/**
 * Render a SQL template with the given context.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  const rendered = env.renderString(template, context);
  // Clean up extra whitespace from conditionals
  return rendered
    .split('\n')
    .map(line => line.trimEnd())
    .filter((line, i, arr) => {
      // Remove consecutive blank lines
      if (line === '' && arr[i - 1] === '') return false;
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Check if a template contains a specific variable reference.
 */
export function templateHasVariable(template: string, varName: string): boolean {
  // Match {{ varName }} or {{ varName | filter }}
  const regex = new RegExp(`\\{\\{\\s*${varName}(?:\\s*\\|[^}]+)?\\s*\\}\\}`, 'g');
  return regex.test(template);
}

/**
 * Extract all variable names from a template.
 */
export function extractTemplateVariables(template: string): string[] {
  const variables = new Set<string>();

  // Match {{ variable }} or {{ variable | filter }}
  const regex = /\{\{\s*(\w+)(?:\s*\|[^}]+)?\s*\}\}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    // Exclude built-in functions
    if (varName !== 'ref' && varName !== 'loop') {
      variables.add(varName);
    }
  }

  return Array.from(variables);
}
