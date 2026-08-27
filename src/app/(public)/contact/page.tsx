import type { Metadata } from "next";

import { ContactForm } from "@/modules/contact/ui/contact-form";
import { getContactCategories } from "@/modules/public-content/application/get-public-content";
import { PageHeading } from "@/modules/public-content/ui/public-content";

export const metadata: Metadata = {
  description: "仕事依頼、教材、その他のお問い合わせ。",
  title: "Contact",
};

export default async function ContactPage() {
  const categories = await getContactCategories();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <PageHeading
        description="仕事依頼、教材について、その他のご連絡はこちらからお送りください。内容は安全に保存され、管理者が確認します。"
        eyebrow="INQUIRY"
        title="Contact"
      />
      <div className="mt-9">
        {categories.length ? (
          <ContactForm categories={categories} />
        ) : (
          <p className="rounded-xl border border-stone-200 bg-white p-6 text-stone-600">
            問い合わせ種別を準備中です。
          </p>
        )}
      </div>
    </main>
  );
}
