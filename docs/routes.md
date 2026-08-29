# FUMIBRO ルート設計

## 基本方針

Next.js App Routerを使用する。`src/app`はURL、layout、page、Route Handlerだけを担当し、業務規則とSQLは`src/modules`へ置く。

- Route GroupはURLへ影響しない整理用途に使う。
- ページの読み取りはServer ComponentからApplication Queryを直接呼ぶ。
- Admin UIの更新はServer Actionを基本とする。
- 公開フォーム、ファイル応答、RSS、Export等、HTTP境界が必要な場合だけRoute Handlerを使う。
- `page.tsx`と`route.ts`を同じ実URLに置かない。
- `src/proxy.ts`はSupabase cookie更新と楽観的リダイレクトだけを行う。認可はデータ付近で再実行する。

## 公開ルート

| URL                                | ファイル配置                                                | 内容                                         |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `/`                                | `src/app/(public)/page.tsx`                                 | Home。最新投稿、掲示板、最近の作品、質問箱UI |
| `/blog`                            | `src/app/(public)/blog/page.tsx`                            | Blogタイムライン、filter、pagination         |
| `/blog/[slug]`                     | `src/app/(public)/blog/[slug]/page.tsx`                     | 投稿詳細、コメント、👍                       |
| `/blog/categories/[categorySlug]`  | `src/app/(public)/blog/categories/[categorySlug]/page.tsx`  | 管理可能な投稿ジャンル別一覧                 |
| `/projects`                        | `src/app/(public)/projects/page.tsx`                        | Project一覧                                  |
| `/projects/[projectSlug]`          | `src/app/(public)/projects/[projectSlug]/page.tsx`          | Project横断コンテンツとTheme                 |
| `/projects/[projectSlug]/feed.xml` | `src/app/(public)/projects/[projectSlug]/feed.xml/route.ts` | Project別RSS                                 |
| `/library`                         | `src/app/(public)/library/page.tsx`                         | Library一覧                                  |
| `/library/[slug]`                  | `src/app/(public)/library/[slug]/page.tsx`                  | Library詳細                                  |
| `/works`                           | `src/app/(public)/works/page.tsx`                           | Works一覧                                    |
| `/works/[slug]`                    | `src/app/(public)/works/[slug]/page.tsx`                    | Works詳細                                    |
| `/portfolio`                       | `src/app/(public)/portfolio/page.tsx`                       | Works由来のPortfolio。広告なし               |
| `/portfolio/[slug]`                | `src/app/(public)/portfolio/[slug]/page.tsx`                | 同じWorkをPortfolio用テンプレートで表示      |
| `/about`                           | `src/app/(public)/about/page.tsx`                           | About/Profile、名刺Dialog                    |
| `/contact`                         | `src/app/(public)/contact/page.tsx`                         | 問い合わせフォーム                           |
| `/privacy`                         | `src/app/(public)/privacy/page.tsx`                         | DB管理Privacy system Page                    |
| `/tags/[tagSlug]`                  | `src/app/(public)/tags/[tagSlug]/page.tsx`                  | 種別・Project横断タグ一覧                    |
| `/search`                          | `src/app/(public)/search/page.tsx`                          | PGroongaによるキーワード検索                 |
| `/feed.xml`                        | `src/app/(public)/feed.xml/route.ts`                        | FUMIBRO全体RSS                               |
| `/sitemap.xml`                     | `src/app/sitemap.ts`                                        | 公開中canonical URL                          |
| `/robots.txt`                      | `src/app/robots.ts`                                         | crawl方針                                    |

Footerは`/privacy`へのリンクを必ず含む。Privacyのroute、page key、footer導線はAdmin設定で削除または変更できない。

全体RSSは公開済みのBlog、Works、Libraryを含む。Project別RSSは同じ種別をProjectで絞る。PortfolioはWorksのprojectionなので二重にfeedへ入れない。

