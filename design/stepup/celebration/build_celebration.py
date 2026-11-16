import json, math, io, zipfile, pathlib, re, xml.etree.ElementTree as ET
import cairosvg
from PIL import Image, ImageDraw, ImageFont
import numpy as np
R=pathlib.Path('/mnt/data/stepup-celebration'); R.mkdir(exist_ok=True)
P=json.load(open('/mnt/data/stepup-extension/palette.json'))
for m,vals in [('light',['#E0A800','#B8C2CC','#C07A4A']),('dark',['#F2C230','#8FA0B0','#D49B73'])]: P[m].update(zip(['gold','silver','bronze'],vals))
(R/'palette.json').write_text(json.dumps(P,indent=2))
files={}; purposes={}
def svg(w,h,b): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{b}</svg>'
def path(d,c,extra=''): return f'<path d="{d}" fill="{c}" {extra}/>'
def circle(x,y,r,c,extra=''): return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" {extra}/>'
def grad(id,c,d): return f'<linearGradient id="{id}" x2="0" y2="1"><stop stop-color="{c}"/><stop offset="1" stop-color="{d}"/></linearGradient>'
def star(x,y,r,c):
 pts=' '.join(f'{x+math.cos(math.pi*i/5-math.pi/2)*r*(1 if i%2==0 else .45):.2f},{y+math.sin(math.pi*i/5-math.pi/2)*r*(1 if i%2==0 else .45):.2f}' for i in range(10)); return f'<polygon points="{pts}" fill="{c}"/>'
def save(group,name,m,w,h,b,purpose):
 p=R/group/f'{name}-{m}.svg'; p.parent.mkdir(exist_ok=True); p.write_text(svg(w,h,b)); files[(group,name,m)]=p; purposes[(group,name)]=purpose
