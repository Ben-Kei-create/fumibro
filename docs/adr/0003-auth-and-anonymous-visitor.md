# ADR-0003: Supabase Auth + TOTPと匿名visitor cookieを分離して使う

- 状態: Accepted
- 決定日: 2026-08-27
- 対象: Admin認証、unique visitor、👍

## Context

FUMIBROのAdminは管理者1名だけが使用する。一方、一般閲覧者はaccountなしでコメントと👍を利用できる。アクセスカウンターはPVではなく、サイト全体とProjectごとのベストエフォートunique browser数を示したい。

一般閲覧者へloginを要求するのは過剰だが、IPやbrowser fingerprintを永続保存して厳密な人物追跡をすることも目的に反する。Adminの強い認証と閲覧者の匿名識別を同じ仕組みにしてはならない。

## Decision

### Admin

- Supabase Authのメール・パスワードを使用する。
- CookieベースSSRは`@supabase/ssr`を使用する。
- 公開signup、匿名Auth、不要なOAuth providerを無効にする。
- `app_metadata.role = 'admin'`を認可に使う。`user_metadata`は認可に使わない。
- TOTP MFAを必須とし、Adminの保護操作はAAL2を要求する。
- AAL2 sessionが継続中ならQuick投稿ごとのTOTP再入力は不要。
- 完全削除等の危険操作は追加確認または再認証を要求する。
- Proxyはcookie更新と楽観的redirectのみ。最終認可はAction、Handler、DAL、RLSで行う。

### 一般閲覧者

ランダムなfirst-party visitor cookieを発行する。cookieは認証credentialではなく、unique counterと👍重複抑制だけに使う。

- 生成には暗号学的乱数を使う。
- productionでは`Secure`、`SameSite=Lax`、`Path=/`を設定する。
- JavaScriptから読む必要がない設計では`HttpOnly`とする。
- DBへcookie生値を保存しない。
- server側secretとscopeを用いてHMAC化する。
- scopeは少なくとも`site`、`project:<id>`、`like:<post-id>`を分ける。
- 生IP、User-Agent履歴、fingerprintを永続保存しない。

### DB一意性

- `site_unique_visitors.visitor_hash`を一意にする。
- `project_unique_visitors(project_id, visitor_hash)`を一意にする。
- `post_likes(post_content_item_id, visitor_hash)`を一意にする。
- insertが初めて成功した場合だけ派生counterを増やす。

同じ人でもcookie削除、別browser、cookie拒否により再計上される。これを「一意人物数」や厳密な本人確認と表現しない。

## Privacy判断

- visitor cookieの目的を`/privacy`へ記載する。
- HMAC化していても、匿名IDを絶対に個人情報ではないと断定しない。
- 広告profile、cross-site tracking、fingerprintingへ再利用しない。
- logへcookie、HMAC、IPを不必要に出さない。
- HMAC secretのrotationで再計上が起こり得るため、rotation時のcounter影響を運用記録へ残す。

## Rejected alternatives

### IP addressでunique判定

共有回線、動的IP、VPNで精度が低く、不要なnetwork identifierを保持するため採用しない。

### Browser fingerprint

追跡性とPrivacy負担が目的に対して過大なため採用しない。

### 一般閲覧者account

コメントと👍に対して登録負担が大きいためPhase 1では採用しない。

### localStorageだけで重複防止

server側で一意制約を強制できず、改ざんが容易なため正本にはしない。

## Consequences

### 良い結果

- AdminはTOTPで強く保護される。
- 一般閲覧者はaccountなしで参加できる。
- 生IPやfingerprintを保存せず、PVではない概算counterを作れる。
- 同じ匿名visitor機構を👍へ再利用できる。

### 負担

- unique visitorは厳密な人数ではない。
- HMAC secretを安全かつ安定して管理する必要がある。
- cookie無効環境での計上方針をUIとPrivacyで説明する必要がある。

## Acceptance evidence

- 同じcookieでsite claimを繰り返しても1件。
- 同じcookieで同一Project claimを繰り返しても1件、別Projectは各1件。
- 同じcookieで同一投稿へ👍を繰り返しても1件。
- DB、application log、exportにcookie生値や生IPがない。
- AAL1と非AdminがAdmin Action、Export、upload、完全削除を実行できない。
