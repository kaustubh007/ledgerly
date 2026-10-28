import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SignUpForm } from '@web/features/auth/SignUpForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'auth' }))('signUpTitle') };
}

export default async function SignUpPage() {
  const t = await getTranslations('auth');
  return (
    <>
      <h1>{t('signUpTitle')}</h1>
      <SignUpForm />
    </>
  );
}
