// The creature, ported from plugins/apocalypse-mascots/hooks/register.tsx. Constants identical.
// window.Creature.mount(el, { stage, awake, scheme }) → instance { setStage, setAwake, setHidden, setScheme }
// window.Creature.swatch(el, scheme) draws a scheme on a plain body, in half-block pixels.
(function () {
const DENSE=['⣿','⣷','⣾','⣯','⣽','⣻','⢿','⡿'],RIM=['⣤','⣀','⠿','⣆','⣰','⡇','⢸','⠶','⣄','⣠'],BULGE=['⠁','⠂','⠄','⡀','⢀','⠈','⠐','⠠'];
function hash(a,b,c){let h=(Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(c,2246822519))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return (h^(h>>>16))>>>0}
function oklch(L,C,hDeg){const h=hDeg*Math.PI/180,a=C*Math.cos(h),b=C*Math.sin(h);const l_=L+0.3963377774*a+0.2158037573*b,m_=L-0.1055613458*a-0.0638541728*b,s_=L-0.0894841775*a-1.291485548*b;const l=l_**3,m=m_**3,s=s_**3;const r=4.0767416621*l-3.3077115913*m+0.2309699292*s,g=-1.2684380046*l+2.6097574011*m-0.3413193965*s,bb=-0.0041960863*l-0.7034186147*m+1.707614701*s;const gam=x=>{const c=Math.min(1,Math.max(0,x));return Math.round((c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055)*255)};const hx=n=>n.toString(16).padStart(2,'0');return '#'+hx(gam(r))+hx(gam(g))+hx(gam(bb))}
function eyes(stage,width,rows,tick,awake){const count=3+stage*2,out=[];for(let i=0;i<count;i++){const period=10+(hash(3,i,0)%18),offset=hash(5,i,0)%(period*2),t=(tick+offset)%(period*2);if(t>=period)continue;const cycle=Math.floor((tick+offset)/(period*2));const r=hash(7,i,cycle)%rows,c=1+(hash(11,i,cycle)%Math.max(1,width-2));const kind=(t<2||t>period-3)?'eyeDim':awake?'eyeBright':'eye';out.push({r,c,kind,big:hash(13,i,0)%3===0})}return out.filter((e,i)=>!out.some((o,j)=>j<i&&Math.abs(o.r-e.r)<=1&&Math.abs(o.c-e.c)<=2&&o.big===e.big))}
function yoggy(stage,width,rows,tick,awake){const grid=[],cx=(width-1)/2,cy=(rows-1)/2,rx=Math.max(2,width/2-0.5),ry=Math.max(0.6,rows/2+0.1),lean=Math.sin(tick/5)*0.6;for(let r=0;r<rows;r++){const row=[];for(let c=0;c<width;c++){const wobble=Math.sin((c*1.3+tick)/2.5)*0.25+Math.sin((r*2.1-tick)/3.5)*0.2;const d=((c-cx-lean*(r-cy)*0.3)/rx)**2+((r-cy+wobble)/ry)**2;const hue=c*9+r*14+tick*6;if(d>1.25)row.push({ch:' ',kind:'void',hue});else if(d>1.05)row.push({ch:BULGE[hash(r,c,tick>>1)%BULGE.length],kind:'bulge',hue});else if(d>0.78)row.push({ch:RIM[hash(r,c,tick>>2)%RIM.length],kind:'rim',hue});else row.push({ch:DENSE[hash(r,c,tick>>3)%DENSE.length],kind:'flesh',hue})}grid.push(row)}
  const pods=1+(stage>2?1:0);for(let p=0;p<pods;p++){const period=9+(hash(17,p,0)%7),t=(tick+hash(19,p,0))%(period*3);if(t>=period)continue;const reach=Math.min(4,1+Math.floor((t<period/2?t:period-t)*1.2));const r=hash(23,p,Math.floor((tick+hash(19,p,0))/(period*3)))%rows;const row=grid[r];if(!row)continue;const left=hash(29,p,0)%2===0;const fi=row.findIndex(c=>c.kind!=='void');const edge=left?fi:row.length-1-[...row].reverse().findIndex(c=>c.kind!=='void');if(edge<0)continue;for(let k=1;k<=reach;k++){const c=left?edge-k:edge+k;const cell=row[c];if(!cell)break;const taper=k===reach?(left?'⠈':'⠁'):k===reach-1?(left?'⠙':'⠋'):'⣿';row[c]={ch:taper,kind:k>=reach-1?'bulge':'rim',hue:cell.hue}}}
  for(const e of eyes(stage,width,rows,tick,awake)){const cell=grid[e.r]&&grid[e.r][e.c];if(!cell||cell.kind==='void'||cell.kind==='bulge')continue;cell.kind=e.kind;cell.ch=e.big?(e.kind==='eyeDim'?'◌':'◉'):(e.kind==='eyeDim'?'·':'•')}return grid}
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
// the six schemes: on Yoggy a field f(x,y,k,hue,c,r) → [ΔL,C,hue] over the body, its eyes, and its mask (the scheme's brightest colour)
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v,mix=(a,b,t)=>a+(b-a)*t,ease=t=>{t=clamp(t);return t*t*(3-2*t)},rnd=(a,b,c)=>hash(a,b,c)/4294967296;
function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=rnd(xi,yi,s),b=rnd(xi+1,yi,s),c=rnd(xi,yi+1,s),d=rnd(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function ramp(stops,u){u=clamp(u);let i=0;while(i<stops.length-2&&u>stops[i+1][0])i++;const a=stops[i],b=stops[i+1],k=ease((u-a[0])/(b[0]-a[0]));return [mix(a[1],b[1],k),mix(a[2],b[2],k),mix(a[3],b[3],k)%360]}
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],cycleU=(k,c,r)=>{const P=12,off=k+3*Math.floor(k/4),idx=(((c*2+r*3-off)%P)+P)%P;return 1-Math.abs(idx/P*2-1)};
const HUES=[305,128,205,22,85],hueTo=(a,b,k)=>a+(((((b-a)%360)+540)%360)-180)*k,borrowedHue=t=>{const i=Math.floor(t/12);return hueTo(HUES[i%5],HUES[(i+1)%5],ease(((t%12)-9)/3))};
const FIELDS={
  'cuddly-apocalypse':{eye:[0.88,0.26,140],mask:()=>[0.84,0.13,50],f:(x,y,k,hue)=>{const u=0.5*(1+Math.sin(hue*Math.PI/180)),band=0.5*(1+Math.cos(((hue/9-k*1.3)%40)/40*TAU));const [dL,C,h]=ramp([[0,-0.1,0.085,298],[0.38,0,0.13,305],[0.68,0.05,0.14,350],[1,0.09,0.15,405]],u);return [dL,C*(0.85+0.25*band),h]}},
  'foetid-ichor':{eye:[0.74,0.2,25],mask:()=>[0.9,0.16,116],f:(x,y)=>{const nz=Math.sqrt(Math.max(0,1-x*x-y*y)),lam=clamp(-0.45*x-0.65*y+0.6*nz);return [-0.09+0.22*lam,0.06+0.08*lam,128-10*lam]}},
  'scarred-bones':{eye:[0.88,0.26,140],mask:()=>[0.96,0.02,95],f:(x,y,k,hue,c,r)=>{const v=clamp((1-(y+1)/2)*0.8+0.2*(0.5+0.5*Math.sin(k/4+x*2)));return v*16>BAYER[(r%4)*4+(c%4)]?[0.25,0.03,85]:[-0.065,0.03,60]}},
  'strange-aeons':{eye:[0.88,0.15,192],mask:()=>[0.88,0.13,192],f:(x,y,k,hue,c,r)=>{const u=(y+1)/2;let dL=mix(0.09,-0.11,u),C=mix(0.1,0.06,u),h=mix(192,265,u);const n=vnoise(c*0.6+k*0.35,r*1.4-k*0.1,11);if(n>0.64){dL+=0.22*(n-0.64)/0.36;C=0.14;h=182}return [dL,C,h]}},
  'imitated-accents':{eye:[0.88,0.26,140],mask:t=>[0.94,0.03,borrowedHue(t)],f:(x,y,k)=>[0,0.11,Math.atan2(y,x)*180/Math.PI+k*9]},
  'cosmic-pulsing':{eye:[0.88,0.17,92],mask:()=>[0.85,0.11,10],f:(x,y,k,hue,c,r)=>ramp([[0,-0.11,0.09,14],[0.6,0.02,0.17,26],[1,0.12,0.11,14]],cycleU(k,c,r))},
};
// every creature is drawn on a dark ground, the terminal's, which is where the schemes were designed
const maskColor=(F,tick)=>oklch(...F.mask(tick));
function paint(grid,tick,awake,F){const rows=grid.length,width=grid[0]?grid[0].length:0,L0=awake?0.42:0.36,[eL,eC,eh]=F.eye;
  const col=(cell,r,c)=>{switch(cell.kind){case 'eyeDim':return [oklch(0.55,eC*0.55,eh),''];case 'eye':return [oklch(0.75,eC*0.8,eh),'font-weight:700'];case 'eyeBright':return [oklch(eL,eC,eh),'font-weight:700']}
    const x=(c-(width-1)/2)/(width/2),y=rows>1?(r-(rows-1)/2)/(rows/2):0,[dL,C,h]=F.f(x,y,tick,cell.hue,c,r),k=cell.kind==='rim'?1:cell.kind==='bulge'?2:0;
    const L=L0+dL*1.6-[0,0.07,0.1][k];return [oklch(L,C*1.25*[1,1.1,0.9][k],h),'']};
  let html='';grid.forEach((row,r)=>{row.forEach((cell,c)=>{if(cell.kind==='void'){html+=' ';return}const [fg,extra]=col(cell,r,c);html+='<span style="color:'+fg+';'+extra+'">'+esc(cell.ch)+'</span>'});if(r===Math.floor(rows/2)&&awake)html+=' <span style="color:'+maskColor(F,tick)+';font-weight:700">☺</span>';html+='\n'});return html}
function mount(el,opts){opts=Object.assign({stage:3,awake:false,hidden:false,scheme:'cuddly-apocalypse',rowsFor:s=>Math.max(2,Math.min(2+Math.floor(s/2),5)),widthFor:s=>Math.max(8,Math.min(22,8+s*2))},opts||{});
  const st={stage:opts.stage,awake:opts.awake,hidden:opts.hidden,scheme:opts.scheme,tick:0};
  function render(){const F=FIELDS[st.scheme];if(st.hidden){el.innerHTML=st.awake?'<span style="color:'+maskColor(F,st.tick)+';font-weight:700">☺</span>':'';return}
    const rows=opts.rowsFor(st.stage),width=opts.widthFor(st.stage);el.innerHTML=paint(yoggy(st.stage,width,rows,st.tick,st.awake),st.tick,st.awake,F)}
  let timer=null;function pace(){clearInterval(timer);timer=setInterval(()=>{st.tick++;render()},st.awake?300:1800)}
  render();pace();
  return {setStage(s){st.stage=s;render()},setAwake(a){st.awake=a;render();pace()},setHidden(h){st.hidden=h;render()},setScheme(id){if(FIELDS[id]){st.scheme=id;render()}},get state(){return st},render}}
// a swatch: one plain body, solid half-block pixels (top pixel as ▀'s colour, bottom as its background), so only the colour reads
function swatch(el,id,cols=16,rows=4){const F=FIELDS[id];let k=0;
  function px(c,r){const W=cols,H=rows*2,cx=(W-1)/2,cy=(H-1)/2,x=(c-cx)/(W/2-0.6),y=(r-cy)/(H/2-0.4);if(x*x+y*y>1)return null;const [dL,C,h]=F.f(x,y,k,c*22+r*14+k*6,c,r);return oklch(0.36+dL*1.6,C*1.25,h)}
  function render(){let html='';for(let r=0;r<rows;r++){for(let c=0;c<cols;c++){const a=px(c,r*2),b=px(c,r*2+1);html+=!a&&!b?' ':a&&b?'<span style="color:'+a+';background:'+b+'">▀</span>':a?'<span style="color:'+a+'">▀</span>':'<span style="color:'+b+'">▄</span>'}html+='\n'}el.innerHTML='<span>'+html+'</span>'} // one child, so a flex parent centres the block, not each cell
  render();setInterval(()=>{k++;render()},1800)}
window.Creature={mount,swatch,oklch,SCHEMES:Object.keys(FIELDS)};
})();
