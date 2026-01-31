import type { ModelMetadata, ModelParam, ReturnColumn } from '@dashbook/schema';

export interface ParsedModel {
  metadata: ModelMetadata;
  sql: string;
}

interface ParseResult extends ModelMetadata {
  sql: string;
}

/**
 * Parse model metadata from SQL comments.
 *
 * Supports:
 * - @name: model_name
 * - @description: text
 * - @owner: team-name
 * - @tags: [tag1, tag2]
 * - @param name: type = default {option1, option2}
 * - @returns: (multiline)
 * - @tests: (multiline)
 */
export function parseModelMetadata(sql: string): ParseResult {
  const lines = sql.split('\n');
  const metadataLines: string[] = [];
  const sqlLines: string[] = [];

  let inMetadata = true;
  let inMultiline: 'returns' | 'tests' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a metadata comment
    if (trimmed.startsWith('-- @') || (inMultiline && trimmed.startsWith('--'))) {
      metadataLines.push(trimmed);
      inMetadata = true;
    } else if (trimmed.startsWith('--') && inMetadata && metadataLines.length > 0) {
      // Continuation of metadata block
      metadataLines.push(trimmed);
    } else if (trimmed === '' && inMetadata) {
      // Empty line in metadata section, keep going
      continue;
    } else {
      // SQL content
      inMetadata = false;
      sqlLines.push(line);
    }
  }

  // Parse metadata
  const metadata = parseMetadataLines(metadataLines);

  if (!metadata.name) {
    throw new Error('Model must have a @name');
  }

  return {
    ...metadata,
    sql: sqlLines.join('\n').trim(),
  };
}

function parseMetadataLines(lines: string[]): Partial<ModelMetadata> & { sql?: string } {
  const result: Partial<ModelMetadata> = {};
  const params: ModelParam[] = [];
  const returns: ReturnColumn[] = [];
  const tests: string[] = [];

  let currentMultiline: 'returns' | 'tests' | null = null;

  for (const line of lines) {
    const content = line.replace(/^--\s*/, '').trim();

    // Check for multiline content (indented with -)
    if (currentMultiline && content.startsWith('- ')) {
      const itemContent = content.slice(2).trim();

      if (currentMultiline === 'returns') {
        const returnCol = parseReturnColumn(itemContent);
        if (returnCol) returns.push(returnCol);
      } else if (currentMultiline === 'tests') {
        tests.push(itemContent);
      }
      continue;
    }

    // Check for new directive
    if (content.startsWith('@')) {
      currentMultiline = null;

      if (content.startsWith('@name:')) {
        result.name = content.slice(6).trim();
      } else if (content.startsWith('@description:')) {
        result.description = content.slice(13).trim();
      } else if (content.startsWith('@owner:')) {
        result.owner = content.slice(7).trim();
      } else if (content.startsWith('@tags:')) {
        result.tags = parseTags(content.slice(6).trim());
      } else if (content.startsWith('@param')) {
        const param = parseParam(content.slice(6).trim());
        if (param) params.push(param);
      } else if (content.startsWith('@returns:')) {
        currentMultiline = 'returns';
      } else if (content.startsWith('@tests:')) {
        currentMultiline = 'tests';
      }
    }
  }

  if (params.length > 0) result.params = params;
  if (returns.length > 0) result.returns = returns;
  if (tests.length > 0) result.tests = tests;

  return result;
}

function parseTags(input: string): string[] {
  // Parse [tag1, tag2, tag3]
  const match = input.match(/\[(.*)\]/);
  if (!match) return [];
  return match[1].split(',').map(t => t.trim());
}

function parseParam(input: string): ModelParam | null {
  // Parse: name: type = default {option1, option2}
  // Or: name: type = default
  // Or: name: type

  const match = input.match(/^(\w+):\s*(\w+(?:\[\])?)\s*(?:=\s*([^{]+))?\s*(?:\{([^}]+)\})?/);
  if (!match) return null;

  const [, name, type, defaultValue, options] = match;

  const param: ModelParam = {
    name: name.trim(),
    type: type.trim() as ModelParam['type'],
  };

  if (defaultValue) {
    param.default = defaultValue.trim();
  }

  if (options) {
    param.options = options.split(',').map(o => o.trim());
  }

  return param;
}

function parseReturnColumn(input: string): ReturnColumn | null {
  // Parse: name: type -- description
  // Or: name: type

  const match = input.match(/^(\w+):\s*(\w+)\s*(?:--\s*(.+))?/);
  if (!match) return null;

  const [, name, type, description] = match;

  const col: ReturnColumn = {
    name: name.trim(),
    type: type.trim(),
  };

  if (description) {
    col.description = description.trim();
  }

  return col;
}
