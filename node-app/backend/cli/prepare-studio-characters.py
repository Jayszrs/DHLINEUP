"""Offline adaptation of Blender Studio's CC-BY Rain/Snow rigs for this web app.

Run in a separate bpy environment. Sources remain private; exported assets carry
attribution. Embedded source scripts are disabled. Face topology is retained,
while the film control rigs are reduced to a small deform skeleton for the web.
"""
import argparse
import math
from pathlib import Path
import bpy
from mathutils import Vector


def material(name, color, texture=None, roughness=.65):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    if texture and texture.exists():
        image = bpy.data.images.load(str(texture), check_existing=False)
        limit = 3072 if 'atlas' in texture.name else 1024
        if max(image.size) > limit:
            factor = limit / max(image.size)
            image.scale(round(image.size[0] * factor), round(image.size[1] * factor))
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        mat.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    return mat


def prepare(source, output, gender):
    source, output = source.resolve(), output.resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()), use_scripts=False)
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o.name.startswith('RIG'))
    sources = [o for o in bpy.data.objects if o.type == 'MESH' and o.visible_get()
               and not any(s in o.name for s in ('cornea', 'gums', 'teeth', 'tongue', 'scarf'))]
    female = gender == 'female'
    names = {'hips': 'DEF-Pelvis' if female else 'DEF-Hips',
             'spine': 'DEF-Spine1' if female else 'DEF-Spine',
             'chest': 'DEF-Spine3' if female else 'DEF-Chest',
             'neck': 'DEF-Neck', 'head': 'DEF-Head'}
    for side in ('L', 'R'):
        for joint, rain, snow in [('arm', 'Upperarm1', 'UpperArm_1'),
                                  ('forearm', 'Forearm1', 'Forearm_1'),
                                  ('hand', 'Hand', 'Wrist'),
                                  ('thigh', 'Thigh1', 'Thigh_1'),
                                  ('shin', 'Shin1', 'Knee_1'),
                                  ('foot', 'Foot', 'Foot')]:
            names[joint + '.' + side] = 'DEF-' + (rain if female else snow) + '.' + side
    heads = {name: rig.matrix_world @ rig.data.bones[old].head_local for name, old in names.items()}
    arm = bpy.data.armatures.new('DH-Web-Deform')
    clean = bpy.data.objects.new('DH-Studio-' + gender, arm)
    bpy.context.scene.collection.objects.link(clean)
    bpy.context.view_layer.objects.active = clean
    clean.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    parents = {'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck'}
    for side in ('L', 'R'):
        parents.update({'arm.' + side: 'chest', 'forearm.' + side: 'arm.' + side,
                        'hand.' + side: 'forearm.' + side, 'thigh.' + side: 'hips',
                        'shin.' + side: 'thigh.' + side, 'foot.' + side: 'shin.' + side})
    for name, old in names.items():
        bone = arm.edit_bones.new(name)
        bone.head = heads[name]
        bone.tail = rig.matrix_world @ rig.data.bones[old].tail_local
        if (bone.tail - bone.head).length < .01:
            bone.tail = bone.head + Vector((0, 0, .1))
    for name, parent in parents.items():
        arm.edit_bones[name].parent = arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')

    def remap(group):
        side = 'L' if group.endswith('.L') else 'R' if group.endswith('.R') else None
        lower = group.lower()
        if any(t in lower for t in ('face', 'lip', 'jaw', 'head', 'brow', 'eye', 'hair', 'cheek', 'nose', 'chin', 'laugh', 'temple', 'ponytail')):
            return 'head'
        if side:
            if any(t in lower for t in ('finger', 'thumb', 'index', 'middle', 'pinky', 'hand', 'wrist')) or group.startswith('DEF-Ring'):
                return 'hand.' + side
            if 'forearm' in lower or 'elbow' in lower:
                return 'forearm.' + side
            if 'upperarm' in lower or 'shoulder' in lower or 'clavicle' in lower:
                return 'arm.' + side
            if 'thigh' in lower or 'hip.' in lower:
                return 'thigh.' + side
            if 'shin' in lower or 'knee' in lower:
                return 'shin.' + side
            if 'foot' in lower or 'toe' in lower:
                return 'foot.' + side
        if any(t in lower for t in ('face', 'lip', 'jaw', 'head', 'brow', 'eye', 'hair', 'cheek', 'nose', 'chin', 'laugh', 'temple', 'ponytail')):
            return 'head'
        if 'neck' in lower:
            return 'neck'
        if any(t in lower for t in ('spine3', 'chest', 'ribcage', 'breast')):
            return 'chest'
        if 'spine' in lower:
            return 'spine'
        if 'pelvis' in lower or 'hips' in lower:
            return 'hips'
        return None

    tex = source.parent / 'textures'
    # The female source's skin uses three UDIM tiles. Pack them into one web
    # atlas so the head, arms and hands keep the artist's matching skin texture.
    skin_atlas = None
    if female:
        import numpy as np
        tiles = []
        for tile in (1001, 1002, 1003):
            image = bpy.data.images.load(str(tex / ('TEX-rain_body_diffuse.' + str(tile) + '.png')),
                                        check_existing=False)
            image.scale(1024, 1024)
            pixels = np.empty(1024 * 1024 * 4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            tiles.append(pixels.reshape(1024, 1024, 4))
        image = bpy.data.images.new('DH-skin-atlas', width=3072, height=1024, alpha=True)
        image.pixels.foreach_set(np.concatenate(tiles, axis=1).reshape(-1))
        skin_atlas = output.parent / 'rain-skin-atlas.png'
        skin_atlas.parent.mkdir(parents=True, exist_ok=True)
        image.filepath_raw = str(skin_atlas)
        image.file_format = 'PNG'
        image.save()
    mats = {
        'skin': material('DH-Skin', (.62, .35, .20), skin_atlas, roughness=.52),
        'head': material('DH-Face', (.62, .35, .20), skin_atlas, .52),
        'hair': material('DH-Hair', (.025, .018, .014), roughness=.55),
        'shirt': material('DH-Uniform', (.006, .38, .52)),
        'pants': material('DH-Navy', (.016, .032, .060)),
        'shoes': material('DH-Shoes', (.025, .034, .040), roughness=.8),
        'eyes': material('DH-Eyes', (.9, .9, .85), tex / ('TEX-rain_eyes.png' if female else 'eyes_diffuse.png'), .23),
        'white': material('DH-Eye-White', (.88, .86, .79), roughness=.2),
        'iris': material('DH-Eye-Iris', (.13, .067, .025), roughness=.23),
        'pupil': material('DH-Eye-Pupil', (.002, .003, .003), roughness=.16),
    }
    meshes = []
    for old in sources:
        # Evaluate surface modifiers without the film armature/lattice control rig.
        for mod in old.modifiers:
            if mod.type in ('ARMATURE', 'LATTICE', 'SURFACE_DEFORM', 'CORRECTIVE_SMOOTH'):
                mod.show_viewport = False
                mod.show_render = False
            if mod.type == 'SUBSURF':
                mod.levels = 1
                mod.render_levels = 1
        bpy.context.view_layer.update()
        evaluated = old.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True,
                                               depsgraph=bpy.context.evaluated_depsgraph_get())
        # Read evaluated deform weights before discarding the source group table.
        weights = []
        for vertex in mesh.vertices:
            if any(part in old.name for part in ('head', 'eye', 'brow', 'lash', 'hair')):
                weights.append({'head': 1.0})
                continue
            merged = {}
            for weight in vertex.groups:
                group = old.vertex_groups[weight.group].name
                name = remap(group)
                if name:
                    merged[name] = merged.get(name, 0) + weight.weight
            if not merged:
                merged['head' if any(t in old.name for t in ('head', 'eye', 'hair', 'brow')) else 'chest'] = 1
            weights.append(merged)
        new = bpy.data.objects.new(old.name.replace('GEO-', 'DH-'), mesh)
        bpy.context.scene.collection.objects.link(new)
        new.matrix_world = old.matrix_world
        # Delete the old numeric deform assignments and rebuild 17 normalized groups.
        for group in old.vertex_groups:
            new.vertex_groups.new(name=group.name)
        new.vertex_groups.clear()
        groups = {name: new.vertex_groups.new(name=name) for name in names}
        for index, merged in enumerate(weights):
            total = sum(merged.values())
            for name, value in merged.items():
                groups[name].add([index], value / total, 'REPLACE')
        modifier = new.modifiers.new('Web deform', 'ARMATURE')
        modifier.object = clean
        new.parent = clean
        key = ('eyes' if 'eye_anim' in old.name or old.name.endswith('-eyes') else
               'hair' if any(t in old.name for t in ('hair', 'brow', 'lash')) else
               'head' if old.name.endswith('-head') else
               'pants' if 'pants' in old.name or 'jeans' in old.name else
               'shirt' if 'shirt' in old.name or old.name.endswith('-top') else
               'shoes' if 'shoe' in old.name else 'skin')
        material_indices = [polygon.material_index for polygon in mesh.polygons]
        mesh.materials.clear()
        if key == 'eyes' and not female:
            for key2 in ('white', 'iris', 'pupil'):
                mesh.materials.append(mats[key2])
        elif 'eye_dots' in old.name:
            mesh.materials.append(mats['white'])
        else:
            mesh.materials.append(mats[key])
        for polygon in mesh.polygons:
            polygon.use_smooth = True
            polygon.material_index = material_indices[polygon.index] if key == 'eyes' and not female else 0
        if key in ('head', 'skin') and female and mesh.uv_layers.active:
            for uv in mesh.uv_layers.active.data:
                uv.uv.x /= 3
        meshes.append(new)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [clean, *meshes]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = clean
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output.resolve()), export_format='GLB',
                              use_selection=True, export_animations=False,
                              export_skins=True, export_morph=False,
                              export_yup=True, export_image_format='WEBP',
                              export_image_quality=88, export_apply=False)
    print('EXPORTED', gender, output, output.stat().st_size, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--gender', choices=['male', 'female'], required=True)
    args = parser.parse_args()
    prepare(args.source, args.output, args.gender)
