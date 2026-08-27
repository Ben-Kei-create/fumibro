import { getAdminInquiries } from "@/modules/contact/application/admin-inquiries";
import { updateInquiryAction } from "@/modules/contact/application/inquiry-actions";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export default async function AdminInquiriesPage() {
  const inquiries = await getAdminInquiries();
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold text-stone-500">CONTACT</p>
      <h1 className="mt-2 text-3xl font-bold text-stone-950">お問い合わせ</h1>
      <p className="mt-3 leading-7 text-stone-600">
        Contactから安全に保存された内容です。Phase
        1ではメール送信せず、ここで対応状況を管理します。
      </p>
      <div className="mt-7 space-y-5">
        {inquiries.length ? (
          inquiries.map((inquiry) => (
            <article
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
              key={inquiry.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    {inquiry.category} ·{" "}
                    {dateFormatter.format(new Date(inquiry.submittedAt))}
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-stone-950">
                    {inquiry.subject ?? "件名なし"}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {inquiry.name} · {inquiry.email}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                  {inquiry.status}
                </span>
              </div>
              <p className="mt-5 whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-sm leading-7 text-stone-700">
                {inquiry.message}
              </p>
              <form action={updateInquiryAction} className="mt-5 space-y-4">
                <input name="inquiryId" type="hidden" value={inquiry.id} />
                <div>
                  <label
                    className="text-sm font-semibold"
                    htmlFor={`status-${inquiry.id}`}
                  >
                    対応状況
                  </label>
                  <select
                    className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 sm:max-w-xs"
                    defaultValue={inquiry.status}
                    id={`status-${inquiry.id}`}
                    name="status"
                  >
                    <option value="new">new</option>
                    <option value="in_progress">in progress</option>
                    <option value="closed">closed</option>
                    <option value="spam">spam</option>
                  </select>
                </div>
                <div>
                  <label
                    className="text-sm font-semibold"
                    htmlFor={`note-${inquiry.id}`}
                  >
                    Adminメモ
                  </label>
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-lg border border-stone-300 p-3"
                    defaultValue={inquiry.adminNote}
                    id={`note-${inquiry.id}`}
                    maxLength={10000}
                    name="adminNote"
                  />
                </div>
                <button className="button-primary" type="submit">
                  保存
                </button>
              </form>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-7 text-center text-stone-600">
            お問い合わせはありません。
          </p>
        )}
      </div>
    </div>
  );
}
