# FUMIBRO deployment runbook

## 原則

ProductionのSupabaseとVercelは、このリポジトリから自動作成しない。Previewで同じmigrationとbuildを検証し、DBを先に前方互換な状態へ更新してから、対応するアプリを公開する。Dashboardだけでschemaを変更しない。

## 初回準備

1. Supabase projectを作成し、public sign-upとanonymous Authを無効化する。
2. 単一Admin userを作り、信頼済み`app_metadata.role`を`admin`に設定する。
3. AdminがTOTPを登録し、AAL2で`/admin`へ入れることを確認する。
4. Vercel projectのNode.js runtimeを24.xへ設定する。
5. `.env.example`の全変数をDevelopment、Preview、Productionへ環境別に登録する。
6. Production secretをPreviewへ流用しない。`SUPABASE_SECRET_KEY`と`VISITOR_HMAC_SECRET`はserver-onlyとする。

## Release手順

固定済みNode/npmを使う。

```bash
nvm use
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Local Supabaseが利用できる場合は、追加で次を実行する。

```bash
npm run db:reset
npm run db:lint
npm run db:test
```

その後に次の順序で進める。

1. 対象Supabase projectとbranchを再確認する。
2. `supabase/migrations`を日時順に適用する。特にPGroonga extensionとindexが成功したことを確認する。
3. RLS、function grant、Storage bucket/policy、Auth設定を確認する。
4. Vercel Previewをdeployする。
5. Previewで公開/予約/hidden/Trash、Admin AAL2、画像、コメント、👍、Contact、Library署名download、RSS、Exportを確認する。
6. Supabase Security AdvisorとPerformance Advisorを確認し、重大項目を解消する。
7. Productionをdeployし、`/robots.txt`、`/sitemap.xml`、`/feed.xml`、`/privacy`を含むsmoke testを行う。

## Migration規則

- 既存列やtypeを同時に破壊的変更しない。expand → application移行 → contractの順にreleaseを分ける。
- Production適用済みmigrationを書き換えない。修正migrationを追加する。
- 長時間lock、大量backfill、index再作成は通常releaseから分離する。
- `service_role`相当の秘密をSQL、log、issue、commitへ貼らない。
- PGroongaが利用できない場合、`ILIKE`へ黙って退行せずreleaseを停止する。

## Rollback

アプリの問題は、DBと互換な直前のVercel deploymentへ戻す。Migrationを即座にdownする運用は基本にしない。DB変更でデータが壊れた疑いがある場合は書込みを止め、[backup-restore.md](./backup-restore.md)に従って非Productionへ復元し、影響を確定してから対応する。

## Release記録

releaseごとにGit commit、Vercel deployment、適用migration、実施者、確認時刻、Advisor結果、backup復元点を記録する。secret、Cookie、署名URL、問い合わせ本文は記録しない。
