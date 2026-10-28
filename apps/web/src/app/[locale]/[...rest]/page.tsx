import { notFound } from 'next/navigation';

// Unknown paths inside a locale render the localised not-found page instead of Next's default.
export default function CatchAll() {
  notFound();
}
