import { ImageUploader } from "@/modules/media/ui/image-uploader";
import { saveBusinessCardAction } from "@/modules/site-admin/application/site-admin-actions";
import { getAdminBusinessCards } from "@/modules/site-admin/application/get-site-admin-data";

export default async function AdminBusinessCardsPage() {
  const cards = await getAdminBusinessCards();
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold text-stone-500">PROFILE ASSET</p>
      <h1 className="mt-1 text-3xl font-bold">名刺</h1>
      <p className="mt-3 text-stone-600">
        Aboutの名刺モーダル、PNG、vCardへ反映します。将来複数名刺へ拡張できます。
      </p>
      <div className="mt-7 space-y-6">
        {[...cards, null].map((card, index) => (
          <form
            action={saveBusinessCardAction}
            className="space-y-5 rounded-xl border border-stone-200 bg-white p-5 sm:p-6"
            key={card?.id ?? `new-${index}`}
          >
            <input name="id" type="hidden" value={card?.id ?? ""} />
            <h2 className="text-xl font-bold">
              {card?.display_name ?? "新しい名刺"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                表示名
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={card?.display_name}
                  name="displayName"
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                slug
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-mono font-normal"
                  defaultValue={card?.slug}
                  name="slug"
                  required
                />
              </label>
              <label className="text-sm font-semibold">
                組織
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={card?.organization ?? ""}
                  name="organization"
                />
              </label>
              <label className="text-sm font-semibold">
                肩書き
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={card?.job_title ?? ""}
                  name="jobTitle"
                />
              </label>
              <label className="text-sm font-semibold">
                Email
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={card?.email ?? ""}
                  name="email"
                  type="email"
                />
              </label>
              <label className="text-sm font-semibold">
                Phone
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={card?.phone ?? ""}
                  name="phone"
                />
              </label>
              <label className="text-sm font-semibold">
                Website
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={card?.website ?? ""}
                  name="website"
                  type="url"
                />
              </label>
              <label className="text-sm font-semibold">
                住所
                <input
                  className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
                  defaultValue={card?.address ?? ""}
                  name="address"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              備考
              <textarea
                className="mt-2 min-h-24 w-full rounded-lg border border-stone-300 p-3 font-normal"
                defaultValue={card?.note ?? ""}
                name="note"
              />
            </label>
            <ImageUploader initialImage={card?.image} />
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  defaultChecked={card?.is_primary}
                  name="isPrimary"
                  type="checkbox"
                />
                Primary
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  defaultChecked={card?.is_published}
                  name="isPublished"
                  type="checkbox"
                />
                公開
              </label>
              <label className="text-sm font-semibold">
                表示順
                <input
                  className="ml-2 w-24 rounded border border-stone-300 px-2 py-1 font-normal"
                  defaultValue={card?.display_order ?? 0}
                  name="displayOrder"
                  type="number"
                />
              </label>
            </div>
            <button className="button-primary" type="submit">
              保存
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
