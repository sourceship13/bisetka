import bpy
from pathlib import Path


asset_dir = Path("/Users/alpha/Downloads/casino_table")
obj_path = asset_dir / "casino_table_level2.obj"
out_path = asset_dir / "casino_table_level2_textured.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def load_image(name, colorspace="sRGB"):
    image = bpy.data.images.load(str(asset_dir / name), check_existing=True)
    image.colorspace_settings.name = colorspace
    return image


def make_material(name, color, base_image=None, bump_image=None, metallic=0.0, roughness=0.55, specular=0.45):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = specular

    if base_image:
        tex = nodes.new(type="ShaderNodeTexImage")
        tex.image = load_image(base_image)
        tex.extension = "REPEAT"
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    if bump_image:
        tex = nodes.new(type="ShaderNodeTexImage")
        tex.image = load_image(bump_image, colorspace="Non-Color")
        tex.extension = "REPEAT"
        bump = nodes.new(type="ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.12
        bump.inputs["Distance"].default_value = 0.04
        links.new(tex.outputs["Color"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    return material


def import_obj():
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=str(obj_path), forward_axis="NEGATIVE_Z", up_axis="Y")
    else:
        bpy.ops.import_scene.obj(filepath=str(obj_path), axis_forward="-Z", axis_up="Y")


def replace_materials(materials):
    replacements = {
        "Casino_Table_gold": materials["gold"],
        "Casino_Table_green_felt1": materials["green_felt"],
        "Casino_Table_leather": materials["black_leather"],
        "Casino_Table_steel": materials["brushed_steel"],
        "Casino_Table_wood": materials["wood"],
    }

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material and slot.material.name in replacements:
                slot.material = replacements[slot.material.name]


def cleanup_and_scale():
    root = bpy.data.objects.new("casino_table_level2_root", None)
    bpy.context.collection.objects.link(root)

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass
        obj.select_set(False)
        if obj.parent is None:
            obj.parent = root

    # Asset units are large OBJ units; scale to a practical GLB size.
    root.scale = (0.01, 0.01, 0.01)


clear_scene()
import_obj()

materials = {
    "gold": make_material(
        "casino_gold_tray",
        (1.0, 0.72, 0.1, 1.0),
        metallic=1.0,
        roughness=0.22,
        specular=0.8,
    ),
    "green_felt": make_material(
        "casino_green_felt",
        (0.02, 0.38, 0.13, 1.0),
        base_image="Ca_green_felt.tga",
        roughness=0.9,
        specular=0.18,
    ),
    "black_leather": make_material(
        "casino_black_leather",
        (0.015, 0.014, 0.013, 1.0),
        base_image="Ca_leather.tga",
        bump_image="Ca_bump_leather.tga",
        roughness=0.5,
        specular=0.35,
    ),
    "brushed_steel": make_material(
        "casino_brushed_steel",
        (0.62, 0.62, 0.6, 1.0),
        metallic=1.0,
        roughness=0.32,
        specular=0.75,
    ),
    "wood": make_material(
        "casino_dark_wood",
        (0.36, 0.18, 0.08, 1.0),
        base_image="Ca_wood.tga",
        roughness=0.42,
        specular=0.45,
    ),
}

replace_materials(materials)
cleanup_and_scale()

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(out_path),
    export_format="GLB",
    export_image_format="AUTO",
    export_materials="EXPORT",
    export_apply=True,
)

print(f"Exported {out_path}")
