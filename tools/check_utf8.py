#!/usr/bin/env python3

"""
Utility to scan the repo for invalid UTF-8 sequences.

Usage:
  python tools/check_utf8.py              # scan tracked text files
  python tools/check_utf8.py --all        # scan every tracked file (slow, noisy)
  python tools/check_utf8.py --fix        # rewrite flagged text files as UTF-8
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path
from typing import Iterable, List, Tuple

TEXT_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".css",
    ".scss",
    ".md",
    ".yml",
    ".yaml",
    ".html",
    ".txt",
    ".svg",
    ".mjs",
}


def git_tracked_files() -> Iterable[Path]:
    result = subprocess.run(
        ["git", "ls-files"], capture_output=True, text=True, check=True
    )
    for line in result.stdout.splitlines():
        if line.strip():
            yield Path(line.strip())


def should_check(path: Path, include_all: bool) -> bool:
    if include_all:
        return True
    return path.suffix.lower() in TEXT_EXTENSIONS


def find_invalid_utf8(
    include_all: bool,
) -> List[Tuple[Path, UnicodeDecodeError]]:
    failures: List[Tuple[Path, UnicodeDecodeError]] = []
    for path in git_tracked_files():
        if not should_check(path, include_all):
            continue
        try:
            data = path.read_bytes()
        except OSError:
            continue
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as error:
            failures.append((path, error))
    return failures


def fix_file(path: Path) -> None:
    data = path.read_bytes()
    cleaned = data.decode("utf-8", errors="replace")
    path.write_text(cleaned, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--all",
        action="store_true",
        help="scan every tracked file (binary files will trigger noise)",
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="rewrite flagged text files with UTF-8 (invalid bytes are replaced)",
    )
    args = parser.parse_args()

    failures = find_invalid_utf8(include_all=args.all)
    if not failures:
        print("No invalid UTF-8 sequences detected.")
        return 0

    print("WARNING: Found invalid UTF-8 in:")
    for path, error in failures:
        print(f" - {path}: {error}")
        if args.fix and not args.all:
            fix_file(path)
            print("   -> rewritten as UTF-8")

    if args.fix and not args.all:
        print("\nFinished rewriting the files above.")
        return 0

    print(
        "\nRe-run with --fix to rewrite the text files above. "
        "Use --all if you intentionally want to scan binaries."
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
