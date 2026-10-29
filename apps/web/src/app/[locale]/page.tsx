import { redirect } from 'next/navigation';

/** `/en` → `/en/o`, which picks the organisation (or restores or asks for a session). */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/o`);
}
