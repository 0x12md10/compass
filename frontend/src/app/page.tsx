export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-24 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          AI Analytics Copilot
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Ask your database a question in plain English.
        </p>
        <p className="text-sm text-zinc-400 dark:text-zinc-600">
          Scaffolding only — the ask bar ships in Phase 5 (see BUILD_PLAN.md).
        </p>
      </main>
    </div>
  );
}
