"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ContactCategory = { id: string; label: string; slug: string };

export function ContactForm({ categories }: { categories: ContactCategory[] }) {
  const startedAt = useRef<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/contact", {
        body: JSON.stringify({
          categoryId: data.get("categoryId"),
          email: data.get("email"),
          message: data.get("message"),
          name: data.get("name"),
          startedAt: startedAt.current ?? Date.now(),
          subject: data.get("subject"),
          website: data.get("website"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        message?: string;
        ok?: boolean;
      };
      if (!response.ok) {
        setMessage(result.message ?? "送信できませんでした。");
        return;
      }
      form.reset();
      startedAt.current = null;
      setMessage("お問い合わせを受け付けました。Adminで確認します。");
    } catch {
      setMessage("通信に失敗しました。時間をおいてお試しください。");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form
      className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      onFocusCapture={() => {
        startedAt.current ??= Date.now();
      }}
      onSubmit={submit}
    >
      <div>
        <label className="text-sm font-semibold" htmlFor="contact-category">
          問い合わせ種別
        </label>
        <select
          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
          id="contact-category"
          name="categoryId"
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold" htmlFor="contact-name">
            お名前
          </label>
          <input
            autoComplete="name"
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3"
            id="contact-name"
            maxLength={120}
            name="name"
            required
          />
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="contact-email">
            メールアドレス
          </label>
          <input
            autoComplete="email"
            className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3"
            id="contact-email"
            maxLength={254}
            name="email"
            required
            type="email"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold" htmlFor="contact-subject">
          件名（任意）
        </label>
        <input
          className="mt-2 min-h-11 w-full rounded-lg border border-stone-300 px-3"
          id="contact-subject"
          maxLength={240}
          name="subject"
        />
      </div>
      <div>
        <label className="text-sm font-semibold" htmlFor="contact-message">
          本文
        </label>
        <textarea
          className="mt-2 min-h-48 w-full rounded-lg border border-stone-300 p-3"
          id="contact-message"
          maxLength={10000}
          name="message"
          required
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        <label htmlFor="contact-website">Website</label>
        <input
          autoComplete="off"
          id="contact-website"
          name="website"
          tabIndex={-1}
        />
      </div>
      <button className="button-primary" disabled={isSending} type="submit">
        {isSending ? "送信中…" : "送信する"}
      </button>
      {message ? (
        <p aria-live="polite" className="text-sm leading-6 text-stone-700">
          {message}
        </p>
      ) : null}
    </form>
  );
}
