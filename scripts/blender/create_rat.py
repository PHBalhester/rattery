"""Original anatomical rat study. Reproducible Blender source; no downloaded assets."""
import bpy, bmesh, math, random, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'art/rat'; OUT.mkdir(parents=True,exist_ok=True)
PUBLIC=ROOT/'public/models'; PUBLIC.mkdir(parents=True,exist_ok=True)
random.seed(817)
bpy.ops.wm.read_factory_settings(use_empty=True)

def material(name,color,rough=.5):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
    return m
fur=material('Ivory coat',(0.77,.745,.70),.87)
p=fur.node_tree.nodes.get('Principled BSDF'); p.inputs['Subsurface Weight'].default_value=.055
noise=fur.node_tree.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=190
bump=fur.node_tree.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.14; bump.inputs['Distance'].default_value=.008
fur.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']); fur.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
skin=material('Warm pink skin',(.57,.285,.29),.6)
skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.12
inner=material('Ear inner pink',(.69,.36,.39),.69)
eye=material('Ruby black eyes',(.027,.004,.006),.14)
eye.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.65
nosemat=material('Nose',(.36,.125,.15),.45)
claw=material('Translucent ivory claws',(.66,.54,.48),.4)
hairmat=material('Fine ivory fibres',(.86,.835,.79),.9)
objects=[]; bindings={}
def mesh(name,verts,faces,mat,binding='body'):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    for f in d.polygons:f.use_smooth=True
    objects.append(o); bindings[o.name]=binding;return o

