# FUMIBRO データモデル

## 目的

この文書はPhase 1の論理データモデル、テーブル責務、重要な制約を定義する。実際の型、default、index、RLSは`supabase/migrations/`を正本とするが、Migrationはここで定義した不変条件を満たさなければならない。

## 共通規約

- 主キーは原則UUID。
- 日時は`timestamp with time zone`でUTC保存し、表示時に利用者のtimezoneへ変換する。
- 人が使うURLには不変なIDではなく一意な`slug`を使う。
- 管理対象データは原則`created_at`、`updated_at`、`deleted_at`を持つ。
- 通常削除は`deleted_at`による論理削除。完全削除はTrashから明示操作した場合のみ。
- sort順は曖昧な作成日時に依存せず、必要なテーブルに`display_order`を持つ。
- 公開schemaの全テーブルはRLSを有効にし、GRANTもMigrationで明示する。
- 公開用viewを作る場合は`security_invoker = true`とする。

## 関係概要

```text
projects ────────< content_items >──────── content_source_systems
                       │
                       ├── posts ───────── post_categories
                       │      └─────────── locations
                       ├── works
                       ├── library_items ─ library_access_policies
                       │      └─────────── library_files
                       └── pages
                       │
                       ├── content_tags >── tags
                       ├── content_revisions
                       └── comments / post_likes

assets ──────────< asset_variants
  └────────────── posts / works / library_items / business_cards

contact_categories ───< contact_inquiries
business_cards ───────< business_card_links
```

## コンテンツ中核

### `projects`

Projectの分類と表示設定を持つ。

主要列:

- `slug`
- `name`
- `description`
- `theme_key`
- `display_order`
- `is_active`
- `external_url`

初期seedは`give-education`、`givetex`、`dororo`、`cinema-neko`、`wonderloom`、`app`。`theme_key`はコード側Registryに存在する値だけをApplication層で許可する。

### `content_source_systems`

外部由来を固定enumに閉じ込めず、管理されたlookupとして表す。

初期候補:

- `manual`
- `gmail`
- `chatgpt`
- `claude`
- `gemini`
- `kdp`
- `import`

Phase 1で外部取込処理は実装しない。`manual`以外の値は将来境界の定義である。

### `content_items`

Blog、Works、Library、Pagesの共通正本。

主要列:

- `kind`: `post / work / library / page`
- `project_id`: 任意。Page等はNULL可
- `slug`
- `title`: Blog短文投稿ではNULL可
- `summary`: 任意
- `status`: `draft / published / hidden`
- `posted_at`
- `publish_at`
- `first_published_at`
- `feed_at`
- `feed_event_type`: `NEW / UPDATED`
- `source_system`
- `source_external_id`: 手入力では通常NULL
- `search_text`: PGroonga検索対象の正規化テキスト
- `created_at`、`updated_at`
- `deleted_at`、`deleted_by`
- `lock_version`: 同時編集検出

重要制約:

1. 公開条件は`status = 'published' AND publish_at <= now() AND deleted_at IS NULL`。
2. `source_external_id IS NOT NULL`の場合、`source_system + source_external_id`はTrashを含めて一意。
3. `kind`と対応するdetail rowは常に1対1。一つの`content_item`が複数種別detailを持たない。
4. `slug`の一意範囲はrouteのcanonical方針と一致させる。
5. `search_text`には非公開情報、署名URL、Storage内部情報を含めない。

### `content_revisions`

重要コンテンツの復元可能なaggregate snapshot。現在値ではなくappend-only履歴である。

主要列:

- `content_item_id`
- `revision_number`
- `snapshot` JSONB
- `actor_type`: `admin / ai / import / system`
- `actor_user_id`: 存在する場合のみ
- `reason`
- `created_at`

snapshotは共通列、detail、タグ等、復元に必要な値を一つのversioned envelopeとして保持する。secret、Auth token、署名URL、生IPを含めない。復元前にも現在値を保存し、既存Revisionは更新しない。

## Blog

### `post_categories`

投稿ジャンル。ハッシュタグとは別概念で、管理者が追加、編集、並べ替えできる。

主要列:

- `label`
- `slug`
- `icon_key`
- `display_order`
- `is_active`
- `deleted_at`

初期例は`日常`、`メシ`、`シネマネコ`、`Wonderloom`、`App`、`Give教育`。固定enumにしない。

### `posts`

