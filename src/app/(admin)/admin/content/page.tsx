import Link from "next/link";

export default function AdminContentPage() {
  return (
    <div>
      <p className="text-sm font-semibold text-stone-500">CANONICAL CONTENT</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">Content</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
        Blog・Works・Library・Pagesは同じcontent_itemsを正本として管理します。
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/posts"
        >
          <h2 className="font-semibold text-stone-950">Blog</h2>
          <p className="mt-1 text-sm text-stone-600">
            新規・編集・予約・Revision
          </p>
        </Link>
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/notices"
        >
          <h2 className="font-semibold text-stone-950">掲示板</h2>
          <p className="mt-1 text-sm text-stone-600">Home固定掲示・表示期間</p>
        </Link>
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/business-cards"
        >
          <h2 className="font-semibold text-stone-950">名刺</h2>
          <p className="mt-1 text-sm text-stone-600">About・PNG・vCard</p>
        </Link>
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/works"
        >
          <h2 className="font-semibold text-stone-950">Works / Portfolio</h2>
          <p className="mt-1 text-sm text-stone-600">
            作品正本・Home掲載・Portfolio投影
          </p>
        </Link>
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/library"
        >
          <h2 className="font-semibold text-stone-950">Library</h2>
          <p className="mt-1 text-sm text-stone-600">
            Access policy・表紙・配布基盤
          </p>
        </Link>
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/pages"
        >
          <h2 className="font-semibold text-stone-950">Pages</h2>
          <p className="mt-1 text-sm text-stone-600">
            About・Privacy・Revision
          </p>
        </Link>
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/media"
        >
          <h2 className="font-semibold text-stone-950">Media</h2>
          <p className="mt-1 text-sm text-stone-600">元画像と処理済みvariant</p>
        </Link>
        <Link
          className="rounded-xl border border-stone-200 bg-white p-5 hover:border-stone-400"
          href="/admin/trash"
        >
          <h2 className="font-semibold text-stone-950">Trash</h2>
          <p className="mt-1 text-sm text-stone-600">
            復元・明示確認付き完全削除
          </p>
        </Link>
      </div>
    </div>
  );
}
