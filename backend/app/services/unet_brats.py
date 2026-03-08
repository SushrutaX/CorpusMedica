import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import cv2
import nibabel as nib
import numpy as np
from skimage.measure import label

from app.services.models_registry import ModelSpec
from app.services.storage import ensure_dir

IMG_SIZE = 128
VOLUME_SLICES = 100
VOLUME_START_AT = 22
_MODEL_CACHE: Dict[str, Any] = {}


def _import_tensorflow() -> Any:
    try:
        import tensorflow as tf
    except ImportError as exc:  # pragma: no cover - runtime dependency
        raise RuntimeError(
            "TensorFlow is required for the U-Net tumor model runner. "
            "Install tensorflow/tensorflow-cpu in the backend environment."
        ) from exc
    return tf


def _build_unet_upsample(
    tf: Any,
    in_channels: int = 2,
    base_filters: int = 32,
    out_channels: int = 4,
    dropout: float = 0.2,
) -> Any:
    f = base_filters
    inputs = tf.keras.layers.Input((IMG_SIZE, IMG_SIZE, in_channels))

    conv1 = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(inputs)
    conv1 = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv1)

    pool = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv1)
    conv = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(pool)
    conv = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv)

    pool1 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv)
    conv2 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(pool1)
    conv2 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv2)

    pool2 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv2)
    conv3 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(pool2)
    conv3 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv3)

    pool4 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv3)
    conv5 = tf.keras.layers.Conv2D(
        f * 16, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(pool4)
    conv5 = tf.keras.layers.Conv2D(
        f * 16, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv5)
    drop5 = tf.keras.layers.Dropout(dropout)(conv5)

    up7 = tf.keras.layers.Conv2D(
        f * 8, 2, activation="relu", padding="same", kernel_initializer="he_normal"
    )(tf.keras.layers.UpSampling2D(size=(2, 2))(drop5))
    merge7 = tf.keras.layers.concatenate([conv3, up7], axis=3)
    conv7 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(merge7)
    conv7 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv7)

    up8 = tf.keras.layers.Conv2D(
        f * 4, 2, activation="relu", padding="same", kernel_initializer="he_normal"
    )(tf.keras.layers.UpSampling2D(size=(2, 2))(conv7))
    merge8 = tf.keras.layers.concatenate([conv2, up8], axis=3)
    conv8 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(merge8)
    conv8 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv8)

    up9 = tf.keras.layers.Conv2D(
        f * 2, 2, activation="relu", padding="same", kernel_initializer="he_normal"
    )(tf.keras.layers.UpSampling2D(size=(2, 2))(conv8))
    merge9 = tf.keras.layers.concatenate([conv, up9], axis=3)
    conv9 = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(merge9)
    conv9 = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv9)

    up = tf.keras.layers.Conv2D(
        f, 2, activation="relu", padding="same", kernel_initializer="he_normal"
    )(tf.keras.layers.UpSampling2D(size=(2, 2))(conv9))
    merge = tf.keras.layers.concatenate([conv1, up], axis=3)
    conv = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(merge)
    conv = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(conv)
    activation = "sigmoid" if out_channels == 1 else "softmax"
    conv10 = tf.keras.layers.Conv2D(out_channels, (1, 1), activation=activation)(conv)

    return tf.keras.Model(inputs=inputs, outputs=conv10)