Projectで分類されたBlog、Works、Libraryのcanonical URLは、それぞれ`/blog/[slug]`、`/works/[slug]`、`/library/[slug]`とする。Projectページは分類一覧であり、同じdetailの複製URLを作らない。`/portfolio/[slug]`は同じWorksデータを異なる目的で表示するため、metadataでcanonical方針を明示する。

## Admin認証ルート

| URL                      | 内容                                           |
| ------------------------ | ---------------------------------------------- |
| `/admin/login`           | メール・パスワードログイン。公開signup導線なし |
| `/admin/mfa`             | TOTP登録、challenge、AAL2到達確認              |
| `/admin/forgot-password` | Recoveryメール要求                             |
| `/auth/confirm`          | `token_hash`検証・Recovery session確立         |
| `/auth/callback`         | 既発行PKCEリンクを`/auth/confirm`へ移す互換口  |
| `/admin/update-password` | 認証済みRecovery sessionで新passwordを設定     |

認証ページからAdminデータを返さない。認証済みAdminページと応答は共有cacheやISRを使わず、cookieを書き換える応答へ`private, no-store`相当を適用する。

## Admin保護ルート

| URL                                    | 内容                                               |
| -------------------------------------- | -------------------------------------------------- |
| `/admin`                               | Dashboard、未処理総数、直近操作                    |
| `/admin/quick`                         | スマホ向け短文、本文、画像1枚、Project、タグ、公開 |
| `/admin/posts`                         | 投稿一覧、状態・予約・Trash filter                 |
| `/admin/posts/new`                     | 新規投稿                                           |
| `/admin/posts/[id]/edit`               | 編集、予約、通常更新、更新再公開                   |
| `/admin/notices`                       | 掲示板CRUD、順序、期間                             |
| `/admin/projects`                      | Project設定、Theme key                             |
| `/admin/post-categories`               | 投稿ジャンルCRUD、並べ替え                         |
| `/admin/tags`                          | タグCRUD                                           |
| `/admin/locations`                     | 場所とMaps検索文字列                               |
| `/admin/library`                       | Library一覧                                        |
| `/admin/library/new`                   | Library作成                                        |
| `/admin/library/[id]/edit`             | metadata、access policy、ファイル管理              |
| `/admin/works`                         | Works一覧                                          |
| `/admin/works/new`                     | Works作成                                          |
| `/admin/works/[id]/edit`               | Works編集                                          |
| `/admin/portfolio`                     | WorksのPortfolio掲載と順序。作品を複製しない       |
| `/admin/pages`                         | About、Privacy等のPage一覧                         |
| `/admin/pages/[id]/edit`               | Page本文編集。Privacyは固定条件を維持              |
| `/admin/inquiries`                     | 問い合わせ一覧。新規件数badge                      |
| `/admin/inquiries/[id]`                | 問い合わせ詳細と状態変更                           |
| `/admin/business-cards`                | 名刺一覧                                           |
| `/admin/business-cards/new`            | 名刺作成                                           |
| `/admin/business-cards/[id]/edit`      | 構造化情報、PNG、公開状態                          |
| `/admin/comments`                      | 承認待ちbadge、表示・非表示・spam・Trash           |
| `/admin/media`                         | original、variant、利用先、処理状態                |
| `/admin/content/[contentId]/revisions` | Revision一覧、確認、復元                           |
| `/admin/settings`                      | 非secretサイト設定、コメント承認方式               |
| `/admin/exports`                       | CSV / JSON Export                                  |
| `/admin/trash`                         | 復元、追加確認付き完全削除                         |
| `/admin/audit`                         | 危険操作の監査結果                                 |

Admin layoutに未処理badgeを置くが、layoutの表示制御だけを認可境界にしない。各page、Server Action、Route Handler、Repository/RLSで必要な認可を行う。

Phase 1の未処理badgeは次を表示する。

