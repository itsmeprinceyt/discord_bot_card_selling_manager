export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center  font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="space-x-2  text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Discord Bot Card Selling Manager
            <br />
            <code className="rounded bg-black/10 font-normal px-1.5 py-0.5 font-mono text-[0.9em] ">
              Work in progress
            </code>{" "}
            <span className="animate-pulse">.</span>
          </h1>
        </div>
      </main>
    </div>
  );
}
