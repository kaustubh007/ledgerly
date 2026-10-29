import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SignInForm } from '@web/features/auth/SignInForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'auth' }))('signInTitle') };
}

export default async function SignInPage() {
  const t = await getTranslations('auth');
  return (
    <>
      <h1>{t('signInTitle')}</h1>
      {/* useSearchParams (for ?next=) needs a Suspense boundary to keep the page static. */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </>
  );
}
