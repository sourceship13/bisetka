import bpy
from pathlib import Path
from mathutils import Vector


input_path = Path("/Users/alpha/Downloads/uploads_files_6617676_chess.glb")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    mn = [min(v[i] for v in corners) for i in range(3)]
    mx = [max(v[i] for v in corners) for i in range(3)]
    return mn, mx


clear_scene()
bpy.ops.import_scene.gltf(filepath=str(input_path))

for obj in list(bpy.context.scene.objects):
    obj.select_set(obj.type == "MESH")
    if obj.type == "MESH":
        bpy.context.view_layer.objects.active = obj

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")

parts = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
print(f"loose_parts={len(parts)}")
rows = []
for obj in parts:
    mn, mx = world_bounds(obj)
    size = [mx[i] - mn[i] for i in range(3)]
    center = [(mx[i] + mn[i]) / 2 for i in range(3)]
    verts = len(obj.data.vertices)
    polys = len(obj.data.polygons)
    rows.append((center[2], center[0], obj.name, verts, polys, mn, mx, size, center))

for idx, (_, _, name, verts, polys, mn, mx, size, center) in enumerate(sorted(rows), start=1):
    print(
        f"{idx:03d} {name} verts={verts} polys={polys} "
        f"center=({center[0]:.3f},{center[1]:.3f},{center[2]:.3f}) "
        f"size=({size[0]:.3f},{size[1]:.3f},{size[2]:.3f}) "
        f"bounds=({mn[0]:.3f},{mn[1]:.3f},{mn[2]:.3f})->({mx[0]:.3f},{mx[1]:.3f},{mx[2]:.3f})"
    )
