import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-3xl">Page not found</h1>
      <Link href="/" className="font-semibold text-teal-700">Go to IND2B home</Link>
    </main>
  );
}
