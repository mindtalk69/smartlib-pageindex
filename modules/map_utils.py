import logging
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


def add_minutes_symbol(coord_string):

    # This regex finds patterns like 05° 55 13" S and inserts a ' after the minutes
    # It works for both latitude and longitude
    pattern = r'(\d{1,3}°)\s*(\d{1,2})\s+(\d{1,2}")'
    replacement = r'\1 \2\' \3'
    return re.sub(pattern, replacement, coord_string)

def dms_to_decimal(degrees, minutes, seconds, direction):
    decimal = abs(degrees) + minutes / 60 + seconds / 3600
    if direction.upper() in ['S', 'W']:
        decimal = -decimal
    return decimal

def parse_dms_string(coord_string):
    
    fixed_text = add_minutes_symbol(coord_string)
    
    # Regex to match DMS with direction (works anywhere in the string)
    pattern = r'(\d+)[°\s]+(\d+)[\'\s]+(\d+)"?\s*([NSEW])'
    matches = re.findall(pattern, fixed_text)
    if len(matches) < 2:
        raise ValueError("Could not parse both latitude and longitude from input.")

    # Parse latitude
    lat_deg, lat_min, lat_sec, lat_dir = matches[0]
    lat = dms_to_decimal(int(lat_deg), int(lat_min), int(lat_sec), lat_dir)

    # Parse longitude
    lon_deg, lon_min, lon_sec, lon_dir = matches[1]
    lon = dms_to_decimal(int(lon_deg), int(lon_min), int(lon_sec), lon_dir)

    return lat, lon


def purge_map_assets(base_dir: Path | str, max_age_hours: int, logger: Optional[logging.Logger] = None) -> int:
    """Remove generated map files older than max_age_hours from base_dir."""
    base_path = Path(base_dir)
    if max_age_hours <= 0:
        return 0
    if not base_path.exists() or not base_path.is_dir():
        return 0

    threshold = datetime.utcnow() - timedelta(hours=max_age_hours)
    removed = 0
    for file_path in base_path.glob("**/*"):
        if file_path.is_file():
            try:
                modified = datetime.utcfromtimestamp(file_path.stat().st_mtime)
                if modified < threshold:
                    file_path.unlink(missing_ok=False)
                    removed += 1
            except FileNotFoundError:
                continue
            except Exception as exc:  # pragma: no cover - defensive logging
                if logger:
                    logger.warning("Failed to delete map asset %s: %s", file_path, exc)

    # Clean up empty directories
    for dir_path in sorted(base_path.glob("**/*"), reverse=True):
        if dir_path.is_dir():
            try:
                dir_path.rmdir()
            except OSError:
                continue

    return removed

