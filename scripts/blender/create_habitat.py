"""Original habitat art aligned to the simulation's exported navigation coordinates."""
import bpy,math,json,random
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'art/habitat';D=json.loads((OUT/'layout.json').read_text());random.seed(725)
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,color,rough= .85,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
base=mat('Graphite tray',(.075,.095,.10),.65)
soil=mat('Warm cork',(.25,.19,.12));wood=mat('Honey timber',(.43,.27,.12));edge=mat('Dark end grain',(.19,.115,.055));straw=mat('Natural flax',(.66,.51,.29));ceramic=mat('Sage ceramic',(.23,.38,.33),.38);water=mat('Water',(.12,.32,.40),.17);food=mat('Grain',(.46,.30,.13));metal=mat('Brass fittings',(.47,.35,.15),.3,.7)
materials=[base,soil,wood,edge,straw,ceramic,water,food,metal]
def pt(p,z=0):return Vector(((p[0]-D['width']/2)/30,-(p[1]-D['height']/2)/30,z))
def finish(o,name,m):
 o.name=name;o.data.materials.append(m)
 return o

def box(name,loc,scale,m,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,name,m)
 if bevel:
  b=o.modifiers.new('Soft manufactured edges','BEVEL');b.width=bevel;b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name)
 return o

def mesh(name,v,f,m):
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);finish(o,name,m);return o

def tube(name,points,r,m):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=1;curve.bevel_depth=r;curve.bevel_resolution=2;s=curve.splines.new('POLY');s.points.add(len(points)-1)
 for p,q in zip(s.points,points):p.co=(*q,1)
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.data.materials.append(m);return o

def disk(name,center,r,depth,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=depth,location=center);o=bpy.context.object;finish(o,name,m);b=o.modifiers.new('Rounded lip','BEVEL');b.width=min(.04,depth*.3);b.segments=2;bpy.ops.object.modifier_apply(modifier=b.name);return o

def ribbon(name,path,width,m):
 v=[];f=[]
 for i,p in enumerate(path):
  t=(path[min(i+1,len(path)-1)]-path[max(i-1,0)]).normalized();n=Vector((-t.y,t.x,0)).normalized()
  v.extend([p-n*width,p+n*width])
  if i:q=(i-1)*2;f.append((q,q+2,q+3,q+1))
 return mesh(name,v,f,m)
W=D['width']/30;H=D['height']/30
box('Display plinth',(0,0,-.87),(W+.5,H+.5,1.3),base,.24)
box('Cork habitat floor',(0,0,-.24),(W,H,.2),soil,.10)
# Fine perimeter joinery remains outside the navigation area.
for x in [-1,1]:box('Perimeter rail',(x*(W/2+.02),0,-.04),(.12,H,.20),wood)
for y in [-1,1]:box('Perimeter rail',(0,y*(H/2+.02),-.04),(W,.12,.20),wood)
for path in D['tunnels']:
 points=[pt(p,-.10) for p in path];ribbon('Open passage floor',points,1.25,wood)
 for sign in [-1,1]:
  verts=[];faces=[]
  for i,p in enumerate(points):
   t=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized();side=Vector((-t.y,t.x,0))*sign
   for offset,z in [(1.06,-.10),(1.18,.03),(1.25,.38),(1.32,.42),(1.37,-.10)]:verts.append(p+side*offset+Vector((0,0,z+.10)))
   if i:
    for j in range(4):q=(i-1)*5+j;faces.append((q,q+1,q+6,q+5))
  o=mesh('Sculpted low tunnel edge',verts,faces,edge)
  for f in o.data.polygons:f.use_smooth=True
 # Transverse grain joints lie below the rats, never across their bodies.
 for i in range(2,len(points)-1,3):
  t=(points[i+1]-points[i-1]).normalized();side=Vector((-t.y,t.x,0))
  tube('Passage timber seam',[points[i]-side*1.04+Vector((0,0,.003)),points[i]+side*1.04+Vector((0,0,.003))],.009,edge)
 c=points[-1];disk('Chamber cork inset',c+Vector((0,0,.02)),2.12,.16,soil)
 # Open-sided slatted refuge with rounded roof beams, no new ground obstacles.
 for sign in [-1,1]:
  for y in [-.55,.55]:box('Refuge post',c+Vector((sign*.94,y,.60)),(.13,.13,1.20),wood)
  box('Refuge side sill',c+Vector((sign*.94,0,.18)),(.13,1.24,.14),wood)
 for y in [-.58,0,.58]:
  pts=[c+Vector((math.cos(i/24*math.pi)*.94,y,.70+math.sin(i/24*math.pi)*.60)) for i in range(25)]
  tube('Refuge curved roof rib',pts,.065,wood)
 # Partial roof retains a clear view into the chamber from above.
 for x in [-.82,-.65,.65,.82]:
  z=.7+math.sqrt(max(0,1-(x/.94)**2))*.60
  box('Refuge roof slat',c+Vector((x,0,z)),(.13,1.30,.055),wood,.025)
 disk('Woven feeding mat',c+Vector((0,0,.215)),.59,.022,straw)
 for ring in range(1,12):
  r=ring*.048;tube('Mat weave',[c+Vector((r*math.cos(a*math.tau/64),r*math.sin(a*math.tau/64),.229)) for a in range(65)],.006,edge)
 # Revolved concave ceramic bowl; placement matches existing resource station.
 bowl=c+Vector((.5,-.48,.10));profile=[(0,0),(.29,0),(.35,.035),(.34,.15),(.31,.19),(.285,.17),(.27,.06),(0,.06)]
 verts=[];faces=[]
 for r,z in profile:
  for i in range(48):verts.append(bowl+Vector((r*math.cos(i*math.tau/48),r*math.sin(i*math.tau/48),z)))
 for j in range(len(profile)-1):
  for i in range(48):q=j*48+i;n=j*48+(i+1)%48;faces.append((q,n,n+48,q+48))
 o=mesh('Ceramic water bowl',verts,faces,ceramic)
 for f in o.data.polygons:f.use_smooth=True
 disk('Water surface',bowl+Vector((0,0,.115)),.278,.008,water)
 for i in range(16):
  a=i*2.4;r=.35*math.sqrt(i/16);o=box('Food pellet',c+Vector((r*math.cos(a),r*math.sin(a),.26)),(.095,.042,.032),food,.014);o.rotation_euler.z=a
