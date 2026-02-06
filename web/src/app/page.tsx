export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-col items-center justify-center gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">BlockBot</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          AI-powered project management for teams
        </p>
      </main>
    </div>
  );
}
