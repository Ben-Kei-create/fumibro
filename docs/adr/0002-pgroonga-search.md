# ADR-0002: 日本語公開検索の第一方式にPGroongaを使う

- 状態: Accepted
- 決定日: 2026-08-27
- 対象: 公開検索、tag・Project・category絞り込み

## Context

FUMIBROの本文と作品説明は日本語が中心である。PostgreSQL標準全文検索の単語分割や、単純な`ILIKE`、`pg_trgm`だけでは、日本語の連続文字列、長文、index利用、関連度の扱いを主検索として安定させにくい。

検索対象はBlogだけでなく、Works、Library、Pages、tag、Projectを横断する。ただし問い合わせ、非公開コメント、Revision、Storage metadataは検索対象にしてはならない。

## Decision

公開キーワード検索の第一方式としてPGroongaを採用する。

`content_items.search_text`へ検索対象の公開可能テキストを正規化し、PGroonga indexを作る。検索QueryはPGroongaの全文検索演算子をparameter bindingで使用し、次の公開条件を必ず加える。

```sql
status = 'published'
AND publish_at <= now()
AND deleted_at IS NULL
```

### `search_text`の構成

種別ごとに次を対象とする。

- 共通: title、summary
- Blog: `posts.body_markdown`
- Works: description、work type等の表示用文字列
- Library: description
- Pages: body
- 共通関連: tag label、Project name、投稿ジャンルlabel

Markdown記号は検索品質を損なわない形で正規化する。署名URL、Storage object path、問い合わせ、非公開コメント、Revision、監査log、secretを含めない。

### 同期

`search_text`を手作業で更新させない。共通のrefresh functionを用意し、次の変更で同一transaction内または確実に再試行される形で更新する。

- `content_items`のtitle、summary、Project変更
- posts、works、library_items、pagesの本文・説明変更
- content_tagsの追加・削除
- tag、Project、post categoryの表示名変更
- Revision復元

DB triggerとApplication serviceの責務を混在させる場合も、最終的に呼ぶrefresh処理を一つにし、同期漏れをtestする。

### Query

- 利用者入力をSQLやPGroonga query構文へ文字列連結しない。
- 最大長、空文字、制御文字を検証する。
- Project、kind、category、tagのfilterはallowlistされたparameterで追加する。
- 初期sortは検索scoreを優先し、同score時に`feed_at`または`publish_at`、IDで安定化する。
- paginationは結果の重複・欠落をtestする。

## Fallback方針

`pg_trgm`はslug、Admin補助検索、誤字に対する限定用途へ使える。しかし公開日本語検索を黙って`ILIKE`や`pg_trgm`へ切り替えない。

PGroonga extensionが利用できない環境では、Migrationまたはhealth checkを失敗させ、環境差を明示する。別方式へ変更する場合は検索品質、index、Supabase互換性、移行手順を検証した新しいADRが必要である。

## Consequences

### 良い結果

- 日本語を空白分割に依存せず検索できる。
- 種別横断検索を一つのindex経路へ集約できる。
- 公開判定とfilterをSQLで一貫して適用できる。

### 負担

- extensionのavailabilityとversionを環境ごとに確認する必要がある。
- detailやtag更新時の`search_text`同期testが必要になる。
- Relevance調整はPGroongaの挙動を理解して行う必要がある。

## Acceptance evidence

- 日本語の空白なしqueryで期待するBlog、Works、Library、Pageが見つかる。
- title、本文、tag変更が同じcontentの検索結果へ反映される。
- draft、予約前、hidden、Trashが結果に出ない。
- `EXPLAIN`等で主要検索がPGroonga indexを使用する。
- 不正なquery構文、過大入力でSQL injectionや過負荷を起こさない。
