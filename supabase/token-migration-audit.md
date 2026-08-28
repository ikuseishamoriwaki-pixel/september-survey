# Token Migration Audit

記録日: 2026-08-28

## 本番適用結果

- Supabase project: `dlymqxjxandoxponairu`
- 適用前バックアップ: 復元可能な全件JSONをOpenPGP対称暗号化（AES-256）してGit対象外へ保存
- `september_survey_people`: 適用前後とも25件
- 名簿内容指紋: `68879ab60161f66835c58656df70c401`
- `september_survey_submissions`: 適用前後とも19件
- 回答内容指紋: `3d4540be55f0fe13f45c2db08d6695dd`
- 実データ値、氏名、メモ、トークン、秘密鍵は監査出力・本資料へ記載していない

## 適用した構成

- `september_survey_access_tokens`を作成し、RLSを有効化
- 有効な回答者23名へ64文字ランダムトークンを発行し、DBにはSHA-256ハッシュだけを保存
- 非表示の回答者2名は専用URL発行対象外
- 配布用一覧は暗号化ファイルとして保存し、DB上の一時暗号化領域は確認後に削除
- `SURVEY_RATE_LIMIT_PEPPER`をEdge Function Secretsへ保存
- `september-survey-response` version 1を`verify_jwt = false`でデプロイ。関数内の専用トークン検証を認証境界とする
- GitHub `main`へ`67d5e3b feat: protect survey responses with access tokens`をpushし、Vercel本番反映を確認
- 公開ブラウザから名簿REST取得と回答REST書込みを削除
- `anon`の名簿SELECT / MAINTAINと回答INSERT / MAINTAINを取り消し、匿名ポリシーを削除

## 本番確認

- 合成モックテスト: 6件成功
- Edge Function: 有効200、無効404、期限切れ404、許可外Origin 403、新規回答201、重複409
- Vercel: トークンなしでは専用URL案内、有効トークンでは本人用フォーム、氏名選択なし
- 最終遮断後もEdge Function経由の専用URLは正常
- publishable keyだけの名簿SELECT: HTTP 401
- publishable keyだけの回答INSERT: HTTP 401
- 合成データ: 人物・トークン・回答とも最終0件
- 適用後の名簿・回答件数と内容指紋: バックアップ時と一致
- Security Advisor: Securityレベルの警告0件。RLS有効・ポリシー0件を示すINFOのみ
- `app.js`、Edge Function handler / entrypointの構文確認、`npm test`、静的ビルド、`git diff --check`: 成功
