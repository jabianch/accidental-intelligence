// In-browser editor, dev only (localhost only; no query-string override). Text in place, section drag-reorder,
// and per-block layout: move (drag the ✥ handle), width, size, spacing, alignment. Save writes src/copy.json.
(function(){
  if(!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const data=JSON.parse(document.getElementById('copy-data').textContent); data.layout=data.layout||{};
  const bar=document.createElement('div');bar.id='editor-bar';
  bar.innerHTML='<button id="ed-toggle">✎ Edit</button><button id="ed-save" hidden>Save</button><button id="ed-cancel" hidden>Cancel</button><span id="ed-msg"></span>';
  document.body.appendChild(bar);
  const tb=document.createElement('div');tb.id="ed-tools";tb.hidden=true;
  tb.innerHTML='<span class="ed-k"></span><button data-op="move" title="drag to move">✥</button><button data-op="up" title="move up">↑</button><button data-op="down" title="move down">↓</button><i></i><button data-op="w-" title="narrower">W−</button><button data-op="w+" title="wider">W+</button><i></i><button data-op="fs-" title="smaller text">A−</button><button data-op="fs+" title="bigger text">A+</button><i></i><button data-op="mt-" title="less space above">S−</button><button data-op="mt+" title="more space above">S+</button><i></i><button data-op="al" data-v="left">L</button><button data-op="al" data-v="center">C</button><button data-op="al" data-v="right">R</button><i></i><button data-op="reset" title="reset this block">reset</button>';
  document.body.appendChild(tb);
  const css=document.createElement('style');css.textContent=`
  #editor-bar{position:fixed;left:16px;bottom:16px;z-index:60;display:flex;gap:6px;align-items:center;font:13px system-ui,sans-serif}
  #editor-bar button,#ed-tools button{font:12px system-ui,sans-serif;padding:7px 10px;border:1px solid #1b1b1b;background:#fff;border-radius:2px;cursor:pointer}
  #editor-bar #ed-save{background:#1b1b1b;color:#fff}
  #editor-bar #ed-msg{color:#767676;margin-left:6px}
  #ed-tools{position:absolute;z-index:61;display:flex;gap:4px;align-items:center;background:#1b1b1b;padding:6px;border-radius:4px;box-shadow:0 6px 20px rgba(0,0,0,.3)}
  #ed-tools button{border-color:#444;background:#2a2a2a;color:#fff;padding:5px 8px}
  #ed-tools button:hover{background:#ff6154;border-color:#ff6154}
  #ed-tools i{width:1px;height:18px;background:#555;display:inline-block;margin:0 2px}
  #ed-tools .ed-k{color:#aaa;font:11px ui-monospace,monospace;margin:0 6px 0 2px}
  body.editing [data-k]{outline:1px dashed #ff6154;outline-offset:3px;cursor:text;min-width:1ch}
  body.editing [data-k]:focus,body.editing [data-k].ed-sel{outline:2px solid #ff6154;background:rgba(255,97,84,.06)}
  body.editing [data-section]{position:relative;outline:1px dashed #a1a7af;outline-offset:8px}
  .ed-handle{position:absolute;right:-4px;top:-26px;font:12px system-ui;background:#1b1b1b;color:#fff;padding:4px 8px;border-radius:2px;cursor:grab;user-select:none;z-index:40}
  [data-section].ed-over{outline:2px solid #ff6154}
  body.ed-moving{cursor:grabbing;user-select:none}
  `;document.head.appendChild(css);
  let editing=false,sel=null;
  const toggle=document.getElementById('ed-toggle'),save=document.getElementById('ed-save'),cancel=document.getElementById('ed-cancel'),msg=document.getElementById('ed-msg');
  function setPath(obj,path,val){const ks=path.split('.');let o=obj;for(let i=0;i<ks.length-1;i++){o=o[ks[i]]}o[ks[ks.length-1]]=val}
  function lay(k){return data.layout[k]=data.layout[k]||{}}
  function apply(k){window.__applyLayout&&window.__applyLayout(k,data.layout[k]||{})}
  function placeTools(el){const r=el.getBoundingClientRect();tb.style.left=Math.max(8,r.left+window.scrollX)+'px';tb.style.top=(r.top+window.scrollY-44)+'px';tb.hidden=false;tb.querySelector('.ed-k').textContent=el.dataset.k}
  function select(el){if(sel)sel.classList.remove('ed-sel');sel=el;el.classList.add('ed-sel');placeTools(el)}
  function enter(){editing=true;document.body.classList.add('editing');toggle.hidden=true;save.hidden=false;cancel.hidden=false;msg.textContent='click text to edit · toolbar: ✥ drag, ↑↓ order, W A S size & space, L C R align · drag section handles';
    document.querySelectorAll('[data-k]').forEach(el=>{el.contentEditable='true';el.spellcheck=false;el.addEventListener('focus',()=>select(el));el.addEventListener('click',()=>select(el))});
    document.querySelectorAll('[data-section]').forEach(sec=>{const h=document.createElement('div');h.className='ed-handle';h.textContent='⋮⋮ '+sec.dataset.section;h.draggable=true;sec.prepend(h);
      h.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',sec.dataset.section)});
      sec.addEventListener('dragover',e=>{e.preventDefault();sec.classList.add('ed-over')});sec.addEventListener('dragleave',()=>sec.classList.remove('ed-over'));
      sec.addEventListener('drop',e=>{e.preventDefault();sec.classList.remove('ed-over');const id=e.dataTransfer.getData('text/plain');const from=document.querySelector(`[data-section="${id}"]`);if(!from||from===sec)return;const r=sec.getBoundingClientRect();if(e.clientY<r.top+r.height/2)sec.before(from);else sec.after(from)})})}
  tb.addEventListener('mousedown',e=>{const b=e.target.closest('button');if(!b||!sel)return;const op=b.dataset.op,k=sel.dataset.k,o=lay(k);
    if(op==='move'){e.preventDefault();const sx=e.clientX,sy=e.clientY,dx0=o.dx||0,dy0=o.dy||0;document.body.classList.add('ed-moving');
      const mv=ev=>{o.dx=dx0+ev.clientX-sx;o.dy=dy0+ev.clientY-sy;apply(k)};const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);document.body.classList.remove('ed-moving');placeTools(sel)};
      document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);return}
    e.preventDefault();
    const base=parseFloat(getComputedStyle(sel).fontSize)||16,W=sel.getBoundingClientRect().width;
    if(op==='up'&&sel.previousElementSibling)sel.previousElementSibling.before(sel);
    if(op==='down'&&sel.nextElementSibling)sel.nextElementSibling.after(sel);
    if(op==='w-')o.w=Math.max(120,(o.w||Math.round(W))-40);if(op==='w+')o.w=(o.w||Math.round(W))+40;
    if(op==='fs-')o.fs=Math.max(9,(o.fs||Math.round(base))-2);if(op==='fs+')o.fs=(o.fs||Math.round(base))+2;
    if(op==='mt-')o.mt=Math.max(0,(o.mt||0)-8);if(op==='mt+')o.mt=(o.mt||0)+8;
    if(op==='al')o.align=b.dataset.v;
    if(op==='reset')data.layout[k]={};
    apply(k);placeTools(sel)});
  function collect(){const out=JSON.parse(JSON.stringify(data));document.querySelectorAll('[data-k]').forEach(el=>{const c=el.cloneNode(true);c.querySelectorAll('em,i').forEach(e=>e.replaceWith('*'+e.textContent+'*'));c.querySelectorAll('tspan').forEach((e,i)=>{if(i)e.before(' ')});const t=(c.textContent||'');setPath(out,el.dataset.k,t.replace(/ /g,' ').trim())});out.order=[...document.querySelectorAll('[data-section]')].map(s=>s.dataset.section);Object.keys(out.layout).forEach(k=>{if(!Object.keys(out.layout[k]).length)delete out.layout[k]});return out}
  toggle.addEventListener('click',enter);
  cancel.addEventListener('click',()=>location.reload());
  save.addEventListener('click',async()=>{msg.textContent='saving…';let payload;try{payload=collect()}catch(e){msg.textContent='could not collect: '+e.message;return}const r=await fetch('/__save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});msg.textContent=r.ok?'saved to src/copy.json':'save failed';if(r.ok)setTimeout(()=>location.reload(),600)});
  document.addEventListener('keydown',e=>{if(e.key==='e'&&!editing&&!/input|textarea/i.test(e.target.tagName)&&!e.target.isContentEditable)enter();if((e.metaKey||e.ctrlKey)&&e.key==='s'&&editing){e.preventDefault();save.click()}});
})();
