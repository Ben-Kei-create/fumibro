import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/modules/auth/ui/update-password-form";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Set New Admin Password",
};

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
