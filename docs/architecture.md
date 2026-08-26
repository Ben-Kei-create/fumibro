# FUMIBRO アーキテクチャ

## 文書の目的

この文書は、FUMIBRO Phase 1 の実装境界と、長期運用で守る設計上の不変条件を定義する。実装の詳細がこの文書と矛盾する場合は、実装を合わせるか、理由をADRとして記録してからこの文書を更新する。

関連文書:

- [データモデル](./data-model.md)
- [ルート設計](./routes.md)
- [セキュリティ](./security.md)
- [Phase 1 完了条件](./phase-1-acceptance.md)
- [ADR-0001: モジュラーモノリス](./adr/0001-modular-monolith.md)

## 目標

FUMIBROは、個人メディア、ポートフォリオ、Projectハブを一つのCMSで運営する。Phase 1では見た目より、次を優先する。

- 公開・予約・削除・復元の規則が全画面で一致すること
- 一度登録したデータをHome、Project、Works、Portfolio、RSSへ再利用すること
- 管理者1名がPCとスマートフォンから安全に更新できること
- Supabaseや将来の外部サービスを交換しやすいこと
- 人間とAIエージェントが数年後にも読み直せること
- コンテンツ、問い合わせ、匿名アクセス情報を必要以上に収集しないこと

## システム構成

```text
Browser
  ├─ Public UI
  └─ Admin UI
        │
        ▼
Next.js App Router
  ├─ Server Components: 読み取りと画面構成
  ├─ Server Actions: Admin UIからの更新
  ├─ Route Handlers: 公開POST、RSS、Download、Export
  └─ proxy.ts: セッション更新と楽観的リダイレクトのみ
        │
        ▼
Application / Domain modules
  ├─ 公開判定・予約・Revision・削除
  ├─ DTO・入力検証・認可
  └─ Storage / Search / Import用Port
        │
        ▼
Supabase
  ├─ PostgreSQL + RLS + PGroonga
  ├─ Auth + TOTP MFA
  └─ Storage
```

Next.jsは16.3.3以上の16.x、Node.jsは24.xを明示指定する。CookieベースSSR認証には`@supabase/ssr`を使用し、依存バージョンは`package-lock.json`で固定する。Node.js Runtimeを標準とし、Edge Runtimeは明確な要件と検証がある場合に限る。

## モジュラーモノリス

Phase 1ではサービスを分割しない。一つのNext.jsアプリケーションと一つのPostgreSQLを使い、コード上で責務を分離する。

```text
src/app/              URL、layout、page、route handler
src/modules/          ドメインごとの規則とユースケース
src/server/           認証、Supabase、Storage、rate limit等の横断基盤
src/themes/           Project表示テーマのRegistry
src/integrations/     外部サービスを交換するPort
src/components/       複数ドメインで使うUI
src/shared/           業務知識を持たない小さな共通処理
```

各ドメインは必要に応じて次へ分ける。

- `domain`: 型、不変条件、純粋な判断
- `application`: Query、Command、DTO、トランザクション境界、Port
- `infrastructure`: Supabase Repository、Storage Adapter等
- `ui`: ドメイン固有の表示部品とServer Action

`app`はルーティングと画面構成に留める。SQL、RLSの代替となる認可、公開日時の独自判定を`page.tsx`へ書かない。Server Componentは同一アプリのRoute HandlerをHTTP経由で呼ばず、Application Queryを直接呼ぶ。

## コンテンツの正本

`content_items`をBlog、Works、Library、Pagesの共通正本とする。種別固有の値だけを`posts`、`works`、`library_items`、`pages`へ1対1で分離する。

```text
content_items
  ├─ posts
  ├─ works
  ├─ library_items ── library_files
  └─ pages
```

次を複製しない。

- Portfolioは`works`のうちPortfolio掲載対象を別テンプレートで表示する。
- Homeの最近の作品は`works`を取得する。
- Wonderloom作品は`project_id`で分類する。
- Projectページ、タグ一覧、検索、RSSは同じ`content_items`を参照する。

表示先ごとの掲載フラグや表示順は持てるが、タイトル、説明、画像、URL等を表示先ごとに再登録しない。

## 公開判定の唯一の規則

公開コンテンツの必須条件は次の三つである。

```sql
status = 'published'
AND publish_at <= now()
AND deleted_at IS NULL
```