def _build_unet_transpose(
    tf: Any,
    in_channels: int = 3,
    base_filters: int = 16,
    out_channels: int = 1,
) -> Any:
    f = base_filters
    inputs = tf.keras.layers.Input((IMG_SIZE, IMG_SIZE, in_channels))

    c1 = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(inputs)
    c1 = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c1)
    p1 = tf.keras.layers.MaxPooling2D((2, 2))(c1)

    c2 = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(p1)
    c2 = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c2)
    p2 = tf.keras.layers.MaxPooling2D((2, 2))(c2)

    c3 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(p2)
    c3 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c3)
    p3 = tf.keras.layers.MaxPooling2D((2, 2))(c3)

    c4 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(p3)
    c4 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c4)
    p4 = tf.keras.layers.MaxPooling2D((2, 2))(c4)

    c5 = tf.keras.layers.Conv2D(
        f * 16, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(p4)
    c5 = tf.keras.layers.Conv2D(
        f * 16, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c5)

    u6 = tf.keras.layers.Conv2DTranspose(f * 8, (2, 2), strides=(2, 2), padding="same")(c5)
    u6 = tf.keras.layers.concatenate([u6, c4])
    c6 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(u6)
    c6 = tf.keras.layers.Conv2D(
        f * 8, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c6)

    u7 = tf.keras.layers.Conv2DTranspose(f * 4, (2, 2), strides=(2, 2), padding="same")(c6)
    u7 = tf.keras.layers.concatenate([u7, c3])
    c7 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(u7)
    c7 = tf.keras.layers.Conv2D(
        f * 4, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c7)

    u8 = tf.keras.layers.Conv2DTranspose(f * 2, (2, 2), strides=(2, 2), padding="same")(c7)
    u8 = tf.keras.layers.concatenate([u8, c2])
    c8 = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(u8)
    c8 = tf.keras.layers.Conv2D(
        f * 2, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c8)

    u9 = tf.keras.layers.Conv2DTranspose(f, (2, 2), strides=(2, 2), padding="same")(c8)
    u9 = tf.keras.layers.concatenate([u9, c1])
    c9 = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(u9)
    c9 = tf.keras.layers.Conv2D(
        f, 3, activation="relu", padding="same", kernel_initializer="he_normal"
    )(c9)

    activation = "sigmoid" if out_channels == 1 else "softmax"
    outputs = tf.keras.layers.Conv2D(out_channels, (1, 1), activation=activation)(c9)
    return tf.keras.Model(inputs=inputs, outputs=outputs)


def _inspect_h5_weights(weights_path: Path) -> Optional[Dict[str, int]]:
    try:
        import h5py
    except ImportError:
        return None

    try:
        with h5py.File(str(weights_path), "r") as handle:
            model_weights = handle.get("model_weights")
            if model_weights is None:
                return None
            first_kernel = model_weights.get("conv2d/conv2d/kernel:0")
            if first_kernel is None:
                return None
            if len(first_kernel.shape) != 4:
                return None
            in_channels = int(first_kernel.shape[2])
            base_filters = int(first_kernel.shape[3])

            transpose_arch = "conv2d_transpose" in model_weights
            last_conv_name = "conv2d_18" if "conv2d_18" in model_weights else None
            if not last_conv_name:
                conv_names = sorted(
                    [name for name in model_weights.keys() if name.startswith("conv2d_")]
                )
                last_conv_name = conv_names[-1] if conv_names else None
            if not last_conv_name:
                return None
            last_kernel = model_weights.get(f"{last_conv_name}/{last_conv_name}/kernel:0")
            if last_kernel is None or len(last_kernel.shape) != 4:
                return None
            out_channels = int(last_kernel.shape[3])

            return {
                "in_channels": in_channels,
                "base_filters": base_filters,
                "out_channels": out_channels,
                "transpose_arch": 1 if transpose_arch else 0,
            }
    except Exception:
        return None


def _load_model(weights_path: Path) -> Tuple[Any, int]:
    cache_key = str(weights_path.resolve())
    cached = _MODEL_CACHE.get(cache_key)
    if cached is not None:
        return cached, int(getattr(cached, "input_shape", [None, None, None, 2])[-1] or 2)

    tf = _import_tensorflow()
    suffix = weights_path.suffix.lower()
    if suffix in {".keras", ".h5"}:
        try:
            model = tf.keras.models.load_model(str(weights_path), compile=False)
        except Exception:
            # Some .h5 files store weights-only checkpoints, so fallback to architecture + load_weights.
            signature = _inspect_h5_weights(weights_path)
            if signature and signature.get("transpose_arch") == 1:
                model = _build_unet_transpose(
                    tf,
                    in_channels=int(signature["in_channels"]),
                    base_filters=int(signature["base_filters"]),
                    out_channels=int(signature["out_channels"]),
                )
            elif signature:
                model = _build_unet_upsample(
                    tf,
                    in_channels=int(signature["in_channels"]),
                    base_filters=int(signature["base_filters"]),
                    out_channels=int(signature["out_channels"]),
                )
            else:
                model = _build_unet_upsample(tf, in_channels=2, base_filters=32, out_channels=4)
            model.load_weights(str(weights_path))
    else:
        model = _build_unet_upsample(tf, in_channels=2, base_filters=32, out_channels=4)
        model.load_weights(str(weights_path))
    _MODEL_CACHE[cache_key] = model
    input_channels = int(getattr(model, "input_shape", [None, None, None, 2])[-1] or 2)
    return model, input_channels


def _find_modality_path(paths: List[str], modality: str) -> Optional[str]:
    pattern = re.compile(modality, flags=re.IGNORECASE)
    for path in paths:
        if pattern.search(Path(path).name):
            return path
    return None


def _modality_lookup(input_paths: List[str]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for path in input_paths:
        name = Path(path).name.lower()
        if "flair" in name:
            result["flair"] = path
        elif "t1ce" in name or "t1c" in name:
            result["t1ce"] = path
        elif re.search(r"(^|[^a-z0-9])t1($|[^a-z0-9])", name):
            result["t1"] = path
        elif "t2" in name:
            result["t2"] = path
    return result


def _extract_modalities_from_list(input_paths: List[str], channels: int) -> List[str]:
    lookup = _modality_lookup(input_paths)
    if channels == 3:
        # This checkpoint was trained on 3-channel RGB-like inputs.
        # For BraTS-style inputs, this calibrated order is the most stable:
        # Flair, T1ce, T1 (fallback to T2 when T1 is unavailable).
        if {"flair", "t1ce", "t1"}.issubset(lookup):
            return [lookup["flair"], lookup["t1ce"], lookup["t1"]]
        if {"flair", "t1ce", "t2"}.issubset(lookup):
            return [lookup["flair"], lookup["t1ce"], lookup["t2"]]

    preferred_patterns = [r"flair", r"t1ce|t1c", r"(^|[^a-z0-9])t1($|[^a-z0-9])", r"t2"]
    picked: List[str] = []
    used = set()
    for pattern in preferred_patterns:
        candidate = _find_modality_path(input_paths, pattern)
        if candidate and candidate not in used:
            picked.append(candidate)
            used.add(candidate)
        if len(picked) >= channels:
            return picked[:channels]
    for path in sorted(input_paths):
        if path in used:
            continue
        picked.append(path)
        used.add(path)
        if len(picked) >= channels:
            return picked[:channels]
    raise ValueError(
        f"U-Net tumor runner expects {channels} modality channel(s), "
        f"but only {len(input_paths)} file(s) were provided."
    )


def _prepare_modalities(
    input_item: Union[str, List[str]],
    channels: int,
) -> Tuple[List[np.ndarray], nib.Nifti1Image]:
    if isinstance(input_item, list):
        selected = _extract_modalities_from_list(input_item, channels)
        images = [nib.load(path) for path in selected]
        arrays = [img.get_fdata().astype(np.float32) for img in images]
        base_shape = arrays[0].shape
        base_affine = images[0].affine
        if len(base_shape) != 3:
            raise ValueError(
                f"Expected 3D modality volumes. Got shape {base_shape}."
            )
        for arr, img in zip(arrays[1:], images[1:]):
            if arr.shape != base_shape:
                raise ValueError("All modality volumes must share the same shape.")
            if not np.allclose(img.affine, base_affine):
                raise ValueError("All modality volumes must share the same affine.")
        return arrays, images[0]

    image = nib.load(input_item)
    data = image.get_fdata().astype(np.float32)
    if data.ndim != 4 or data.shape[-1] < channels:
        raise ValueError(
            f"U-Net tumor runner expects {channels} channels, "
            f"but input has shape {data.shape}."
        )
    arrays = [data[..., idx] for idx in range(channels)]
    return arrays, image


def _window_for_depth(depth: int) -> Tuple[int, int]:
    if depth <= 0:
        raise ValueError("Input volume has no slices.")
    max_start = max(depth - VOLUME_SLICES, 0)
    start = min(VOLUME_START_AT, max_start)
    count = min(VOLUME_SLICES, depth - start)
    if count <= 0:
        raise ValueError("Unable to determine a valid slice window for inference.")
    return start, count


def _prepare_unet_input(modalities: List[np.ndarray]) -> Tuple[np.ndarray, int, int]:
    depth = int(modalities[0].shape[2])
    channels = len(modalities)
    start, count = _window_for_depth(depth)
    x = np.zeros((count, IMG_SIZE, IMG_SIZE, channels), dtype=np.float32)
    for i in range(count):
        z = start + i
        for channel, modality in enumerate(modalities):
            x[i, :, :, channel] = cv2.resize(
                modality[:, :, z], (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_LINEAR
            )
    scale = float(np.max(np.abs(x)))
    if scale > 0:
        x /= scale
    return x, start, count


def _predict_with_tta(model_instance: Any, x: np.ndarray) -> np.ndarray:
    preds = [model_instance.predict(x, verbose=0)]
    # Horizontal flip TTA.
    x_lr = np.flip(x, axis=2)
    pred_lr = model_instance.predict(x_lr, verbose=0)
    preds.append(np.flip(pred_lr, axis=2))
    # Vertical flip TTA.
    x_ud = np.flip(x, axis=1)
    pred_ud = model_instance.predict(x_ud, verbose=0)
    preds.append(np.flip(pred_ud, axis=1))
    return np.mean(np.stack(preds, axis=0), axis=0)


def _restore_mask_to_volume(
    prediction: np.ndarray,
    shape: Tuple[int, int, int],
    start: int,
    binary_threshold: float = 0.5,
) -> np.ndarray:
    if prediction.ndim != 4:
        raise ValueError(f"Unexpected prediction shape: {prediction.shape}")
    if prediction.shape[-1] == 1:
        class_map = (prediction[..., 0] > binary_threshold).astype(np.uint8)
    else:
        class_map = np.argmax(prediction, axis=-1).astype(np.uint8)
    height, width, depth = shape
    restored = np.zeros((height, width, depth), dtype=np.uint8)
    for i in range(class_map.shape[0]):
        z = start + i
        if z >= depth:
            break
        resized = cv2.resize(
            class_map[i], (width, height), interpolation=cv2.INTER_NEAREST
        ).astype(np.uint8)
        if prediction.shape[-1] > 1:
            # Keep BraTS-compatible labels {0,1,2,4} where class 3 maps to label 4.
            resized[resized == 3] = 4
        restored[:, :, z] = resized
    return restored


def _postprocess_binary_mask(mask: np.ndarray, min_voxels: int = 256) -> np.ndarray:
    labeled = label(mask > 0, connectivity=1)
    if labeled.max() == 0:
        return mask.astype(np.uint8)
    counts = np.bincount(labeled.ravel())
    counts[0] = 0
    largest = int(np.argmax(counts))
    largest_size = int(counts[largest])
    if largest_size < min_voxels:
        return np.zeros_like(mask, dtype=np.uint8)
    cleaned = (labeled == largest).astype(np.uint8)
    return cleaned


def run_keras_unet_brats(
    model: ModelSpec,
    input_item: Union[str, List[str]],
    output_dir: str,
    job_id: str,
) -> Tuple[str, str, float]:
    weights_path = Path(model.weights_path)
    if not weights_path.is_file():
        raise FileNotFoundError(
            f"U-Net weights not found: {weights_path}. "
            "Place the trained weights at the configured path."
        )

    model_instance, input_channels = _load_model(weights_path)
    if isinstance(input_item, list):
        selected_input_paths = _extract_modalities_from_list(input_item, input_channels)
    else:
        selected_input_paths = [f"channel_{idx}" for idx in range(input_channels)]
    modalities, reference_image = _prepare_modalities(input_item, input_channels)

    x, start, count = _prepare_unet_input(modalities)
    use_tta = os.getenv("UNET_USE_TTA", "false").strip().lower() in {"1", "true", "yes", "on"}
    if use_tta:
        prediction = _predict_with_tta(model_instance, x)
    else:
        prediction = model_instance.predict(x, verbose=0)
    prediction_max_prob = float(np.max(prediction))
    prediction_mean_prob = float(np.mean(prediction))
    binary_threshold = float(min(1.0, max(0.0, model.threshold)))
    mask = _restore_mask_to_volume(
        prediction,
        modalities[0].shape,
        start,
        binary_threshold=binary_threshold,
    )
    if prediction.shape[-1] == 1:
        mask = _postprocess_binary_mask(mask, min_voxels=256)

    output_path = Path(output_dir)
    ensure_dir(str(output_path))
    mask_path = output_path / "mask.nii.gz"
    report_path = output_path / "report.json"
    nib.save(
        nib.Nifti1Image(mask, reference_image.affine, reference_image.header),
        str(mask_path),
    )

    voxel_volume_mm3 = float(np.prod(reference_image.header.get_zooms()[:3]))
    tumor_volume_cm3 = float((mask > 0).sum() * voxel_volume_mm3 / 1000.0)
    positive_voxels = int((mask > 0).sum())
    report = {
        "job_id": job_id,
        "model_id": model.id,
        "modality": model.modality,
        "input_path": input_item,
        "mask_path": str(mask_path),
        "tumor_volume_cm3": tumor_volume_cm3,
        "positive_voxels": positive_voxels,
        "voxel_volume_mm3": voxel_volume_mm3,
        "dimensions": list(mask.shape),
        "runner": "keras_unet_brats",
        "slice_start": start,
        "slice_count": count,
        "input_channels": input_channels,
        "binary_threshold": binary_threshold,
        "prediction_max_prob": prediction_max_prob,
        "prediction_mean_prob": prediction_mean_prob,
        "selected_input_paths": selected_input_paths,
        "tta": ["none", "flip_lr", "flip_ud"] if use_tta else ["none"],
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return str(mask_path), str(report_path), tumor_volume_cm3
