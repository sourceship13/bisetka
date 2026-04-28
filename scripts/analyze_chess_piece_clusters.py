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


def separate_loose():
    for obj in list(bpy.context.scene.objects):
        obj.select_set(obj.type == "MESH")
        if obj.type == "MESH":
            bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")


def cluster(parts, eps):
    clusters = []
    for part in parts:
        placed = False
        for c in clusters:
            cx, cy = c["center"]
            if ((part["center"][0] - cx) ** 2 + (part["center"][1] - cy) ** 2) ** 0.5 <= eps:
                c["parts"].append(part)
                n = len(c["parts"])
                c["center"] = (
                    (cx * (n - 1) + part["center"][0]) / n,
                    (cy * (n - 1) + part["center"][1]) / n,
                )
                placed = True
                break
        if not placed:
            clusters.append({"center": part["center"], "parts": [part]})
    return clusters


clear_scene()
bpy.ops.import_scene.gltf(filepath=str(input_path))
separate_loose()

parts = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    mn, mx = world_bounds(obj)
    center = ((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2)
    parts.append({
        "obj": obj,
        "center": center,
        "mn": mn,
        "mx": mx,
        "verts": len(obj.data.vertices),
        "polys": len(obj.data.polygons),
    })

for z_threshold in [0.04, 0.06, 0.08, 0.10, 0.12]:
    candidates = [p for p in parts if p["mx"][2] > z_threshold and p["polys"] >= 2]
    print(f"\nz_threshold={z_threshold} candidates={len(candidates)}")
    for eps in [0.035, 0.045, 0.055, 0.07, 0.09]:
        clusters = cluster(sorted(candidates, key=lambda p: (p["center"][0], p["center"][1])), eps)
        usable = []
        for c in clusters:
            verts = sum(p["verts"] for p in c["parts"])
            polys = sum(p["polys"] for p in c["parts"])
            mn = [min(p["mn"][i] for p in c["parts"]) for i in range(3)]
            mx = [max(p["mx"][i] for p in c["parts"]) for i in range(3)]
            size = [mx[i] - mn[i] for i in range(3)]
            if polys >= 250 and size[2] >= 0.035:
                usable.append((c, verts, polys, mn, mx, size))
        print(f"  eps={eps} usable_clusters={len(usable)}")
        if 24 <= len(usable) <= 40:
            for idx, (c, verts, polys, mn, mx, size) in enumerate(sorted(usable, key=lambda row: (row[3][1], row[3][0])), start=1):
                cx = (mn[0] + mx[0]) / 2
                cy = (mn[1] + mx[1]) / 2
                print(
                    f"    {idx:02d} center=({cx:.3f},{cy:.3f}) "
                    f"size=({size[0]:.3f},{size[1]:.3f},{size[2]:.3f}) "
                    f"parts={len(c['parts'])} polys={polys}"
                )
