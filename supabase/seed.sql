-- Idempotent baseline data. No administrator credentials or secrets belong in
-- this file; create the sole administrator through Supabase Auth and set
-- app_metadata.role = "admin" out of band.

insert into public.projects (
  id,
  slug,
  name,
  description,
  theme_key,
  display_order
)
values
  ('10000000-0000-4000-8000-000000000001', 'give-education', 'Give教育', '理科教育・教材', 'default', 10),
  ('10000000-0000-4000-8000-000000000002', 'givetex', 'GiveTeX', '将来別サイトへ移行可能なProject', 'default', 20),
  ('10000000-0000-4000-8000-000000000003', 'dororo', 'どろろ', '怪談・個人サイトProject', 'default', 30),
  ('10000000-0000-4000-8000-000000000004', 'cinema-neko', 'シネマネコ', '映画Project', 'default', 40),
  ('10000000-0000-4000-8000-000000000005', 'wonderloom', 'Wonderloom', 'Kindle・出版Project', 'default', 50),
  ('10000000-0000-4000-8000-000000000006', 'app', 'App', 'ゲーム・Webアプリ・ツール', 'default', 60)
on conflict (id) do nothing;

insert into public.post_categories (id, label, slug, icon_key, display_order)
values
  ('20000000-0000-4000-8000-000000000001', '日常', 'daily', 'notebook', 10),
  ('20000000-0000-4000-8000-000000000002', 'メシ', 'food', 'utensils', 20),
  ('20000000-0000-4000-8000-000000000003', 'シネマネコ', 'cinema-neko', 'film', 30),
  ('20000000-0000-4000-8000-000000000004', 'Wonderloom', 'wonderloom', 'book-open', 40),
  ('20000000-0000-4000-8000-000000000005', 'App', 'app', 'blocks', 50),
  ('20000000-0000-4000-8000-000000000006', 'Give教育', 'give-education', 'graduation-cap', 60),
  ('20000000-0000-4000-8000-000000000007', '制作記録', 'making', 'hammer', 70),
  ('20000000-0000-4000-8000-000000000008', 'その他', 'other', 'ellipsis', 999)
on conflict (id) do nothing;

insert into public.contact_categories (id, label, slug, display_order)
values
  ('30000000-0000-4000-8000-000000000001', '仕事依頼', 'work', 10),
  ('30000000-0000-4000-8000-000000000002', '教材', 'materials', 20),
  ('30000000-0000-4000-8000-000000000003', 'その他', 'other', 999)
on conflict (id) do nothing;

insert into public.site_settings (setting_key, value, description, is_public)
values
  ('site.name', '"FUMIBRO"'::jsonb, 'Public site name', true),
  ('site.description', '"個人メディア・ポートフォリオ・Projectハブ"'::jsonb, 'Public description', true),
  ('comments.approval_mode', '"required"'::jsonb, 'required or immediate', false),
  ('ads.enabled', 'false'::jsonb, 'Global future ad-slot switch', true),
  ('portfolio.ads_enabled', 'false'::jsonb, 'Must remain false for Portfolio', true),
  ('question_box.enabled', 'false'::jsonb, 'Phase 1 UI only; no external AI API', true)
on conflict (setting_key) do nothing;

insert into public.visit_counters (scope_key, scope_type, project_id, total)
values ('site', 'site', null, 0)
on conflict (scope_key) do nothing;

insert into public.visit_counters (scope_key, scope_type, project_id, total)
select 'project:' || project.id::text, 'project', project.id, 0
from public.projects as project
on conflict (scope_key) do nothing;

insert into public.content_items (
  id,
  kind,
  slug,
  title,
  excerpt,
  status,
  posted_at,
  publish_at,
  first_published_at,
  feed_at,
  feed_event_type
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'page',
    'about',
    'About',
    'FUMIBROについて',
    'published',
    '2026-08-26 00:00:00+09',
    '2026-08-26 00:00:00+09',
    '2026-08-26 00:00:00+09',
    '2026-08-26 00:00:00+09',
    'new'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'page',
    'privacy',
    'Privacy',
    'プライバシーポリシー',
    'published',
    '2026-08-26 00:00:00+09',
    '2026-08-26 00:00:00+09',
    '2026-08-26 00:00:00+09',
    '2026-08-26 00:00:00+09',
    'new'
  )
on conflict (id) do nothing;

insert into public.pages (
  content_item_id,
  page_key,
  body_markdown,
  seo_description,
  is_system
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'about',
    '# FUMIBROについて\n\nこのページはAdminから編集できます。',
    'FUMIBROについて',
    false
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'privacy',
    $privacy$# プライバシーポリシー

FUMIBROは、サイトの安定運営と利用者機能の提供に必要な範囲で情報を取り扱います。

## 匿名Cookieとアクセスカウンター

累計訪問者数と👍の重複防止のため、ランダムなfirst-party Cookieをブラウザへ保存します。データベースにはCookieそのものではなく、用途・対象ごとに変換した値だけを保存します。同一ブラウザを原則1回として数えるためのベストエフォート方式であり、個人の行動追跡を目的としません。生のIPアドレス、User-Agent、端末fingerprint、ページ別閲覧履歴は保存しません。

## コメント

コメントでは表示名、本文、投稿日時を保存します。迷惑投稿対策として、匿名Cookieから生成した短時間の制限用キーを利用する場合があります。コメントは承認待ち、非表示、spam判定、削除の対象になることがあります。

## お問い合わせ

お問い合わせでは、種別、名前、メールアドレス、件名、本文、送信日時、対応状況を保存します。回答と不正利用防止に必要な期間だけ保持し、不要になった情報は管理者が削除します。削除や取り扱いに関する連絡も `/contact` から受け付けます。

## ファイル配布と外部サービス

Phase 1では、有料・限定・メール登録必須のファイルを匿名配布しません。将来メール登録による配布、決済、Google AdSense等を導入する場合は、利用する外部サービス、送信情報、目的、保持方針を本ページへ追記してから有効化します。

## 改定

本方針を変更した場合は、このページを更新します。重要な変更では更新日またはサイト内のお知らせを表示します。$privacy$,
    'FUMIBROのプライバシーポリシー',
    true
  )
on conflict (content_item_id) do nothing;

insert into public.business_cards (
  id,
  slug,
  display_name,
  is_primary,
  is_published,
  display_order
)
values (
  '50000000-0000-4000-8000-000000000001',
  'default',
  'FUMIBRO',
  true,
  false,
  10
)
on conflict (id) do nothing;
