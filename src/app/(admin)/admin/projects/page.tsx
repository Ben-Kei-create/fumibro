import { saveProjectAction } from "@/modules/site-admin/application/site-admin-actions";
import { getAdminProjects } from "@/modules/site-admin/application/get-site-admin-data";

export default async function AdminProjectsPage() {
  const projects = await getAdminProjects();
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold text-stone-500">PROJECT CMS</p>
      <h1 className="mt-1 text-3xl font-bold">Projects</h1>
      <p className="mt-3 text-stone-600">
        Projectを追加・編集できます。theme_keyはDB/CMSを変えず外観を差し替えるキーです。
      </p>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {[...projects, null].map((project, index) => (
          <form
            action={saveProjectAction}
            className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
            key={project?.id ?? `new-${index}`}
          >
            <input name="id" type="hidden" value={project?.id ?? ""} />
            <h2 className="font-bold">
              {project ? project.name : "新しいProject"}
            </h2>
            <label className="block text-sm font-semibold">
              名前
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                defaultValue={project?.name}
                maxLength={120}
                name="name"
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              slug
              <input
                className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-mono font-normal"
                defaultValue={project?.slug}
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              説明
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 p-3 font-normal"
                defaultValue={project?.description ?? ""}
                maxLength={5000}
                name="description"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                theme_key
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-mono font-normal"
                  defaultValue={project?.theme_key ?? "default"}
                  name="themeKey"
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                表示順
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={project?.display_order ?? 0}
                  name="displayOrder"
                  type="number"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                defaultChecked={project?.is_active ?? true}
                name="isActive"
                type="checkbox"
              />
              公開対象
            </label>
            <button className="button-primary" type="submit">
              保存
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