この条件を公開用Query、RLS、検索、タグ一覧、Home、Project、RSS、sitemapのすべてで共有する。子テーブルだけを読んで条件を迂回してはならない。

- 予約投稿は`publish_at`が未来の`published`コンテンツとして表現する。
- 通常編集では`feed_at`を変更しない。
- 「更新として再公開」を選んだ場合だけ`feed_at`を更新し、`feed_event_type = 'UPDATED'`とする。
- 初回公開は`feed_event_type = 'NEW'`とする。
- Cronが止まっても、時刻到達後は公開Queryによって表示される。

掲示板は同じ考え方で、公開状態、開始日時、任意の終了日時、論理削除をすべて満たす場合だけ表示する。

## Projectとテーマ

Phase 1で次の6 Projectをseedする。

- `give-education`
- `givetex`
- `dororo`
- `cinema-neko`
- `wonderloom`
- `app`

Projectはデータ分類であり、表示テーマと分離する。`projects.theme_key`はコード側の許可済みTheme Registryを参照し、DBに任意のコンポーネント名やコードを保存しない。Phase 1では全Projectが`default`テーマを使用する。後からテーマを交換しても、CMS、URL、`project_id`、タグ、RSSを作り直さない。

## 検索

公開検索の第一方式はPGroongaとする。`content_items.search_text`へタイトル、本文・説明、タグ等の公開検索対象テキストを正規化して同期し、PGroonga索引を使用する。日本語を空白分割に依存させない。

- 公開検索は必ず公開判定を追加する。
- 問い合わせ、コメントの非公開情報、Revision、Storage内部パスは検索文書へ含めない。
- `pg_trgm`はslugやAdmin補助検索に使用できるが、公開日本語全文検索の代替を黙って行わない。
- PGroongaを利用できない環境へ変更する場合はADRを追加する。

詳細は[ADR-0002](./adr/0002-pgroonga-search.md)を参照する。

## 外部由来データと冪等性

`content_items`は`source_system`と`source_external_id`を持つ。`source_system`は管理されたlookupを参照し、初期値として`manual`、`gmail`、`chatgpt`、`claude`、`gemini`、`kdp`、`import`を想定する。

`source_external_id`が存在する場合、`source_system + source_external_id`はTrashを含めて一意である。再取込時は新しい行を作らず、既存行、Trash、競合を明示的に扱う。論理削除を重複回避の抜け道にしない。

Phase 1は外部サービスからの自動取込を実装しない。手入力と将来の取込が同じApplication Commandを通る境界だけを維持する。

## Revision

Blog、Works、Library、Pagesの重要データは`content_revisions`へaggregate snapshotを残す。

- 公開、更新再公開、復元、AIまたはimport由来の適用前にsnapshotを作る。
- 現在値は正規化テーブルを正本とし、Revisionを現在値として直接表示しない。
- Revisionはappend-onlyで、履歴行を上書きしない。
- 過去版へ戻す前にも現在値をsnapshotし、復元操作自体も履歴化する。
- snapshotには復元に必要な共通列、種別詳細、タグ等を含めるが、secretやStorage署名URLを入れない。
- 完全削除時は明示確認後に関連Revisionも削除する。

## Adminと未処理badge

AdminはPC向け全機能とスマートフォン向けQuick投稿を同じ認可基盤で提供する。AAL2セッションが有効ならQuick投稿のたびにTOTPを再入力させない。完全削除等の危険操作だけ追加確認する。

Phase 1ではAdminナビゲーションに「未処理」badgeを表示する。

- 問い合わせ: `status = 'new'`
- コメント: `moderation_status = 'pending'`
- いずれも`deleted_at IS NULL`のみ数える。
- 全体badgeは両者の合計、各メニューは個別件数を表示する。
- 件数を別の可変カウンターとして正本化せず、対象行から集計する。
- 処理後は対象Queryを再検証し、desktopとmobileの両方で直ちに反映する。
- 視覚表示だけにせず、スクリーンリーダー用ラベルを付け、表示上限は`99+`とする。

Phase 2でAI Handoff Inboxを導入した場合、その`pending`件数を同じ未処理badgeへ追加する。Phase 1のbadgeへ架空のAI件数は含めない。

## Phase 2 AI Handoff Inbox境界