for path in D['lateral']:ribbon('Outer cork path',[pt(p,-.125) for p in path],.38,straw)
for platform in D['platforms']:
 for leg in platform:
  points=[pt(p,p[2]) for p in leg];ribbon('Raised exercise walkway',points,14/30,wood)
  for i in range(1,len(points),3):
   p=points[i];t=(points[min(i+1,len(points)-1)]-points[i-1]).normalized();side=Vector((-t.y,t.x,0)).normalized()
   tube('Ramp grip strip',[p-side*.43+Vector((0,0,.006)),p+side*.43+Vector((0,0,.006))],.012,edge)
# Wheel bearings and A-frame supports; the existing rotor remains animated in Three.js.
for toy in D['toys']:
 c=pt(toy['contact'])
 if toy['id'] in [1,3]:
  for y in [-.53,.53]:
   for x in [-.87,.87]:tube('Wheel support',[c+Vector((x,y,.05)),c+Vector((0,y,1.25))],.06,wood)
   o=disk('Wheel bearing',c+Vector((0,y,1.25)),.13,.06,metal);o.rotation_euler.x=math.pi/2
 if toy['id']==4:
  disk('Digging substrate',c+Vector((0,0,-.075)),.60,.08,edge)
  for i in range(50):
   a=i*2.4;r=.54*math.sqrt(i/50);o=box('Digging chips',c+Vector((r*math.cos(a),r*math.sin(a),-.025)),(.055,.024,.012),straw,0);o.rotation_euler.z=a
# Nest is open and low to preserve visibility and all five entrances.
c=pt([D['nest']['x'],D['nest']['y']]);disk('Nest bed',c,2.7,.25,soil)
for strand in range(3):
 pts=[]
 for i in range(481):
  a=i/480*math.tau;wave=a*40+strand*math.tau/3;r=2.64+.065*math.cos(wave)
  pts.append(c+Vector((r*math.cos(a),r*math.sin(a),.16+.06*math.sin(wave))))
 tube('Braided nest border',pts,.045,straw if strand!=1 else wood)
for i in range(420):
 a=random.random()*math.tau;r=2.48*math.sqrt(random.random());o=box('Nest bedding',c+Vector((math.cos(a)*r,math.sin(a)*r,.143)),(random.uniform(.08,.32),.022,.01),straw,0);o.rotation_euler.z=random.random()*math.tau
# Convert curves and consolidate by material for a small draw-call budget.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
objects=list(bpy.context.scene.objects);buckets=[(m,[o for o in objects if o.type=='MESH' and o.data.materials[0]==m]) for m in materials]
for m,items in buckets:
 if not items:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in items:o.select_set(True)
 bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();items[0].name=m.name
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'habitat.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/habitat.glb'),export_format='GLB',export_animations=False)
report={'meshes':len(bpy.context.scene.objects),'triangles':sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in bpy.context.scene.objects),'bytes':(ROOT/'public/models/habitat.glb').stat().st_size,'layoutSource':'art/habitat/layout.json'}
(OUT/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
