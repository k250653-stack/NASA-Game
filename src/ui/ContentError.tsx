/** Full-screen panel shown when a content JSON file fails validation at startup. */
export function ContentError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-6 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-danger">Content error</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-50">A content file failed validation</h1>
      <p className="mt-3 text-slate-400">
        Fix the field named below in <code className="text-accent">src/content/</code> and reload.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-lg border border-danger/40 bg-space-900 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-red-200">
        {message}
      </pre>
    </main>
  )
}
