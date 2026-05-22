import re
from collections import Counter

file_path = 'src/data/avatarsNew.ts'
all_types = ["hair", "shoes", "top", "bottom", "jacket", "shorts", "hat", "jewelry", "other"]
counts = {t: 0 for t in all_types}

with open(file_path, 'r') as f:
    lines = f.readlines()

clothing_items_started = False
current_type = None
current_build = None

for line in lines:
    if 'export const NEW_CLOTHING_ITEMS' in line:
        clothing_items_started = True
        continue
    if not clothing_items_started:
        continue
    
    type_match = re.search(r'type:\s*"([^"]*)"', line)
    if type_match:
        current_type = type_match.group(1)
    
    build_match = re.search(r'build:\s*"([^"]*)"', line)
    if build_match:
        current_build = build_match.group(1)
    
    if '},' in line or '}' == line.strip():
        if current_type and current_build == 'fat':
            if current_type in counts:
                counts[current_type] += 1
            else:
                counts[current_type] = 1
        current_type = None
        current_build = None

# Print in a nice format as requested
output = ", ".join([f"{t}: {counts[t]}" for t in all_types])
print(output)
