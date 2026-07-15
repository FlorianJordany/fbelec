import { useState, useEffect, useRef, useCallback } from 'react';

// ── Icônes SVG ────────────────────────────────────────────────
export function Icon({ name, size=20, stroke=1.8, style }) {
  const p = { width:size, height:size, viewBox:"0 0 24 24", fill:"none",
    stroke:"currentColor", strokeWidth:stroke, strokeLinecap:"round", strokeLinejoin:"round", style };
  const paths = {
    bolt:   <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" stroke="none"/>,
    phone:  <path d="M5 4h4l2 5-3 2a13 13 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2Z"/>,
    mail:   <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    pin:    <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/></>,
    file:   <><path d="M14 3v5h5"/><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z"/></>,
    check:  <path d="m5 12 4.5 4.5L19 7"/>,
    clock:  <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    alert:  <><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/></>,
    chevR:  <path d="m9 6 6 6-6 6"/>,
    chevD:  <path d="m6 9 6 6 6-6"/>,
    arrowL: <path d="M19 12H5m6-6-6 6 6 6"/>,
    x:      <path d="M6 6l12 12M18 6 6 18"/>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></>,
    user:   <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    lock:   <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    eye:    <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    eyeOff: <><path d="m3 3 18 18"/><path d="M10.6 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.3 6.3A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 3.7-.7"/></>,
    trash:  <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/></>,
    plus:   <path d="M12 5v14M5 12h14"/>,
    edit:   <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14 6l4 4"/>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></>,
    swap:   <><path d="M7 4 3 8l4 4M3 8h14a4 4 0 0 1 0 8h-2"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    filter: <path d="M3 6h18M7 12h10M11 18h2"/>,
    send:   <path d="m22 2-11 11M22 2 15 22l-4-9-9-4 20-7Z"/>,
    info:   <><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.7" r=".6" fill="currentColor"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
    extLink:<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
    archive:<><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></>,
    help:   <><circle cx="12" cy="12" r="9"/><path d="M9.3 9a2.8 2.8 0 0 1 5.3 1c0 1.9-2.6 2.1-2.6 4"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/></>,
    download:<><path d="M12 4v12m-5-5 5 5 5-5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></>,
    grip:   <><circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/></>,
    briefcase:<><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></>,
  };
  return <svg {...p}>{paths[name]||null}</svg>;
}

// ── Logo ──────────────────────────────────────────────────────
export function Logo({ height=40, onClick }) {
  return <img src="/assets/logo-fbelec.png" alt="FB ELEC"
    onClick={onClick}
    style={{height,width:"auto",display:"block",cursor:onClick?"pointer":"default"}} />;
}

