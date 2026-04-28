import bpy
from pathlib import Path
from mathutils import Vector


input_path = Path("/Users/alpha/Downloads/uploads_files_6617676_chess.glb")
out_path = Path("/tmp/chess_preview.png")


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=str(input_path))

mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
corners = []
for obj in mesh_objs:
    corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
mn = [min(v[i] for v in corners) for i in range(3)]
mx = [max(v[i] for v in corners) for i in range(3)]
center = Vector(((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2))
size = max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2])

camera_data = bpy.data.cameras.new("preview_camera")
camera = bpy.data.objects.new("preview_camera", camera_data)
bpy.context.collection.objects.link(camera)
camera.location = center + Vector((0, -size * 1.4, size * 1.0))
direction = center - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
camera_data.lens = 55
bpy.context.scene.camera = camera

light_data = bpy.data.lights.new("preview_area", "AREA")
light = bpy.data.objects.new("preview_area", light_data)
bpy.context.collection.objects.link(light)
light.location = center + Vector((0, -size, size * 1.5))
light_data.energy = 500
light_data.size = size

bpy.context.scene.render.engine = "BLENDER_EEVEE"
bpy.context.scene.render.resolution_x = 1600
bpy.context.scene.render.resolution_y = 1000
if hasattr(bpy.context.scene, "eevee"):
    bpy.context.scene.eevee.taa_render_samples = 32
bpy.context.scene.render.filepath = str(out_path)
bpy.ops.render.render(write_still=True)
print(out_path)
