import sys,hashlib;sys.path.insert(0,'/tmp/claude-0/w')
import ex
from lib import *
OUT=Path('/tmp/claude-0/out'); OUT.mkdir(exist_ok=True)
rep={}
for n,(v,ms,fn) in ex.EX.items():
    poses=make(v,fn); d=OUT/n; d.mkdir(exist_ok=True); fr=[]; rows=[]
    for i,p in enumerate(poses):
        rr=copy.deepcopy(R[v]); rr['root']=p['root']
        im=render(rr,p['angles'],joints=(v=='side'),overrides=p.get('render_overrides')); fr.append(im)
        im.save(d/f'ex_{n}_{i+1:02}_transparent.png')
        ar=np.array(im).astype(int); b=im.getbbox()
        bg=Image.new('RGBA',im.size,'#ff00ff'); bg.alpha_composite(im); bg.convert('RGB').save(d/f'ex_{n}_{i+1:02}.png')
        pk=int(((ar[:,:,0]-ar[:,:,1]>40)&(ar[:,:,2]-ar[:,:,1]>40)&(ar[:,:,3]>0)).sum())
        rows.append(dict(margin=min(b[0],b[1],512-b[2],512-b[3]),pink=pk))
    # closure: pose(t=1)==pose(0) by construction (periodic fn); verify numerically
    p0=make(v,lambda t,fn=fn:fn(t if t<1 else 0),frames=1)[0]; p1=fn(1.0)
    delta=[float(np.abs(np.array(fr[j]).astype(np.int16)-np.array(fr[(j+1)%12]).astype(np.int16)).mean()) for j in range(12)]
    rep[n]=dict(view=v,loop_ms=ms,min_margin=min(r['margin'] for r in rows),pink=sum(r['pink'] for r in rows),mean_delta_max=max(delta),mean_delta_min=min(delta),loop_close_delta=delta[11])
    print(n,rep[n]['min_margin'],rep[n]['pink'],round(max(delta),2),round(delta[11],2),flush=True)
json.dump(rep,open(OUT/'report.json','w'),indent=1)
