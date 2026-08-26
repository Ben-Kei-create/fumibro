import { PlannedAdminSection } from "@/modules/admin/ui/planned-section";

export default function AdminCommentsPage() {
  return (
    <PlannedAdminSection
      description="承認待ちコメントの確認、公開、非表示、spam判定、論理削除を実装します。"
      milestone="MILESTONE 6"
      title="コメント管理"
    />
  );
}
