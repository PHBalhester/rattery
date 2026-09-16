import subprocess,os,json,time
from pathlib import Path
r=Path(__file__).resolve().parents[1];out=r/'test-results/audit-2026-09-16';out.mkdir(exist_ok=True,parents=True)
names=['mock-rpc','determinism','replay','social','navigation','exploration','ecology','enrichment','stress-matrix','feed-resilience','api-fault','activity-adversarial','navigation-index','replay-checkpoint','pool-coverage','snapshot-service','snapshot-builder','snapshot-incremental','approved-trade-rules','care','burn','rat-render','separation','motion-crowding','memorial-alerts','refuge-speed','crowding','expansion','audit-security','audit-navigation-equivalence']
results=[]
for name in names:
 start=time.time()
 try:
  p=subprocess.run(['npx','--no-install','tsx','scripts/'+name+'-test.ts'],cwd=r,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=180)
  text=p.stdout;code=p.returncode
 except subprocess.TimeoutExpired as e:text=str(e.stdout);code=124
 (out/(name+'.log')).write_text(text);results.append(dict(name=name,code=code,seconds=round(time.time()-start,2)))
 (out/'local-results.json').write_text(json.dumps(results,indent=2));print(name,code,flush=True)

raise SystemExit(1 if any(r['code'] != 0 for r in results) else 0)
