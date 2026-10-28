import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware Link, redirect and router: `href="/o"` becomes `/de/o` for a German user.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