for m,p in P.items():
 bg,s,pr,su,wa,sk,tx,mu,ol,g,si,br=[p[k] for k in ['background','surface','primary','success','warm','sky','text','muted','outline','gold','silver','bronze']]
 def put(n,b,desc,w=360,h=450):save('podium',n,m,w,h,b,desc)
 defs='<defs>'+''.join(grad(k,c,c) for k,c in [('gold',g),('silver',si),('bronze',br)])+'</defs>'
 # metallic depth from translucent palette overlays, no foreign colors
 b=defs
 for x,y,w,c in [(32,324,100,si),(228,351,100,br),(119,280,122,g)]:
  b+=path(f'M{x} 411V{y+14}Q{x} {y} {x+14} {y}H{x+w-14}Q{x+w} {y} {x+w} {y+14}V411Z',c)
  b+=path(f'M{x+5} {y+15}Q{x+5} {y+5} {x+15} {y+5}H{x+w-15}Q{x+w-5} {y+5} {x+w-5} {y+15}V{y+20}H{x+5}Z',s,'opacity=".34"')
  b+=path(f'M{x} 399H{x+w}V411H{x}Z',tx,'opacity=".10"')
 # filled numeral shapes, custom geometry
 b+=path('M170 327L180 320H187V366H195V374H166V366H177V333L170 337Z',tx if m=='light' else bg)
 b+=path('M63 353Q63 339 80 339Q98 339 98 352Q98 361 85 370L75 378H98V386H62V378L81 362Q90 355 90 352Q90 347 80 347Q71 347 71 353Z',bg if m=='dark' else tx)
 b+=path('M263 367Q278 358 291 365Q303 373 291 383Q306 392 294 404Q280 413 263 402L267 395Q279 403 288 397Q294 389 278 389H274V381H279Q292 381 288 373Q280 368 267 375Z',bg if m=='dark' else tx)
 put('podium-steps',b,'Three rounded metallic steps with custom filled numerals')
 put('podium-floor',f'<defs><radialGradient id="shadow"><stop stop-color="{tx}" stop-opacity=".22"/><stop offset="1" stop-color="{tx}" stop-opacity="0"/></radialGradient></defs><ellipse cx="180" cy="414" rx="169" ry="25" fill="url(#shadow)"/>','Ground shadow')
 # ring cutout exact, inner shading only outside hole
 ring=lambda ro,ri,c,extra='':path(f'M{180-ro} 114a{ro} {ro} 0 1 0 {2*ro} 0a{ro} {ro} 0 1 0 {-2*ro} 0M{180-ri} 114a{ri} {ri} 0 1 0 {2*ri} 0a{ri} {ri} 0 1 0 {-2*ri} 0',c,f'fill-rule="evenodd" {extra}')
 b=ring(77,68.4,g)+ring(70.4,68.4,tx,'opacity=".18"')+ring(77,75,s,'opacity=".35"')
 for x,y,r in [(93,47,7),(269,47,6),(91,178,5),(269,178,7)]: b+=star(x,y,r,g)
 put('avatar-frame',b,'Transparent 136.8 diameter photo opening, metallic ring and four sparkles')
 put('ribbon',path('M148 182L165 179L180 211L195 179L212 182L190 230H170Z',pr)+path('M148 182L156 181L180 224L174 230Z',s,'opacity=".22"'),'V ribbon, separate from medal')
 put('medal',circle(180,240,24,g)+circle(180,240,19,s,'opacity=".25"')+circle(180,240,17,g)+star(180,240,13,bg if m=='dark' else tx),'Gold medal with star')
 b=path('M24 12H72V38Q72 58 52 62V76H66Q72 76 72 84H24Q24 76 30 76H44V62Q24 58 24 38Z',g)+path('M24 20H10V34Q10 52 31 52V44Q18 44 18 34V28H24ZM72 20H86V34Q86 52 65 52V44Q78 44 78 34V28H72Z',g)+path('M30 18H38V39Q38 50 46 54Q30 51 30 39Z',s,'opacity=".45"')+star(48,35,10,tx if m=='light' else bg)
 put('trophy',b,'Alternative trophy, place at x132 y184',96,96)
 b=''
 for side in [-1,1]:
  for i in range(8):
   x=180+side*(78+18*math.sin(i/7*math.pi)); y=199-i*15
   b+=f'<ellipse cx="{x:.2f}" cy="{y}" rx="6.5" ry="13" fill="{su}" transform="rotate({side*(35-i*8)} {x:.2f} {y})"/>'
  b+=path(f'M{180+side*65} 210Q{180+side*110} 154 {180+side*83} 85L{180+side*79} 85Q{180+side*104} 155 {180+side*61} 208Z',su)
 put('laurel',b,'Two filled leaf branches around avatar')
 for n,b in [('rectangle',f'<rect x="5" y="2" width="6" height="12" rx="2" fill="{pr}"/>'),('circle',circle(8,8,5,su)),('triangle',path('M8 2L15 13H1Z',wa)),('curl',path('M3 2Q15 1 12 7Q10 10 5 8Q2 8 5 12L9 14L6 16Q-2 12 2 7Q5 4 9 6Q11 4 3 5Z',sk)),('star',star(8,8,7,g))]: put('confetti-'+n,b,'Independent confetti particle',16,16)
 b=''.join(path('M180 180L161 4Q180 0 199 4Z',g,f'opacity=".08" transform="rotate({a} 180 180)"') for a in range(0,360,30))
 put('rays',b,'Low-opacity radial rays; place x0 y-66 to align with photo',360,360)
 for n,c in [('sunrise',wa),('forest',su),('ocean',sk)]:
  b=f'<defs>{grad("base",bg,s)}</defs><rect width="1080" height="1350" fill="url(#base)"/>'
  b+=circle(835,840,92,c,'opacity=".16"')+path('M0 1080Q180 855 365 1020T720 990T1080 950V1350H0Z',c,'opacity=".20"')+path('M0 1180Q190 1010 410 1150T790 1100T1080 1080V1350H0Z',pr,'opacity=".26"')+path('M0 1260Q250 1150 490 1240T1080 1190V1350H0Z',su,'opacity=".25"')+path('M420 1350Q710 1270 570 1210Q530 1185 660 1145L680 1145Q580 1185 610 1205Q790 1270 510 1350Z',s,'opacity=".65"')
  save('cards',n,m,1080,1350,b,'Share background, top 55% reserved for text')
 shapes=['M4 9Q4 4 9 4H39Q44 4 44 9V29L24 46L4 29Z','M24 2L45 14V34L24 46L3 34V14Z','M3 13L40 4L46 30L10 44Z','M24 2L30 8L39 6L42 15L47 24L41 32L40 41L30 42L24 47L17 42L7 41L6 32L1 24L6 15L9 6L18 8Z','M8 4H40Q45 4 45 10V38Q45 44 39 44H9Q3 44 3 38V10Q3 4 8 4Z']
 motifs=[path('M11 33Q9 25 20 24T31 15L36 15Q39 28 25 30T17 37Z',bg)+circle(34,13,4,bg),path('M24 9L12 28H23L20 40L36 20H25Z',bg),path('M12 28L19 12H26L22 23H36L29 36H13Z',bg)+path('M8 18H16V21H8Z M5 24H13V27H5Z',bg),path('M24 9Q36 21 32 31Q29 39 21 38Q9 35 16 24L21 29Q25 21 24 9Z',bg),path('M12 14H36V35H12Z',bg)+path('M16 10H20V18H16Z M28 10H32V18H28Z',bg)+path('M17 25L22 30L31 21L34 24L22 35L14 28Z',pr)]
 for i,n in enumerate(['distance-record','pace-record','fastest-kilometre','longest-streak','most-workouts-week']):
  c=[pr,sk,wa,su,pr][i]; b=path(shapes[i],c)+motifs[i]+star(37,10,5,g); save('badges',n,m,48,48,b,'Live record badge: '+n.replace('-',' '))
