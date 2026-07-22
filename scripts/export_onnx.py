"""
Build-time helper: convert docling-project/ScreenParser (best.pt) to browser ONNX.

Keeps the ultralytics (AGPL-3.0) dependency out of the web app.
Run once locally, then place the output at public/models/screenparser.onnx.

    pip install ultralytics
    python scripts/export_onnx.py
"""

from huggingface_hub import hf_hub_download
from ultralytics import YOLO

MODEL_ID = "docling-project/ScreenParser"
IMG_SIZE = 1280

# Ultralytics Hub repo-id resolution fails for this model; download weights explicitly.
weights_path = hf_hub_download(repo_id=MODEL_ID, filename="best.pt", token=False)
model = YOLO(weights_path)

# Verify order matches src/constants/classes.ts CLASS_NAMES.
print("class names (id order):")
for class_id, name in model.names.items():
    print(f"  {class_id}: {name}")

model.export(
    format="onnx",
    imgsz=IMG_SIZE,
    opset=12,       # Prefer compatibility with onnxruntime-web (WebGPU/WASM)
    dynamic=False,  # Fixed shape keeps browser-side handling simple
    simplify=True,
    nms=False,      # NMS runs in src/utils/nms.ts
    half=False,     # Set True to shrink the file if accuracy is acceptable
)

print("\nDone. Move the generated *.onnx to public/models/screenparser.onnx")
print("Then publish once for CI: ./scripts/publish-model-release.sh")
