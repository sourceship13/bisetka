import bpy
from pathlib import Path


asset_dir = Path("/Users/alpha/Downloads/uploads_files_4579331_T3D_PokerTable")
obj_path = asset_dir / "T3D_PokerTable.obj"
out_path = asset_dir / "T3D_PokerTable_textured.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def image_node(material, image_path, colorspace="sRGB"):
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.colorspace_settings.name = colorspace
    node = material.node_tree.nodes.new(type="ShaderNodeTexImage")
    node.image = image
    node.extension = "REPEAT"
    return node


def make_material(name, color, base_color=None, normal=None, roughness=0.55, metallic=0.0, specular=0.45):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = specular
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = specular

    if base_color:
        tex = image_node(material, asset_dir / base_color)
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    if normal:
        tex = image_node(material, asset_dir / normal, colorspace="Non-Color")
        bump = nodes.new(type="ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.08
        bump.inputs["Distance"].default_value = 0.045
        links.new(tex.outputs["Color"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    return material


def import_obj():
    if hasattr(bpy.ops.wm, "obj_import"):
        bpy.ops.wm.obj_import(filepath=str(obj_path), forward_axis="NEGATIVE_Z", up_axis="Y")
    else:
        bpy.ops.import_scene.obj(filepath=str(obj_path), axis_forward="-Z", axis_up="Y")


def assign_materials(materials):
    by_wire = {
        # Tall supports / cylindrical bases.
        "wire_140088225": materials["dark_wood"],
        # Base rings and connector caps.
        "wire_085028177": materials["black_marble"],
        # Thin metal-looking connector rails.
        "wire_225198087": materials["dark_wood"],
        # Marble tray / side detail.
        "wire_115115115": materials["black_marble"],
        # Main outer rail / cushion.
        "wire_024024024": materials["eco_leather"],
        # Inner marble band.
        "wire_048048048": materials["black_marble"],
        # Playing surface.
        "wire_006135058": materials["green_velvet"],
        # Main wood trim and apron.
        "wire_135059008": materials["dark_wood"],
        # Table layout / thin decorative line.
        "wire_255255255": materials["light_line"],
    }

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue

        for slot in obj.material_slots:
            if not slot.material:
                continue
            replacement = by_wire.get(slot.material.name)
            if replacement:
                slot.material = replacement


def shade_and_scale():
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

    # The OBJ is in millimeters-ish 3ds Max units; bring it into a sane GLB size.
    root = bpy.data.objects.new("T3D_PokerTable_root", None)
    bpy.context.collection.objects.link(root)
    for obj in bpy.context.scene.objects:
        if obj is not root and obj.parent is None:
            obj.parent = root
    root.scale = (0.001, 0.001, 0.001)


clear_scene()
import_obj()

materials = {
    "black_marble": make_material(
        "black_marble",
        (0.03, 0.032, 0.034, 1.0),
        base_color="T3D_Marble_Diff.jpg",
        roughness=0.26,
        specular=0.75,
    ),
    "eco_leather": make_material(
        "black_eco_leather",
        (0.025, 0.025, 0.023, 1.0),
        base_color="T3D_PokerTable_EcoLeather.jpg",
        normal="T3D_PokerTable_EcoLeather.png",
        roughness=0.66,
        specular=0.28,
    ),
    "dark_wood": make_material(
        "dark_brown_wood",
        (0.45, 0.22, 0.11, 1.0),
        base_color="T3D_PokerTable_Wood_Diff.jpg",
        normal="T3D_PokerTable_Wood_Gloss.jpg",
        roughness=0.34,
        specular=0.55,
    ),
    "green_velvet": make_material(
        "green_poker_velvet",
        (0.02, 0.43, 0.18, 1.0),
        normal="T3D_PokerTable_Velvet_Bump.jpg",
        roughness=0.9,
        specular=0.18,
    ),
    "light_line": make_material(
        "table_layout_light_line",
        (0.95, 0.88, 0.72, 1.0),
        roughness=0.48,
        specular=0.35,
    ),
}

assign_materials(materials)
shade_and_scale()

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(out_path),
    export_format="GLB",
    export_image_format="AUTO",
    export_materials="EXPORT",
    export_apply=True,
)

print(f"Exported {out_path}")
