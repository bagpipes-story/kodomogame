# CHANGELOG — こどもゲームボックス

## v0.1 (2026-08-28)

- 目的: 共通シェル（ホーム画面・画面遷移・デザイントークン・効果音基盤・storage.js）を作る
- 変更点:
  - index.html … ホーム画面（5ゲームのボタン）＋ダミー画面のSPA構成。フッターにバージョン表示
  - css/common.css … デザイントークン（配色・角丸・最小タップ60px・最小フォント20px）、押下アニメ（transformのみ）
  - js/app.js … 画面遷移（hidden切り替え）、ゲーム一覧の生成、ミュートボタン制御
  - js/storage.js … localStorageラッパー（try/catch保護、初期値フォールバック、kgb.settings / kgb.stats）
  - js/sound.js … Web Audio効果音基盤（tap / buzzer）＋ミュート状態の保存
  - js/i18n.js … UI文言の一元管理（ひらがな・カタカナのみ）
  - tests/storage.test.js … storage.jsのNodeテスト（`node tests/storage.test.js`）
  - package.json … Nodeテスト用のESM設定のみ（ビルドツールは不使用）
- 既知の制約:
  - 効果音はWeb Audioの合成音（仮）。音声ファイル同梱は後のバージョンで検討
  - ゲームアイコンは絵文字の仮表示。SVGアイコンはv0.7で差し替え予定
  - PWA（manifest / Service Worker）はv0.7で導入するため、現時点ではオフライン動作しない
- 実機確認の観点（iPhone Safari）:
  - [ ] ホーム画面が表示され、5つのボタンからダミー画面に遷移して「←」で戻れる
  - [ ] ミュートボタンで🔊/🔇が切り替わり、リロード後も状態が残る
  - [ ] タップ音が鳴る（ミュート時は鳴らない）
  - [ ] 375px幅（SE2）で文字・ボタンがはみ出さない
