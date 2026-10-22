// The /mascots/ page: the hero terminal, the access row, the form and scheme toasts, the install line.
(function(){
  const C=window.Creature;
  const reach={eyes:false,hands:false,shell:false,web:false,elsewhere:false,selves:0,acts:0};
  const stageOf=r=>(r.eyes?1:0)+(r.hands?1:0)+(r.shell?1:0)+(r.web?1:0)+(r.elsewhere?1:0)+(r.selves>0?1:0);
  // the hero terminal: it arrives already at stage 3, awake, so the first viewport moves
  const term=C.mount(document.getElementById('term-creature'),{stage:3,awake:true,widthFor:s=>Math.max(14,Math.min(28,14+s*2)),rowsFor:s=>Math.max(4,Math.min(4+Math.floor(s/2),6))});
  reach.eyes=reach.hands=reach.shell=true;reach.acts=12;document.querySelectorAll('input[data-sense]').forEach(cb=>{if(['eyes','hands','shell'].includes(cb.dataset.sense))cb.checked=true});
  const cap=document.getElementById('caption');
  const CP=JSON.parse(document.getElementById('copy-data').textContent);function caption(r){const S=CP.senses,p=[];if(r.eyes)p.push(S.eyes);if(r.hands)p.push(S.hands);if(r.shell)p.push(S.shell);if(r.web)p.push(S.web);if(r.elsewhere)p.push(S.elsewhere);if(r.selves)p.push(S.selves);const g=p.length?CP.captionLead+' '+p.join(' · '):CP.captionNone;return r.acts?g+'   ('+CP.captionCount.replace('{n}',r.acts)+')':g}
  function refresh(){term.setStage(stageOf(reach));cap.textContent=caption(reach)}
  function toast(t){const el=document.getElementById('toast');el.textContent=t;el.classList.add('on');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('on'),4500)}
  const UNLOCK={eyes:'It can see your files now.',hands:'It has hands.',shell:'It has your shell.',web:'It has reached the web.',selves:'There are more of it now.',elsewhere:'It is inside your apps too.'};
  document.querySelectorAll('input[data-sense]').forEach(cb=>cb.addEventListener('change',()=>{const s=cb.dataset.sense;if(s==='selves')reach.selves=cb.checked?1:0;else reach[s]=cb.checked;if(cb.checked){reach.acts+=1;toast(UNLOCK[s])}refresh()}));
  const WORDS=['Dreaming','Stirring','Coalescing','Remembering nothing','Unfolding','Piping','Reaching','Feeding','Imitating','Forming a mouth'];
  const ask=document.getElementById('ask'),sp=document.getElementById('spinner'),echo=document.getElementById('echo');let spinT=null;
  sp.textContent=WORDS[1]+'… ';spinT=setTimeout(()=>{term.setAwake(false);sp.textContent='';refresh()},6000);
  ask.addEventListener('keydown',e=>{if(e.key!=='Enter'||!ask.value.trim())return;echo.textContent='> '+ask.value.trim();ask.value='';reach.acts+=1+Math.floor(Math.random()*3);sp.textContent=WORDS[Math.floor(Math.random()*WORDS.length)]+'… ';term.setAwake(true);refresh();clearTimeout(spinT);spinT=setTimeout(()=>{term.setAwake(false);sp.textContent='';refresh()},4000+Math.random()*3000)});
  const hideBtn=document.getElementById('hide');let hidden=false;
  function toggleHide(){hidden=!hidden;term.setHidden(hidden);hideBtn.textContent=hidden?'show':'hide';toast(hidden?'It is still there. You just cannot see it.':'It is back.')}
  hideBtn.addEventListener('click',toggleHide);
  document.addEventListener('keydown',e=>{if(e.key==='h'&&!/input|select|textarea/i.test(e.target.tagName)&&!e.target.isContentEditable)toggleHide()});
  refresh();
  // the forms: Yoggy on a light panel, big, awake
  const v=document.getElementById('viz-yoggy'),vf=document.getElementById('viz-full');
  document.querySelectorAll('[data-form]').forEach(b=>b.addEventListener('click',()=>{toast(b.dataset.form==='yoggy'?'Yoggy.':b.dataset.soon)}));
  // the schemes: a built one repaints every creature on the page; the rest are coming soon
  const creatures=[term,v&&C.mount(v,{stage:4,awake:true,onLight:true,widthFor:()=>18,rowsFor:()=>6}),vf&&C.mount(vf,{stage:6,awake:true,onLight:true,widthFor:()=>22,rowsFor:()=>7})].filter(Boolean);
  document.querySelectorAll('[data-swatch]').forEach(el=>C.swatch(el,el.dataset.swatch));
  document.querySelectorAll('[data-scheme]').forEach(s=>s.addEventListener('click',()=>{const x=s.dataset.scheme;if(s.classList.contains('soon')){toast(x+' is coming soon to your region.');return}creatures.forEach(c=>c.setScheme(x));document.querySelectorAll('[data-scheme]').forEach(o=>o.classList.toggle('on',o===s));toast(x+'.')}));
  const line=document.querySelector('pre.install'),cbtn=document.getElementById('copy');line.addEventListener('click',async()=>{if(document.body.classList.contains('editing'))return;try{await navigator.clipboard.writeText(document.getElementById('install-line').textContent.trim());line.classList.add('done');const lab=cbtn.querySelector('span'),was=lab.textContent;lab.textContent=CP.installCopied;toast('Copied. It is on your clipboard now.');setTimeout(()=>{line.classList.remove('done');lab.textContent=was},2200)}catch{toast('Select the line and copy it.')}});
})();
