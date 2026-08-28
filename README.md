# 9月通常授業アンケート

講師・生徒から、9月以降の通常授業で来られる日時を集めるための回答アプリです。

## 現在の方式

- 回答者ごとの専用URL `?token=...` から開く
- データベースにはトークン本体ではなくSHA-256ハッシュだけを保存する
- Edge Functionがトークンを検証し、本人の名前・区分・学年だけを返す
- 回答送信もEdge Function経由で行い、氏名と区分はトークンの対象者から決定する
- 回答は新規送信のみ。同じ回答者の再回答は管理者へ連絡する
- 公開ページに名簿一覧、回答結果、回答削除、名簿編集を置かない

トークンがないURL、無効・期限切れのトークンでは回答フォームを表示しません。専用URLは個人情報と同様に扱い、本人以外へ共有しないでください。

## 本番適用状況

2026-08-28に本番移行を完了しました。

- 名簿25件・回答19件を復元可能な暗号化JSONとして退避し、復号後の件数・内容指紋を確認した
- 有効な回答者23名へ専用URLを発行し、非表示の2名は対象外とした
- `september-survey-response` Edge Functionを本番へデプロイした
- GitHub `main` の `67d5e3b` をVercelへ反映した
- `anon`の名簿SELECTと回答INSERTを停止し、publishable keyだけの直接アクセスがHTTP 401になることを確認した
- 専用URL経由では本人の最小情報取得、回答、新規回答の重複拒否が引き続き動作する
- 合成テストデータを全て削除し、名簿25件・回答19件と内容指紋が退避時から変わっていないことを確認した

専用URL一覧はGit対象外の暗号化ファイルとしてローカル保管します。氏名、URL、トークン、秘密鍵をログやGitへ出してはいけません。

## 構成

- `app.js`: トークン式の公開回答画面
- `supabase/functions/september-survey-response/`: トークン照合・回答保存・レート制限
- `supabase/create-token-access.sql`: トークン表とレート制限の準備
- `supabase/issue-survey-tokens.sql`: 有効な回答者へ専用URLを一度だけ発行
- `supabase/finalize-token-access.sql`: 公開ブラウザから名簿・回答テーブルへの直接権限を停止
- `supabase/schema.sql`: 恒久対応後の最終権限を含む新規構築用スキーマ

## 本番移行手順

順番を変更すると回答フォームが停止するため、次の順で行います。

1. 名簿・回答データを安全な場所へ退避し、件数と内容指紋を記録する
2. `create-token-access.sql`を適用する
3. Edge Functionへ`SURVEY_RATE_LIMIT_PEPPER`を設定する
4. `september-survey-response`を`verify_jwt = false`でデプロイする
5. `issue-survey-tokens.sql`を管理者権限で実行し、専用URLを安全に配布する
6. 合成トークンで本人情報取得・新規回答・重複拒否・期限切れを確認する
7. GitHubとVercelへトークン式フォームを反映する
8. 公開画面の動作確認後、`finalize-token-access.sql`を適用する
9. 匿名の名簿SELECTと回答INSERTが401または403になることを確認する
10. Security Advisorとデータ件数・内容指紋を再確認する

この手順は2026-08-28に順番どおり実施済みです。再発行や権限変更を行う場合も、同じ停止条件と確認順を維持します。

## Edge Functionの秘密情報

Edge FunctionではSupabaseが提供する`SUPABASE_URL`と`SUPABASE_SECRET_KEYS`を使用します。旧環境では`SUPABASE_SERVICE_ROLE_KEY`へフォールバックします。これらをブラウザ、Git、Vercelの静的ファイルへ追加してはいけません。

`SURVEY_RATE_LIMIT_PEPPER`には十分に長いランダム値を設定します。この値もGitへ保存しません。CORSの許可元は既定で`https://september-survey.vercel.app`だけです。

## ローカル確認

```powershell
npm test
npm run build
node --check app.js
node --check supabase/functions/september-survey-response/handler.js
```

テストは合成データと通信モックだけを使用し、実名簿・実回答を変更しません。
