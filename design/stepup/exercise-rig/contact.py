import math, json, copy, hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from render import render
P=Path(__file__).parent
def rot(v,a):
 c,s=np.cos(np.radians(a)),np.sin(np.radians(a));return np.array([[c,-s],[s,c]])@v
def fk(r,a):
 d={p['id']:p for p in r['parts']};o={}
 def f(k):
  if k not in o:
   p=d[k]; par=p['parent_id'];q,b=f(par) if par else (np.array(r['root']),0);o[k]=(q+rot(p['attachment'],b) if par else q,b+a.get(k,0))
  return o[k]
 for k in d:f(k)
 return o
def ik(r,a,u,l,e,target,sign):
 d={p['id']:p for p in r['parts']};f=fk(r,a);q=f[u][0];pa=f[d[u]['parent_id']][1];v=target-q; L=np.linalg.norm(d[l]['attachment']);M=np.linalg.norm(d[e]['attachment']);dist=np.clip(np.linalg.norm(v),abs(L-M)+1e-6,L+M-1e-6);b=sign*math.acos(np.clip((dist**2-L**2-M**2)/(2*L*M),-1,1));arg=lambda v:math.degrees(math.atan2(v[1],v[0]));theta=arg(v)-math.degrees(math.atan2(M*math.sin(b),L+M*math.cos(b)));a[u]=theta-arg(d[l]['attachment'])-pa;a[l]=math.degrees(b)+arg(d[l]['attachment'])-arg(d[e]['attachment'])
def sole(p):
 im=Image.open(P/p['file']).convert('RGBA').resize(tuple(p['size']),Image.Resampling.LANCZOS); y,x=np.where(np.array(im)[:,:,3]>=128); m=y.max();return np.array([np.median(x[y==m]),m])-p['pivot']
def run():
 r=json.loads((P/'rig_side_refined.json').read_text());d={p['id']:p for p in r['parts']}; anims=json.loads((P/'animations.json').read_text()); report={}; sheet=Image.new('RGB',(768,384),'white');draw=ImageDraw.Draw(sheet)
 for row,name in enumerate(['cd_calf','cd_back_fold']):
  # Keep both sole landmarks fixed for the entire cycle; no step is portrayed.
  old=anims[name]; out=P/name;out.mkdir(exist_ok=True);frames=[];poses=[];metrics=[]; offsets={s:sole(d[s+'_shoe']) for s in ['near','far']}; targets={s:np.array([x,458.]) for s,x in zip(['near','far'],[305,210] if row==0 else [250,280])}
  for i in range(13):
   t=i%12;v=min(t/3,1,(12-t)/3);s=v*v*(3-2*v);rr=copy.deepcopy(r);a={};rr['root']=[250-10*s,296+8*s] if row==0 else [250-30*s,284+8*s];a['torso']=(18 if row==0 else 48)*s;a['head']=-a['torso']*.22;a['tail']=2*math.sin(t*math.tau/12)
   for side in targets:
    e=side+'_shoe';ik(rr,a,side+'_thigh',side+'_shin',e,targets[side]-offsets[side],1);a[e]=-fk(rr,a)[side+'_shin'][1]
   for side in targets:
    f=fk(rr,a); q=f[side+'_upper'][0]; target=q+np.array([0,82]); dest=np.array([335,255+(side=='near')*13]) if row==0 else f[side+'_shin'][0]+np.array([0,18]);ik(rr,a,side+'_upper',side+'_lower',side+'_hand',target*(1-s)+dest*s,-1)
   poses.append({'root':rr['root'],'angles':a}); f=fk(rr,a)
   if i==12:break
   im=render(rr,a,joints=True);frames.append(im);im.save(out/f'ex_{name}_{i+1:02}_transparent.png');bg=Image.new('RGBA',im.size,'#ff00ff');bg.alpha_composite(im);bg.convert('RGB').save(out/f'ex_{name}_{i+1:02}.png');b=im.getbbox();ar=np.array(im).astype(int);metrics.append({'frame':i+1,'margin':min(b[0],b[1],512-b[2],512-b[3]),'pink':int(((ar[:,:,0]-ar[:,:,1]>40)&(ar[:,:,2]-ar[:,:,1]>40)&(ar[:,:,3]>0)).sum()),'sole_error':{side:float(np.linalg.norm(f[side+'_shoe'][0]+rot(offsets[side],f[side+'_shoe'][1])-targets[side])) for side in targets},'length_error':max(abs(np.linalg.norm(f[k][0]-f[p['parent_id']][0])-np.linalg.norm(p['attachment'])) for k,p in d.items() if p['parent_id'])})
  frames[0].save(out/'preview.gif',save_all=True,append_images=frames[1:],duration=300,loop=0,disposal=2);old.update(poses=poses[:12],status='prototype contact test');(out/'animation.json').write_text(json.dumps(old,indent=2));anims[name]=old
  for j in range(4):
   q=frames[j*3].resize((192,192));sheet.paste(q,(j*192,row*192),q)
  report[name]={'frames':metrics,'max_sole_landmark_error':max(max(m['sole_error'].values()) for m in metrics),'closure':poses[0]==poses[12],'delta':[float(np.abs(np.array(frames[j]).astype(float)-np.array(frames[(j+1)%12])).mean()) for j in range(12)]}
 sheet.save(P/'overview.png');(P/'validation.json').write_text(json.dumps(report,indent=2));(P/'animations.json').write_text(json.dumps(anims,indent=2));print([(k,v['max_sole_landmark_error'],min(m['margin'] for m in v['frames'])) for k,v in report.items()])
if __name__=='__main__':run()
