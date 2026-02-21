import re

with open('modules/database.py', 'r') as f:
    content = f.read()

# Look for the start of ModelConfig
start_marker = "# --- Model configuration table for managing LLM deployments ---"
end_marker = "# --- Old connection functions removed ---"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers")
    exit(1)

# Get the replacement string from the original smartlib
with open('/home/mlk/smartlib/modules/database.py', 'r') as f:
    orig_content = f.read()

orig_start_marker = "# --- LLM Provider configuration table ---"
orig_end_marker = "        logging.error(f\"--- Error in get_default_model: {e} ---\", exc_info=True)\n        return None"

orig_start_idx = orig_content.find(orig_start_marker)
orig_end_idx = orig_content.find(orig_end_marker, orig_start_idx)

if orig_start_idx == -1 or orig_end_idx == -1:
    print("Could not find orig markers")
    exit(1)

replacement_str = orig_content[orig_start_idx:orig_end_idx + len(orig_end_marker)] + "\n\n"

new_content = content[:start_idx] + replacement_str + content[end_idx:]

with open('modules/database.py', 'w') as f:
    f.write(new_content)

print("Patched successfully")
