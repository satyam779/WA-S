import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { signupAction } from '../actions';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignupPage() {
  if (await getUser()) redirect('/dashboard');
  return (
    <>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Free to start. No card needed.</p>
      <ActionForm action={signupAction} submit="Create account" className="space-y-4" buttonClass="btn w-full">
        <Field name="name" label="Your name" autoComplete="name" required />
        <Field name="company" label="Business name" autoComplete="organization" required />
        <Field name="email" label="Work email" type="email" autoComplete="email" required />
        <Field name="password" label="Password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters" required />
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="terms" className="mt-1" required />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="link" target="_blank">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="link" target="_blank">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </ActionForm>
      <p className="mt-8 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </>
  );
}
