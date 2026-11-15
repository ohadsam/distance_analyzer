import json,zipfile, pathlib, math, re, io, xml.etree.ElementTree as ET
import cairosvg
from PIL import Image,ImageDraw,ImageFont
P=pathlib.Path('/mnt/data/stepup-extension'); P.mkdir(exist_ok=True)
z=zipfile.ZipFile('/mnt/data/stepup-little-trail.zip'); tokens=json.loads(z.read('delivery/tokens.json'))['momentum']; roles=['background','surface','primary','success','warm','sky','text','muted','outline']; palettes={m:{r:t[{'warm':'run','sky':'walk'}.get(r,r)] for r in roles} for m,t in tokens.items()}; (P/'palette.json').write_text(json.dumps(palettes,indent=2))
items=[]; c={}
def path(d,f,extra=''): return f'<path d="{d}" fill="{c.get(f,f)}" {extra}/>'
def rect(x,y,w,h,r,f,extra=''): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c.get(f,f)}" {extra}/>'
def circ(x,y,r,f,extra=''): return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c.get(f,f)}" {extra}/>'
def line(d,f,w=3,extra=''): return path(d,'none',f'stroke="{c[f]}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}')
def grad(id,a,b): return f'<defs><linearGradient id="{id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c[a]}"/><stop offset="1" stop-color="{c[b]}"/></linearGradient></defs>'
def save(group,name,w,h,body,purpose,mode):
 d=P/group; d.mkdir(exist_ok=True); f=d/f'{name}-{mode}.svg'; s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{body}</svg>'; f.write_text(s); items.append((group,name,mode,w,h,f,purpose))
def hills(): return path('M0 91Q65 39 126 83T245 77T360 68V120H0Z','success','opacity=".65"')+path('M0 105Q77 75 150 100T280 94T360 91V120H0Z','primary')
def cloud(x,y): return f'<g transform="translate({x} {y})">'+path('M0 24Q-5 10 12 10Q16 -5 31 2Q43 3 46 15Q64 12 64 26Q64 35 52 35H12Q0 35 0 24Z','surface')+'</g>'
def star(x,y,r=12): return path('M'+ 'L'.join(f'{x+math.cos(-math.pi/2+i*math.pi/5)* (r if i%2==0 else r*.48):.2f} {y+math.sin(-math.pi/2+i*math.pi/5)*(r if i%2==0 else r*.48):.2f}' for i in range(10))+'Z','warm')
def glyph(k):
 if k==0:return path('M3 19V15H8V11H13V7H21V19Z','text')
 if k==1:return path('M2 19A10 10 0 0 1 22 19Z','text')+rect(10,2,4,5,2,'text')
 if k==2:return path('M5 19Q18 19 12 12T19 5L17 2Q6 5 9 13T5 16Z','text')+circ(5,19,3,'text')
 return rect(3,5,18,16,3,'text')+rect(7,2,3,6,1,'text')+rect(15,2,3,6,1,'text')+rect(6,10,12,3,1,'background')
