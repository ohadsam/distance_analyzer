import sys,math
sys.path.insert(0,'.')
from lib import *
pi=math.pi
def sn(t,k=1,ph=0): return math.sin(2*pi*(k*t+ph))
def cs(t,k=1,ph=0): return math.cos(2*pi*(k*t+ph))
def bump(t): return max(0.0,sn(t))**1.0   # 0..1 in first half
def hold(t,a=.22,b=.72):  # ease in, hold, ease out (cyclic)
    return cyc([(0,0),(a,1),(b,1)],t)
def breath(t,amp=1): return amp*sn(t)
EX={}
def ex(name,view,ms):
    def d(fn): EX[name]=(view,ms,fn); return fn
    return d
# ---------- warm-ups (side view, facing right: forward = negative thigh / upper; knee flexion = positive shin; forward lean = positive torso)
@ex('wu_march','side',1600)
def _(t):
    n,f=bump(t),bump(t+.5)
    return dict(angles=dict(near_thigh=-80*n,near_shin=95*n,far_thigh=-80*f,far_shin=95*f,
        near_upper=-28*n+28*f,far_upper=-28*f+28*n,near_lower=-45,far_lower=-45,torso=2,head=-1,tail=2*sn(t,2)),lift=0)
@ex('wu_high_knees','side',1200)
def _(t):
    n,f=bump(t),bump(t+.5)
    return dict(angles=dict(near_thigh=-100*n,near_shin=110*n,far_thigh=-100*f,far_shin=110*f,
        near_upper=-45*n+45*f,far_upper=-45*f+45*n,near_lower=-85,far_lower=-85,torso=6,head=-4,tail=3*sn(t,2)),lift=8*cs(t,2)**2)
@ex('wu_butt_kicks','side',1200)
def _(t):
    n,f=bump(t),bump(t+.5)
    return dict(angles=dict(near_thigh=10*n-4,near_shin=138*n,far_thigh=10*f-4,far_shin=138*f,
        near_upper=-35*n+35*f,far_upper=-35*f+35*n,near_lower=-80,far_lower=-80,torso=6,head=-4,tail=3*sn(t,2)),lift=7*cs(t,2)**2)
@ex('wu_skips','side',1400)
def _(t):
    n,f=bump(t),bump(t+.5)
    sup_n,sup_f=f,n   # support leg toe-off while other drives
    return dict(angles=dict(near_thigh=-72*n,near_shin=82*n,far_thigh=-72*f,far_shin=82*f,near_shoe=22*sup_n,far_shoe=22*sup_f,
        near_upper=-55*n+55*f,far_upper=-55*f+55*n,near_lower=-70,far_lower=-70,torso=3,head=-2,tail=4*sn(t,2)),lift=15*sn(t,2)**2)
@ex('wu_ankle_rolls','side',2400)
def _(t):
    return dict(angles=dict(near_thigh=-42,near_shin=85,near_shoe=40*sn(t)+10,far_thigh=0,
        near_upper=-18,near_lower=-40,far_upper=6,far_lower=-10,torso=0,head=2,tail=2*sn(t)),lift=0)
@ex('wu_calf_raises','side',1800)
def _(t):
    b=cyc([(0,0),(.28,1),(.62,1),(.9,0)],t)
    return dict(angles=dict(near_shoe=30*b,far_shoe=30*b,near_upper=-12*b,far_upper=-12*b,near_lower=-12,far_lower=-12,head=-1*b,tail=2*sn(t)),
        ground=False,root=(0,-21*b))
LIFTZ={'near_thigh':9,'near_shin':9,'near_shoe':9}
def zl(a): return LIFTZ if a<-25 else None
# add near-leg z override to the side warm-ups
for _n in ['wu_march','wu_high_knees','wu_skips','wu_ankle_rolls']:
    v,ms,fn=EX[_n]
    def w(t,fn=fn):
        r=fn(t)
        if r['angles'].get('near_thigh',0)<-25: r['z']=LIFTZ
        return r
    EX[_n]=(v,ms,w)
# ---------- front view
FL,FR=(236,470),(274,470)
@ex('wu_hip_circles','front',2400)
def _(t):
    return dict(angles=dict(torso=-7*sn(t),head=3*sn(t),upper_l=28,upper_r=-28,lower_l=-85,lower_r=85),root=(22*sn(t),4*cs(t,2)),
        feet=dict(l=FL,r=FR))
