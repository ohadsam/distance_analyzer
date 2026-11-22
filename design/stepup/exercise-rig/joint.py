from PIL import Image, ImageDraw
import numpy as np
from scipy.ndimage import distance_transform_edt

def patch(src,pivot,radius):
    # Sample interior pixels from the existing child artwork, not a new illustration.
    a=np.array(src); rgb=a[:,:,:3].astype(int); good=(a[:,:,3]>245)&(rgb.max(2)>145)&(rgb[:,:,0]>rgb[:,:,2]+30)
    if not good.any(): return None
    yy,xx=np.indices(good.shape); local=good&((xx-pivot[0])**2+(yy-pivot[1])**2<(radius*2.5)**2)
    if local.any(): good=local
    idx=distance_transform_edt(~good,return_distances=False,return_indices=True)
    b=a[idx[0],idx[1]].copy(); dist=np.hypot(xx-pivot[0],yy-pivot[1]); b[:,:,3]=np.clip((radius-dist)*255,0,255).astype('uint8'); return Image.fromarray(b)

def blend_overlap(upper,lower,q):
    # Remove dark internal edge only where both original layers have opaque coverage.
    from scipy.ndimage import distance_transform_edt
    a=np.array(upper); b=np.array(lower); yy,xx=np.indices(a.shape[:2]); rgb=a[:,:,:3].astype(float); low=b[:,:,:3].astype(float)
    inside=distance_transform_edt(b[:,:,3]>240)
    dark=rgb.mean(2)<100
    skin=(low[:,:,0]>low[:,:,2]+25)&(low.mean(2)>105)
    mask=dark&skin&(a[:,:,3]>220)&(inside>2)&(np.hypot(xx-q[0],yy-q[1])<18)
    w=np.clip((inside-2)/3,0,1)*mask
    a[:,:,:3]=np.round(rgb*(1-w[:,:,None])+low*w[:,:,None]).astype('uint8')
    return Image.fromarray(a)
