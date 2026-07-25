# ScreenDesc

A screenshot annotation tool for manuals.
It uses AI-assisted UI element detection so you can create annotated images with simple controls.

## License

This software (ScreenDesc) is released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

## Try it

Launch the web app here:
https://mosynthkey.github.io/ScreenDesc/

## Build from source

```bash
npm install
# ScreenParser ONNX (first time only; gitignored)
#   python scripts/export_onnx.py
#   → place at public/models/screenparser.onnx
# Or fetch from the Release: npm run fetch-model
# PaddleOCR text detection/recognition models (first time only; gitignored)
npm run fetch-ocr-model
npm run dev
```

`npm install` also runs `postinstall` (`scripts/copy-ort-assets.mjs`), which copies the ONNX Runtime Web WASM binary from `node_modules` into `public/ort/` so OCR can load it same-origin instead of from a CDN.

## Desktop app (experimental)

Wraps the built app in a native window via Deno's experimental [`deno desktop`](https://docs.deno.com/runtime/desktop/) (requires Deno ≥ 2.9; `deno upgrade` to update).

```bash
npm run desktop:run      # build + launch a native window
npm run desktop:package  # build + output a distributable binary to dist-desktop/
```

There's no dev-server/HMR integration; after code changes, rerun `npm run desktop:run`.

For a signed & notarized `.dmg` (requires the `Developer ID Application: Masaki Ono` certificate and the `Melissa` notarytool keychain profile): `npm run desktop:release:macos`. Run a single step with `deno run -A installer/macos/release.ts <build|sign|dmg|notarize|staple|verify|clean>`.

## Model licenses

Section detection uses weights from [docling-project/ScreenParser](https://huggingface.co/docling-project/ScreenParser) (a YOLO11-L UI detector) exported to ONNX (`screenparser.onnx`). The file is not kept in git; it is distributed via a GitHub Release.

OCR uses [PaddleOCR.js](https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js) (`@paddleocr/paddleocr-js`) running the official **PP-OCRv6_small** text detection + recognition ONNX models in-browser (`lang: "japan"`). The model files are not kept in git; `npm run fetch-ocr-model` downloads them directly from PaddlePaddle's official model host into `public/models/paddleocr/`:
- `PP-OCRv6_small_det_onnx_infer.tar` — https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_onnx_infer.tar
- `PP-OCRv6_small_rec_onnx_infer.tar` — https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_rec_onnx_infer.tar

| Item | License (upstream) | Reference |
|---|---|---|
| ScreenParser weights | Apache-2.0 | [Hugging Face model card](https://huggingface.co/docling-project/ScreenParser) |
| ScreenParse training data | CC-BY-4.0 | [docling-project/screenparse](https://huggingface.co/datasets/docling-project/screenparse) |
| Ultralytics (YOLO train/export tooling) | AGPL-3.0 | [ultralytics/ultralytics](https://github.com/ultralytics/ultralytics) |
| PaddleOCR / PaddleOCR.js / PP-OCRv6 weights | Apache-2.0 | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) |

## Layout

```
src/
  components/     UI and canvas
  composables/    Annotation project state
  i18n/           UI copy (English / Japanese)
  types/          Domain types
  utils/
    sectionDetection.ts
    calloutLayout.ts
    export/       PNG / SVG
scripts/
  fetch-model.mjs           Fetch section-detection ONNX from a Release / URL
  fetch-ocr-model.mjs       Fetch PaddleOCR det/rec models
  copy-ort-assets.mjs       Copy onnxruntime-web WASM into public/ort (postinstall)
  publish-model-release.sh  Publish ONNX to a Release
  export_onnx.py            Trained weights → ONNX
```
