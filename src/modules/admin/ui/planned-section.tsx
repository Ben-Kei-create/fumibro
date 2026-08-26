import Link from "next/link";

type PlannedAdminSectionProps = {
  description: string;
  milestone: string;
  title: string;
};

export function PlannedAdminSection({
  description,
  milestone,
  title,
}: PlannedAdminSectionProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold text-stone-500">{milestone}</p>
      <h1 className="mt-2 text-3xl font-bold text-stone-950">{title}</h1>
      <p className="mt-4 leading-7 text-stone-600">{description}</p>
      <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-600">
        現在は導線のみです。機能が入るまで、この画面からデータ変更は行いません。
      </p>
      <Link className="button-secondary mt-6" href="/admin">
        Dashboardへ戻る
      </Link>
    </div>
  );
}