// ── Bouton ────────────────────────────────────────────────────
export function Btn({ children, variant="primary", size="md", icon, iconR, onClick, href, full, style, type, disabled, loading, title }) {
  const sizes={sm:"8px 14px",md:"12px 20px",lg:"15px 26px"};
  const fs={sm:14,md:15,lg:17};
  const base={display:"inline-flex",alignItems:"center",justifyContent:"center",gap:9,
    padding:sizes[size],fontSize:fs[size],fontFamily:"var(--font-head)",fontWeight:600,
    letterSpacing:".01em",borderRadius:"var(--r-btn)",border:"1.5px solid transparent",
    cursor:(disabled||loading)?"not-allowed":"pointer",textDecoration:"none",lineHeight:1.15,
    width:full?"100%":"auto",maxWidth:"100%",transition:"all .16s ease",opacity:(disabled||loading)?.6:1,
    whiteSpace:full?"normal":"nowrap"};
  const variants={
    primary:{background:"var(--jaune)",color:"#1a1a1a",borderColor:"var(--jaune)"},
    dark:{background:"var(--noir)",color:"#fff",borderColor:"var(--noir)"},
    ghost:{background:"transparent",color:"var(--ink)",borderColor:"var(--line-strong)"},
    soft:{background:"var(--bg-soft)",color:"var(--ink)",borderColor:"transparent"},
    danger:{background:"transparent",color:"var(--c-blocked)",borderColor:"color-mix(in srgb,var(--c-blocked) 40%,transparent)"},
  };
  const cls="fb-btn fb-btn-"+variant;
  const inner=<>{loading?<span style={{width:16,height:16,border:"2px solid currentColor",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block"}}/>:icon&&<Icon name={icon} size={size==="sm"?16:18}/>}{children}{iconR&&<Icon name={iconR} size={size==="sm"?16:18}/>}</>;
  const props={className:cls,title,style:{...base,...variants[variant],...style},onClick:(disabled||loading)?undefined:onClick};
  return href?<a href={href} {...props}>{inner}</a>:<button type={type||"button"} disabled={disabled||loading} {...props}>{inner}</button>;
}

// ── Badge statut ──────────────────────────────────────────────
const STATUS_STYLE={
  neutral:{bg:"var(--bg-soft)",fg:"var(--slate)",dot:"var(--slate)"},
  muted:{bg:"var(--bg-soft)",fg:"var(--muted)",dot:"var(--muted)"},
  wait:{bg:"color-mix(in srgb,var(--c-wait) 12%,#fff)",fg:"var(--c-wait-ink)",dot:"var(--c-wait)"},
  progress:{bg:"color-mix(in srgb,var(--jaune) 22%,#fff)",fg:"#7a5c00",dot:"var(--jaune-deep)"},
  done:{bg:"color-mix(in srgb,var(--c-done) 12%,#fff)",fg:"var(--c-done-ink)",dot:"var(--c-done)"},
  action:{bg:"color-mix(in srgb,var(--c-blocked) 12%,#fff)",fg:"var(--c-blocked-ink)",dot:"var(--c-blocked)"},
  blocked:{bg:"color-mix(in srgb,var(--c-blocked) 12%,#fff)",fg:"var(--c-blocked-ink)",dot:"var(--c-blocked)"},
};
export function StatusPill({ kind="neutral", children, size="md" }) {
  const s=STATUS_STYLE[kind]||STATUS_STYLE.neutral;
  return <span style={{display:"inline-flex",alignItems:"center",gap:7,maxWidth:"100%",boxSizing:"border-box",
    padding:size==="sm"?"4px 9px":"6px 12px",background:s.bg,color:s.fg,borderRadius:999,
    fontSize:size==="sm"?12.5:13.5,fontWeight:600,fontFamily:"var(--font-head)",lineHeight:1,whiteSpace:"nowrap"}}>
    <span style={{width:7,height:7,borderRadius:999,background:s.dot,flex:"0 0 auto"}}/>
    <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{children}</span>
  </span>;
}

// ── Carte ─────────────────────────────────────────────────────
export function Card({ children, style, pad=24, onClick, hover }) {
  const [h,setH]=useState(false);
  return <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{background:"#fff",border:"1px solid var(--line)",borderRadius:"var(--r-card)",
      padding:pad,boxShadow:h&&hover?"var(--shadow-lg)":"var(--shadow)",
      transition:"box-shadow .18s ease,transform .18s ease,border-color .18s ease",
      transform:h&&hover?"translateY(-3px)":"none",
      borderColor:h&&hover?"var(--line-strong)":"var(--line)",
      cursor:onClick?"pointer":"default",...style}}>
    {children}
  </div>;
}

// ── Champ ─────────────────────────────────────────────────────
export function Field({ label, icon, type="text", value, onChange, placeholder, hint }) {
  const [focus,setFocus]=useState(false);
  return <label style={{display:"block"}}>
    <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>{label}</span>
    <span style={{display:"flex",alignItems:"center",gap:10,padding:"0 14px",background:"#fff",
      border:"1.5px solid "+(focus?"var(--jaune-deep)":"var(--line-strong)"),
      borderRadius:"var(--r-input)",height:50,transition:"border-color .15s ease",
      boxShadow:focus?"0 0 0 3px color-mix(in srgb,var(--jaune) 28%,transparent)":"none"}}>
      {icon&&<span style={{color:focus?"var(--ink)":"var(--muted)",display:"flex"}}><Icon name={icon} size={19}/></span>}
      <input type={type} value={value} placeholder={placeholder}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        onChange={e=>onChange&&onChange(e.target.value)}
        style={{flex:1,border:"none",outline:"none",background:"transparent",
          fontSize:15.5,color:"var(--ink)",minWidth:0}}/>
    </span>
    {hint&&<span style={{display:"block",fontSize:12.5,color:"var(--muted)",marginTop:6}}>{hint}</span>}
  </label>;
}

// ── SectionTitle ──────────────────────────────────────────────
export function SectionTitle({ icon, children, right }) {
  return <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:18}}>
    {icon&&<span style={{display:"flex",color:"var(--ink)"}}><Icon name={icon} size={21}/></span>}
    <h3 style={{margin:0,fontSize:19,fontFamily:"var(--font-head)",fontWeight:700,color:"var(--ink)",letterSpacing:"-.01em"}}>{children}</h3>
    <span style={{flex:1,height:1,background:"var(--line)"}}/>
    {right}
  </div>;
}

