import re

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
