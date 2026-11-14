/** Full-screen panel shown when a content JSON file fails validation at startup. */
export function ContentError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-6 py-10">
      <p className="font-mono text-xs tracking-[0.3em] text-danger uppercase">Content error</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-primary">
        A content file failed validation
      </h1>
      <p className="mt-3 text-muted">
        Fix the field named below in <code className="text-accent">src/content/</code> and reload.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-lg border border-danger/40 bg-panel p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-danger">
        {message}
      </pre>
    </main>
  )
}