# render and validate
allowed=set('svg g path circle ellipse rect line polyline polygon defs clipPath linearGradient radialGradient stop'.split()); errors=[]; sizes={}; contrast={}
def render(p,w,h):return Image.open(io.BytesIO(cairosvg.svg2png(url=str(p),output_width=w,output_height=h))).convert('RGBA')
def lum(a):
 a=np.asarray(a,dtype=float)/255; a=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4); return a@np.array([.2126,.7152,.0722])
for (group,n,m),p in files.items():
 root=ET.parse(p).getroot(); sizes[str(p.relative_to(R))]=p.stat().st_size
 for e in root.iter():
  if e.tag.split('}')[-1] not in allowed:errors.append(str(p))
  for k,v in e.attrib.items():
   if k.startswith('on') or k in ['style','href'] or ('url(' in v and not v.startswith('url(#')):errors.append(str(p))
   if k in ['fill','stroke','stop-color'] and v not in P[m].values() and not v.startswith('url(#') and v!='none':errors.append(str(p)+v)
 if p.stat().st_size>20000:errors.append(str(p))
 im=render(p,360,450) if group=='podium' and n=='avatar-frame' else render(p,108,135)
 if group=='podium' and n=='avatar-frame':
  a=np.array(im); yy,xx=np.indices(a.shape[:2]); assert a[:,:,3][(xx-180)**2+(yy-114)**2<67**2].max()==0
 if group=='cards':
  a=np.array(render(p,1080,1350))[:742,:,:3]; l=lum(a); t=lum(bytes.fromhex(P[m]['text'][1:]).__iter__() if False else list(bytes.fromhex(P[m]['text'][1:]))); contrast[n+'-'+m]=float(np.min((np.maximum(l,t)+.05)/(np.minimum(l,t)+.05)))
# contact sheets
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16); title=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
def canvas(w,h):return Image.new('RGB',(w,h),'#e4e8eb')
def label(im,xy,t,f=font):ImageDraw.Draw(im).text(xy,t,font=f,fill='#17232d')
def tile(im,p,x,y,w,h,m):
 bg=Image.new('RGBA',(w,h),P[m]['background']); a=render(p,w,h); bg.alpha_composite(a); im.paste(bg.convert('RGB'),(x,y))
