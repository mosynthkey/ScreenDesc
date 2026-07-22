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
npm run dev
```

## Model licenses

Section detection uses weights from [docling-project/ScreenParser](https://huggingface.co/docling-project/ScreenParser) (a YOLO11-L UI detector) exported to ONNX (`screenparser.onnx`). The file is not kept in git; it is distributed via a GitHub Release.

| Item | License (upstream) | Reference |
|---|---|---|
| ScreenParser weights | Apache-2.0 | [Hugging Face model card](https://huggingface.co/docling-project/ScreenParser) |
| ScreenParse training data | CC-BY-4.0 | [docling-project/screenparse](https://huggingface.co/datasets/docling-project/screenparse) |
| Ultralytics (YOLO train/export tooling) | AGPL-3.0 | [ultralytics/ultralytics](https://github.com/ultralytics/ultralytics) |

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
  fetch-model.mjs           Fetch ONNX from a Release / URL
  publish-model-release.sh  Publish ONNX to a Release
  export_onnx.py            Trained weights → ONNX
```
