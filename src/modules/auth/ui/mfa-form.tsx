"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type MfaFormProps = {
  nextPath: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MfaForm({ nextPath }: MfaFormProps) {
  const [factorId, setFactorId] = useState<string>();
  const [enrollment, setEnrollment] = useState<Enrollment>();
  const [hasIncompleteEnrollment, setHasIncompleteEnrollment] = useState(false);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;

    async function loadFactors() {
      const supabase = createBrowserSupabaseClient();
      const result = await supabase.auth.mfa.listFactors();

      if (!isCurrent) {
        return;
      }

      if (result.error) {
        setError(
          "認証器の状態を確認できませんでした。もう一度お試しください。",
        );
      } else {
        const verifiedFactor = result.data.totp.find(
          (factor) => factor.status === "verified",
        );
        const incompleteFactor = result.data.all.find(
          (factor) =>
            factor.factor_type === "totp" && factor.status === "unverified",
        );
        setFactorId(verifiedFactor?.id ?? incompleteFactor?.id);
        setHasIncompleteEnrollment(
          Boolean(!verifiedFactor && incompleteFactor),
        );
      }

      setIsLoading(false);
    }

    void loadFactors();

    return () => {
      isCurrent = false;
    };
  }, []);

  async function enroll() {
    setError(undefined);
    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const result = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "FUMIBRO Admin",
    });

    if (result.error) {
      setError("TOTPの設定を開始できませんでした。");
    } else {
      setFactorId(result.data.id);
      setHasIncompleteEnrollment(true);
      setEnrollment({
        factorId: result.data.id,
        qrCode: result.data.totp.qr_code,
        secret: result.data.totp.secret,
      });
    }

    setIsSubmitting(false);
  }

  async function restartEnrollment() {
    if (!factorId || !hasIncompleteEnrollment) {
      return;
    }

    setError(undefined);
    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const result = await supabase.auth.mfa.unenroll({ factorId });

    if (result.error) {
      setError("未完了のTOTP設定を解除できませんでした。");
      setIsSubmitting(false);
      return;
    }

    setFactorId(undefined);
    setEnrollment(undefined);
    setHasIncompleteEnrollment(false);
    setIsSubmitting(false);
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("認証アプリに表示された6桁のコードを入力してください。");
      return;
    }

    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const result = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (result.error) {
      setError("コードを確認できませんでした。新しいコードでお試しください。");
      setIsSubmitting(false);
      return;
    }

    window.location.assign(nextPath);
  }

  if (isLoading) {
    return <p className="text-sm text-stone-600">認証器を確認しています…</p>;
  }

  if (!factorId) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-stone-600">
          初回のみ、認証アプリへFUMIBROを登録します。
        </p>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="button-primary w-full"
          disabled={isSubmitting}
          onClick={() => void enroll()}
          type="button"
        >
          {isSubmitting ? "準備中…" : "TOTPを設定"}
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void verify(event)}>
      {enrollment ? (
        <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">
            QRコードを認証アプリで読み取ってください
          </p>
          <Image
            alt="FUMIBRO Admin TOTP QRコード"
            className="mx-auto rounded-lg bg-white"
            height={220}
            src={enrollment.qrCode}
            unoptimized
            width={220}
          />
          <details className="text-sm text-stone-600">
            <summary className="cursor-pointer">手動入力用キー</summary>
            <code className="mt-2 block break-all rounded bg-white p-2 text-xs">
              {enrollment.secret}
            </code>
          </details>
        </div>
      ) : null}

      {hasIncompleteEnrollment && !enrollment ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p>
            前回のTOTP設定が未完了です。すでに認証アプリへ登録済みなら、表示されるコードで続行できます。
          </p>
          <button
            className="mt-3 underline"
            disabled={isSubmitting}
            onClick={() => void restartEnrollment()}
            type="button"
          >
            未完了の設定を解除してやり直す
          </button>
        </div>
      ) : null}

      <div>
        <label
          className="text-sm font-medium text-stone-800"
          htmlFor="mfa-code"
        >
          6桁の認証コード
        </label>
        <input
          autoComplete="one-time-code"
          className="mt-2 min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-lg tracking-[0.3em]"
          id="mfa-code"
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          pattern="[0-9]{6}"
          required
          value={code}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="button-primary w-full"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "確認中…" : "確認してAdminへ"}
      </button>
    </form>
  );
}
