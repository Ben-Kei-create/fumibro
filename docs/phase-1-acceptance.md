# FUMIBRO Phase 1 完了条件

## 使い方

この文書はPhase 1のDefinition of Doneである。チェックは実装、Migration、テスト、文書が揃った項目だけに付ける。画面のplaceholderだけ、DB列だけ、手動で一度成功しただけでは完了としない。

## 1. ToolchainとRepository

- [ ] Next.jsは16.3.3以上かつ16.xのセキュリティ修正版を使用し、`package.json`とlockfileで固定されている。
- [ ] Node.jsは24.xを`package.json`、`.nvmrc`、CI、Vercel設定で明示し、Vercelのdefaultに依存していない。
- [ ] `@supabase/ssr`と`@supabase/supabase-js`のversionがlockfileで固定されている。
- [ ] TypeScript strict、ESLint、Tailwind CSSが動作する。
- [ ] `.env.example`に変数名と説明があり、実secretが含まれない。
- [ ] `AGENTS.md`、README、architecture、data model、routes、security、ADRが現実の実装と一致する。
- [ ] CIがlint、typecheck、test、buildを実行する。

## 2. DatabaseとMigration

- [ ] 空のローカルSupabaseへMigrationとseedを適用して同じschemaを再現できる。
- [ ] `give-education`、`givetex`、`dororo`、`cinema-neko`、`wonderloom`、`app`がseedされる。
- [ ] `content_items`と`posts / works / library_items / pages`の1対1整合性がDB制約または検証済みtransactionで守られる。
- [ ] 公開条件が`status = 'published' AND publish_at <= now() AND deleted_at IS NULL`へ統一されている。
- [ ] `source_system + source_external_id`の部分一意制約があり、Trash中のrowも重複回避対象になる。
- [ ] 管理可能な`post_categories`と初期ジャンルがある。
- [ ] `content_revisions`がappend-only aggregate snapshotを保持する。
- [ ] Privacy system Pageがseedされ、本文以外の固定条件をDBでも保護する。
- [ ] 公開schema全tableでRLSが有効で、GRANTとpolicyがMigrationに明記されている。

## 3. 検索

- [ ] PGroonga extensionをMigrationで有効化できる。
- [ ] `content_items.search_text`がBlog本文、Works/Library/Page説明、title、tag等の対象変更に同期する。
- [ ] 公開検索の第一経路がPGroonga indexを使用する。
- [ ] 日本語の連続文字列を空白分割なしで検索できる。
- [ ] Project、content kind、投稿ジャンル、タグ等を安全に絞り込める。
- [ ] draft、予約前、hidden、Trashが検索結果へ出ない。
- [ ] 問い合わせ、非公開コメント、Revision、Storage内部情報が検索文書へ入らない。
- [ ] PGroongaがない場合に、検知せず`ILIKE`や`pg_trgm`へ退行しない。

## 4. AuthとAdmin

- [ ] 公開signupなしで単一Adminがメール・パスワードでloginできる。
- [ ] TOTPを登録し、AAL2 sessionだけが保護対象の読み取り・更新を行える。
- [ ] AAL2 session中のスマホQuick投稿で毎回TOTPを求めない。
- [ ] 完全削除等の危険操作だけ追加確認を要求する。
- [ ] Proxyだけに依存せず、全Server Action、保護Route Handler、DAL、RLSで再認可する。
- [ ] Admin/Auth応答は共有cacheまたはISRへ入らない。
- [ ] PC AdminにBlog、掲示板、Project、投稿ジャンル、タグ、場所、Library、Works、Portfolio、Pages、問い合わせ、名刺、コメント、Media、設定、Export、Trash、Revisionがある。
- [ ] スマホAdminで本文、画像1枚、Project、タグ、公開を少ない操作で完了できる。

## 5. Admin未処理badge

- [ ] Admin共通navigationに未処理総数が表示される。
- [ ] 問い合わせメニューに`status = 'new'`の件数が表示される。
- [ ] コメントメニューに`moderation_status = 'pending'`の件数が表示される。
- [ ] Trashは件数から除外される。
- [ ] 状態変更後、desktopとmobileのbadgeが直ちに更新される。
- [ ] `99+`表示とscreen reader向けlabelがある。
- [ ] badge専用の手動counterを正本にせず、対象rowから集計する。
- [ ] Phase 1に存在しないAI Inboxの件数やメニューを表示しない。

## 6. Blog

- [ ] タイトルあり・なしの短文と長文を作成、編集、公開できる。
- [ ] 投稿日時、公開日時、予約日時、更新日時を扱える。
- [ ] `publish_at`到達前は非公開、到達後はCronなしでも公開される。
- [ ] Project、投稿ジャンル、複数タグ、画像最大1枚、外部URL、場所、ネタバレを設定できる。
- [ ] 投稿ジャンルをAdminで追加、変更、並べ替えできる。
- [ ] 通常編集ではHome先頭へ戻らない。
- [ ] 更新再公開を選ぶとHomeで`UPDATED`、初回公開は`NEW`として扱える。
- [ ] Markdown raw HTMLを禁止し、安全にrenderする。