for mode,c in palettes.items():
 for k,name in enumerate(['steps','effort','last-workout','next-session']):
  for w in [200,100]:
   h=100; motif=[path('M0 83Q48 48 95 79T200 68V100H0Z','success')+line('M90 100Q130 85 115 77T155 62','primary',5),circ(150,64,26,'warm')+path('M0 83Q100 65 200 83V100H0Z','warm'),path('M0 90Q70 60 200 82V100H0Z','primary')+''.join(f'<ellipse cx="{110+i*9}" cy="{82-i*5}" rx="2.5" ry="4" fill="{c["text"]}" transform="rotate(30 {110+i*9} {82-i*5})"/>' for i in range(5)),path('M0 85Q90 55 200 80V100H0Z','sky')+rect(130,52,40,30,8,'primary')+rect(137,58,26,4,2,'surface')][k]
   body=f'<defs><clipPath id="clip"><rect width="{w}" height="100" rx="20"/></clipPath></defs>'+grad('base','background','surface')+f'<g clip-path="url(#clip)">'+rect(0,0,w,h,20,'url(#base)')+f'<g opacity=".09" transform="scale({w/200} 1)">{motif}</g></g>'
   save('widgets',name+('-wide' if w==200 else '-square'),w,h,body,'Low-contrast widget background',mode)
  save('widgets',name+'-picker',24,24,glyph(k),'Monochrome picker glyph',mode)
 for k,name in enumerate(['welcome','no-workouts','no-routes','no-plan','caught-up','offline']):
  base=grad('wash','background','surface')+rect(0,0,320,200,24,'url(#wash)')+'<g transform="translate(0 100) scale(.889 .833)">'+hills()+'</g>'
  if k==0: art=circ(160,48,15,'warm')+path('M110 145Q125 104 160 94Q195 104 210 145Z','primary')+path('M145 145L157 116 170 145Z','surface')+circ(160,79,13,'primary')
  elif k==1: art=path('M94 110L111 65 140 76 167 111 217 125Q232 129 226 147H97Q83 144 94 110Z','primary')+path('M91 145H227L219 156H100Z','success')+line('M125 86L145 81M137 99L157 94M149 112L169 107','surface',5)
  elif k==2: art=rect(91,40,138,110,19,'surface')+path('M100 61L139 48 181 65 220 52V132L181 143 139 127 100 140Z','success','opacity=".45"')+line('M114 121Q170 127 151 92T207 73','primary',9)+circ(114,121,8,'warm')+circ(207,73,8,'primary')
  elif k==3: art=rect(103,48,114,106,16,'primary')+rect(113,75,94,69,9,'surface')+rect(125,38,10,27,5,'warm')+rect(185,38,10,27,5,'warm')+''.join(rect(124+i*27,88+j*22,16,13,4,'success','opacity=".55"') for i in range(3) for j in range(2))
  elif k==4: art=path('M113 114Q120 100 120 77Q120 48 160 48Q200 48 200 77Q200 100 207 114Z','primary')+rect(106,113,108,12,6,'primary')+circ(160,132,9,'warm')+circ(203,56,24,'success')+line('M192 56L200 64 214 48','surface',6)
  else: art=rect(112,38,96,122,17,'primary')+rect(120,50,80,91,10,'surface')+'<g transform="translate(128 73)">'+cloud(0,0)+line('M0 38L64 0','warm',6)+'</g>'+circ(160,150,4,'surface')
  save('onboarding',name,320,200,base+art,'Onboarding or empty state: '+name,mode)
 for k,name in enumerate(['clear','cloudy','rain','cold','hot','windy']):
  # day/night correspond to light/dark; same terrain
  body=grad('skywash','background','surface')+rect(0,0,360,120,0,'url(#skywash)')
  if mode=='light': body+=circ(275,30,19 if k!=4 else 26,'warm','opacity=".85"')
  else: body+=path('M286 9A21 21 0 1 0 296 44A24 24 0 0 1 286 9Z','warm')+circ(320,16,2,'text')+circ(245,13,2,'text')
  if k in [1,2,3]: body+=cloud(185,12)+cloud(246,25)
  if k==2: body+=''.join(line(f'M{x} 57l-5 11','sky',3) for x in range(205,305,18))
  if k==3: body+=''.join(circ(x,y,3,'sky') for x,y in [(205,57),(240,66),(276,56),(300,72)])
  if k==4: body+=line('M222 20Q213 30 222 40M320 20Q311 30 320 40','warm',3)
  if k==5: body+=line('M175 28H230Q248 28 242 17M190 44H306Q321 44 315 33','sky',4)
  body+=hills()+line('M180 120Q225 107 210 99T253 85','surface',5,'opacity=".65"')
  save('weather',name,360,120,body,'Weather banner; light=day, dark=night',mode)
 for name,r in [('breath-rest',21),('breath-inhale',27),('breath-exhale',17)]:
  save('rhythm',name,64,64,circ(32,32,r,'primary','opacity=".25"')+circ(32,32,r-5,'primary')+circ(32,32,r-10,'surface'),'Breathing ring static keyframe',mode)
 for name,r in [('beat-rest',10),('beat-pulse',17)]: save('rhythm',name,64,64,circ(32,32,r+5,'primary','opacity=".2"')+circ(32,32,r,'primary'),'Step beat static keyframe',mode)
 save('rhythm','learning',64,64,''.join(rect(9+i*12,32-h/2,8,h,4,'primary' if i==2 else 'muted') for i,h in enumerate([12,25,40,25])),'Learning cadence',mode)
 save('rhythm','locked',64,64,circ(32,32,25,'success')+line('M19 32L28 41 46 23','surface',6),'Cadence locked',mode)
 for k,name in enumerate(['almost-distance','passed-distance','almost-record','new-record','faster-last','fastest-km']):
  shapes=['M5 38V18Q5 8 15 8H33Q43 8 43 18V38L24 45Z','M4 9H44V31L24 45 4 31Z','M24 3L44 14V35L24 46 4 35V14Z','M24 2L30 15 45 16 34 27 38 43 24 35 10 43 14 27 3 16 18 15Z','M4 12Q4 5 12 5H44L35 24 44 43H12Q4 43 4 35Z','M24 3Q44 3 44 23Q44 43 24 45Q4 43 4 23Q4 3 24 3Z']; body=path(shapes[k],['primary','success','warm','warm','sky','primary'][k]);
  if k<2: body+=line('M12 30Q22 17 34 22','surface',4)+circ(34,22,4,'surface')+(line('M23 32L28 37 37 27','surface',3) if k==1 else circ(13,30,3,'warm'))
  elif k<4: body+=path('M15 15H33V23Q33 30 24 32Q15 30 15 23Z','surface')+line('M24 31V36M18 36H30','surface',3)
  else: body+=path('M12 28L24 12 23 22H36L23 37 25 28Z','surface')
  save('badges',name,48,48,body,'Live indication: '+name,mode)
 for name in ['bar','line','heat-strip']:
  body=rect(0,0,320,160,12,'background')+''.join(line(f'M24 {y}H296','outline',1,'opacity=".22"') for y in [30,60,90,120])+line('M24 60H296','muted',2,'stroke-dasharray="6 5"')
  if name=='bar': body+=''.join(rect(32+i*38,130-h,25,h,6,'warm' if i==6 else 'primary') for i,h in enumerate([38,66,52,83,72,98,88]))
  elif name=='line': body+=line('M35 112L75 86 115 96 155 60 195 73 235 42 275 49','primary',3)+''.join(circ(x,y,5,'warm' if x==275 else 'primary') for x,y in [(35,112),(75,86),(115,96),(155,60),(195,73),(235,42),(275,49)])
  else: body+=''.join(rect(30+i*38,72,30,30,6,'warm' if i==6 else 'success',f'opacity="{1 if i==6 else .25+i*.12}"') for i in range(7))
  save('charts',name,320,160,body,'Chart sample, no embedded labels',mode)
 mark=z.read(f'delivery/themes/momentum/{mode}/brand-mark.svg').decode(); root=ET.fromstring(mark); inner=''.join(ET.tostring(e,encoding='unicode') for e in root); inner=re.sub(r'ns0:','',inner); inner=inner.replace(' xmlns:ns0="http://www.w3.org/2000/svg"',''); # map original warning to warm alias
 inner=inner.replace(tokens[mode]['warning'],c['warm'])
 save('splash','android-icon',432,432,f'<g transform="translate(72 72) scale(4.5)">{inner}</g>','Android splash mark within 288px diameter safe circle',mode)
 save('splash','portrait',1080,1920,grad('splashwash','background','surface')+rect(0,0,1080,1920,0,'url(#splashwash)')+f'<g transform="translate(348 730) scale(6)">{inner}</g><g transform="translate(0 1560) scale(3)">{hills()}</g>','Portrait splash, mark centered',mode)
