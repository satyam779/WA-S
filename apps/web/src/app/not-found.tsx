import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <div className="flex gap-3">
        <Link href="/" className="btn-ghost">
          Home page
        </Link>
        <Link href="/dashboard" className="btn">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
