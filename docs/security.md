# FUMIBRO セキュリティ設計

## 適用範囲

この文書はPhase 1のAuth、認可、RLS、入力、Storage、匿名visitor、Privacy、運用上の必須条件を定義する。UIを非表示にすることはセキュリティ境界ではない。

## 守る対象

- Adminアカウント、session、TOTP
- 下書き、予約、hidden、Trash、Revision
- 問い合わせの返信先と本文
- 承認前・非表示コメント
- private originalとprivate download
- Supabase secret key、visitor HMAC secret、その他のsecret
- Export、backup、監査記録

主な脅威は、Adminなりすまし、RLS迂回、IDOR、secret露出、XSS、CSRF、spam・連打、偽装upload、署名URL漏えい、誤削除、AI/外部取込の過剰権限である。

## Admin認証

- Supabase Authのメール・パスワードを使う。
- 管理者は1名。公開signup、匿名Auth、不要なOAuth providerを無効にする。
- 認可roleは`app_metadata.role = 'admin'`を使い、利用者が変更できる`user_metadata`を使わない。
- TOTP MFAを必須とし、通常のAdmin操作はAAL2 sessionを要求する。
- AAL2 session中のQuick投稿では毎回TOTPを再要求しない。
- 完全削除、重要secret関連設定等は追加確認または再認証を要求する。
- account無効化時は既存sessionの失効も運用手順に含める。

`@supabase/ssr`はrequestごとにserver clientを生成する。利用者sessionを持つclientをmodule scopeへ保持しない。Admin応答、Auth callback、cookie refresh応答を共有cacheへ入れない。

## 認可境界

`src/proxy.ts`はcookie refreshと楽観的なredirectに限定する。Proxyは低速DB照会や最終認可を担当しない。

最終認可は次のすべてに置く。

1. Data Access Layer / Application Commandの`requireAdminAal2()`
2. Server Actionごとの再確認
3. Route Handlerごとの再確認
4. PostgreSQL RLSと明示GRANT
5. Storage policy

Admin layoutが隠れていても、Action IDやAPI URLは攻撃者から呼べる前提で扱う。入力されたrow IDだけを信用せず、server側でrowを再取得し、状態と操作可能性を確認する。

## RLSとDatabase

- 公開schemaの全テーブルでRLSを有効化する。
- `anon`と`authenticated`へのGRANTをMigrationで明示する。
- 公開SELECTは親`content_items`の公開条件を必ず含む。
- 子detail、tag join、viewから下書き、予約前、hidden、Trashを取得できないようにする。
- viewは`security_invoker = true`。不可能なら非公開schemaへ置き、公開roleの権限を剥奪する。
- `UPDATE` policyは`USING`と`WITH CHECK`の両方を定義する。
- `SECURITY DEFINER`を権限エラーの回避に使わない。必要な場合は非公開schema、固定`search_path`、呼出者検証、最小EXECUTE grantを必須とする。
- 問い合わせ、コメント、👍、visitor claimへの匿名直接書込みを許可しない。検証済みserver boundaryを通す。
- `content_revisions`、`admin_audit_events`、rate limit情報は公開SELECT不可。
- `source_system + source_external_id`の一意制約はTrashも対象とする。

公開条件:

```sql
status = 'published'
AND publish_at <= now()
AND deleted_at IS NULL
```

検索、RSS、sitemapも同じ条件を使う。

公開routeのSupabase clientはAdmin cookieを読まない専用anonymous clientとする。AdminがAAL2でログインしたまま公開画面を確認しても、Admin向けRLS policyによって下書きやTrashがRSC payloadへ混入しないようにする。

## Secretと環境変数

- secret key、service role、HMAC secret、TOTP secretをGitへcommitしない。
- `.env.example`には変数名と用途だけを書く。
- `NEXT_PUBLIC_`を付けるのはSupabase URLとpublishable key等、公開を前提とする値だけ。
- secretを扱うmoduleは`server-only`とし、Client Componentからimportした場合にbuildで失敗させる。
- DTOはUIに必要なfieldだけを返し、DB row全体、内部path、返信先、監査metadataをClientへ渡さない。
- error、log、analyticsへtoken、cookie、問い合わせ本文、署名URLを出さない。

## 入力とXSS

すべての`FormData`、JSON、path param、query string、headerを未信頼入力としてschema検証する。

- Blog本文はMarkdown。raw HTMLを禁止し、render時にもsanitizeする。
- コメントはプレーンテキストで保存・表示する。
- 問い合わせも任意HTMLとしてrenderしない。
- 表示名、URL、slug、Maps query、vCard値をcontextに応じてescapeする。
- 外部URLは許可schemeを`https`/必要な`http`等に制限し、`javascript:`等を拒否する。
- CSVは先頭が`= + - @`等の値を安全に扱い、spreadsheet formula injectionを防ぐ。
- vCardは改行と区切り文字を正しくescapeし、HTTP headerへ入力値を直接連結しない。

## CSRFと公開POST

- Server Actionsの組込みOrigin検査だけに依存せず、Action内でAuth、認可、入力検証を行う。
- Route Handlerの状態変更はOrigin/Host、Content-Type、methodを検証する。
- cookieは用途に応じ`Secure`、`SameSite=Lax`、適切な`HttpOnly`を設定する。
- CORSを広く開けない。Phase 1の公開POSTは同一originを標準とする。
- GETで状態を変更しない。

## spam・rate limit

コメントと問い合わせに次を適用する。

- honeypot
- 最低入力時間
- fieldごとの長さ上限
- 短期rate limit
- 同一payloadの短時間重複抑制
- コメント承認制の切替
- 管理者によるhidden、spam、Trash