for group in ['cards','badges','podium']:
 names=list(dict.fromkeys(n for g,n,m in files if g==group)); w=1100; cw=250 if group=='cards' else 170; ch=330 if group=='cards' else 205; cols=3 if group=='cards' else 6
 rows=math.ceil(len(names)/cols); offset=530 if group=='podium' else 65; im=canvas(w,offset+2*(rows*ch+45)+20); label(im,(20,15),'STEPUP / '+group.upper(),title)
 if group=='podium':
  for j,m in enumerate(P):
   a=Image.new('RGBA',(360,450),P[m]['background']);
   def comp(n,x=0,y=0,w=360,h=450):a.alpha_composite(render(files[(group,n,m)],w,h),(x,y))
   comp('rays',0,-66,360,360);comp('podium-floor');comp('podium-steps');comp('laurel'); d=ImageDraw.Draw(a);d.ellipse((112,46,248,182),fill=P[m]['surface']);d.ellipse((156,73,204,121),fill=P[m]['silver']);d.rounded_rectangle((134,126,226,178),radius=24,fill=P[m]['silver']);comp('avatar-frame');comp('ribbon');comp('medal');
   for n,x,y in [('rectangle',45,90),('circle',65,248),('triangle',295,100),('curl',282,250),('star',48,195)]:comp('confetti-'+n,x,y,16,16)
   im.paste(a.convert('RGB'),(90+j*540,55));label(im,(90+j*540,505),m+' / assembled, placeholder photo')
 for j,m in enumerate(P):
  yy=offset+j*(rows*ch+45);label(im,(20,yy),m.upper(),title)
  for i,n in enumerate(names):
   x=20+(i%cols)*cw;y=yy+35+(i//cols)*ch; tw=cw-15;th=ch-35;tile(im,files[(group,n,m)],x,y,tw,th,m);label(im,(x,y+th+3),n)
 im.save(R/group/'contact-sheet.png')
 motion={'units':'ms','properties':['transform','opacity'],'animations':{'steps':{'duration':650,'delay':0,'easing':'cubic-bezier(.2,.8,.2,1)','frames':[{'offset':0,'transform':'translateY(28px)','opacity':0},{'offset':1,'transform':'translateY(0)','opacity':1}]},'avatar':{'duration':650,'delay':350,'easing':'ease-out','frames':[{'offset':0,'transform':'scale(.88)','opacity':0},{'offset':.75,'transform':'scale(1.04)','opacity':1},{'offset':1,'transform':'scale(1)','opacity':1}]},'ribbon':{'duration':850,'delay':800,'easing':'ease-in-out','frames':[{'offset':0,'transform':'translateY(-18px)','opacity':0},{'offset':.65,'transform':'translateY(3px)','opacity':1},{'offset':1,'transform':'translateY(0)','opacity':1}]},'medal':{'duration':850,'delay':950,'easing':'ease-in-out','frames':[{'offset':0,'transform':'translateY(-20px)','opacity':0},{'offset':.65,'transform':'translateY(4px)','opacity':1},{'offset':1,'transform':'translateY(0)','opacity':1}]},'confetti':{'duration':4200,'delay':500,'easing':'linear','frames':[{'offset':0,'transform':'translateY(-30px) rotate(0deg)','opacity':0},{'offset':.15,'transform':'translateY(0) rotate(30deg)','opacity':1},{'offset':1,'transform':'translateY(450px) rotate(180deg)','opacity':0}]}},'iterations':1,'reducedMotion':{'steps':'final static','avatar':'final static','ribbon':'final static','medal':'final static','confetti':'omit or fixed decorative particles'},'notes':'No flashing; one-shot transitions. Apply avatar transform to photo and frame together, origin 180px 114px in scene coordinates. All other artwork static. Trophy replaces ribbon and medal.'}
(R/'motion.json').write_text(json.dumps(motion,indent=2)); report={'svg_count':len(files),'errors':errors,'sizes_bytes':sizes,'card_top_55_percent_min_contrast':contrast,'avatar_center_alpha_zero_inside_radius_67':True,'contact_sheets':3};(R/'validation.json').write_text(json.dumps(report,indent=2))
readme='# StepUp record celebration\n\nOriginal artwork, CC0. Existing assets untouched. Momentum reference colors plus authorized metals. All SVGs transparent except cards.\n\n## Composition\nPhoto center (180,114), diameter 136.8. Stack rays at (0,-66), floor, steps, laurel, app photo, frame, ribbon, medal, confetti. Trophy alternative at (132,184), 96 square. Confetti 16 square; position freely. Rays 360 square; all other scene layers 360×450. Use photo circular clip. Contact sheet placeholder is not a delivered photo.\n\n## Files\n'
for (group,n),desc in purposes.items():readme+=f'- `{group}/{n}-light.svg` / `{group}/{n}-dark.svg`: {desc}.\n'
readme+='\n- `podium/contact-sheet.png`, `cards/contact-sheet.png`, `badges/contact-sheet.png`: actual raster previews.\n- `motion.json`: one-shot CSS transform/opacity instructions and reduced motion.\n- `palette.json`: reference hex values.\n- `validation.json`: checks and measured card contrast.\n- `build_celebration.py`: generator (requires prior extension palette at path in script, CairoSVG, Pillow, NumPy).\n\nLimitations: no physical device testing or user recognition study. Card contrast measured only for theme text token in top 55%. Rays individual wedges 8% opacity, no overlap except at center boundary. No actual selfie or result text included. Dark metallic numerals use background color for contrast.\n'
(R/'README.md').write_text(readme); import shutil;shutil.copy(__file__,R/'build_celebration.py')
with zipfile.ZipFile('/mnt/data/stepup-celebration.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in R.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(R))
print(report['svg_count'],errors,contrast,max(sizes.values()))
