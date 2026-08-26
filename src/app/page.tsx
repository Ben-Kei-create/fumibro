import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-10 sm:px-8 sm:py-16">
      <p className="text-sm font-semibold tracking-[0.22em] text-stone-500">
        PERSONAL MEDIA &amp; PROJECT HUB
      </p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-stone-950 sm:text-6xl">
        FUMIBRO
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
        日々の記録、制作物、教材、出版、アプリを一つの場所から届けます。
        現在、長期運用できる専用CMSのPhase 1を構築中です。
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link className="button-primary" href="/blog">
          Blogを見る
        </Link>
        <Link className="button-secondary" href="/projects">
          Projects
        </Link>
      </div>
    </main>
  );
}
