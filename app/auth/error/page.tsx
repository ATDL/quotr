export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="card text-center">
        <h1 className="text-2xl font-bold tracking-tight">Link expired</h1>
        <p className="mt-3 text-sm text-fog">
          That sign-in link didn&rsquo;t work — it may have expired or already
          been used. Request a fresh one and you&rsquo;ll be back in.
        </p>
        <a href="/login" className="btn-primary mt-6 inline-flex">
          Back to sign in
        </a>
      </div>
    </main>
  );
}