## 7. 画像とStorage

- [ ] Adminだけが署名付きuploadを開始できる。
- [ ] JPEG、PNG、WebP等のallowlist、size、magic bytes、実decode、pixel数を検証する。
- [ ] 1投稿へ2枚以上の画像を紐付けられない。
- [ ] 元画像・元PDFが`private-originals`へ置かれる。
- [ ] display画像とthumbnailが生成され、公開時だけ`public-media`から提供される。
- [ ] 配布PDF等は`private-downloads`へ置かれる。
- [ ] 不要なEXIF等を公開variantから除去する。
- [ ] 投稿単位の透かしON/OFFとMedia Processor拡張点がある。実際の重い透かし処理は任意。
- [ ] 非公開・Trash化でpublic variantが公開されたままにならず、復元時に整合する。

## 8. Homeと掲示板

- [ ] Homeに公開済みBlogの最新投稿が表示される。
- [ ] 掲示板が表示順、開始日時、任意の終了日時、公開状態を尊重し、最大10件表示される。
- [ ] 掲示板はAdminが削除または非公開にするまでタイムラインで押し流されない。
- [ ] 最近の作品がWorksを正本として画像付き表示される。
- [ ] Wonderloom等の作品をHome専用に再登録しない。
- [ ] 質問箱のUIと内部interfaceがあり、外部AI APIは呼ばない。
- [ ] 広告slot componentはあるがAdSense codeは含めない。

## 9. Project、Works、Portfolio

- [ ] 6 Projectの一覧とdetailが表示される。
- [ ] ProjectをDBへ追加でき、既存schemaを変更せず分類できる。
- [ ] `theme_key`は許可済みRegistryを参照し、Phase 1はdefault Themeを使う。
- [ ] Themeを交換してもDB、CMS、canonical URLを作り直さない。
- [ ] Worksにtitle、Project、description、image、公開日、外部URL、種別、公開状態がある。
- [ ] PortfolioはWorksを正本にし、掲載有無と順序だけを管理する。
- [ ] Portfolioに広告componentをrenderしない。
- [ ] `/works/[slug]`と`/portfolio/[slug]`のcanonical方針がmetadataへ反映される。

## 10. Library

- [ ] title、description、Project、tag、file、公開状態、download可否を保存できる。
- [ ] access policyとして`public / free_download / email_gate / paid / restricted`を保存できる。
- [ ] `email_gate / paid / restricted`はPhase 1でdeny-by-defaultになる。
- [ ] 許可されたdownloadだけが短時間署名URLを取得できる。
- [ ] private fileの永続URLやobject一覧を公開しない。
- [ ] 将来の`customers / orders / order_items / download_grants`境界が文書化され、Phase 1に空tableを作っていない。

## 11. Tags、場所、検索

- [ ] 新規tag作成と既存tag選択ができる。
- [ ] tag detailでProject・種別横断の公開コンテンツが表示される。
- [ ] 通常keyword検索がPGroongaで機能する。
- [ ] 場所はAdmin登録の`表示名 + Maps検索文字列`だけを使用する。
- [ ] URL encodeした通常のGoogle Maps検索URLを生成する。
- [ ] Maps API key、SDK、GPS自動取得を使わない。

## 12. コメント、👍、unique visitor

- [ ] 一般閲覧者が表示名と本文を投稿できる。
- [ ] プレーンテキスト化、長さ制限、honeypot、最低入力時間、rate limitがある。
- [ ] 承認制ON/OFF、visible、hidden、spam、TrashをAdminで扱える。
- [ ] first-party visitor cookieは暗号学的乱数で生成される。
- [ ] DBへcookie生値、生IP、fingerprintを保存しない。
- [ ] scope別HMACと一意制約により同一browserの同一投稿👍が原則1回になる。
- [ ] サイト全体は同一browserを原則1回、各Projectも各1回として数える。
- [ ] 新規claim時に新しい累計をtransaction結果として得られ、将来のキリ番hookを追加できる。Phase 1では演出しない。
- [ ] Cookie削除・別browserは再計上され得るという限界をPrivacyとREADMEへ記載する。

## 13. Contact

- [ ] `/contact`で`仕事依頼 / 教材 / その他`を選べる。
- [ ] 入力検証、honeypot、rate limit、重複抑制がある。
- [ ] 問い合わせをDBへ安全に保存し、公開側からSELECTできない。
- [ ] Adminで詳細確認し、`new / in_progress / closed / spam`を管理できる。
- [ ] Phase 1では外部メールを送信せず、送信済みと誤表示しない。

## 14. About、名刺、Privacy