def oval(name,loc,scale,mat,binding='body',segments=32,rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=True
    objects.append(o);bindings[o.name]=binding;return o

def tube(name,points,radii,mat,binding='body',sides=8):
    pts=[Vector(p) for p in points];v=[];faces=[]
    for i,c in enumerate(pts):
        t=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        a=t.cross(Vector((0,0,1)))
        if a.length<.01:a=t.cross(Vector((0,1,0)))
        a.normalize();b=t.cross(a).normalized()
        for k in range(sides):v.append(c+radii[i]*(a*math.cos(k*math.tau/sides)+b*math.sin(k*math.tau/sides)))
        if i:
            for k in range(sides):
                q=(i-1)*sides+k;r=(i-1)*sides+(k+1)%sides
                faces.append((q,r,r+sides,q+sides))
    faces.append(tuple(range(sides-1,-1,-1)));faces.append(tuple((len(pts)-1)*sides+k for k in range(sides)))
    return mesh(name,v,faces,mat,binding)

# Overlapping anatomical masses are fused into one continuous surface.
core=[]
for name,loc,scale in [
 ('abdomen',(-.29,0,.48),(.56,.32,.38)),
 ('ribcage',(.10,0,.50),(.40,.275,.31)),
 ('shoulders',(.34,0,.51),(.25,.225,.285)),
 ('neck',(.47,0,.57),(.24,.19,.225)),
 ('cranium',(.65,0,.66),(.265,.185,.205)),
 ('cheeks',(.77,0,.55),(.22,.16,.15)),
 ('muzzle',(.94,0,.50),(.19,.105,.09))]:
    core.append(oval(name,loc,scale,fur))
for s in [-1,1]:
    core.append(oval('haunch',(-.40,s*.205,.31),(.28,.18,.25),fur))
    core.append(oval('upper forelimb',(.36,s*.145,.35),(.105,.095,.17),fur))
bpy.ops.object.select_all(action='DESELECT')
for o in core:o.select_set(True)
bpy.context.view_layer.objects.active=core[0];bpy.ops.object.join();body=core[0];body.name='Continuous anatomical coat'
# Keep vertices in world space for deterministic weighting/fur placement.
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
rem=body.modifiers.new('Fuse anatomy','REMESH');rem.mode='VOXEL';rem.voxel_size=.018
bpy.ops.object.modifier_apply(modifier=rem.name)
smooth=body.modifiers.new('Organic transitions','SMOOTH');smooth.factor=1.3;smooth.iterations=7
bpy.ops.object.modifier_apply(modifier=smooth.name)
sub=body.modifiers.new('Surface refinement','SUBSURF');sub.levels=1
bpy.ops.object.modifier_apply(modifier=sub.name)
dec=body.modifiers.new('Web topology','DECIMATE');dec.ratio=.48
bpy.ops.object.modifier_apply(modifier=dec.name)
objects=[body];bindings={body.name:'body'}
for f in body.data.polygons:f.use_smooth=True

# Cup-shaped ears: a rolled, irregular rim and a concave inner surface.
for s in [-1,1]:
    verts=[];faces=[]
    for j in range(13):
        r=j/12
        for k in range(48):
            a=k*math.tau/48
            x=.46+.12*r*math.cos(a)*(1+.16*math.sin(a))-.022*r*math.sin(a)
            z=.865+.149*r*math.sin(a)
            y=s*(.137+.037*r*r+.025*math.sin(a)*r)
            verts.append((x,y,z))
            if j:
                q=(j-1)*48+k;n=(j-1)*48+(k+1)%48
                faces.append((q,n,n+48,q+48))
    o=mesh('Ear cup '+str(s),verts,faces,inner,'head')
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    sol=o.modifiers.new('Ear thickness','SOLIDIFY');sol.thickness=.009
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
    rim=[verts[12*48+k] for k in range(48)]+[verts[12*48]]
    tube('Soft ear rim '+str(s),rim,[.009]*49,skin,'head',6)
    oval('Eye socket '+str(s),(.766,s*.151,.69),(.055,.030,.052),fur,'head')
    oval('Glossy eye '+str(s),(.777,s*.169,.694),(.044,.027,.042),eye,'head')
    oval('Muzzle pad '+str(s),(.997,s*.05,.494),(.086,.061,.058),fur,'head')
    for k in range(8):
        start=Vector((.998-k*.009,s*(.067+k*.001),.491+(k-3)*.009))
        end=start+Vector((-.15+k*.026,s*(.19+.025*(k%3)),.012+(k-4)*.024))
        mid=start.lerp(end,.52)+Vector((.025,0,.01))
        tube('Whisker', [start,mid,end],[.0015,.001,.00025],hairmat,'head',4)
    tube('Mouth crease',[(1.07,s*.016,.464),(1.025,s*.062,.451),(.956,s*.087,.457)],[.0025,.002,.001],nosemat,'head',5)
oval('Nose',(1.102,0,.498),(.035,.048,.029),nosemat,'head')
for s in [-1,1]:oval('Nostril',(1.124,s*.024,.505),(.01,.011,.007),eye,'head',16,8)

# Joint centres, tapered forearms, long hind feet and individually curved digits.
legspec={}
for s,label in [(-1,'L'),(1,'R')]:
    for kind,hip,knee,ankle,tip in [
      ('front',(.34,s*.16,.40),(.39,s*.20,.205),(.48,s*.22,.066),(.61,s*.23,.044)),
      ('hind',(-.40,s*.20,.36),(-.23,s*.285,.20),(-.41,s*.29,.077),(-.14,s*.32,.045))]:
        key=kind+'.'+label;legspec[key]=(hip,knee,ankle,tip)
        start=len(objects)
        # Rounded wrist and tapered palm are fused with the fingers, avoiding bead-like joins.
        tube(key+' forearm',[hip,Vector(hip).lerp(Vector(knee),.55),knee,Vector(knee).lerp(Vector(ankle),.48),ankle],
             [.055,.050,.043,.031,.028],skin,'paw:'+key,16)
        oval(key+' heel',ankle,(.039,.034,.033),skin,'paw:'+key)
        center=Vector(ankle).lerp(Vector(tip),.58)
        center.z=.045
        oval(key+' palm',center,(.082 if kind=='front' else .138,.050,.030),skin,'paw:'+key)
        count=4 if kind=='front' else 5
        lengths=[.060,.080,.085,.065] if kind=='front' else [.051,.075,.089,.083,.060]
        nail_ends=[]
        for k in range(count):
            spread=(k-(count-1)/2)*.029
            a=Vector((tip[0]-.041,tip[1]+spread*.77,.035))
            length=lengths[k]
            # Raised proximal knuckle, gently flexed middle joint, broad fingertip.
            points=[a,a+Vector((length*.27,spread*.12,.003)),
                    a+Vector((length*.62,spread*.28,-.013)),
                    a+Vector((length*.88,spread*.38,-.025)),
                    a+Vector((length,spread*.40,-.026))]
            tube(key+' digit',points,[.015,.016,.013,.010,.008],skin,'paw:'+key,12)
            nail_ends.append(points[-1])
        parts=objects[start:]
        bpy.ops.object.select_all(action='DESELECT')
        for part in parts:part.select_set(True)
        bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
        paw=parts[0];paw.name=key+' continuous paw'
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        rem=paw.modifiers.new('Continuous wrist and fingers','REMESH');rem.mode='VOXEL';rem.voxel_size=.0035
        bpy.ops.object.modifier_apply(modifier=rem.name)
        smooth=paw.modifiers.new('Soft knuckles','SMOOTH');smooth.factor=.65;smooth.iterations=3
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        dec=paw.modifiers.new('Paw topology','DECIMATE');dec.ratio=.52
        bpy.ops.object.modifier_apply(modifier=dec.name)
        for face in paw.data.polygons:face.use_smooth=True
        objects=objects[:start]+[paw];bindings[paw.name]='paw:'+key
        for end in nail_ends:
            tube(key+' curved nail',[end+Vector((-.005,0,.005)),end+Vector((.008,0,.006)),end+Vector((.016,0,.001))],
                 [.0055,.004,.0007],claw,key+'.foot',8)
pts=[];rs=[]
for i in range(65):
    t=i/64;pts.append((-.72-1.05*t,.04+.27*math.sin(t*2.3),.31*(1-t)**3+.038));rs.append(.047*(1-t)**.8+.002)
tail=tube('Tapered tail',pts,rs,skin,'tail',12)
# Subtle annular ridges in the tail silhouette, baked as geometry.
for i,v in enumerate(tail.data.vertices):
    ring=i//12
    if ring<65:
        center=Vector(pts[ring]);v.co=center+(v.co-center)*(1+.045*math.cos(ring*math.pi))

# Short tapered surface fibres, actual exportable geometry rather than Blender-only hair.
body.data.calc_loop_triangles();tris=body.data.loop_triangles
areas=[t.area for t in tris]
chosen=random.choices(list(tris),weights=areas,k=14500)
verts=[];faces=[]
for tri in chosen:
    va,vb,vc=[body.data.vertices[i] for i in tri.vertices]
    u=math.sqrt(random.random());v=random.random()
    pos=va.co*(1-u)+vb.co*(u*(1-v))+vc.co*(u*v)
    if pos.z<.16:continue
    n=(va.normal*(1-u)+vb.normal*(u*(1-v))+vc.normal*(u*v)).normalized()
    flow=Vector((-1,0,-.10));flow=(flow-n*flow.dot(n)).normalized()
    length=random.uniform(.012,.031)*( .65 if pos.x>.70 else 1)
    tangent=n.cross(flow).normalized()*.0013
    start=pos+n*.0008;mid=start+(n*.5+flow*.65)*length*.5;end=start+(n*.27+flow*.94)*length
    q=len(verts);verts.extend([start-tangent,start+tangent,mid+tangent*.5,mid-tangent*.5,end]);faces.extend([(q,q+1,q+2,q+3),(q+3,q+2,q+4)])
mesh('Short directional fur',verts,faces,hairmat,'body')

# Real skeleton; animation-only deformation is independent of simulation state.
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Rattery_Rat_Rig'
bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
def bone(name,a,b,parent=None):
    e=rig.data.edit_bones.new(name);e.head=a;e.tail=b
    if parent:e.parent=rig.data.edit_bones[parent]
    return e
bone('root',(0,0,.05),(0,0,.25))
bone('spine',(-.45,0,.45),(.34,0,.53),'root')
bone('head',(.34,0,.53),(.95,0,.53),'spine')
bone('tail',pts[0],pts[32],'spine');bone('tail.tip',pts[32],pts[-1],'tail')
for key,(hip,knee,ankle,tip) in legspec.items():
    bone(key+'.upper',hip,knee,'spine');bone(key+'.lower',knee,ankle,key+'.upper');bone(key+'.foot',ankle,tip,key+'.lower')
bpy.ops.object.mode_set(mode='OBJECT')
for o in objects:
    bind=bindings[o.name]
    o.parent=rig;mod=o.modifiers.new('Anatomical skin','ARMATURE');mod.object=rig
    groups={}
    def weight(name,idx,w):
        if w<.0001:return
        if name not in groups:groups[name]=o.vertex_groups.new(name=name)
        groups[name].add([idx],w,'REPLACE')
    for v in o.data.vertices:
        p=o.matrix_world@v.co
        if bind=='body':
            h=max(0,min(1,(p.x-.29)/.30))
            limb=None;amount=0
            for key,(hip,knee,ankle,tip) in legspec.items():
                width=.15 if key.startswith('front') else .23
                lateral=max(0,min(1,(abs(p.y)-.08)/.09)) if p.y*hip[1]>0 else 0
                mask=max(0,1-abs(p.x-hip[0])/width)*lateral*max(0,min(1,(hip[2]-.025-p.z)/.14))
                if mask>amount:limb=key;amount=mask
            if limb:weight(limb+'.upper',v.index,amount)
            weight('head',v.index,h*(1-amount));weight('spine',v.index,(1-h)*(1-amount))
        elif bind.startswith('paw:'):
            key=bind[4:];ankle_z=legspec[key][2][2]
            t=max(0,min(1,(p.z-(ankle_z-.012))/.065))
            t=t*t*(3-2*t)
            knee_z=legspec[key][1][2]
            upper=max(0,min(1,(p.z-(knee_z-.025))/.065));upper=upper*upper*(3-2*upper)
            weight(key+'.upper',v.index,upper)
            weight(key+'.lower',v.index,t*(1-upper));weight(key+'.foot',v.index,(1-t)*(1-upper))
            if p.z>legspec[key][0][2]-.008:
                weight('qa.attach.'+key,v.index,1)
        elif bind=='tail':
            t=max(0,min(1,(-p.x-1.10)/.42));weight('tail.tip',v.index,t);weight('tail',v.index,1-t)
        else:weight(bind,v.index,1)
# Merge by material, keeping vertex groups. This turns dozens of toes/hairs into 7 draws.
merged=[]
buckets=[(mat,[o for o in objects if o.data.materials[0]==mat]) for mat in [fur,skin,inner,eye,nosemat,claw,hairmat]]
for mat,subset in buckets:
    if not subset:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in subset:o.select_set(True)
    bpy.context.view_layer.objects.active=subset[0];bpy.ops.object.join()
    subset[0].name=mat.name;merged.append(subset[0])
objects=merged
# Actions use small anatomically plausible rotations; gait remains a first rig study.
for name,frames in [('Idle',72),('Sniff',48),('Walk',32)]:
    rig.animation_data_clear()
    for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
    for f in range(1,frames+2,4):
        phase=(f-1)/frames*math.tau
        for pb in rig.pose.bones:
            pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
            if pb.name=='head':pb.rotation_euler.x=(.022 if name=='Idle' else .07)*math.sin(phase);pb.rotation_euler.z=.025*math.cos(phase)
            if pb.name=='spine':pb.location.z=.003*math.sin(phase)
            if pb.name.startswith('tail'):pb.rotation_euler.y=.06*math.sin(phase)
            if name=='Walk':
                for key in legspec:
                    off=0 if key in ['front.L','hind.R'] else math.pi
                    a=math.sin(phase+off)
                    if pb.name==key+'.upper':pb.rotation_euler.x=.20*a
                    if pb.name==key+'.lower':pb.rotation_euler.x=-.24*max(0,a)
                    if pb.name==key+'.foot':pb.rotation_euler.x=.08*a
            pb.keyframe_insert(data_path='rotation_euler',frame=f,group=pb.name)
            pb.keyframe_insert(data_path='location',frame=f,group=pb.name)
    action=rig.animation_data.action;action.name=name;action.use_fake_user=True
rig.animation_data_clear()
for pb in rig.pose.bones:pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
rig.animation_data_create()
for name in ['Idle','Sniff','Walk']:
    tr=rig.animation_data.nla_tracks.new();tr.name=name;tr.strips.new(name,1,bpy.data.actions[name]);tr.mute=True
# Save editable source and export only rat (studio is added afterwards).
bpy.ops.object.select_all(action='DESELECT')
for o in objects+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'rat-anatomy.blend'))
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'rat-anatomy.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_materials='EXPORT')
report={'meshObjects':len(objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'bones':len(rig.data.bones),'glbBytes':(PUBLIC/'rat-anatomy.glb').stat().st_size,'stage':'anatomical rig study, not production accepted'}
(OUT/'report.json').write_text(json.dumps(report,indent=2))
# Studio render; not part of exported model.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.view_settings.exposure=-.35;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.73,.8,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
floor=material('Studio floor',(.73,.72,.69),.88)
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor)
for loc,energy,size in [((1,-3,4),350,4),((-2,2,3),450,3),((2,2,2),150,2)]:
    bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=energy;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,.4))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.25
for name,loc,target in [('three-quarter',(2.6,-4,1.8),(-.17,0,.48)),('profile',(.4,-4,1.2),(-.2,0,.5)),('front',(4,-.1,1.2),(.45,0,.53))]:
    cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
cam.data.ortho_scale=.57;cam.location=(1.15,-1.2,.48)
cam.rotation_euler=(Vector((.54,-.23,.105))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(OUT/'paws-detail.png');bpy.ops.render.render(write_still=True)
print(json.dumps(report))
