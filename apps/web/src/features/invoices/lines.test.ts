import { describe, expect, it } from 'vitest';
import { initialLines, linesReducer, MAX_LINES, preview, type LinesState } from './lines';

const apply = (state: LinesState, ...actions: Parameters<typeof linesReducer>[1][]) =>
  actions.reduce(linesReducer, state);

describe('linesReducer', () => {
  it('adds, edits, moves and removes lines', () => {
    let s = apply(initialLines(), { type: 'added' }, { type: 'added' });
    expect(s.lines.map((l) => l.id)).toEqual(['line-1', 'line-2', 'line-3']);
    s = apply(s, { type: 'changed', id: 'line-2', field: 'description', value: 'Design' });
    expect(s.lines[1]?.description).toBe('Design');
    s = apply(s, { type: 'moved', id: 'line-2', direction: -1 });
    expect(s.lines.map((l) => l.id)).toEqual(['line-2', 'line-1', 'line-3']);
    s = apply(s, { type: 'removed', id: 'line-1' });
    expect(s.lines.map((l) => l.id)).toEqual(['line-2', 'line-3']);
  });

  it('never leaves zero lines, never exceeds the maximum, ignores impossible moves', () => {
    const one = initialLines();
    expect(linesReducer(one, { type: 'removed', id: 'line-1' })).toBe(one);
    expect(linesReducer(one, { type: 'moved', id: 'line-1', direction: 1 })).toBe(one);
    expect(linesReducer(one, { type: 'moved', id: 'nope', direction: -1 })).toBe(one);
    let full = one;
    for (let i = 0; i < MAX_LINES + 5; i += 1) full = linesReducer(full, { type: 'added' });
    expect(full.lines).toHaveLength(MAX_LINES);
  });

  it('does not reuse ids after removals', () => {
    const s = apply(
      initialLines(),
      { type: 'added' },
      { type: 'removed', id: 'line-2' },
      { type: 'added' },
    );
    expect(s.lines.map((l) => l.id)).toEqual(['line-1', 'line-3']);
  });
});

describe('preview', () => {
  const line = (quantity: string, unitPrice: string) => ({
    id: 'x',
    description: 'd',
    quantity,
    unitPrice,
  });

  it('computes exact line totals (half-even) and their sum', () => {
    const p = preview([line('0.333', '10.00'), line('0.5', '0.05')], 'USD');
    expect(p.lineTotals.map((t) => t?.toDecimalString())).toEqual(['3.33', '0.02']);
    expect(p.total?.toDecimalString()).toBe('3.35');
    expect(p.complete).toBe(true);
  });

  it('skips lines that do not parse yet, and says so', () => {
    const p = preview([line('2', '10'), line('1', ''), line('1.2345', '1')], 'USD');
    expect(p.lineTotals.map((t) => t?.toDecimalString() ?? null)).toEqual(['20.00', null, null]);
    expect(p.total?.toDecimalString()).toBe('20.00');
    expect(p.complete).toBe(false);
  });

  it('respects the currency’s decimals', () => {
    expect(preview([line('1', '1.5')], 'JPY').lineTotals[0]).toBeNull();
    expect(preview([line('3', '1.005')], 'KWD').total?.toDecimalString()).toBe('3.015');
  });

  it('has no total without a valid currency', () => {
    expect(preview([line('1', '1')], 'XXX')).toEqual({
      lineTotals: [null],
      total: null,
      complete: false,
    });
  });
});