// ── Toast ─────────────────────────────────────────────────────
export function Toast({ message, type="success" }) {
  if (!message) return null;
  const bg = type==="error" ? "var(--c-blocked)" : "var(--noir)";
  return <div style={{position:"fixed",bottom:26,left:"50%",transform:"translateX(-50%)",zIndex:250,
    background:bg,color:"#fff",padding:"13px 22px",borderRadius:999,fontSize:14.5,
    fontFamily:"var(--font-head)",fontWeight:600,boxShadow:"var(--shadow-lg)",
    display:"flex",alignItems:"center",gap:9}}>
    <Icon name={type==="error"?"alert":"check"} size={18} style={{color:type==="error"?"#fff":"var(--jaune)"}}/>{message}
  </div>;
}

export function useToast() {
  const [toast,setToast]=useState({msg:"",type:"success"});
  const show=useCallback((msg,type="success")=>{
    setToast({msg,type});
    setTimeout(()=>setToast({msg:"",type:"success"}),3000);
  },[]);
  return [toast,show];
}

// ── Filtre colonne (style DBeaver) ────────────────────────────
export function ColFilter({ label, allValues=[], value="", onChange }) {
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const ref=useRef(null);
  const active=value&&value.length>0;

  useEffect(()=>{
    if (!open) return;
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[open]);

  const unique=[...new Set(allValues.filter(v=>v!=null&&v!==""))].sort((a,b)=>String(a).localeCompare(String(b),'fr'));
  const shown=search?unique.filter(v=>String(v).toLowerCase().includes(search.toLowerCase())):unique;

  return <div ref={ref} style={{position:"relative",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer"}}
    onClick={()=>{ setOpen(o=>!o); setSearch(""); }}>
    <span style={{fontWeight:700,color:active?"var(--jaune-deep)":"var(--muted)",
      fontSize:11.5,textTransform:"uppercase",letterSpacing:".05em",fontFamily:"var(--font-head)"}}>{label}</span>
    <Icon name={active?"filter":"chevD"} size={12} style={{color:active?"var(--jaune-deep)":"var(--muted)",flexShrink:0}}/>
    {open&&<div onClick={e=>e.stopPropagation()}
      style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:200,background:"#fff",
        border:"1px solid var(--line-strong)",borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,.14)",
        minWidth:220,padding:12}}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Rechercher…"
        style={{width:"100%",padding:"7px 10px",border:"1px solid var(--line-strong)",borderRadius:6,
          fontSize:13,fontFamily:"var(--font-body)",outline:"none",boxSizing:"border-box",marginBottom:8}}/>
      {active&&<div onClick={()=>{onChange("");setOpen(false);}}
        style={{padding:"6px 10px",borderRadius:6,cursor:"pointer",fontSize:13,color:"var(--c-blocked-ink)",
          fontWeight:600,display:"flex",alignItems:"center",gap:7,marginBottom:4,
          background:"color-mix(in srgb,var(--c-blocked) 8%,#fff)"}}>
        <Icon name="x" size={13}/>Effacer le filtre ({value})
      </div>}
      <div style={{maxHeight:200,overflowY:"auto",display:"grid",gap:2}}>
        {shown.length===0&&<div style={{padding:"8px 10px",fontSize:13,color:"var(--muted)"}}>Aucune valeur</div>}
        {shown.map(v=><div key={String(v)}
          onClick={()=>{onChange(String(v)===value?"":String(v));setOpen(false);}}
          style={{padding:"7px 10px",borderRadius:6,cursor:"pointer",fontSize:13.5,
            fontWeight:String(v)===value?700:400,
            background:String(v)===value?"var(--jaune)":"#fff",
            transition:"background .1s"}}
          onMouseEnter={e=>{ if(String(v)!==value) e.currentTarget.style.background="var(--bg-soft)"; }}
          onMouseLeave={e=>{ if(String(v)!==value) e.currentTarget.style.background="#fff"; }}>
          {v}
        </div>)}
      </div>
    </div>}
  </div>;
}

