import { noPreferenceEffects } from '@web/test/render';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { discardSink } from './middleware/analytics';
import { useAppDispatch, useAppSelector } from './hooks';
import { StoreProvider } from './StoreProvider';
import { navToggled } from './slices/ui';

const options = { preferenceEffects: noPreferenceEffects, analytics: discardSink };

function Probe({ id }: { id: string }) {
  const open = useAppSelector((s) => s.ui.navOpen);
  const dispatch = useAppDispatch();
  return (
    <button type="button" data-testid={id} onClick={() => dispatch(navToggled())}>
      {open ? 'open' : 'closed'}
    </button>
  );
}

describe('StoreProvider', () => {
  it('gives every provider (every request, every tab) its own store', () => {
    // Two providers stand in for two concurrent server requests. With a module-level store
    // they would share state, and one user's state would leak into another's HTML.
    render(
      <>
        <StoreProvider options={options}>
          <Probe id="a" />
        </StoreProvider>
        <StoreProvider options={options}>
          <Probe id="b" />
        </StoreProvider>
      </>,
    );
    act(() => screen.getByTestId('a').click());
    expect(screen.getByTestId('a')).toHaveTextContent('open');
    expect(screen.getByTestId('b')).toHaveTextContent('closed');
  });

  it('keeps the same store across re-renders and starts from the preloaded state', () => {
    const tree = (
      <StoreProvider options={options} preloadedState={{ ui: { theme: 'system', navOpen: true } }}>
        <Probe id="p" />
      </StoreProvider>
    );
    const { rerender } = render(tree);
    expect(screen.getByTestId('p')).toHaveTextContent('open');
    act(() => screen.getByTestId('p').click());
    rerender(tree);
    expect(screen.getByTestId('p')).toHaveTextContent('closed');
  });
});
