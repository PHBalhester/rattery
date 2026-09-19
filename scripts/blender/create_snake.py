import bpy,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1)
 m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.48
 return m
skin=mat('Olive skin',(.12,.17,.07));plate=mat('Raised scales',(.23,.28,.12));belly=mat('Ivory jaw',(.48,.43,.25));mouth=mat('Mouth',(.1,.025,.02));ivory=mat('Fangs',(.8,.76,.56));gold=mat('Amber eyes',(.85,.48,.03));black=mat('Pupils',(.002,.003,.001))
head=bpy.data.objects.new('SnakeHead',None);bpy.context.collection.objects.link(head)
jaw=bpy.data.objects.new('SnakeJaw',None);bpy.context.collection.objects.link(jaw);jaw.parent=head;jaw.location=(0,.12,-.055)
def oval(name,pos,scale,m,parent=head):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=pos)
 o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m);o.parent=parent
 for f in o.data.polygons:f.use_smooth=True
 return o
oval('Rear skull',(0,.055,.065),(.30,.28,.15),skin)
oval('Muzzle',(0,-.23,.075),(.24,.27,.105),skin)
oval('Upper mouth',(0,-.19,-.02),(.235,.30,.023),mouth)
oval('Lower jaw',(0,-.29,-.025),(.235,.32,.045),belly,jaw)
oval('Lower mouth',(0,-.29,.015),(.215,.29,.016),mouth,jaw)
for sign in [-1,1]:
 oval('Brow',(sign*.23,-.04,.135),(.09,.17,.055),plate)
 oval('Eye',(sign*.266,-.085,.105),(.055,.072,.052),gold)
 oval('Slit',(sign*.307,-.099,.106),(.012,.018,.044),black)
 oval('Nostril',(sign*.155,-.426,.105),(.021,.018,.015),black)
 verts=[];faces=[]
 for i in range(9):
  t=i/8;r=.034*(1-t)+.001
  for j in range(10):
   a=j*math.tau/10;verts.append((sign*.16+r*math.cos(a),-.30+.09*t*t+r*math.sin(a),-.01-.19*t))
 for i in range(8):
  for j in range(10):
   a=i*10+j;b=i*10+(j+1)%10;faces.append((a,b,b+10,a+10))
 me=bpy.data.meshes.new('Fang');me.from_pydata(verts,[],faces);me.materials.append(ivory);o=bpy.data.objects.new('Curved fang',me);bpy.context.collection.objects.link(o);o.parent=head
 for f in me.polygons:f.use_smooth=True
for row in range(6):
 y=.21-row*.10
 for col in range(-2,3):
  x=col*.085+(row%2)*.02;z=.16+(.04 if y>-.12 else -.005)-.35*x*x
  oval('Scale',(x,y,z),(.046,.068,.014),plate)
for parent in [head,jaw]:
 for m in [skin,plate,belly,mouth,ivory,gold,black]:
  objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==m]
  if not objects:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
out=ROOT/'art/snake';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'snake.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/snake.glb'),export_format='GLB',export_animations=False)