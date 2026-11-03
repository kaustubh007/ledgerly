import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { Provider } from 'react-redux';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect } from 'vitest';
import { createRoutes } from '@admin/routes';
import { makeStore } from '@admin/store/store';
import { createFakeAdminApi } from './fakeAdminApi';
import { server } from './setup';

/**
 * The real route tree in a memory router, around a real store, against the fake API. What the
 * app does on a URL, without a browser: loaders, guards, actions, lazy routes and errorElements.
 */
export function renderApp(
  path: string,
  setup: (fake: ReturnType<typeof createFakeAdminApi>) => void = () => undefined,
) {
  const fake = createFakeAdminApi();
  setup(fake);
  server.use(...fake.handlers);
  const store = makeStore({ onSignedOut: () => void router.navigate('/sign-in') });
  const router = createMemoryRouter(createRoutes(store), { initialEntries: [path] });
  // No delay between keystrokes: the tests type a lot, and timing is not what they test.
  const user = userEvent.setup({ delay: null });
  const view = render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  );
  return { ...view, fake, store, router, user };
}

/** axe in jsdom: everything except colour contrast, which needs real layout (Playwright checks it). */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
