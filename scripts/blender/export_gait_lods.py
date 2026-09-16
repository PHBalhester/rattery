import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[2];report={}
for level,factor in [('medium',.28),('far',.12)]:
 bpy.ops.wm.open_mainfile(filepath=str(root/'art/rat-gait-study/rat-gait-study.blend'),use_scripts=False)
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  ratio=factor if o.name in ['Ivory coat','Warm pink skin'] else factor*.42 if o.name=='Fine ivory fibres' else 1
  if ratio<1:
   bpy.context.view_layer.objects.active=o
   m=o.modifiers.new('Colony detail level','DECIMATE');m.ratio=ratio
   bpy.ops.object.modifier_apply(modifier=m.name)
 bpy.ops.export_scene.gltf(filepath=str(root/f'public/models/rat-gait-{level}.glb'),export_format='GLB',export_animations=False)
 report[level]={'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'),'bytes':(root/f'public/models/rat-gait-{level}.glb').stat().st_size}
(root/'art/rat-gait-study/lod-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
