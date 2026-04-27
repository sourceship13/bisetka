import bpy
from pathlib import Path


fbx_path = Path("/Users/alpha/Downloads/Poker_Table.FBX")
texture_path = Path("/Users/alpha/Downloads/BURLOAK.JPG")
out_path = Path("/Users/alpha/Downloads/Poker_Table_burloak_green_felt.glb")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_burloak_material():
    image = bpy.data.images.load(str(texture_path), check_existing=True)
    image.colorspace_settings.name = "sRGB"

    material = bpy.data.materials.new("burloak_glossy_wood")
    material.use_nodes = True
    material.diffuse_color = (0.72, 0.36, 0.12, 1.0)

    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    texture = nodes.new(type="ShaderNodeTexImage")
    texture.image = image
    texture.extension = "REPEAT"

    material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.38
    bsdf.inputs["Metallic"].default_value = 0.0
    return material


def make_green_felt_material():
    material = bpy.data.materials.new("green_poker_felt")
    material.use_nodes = True
    material.diffuse_color = (0.02, 0.42, 0.16, 1.0)

    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.02, 0.42, 0.16, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Metallic"].default_value = 0.0
    return material


def add_default_uvs(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if not obj.data.uv_layers:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.025)
        bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


def remove_export_helpers():
    for obj in list(bpy.context.scene.objects):
        if obj.name.lower().startswith("plane"):
            bpy.data.objects.remove(obj, do_unlink=True)


def apply_texture_to_meshes(wood_material, felt_material):
    mesh_count = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        add_default_uvs(obj)
        obj.data.materials.clear()
        if obj.name.lower().startswith("felt"):
            obj.data.materials.append(felt_material)
        else:
            obj.data.materials.append(wood_material)
        mesh_count += 1
    return mesh_count


clear_scene()
bpy.ops.import_scene.fbx(filepath=str(fbx_path))

remove_export_helpers()
burloak = make_burloak_material()
green_felt = make_green_felt_material()
mesh_count = apply_texture_to_meshes(burloak, green_felt)

if mesh_count == 0:
    raise RuntimeError("No mesh objects were imported from the FBX.")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(out_path),
    export_format="GLB",
    export_image_format="AUTO",
    export_materials="EXPORT",
    export_apply=True,
)

print(f"Exported {out_path} with BURLOAK texture on {mesh_count} mesh object(s).")
