"""Technical fixture only: verifies a deforming rig survives GLB export/import."""
import bpy, json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
out=root/'test-results/blender'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8)
mesh=bpy.context.object
mesh.name='PipelineFixture_NotRat'
bpy.ops.object.armature_add()
rig=bpy.context.object
rig.name='FixtureRig'
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
bone=rig.data.edit_bones[0]
bone.name='root'
bone.head=(0,0,-1)
bone.tail=(0,0,1)
bpy.ops.object.mode_set(mode='OBJECT')
group=mesh.vertex_groups.new(name='root')
group.add(list(range(len(mesh.data.vertices))),1,'REPLACE')
modifier=mesh.modifiers.new('Skin','ARMATURE')
modifier.object=rig
mesh.parent=rig
pose=rig.pose.bones['root']
pose.rotation_mode='XYZ'
for frame,angle in [(1,0),(13,0.3),(25,0)]:
    pose.rotation_euler.y=angle
    pose.keyframe_insert(data_path='rotation_euler',frame=frame)
rig.animation_data.action.name='PipelineMotion'
bpy.context.scene.frame_end=25
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'pipeline-fixture.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'pipeline-fixture.glb'),export_format='GLB',export_animations=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out/'pipeline-fixture.glb'))
# The importer also creates an Icosphere for the bone display, not exported geometry.
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
assert len(meshes)==1 and len(rigs)==1
assert any(m.type=='ARMATURE' for m in meshes[0].modifiers)
assert rigs[0].animation_data and (rigs[0].animation_data.action or rigs[0].animation_data.nla_tracks)
report={'blender':bpy.app.version_string,'meshCount':len(meshes),'boneCount':len(rigs[0].data.bones),'animationRoundTrip':True,'glbBytes':(out/'pipeline-fixture.glb').stat().st_size}
(out/'pipeline-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
