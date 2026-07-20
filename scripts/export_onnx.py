"""
docling-project/ScreenParser (best.pt) を、ブラウザ推論用のONNXに変換するスクリプト。

このスクリプトは開発者のローカル環境で一度だけ実行するビルド時ツールであり、
`ultralytics`(AGPL-3.0)への依存はここに閉じ込め、Webアプリ本体には含めない。

事前準備:
    pip install ultralytics

実行:
    python scripts/export_onnx.py
    # 生成された screenparser.onnx を public/models/ に配置する
"""

from huggingface_hub import hf_hub_download
from ultralytics import YOLO

MODEL_ID = "docling-project/ScreenParser"
IMG_SIZE = 1280

# YOLO("docling-project/ScreenParser") のHub直接指定はultralytics側のrepo-id解決に失敗するため、
# huggingface_hubで重みファイルを明示的にダウンロードしてローカルパスから読み込む。
weights_path = hf_hub_download(repo_id=MODEL_ID, filename="best.pt", token=False)
model = YOLO(weights_path)

# クラスID -> クラス名の対応。src/constants/classes.ts の CLASS_NAMES と
# 順序が一致しているか必ず確認すること。
print("class names (id順):")
for class_id, name in model.names.items():
    print(f"  {class_id}: {name}")

model.export(
    format="onnx",
    imgsz=IMG_SIZE,
    opset=12,       # onnxruntime-web(WebGPU/WASM)との互換性を優先したopset
    dynamic=False,  # 固定形状の方がブラウザ側の実装・最適化がシンプルになる
    simplify=True,
    nms=False,      # NMSはブラウザ側(src/utils/nms.ts)で行う
    half=False,     # 半精度が必要ならTrueにしてサイズを削減(要精度検証)
)

print("\n変換完了。生成された *.onnx ファイルを public/models/screenparser.onnx として配置してください。")