- 総数: 新規問い合わせ + 承認待ちコメント
- `/admin/inquiries`: 新規問い合わせ数
- `/admin/comments`: 承認待ちコメント数
- desktop、mobileの両navigationで表示
- `99+`上限と、実際の意味が分かるaccessible label

Phase 2では`/admin/handoff-inbox`を追加予定だが、Phase 1ではroute、page、メニュー項目を作らない。

## Route Handler

| Method / URL                                        | 役割                        | 主な防御                                             |
| --------------------------------------------------- | --------------------------- | ---------------------------------------------------- |
| `POST /api/posts/[postId]/comments`                 | コメント保存                | 公開投稿確認、Origin、入力検証、honeypot、rate limit |
| `POST /api/posts/[postId]/likes`                    | 1 browser 1 postの👍        | visitor cookie、HMAC、一意制約、rate limit           |
| `POST /api/contact`                                 | 問い合わせ保存              | category検証、Origin、入力検証、honeypot、rate limit |
| `POST /api/visitors/claim`                          | site / Project unique claim | scope allowlist、HMAC、一意制約                      |
| `GET /api/library/[fileId]/download`                | Libraryファイル取得         | 公開判定、access policy、短期署名URL                 |
| `GET /api/business-cards/[slug]/png`                | 公開名刺PNG                 | 公開状態、固定Content-Disposition                    |
| `GET /api/business-cards/[slug]/vcard`              | `.vcf`生成                  | 公開fieldのみ、CRLF/値escape                         |
| `POST /api/admin/uploads/init`                      | 署名upload開始              | Admin AAL2、type/size宣言検証                        |
| `POST /api/admin/uploads/[assetId]/complete`        | upload検証と処理            | Admin AAL2、ownership、magic bytes、decode           |
| `GET /api/admin/exports/[dataset]?format=csv\|json` | データExport                | Admin AAL2、dataset allowlist、no-store              |
| `POST /api/admin/library-files/init`                | PDF / ZIP upload予約        | Admin AAL2、種類・size・UUID path                    |
| `POST /api/admin/library-files/[assetId]/complete`  | 配布file検証・添付          | owner再確認、magic bytes、SHA-256、private bucket    |

公開POSTはDBへ匿名直接INSERTさせず、Route Handlerで検証してから限定されたApplication Commandを呼ぶ。Server ComponentがこれらのRoute Handlerを内部APIとして呼ぶことは禁止する。

## 描画とcache

- 公開一覧・詳細はServer Componentを基本とする。
- 名刺Dialog、画像preview、slider、👍、フォーム状態等だけClient Componentにする。
- Admin、preview、認証、個別Export、署名URL、visitor claimはcacheしない。
- 公開コンテンツをcacheする場合も、公開、更新、Trash、復元後にApplication層から一貫したtag/pathを再検証する。
- cookieを更新する認証応答を共有cacheへ入れない。
- 公開判定前のrowをClient Component propsやRSC payloadへ渡さない。
- DBやSupabaseを使うserver-only moduleには`server-only`境界を置く。

## エラーと状態

- 存在しない、非公開、予約前、Trashの公開detailは情報を区別せず404とする。
- 認証なしのAdmin画面はloginへ誘導する。
- 認証済みだが権限またはAAL不足のmutationは403相当とし、黙って成功扱いにしない。
- rate limitは429、入力不正は400系、競合した`lock_version`は409相当としてUIに再読込を促す。
- 外部Storage処理失敗は成功画面を出さず、再試行可能なprocessing stateを残す。

## Phase 1に存在しないroute

- 外部AI質問回答API
- AI Handoff Inbox APIと`/admin/handoff-inbox`
- Gmail、KDP、ChatGPT、Claude、Gemini import callback
- 決済webhook、注文、購入者download grant
- メール送信API
- Google Maps API proxy
- SNS連携callback

将来追加する場合は認証、Privacy、rate limit、idempotency、監査を設計し、この文書を更新してから実装する。