`content_items(kind = 'post')`の1対1detail。

主要列:

- `content_item_id`
- `body_markdown`
- `category_id`: 任意
- `location_id`: 任意
- `external_url`: 任意
- `spoiler_enabled`
- `image_asset_id`: 最大1件
- `watermark_enabled`

raw HTMLは受け付けない。画像の「最大1枚」はアプリだけでなくDB構造でも複数紐付けを作らないことで保証する。

### `locations`

管理者が登録した場所だけを投稿で選ぶ。

主要列:

- `display_name`
- `maps_query`
- `display_order`
- `is_active`

緯度経度、GPS履歴、Maps API responseはPhase 1で保存しない。公開リンクは`maps_query`から通常のGoogle Maps検索URLを生成する。

### `tags` / `content_tags`

すべてのProjectとコンテンツ種別で共有するタグと多対多関係。

- `tags`: `label`、`slug`、`created_at`、`deleted_at`
- `content_tags`: `content_item_id`、`tag_id`

同じ組合せは一意。公開タグ一覧は親`content_items`の公開条件を必ず適用する。

## 掲示板

### `notices`

Homeのピン留め掲示。

主要列:

- `title`
- `body`
- `link_url`
- `link_kind`: `internal / external`
- `display_order`
- `status`
- `starts_at`
- `ends_at`: 任意
- `created_at`、`updated_at`、`deleted_at`

Home表示は有効期間と公開状態を満たす先頭10件まで。タイムラインのように自動で押し流さない。

## Works / Portfolio

### `works`

`content_items(kind = 'work')`の1対1detail。

主要列:

- `description`
- `work_type`
- `image_asset_id`
- `released_on`
- `external_url`
- `show_on_home`
- `home_display_order`
- `show_in_portfolio`
- `portfolio_display_order`
- 将来用の`github_url`、`demo_url`等は必要になった時点で追加する

Portfolio専用作品テーブルは作らない。`show_in_portfolio`は表示選択であり、作品の正本ではない。

## Library

### `library_access_policies`

固定enumではなく、動作をコード側で明示的に対応させる管理lookup。

Phase 1のslug:

- `public`
- `free_download`
- `email_gate`
- `paid`
- `restricted`

`email_gate`、`paid`、`restricted`はPhase 1ではdeny-by-default。値を保存できることと、アクセスを実際に許可することを混同しない。

### `library_items`

`content_items(kind = 'library')`の1対1detail。

主要列:

- `description`
- `access_policy_id`
- `download_enabled`
- `cover_asset_id`
- `preview_enabled`

公開状態は`content_items`、ファイル取得権限は`access_policy + download_enabled`で別々に判断する。

### `library_files`

Libraryの版付き配布ファイル。

主要列:

- `library_item_id`
- `asset_id`
- `version_label`
- `media_type`
- `file_size`
- `is_current`
- `created_at`、`deleted_at`

ファイルは`private-downloads`に置き、短時間署名URLで渡す。有料・限定ファイルをpublic bucketへ移さない。

将来は`customers`、`orders`、`order_items`、`download_grants`を別境界として追加する。Phase 1ではこれらの空テーブルを作らない。

## PagesとPrivacy

### `pages`

`content_items(kind = 'page')`の1対1detail。

主要列:

- `page_key`: routeに対応する不変キー
- `body_markdown`
- `is_system`

`privacy`はPhase 1でseedするsystem Pageである。

- URLは`/privacy`で固定。
- footer導線を固定。
- 本文はAdmin編集可能でRevision対象。
- slug変更、論理削除、完全削除、非公開化は不可。

AboutもDB管理Pageとするが、Privacyの固定性は特に強い不変条件として扱う。

## Media

### `assets`

Storage objectの論理管理行。

主要列:

- `bucket_role`: `private_original / public_media / private_download`
- `object_path`: UUIDベース
- `original_filename`: 表示用。pathへ直接使用しない
- `media_type`
- `byte_size`
- `width`、`height`: 画像の場合
- `checksum`
- `processing_status`
- `created_at`、`deleted_at`

### `asset_variants`

originalから生成したdisplay、thumbnail、将来のwatermarked等。

主要列:

- `asset_id`
- `variant_kind`
- `object_path`
- `media_type`
- `byte_size`
- `width`、`height`
- `created_at`

署名URLは短命な応答値でありDBへ保存しない。

## コメントと👍

### `comments`

主要列:

- `post_content_item_id`
- `display_name`
- `body`
- `moderation_status`: `pending / visible / hidden / spam`
- `created_at`
- `deleted_at`

本文はプレーンテキストとして扱う。承認制OFFの場合でもspam判定や管理者非表示を迂回しない。

### `post_likes`

主要列:

- `post_content_item_id`
- `visitor_hash`
- `created_at`

`post_content_item_id + visitor_hash`を一意にする。visitor cookie値、生IP、fingerprintを保存しない。

## 匿名訪問者

### `site_unique_visitors`

サイト全体の一意visitor claimを保持する。

- `visitor_hash`
- `first_seen_at`

`visitor_hash`は一意。同じclaimの再送で件数を増やさない。

### `project_unique_visitors`

Projectごとの一意visitor claimを保持する。

- `project_id`
- `visitor_hash`
- `first_seen_at`

`project_id + visitor_hash`を一意にする。集計値はclaim行を正本として算出するか、同一トランザクションで更新する派生counterとする。派生counterだけを重複防止の正本にしない。

新規claim処理は、重複かどうかと新しい累計値を同じtransaction結果として返せるようにする。これにより将来のキリ番演出を追加できるが、Phase 1では演出履歴や報酬tableを作らない。

HMACはsite、Project、like等のscopeを入力に含め、異なる用途の値を外部から容易に結合できないようにする。

## Contact

### `contact_categories`

問い合わせ種別。初期seedは`仕事依頼`、`教材`、`その他`。

主要列:

- `label`
- `slug`
- `display_order`
- `is_active`

### `contact_inquiries`

主要列:

- `category_id`
- `display_name`
- `reply_to`
- `subject`
- `body`
- `status`: `new / in_progress / closed / spam`
- `created_at`、`updated_at`、`deleted_at`

公開側にSELECT権限を与えない。Phase 1ではメール送信せず、Adminで確認する。

## 名刺

### `business_cards`

将来複数名刺へ拡張できるProfileデータ。

主要列:

- `slug`
- `display_name`
- `role_title`
- `organization`
- `email`、`phone`: 任意
- `address`: 任意
- `image_asset_id`: PNG
- `is_default`
- `is_published`
- `display_order`
- `created_at`、`updated_at`、`deleted_at`

公開される値だけをvCardへ含める。default公開名刺は同時に1件まで。

### `business_card_links`

WebサイトやSNS等の可変リンク。

- `business_card_id`
- `label`
- `url`
- `display_order`

## Admin未処理badge

未処理件数専用テーブルは作らない。次を正本から集計する。

```text
pending_comments = comments.moderation_status = 'pending' AND deleted_at IS NULL
new_inquiries    = contact_inquiries.status = 'new' AND deleted_at IS NULL
total_pending    = pending_comments + new_inquiries
```

Phase 2のAI Handoff Inboxを導入した時点で、その未処理件数を同じQuery DTOへ追加する。Phase 1にAI用テーブルは作らない。

## Settings、監査、rate limit

### `site_settings`

コメント承認制、サイト説明等の非secret設定。API key、service role、HMAC secretは保存しない。

### `admin_audit_events`

完全削除、Revision復元、重要設定変更等の操作結果をappend-onlyで記録する。secretや本文全文をログへ複製しない。

### `private.rate_limit_buckets`

コメント、問い合わせ、👍等の短時間rate limit用。短期HMAC化キーと期限だけを保持し、生IPを保存しない。期限切れ行は運用で削除する。

## AI Handoff InboxはPhase 2

Phase 1のデータモデルにAI Handoffテーブルを含めない。Phase 2で導入する場合は非公開schemaにstagingを置き、候補、出所、冪等key、提案snapshot、状態、判断者、判断日時を保持する。

許可される人間の判断は`公開`、`下書き`、`無視`。`公開`または`下書き`の選択後だけApplication Commandを介して`content_items`へ反映する。AIや外部workerへpublic contentの直接INSERT/UPDATE権限を与えない。

## 完全削除

完全削除は次を満たす場合だけ実行する。

1. 対象がTrashにある。
2. AdminがAAL2である。
3. 危険操作の追加確認に成功する。
4. 対象名等を使った明示確認を行う。
5. 関連detail、join、Revision、公開variant、private objectを対象にする。
6. Storage失敗をDB成功として隠さず、再試行可能な状態を残す。

Privacy system Pageは完全削除対象外。
