# ADR-0001: モジュラーモノリスを採用する

- 状態: Accepted
- 決定日: 2026-08-27
- 対象: FUMIBRO Phase 1以降

## Context

FUMIBROはBlog、Projects、Library、Works、Portfolio、Pages、Contact、Adminを長期間運用する。これらは同じコンテンツ、Project、tag、media、公開規則を共有する。一方、将来はProject固有Theme、外部AI、メール、決済、外部取込等を追加する予定がある。

Phase 1でサービスを細分化すると、認証、RLS、公開判定、transaction、deploy、監視が分散し、管理者1名のサイトには過剰である。反対に、すべてを`page.tsx`や巨大な共通utilityへ置くと、将来の変更箇所とデータ正本が分からなくなる。

## Decision

一つのNext.jsアプリケーション、一つのPostgreSQL、一つのSupabase Projectで動くモジュラーモノリスを採用する。

```text
App Router / UI
        ↓
Application: Query、Command、DTO、Port
        ↓
Domain: 公開、予約、削除、Revision等の規則
        ↑
Infrastructure: Supabase、Storage、PGroonga、Export
```

### 守る境界

1. `src/app`はroute、layout、page、Route Handlerの組立てに限定する。
2. 公開判定、認可、SQLをpageごとに複製しない。
3. Server ComponentはApplication Queryを直接呼び、同一アプリのRoute HandlerをHTTP経由で呼ばない。
4. Admin UIのmutationはServer Actionを基本とするが、すべて公開endpoint相当として認証・認可・入力検証する。
5. 公開POST、RSS、Download、Export等のHTTP境界だけRoute Handlerにする。
6. domain module間は公開されたApplication APIまたは型を介し、他moduleのinfrastructureへ直接依存しない。
7. Supabase、Storage、外部AI、メール、決済の具体SDKをdomainへimportしない。
8. `content_items`をBlog、Works、Library、Pagesの共通正本とする。
9. PortfolioとHomeはWorksをprojectionとして再利用し、複製rowを作らない。
10. Project Themeは`theme_key`とコード側Registryで交換し、CMS dataと分離する。

## Consequences

### 良い結果

- 一つのtransactionでcontent、tag、Revision、公開状態を整合させられる。
- RLSと公開Queryを集中してtestできる。
- 開発、local setup、backup、deployが比較的単純になる。
- 将来の外部providerをPort単位で交換できる。
- AIエージェントが修正箇所と不変条件を追いやすい。

### 負担

- module境界は言語やprocessでは強制されないため、reviewとtestが必要。
- 一部の共通操作は複数moduleにまたがるApplication serviceを必要とする。
- 全機能が同じdeploy単位になる。

## Rejected alternatives

### 機能ごとのmicroservice

Phase 1では認証、schema、運用、障害点が増える一方、独立scaleや組織分離の利益がないため採用しない。

### ページ中心のCRUD

初期実装は速くても、Home、Project、Portfolio、RSSで規則とデータが重複するため採用しない。

### 汎用CMSへの全面依存

FUMIBRO固有のProject横断、更新再公開、匿名カウンター、将来AI Handoff等の境界が外部CMS都合に拘束されるため、Phase 1の正本にはしない。

## Revisit conditions

次のいずれかが実測で発生した場合、特定adapterやjobのprocess分離を検討する。ただしDB正本とdomain境界を無条件に分割しない。

- 画像処理等がWeb requestの制限内で安定しない
- 外部取込jobが独立した再試行・scaleを必要とする
- deploy頻度、障害範囲、権限分離に明確な運用上の問題が出る
- 複数管理者・複数teamによる独立ownershipが必要になる
