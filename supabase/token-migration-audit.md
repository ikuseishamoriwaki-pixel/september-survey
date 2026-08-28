# Token Migration Audit

記録日: 2026-08-28

## 本番適用前の状態

- Supabase project: `dlymqxjxandoxponairu`
- `september_survey_people`: 25件
- 名簿内容指紋: `60fbaab46cf70bd4dde9065be53d024e`
- `september_survey_submissions`: 19件
- 回答内容指紋: `e13e19e2cf16fa2936911a68c68fa093`
- 実データ値は監査出力・本資料へ記載していない

現在の匿名権限:

- `september_survey_people`: SELECT / MAINTAIN
- `september_survey_submissions`: INSERT
- 両テーブルともRLS有効
- `september_survey_access_tokens`: 本番未作成
- Edge Function: 本番未デプロイ

## ローカル実装確認

- 合成モックテスト: 6件成功
- `app.js`構文確認: 成功
- Edge Function handler構文確認: 成功
- Edge Function entrypoint構文確認: 成功
- 静的配布ビルド: 成功
- `git diff --check`: 成功
- 専用URLなし画面: 回答フォームを表示せず案内を表示
- Security Advisor: Security警告0件

## 本番適用の停止条件

- 復元可能な名簿・回答全件バックアップが未取得
- ローカルにSupabase CLIがなく、確認用ブラウザのSupabase管理画面も未ログインだったため、個人情報をログへ出さない全件エクスポート経路を利用できなかった
- `SURVEY_RATE_LIMIT_PEPPER`が未設定
- トークン基盤SQLが未適用
- Edge Functionが未デプロイ
- 専用URLが未発行・未配布
- GitHubとVercelは未更新

上記を解消し、ユーザー承認を得るまで本番変更を行わない。
