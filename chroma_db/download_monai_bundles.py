import argparse
import sys
from pathlib import Path

from monai.bundle import download, get_all_bundles_list

sys.path.append("/app")

from config import settings  # noqa: E402
from app.services.models_registry import DEFAULT_BUNDLES  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download MONAI model zoo bundles into the local models directory."
    )
    parser.add_argument(
        "bundles",
        nargs="*",
        help="Bundle names to download (defaults to the recommended set).",
    )
    parser.add_argument(
        "--models-dir",
        default=settings.models_dir,
        help="Target models directory (default from settings).",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available bundle names from the MONAI model zoo.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with error if any bundle fails to download.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.list:
        for name, version in get_all_bundles_list():
            print(f"{name} ({version})")
        return

    bundle_dir = Path(args.models_dir) / "bundles"
    bundle_dir.mkdir(parents=True, exist_ok=True)

    bundle_ids = args.bundles or [item["id"] for item in DEFAULT_BUNDLES]
    failures = []
    for bundle_id in bundle_ids:
        try:
            download(name=bundle_id, bundle_dir=str(bundle_dir))
        except Exception as exc:  # noqa: BLE001
            failures.append((bundle_id, str(exc)))
            print(f"[warn] Failed to download {bundle_id}: {exc}", file=sys.stderr)

    if failures:
        print(
            f"[warn] {len(failures)} bundle(s) failed: "
            + ", ".join(name for name, _ in failures),
            file=sys.stderr,
        )
        if args.strict:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
