"use client";

import { useRef } from "react";

import type { PublicBusinessCardDto } from "@/modules/public-content/application/public-content-dto";

export function BusinessCardDialog({ card }: { card: PublicBusinessCardDto }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="button-secondary"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        名刺を見る
      </button>
      <dialog
        aria-labelledby="business-card-title"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-stone-200 bg-white p-0 text-stone-950 shadow-2xl backdrop:bg-stone-950/50"
        ref={dialogRef}
      >
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-stone-500">
            BUSINESS CARD
          </p>
          <h2 className="mt-3 text-3xl font-bold" id="business-card-title">
            {card.displayName}
          </h2>
          {card.organization || card.jobTitle ? (
            <p className="mt-2 text-stone-600">
              {[card.organization, card.jobTitle].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <dl className="mt-6 space-y-3 text-sm">
            {card.email ? (
              <div>
                <dt className="font-semibold text-stone-500">Email</dt>
                <dd>{card.email}</dd>
              </div>
            ) : null}
            {card.phone ? (
              <div>
                <dt className="font-semibold text-stone-500">Phone</dt>
                <dd>{card.phone}</dd>
              </div>
            ) : null}
            {card.website ? (
              <div>
                <dt className="font-semibold text-stone-500">Website</dt>
                <dd>{card.website}</dd>
              </div>
            ) : null}
            {card.address ? (
              <div>
                <dt className="font-semibold text-stone-500">Address</dt>
                <dd>{card.address}</dd>
              </div>
            ) : null}
          </dl>
          {card.note ? (
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-stone-600">
              {card.note}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-3">
            {card.pngAvailable ? (
              <a
                className="button-primary"
                download
                href={`/api/business-cards/${card.slug}/png`}
              >
                PNG
              </a>
            ) : null}
            <a
              className="button-secondary"
              download
              href={`/api/business-cards/${card.slug}/vcard`}
            >
              vCard
            </a>
            <form method="dialog">
              <button className="button-secondary" type="submit">
                閉じる
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
