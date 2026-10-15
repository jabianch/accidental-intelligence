// The front door responds: clocks, a valuation that grows while you look, and thanks for every resize.
(function(){
  const copy=JSON.parse(document.getElementById('copy-data').textContent).home
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches
  const editing=()=>document.body.classList.contains('editing')

  // loader: once per session, never with reduced motion, never in the editor
  let seen=false; try{seen=sessionStorage.getItem('ai-loaded')==='1';sessionStorage.setItem('ai-loaded','1')}catch(e){}
  if(!seen&&!still){
    const l=document.createElement('div'); l.className='loader'; l.setAttribute('aria-hidden','true')
    const n=document.createElement('b'); const t=document.createElement('span'); t.textContent=copy.loader
    l.append(n,t); document.body.append(l)
    const t0=performance.now(), dur=1100
    ;(function step(now){
      const k=Math.min(1,(now-t0)/dur), eased=k<.8?k*1.1:.88+(k-.8)*.6 // dawdles at the end, like they all do
      n.textContent=String(Math.min(100,Math.floor(eased*100))).padStart(3,'0')+'%'
      if(k<1) requestAnimationFrame(step); else {n.textContent='100%'; setTimeout(()=>{l.classList.add('gone');setTimeout(()=>l.remove(),400)},180)}
    })(t0)
  }

  // clocks
  const fmt={}; const tick=()=>document.querySelectorAll('[data-tz]').forEach(b=>{
    const z=b.dataset.tz; fmt[z]=fmt[z]||new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:z}); b.textContent=fmt[z].format(new Date())})
  tick(); setInterval(tick,15000)


  // valuation: a billion a day, accrued from the moment you arrived
  // a different valuation each visit, somewhere in the tens to hundreds of billions (log-uniform, so both decades show up)
  const lo=Math.log(copy.valuationMin), hi=Math.log(copy.valuationMax), start=Math.exp(lo+Math.random()*(hi-lo))
  const v=document.getElementById('val'), g=document.getElementById('gain'), t1=performance.now()
  const usd=n=>'$'+Math.round(n).toLocaleString('en-US')
  const tickV=()=>{const gain=(performance.now()-t1)/864e5*copy.valuationPerDay; v.textContent=usd(start+gain); g.textContent='▲ '+usd(gain)}; tickV(); setInterval(tickV,100)

  // responsive: every width change is acknowledged (height-only changes are a phone's URL bar, not feedback)
  const toast=document.getElementById('toast'); let w=innerWidth, timer, hide, i=0
  addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{
    if(innerWidth===w||editing()) return; w=innerWidth
    toast.textContent=copy.toasts[i++%copy.toasts.length]+'  '+innerWidth+' × '+innerHeight
    toast.classList.add('on'); clearTimeout(hide); hide=setTimeout(()=>toast.classList.remove('on'),2600)
  },350)})
})()
