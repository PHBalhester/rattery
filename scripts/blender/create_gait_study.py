"""Derive an isolated gait-study rig from the approved original rat."""
import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'art/rat-gait-study';OUT.mkdir(exist_ok=True,parents=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/rat/rat-anatomy.blend'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.animation_data_clear()
for pb in rig.pose.bones:pb.rotation_euler=(0,0,0);pb.location=(0,0,0);pb.scale=(1,1,1)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
bones=rig.data.edit_bones
spine=bones['spine']
def add(name,a,b,parent):
 e=bones.new(name);e.head=a;e.tail=b;e.parent=bones[parent]
add('pelvis',(-.65,0,.45),(-.28,0,.48),'spine')
add('chest',(-.05,0,.50),(.34,0,.53),'spine')
bones['head'].parent=bones['chest']
for side in ['L','R']:
 bones['hind.'+side+'.upper'].parent=bones['pelvis']
 bones['front.'+side+'.upper'].parent=bones['chest']
import math
points=[(-.72-1.05*i/6,.04+.27*math.sin(i/6*2.3),.31*(1-i/6)**3+.038) for i in range(7)]
bones.remove(bones['tail.tip']);bones.remove(bones['tail'])
for i in range(6):add('caudal'+str(i),points[i],points[i+1],'pelvis' if i==0 else 'caudal'+str(i-1))
bpy.ops.object.mode_set(mode='OBJECT')
for o in [o for o in bpy.data.objects if o.type=='MESH']:
 original={g.index:g.name for g in o.vertex_groups}
 for name in ['pelvis','chest']+['caudal'+str(i) for i in range(6)]:
  if not o.vertex_groups.get(name):o.vertex_groups.new(name=name)
 for v in o.data.vertices:
  weights={original[g.group]:g.weight for g in v.groups if g.group in original}
  x=v.co.x
  w=weights.get('spine',0)
  if w:
   pelvis=max(0,min(1,(-x-.04)/.5));chest=max(0,min(1,(x+.2)/.45))*(1-pelvis)
   for name,value in [('pelvis',pelvis),('chest',chest),('spine',1-pelvis-chest)]:o.vertex_groups[name].add([v.index],w*value,'REPLACE')
  w=weights.get('tail',0)+weights.get('tail.tip',0)
  if w:
   t=max(0,min(5,(-x-.72)/1.05*6-.5));i=int(t);f=t-i
   o.vertex_groups['caudal'+str(i)].add([v.index],w*(1-f),'REPLACE')
   if i<5:o.vertex_groups['caudal'+str(i+1)].add([v.index],w*f,'REPLACE')
 for name in ['tail','tail.tip']:
  g=o.vertex_groups.get(name)
  if g:o.vertex_groups.remove(g)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
 if o.type in ['MESH','ARMATURE']:o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rat-gait-study.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/rat-gait-study.glb'),export_format='GLB',use_selection=True,export_animations=False)
(OUT/'report.json').write_text(json.dumps({'bones':len(rig.data.bones),'prototype':True,'tailSegments':6},indent=2))