# render, validate, document
allowed=set('svg g path circle ellipse rect line polyline polygon defs clipPath linearGradient radialGradient stop'.split()); errors=[]; sizes={}; contrasts={}
def lum(rgb):
 a=[v/255 for v in rgb]; return sum(w*(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for w,v in zip([.2126,.7152,.0722],a))
def rgb(s):return tuple(bytes.fromhex(s[1:]))
for group,name,mode,w,h,f,purpose in items:
 s=f.read_text(); sizes[str(f.relative_to(P))]=len(s.encode()); root=ET.fromstring(s)
 for e in root.iter():
  if e.tag.split('}')[-1] not in allowed: errors.append(str(f))
  for a,v in e.attrib.items():
   if a.startswith('on') or 'href' in a or a=='style': errors.append(str(f))
   if a in ['fill','stroke','stop-color'] and v not in ['none'] and not v.startswith('url(#') and v not in palettes[mode].values():errors.append(f'{f}: {v}')
 if len(s.encode())>20000:errors.append(str(f))
 if group=='widgets' and 'picker' not in name:
  im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(),output_width=w*3,output_height=h*3))).convert('RGBA'); fg=lum(rgb(palettes[mode]['text'])); vals=[(max(fg,lum(p[:3]))+.05)/(min(fg,lum(p[:3]))+.05) for p in im.getdata() if p[3]==255]; contrasts[str(f.relative_to(P))]=round(min(vals),3)