rate limitはfirst-party visitor IDと、必要な場合だけ短期HMAC化したネットワークsignalを使う。生IPを永続保存しない。期限切れbucketを削除する。高額な外部サービスをPhase 1の必須条件にしない。

## 匿名visitorとPrivacy

visitor cookieはランダムなfirst-party識別子で、サイト全体unique、Project別unique、👍重複防止に使う。

- DBにはcookieの生値を保存しない。
- server secretでscope別HMACを作る。
- 生IP、User-Agent履歴、fingerprintを保存しない。
- cookie削除や別browserによる再計上は許容する。
- この仕組みを厳密な本人認証や一意人物数と表現しない。
- Privacyページで目的、保存の考え方、限界を説明する。

`/privacy`はDB管理のsystem Pageとしてseedし、footerから固定linkを張る。本文は編集・Revision復元できるが、route変更、削除、非公開化はできない。匿名IDを「個人情報ではない」と断定せず、最小化した仮名識別子として慎重に扱う。

## UploadとStorage

Storage bucket:

- `private-originals`: 元画像、元PDF
- `public-media`: 公開display、thumbnail、公開名刺PNG
- `private-downloads`: 配布PDF、将来ZIP

UploadはAdmin AAL2だけが開始できる署名付き直接uploadを使う。ブラウザのfilenameやMIME宣言だけを信用しない。

Phase 1の画像uploadでは、authenticated Adminが直接書けるのは`private-originals`と`private-downloads`だけとする。`public-media`へのINSERT / UPDATE / DELETEはbrowser roleへ許可せず、server-only processorがservice roleで処理済みvariantだけを書き込む。署名upload予約のassetは作成Adminに紐づけ、complete時にも同じuser IDを再確認する。

処理時に確認するもの:

- allowlistされた種類
- byte size
- magic bytes
- 実際の画像decode
- width / height / pixel count
- PDF等の期待形式
- UUIDベースobject path
- 20 MB以下、40 megapixel以下、静止画のみ

画像から不要なmetadataを除去し、displayとthumbnailを生成する。publicへ置くのは公開済みvariantだけ。original、有料、限定、メールgate、restrictedファイルをpublicへ置かない。

処理中断時の`uploaded / processing / failed` assetは公開しない。cleanupは年齢だけで削除せず、state、参照、variant、private object pathを確認する。完全削除は最新の参照関係を再計算し、対象assetを新規attach不可にしてからStorageを削除する。Storage失敗時は`purge_jobs`を`failed`で保持し、DB削除を成功扱いにしない。

## Library download

- `public`、`free_download`でもファイル本体はprivate bucketへ置く。
- download時にコンテンツ公開状態、`download_enabled`、access policy、対象fileを毎回確認する。
- 許可後に短時間署名URLを発行する。
- `email_gate`、`paid`、`restricted`はPhase 1でdeny-by-default。
- 署名URLをDB、Revision、log、HTML cacheへ保存しない。
- 将来の購入者grantは`customers / orders / order_items / download_grants`として分離し、Library rowへ決済状態を詰め込まない。

## 削除、Revision、監査

- 通常削除は論理削除。
- 復元前後に整合性と公開状態を確認する。
- 完全削除はTrash内だけ、AAL2、追加確認、対象名確認を必須とする。
- Revision復元前に現在値をsnapshotする。
- Revisionはappend-only。利用者入力だけでactorやtimestampを決めない。
- DB削除とStorage削除の片方だけが成功した場合、再試行可能な状態を残す。
- Privacy system Pageは論理・完全削除、slug変更、非公開化を禁止する。
- 完全削除、Revision復元、重要設定変更を監査記録へ残す。

Blog、Works、Library、Pagesは正本rootとdetailへのbrowser直接更新権限を剥奪し、AAL2検証・楽観lock・Revision・監査を同一transactionで行うDatabase Commandだけを更新経路とする。

## Admin未処理badge

badgeは件数だけを表示し、問い合わせ本文、reply-to、コメント本文をnavigation payloadへ含めない。未処理件数は`new`問い合わせと`pending`コメントから集計し、処理後に再検証する。badge値を権限判定や処理済みの正本にしない。

## AIと外部取込

Phase 1でAI Handoff Inboxを実装しない。将来実装時もAIや外部workerへ公開テーブルの直接書込み権限を与えない。

Phase 2の候補は非公開stagingへ入り、Adminが`公開`、`下書き`、`無視`のいずれかを選ぶ。公開・下書き適用時は次を必須とする。

- source冪等性確認
- schema検証
- Admin認可
- Revision作成
- 通常のApplication Command
- RLSと公開条件
- 監査

AI出力を信頼済みHTML、SQL、URL、filenameとして扱わない。

## HTTP securityと運用

Phase 1 QAで少なくとも次を確認する。

- CSP、`X-Content-Type-Options`、Referrer Policy等のsecurity headers
- frame埋込み方針
- HTTPSとSecure cookie
- Admin、Export、署名URLのno-store
- Supabase Database/Storage advisor
- 依存脆弱性
- secret scan
- RLS matrix: anon、AAL1、Admin AAL2
- public bucket object一覧とpolicy
- backupからの復元手順
- log redaction

## Privacy文面を更新すべき変更

次を導入する前に、機能だけでなくPrivacyページ、同意・告知、保持期間、削除手順をレビューする。

- AdSenseやアクセス解析
- 外部AIへの送信
- Gmail、Drive、SNS連携
- メール送信・email gate
- 決済・購入者情報
- Maps APIや位置情報
- fingerprintingに該当し得る技術

法令適合をこの技術文書だけで断定しない。必要な時点で対象地域と実運用に応じた確認を行う。
