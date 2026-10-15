// Applies per-block layout overrides from copy.json → layout[key] to every [data-k]. Runs on every page, built or dev.
(function(){
  const el=document.getElementById('copy-data'); if(!el) return;
  const data=JSON.parse(el.textContent); const L=data.layout||{};
  window.__applyLayout=function(key,o){const nodes=document.querySelectorAll('[data-k="'+key+'"]');nodes.forEach(n=>{
    n.style.maxWidth=o.w?o.w+'px':''; n.style.fontSize=o.fs?o.fs+'px':''; n.style.marginTop=(o.mt!==undefined&&o.mt!==null)?o.mt+'px':''; n.style.textAlign=o.align||'';
    n.style.transform=(o.dx||o.dy)?`translate(${o.dx||0}px,${o.dy||0}px)`:''; if(o.w||o.align) n.style.display=n.style.display||'block'; if(o.w) n.style.marginLeft=n.style.marginRight='auto';
  })};
  Object.keys(L).forEach(k=>window.__applyLayout(k,L[k]));
})();