for group in sorted(set(i[0] for i in items)):
 subset=[i for i in items if i[0]==group]; names=list(dict.fromkeys(i[1] for i in subset)); sheet=Image.new('RGB',(1000,65+len(names)*190),'#E5E9ED'); d=ImageDraw.Draw(sheet); font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16); big=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',25); d.text((20,15),group.upper()+' — Momentum light / dark',font=big,fill='#17232D')
 for j,name in enumerate(names):
  for k,mode in enumerate(['light','dark']):
   _,_,_,w,h,f,_=next(i for i in subset if i[1]==name and i[2]==mode); x=15+k*490;y=65+j*190; d.rounded_rectangle((x,y,x+480,y+180),12,fill=palettes[mode]['background']); d.text((x+12,y+8),name+' / '+mode,font=font,fill=palettes[mode]['text']); scale=min(440/w,142/h); rw,rh=round(w*scale),round(h*scale); im=Image.open(io.BytesIO(cairosvg.svg2png(url=str(f),output_width=rw,output_height=rh))).convert('RGBA'); sheet.paste(im,(x+(480-rw)//2,y+30+(142-rh)//2),im)
 sheet.save(P/group/'contact-sheet.png')
 motion={'breathing':{'durationMs':8000,'keyframes':[{'asset':'breath-rest','offset':0,'scale':1},{'asset':'breath-inhale','offset':.5,'scale':27/21},{'asset':'breath-exhale','offset':.95,'scale':17/21},{'asset':'breath-rest','offset':1,'scale':1}],'easing':'ease-in-out','reducedMotion':'breath-rest'},'beat':{'durationMs':800,'scaleRange':[1,1.7],'easing':'ease-in-out','frames':['beat-rest','beat-pulse','beat-rest'],'reducedMotion':'beat-rest','note':'Visual pulse capped at 75 cycles/min; do not flash or synchronize faster visual pulses to cadence. Audio cadence independent.'},'learning':{'durationMs':0,'reducedMotion':'learning'},'locked':{'durationMs':0,'reducedMotion':'locked'},'implementation':'Interpolate scale of rest SVG, do not additionally scale alternate keyframe SVGs. No opacity flashing. Breathing optional, not a prescribed breathing rate.'}
(P/'rhythm/motion.json').write_text(json.dumps(motion,indent=2))
(P/'charts/spec.md').write_text('''# Chart language\nReference viewBox 320×160. Bars radius 6, line 3, dots radius 5, grid 1 at 22% outline opacity, target muted 2 with dash 6/5. Now uses warm plus a larger marker or distinct label in app. Bar/line primary; heat success at 25–85% opacity; background background; labels text; secondary labels muted. Same roles in light/dark. Render labels outside SVG, use accessible data table and non-colour cues. Heat intensity is illustrative, not a data scale. Target line only where meaningful; omit for categorical heat strip in production.\n''')
report={'svg_count':len(items),'errors':errors,'sizes_bytes':sizes,'widget_opaque_pixel_min_contrast':contrasts,'minimum_widget_contrast':min(contrasts.values()),'scope':'XML, palette, sizes, CairoSVG render; contrast against text token across opaque widget pixels; rounded transparent corners excluded; no device tests'}; (P/'validation.json').write_text(json.dumps(report,indent=2))
readme=['# StepUp extension — Little Trail / Momentum','Additive kit; existing assets and tokens untouched. Original new artwork released CC0; existing Little Trail mark reused from approved package.','Palette: warm = existing run (sunset orange), sky = existing walk. No production token changes. Hex values in palette.json. Light/dark weather correspond to day/night. Widget text uses text token, not arbitrary white on light. Widget corner radius 20 viewBox units at reference height 100dp; apply native 20dp clipping at other sizes. Lower-right and left/top art opacity 9%. Android icon uses conservative 288px safe diameter within 432 canvas.','## Inventory']
for group in sorted(set(i[0] for i in items)):
 readme+=['### '+group,'| Light | Dark | ViewBox | Purpose |','|---|---|---|---|']
 for g,n,m,w,h,f,p in items:
  if g==group and m=='light':readme.append(f'| {g}/{n}-light.svg | {g}/{n}-dark.svg | {w}×{h} | {p} |')
 readme.append(f'Contact sheet: {group}/contact-sheet.png')
readme+=['## Other files','palette.json — reference hex roles; validation.json — checks and exact sizes; rhythm/motion.json — static frames and animation guidance; charts/spec.md — chart rules; build_extension.py — generator (requires approved Little Trail ZIP, CairoSVG, Pillow).','## Limitations','No native Android device test. Weather day/night are paired with light/dark rather than four independent combinations. Text contrast verified for opaque widget pixels only; no text intended over other illustrations. Contact sheets are review-scale, not native-size tests. Chart samples have no labels; app supplies them.']
(P/'README.md').write_text('\n\n'.join(readme)); import shutil; shutil.copy(__file__,P/'build_extension.py'); shutil.make_archive('/mnt/data/stepup-extension','zip',P); print(len(items),errors,min(contrasts.values()),max(sizes.values()))
