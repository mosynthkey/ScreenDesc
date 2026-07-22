# ScreenDesc

Vue 3（Composition API）と TypeScript で作った、取扱説明書向けスクリーンショット注釈ツールです。

Illustrator などの汎用イラストツールより、手順番号・引き出し説明の付けに特化した操作を目指しています。

## ライセンス

このソフトウェア（ScreenDesc）は [GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）です。

## 機能

- **画像アップロード**後、ユーザーが範囲を選択 → その中の UI セクションを提案
- **セクション編集**: ドラッグ、リサイズ、追加、削除
- **引き出し説明**（左右余白への自動配置、重なり抑制、引き出し線）
- **番号スタイル**（① / (1) / 1. など）
- **番号の並び替え**
- **書き出し**: PNG / SVG（Exporter インターフェースで将来差し替え可能）

## 起動

```bash
npm install
# ScreenParser ONNX（初回のみ。gitignore 対象）
#   python scripts/export_onnx.py
#   → public/models/screenparser.onnx に配置
# または Release から取得: npm run fetch-model
npm run dev
```

## GitHub Pages デプロイ

`v*` タグ（例: `v0.1.0`）を push したとき、または workflow を手動実行したときに Actions がビルド・公開します（`.github/workflows/deploy-pages.yml`）。

1. GitHub にリポジトリを作成して push
2. モデルを Release に置く（一度だけでよい）:
   ```bash
   ./scripts/publish-model-release.sh
   ```
   タグは既定で `model`、アセット名は `screenparser.onnx`  
   （CI 取得 URL: https://github.com/mosynthkey/ScreenDesc/releases/download/model/screenparser.onnx）
3. GitHub → **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. （任意）Secrets に `VITE_CF_BEACON_TOKEN`、ユーザーサイトなら Variables に `BASE_PATH=/`

ブラウザは Release URL を直接叩かず、**ビルド時に同梱された** `/models/screenparser.onnx` を読みます（CORS 回避）。

## モデルのライセンス

セクション検出に使う重みは [docling-project/ScreenParser](https://huggingface.co/docling-project/ScreenParser)（YOLO11-L ベースの UI 検出器）を ONNX に書き出したものです。Git には含めず、GitHub Release（`screenparser.onnx`）経由で配布します。

| 対象 | ライセンス（上流の表記） | 参照 |
|---|---|---|
| ScreenParser 重み | Apache-2.0 | [Hugging Face モデルカード](https://huggingface.co/docling-project/ScreenParser) |
| 学習データ ScreenParse | CC-BY-4.0 | [docling-project/screenparse](https://huggingface.co/datasets/docling-project/screenparse) |
| Ultralytics（YOLO 学習・書き出しツール） | AGPL-3.0 | [ultralytics/ultralytics](https://github.com/ultralytics/ultralytics) |

補足:

- ブラウザ実行時に載せるのは **ONNX Runtime Web（MIT）** による推論だけです。Ultralytics 本体は Web アプリに同梱しません（`scripts/export_onnx.py` はローカルでの書き出し専用）。
- ScreenParser は Ultralytics YOLO 系をベースにしているため、**再配布・商用利用の扱いについては Ultralytics の AGPL-3.0 / Enterprise 方針も併せて確認してください**。モデルカード上の Apache-2.0 と、ベース実装側の AGPL がどう関係するかは法的解釈の余地があります。本 README はライセンス助言ではありません。
- 論文・出典: [ScreenParse (arXiv:2602.14276)](https://arxiv.org/abs/2602.14276) — IBM Research / ETH Zurich

Release に ONNX を置く場合も、上記の帰属・条件を壊さない範囲で使ってください。

## 作業の流れ

1. スクリーンショットをアップロード
2. 注釈したい範囲をドラッグして選択（その中のセクションを提案）
3. セクションをクリックしてステップを追加
4. 説明を編集し、必要なら位置を調整
5. 書き出し

## 構成

```
src/
  components/     UI とキャンバス
  composables/    注釈プロジェクトの状態
  i18n/           表示ラベル（英語 / 日本語）
  types/          ドメイン型
  utils/
    sectionDetection.ts
    calloutLayout.ts
    export/       PNG / SVG
scripts/
  fetch-model.mjs           Release / URL から ONNX を取得
  publish-model-release.sh  Release に ONNX を公開
  export_onnx.py            学習済み重み → ONNX
```
