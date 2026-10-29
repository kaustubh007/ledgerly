import { currency, lineTotal, Money, Quantity, sum } from '@ledgerly/domain';

// The invoice editor's lines as a reducer: every change is an action, the state transition is a
// pure function, and it is unit-tested without rendering anything.

export interface DraftLine {
  readonly id: string;
  readonly description: string;
  /** As typed: "1.5". Parsed only to preview totals; the API is the authority. */
  readonly quantity: string;
  readonly unitPrice: string;
}

export interface LinesState {
  readonly lines: readonly DraftLine[];
  /** Ids are local to the editor, for React keys and for targeting actions. */
  readonly nextId: number;
}

export type LinesAction =
  | { readonly type: 'added' }
  | { readonly type: 'removed'; readonly id: string }
  | {
      readonly type: 'changed';
      readonly id: string;
      readonly field: 'description' | 'quantity' | 'unitPrice';
      readonly value: string;
    }
  | { readonly type: 'moved'; readonly id: string; readonly direction: -1 | 1 };

export const MAX_LINES = 200;

const blank = (id: number): DraftLine => ({
  id: `line-${String(id)}`,
  description: '',
  quantity: '1',
  unitPrice: '',
});

export function initialLines(): LinesState {
  return { lines: [blank(1)], nextId: 2 };
}

export function linesReducer(state: LinesState, action: LinesAction): LinesState {
  switch (action.type) {
    case 'added':
      if (state.lines.length >= MAX_LINES) return state;
      return { lines: [...state.lines, blank(state.nextId)], nextId: state.nextId + 1 };
    case 'removed': {
      // An invoice always keeps one line to type into.
      if (state.lines.length === 1) return state;
      return { ...state, lines: state.lines.filter((line) => line.id !== action.id) };
    }
    case 'changed':
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.id === action.id ? { ...line, [action.field]: action.value } : line,
        ),
      };
    case 'moved': {
      const from = state.lines.findIndex((line) => line.id === action.id);
      const to = from + action.direction;
      const moving = state.lines[from];
      if (from < 0 || to < 0 || to >= state.lines.length || !moving) return state;
      const lines = state.lines.filter((_, i) => i !== from);
      lines.splice(to, 0, moving);
      return { ...state, lines };
    }
  }
}

export interface Preview {
  /** Per line: its exact total, or null while the line cannot be parsed yet. */
  readonly lineTotals: readonly (Money | null)[];
  /** Sum of the lines that parse; null if the currency is unknown. */
  readonly total: Money | null;
  readonly complete: boolean;
}

/**
 * Live totals with the same domain code the API uses (half-even per line, then summed), so the
 * preview cannot disagree with the invoice the server will store.
 */
export function preview(lines: readonly DraftLine[], currencyCode: string): Preview {
  let c;
  try {
    c = currency(currencyCode);
  } catch {
    return { lineTotals: lines.map(() => null), total: null, complete: false };
  }
  const lineTotals = lines.map((line) => {
    try {
      return lineTotal({
        description: line.description,
        quantity: Quantity.parse(line.quantity),
        unitPrice: Money.parse(line.unitPrice, c),
      });
    } catch {
      return null;
    }
  });
  const valid = lineTotals.filter((t): t is Money => t !== null);
  return { lineTotals, total: sum(c, valid), complete: valid.length === lines.length };
}
