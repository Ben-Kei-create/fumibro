# FUMIBRO backup and restore runbook

## 対象と責任

復旧には、次の3層がすべて必要である。

1. PostgreSQL: コンテンツ、Revision、設定、権限構造
2. Storage: `private-originals`、`public-media`、`private-downloads`のobject bytes
3. Portable export: AdminのCSV / JSON（移行・内容確認用で、DB完全backupの代替ではない）

Production開始前に保持期間、実行頻度、保存先、暗号化、復元担当を決める。DB backupとStorage copyを同じ場所・同じcredentialだけに依存させない。

## PostgreSQL backup

Supabase planで利用できるmanaged backupとPoint-in-Time Recoveryを有効化する。加えてrelease前や定期検証用に、接続先を明示したcustom-format dumpを取得できる。

```bash
export FUMIBRO_DB_URL='postgresql://...'
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=fumibro-db-YYYYMMDD.dump \
  --dbname="$FUMIBRO_DB_URL"
```

接続文字列をshell history、CI log、READMEへ残さない。生成物にはContactのメールアドレス等が含まれるため、暗号化し、アクセスを管理し、保持期限後に安全に破棄する。

## Storage backup

3 bucketを非公開のbackup先へobject pathを維持してcopyする。最低限、bucket、object path、byte size、checksum、取得時刻のmanifestを同時に保存する。

- `private-originals`: 元画像
- `public-media`: 再生成可能だが復旧時間短縮のため保持
- `private-downloads`: PDF・ZIP。公開bucketへcopyしない

署名URLはbackupしない。URLは一時credentialであり、復旧後に新しく発行する。object listやprivate file名を公開logへ出さない。

## Admin portable export

`/admin/exports`から次をCSVとJSONの両方で定期取得する。

- Blog
- Projects masterと各Projectコンテンツ
- Library
- Works
- Portfolio projection

JSONの`schemaVersion`、`exportedAt`、stable ID、`source_system`、`source_external_id`を保持する。CSVは表計算での確認用、JSONは将来のimport/migration用とする。

## Restore rehearsal

復元は、必ず対象を明示した空の非Production projectで練習する。Productionへ直接`--clean` restoreしない。

```bash
export FUMIBRO_RESTORE_DB_URL='postgresql://...non-production...'
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$FUMIBRO_RESTORE_DB_URL" \
  fumibro-db-YYYYMMDD.dump
```

復元後は次の順で検証する。

1. Migration履歴、extension、RLS、function grant、seedのsystem Pageを確認する。
2. Storage bytesを同じbucket/object pathへ戻し、manifestのsize/checksumと照合する。
3. public-mediaだけがpublicで、private bucketが匿名取得できないことを確認する。
4. Admin AAL2、公開/予約/hidden/Trash、Revision、画像、Library download、RSS、Exportを確認する。
5. Contact等の個人データを扱う復元環境へのアクセスを制限し、検証後に削除する。

## 完全削除との関係

完全削除はStorage削除manifestを持つretryable purge jobとして実行される。完了したpurgeは通常UIから戻せない。backup保持期間中はbackupに残り得ることをPrivacy運用と削除依頼対応で説明し、保持期限に従って消去する。

backupは「取得成功」だけでは不十分である。四半期ごと、または大きなMigration前にrestore rehearsalを行い、所要時間と不足objectを記録する。
