import bpy,json
from pathlib import Path
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'art/rat/rat-anatomy.blend'),use_scripts=False)
rig=bpy.data.objects['Rattery_Rat_Rig'];coat=bpy.data.objects['Ivory coat'];skin=bpy.data.objects['Warm pink skin']
groups={g.index:g.name for g in skin.vertex_groups if g.name.startswith('qa.attach.')}
probes={name:[v.index for v in skin.data.vertices if any(g.group==idx for g in v.groups)] for idx,name in groups.items()}
assert len(probes)==4 and all(probes.values()),probes
checks=0;worst=-100
for name in ['Idle','Sniff','Walk']:
    rig.animation_data.action=bpy.data.actions[name]
    for tr in rig.animation_data.nla_tracks:tr.mute=True
    action=rig.animation_data.action
    if hasattr(action,'slots') and len(action.slots):rig.animation_data.action_slot=action.slots[0]
    lo,hi=action.frame_range
    for frame in range(33):
        bpy.context.scene.frame_set(int(lo+(hi-lo)*frame/32))
        deps=bpy.context.evaluated_depsgraph_get();ec=coat.evaluated_get(deps);es=skin.evaluated_get(deps)
        cm=ec.to_mesh();sm=es.to_mesh()
        tree=BVHTree.FromPolygons([ec.matrix_world@v.co for v in cm.vertices],[list(p.vertices) for p in cm.polygons])
        for limb,indices in probes.items():
            for idx in indices:
                pos=es.matrix_world@sm.vertices[idx].co
                hit,normal,_,distance=tree.find_nearest(pos)
                signed=(pos-hit).dot(normal);worst=max(worst,signed);checks+=1
                assert signed<.002,(name,frame,limb,signed)
        ec.to_mesh_clear();es.to_mesh_clear()
report={'attachmentSamples':checks,'maxSignedDistance':worst,'clips':3,'legs':4}
(root/'art/rat/attachment-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
