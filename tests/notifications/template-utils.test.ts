import { describe, it, expect } from 'vitest';
import {
  interpolate,
  renderEmailTemplate,
  renderPushTemplate,
  extractVariables,
  validateVariables,
} from '@/lib/notifications/template-utils';

describe('interpolate', () => {
  it('replaces known variables', () => {
    expect(interpolate('Hola {{first_name}}!', { first_name: 'Ana' })).toBe('Hola Ana!');
  });

  it('leaves unknown variables as-is', () => {
    expect(interpolate('Hola {{unknown}}!', {})).toBe('Hola {{unknown}}!');
  });

  it('replaces multiple occurrences', () => {
    const result = interpolate('{{a}} y {{a}}', { a: 'X' });
    expect(result).toBe('X y X');
  });

  it('handles null / undefined values as-is', () => {
    expect(interpolate('{{x}}', { x: null })).toBe('{{x}}');
    expect(interpolate('{{x}}', { x: undefined })).toBe('{{x}}');
  });

  it('converts numbers to strings', () => {
    expect(interpolate('Ticket #{{id}}', { id: 42 })).toBe('Ticket #42');
  });
});

describe('renderEmailTemplate', () => {
  it('renders subject, html and text', () => {
    const result = renderEmailTemplate(
      '<p>Hola {{name}}</p>',
      'Hola {{name}}',
      'Asunto {{name}}',
      { name: 'Pedro' }
    );
    expect(result.html).toBe('<p>Hola Pedro</p>');
    expect(result.text).toBe('Hola Pedro');
    expect(result.subject).toBe('Asunto Pedro');
  });
});

describe('renderPushTemplate', () => {
  it('renders title and message', () => {
    const result = renderPushTemplate('Título {{event}}', 'Mensaje {{event}}', { event: 'Gala' });
    expect(result.title).toBe('Título Gala');
    expect(result.message).toBe('Mensaje Gala');
  });
});

describe('extractVariables', () => {
  it('extracts unique variable names', () => {
    const vars = extractVariables('{{a}} {{b}} {{a}}');
    expect(vars).toEqual(['a', 'b']);
  });

  it('returns empty array for no placeholders', () => {
    expect(extractVariables('no placeholders here')).toEqual([]);
  });
});

describe('validateVariables', () => {
  it('returns missing keys', () => {
    const missing = validateVariables(['a', 'b', 'c'], { a: 'x', c: 'z' });
    expect(missing).toEqual(['b']);
  });

  it('flags empty strings as missing', () => {
    const missing = validateVariables(['a'], { a: '' });
    expect(missing).toEqual(['a']);
  });

  it('returns empty when all present', () => {
    expect(validateVariables(['a'], { a: 'val' })).toEqual([]);
  });
});
