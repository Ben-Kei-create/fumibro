import {
  saveCommentApprovalModeAction,
  saveTaxonomyAction,
} from "@/modules/site-admin/application/site-admin-actions";
import { getAdminTaxonomies } from "@/modules/site-admin/application/get-site-admin-data";

type TaxonomyItem = {
  display_order: number;
  id: string;
  is_active: boolean;
  label: string;
  slug: string;
  icon_key?: string | null;
};

function TaxonomySection({
  kind,
  items,
  title,
}: {
  kind: "category" | "tag";
  items: TaxonomyItem[];
  title: string;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 space-y-3">
        {[...items, null].map((item, index) => (
          <form
            action={saveTaxonomyAction}
            className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
            key={item?.id ?? `new-${kind}-${index}`}
          >
            <input name="id" type="hidden" value={item?.id ?? ""} />
            <input name="kind" type="hidden" value={kind} />
            <input
              aria-label="表示名"
              className="min-h-11 rounded-lg border border-stone-300 px-3 lg:col-span-2"
              defaultValue={item?.label}
              name="label"
              placeholder="表示名"
              required
            />
            <input
              aria-label="slug"
              className="min-h-11 rounded-lg border border-stone-300 px-3 font-mono"
              defaultValue={item?.slug}
              name="slug"
              placeholder="slug"
              required
            />
            {kind === "category" ? (
              <input
                aria-label="icon key"
                className="min-h-11 rounded-lg border border-stone-300 px-3 font-mono"
                defaultValue={item?.icon_key ?? ""}
                name="iconKey"
                placeholder="icon_key"
              />
            ) : (
              <input name="iconKey" type="hidden" value="" />
            )}
            <input
              aria-label="表示順"
              className="min-h-11 rounded-lg border border-stone-300 px-3"
              defaultValue={item?.display_order ?? 0}
              name="displayOrder"
              type="number"
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  defaultChecked={item?.is_active ?? true}
                  name="isActive"
                  type="checkbox"
                />
                有効
              </label>
              <button className="button-secondary" type="submit">
                保存
              </button>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}

export default async function AdminSettingsPage() {
  const data = await getAdminTaxonomies();
  const tags = data.tags.map((item) => ({ ...item, label: item.label }));
  const categories = data.categories.map((item) => ({
    ...item,
    label: item.label,
  }));
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold text-stone-500">SITE SETTINGS</p>
      <h1 className="mt-1 text-3xl font-bold">分類と場所</h1>
      <div className="mt-8 space-y-10">
        <section>
          <h2 className="text-xl font-bold">コメント公開方式</h2>
          <form
            action={saveCommentApprovalModeAction}
            className="mt-4 flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-sm font-semibold">
              公開方式
              <select
                className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal"
                defaultValue={data.commentApprovalMode}
                name="mode"
              >
                <option value="approval">承認後に公開</option>
                <option value="immediate">すぐ公開</option>
              </select>
            </label>
            <button className="button-secondary" type="submit">
              保存
            </button>
          </form>
        </section>
        <TaxonomySection
          items={categories}
          kind="category"
          title="投稿ジャンル"
        />
        <TaxonomySection items={tags} kind="tag" title="ハッシュタグ" />
        <section>
          <h2 className="text-xl font-bold">場所</h2>
          <p className="mt-2 text-sm text-stone-600">
            Maps APIは使わず、検索文字列から通常のGoogle Maps URLを生成します。
          </p>
          <div className="mt-4 space-y-3">
            {[...data.locations, null].map((item, index) => (
              <form
                action={saveTaxonomyAction}
                className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
                key={item?.id ?? `new-location-${index}`}
              >
                <input name="id" type="hidden" value={item?.id ?? ""} />
                <input name="kind" type="hidden" value="location" />
                <input
                  className="min-h-11 rounded-lg border border-stone-300 px-3 lg:col-span-2"
                  defaultValue={item?.display_name}
                  name="label"
                  placeholder="表示名"
                  required
                />
                <input
                  className="min-h-11 rounded-lg border border-stone-300 px-3 lg:col-span-2"
                  defaultValue={item?.maps_query}
                  name="mapsQuery"
                  placeholder="Maps検索文字列"
                  required
                />
                <input
                  className="min-h-11 rounded-lg border border-stone-300 px-3"
                  defaultValue={item?.display_order ?? 0}
                  name="displayOrder"
                  type="number"
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      defaultChecked={item?.is_active ?? true}
                      name="isActive"
                      type="checkbox"
                    />
                    有効
                  </label>
                  <button className="button-secondary" type="submit">
                    保存
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