// ── Select avec recherche ─────────────────────────────────────
export function SearchableSelect({ options=[], value="", onChange, placeholder="Sélectionner…", loading=false }) {
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const ref=useRef(null);
  const selected=options.find(o=>String(o.value)===String(value));

  useEffect(()=>{
    if (!open) return;
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[open]);

  const filtered=search?options.filter(o=>o.label.toLowerCase().includes(search.toLowerCase())):options;

  return <div ref={ref} style={{position:"relative"}}>
    <div onClick={()=>{ if(!loading){ setOpen(o=>!o); setSearch(""); } }}
      style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,
        padding:"0 14px",height:50,border:"1.5px solid var(--line-strong)",
        borderRadius:"var(--r-input)",background:"#fff",cursor:loading?"default":"pointer",
        borderColor:open?"var(--jaune-deep)":"var(--line-strong)"}}>
      <span style={{fontSize:15,color:selected?"var(--ink)":"var(--muted)",
        flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
        {loading?"Chargement…":selected?selected.label:placeholder}
      </span>
      <Icon name="chevD" size={16} style={{color:"var(--muted)",flexShrink:0,
        transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}/>
    </div>
    {open&&<div onClick={e=>e.stopPropagation()}
      style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:100,background:"#fff",
        border:"1px solid var(--line-strong)",borderRadius:10,
        boxShadow:"0 8px 32px rgba(0,0,0,.14)",overflow:"hidden"}}>
      <div style={{padding:10,borderBottom:"1px solid var(--line)"}}>
        <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher…"
          style={{width:"100%",padding:"7px 10px",border:"1px solid var(--line-strong)",borderRadius:6,
            fontSize:13.5,fontFamily:"var(--font-body)",outline:"none",boxSizing:"border-box"}}/>
      </div>
      <div style={{maxHeight:240,overflowY:"auto"}}>
        {filtered.length===0&&<div style={{padding:"12px 14px",fontSize:13.5,color:"var(--muted)"}}>Aucun résultat</div>}
        {filtered.map(o=><div key={String(o.value)}
          onClick={()=>{onChange(String(o.value));setOpen(false);setSearch("");}}
          style={{padding:"10px 14px",cursor:"pointer",fontSize:14,
            background:String(o.value)===String(value)?"var(--jaune)":"#fff",
            fontWeight:String(o.value)===String(value)?700:400}}
          onMouseEnter={e=>{ if(String(o.value)!==String(value)) e.currentTarget.style.background="var(--bg-soft)"; }}
          onMouseLeave={e=>{ if(String(o.value)!==String(value)) e.currentTarget.style.background="#fff"; }}>
          {o.label}
        </div>)}
      </div>
    </div>}
  </div>;
}

