import type { AnchorHTMLAttributes } from 'react';
import { vi } from 'vitest';

// Next's router needs the App Router mounted; in unit tests we stand in for it.
export const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
export const nav = { pathname: '/en/o/acme', search: new URLSearchParams() };

export const nextNavigationMock = {
  useRouter: () => router,
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.search,
};

export const i18nNavigationMock = {
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={`/en${href}`} {...props}>
      {children}
    </a>
  ),
  usePathname: () => nav.pathname.replace(/^\/[a-z]{2}/, ''),
  useRouter: () => router,
};
