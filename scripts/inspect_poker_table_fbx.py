import bpy
from pathlib import Path
from mathutils import Vector


fbx_path = Path("/Users/alpha/Downloads/Poker_Table.FBX")


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
bpy.ops.import_scene.fbx(filepath=str(fbx_path))

print("OBJECTS")
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    xs = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_x = min(v.x for v in xs)
    max_x = max(v.x for v in xs)
    min_y = min(v.y for v in xs)
    max_y = max(v.y for v in xs)
    min_z = min(v.z for v in xs)
    max_z = max(v.z for v in xs)
    mats = [slot.material.name if slot.material else "None" for slot in obj.material_slots]
    poly_count = len(obj.data.polygons)
    print(
        f"{obj.name} | polys={poly_count} | "
        f"bounds=({min_x:.3f},{min_y:.3f},{min_z:.3f}) -> ({max_x:.3f},{max_y:.3f},{max_z:.3f}) | "
        f"materials={mats}"
    )