// ── Modal générique ───────────────────────────────────────────
export function Modal({ title, onClose, children, width=580 }) {
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:300,background:"rgba(10,10,10,.55)",
    display:"grid",placeItems:"center",padding:20}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:"var(--r-card)",
      width:"100%",maxWidth:width,maxHeight:"90vh",overflowY:"auto",boxShadow:"var(--shadow-lg)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"20px 24px",borderBottom:"1px solid var(--line)"}}>
        <h2 style={{margin:0,fontFamily:"var(--font-head)",fontWeight:700,fontSize:20,color:"var(--ink)"}}>{title}</h2>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",
          color:"var(--muted)",display:"grid",placeItems:"center",width:32,height:32}}>
          <Icon name="x" size={20}/>
        </button>
      </div>
      <div style={{padding:24}}>{children}</div>
    </div>
  </div>;
}

// ── Hook responsive (mobile ≤ bp) ─────────────────────────────
export function useIsMobile(bp=640) {
  const [m,setM]=useState(typeof window!=='undefined' && window.innerWidth<=bp);
  useEffect(()=>{
    const mq=window.matchMedia(`(max-width:${bp}px)`);
    const h=()=>setM(mq.matches); h();
    mq.addEventListener('change',h);
    return ()=>mq.removeEventListener('change',h);
  },[bp]);
  return m;
}

