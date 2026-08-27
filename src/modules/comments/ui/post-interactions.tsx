"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function LikeButton({
  initialTotal,
  postId,
}: {
  initialTotal: number;
  postId: string;
}) {
  const [total, setTotal] = useState(initialTotal);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  async function like() {
    setPending(true);
    try {
      const response = await fetch(`/api/posts/${postId}/likes`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        accepted?: boolean;
        total?: number;
      };
      if (!response.ok) {
        setMessage(
          response.status === 429
            ? "少し時間をおいてください。"
            : "現在👍できません。",
        );
        return;
      }
      if (typeof data.total === "number") setTotal(data.total);
      setMessage(
        data.accepted ? "ありがとう！" : "このブラウザからは👍済みです。",
      );
    } catch {
      setMessage("現在👍できません。");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button
        className="button-secondary"
        disabled={pending}
        onClick={() => void like()}
        type="button"
      >
        👍 {total}
      </button>
      {message ? (
        <p aria-live="polite" className="mt-2 text-xs text-stone-600">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function CommentForm({ postId }: { postId: string }) {
  const router = useRouter();
  const startedAt = useRef<number | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        body: JSON.stringify({
          body: data.get("body"),
          displayName: data.get("displayName"),
          startedAt: startedAt.current ?? Date.now(),
          website: data.get("website"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };
      setMessage(
        result.message ??
          (response.ok ? "送信しました。" : "送信できませんでした。"),
      );
      if (response.ok) {
        form.reset();
        startedAt.current = Date.now();
        router.refresh();
      }
    } catch {
      setMessage("通信に失敗しました。");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white p-5"
      onFocusCapture={() => {
        startedAt.current ??= Date.now();
      }}
      onSubmit={submit}
    >
      <label className="block text-sm font-semibold">
        表示名
        <input
          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3 font-normal"
          maxLength={80}
          name="displayName"
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        コメント
        <textarea
          className="mt-2 min-h-32 w-full rounded-lg border border-stone-300 p-3 font-normal"
          maxLength={5000}
          name="body"
          required
        />
      </label>
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        <label htmlFor={`comment-website-${postId}`}>Website</label>
        <input
          autoComplete="off"
          id={`comment-website-${postId}`}
          name="website"
          tabIndex={-1}
        />
      </div>
      <button className="button-primary" disabled={pending} type="submit">
        {pending ? "送信中…" : "コメントする"}
      </button>
      {message ? (
        <p aria-live="polite" className="text-sm text-stone-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
