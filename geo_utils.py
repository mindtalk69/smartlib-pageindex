# geo_utils.py (or integrate into an existing utility module)
import re
import logging
from typing import Optional, Dict, Tuple

# Configure logging if you run this standalone
# logging.basicConfig(level=logging.INFO)

def dms_to_decimal(degrees: float, minutes: float, seconds: float, direction: str) -> float:
    """
    Converts a single DMS coordinate component to decimal degrees.
    """
    decimal = float(degrees) + float(minutes) / 60 + float(seconds) / 3600
    direction = direction.upper()
    if direction == 'S' or direction == 'W':
        decimal *= -1
    return decimal

def parse_single_dms_string(dms_str: str) -> Optional[float]:
    """
    Parses a single DMS string (e.g., "05° 55' 13\" S") into decimal degrees.
    Returns: Decimal degree value or None if parsing fails.
    """
    # Regex to capture degrees, minutes, seconds, and direction
    # Allows for optional whitespace and various quote characters for seconds
    # Handles N, S, E, W, case-insensitive
    pattern = re.compile(
        r"(\d{1,3})\s*°\s*"      # Degrees (1-3 digits)
        r"(\d{1,2})\s*['′]\s*"   # Minutes (1-2 digits)
        r"([\d.]+)\s*[\"″]?\s*" # Seconds (digits, optional decimal, optional double quote)
        r"([NSEWnswe])",        # Direction (N, S, E, W, case-insensitive)
        re.IGNORECASE
    )
    match = pattern.fullmatch(dms_str.strip()) # Use fullmatch to ensure the whole string is a DMS
    if match:
        try:
            deg, mnt, sec, drn = match.groups()
            return dms_to_decimal(float(deg), float(mnt), float(sec), drn)
        except ValueError:
            logging.warning(f"Could not convert DMS components to float for: {dms_str}")
            return None
    return None

def extract_coordinates_from_text(text_query: str) -> Optional[Dict[str, float]]:
    """
    Extracts and parses DMS latitude and longitude from a text string.
    Handles formats like:
    - "Latitude DD° MM' SS.S\" N, Longitude DDD° MM' SS.S\" E"
    - "DD° MM' SS.S\" N, DDD° MM' SS.S\" E"
    - "Lat: ..., Lon: ..."
    Returns: A dictionary {"latitude": lat_decimal, "longitude": lon_decimal} or None.
    """
    text_query_lower = text_query.lower()

    # More comprehensive regex to find pairs of DMS coordinates
    # This pattern tries to be flexible with "Latitude", "Longitude" prefixes and separators.
    # It captures two full DMS blocks.
    dms_component_regex = r"(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*([\d.]+)\s*[\"″]?\s*([NSEWnswe])"
    
    # Pattern 1: Explicit "Latitude ... Longitude ..."
    lat_lon_pattern = re.compile(
        r"latitude\s*:?\s*" + dms_component_regex +   # Latitude part
        r"\s*,\s*longitude\s*:?\s*" + dms_component_regex,  # Longitude part
        re.IGNORECASE
    )
    match = lat_lon_pattern.search(text_query_lower)
    if match:
        try:
            lat_deg, lat_min, lat_sec, lat_dir, lon_deg, lon_min, lon_sec, lon_dir = match.groups()
            latitude = dms_to_decimal(float(lat_deg), float(lat_min), float(lat_sec), lat_dir)
            longitude = dms_to_decimal(float(lon_deg), float(lon_min), float(lon_sec), lon_dir)
            logging.info(f"Parsed from 'Lat...Lon...' pattern: Lat={latitude}, Lon={longitude}")
            return {"latitude": latitude, "longitude": longitude}
        except ValueError:
            logging.warning(f"Error converting components from 'Lat...Lon...' pattern: {match.groups()}")

    # Pattern 2: Two DMS strings separated by a comma (more ambiguous, try after specific one)
    # We need to infer which is latitude and which is longitude based on common conventions or direction.
    # This is harder. A simpler approach for now is to find all DMS strings and see if we get two.
    
    all_dms_matches = []
    # A slightly more general DMS pattern for finding individual components
    general_dms_pattern = re.compile(dms_component_regex, re.IGNORECASE)
    
    # Find all occurrences of DMS patterns in the string
    found_dms_values = []
    for m in general_dms_pattern.finditer(text_query): # Use original case string for direction
        try:
            deg, mnt, sec, drn = m.groups()
            decimal_val = dms_to_decimal(float(deg), float(mnt), float(sec), drn)
            # Store with original direction to help differentiate lat/lon
            found_dms_values.append({'value': decimal_val, 'direction': drn.upper()})
        except ValueError:
            continue
            
    if len(found_dms_values) == 2:
        # Attempt to assign based on direction
        lat_val, lon_val = None, None
        
        # First pass: strict N/S for lat, E/W for lon
        for item in found_dms_values:
            if item['direction'] in ['N', 'S'] and lat_val is None:
                lat_val = item['value']
            elif item['direction'] in ['E', 'W'] and lon_val is None:
                lon_val = item['value']
        
        if lat_val is not None and lon_val is not None:
            logging.info(f"Parsed from two DMS strings (directional): Lat={lat_val}, Lon={lon_val}")
            return {"latitude": lat_val, "longitude": lon_val}

        # Second pass (if first failed): assume order if directions are ambiguous or missing
        # This is less reliable. For now, if the directional assignment fails, we won't guess order.
        # A more advanced system might use typical ranges (lat -90 to 90, lon -180 to 180)
        # or look for keywords like "lat", "lon" near the values.
        logging.warning(f"Found two DMS values but couldn't definitively assign lat/lon based on N/S/E/W: {found_dms_values}")


    logging.info(f"Could not parse paired DMS coordinates from '{text_query}'")
    return None

