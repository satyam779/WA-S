import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
import { requestResetAction } from '../actions';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Enter your email and we’ll send you a link to choose a new password.</p>
      <ActionForm action={requestResetAction} submit="Send reset link" className="space-y-4" buttonClass="btn w-full">
        <Field name="email" label="Email" type="email" autoComplete="email" required />
      </ActionForm>
      <p className="mt-8 text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </>
  );
}
