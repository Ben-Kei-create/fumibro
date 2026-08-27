import Link from "next/link";

import { setContentTrashAction } from "@/modules/blog/application/post-actions";
import { getAdminContentList } from "@/modules/content-admin/application/admin-public-content";

export default async function AdminWorksPage() {
  const works = await getAdminContentList("work");
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-500">WORKS CMS</p>
          <h1 className="mt-1 text-3xl font-bold">Works</h1>
        </div>
        <Link className="button-primary" href="/admin/works/new">
          新しい作品
        </Link>
      </div>
      <div className="mt-7 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="p-4">作品</th>
              <th className="p-4">状態</th>
              <th className="p-4">公開日時</th>
              <th className="p-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {works.map((work) => (
              <tr key={work.id}>
                <td className="p-4">
                  <p className="font-semibold">{work.title}</p>
                  <code className="text-xs text-stone-500">{work.slug}</code>
                </td>
                <td className="p-4">{work.status}</td>
                <td className="p-4">{work.publishAt ?? "—"}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      className="font-semibold"
                      href={`/admin/works/${work.id}/edit`}
                    >
                      編集
                    </Link>
                    <Link href={`/admin/content/${work.id}/revisions`}>
                      Revision
                    </Link>
                    <form action={setContentTrashAction}>
                      <input name="contentId" type="hidden" value={work.id} />
                      <input
                        name="expectedLockVersion"
                        type="hidden"
                        value={work.lockVersion}
                      />
                      <input name="mode" type="hidden" value="trash" />
                      <input name="returnTo" type="hidden" value="works" />
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
        {!works.length ? (
          <p className="p-6 text-stone-600">作品はまだありません。</p>
        ) : null}
      </div>
    </div>
  );
}