# --- Test Harness ---
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO) # Ensure logging is active for standalone test

    test_queries = [
        "please display Coordinates: Latitude 05° 55' 13\" S, Longitude 107° 42' 38\" E",
        "Show me a map for 05° 55' 13\" S, 107° 42' 38\" E",
        "What about Lat: 48°51′29.52″ N, Lon: 2°17′40.92″ E?",
        "Coordinates are 40° 44' 55\" N and 73° 59' 10\" W.", # This one might be harder due to "and"
        "Paris, France", # This should NOT be parsed by extract_coordinates_from_text
        "Map for 51°30′26″N 0°7′39″W please",
        "Location: 34°03′08″S 151°12′54″E",
        "Invalid 999°99'99\"X"
    ]

    print("\n--- Testing parse_single_dms_string ---")
    print(f"'05° 55' 13\" S' -> {parse_single_dms_string("05° 55' 13\" S")}")
    print(f"'107° 42' 38\" E' -> {parse_single_dms_string("107° 42' 38\" E")}")
    print(f"'48°51′29.52″ N' -> {parse_single_dms_string("48°51′29.52″ N")}")


    print("\n--- Testing extract_coordinates_from_text ---")
    for query in test_queries:
        print(f"\nQuery: \"{query}\"")
        coords = extract_coordinates_from_text(query)
        if coords:
            print(f"  Parsed: Latitude={coords['latitude']:.6f}, Longitude={coords['longitude']:.6f}")
            
            # Optional: Test with Folium if you have it installed and want to generate a map
            # try:
            #     import folium
            #     import os
            #     import uuid
            #     map_filename = f"test_map_{uuid.uuid4()}.html"
            #     m = folium.Map(location=[coords['latitude'], coords['longitude']], zoom_start=12)
            #     folium.Marker([coords['latitude'], coords['longitude']], popup="Test Location").add_to(m)
            #     m.save(map_filename)
            #     print(f"  Test map saved to: {os.path.abspath(map_filename)}")
            # except ImportError:
            #     print("  (Folium not installed, skipping map generation test)")
            # except Exception as e_map:
            #     print(f"  Error generating test map: {e_map}")
        else:
            print("  Could not parse coordinates.")

