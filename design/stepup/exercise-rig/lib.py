import json, math, copy
import numpy as np
from PIL import Image
from pathlib import Path
from render import render
from contact import fk, ik, sole, rot
P=Path(__file__).parent
R={v:json.loads((P/f).read_text()) for v,f in [('side','rig_side_refined.json'),('front','rig_front.json')]}
D={v:{p['id']:p for p in R[v]['parts']} for v in R}
G=470.0
def ss(x): x=min(max(x,0),1); return x*x*(3-2*x)
def cyc(keys,t):
    """keys: [(t0,val),...] sorted, cyclic with period 1; val dict or number. smoothstep between."""
    keys=sorted(keys,key=lambda k:k[0]); t%=1.0
    pts=keys+[(keys[0][0]+1,keys[0][1])]
    if t<keys[0][0]: t+=1
    for (a,va),(b,vb) in zip(pts,pts[1:]):
        if a<=t<=b:
            u=ss((t-a)/(b-a)) if b>a else 0
            if isinstance(va,dict):
                ks=set(va)|set(vb);return {k:va.get(k,0)*(1-u)+vb.get(k,0)*u for k in ks}
            return va*(1-u)+vb*u
def soles(view,rr,a):
    f=fk(rr,a);o={}
    for k,p in D[view].items():
        if 'shoe' in k: o[k]=f[k][0]+rot(sole(p),f[k][1])
    return o
def plant(view,rr,a,side,target,sign=1):
    s='' 
    th,sh,sf=(f'{side}_thigh',f'{side}_shin',f'{side}_shoe') if view=='side' else (f'thigh_{side}',f'shin_{side}',f'shoe_{side}')
    off=sole(D[view][sf]); ik(rr,a,th,sh,sf,np.array(target)-off,sign); a[sf]=-fk(rr,a)[sh][1]
def reach(view,rr,a,u,l,e,target,sign):
    ik(rr,a,u,l,e,np.array(target,float),sign)
def make(view,fn,frames=12,ground=True):
    """fn(t)-> dict(angles=..., root=(dx,dy), feet={side:(x,y)|None}, hands={'name':(x,y,sign)}, lift=px, ground=bool)"""
    out=[]
    for i in range(frames):
        t=i/frames; s=fn(t); rr=copy.deepcopy(R[view]); a=dict(s.get('angles',{}))
        dx,dy=s.get('root',(0,0)); rr['root']=[R[view]['root'][0]+dx,R[view]['root'][1]+dy]
        if s.get('ground',True) and not s.get('feet'):
            # lock lowest sole to ground
            lo=max(v[1] for v in soles(view,rr,a).values()); rr['root'][1]+=G-lo-s.get('lift',0)
        if s.get('straight'):
            best=None
            for dyy in np.arange(-90,60,0.5):
                r2=copy.deepcopy(rr); r2['root'][1]=R[view]['root'][1]+dyy; a2=dict(a); err=0
                for sd,tg in s['feet'].items():
                    plant(view,r2,a2,sd,tg,s.get('legsign',1)); err+=float(np.linalg.norm(soles(view,r2,a2)[('far_shoe' if sd=='far' else 'near_shoe') if view=='side' else 'shoe_'+sd]-np.array(tg)))
                if err<1.0: best=dyy;break
            rr['root'][1]=R[view]['root'][1]+(best if best is not None else 0)
        for side,tg in (s.get('feet') or {}).items():
            plant(view,rr,a,side,tg,s.get('legsign',1))
        for k,(x,y,sg) in (s.get('hands') or {}).items():
            u,l,e=(f'{k}_upper',f'{k}_lower',f'{k}_hand') if view=='side' else (f'upper_{k}',f'lower_{k}',f'hand_{k}')
            ik(rr,a,u,l,e,np.array([x,y],float)-np.array([0,0]),sg)
        o=dict(root=[float(rr['root'][0]),float(rr['root'][1])],angles={k:float(v) for k,v in a.items()})
        if s.get('z'): o['render_overrides']={k:{'z_order':z} for k,z in s['z'].items()}
        out.append(o)
    return out
