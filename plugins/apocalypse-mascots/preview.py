# Renders the same creature as hooks/register.tsx into preview.gif, for the README.
# Usage: python3 preview.py   (needs Pillow and DejaVu fonts). Keep it in step with register.tsx.
import math
from PIL import Image, ImageDraw, ImageFont
DENSE=['⣿','⣷','⣾','⣯','⣽','⣻','⢿','⡿']; RIM=['⣤','⣀','⠿','⣆','⣰','⡇','⢸','⠶','⣄','⣠']; BULGE=['⠁','⠂','⠄','⡀','⢀','⠈','⠐','⠠']
def imul(a,b): return ((a*b)&0xffffffff)
def hash_(a,b,c):
    h=(imul(a,374761393)+imul(b,668265263)+imul(c,2246822519))&0xffffffff
    h=imul(h^(h>>13),1274126177)&0xffffffff
    return (h^(h>>16))&0xffffffff
def oklch(L,C,hdeg):
    h=math.radians(hdeg); a=C*math.cos(h); b=C*math.sin(h)
    l_=L+0.3963377774*a+0.2158037573*b; m_=L-0.1055613458*a-0.0638541728*b; s_=L-0.0894841775*a-1.291485548*b
    l,m,s=l_**3,m_**3,s_**3
    r=4.0767416621*l-3.3077115913*m+0.2309699292*s; g=-1.2684380046*l+2.6097574011*m-0.3413193965*s; bb=-0.0041960863*l-0.7034186147*m+1.707614701*s
    def gam(x):
        c=min(1,max(0,x)); v=12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055; return round(v*255)
    return (gam(r),gam(g),gam(bb))
def eyes(stage,width,rows,tick,awake):
    out=[]
    for i in range(3+stage*2):
        period=10+(hash_(3,i,0)%18); offset=hash_(5,i,0)%(period*2); t=(tick+offset)%(period*2)
        if t>=period: continue
        cycle=(tick+offset)//(period*2); r=hash_(7,i,cycle)%rows; c=1+(hash_(11,i,cycle)%max(1,width-2))
        kind='eyeDim' if (t<2 or t>period-3) else ('eyeBright' if awake else 'eye')
        out.append((r,c,kind,hash_(13,i,0)%3==0))
    keep=[]
    for i,e in enumerate(out):
        if any(abs(o[0]-e[0])<=1 and abs(o[1]-e[1])<=2 and o[3]==e[3] for o in out[:i]): continue
        keep.append(e)
    return keep
def yoggy(stage,width,rows,tick,awake):
    grid=[]; cx=(width-1)/2; cy=(rows-1)/2; rx=max(2,width/2-0.5); ry=max(0.6,rows/2+0.1); lean=math.sin(tick/5)*0.6
    for r in range(rows):
        row=[]
        for c in range(width):
            wobble=math.sin((c*1.3+tick)/2.5)*0.25+math.sin((r*2.1-tick)/3.5)*0.2
            d=((c-cx-lean*(r-cy)*0.3)/rx)**2+((r-cy+wobble)/ry)**2; hue=c*9+r*14+tick*6
            if d>1.25: row.append([' ','void',hue])
            elif d>1.05: row.append([BULGE[hash_(r,c,tick>>1)%len(BULGE)],'bulge',hue])
            elif d>0.78: row.append([RIM[hash_(r,c,tick>>2)%len(RIM)],'rim',hue])
            else: row.append([DENSE[hash_(r,c,tick>>3)%len(DENSE)],'flesh',hue])
        grid.append(row)
    for p in range(1+(1 if stage>2 else 0)):
        period=9+(hash_(17,p,0)%7); t=(tick+hash_(19,p,0))%(period*3)
        if t>=period: continue
        reach=min(4,1+int((t if t<period/2 else period-t)*1.2))
        row=grid[hash_(23,p,(tick+hash_(19,p,0))//(period*3))%rows]; left=hash_(29,p,0)%2==0
        solid=[i for i,c in enumerate(row) if c[1]!='void']
        if not solid: continue
        edge=solid[0] if left else solid[-1]
        for k in range(1,reach+1):
            c=edge-k if left else edge+k
            if not 0<=c<len(row): break
            taper=('⠈' if left else '⠁') if k==reach else ('⠙' if left else '⠋') if k==reach-1 else '⣿'
            row[c]=[taper,'bulge' if k>=reach-1 else 'rim',row[c][2]]
    for (r,c,kind,big) in eyes(stage,width,rows,tick,awake):
        cell=grid[r][c]
        if cell[1] in ('void','bulge'): continue
        cell[1]=kind; cell[0]=('◌' if kind=='eyeDim' else '◉') if big else ('·' if kind=='eyeDim' else '•')
    return grid
CAPTION='You have given it access to: seeing eyes · grasping hands · your shell   (12 invocations so far)'
def frame(stage,tick,awake,dark=True,scale=2):
    rows=max(2,min(2+stage//2,5)); width=max(8,8+stage*2)
    grid=yoggy(stage,width,rows,tick,awake)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16*scale)
    bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',16*scale)
    mono=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',12*scale)
    cw,ch=int(9.6*scale),int(19*scale); W=max((width+6)*cw,int(mono.getlength(CAPTION))+2*cw); H=(rows+3)*ch
    bg=(13,11,20) if dark else (247,244,251); im=Image.new('RGB',(W,H),bg); dr=ImageDraw.Draw(im)
    L=(0.34 if awake else 0.28) if dark else (0.30 if awake else 0.24)
    hueOf=lambda h: 300+35*math.sin(math.radians(h%360))
    for i,row in enumerate(grid):
        for j,(chr_,kind,hue) in enumerate(row):
            if kind=='void': continue
            band=0.5*(1+math.cos((((hue/9-tick*1.3)%40)/40)*math.pi*2)); C=0.06+0.06*band
            f=font
            if kind=='flesh': col=oklch(L,C,hueOf(hue))
            elif kind=='rim': col=oklch(L-0.07,C*1.1,hueOf(hue))
            elif kind=='bulge': col=oklch(L-0.1,C*0.9,hueOf(hue))
            elif kind=='eyeDim': col=oklch(0.55,0.14,140)
            elif kind=='eye': col=oklch(0.75,0.2,140); f=bold
            else: col=oklch(0.88,0.26,140); f=bold
            dr.text(((j+1)*cw,(i+1)*ch),chr_,font=f,fill=col)
        if i==rows//2 and awake: dr.text(((width+2)*cw,(i+1)*ch),'☺',font=bold,fill=(242,201,76))
    dr.text((cw,(rows+1)*ch+4),CAPTION,font=mono,fill=(143,136,163))
    return im
if __name__=='__main__':
    frames=[frame(3,t,True) for t in range(40)]
    frames[0].save('preview.gif',save_all=True,append_images=frames[1:],duration=300,loop=0,optimize=True)
