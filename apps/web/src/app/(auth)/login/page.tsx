import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/ui';
import { getUser } from '@/lib/auth';
import { loginAction } from '../actions';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage() {
  if (await getUser()) redirect('/dashboard');
  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-slate-500">Log in to your account.</p>
      <ActionForm action={loginAction} submit="Log in" className="space-y-4" buttonClass="btn w-full">
        <Field name="email" label="Email" type="email" autoComplete="email" required />
        <Field name="password" label="Password" type="password" autoComplete="current-password" required />
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="link">
            Forgot password?
          </Link>
        </p>
      </ActionForm>
      <p className="mt-8 text-sm text-slate-600">
        New here?{' '}
        <Link href="/signup" className="link">
          Create an account
        </Link>
      </p>
    </>
  );
}
