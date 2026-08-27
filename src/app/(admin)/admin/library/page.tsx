import Link from "next/link";

import { setContentTrashAction } from "@/modules/blog/application/post-actions";
import { getAdminContentList } from "@/modules/content-admin/application/admin-public-content";

export default async function AdminLibraryPage() {
  const items = await getAdminContentList("library");
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-500">LIBRARY CMS</p>
          <h1 className="mt-1 text-3xl font-bold">Library</h1>
        </div>
        <Link className="button-primary" href="/admin/library/new">
          新しい項目
        </Link>
      </div>
      <div className="mt-7 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="p-4">項目</th>
              <th className="p-4">状態</th>
              <th className="p-4">公開日時</th>
              <th className="p-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-4">
                  <p className="font-semibold">{item.title}</p>
                  <code className="text-xs text-stone-500">{item.slug}</code>
                </td>
                <td className="p-4">{item.status}</td>
                <td className="p-4">{item.publishAt ?? "—"}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      className="font-semibold"
                      href={`/admin/library/${item.id}/edit`}
                    >
                      編集
                    </Link>
                    <Link href={`/admin/content/${item.id}/revisions`}>
                      Revision
                    </Link>
                    <form action={setContentTrashAction}>
                      <input name="contentId" type="hidden" value={item.id} />
                      <input
                        name="expectedLockVersion"
                        type="hidden"
                        value={item.lockVersion}
                      />
                      <input name="mode" type="hidden" value="trash" />
                      <input name="returnTo" type="hidden" value="library" />
                      <button className="text-red-700" type="submit">
                        Trash
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <p className="p-6 text-stone-600">Library項目はまだありません。</p>
        ) : null}
      </div>
    </div>
  );
}