AI Handoff InboxはPhase 2で実装する。Phase 1では実テーブル、受信API、Admin画面、バックグラウンド処理を作らない。

Phase 2では、AIや外部取込が公開テーブルへ直接書き込まず、非公開stagingへ候補と出所を渡す。管理者は候補を確認し、必ず次のいずれかを選ぶ。

- `公開`: 検証とRevision作成後、公開日時を伴って`content_items`へ反映
- `下書き`: `draft`として`content_items`へ反映
- `無視`: 公開コンテンツへ反映せず、監査可能な処理済み状態にする

適用時は`source_system + source_external_id`で冪等性を確認する。AIは認可、RLS、公開判定、Revision作成を迂回できない。将来のstaging名として`private.ai_handoffs`を候補とするが、Phase 1 Migrationへは含めない。

## 匿名visitor、👍、カウンター

最初の公開アクセス時にランダムなfirst-party visitor cookieを発行する。DBへcookie値や生IPを保存せず、サーバー側secretを用いてscope別にHMAC化する。

- サイト全体は同一ブラウザを原則1回だけ数える。
- 各Projectも同一ブラウザをProjectごとに原則1回だけ数える。
- 👍は同じ匿名visitorを用い、1投稿につき原則1回とする。
- 新規claimのtransactionは新しい累計値を返せる形にし、将来`1 / 10 / 100 / 1000 / 10000`等のキリ番演出をDB構造の作り直しなしで追加できるようにする。Phase 1では演出しない。
- Cookie削除、別ブラウザ、Cookie拒否は厳密には同一人物と判定できない。これは仕様上のベストエフォートである。
- fingerprintingは行わない。

詳細は[ADR-0003](./adr/0003-auth-and-anonymous-visitor.md)を参照する。

## Storage

Storageの責務を次に固定する。

```text
private-originals
  元画像、元PDF、再処理用原本

public-media
  公開済みdisplay画像、thumbnail、公開名刺PNG

private-downloads
  配布用PDF、将来の有料ZIP等
```

有料・限定Libraryファイルを`public-media`へ置かない。公開可能なdownloadも`private-downloads`から短時間の署名付きURLで渡す。Storage objectをDB rowなしで正本化せず、`assets`、`asset_variants`、`library_files`が用途と状態を管理する。

詳細は[ADR-0004](./adr/0004-storage-and-library-access.md)を参照する。

## Privacy

`/privacy`はPhase 1の必須公開ページであり、footerから常に到達可能にする。DB管理のsystem Pageとしてseedし、本文はAdminから編集でき、Revision対象とする。route、page key、footer導線は削除・変更できない。公開状態を外して404にする操作も許可しない。

Privacyページでは少なくとも次を説明する。

- コメントと問い合わせで入力された情報の利用目的
- first-party visitor cookie、unique visitor、👍のベストエフォート制御
- 生IPやfingerprintを永続保存しないこと
- Storage、バックアップ、削除と保持の考え方
- Google MapsはAPI連携でなく外部検索リンクであること
- Phase 1では広告、外部AI、メール送信、決済、SNS自動連携を有効化していないこと
- 将来外部サービスを有効化する前にPrivacy文面と設定を見直すこと

匿名IDを「絶対に個人情報ではない」と断定しない。追跡を最小化した仮名識別子として扱う。

## Phase 1で実装しないもの

- Gemini等を使う質問箱の回答処理
- Phase 2 AI Handoff Inboxの実テーブル、API、UI
- Gmail、KDP、ChatGPT履歴等の自動取込
- TMDB、Amazonアソシエイト、SNS連携
- Google Maps API
- メール送信とメールアドレスgateの完結処理
- Stripe等の決済、注文、購入者grant
- AdSenseコード
- 重い透かし処理。設定値とMedia Processorの境界はPhase 1に含める

将来機能の名前だけを空テーブルとして先に作らない。Phase 1では、正しい外部キー、Port、source metadata、access policy、Privacy上の境界を用意する。

## Feedの範囲

FUMIBRO全体RSSは公開済みのBlog、Works、Libraryを同じfeedへ含める。Project別RSSは同じ種別を`project_id`で絞る。Pages、掲示板、コメント、問い合わせ、Portfolio projectionはfeedへ入れず、同じWorksを二重配信しない。
