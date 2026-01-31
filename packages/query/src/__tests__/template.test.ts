import { describe, it, expect } from 'vitest';
import { renderTemplate, createTemplateContext } from '../template.js';

describe('renderTemplate', () => {
  it('substitutes simple variables', () => {
    const sql = "SELECT * FROM orders WHERE date > '{{ start_date }}'";
    const result = renderTemplate(sql, { start_date: '2025-01-01' });
    expect(result).toBe("SELECT * FROM orders WHERE date > '2025-01-01'");
  });

  it('substitutes multiple variables', () => {
    const sql = "WHERE date BETWEEN '{{ start_date }}' AND '{{ end_date }}'";
    const result = renderTemplate(sql, {
      start_date: '2025-01-01',
      end_date: '2025-12-31',
    });
    expect(result).toBe("WHERE date BETWEEN '2025-01-01' AND '2025-12-31'");
  });

  it('handles ref() function', () => {
    const sql = 'SELECT * FROM {{ ref("orders") }}';
    const context = createTemplateContext({}, { orders: 'public.orders' });
    const result = renderTemplate(sql, context);
    expect(result).toBe('SELECT * FROM public.orders');
  });

  it('handles ref() with simple table names', () => {
    const sql = 'SELECT * FROM {{ ref("orders") }} o JOIN {{ ref("customers") }} c ON o.customer_id = c.id';
    const context = createTemplateContext({}, { orders: 'orders', customers: 'customers' });
    const result = renderTemplate(sql, context);
    expect(result).toBe('SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id');
  });

  it('handles conditional blocks', () => {
    const sql = `
SELECT * FROM orders
WHERE 1=1
{% if category %}
  AND category = '{{ category }}'
{% endif %}
`;
    const withCategory = renderTemplate(sql, { category: 'Electronics' });
    expect(withCategory).toContain("AND category = 'Electronics'");

    const withoutCategory = renderTemplate(sql, {});
    expect(withoutCategory).not.toContain('AND category');
  });

  it('handles loops', () => {
    const sql = `
SELECT * FROM orders
WHERE status IN ({% for s in statuses %}'{{ s }}'{% if not loop.last %}, {% endif %}{% endfor %})
`;
    const result = renderTemplate(sql, { statuses: ['pending', 'shipped', 'delivered'] });
    expect(result).toContain("'pending', 'shipped', 'delivered'");
  });

  it('handles default filter', () => {
    const sql = "WHERE region = '{{ region | default(\"US\") }}'";

    const withValue = renderTemplate(sql, { region: 'EU' });
    expect(withValue).toContain("region = 'EU'");

    const withoutValue = renderTemplate(sql, {});
    expect(withoutValue).toContain("region = 'US'");
  });

  it('throws on undefined required variable', () => {
    const sql = "SELECT * FROM {{ undefined_table }}";
    expect(() => renderTemplate(sql, {})).toThrow();
  });
});

describe('createTemplateContext', () => {
  it('merges params with ref function', () => {
    const context = createTemplateContext(
      { start_date: '2025-01-01' },
      { orders: 'public.orders' }
    );

    expect(context.start_date).toBe('2025-01-01');
    expect(context.ref('orders')).toBe('public.orders');
  });

  it('ref throws for unknown model', () => {
    const context = createTemplateContext({}, { orders: 'orders' });
    expect(() => context.ref('unknown')).toThrow('Unknown model reference: unknown');
  });
});
