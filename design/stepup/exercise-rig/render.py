from PIL import Image, ImageDraw
import json, math, hashlib
from pathlib import Path
P=Path(__file__).parent

def render(rig, angles={}, debug=False, joints=False, overrides=None):
    import copy
    rig=copy.deepcopy(rig)
    for part in rig['parts']:
        part.update((overrides or {}).get(part['id'], {}))
    lookup={p['id']:p for p in rig['parts']}; transforms={}
    def rot(v,a):
        c,s=math.cos(math.radians(a)),math.sin(math.radians(a));return (c*v[0]-s*v[1],s*v[0]+c*v[1])
    def solve(k):
        if k in transforms:return transforms[k]
        p=lookup[k]; parent=p['parent_id']; a=angles.get(k,0)
        if parent:
            q,b=solve(parent); d=rot(p['attachment'],b); q=(q[0]+d[0],q[1]+d[1]); a+=b
        else:q=rig['root']
        transforms[k]=(q,a);return q,a
    im=Image.new('RGBA',(512,512))
    for p in sorted(rig['parts'],key=lambda p:p['z_order']):
        q,a=solve(p['id']); src=Image.open(P/p['file']).convert('RGBA').resize(tuple(p['size']),Image.Resampling.LANCZOS)
        c,s=math.cos(math.radians(a)),math.sin(math.radians(a)); x,y=p['pivot']; u,v=q
        layer=src.transform(im.size,Image.Transform.AFFINE,(c,s,x-c*u-s*v,-s,c,y+s*u-c*v),Image.Resampling.BICUBIC)
        if joints and p['id'].endswith(('_upper','_thigh')):
            from joint import blend_overlap
            prefix=p['id'].split('_')[0]; child=lookup.get(prefix+('_lower' if p['id'].endswith('_upper') else '_shin'))
            if child:
                cq,ca=solve(child['id']); cs=Image.open(P/child['file']).convert('RGBA').resize(tuple(child['size']),Image.Resampling.LANCZOS)
                cc,ss=math.cos(math.radians(ca)),math.sin(math.radians(ca)); xx,yy=child['pivot']; uu,vv=cq
                lower=cs.transform(im.size,Image.Transform.AFFINE,(cc,ss,xx-cc*uu-ss*vv,-ss,cc,yy+ss*uu-cc*vv),Image.Resampling.BICUBIC)
                layer=blend_overlap(layer,lower,cq)
        im.alpha_composite(layer)
    if debug:
        d=ImageDraw.Draw(im)
        for k,(q,a) in transforms.items():
            x,y=q;d.line((x-5,y,x+5,y),fill='cyan',width=2);d.line((x,y-5,x,y+5),fill='cyan',width=2)
    if not debug:
        import numpy as np
        from scipy.ndimage import distance_transform_edt
        arr=np.array(im); b=arr.astype(int); bad=(b[:,:,0]-b[:,:,1]>40)&(b[:,:,2]-b[:,:,1]>40)&(arr[:,:,3]>0); good=(arr[:,:,3]>0)&~bad
        if bad.any() and good.any():
            idx=distance_transform_edt(~good,return_distances=False,return_indices=True); arr[bad,:3]=arr[idx[0][bad],idx[1][bad],:3]
        arr[arr[:,:,3]==0,:3]=0
        im=Image.fromarray(arr)
    return im
if __name__=='__main__':
    r=json.loads((P/'rig_side_draft.json').read_text());render(r).save(P/'neutral.png')
