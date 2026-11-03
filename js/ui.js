/* Small presentation helpers. No remote assets or framework dependencies. */
(function () {
  'use strict';
  const shapes = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m8 14 2 2 5-5"/>',
    chart: '<path d="M3 3v18h18M7 14v3m5-9v9m5-13v13"/>',
    equipment: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3m-4 5v6m-3-3h6"/>',
    settings: '<path d="m9 3-1 3-3 1-2 4 2 3 1 4 4 2 3-1 4-1 2-4-1-3-1-4-4-2Z"/><circle cx="11" cy="11" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3 11h4l2-4 4 8 2-4h6"/>',
    drop: '<path d="M12 2C9 6 5 10 5 15a7 7 0 0 0 14 0c0-5-4-9-7-13Z"/><path d="M9 16a3 3 0 0 0 3 3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2"/>',
    filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    print: '<path d="M6 9V3h12v6M6 18H3V9h18v9h-3"/><path d="M6 14h12v7H6zM17 11h1"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    leaf: '<path d="M20 3C6 1 1 10 6 16s16 2 14-13ZM4 21 16 8"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (shapes[name] || shapes.clipboard) + '</svg>'; }
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function number(value) { return Number(value || 0).toLocaleString('en-PH'); }
  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function date(value) { if (!value) return '—'; const d = new Date(value + (value.length === 10 ? 'T00:00:00' : '')); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}); }
  function age(dob, asOf) { if (!dob) return null; const a=asOf.split('-').map(Number),b=dob.split('-').map(Number); return a[0]-b[0]-(a[1]<b[1] || (a[1]===b[1] && a[2]<b[2]) ? 1:0); }
  function fullName(p) { return [p.lastName + ',', p.firstName, p.middleName, p.suffix].filter(Boolean).join(' '); }
  function initials(p) { return ((p.firstName || '?')[0] + (p.lastName || '?')[0]).toUpperCase(); }
  function button(label, action, name, cls, extra) { return '<button class="btn '+(cls||'')+'" data-action="'+escape(action)+'" '+(extra||'')+'>'+(name?icon(name):'')+escape(label)+'</button>'; }
  function tag(label, cls) { return '<span class="tag '+(cls||'')+'">'+escape(label)+'</span>'; }
  function empty(title, text, actionHtml, name) { return '<div class="empty-state"><div class="empty-icon">'+icon(name||'people')+'</div><h3>'+escape(title)+'</h3><p>'+escape(text)+'</p>'+(actionHtml||'')+'</div>'; }
  function options(items, value, placeholder) { let html=placeholder===undefined?'':'<option value="">'+escape(placeholder)+'</option>'; return html+items.map(item=>{const a=Array.isArray(item)?item:[item,item];return '<option value="'+escape(a[0])+'" '+(String(value)===String(a[0])?'selected':'')+'>'+escape(a[1])+'</option>';}).join(''); }
  function input(name,label,value,type,attrs,wide) { return '<div class="field '+(wide?'wide':'')+'"><label for="f-'+escape(name)+'">'+escape(label)+(String(attrs).includes('required')?' <span class="required">*</span>':'')+'</label><input id="f-'+escape(name)+'" name="'+escape(name)+'" type="'+(type||'text')+'" value="'+escape(value)+'" '+(attrs||'')+'></div>'; }
  function select(name,label,items,value,placeholder,attrs) { return '<div class="field"><label for="f-'+escape(name)+'">'+escape(label)+(String(attrs).includes('required')?' <span class="required">*</span>':'')+'</label><select id="f-'+escape(name)+'" name="'+escape(name)+'" '+(attrs||'')+'>'+options(items,value,placeholder)+'</select></div>'; }
  function toast(text,type) { const el=document.createElement('div'); el.className='toast '+(type||'');el.textContent=text;document.getElementById('toast-region').appendChild(el);setTimeout(()=>el.remove(),type==='error'?9000:5000); }
  function download(blob,filename) { const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000); }
  window.PhilUI={icon,escape,number,today,date,age,fullName,initials,button,tag,empty,options,input,select,toast,download};
})();