@ex('wu_side_steps','front',1600)
def _(t):
    def seg(a,b,t0,t1,t_):
        u=min(max((t_-t0)/(t1-t0),0),1);return a+(b-a)*ss(u),math.sin(pi*u)
    t_=t%1; lx=236; rx=274; ly=ry=0
    if t_<.25: rx,ry=seg(274,300,0,.25,t_); lx=236
    elif t_<.5: rx=300; lx,ly=seg(236,262,.25,.5,t_)
    elif t_<.75: rx=300; lx,ly=seg(262,236,.5,.75,t_)
    else: lx=236; rx,ry=seg(300,274,.75,1,t_)
    if t_>=.5 and t_<.75: lx=seg(262,236,.5,.75,t_)[0]; rx=300
    cx=(lx+rx)/2-255
    return dict(angles=dict(head=0,upper_l=18+6*sn(t,2),upper_r=-18-6*sn(t,2),lower_l=-75,lower_r=75),root=(cx,5+4*cs(t,2)),
        feet=dict(l=(lx,470-12*ly),r=(rx,470-12*ry)))
@ex('wu_torso_twist','front',2400)
def _(t):
    s=sn(t)
    return dict(angles=dict(torso=4*s,head=-3*s,upper_l=74-26*s,upper_r=-74-26*s,lower_l=-14-10*s,lower_r=14-10*s,tail=0),
        root=(2*s,0),feet=dict(l=FL,r=FR))
# ---------- cool-downs
@ex('cd_hamstring','side',3600)
def _(t):
    u=hold(t); br=sn(t)*0.8
    return dict(angles=dict(pelvis=22*u,torso=(26+br)*u,head=-20*u,upper_l=0,near_upper=-72*u,far_upper=-76*u,near_lower=-12*u,far_lower=-12*u,
        far_shoe=-32*u,near_thigh=0,tail=1.5*sn(t)),
        root=(-24*u,0),feet=dict(far=(318,470),near=(228,470)),straight=True)
@ex('cd_back_fold','side',3600)
def _(t):
    u=hold(t); br=sn(t)*1.2
    return dict(angles=dict(pelvis=10*u,torso=(46+br)*u,head=-18*u,near_upper=-62*u,far_upper=-62*u,near_lower=-6*u,far_lower=-6*u,
        near_thigh=-6*u,near_shin=12*u,far_thigh=-6*u,far_shin=12*u,tail=3*sn(t)*u),root=(-26*u,0))
@ex('cd_chest','side',3600)
def _(t):
    u=hold(t); br=sn(t)
    return dict(angles=dict(torso=-5*u-0.6*br,head=-8*u,near_upper=52*u,far_upper=46*u,near_lower=4*u,far_lower=4*u,near_hand=0,tail=1.5*sn(t)),root=(0,0))
@ex('cd_shoulder','front',3600)
def _(t):
    u=hold(t); br=sn(t)*0.6
    return dict(angles=dict(upper_r=84*u+br,lower_r=-4*u,upper_l=2*u,lower_l=-150*u,head=3*u,torso=1.5*u),root=(0,0),feet=dict(l=FL,r=FR),z=dict(upper_r=11,lower_r=11,hand_r=13,upper_l=11,lower_l=14,hand_l=15) if u>.05 else None)
@ex('cd_adductor','front',3600)
def _(t):
    u=hold(t); br=sn(t)
    return dict(angles=dict(upper_l=20*u,upper_r=-20*u,lower_l=-60*u,lower_r=60*u,torso=-3*u,head=2*u),
        root=(30*u,0),feet=dict(l=(236-36*u,470),r=(274+50*u,470)),straight=True)
@ex('cd_breathing','front',4000)
def _(t):
    b=cyc([(0,0),(.45,1),(.55,1)],t)
    return dict(angles=dict(upper_l=8+142*b,upper_r=-8-142*b,lower_l=8*(1-b)-6*b,lower_r=-8*(1-b)+6*b,head=-2*b,torso=-2*b),
        root=(0,-3*b),feet=dict(l=FL,r=FR))
