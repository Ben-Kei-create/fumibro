# ADR-0004: Storageを3責務へ分離しLibrary accessをdeny-by-defaultにする

- 状態: Accepted
- 決定日: 2026-08-27
- 対象: 画像、PDF、名刺PNG、Library download、将来販売

## Context

FUMIBROは投稿画像、作品画像、名刺PNG、PDF、将来の有料ZIPを扱う。公開表示用画像と、再処理用original、有料・限定downloadを同じpublic bucketへ置くと、非公開化や権限確認を迂回して直接取得される危険がある。

またLibraryはPhase 1で決済しないが、後から無料download、email gate、購入者download、限定配布を追加できる必要がある。

## Decision

### Bucket責務

```text
private-originals
  元画像、元PDF、再処理用原本

public-media
  公開済みdisplay画像、thumbnail、公開名刺PNG

private-downloads
  配布用PDF、将来の有料ZIP等
```

- bucket名と役割を混同しない。
- originalを公開URLで配信しない。
- 有料、限定、email gate対象をpublic bucketへ置かない。
- UUIDベースobject pathを使用し、利用者filenameをpathとして信用しない。
- DBの`assets`、`asset_variants`、`library_files`がobjectの用途と状態を管理する。
- 署名URLは短時間だけ生成し、DB、Revision、cache、logへ保存しない。

### 画像処理

1. Admin AAL2を確認する。
2. serverがupload意図、許可type、上限sizeを検証して署名uploadを開始する。
3. browserからprivate領域へ直接uploadする。
4. 完了後、magic bytes、実decode、pixel数、checksumを検証する。
5. metadataを除去し、displayとthumbnailを生成する。
6. 公開済みコンテンツに必要なvariantだけ`public-media`へ置く。
7. 非公開・Trash・復元時にDB状態とpublic variantを整合させる。

投稿画像はDB構造で最大1枚とする。透かしON/OFFを保存し、Media Processor Portを用意するが、重い透かし生成自体はPhase 1必須ではない。

### Library access policy

公開状態とfile accessを分ける。policyは次を保存できる。

| Policy          | Phase 1の動作                                                 |
| --------------- | ------------------------------------------------------------- |
| `public`        | detailと許可されたpreviewを公開。配布downloadは自動許可しない |
| `free_download` | `download_enabled`の場合、匿名利用者へ短時間署名URLを発行     |
| `email_gate`    | 保存・表示可能だがdownload拒否                                |
| `paid`          | 保存・表示可能だがdownload拒否                                |
| `restricted`    | 保存・表示可能だがdownload拒否                                |

`download_enabled`は追加の停止switchであり、それ単独でpolicyを上書きしない。Phase 1で実装されていないgrant方式はすべてdeny-by-defaultとする。

### 将来販売の境界

Phase 2以降で次をLibraryから分離して追加する。

- `customers`
- `orders`
- `order_items`
- `download_grants`

購入者専用URLは`download_grants`を検証してから短期署名URLを発行する。Library rowへ顧客や決済履歴をJSONとして埋め込まない。Phase 1ではこれらの空table、決済webhook、購入者URLを作らない。

### 名刺

公開名刺PNGは`public-media`を利用できる。vCardは構造化された公開fieldからrequest時に生成し、privateなAdmin fieldを含めない。

## 削除とbackup

- 論理削除時にpublic variantを公開し続けない。
- 完全削除はTrash、AAL2、追加確認後だけ行う。
- DB削除とStorage削除の片方が失敗した場合、再試行可能なpurge状態を残す。
- backupにはDBだけでなく3 bucketを含める。
- backup内に完全削除済みdataが保持期間中残り得ることを運用文書で説明する。
- restore手順はDB rowとobject pathの対応まで検証する。

## Rejected alternatives

### すべてpublic bucket

URLを知る利用者がaccess policyを迂回できるため採用しない。

### すべてNext.js Function経由でupload

大きなpayload、timeout、memory制限の影響を受けるため、署名付き直接uploadを基本とする。

### Phase 1で販売tableを先行作成

決済provider、返金、税、grant失効等の要件が未確定で、空schemaが将来判断を拘束するため採用しない。

## Consequences

### 良い結果

- public表示と原本・download権限を分離できる。
- 画像を将来再処理できる。
- Libraryを作り直さずgrant modelを追加できる。
- 署名URLにより将来の購入者downloadへ繋げられる。

### 負担

- DBと複数bucketの整合性管理が必要。
- upload完了検証と再試行処理が必要。
- backup、restore、purgeがDBだけでは完結しない。

## Acceptance evidence

- originalとprivate downloadを未認証URLで取得できない。
- public-mediaには公開済みvariantだけが存在する。
- 偽装MIME、oversize、decode不能画像を拒否する。
- `email_gate / paid / restricted`がPhase 1で署名URLを受け取れない。
- `free_download`も非公開、予約前、Trash、`download_enabled = false`なら拒否される。
- 署名URLが短命で、DB、Revision、共有cache、logに残らない。
