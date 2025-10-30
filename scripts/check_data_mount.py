#!/usr/bin/env python3
"""Utility to verify that a target data directory is properly mounted and writable.

The script performs the following checks:
 1. Ensures the directory exists and is a directory.
 2. Confirms read/write/execute permissions for the current process.
 3. Determines whether the directory resides on a distinct mount point.
 4. Reports the source of the mount (if available) by inspecting /proc/self/mountinfo.
 5. Attempts to create and remove a temporary file to verify write access.
 6. Displays the available disk space at the target path.

Usage:
    python scripts/check_data_mount.py [--path /app/data]

By default the script inspects `/app/data`, which is the expected persistent
volume location for SmartLib deployments.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from typing import Optional

MOUNTINFO_PATH = "/proc/self/mountinfo"


@dataclass
class MountStatus:
    path: str
    exists: bool
    is_dir: bool
    readable: bool
    writable: bool
    executable: bool
    is_mount: bool
    mount_source: Optional[str]
    mount_fs_type: Optional[str]
    disk_total: Optional[int]
    disk_used: Optional[int]
    disk_free: Optional[int]
    write_test_succeeded: bool
    error: Optional[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check data directory mount status")
    parser.add_argument(
        "--path",
        default="/app/data",
        help="Directory to validate (default: /app/data)",
    )
    return parser.parse_args()


def read_mount_info(target_path: str) -> tuple[bool, Optional[str], Optional[str]]:
    """Return mount status, source, and filesystem type for the target path."""
    try:
        with open(MOUNTINFO_PATH, "r", encoding="utf-8") as mount_file:
            for line in mount_file:
                parts = line.split()
                if len(parts) < 10:
                    continue
                mount_point = parts[4]
                if os.path.abspath(mount_point) == os.path.abspath(target_path):
                    if len(parts) >= 10:
                        fs_type_index = parts.index("-") + 1 if "-" in parts else None
                        fs_type = parts[fs_type_index] if fs_type_index is not None else None
                        mount_source = parts[fs_type_index + 1] if fs_type_index is not None else None
                    else:
                        fs_type = None
                        mount_source = None
                    return True, mount_source, fs_type
    except FileNotFoundError:
        return False, None, None
    except Exception as exc:  # pragma: no cover - defensive logging
        print(f"Warning: unable to read {MOUNTINFO_PATH}: {exc}", file=sys.stderr)
    return False, None, None


def test_write(target_path: str) -> bool:
    """Attempt to create and delete a temporary file to verify write access."""
    try:
        with tempfile.NamedTemporaryFile(dir=target_path, delete=True) as tmp:
            tmp.write(b"mount-check")
            tmp.flush()
        return True
    except Exception as exc:
        print(f"Write test failed for {target_path}: {exc}", file=sys.stderr)
        return False


def gather_status(target_path: str) -> MountStatus:
    exists = os.path.exists(target_path)
    is_dir = os.path.isdir(target_path)
    readable = os.access(target_path, os.R_OK)
    writable = os.access(target_path, os.W_OK)
    executable = os.access(target_path, os.X_OK)
    is_mount = os.path.ismount(target_path)
    mount_found, mount_source, mount_fs_type = read_mount_info(target_path)
    disk_total = disk_used = disk_free = None
    write_test = False
    error = None

    if exists and is_dir:
        try:
            usage = shutil.disk_usage(target_path)
            disk_total, disk_used, disk_free = usage.total, usage.used, usage.free
        except Exception as exc:
            error = f"Failed to read disk usage: {exc}"

        write_test = test_write(target_path)
    elif not exists:
        error = "Directory does not exist"
    elif not is_dir:
        error = "Path exists but is not a directory"

    if mount_found:
        is_mount = True

    return MountStatus(
        path=target_path,
        exists=exists,
        is_dir=is_dir,
        readable=readable,
        writable=writable,
        executable=executable,
        is_mount=is_mount,
        mount_source=mount_source,
        mount_fs_type=mount_fs_type,
        disk_total=disk_total,
        disk_used=disk_used,
        disk_free=disk_free,
        write_test_succeeded=write_test,
        error=error,
    )


def format_bytes(value: Optional[int]) -> str:
    if value is None:
        return "unknown"

    size = float(value)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024 or unit == "TB":
            return f"{size:.2f} {unit}" if unit != "B" else f"{int(size)} {unit}"
        size /= 1024
    return f"{size:.2f} TB"


def print_status(status: MountStatus) -> None:
    print("Mount check summary")
    print("--------------------")
    print(f"Target path        : {status.path}")
    print(f"Exists             : {status.exists}")
    print(f"Is directory       : {status.is_dir}")
    print(f"Readable           : {status.readable}")
    print(f"Writable           : {status.writable}")
    print(f"Executable         : {status.executable}")
    print(f"Mounted (ismount)  : {status.is_mount}")
    print(f"Mount source       : {status.mount_source or 'unknown'}")
    print(f"Filesystem type    : {status.mount_fs_type or 'unknown'}")
    print(f"Disk total         : {format_bytes(status.disk_total)}")
    print(f"Disk used          : {format_bytes(status.disk_used)}")
    print(f"Disk free          : {format_bytes(status.disk_free)}")
    print(f"Write test passed  : {status.write_test_succeeded}")

    if status.error:
        print(f"Error              : {status.error}")

    if not status.exists or not status.is_dir:
        print("\nActions:")
        print(" - Ensure the volume mount is configured and points to a directory.")
    elif not status.write_test_succeeded or not status.writable:
        print("\nActions:")
        print(" - Directory is not writable. Check container permissions and mount options.")
    elif not status.is_mount:
        print("\nActions:")
        print(" - Directory is not on a distinct mount. Verify the expected volume is attached.")


def main() -> int:
    args = parse_args()
    target = os.path.abspath(args.path)
    status = gather_status(target)
    print_status(status)
    return 0 if status.exists and status.is_dir and status.write_test_succeeded else 1


if __name__ == "__main__":
    raise SystemExit(main())
