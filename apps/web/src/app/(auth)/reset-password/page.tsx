import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
import { resetPasswordAction } from '../actions';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <p className="text-sm text-slate-600">
        This link is incomplete.{' '}
        <Link href="/forgot-password" className="link">
          Ask for a new one
        </Link>
        .
      </p>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">You’ll be logged out on all other devices.</p>
      <ActionForm action={resetPasswordAction} submit="Save password" className="space-y-4" buttonClass="btn w-full">
        <input type="hidden" name="token" value={token} />
        <Field name="password" label="New password" type="password" autoComplete="new-password" minLength={8} required />
        <Field name="confirm" label="Repeat new password" type="password" autoComplete="new-password" minLength={8} required />
      </ActionForm>
    </>
  );
}
