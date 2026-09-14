import type { Metadata } from "next";
import Link from "next/link";

import {
  convertAiHandoffAction,
  ignoreAiHandoffAction,
} from "@/modules/ai-handoff/application/ai-handoff-actions";
import { getAdminAiHandoffs } from "@/modules/ai-handoff/application/get-admin-ai-handoffs";
import {
  aiHandoffStatusSchema,
  aiHandoffStatuses,
  getAiHandoffDestinationLabel,
  getConvertedContentAdminPath,
} from "@/modules/ai-handoff/domain/ai-handoff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Handoff Inbox",
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

export default async function AdminAiInboxPage({
  searchParams,
}: PageProps<"/admin/ai-inbox">) {
  const parameters = await searchParams;
  const parsedStatus = aiHandoffStatusSchema.safeParse(parameters.status);
  const { handoffs, hasError, projects } = await getAdminAiHandoffs(
    parsedStatus.success ? parsedStatus.data : undefined,
  );
  const saved = typeof parameters.saved === "string" ? parameters.saved : null;
  const error = typeof parameters.error === "string" ? parameters.error : null;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold text-stone-500">HUMAN REVIEW</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">
        AI Handoff Inbox
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-stone-600">
        ChatGPTやGemini等から届いた候補を確認し、公開せず下書きへ変換します。候補はAdminが判断するまでpendingのままです。
      </p>

      <nav aria-label="AI Inbox status" className="mt-6 flex flex-wrap gap-2">
        <Link className="button-secondary" href="/admin/ai-inbox">
          すべて
        </Link>
        {aiHandoffStatuses.map((status) => (
          <Link
            className="button-secondary"
            href={`/admin/ai-inbox?status=${status}`}
            key={status}
          >
            {status}
          </Link>
        ))}
      </nav>

      {saved ? (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {saved === "ignored"
            ? "候補を無視しました。"
            : `${saved}の下書きを作成しました。`}
        </p>
      ) : null}
      {error || hasError ? (
        <p
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {hasError
            ? "AI Inboxを取得できませんでした。Supabase接続を確認してください。"
            : "処理できませんでした。候補の入力内容と状態を確認してください。"}
        </p>
      ) : null}

      <div className="mt-7 space-y-6">
        {handoffs.length ? (
          handoffs.map((handoff) => {
            const convertedPath = getConvertedContentAdminPath(
              handoff.suggestedDestination,
              handoff.contentItemId,
              handoff.noticeId,
            );
            const isReviewable =
              handoff.status === "pending" || handoff.status === "error";

            return (
              <article
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"
                key={handoff.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {handoff.sourceSystem} · {handoff.sourceExternalId}
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-stone-950">
                      {handoff.suggestedTitle ??
                        handoff.sourceTitle ??
                        "タイトルなし"}
                    </h2>
                    <p className="mt-2 text-sm text-stone-600">
                      受信 {dateFormatter.format(new Date(handoff.createdAt))}
                      {handoff.sourceDate
                        ? ` · 出所 ${dateFormatter.format(new Date(handoff.sourceDate))}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                    {handoff.status}
                  </span>
                </div>

                <dl className="mt-5 grid gap-3 rounded-xl bg-stone-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-stone-700">提案先</dt>
                    <dd className="mt-1 text-stone-600">
                      {getAiHandoffDestinationLabel(
                        handoff.suggestedDestination,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-stone-700">Project</dt>
                    <dd className="mt-1 text-stone-600">
                      {handoff.projectName ?? "指定なし"}
                    </dd>
                  </div>
                </dl>

                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-stone-700">
                  {handoff.suggestedBody ?? "本文候補はありません。"}
                </p>

                <div className="mt-5 flex flex-wrap gap-4 text-sm">
                  {handoff.sourceUrl ? (
                    <a
                      className="underline"
                      href={handoff.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      元データを開く
                    </a>
                  ) : null}
                  {handoff.suggestedPublicUrl ? (
                    <a
                      className="underline"
                      href={handoff.suggestedPublicUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      提案URLを開く
                    </a>
                  ) : null}
                  {convertedPath ? (
                    <Link
                      className="font-semibold underline"
                      href={convertedPath}
                    >
                      作成した下書きを編集
                    </Link>
                  ) : null}
                </div>

                {handoff.lastError ? (
                  <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                    {handoff.lastError}
                  </p>
                ) : null}

                <details className="mt-5 rounded-lg border border-stone-200 p-3 text-sm">
                  <summary className="cursor-pointer font-semibold">
                    受信payload
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs text-stone-600">
                    {JSON.stringify(handoff.payload, null, 2)}
                  </pre>
                </details>

                {isReviewable ? (
                  <div className="mt-6 border-t border-stone-200 pt-5">
                    <form action={convertAiHandoffAction} className="space-y-4">
                      <input
                        name="handoffId"
                        type="hidden"
                        value={handoff.id}
                      />
                      <div>
                        <label
                          className="text-sm font-semibold"
                          htmlFor={`project-${handoff.id}`}
                        >
                          変換先Project
                        </label>
                        <select
                          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 sm:max-w-sm"
                          defaultValue={handoff.projectId ?? ""}
                          id={`project-${handoff.id}`}
                          name="projectId"
                        >
                          <option value="">指定なし</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="button-secondary"
                          name="destination"
                          type="submit"
                          value="blog"
                        >
                          Blog下書きへ
                        </button>
                        <button
                          className="button-secondary"
                          name="destination"
                          type="submit"
                          value="works"
                        >
                          Worksへ
                        </button>
                        <button
                          className="button-secondary"
                          name="destination"
                          type="submit"
                          value="library"
                        >
                          Libraryへ
                        </button>
                        <button
                          className="button-secondary"
                          name="destination"
                          type="submit"
                          value="portfolio"
                        >
                          Portfolioへ
                        </button>
                        <button
                          className="button-secondary"
                          name="destination"
                          type="submit"
                          value="notice"
                        >
                          掲示板へ
                        </button>
                      </div>
                    </form>
                    <form action={ignoreAiHandoffAction} className="mt-3">
                      <input
                        name="handoffId"
                        type="hidden"
                        value={handoff.id}
                      />
                      <button
                        className="text-sm text-stone-600 underline"
                        type="submit"
                      >
                        無視
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
            該当するAI handoffはありません。
          </p>
        )}
      </div>
    </div>
  );
}