- [ ] `/about`にProfileと名刺iconがある。
- [ ] iconからkeyboard操作可能なmodalを開ける。
- [ ] 公開名刺のPNGをdownloadできる。
- [ ] 公開fieldだけから正しいvCardを生成してdownloadできる。
- [ ] Adminで名刺情報、PNG、公開状態を編集できる。
- [ ] 複数名刺へ拡張可能で、default公開名刺は最大1件になる。
- [ ] `/privacy`がDB管理system Pageとしてseedされている。
- [ ] Privacy本文はAdmin編集とRevision復元が可能である。
- [ ] Privacyのroute、page key、footer link、公開状態を削除・変更できない。
- [ ] Privacy本文がコメント、問い合わせ、匿名cookie、Storage、外部link、Phase 1で未接続の外部サービスを説明する。

## 15. Revision、削除、復元

- [ ] Blog、Works、Library、Pagesの公開・重要更新前にsnapshotが作成される。
- [ ] snapshotに復元に必要なdetailとtag関係が含まれる。
- [ ] secret、署名URL、生IP等がsnapshotへ入らない。
- [ ] 過去版へ復元する前に現在版も保存される。
- [ ] 通常削除は論理削除で、公開画面、検索、RSS、sitemapから消える。
- [ ] Trashから復元できる。
- [ ] 完全削除はTrash、AAL2、追加確認、対象名確認をすべて要求する。
- [ ] DBとStorageの削除失敗を再試行できる。
- [ ] Privacy system PageをTrashまたは完全削除できない。

## 16. RSS、Export、backup

- [ ] FUMIBRO全体RSSが公開Blog、Works、Libraryを重複なく含む有効なXMLである。
- [ ] Project別RSSが同じ種別をProjectで絞った有効なXMLである。
- [ ] RSSへ非公開、予約前、hidden、Trashが出ない。
- [ ] Blog、Project、Library、Works、PortfolioをCSVで出力できる。
- [ ] 同じ範囲をJSONでも出力できる。
- [ ] Portfolio exportはWorks由来で、別正本を作らない。
- [ ] 日本語、改行、tag関係、時刻、stable ID/source情報を失わない。
- [ ] CSV formula injectionを防ぐ。
- [ ] DB、Storage、CSV/JSONのbackupとrestore手順をREADMEとdocsへ記載する。

## 17. Responsive、Accessibility、広告

- [ ] 公開サイトとAdminが代表的なsmartphone、tablet、desktop幅で利用できる。
- [ ] keyboard、focus、label、Dialog、spoiler、form errorが基本的なaccessibilityを満たす。
- [ ] 読みやすい文字、通常navigation、落ち着いた背景を使用する。
- [ ] Home、Blog、Project記事等へ将来広告slotを置ける。
- [ ] Portfolioには広告slotもAdSense codeも表示しない。

## 18. セキュリティQA

- [ ] anon、authenticated AAL1、Admin AAL2のRLS matrix testが通る。
- [ ] child table、view、tag join、searchから非公開dataが漏れない。
- [ ] Supabase secret key/service roleがbrowser bundleに含まれない。
- [ ] Server ActionとRoute Handlerが個別に認証・認可・入力検証する。
- [ ] uploadの偽装拡張子、oversize、decode失敗を拒否する。
- [ ] XSS、CSRF、IDOR、CSV injection、open redirectの主要caseを確認する。
- [ ] Admin、Export、署名URL、Auth応答が共有cacheされない。
- [ ] security headers、dependency audit、secret scan、Supabase advisorを確認する。
- [ ] logへtoken、cookie、返信先、問い合わせ本文、署名URLが出ない。

## 19. 最終commandとテスト

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] DB constraint / RLS test
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] 予約公開、更新再公開、Revision復元、Trash、完全削除のE2E
- [ ] コメント、問い合わせ、👍、site/Project unique visitorの重複・abuse test
- [ ] RSS validation、CSV/JSON parse、Library署名URLのtest
- [ ] smartphone Quick投稿とAdmin未処理badgeのE2E

## Phase 1の明示的な除外

以下は完了条件に含めず、Phase 1で実装しない。

- Gemini等を利用する質問箱回答
- AI Handoff Inboxの実table、受信API、Admin UI
- Gmail、KDP、ChatGPT、Claude、Gemini、自動日記等の取込job
- TMDB、Amazonアソシエイト、Instagram、Bluesky、X連携
- Google Maps API、GPS自動取得
- メール送信、email gateの認証完結
- Stripe等の決済、注文、購入者grant
- AdSense code
- 高度なPDF browser viewer、印刷制御
- Project固有の大規模Theme

Phase 2 AI Handoff Inboxの設計境界は文書化するが、Phase 1へplaceholder tableや空Admin画面を混入させない。将来は管理者が必ず`公開`、`下書き`、`無視`のいずれかを判断した後だけ`content_items`へ反映する。