// ── Autocomplétion d'adresse (Base Adresse Nationale, sans clé) ─
// API publique officielle : https://adresse.data.gouv.fr/api-doc/adresse
// Schéma https explicite assumé (endpoint tiers fixe, jamais en mixed-content).
const BAN_URL='https://api-adresse.data.gouv.fr/search/';
export function AddressAutocomplete({ value, onChange, onSelect, placeholder, disabled, inputStyle }) {
  const [open,setOpen]=useState(false);
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [active,setActive]=useState(-1);
  const ref=useRef(null);
  const timer=useRef(null);

  useEffect(()=>{
    if(!open) return;
    const h=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[open]);
  useEffect(()=>()=>{ if(timer.current) clearTimeout(timer.current); },[]);

  const search=(q)=>{
    if(timer.current) clearTimeout(timer.current);
    if(!q||q.trim().length<3){ setResults([]); setOpen(false); return; }
    timer.current=setTimeout(async()=>{
      setLoading(true);
      try{
        const r=await fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`);
        const d=await r.json();
        setResults(Array.isArray(d.features)?d.features:[]); setOpen(true); setActive(-1);
      }catch{ setResults([]); }
      finally{ setLoading(false); }
    },250);
  };

  const pick=(f)=>{
    const p=f?.properties||{};
    onSelect&&onSelect({ adresse:p.name||p.label||'', code_postal:p.postcode||'', commune:p.city||'' });
    setOpen(false); setResults([]);
  };

  const baseInput={width:'100%',padding:'11px 14px',border:'1px solid var(--line-strong)',
    borderRadius:'var(--r-input)',fontSize:15,fontFamily:'var(--font-body)',background:'#fff',
    boxSizing:'border-box',outline:'none',...inputStyle};

  return <div ref={ref} style={{position:'relative'}}>
    <input value={value} placeholder={placeholder||'Commencez à taper une adresse…'}
      disabled={disabled} autoComplete="off"
      onChange={e=>{ onChange&&onChange(e.target.value); search(e.target.value); }}
      onFocus={()=>{ if(results.length) setOpen(true); }}
      onKeyDown={e=>{
        if(!open) return;
        if(e.key==='ArrowDown'){ e.preventDefault(); setActive(a=>Math.min(a+1,results.length-1)); }
        else if(e.key==='ArrowUp'){ e.preventDefault(); setActive(a=>Math.max(a-1,0)); }
        else if(e.key==='Enter'&&active>=0){ e.preventDefault(); pick(results[active]); }
        else if(e.key==='Escape'){ setOpen(false); }
      }}
      style={baseInput}/>
    {open&&(results.length>0||loading)&&<div
      style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:120,background:'#fff',
        border:'1px solid var(--line-strong)',borderRadius:10,boxShadow:'0 8px 32px rgba(0,0,0,.14)',overflow:'hidden'}}>
      {loading&&results.length===0&&<div style={{padding:'10px 14px',fontSize:13.5,color:'var(--muted)'}}>Recherche…</div>}
      {results.map((f,i)=><div key={f.properties?.id||i}
        onMouseDown={e=>{ e.preventDefault(); pick(f); }}
        onMouseEnter={()=>setActive(i)}
        style={{display:'flex',alignItems:'center',gap:9,padding:'10px 14px',cursor:'pointer',fontSize:14,
          background:i===active?'var(--bg-soft)':'#fff'}}>
        <Icon name="pin" size={15} style={{color:'var(--muted)',flex:'0 0 auto'}}/>
        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.properties?.label}</span>
      </div>)}
    </div>}
  </div>;
}

// ── Footer signature OutiLab (obligatoire, toutes les pages) ───
export function Footer() {
  return <footer style={{marginTop:'auto',borderTop:'1px solid var(--line)',padding:'22px 0',background:'#fff'}}>
    <div className="fb-wrap" style={{textAlign:'center',fontSize:12.5,color:'var(--muted)'}}>
      Encore conçu par <a href="https://outilab.fr" target="_blank" rel="noopener noreferrer"
        style={{color:'var(--jaune-deep)',fontWeight:600,textDecoration:'none'}}>OutiLab</a>
    </div>
  </footer>;
}

// ── Header App (client + admin) ───────────────────────────────
export function AppHeader({ go, admin, isAdmin, onLogout }) {
  return <header style={{position:"sticky",top:0,zIndex:40,background:"#fff",borderBottom:"1px solid var(--line)"}}>
    <div className="fb-wrap" style={{height:68,display:"flex",alignItems:"center",gap:16}}>
      <Logo height={38} onClick={()=>window.location.href='https://suividechantier.fbelec.fr'}/>
      <div style={{width:1,height:28,background:"var(--line)"}} className="fb-hide-mobile"/>
      <div className="fb-hide-mobile" style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:15,color:"var(--ink)"}}>
          {admin?"Back-office":"Espace suivi"}
        </span>
        {admin&&<StatusPill kind="progress" size="sm">FB ELEC</StatusPill>}
      </div>
      <div style={{flex:1}}/>
      {!admin&&!isAdmin&&<button onClick={()=>go("guide")} className="fb-roleswap"
        title="Guide d'utilisation"
        style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 13px",
          background:"var(--bg-soft)",border:"1px solid var(--line-strong)",borderRadius:999,
          cursor:"pointer",fontFamily:"var(--font-head)",fontWeight:600,fontSize:13.5,color:"var(--ink)"}}>
        <Icon name="help" size={16}/>
        <span className="fb-hide-mobile">Guide</span>
      </button>}
      {isAdmin&&<button onClick={()=>go(admin?"admin-vue-client":"admin-list")} className="fb-roleswap"
        style={{display:"inline-flex",alignItems:"center",gap:8,padding:"8px 13px",
          background:"var(--bg-soft)",border:"1px solid var(--line-strong)",borderRadius:999,
          cursor:"pointer",fontFamily:"var(--font-head)",fontWeight:600,fontSize:13.5,color:"var(--ink)"}}>
        <Icon name="swap" size={16}/>
        <span className="fb-hide-mobile">{admin?"Voir côté client":"Voir côté FB ELEC"}</span>
      </button>}
      <button onClick={onLogout} title="Déconnexion"
        style={{display:"grid",placeItems:"center",width:40,height:40,borderRadius:999,
          background:"var(--bg-soft)",border:"1px solid var(--line-strong)",cursor:"pointer",color:"var(--slate)"}}>
        <Icon name="logout" size={18}/>
      </button>
    </div>
  </header>;
}
