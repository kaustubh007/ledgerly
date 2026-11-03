import '@ledgerly/ui/base.scss';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createRoutes } from './routes';
import { makeStore } from './store/store';

// The store needs to navigate when a session ends, and the router needs the store for its
// loaders: create the store with a callback that reaches the router once it exists.
const store = makeStore({ onSignedOut: () => void router.navigate('/sign-in') });
const router = createBrowserRouter(createRoutes(store));

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');
createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
);
