import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, chantierBadge, downloadFile, downloadPdf, CAT_LABELS, CAT_REQUIRED, DOC_OPTIONS } from './api.js';
import { Icon, Btn, StatusPill, Card, Field, SectionTitle, Toast, useToast,
         ColFilter, SearchableSelect, Modal, AppHeader, AddressAutocomplete, Footer } from './ui.jsx';
import { Notes } from './client.jsx';

// ─── Documents (admin) ───────────────────────────────────────
function AdminDocumentsSection({ chantierId, docs, reload, showToast }) {
  const [nomCat,setNomCat]=useState('permis_construire');
  const [nomLibre,setNomLibre]=useState('');
  const [file,setFile]=useState(null);
  const [visibleClient,setVisibleClient]=useState(true);
  const [uploading,setUploading]=useState(false);

  const inputSt={padding:'8px 11px',border:'1px solid var(--line-strong)',borderRadius:'var(--r-input)',
    fontSize:13.5,fontFamily:'var(--font-body)',color:'var(--ink)',background:'#fff'};

  const nomFinal = nomCat==='autre' ? nomLibre.trim() : (CAT_LABELS[nomCat]||nomCat);

  const upload = async () => {
    if (!nomFinal) return showToast('Nom du document requis','error');
    setUploading(true);
    try {
      const fd=new FormData();
      if (file) fd.append('fichier',file);
      fd.append('nom',nomFinal);
      fd.append('categorie', nomCat==='autre' ? '' : nomCat);
      fd.append('visible_client',String(visibleClient));
      await apiFetch(`/api/admin/chantiers/${chantierId}/documents`,{method:'POST',body:fd});
      setNomCat('permis_construire'); setNomLibre(''); setFile(null); setVisibleClient(true);
      reload(); showToast('Document ajouté ✓');
    } catch(e){showToast(e.message,'error');}
    finally{setUploading(false);}
  };

  const toggleVisible = async (doc) => {
    try {
      await apiFetch(`/api/admin/documents/${doc.id}`,{method:'PUT',body:{visible_client:!doc.visible_client}});
      reload();
    } catch(e){showToast(e.message,'error');}
  };

  const deleteDoc = async (doc) => {
    if (!window.confirm(`Supprimer "${doc.nom}" ?`)) return;
    try {
      await apiFetch(`/api/admin/documents/${doc.id}`,{method:'DELETE'});
      reload(); showToast('Document supprimé ✓');
    } catch(e){showToast(e.message,'error');}
  };

  return <Card>
    <SectionTitle icon="file" right={<span style={{fontSize:13,color:"var(--muted)"}}>{docs.length} doc(s)</span>}>
      Documents
    </SectionTitle>

    {/* Formulaire d'ajout */}
    <div style={{background:'var(--bg-soft)',borderRadius:'var(--r-input)',padding:'14px 16px',marginBottom:16}}>
      <div style={{fontSize:13,fontFamily:'var(--font-head)',fontWeight:700,color:'var(--ink)',marginBottom:10}}>
        Ajouter un document
      </div>
      <div style={{display:'grid',gap:8}}>
        <select value={nomCat} onChange={e=>setNomCat(e.target.value)}
          style={{...inputSt,width:'100%',boxSizing:'border-box'}}>
          {DOC_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {nomCat==='autre'&&<input style={{...inputSt,width:'100%',boxSizing:'border-box'}}
          placeholder="Nom du document *" value={nomLibre} onChange={e=>setNomLibre(e.target.value)}/>}
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:8,alignItems:'center'}}>
          <label style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',
            border:'1px solid var(--line-strong)',borderRadius:'var(--r-input)',background:'#fff',
            cursor:'pointer',fontSize:13.5,color:file?'var(--ink)':'var(--muted)',overflow:'hidden',minWidth:0}}>
            <Icon name="file" size={15} style={{flex:'0 0 auto',color:'var(--slate)'}}/>
            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {file?file.name:'Choisir un fichier'}
            </span>
            <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={e=>setFile(e.target.files[0]||null)}/>
          </label>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer',
            whiteSpace:'nowrap',color:'var(--ink)'}}>
            <input type="checkbox" checked={visibleClient} onChange={e=>setVisibleClient(e.target.checked)}/>
            Visible client
          </label>
        </div>
        <Btn variant="dark" disabled={uploading||!nomFinal} onClick={upload}>
          {uploading?'Upload…':'Ajouter'}
        </Btn>
      </div>
    </div>

    {/* Liste documents */}
    {docs.length===0&&<p style={{color:'var(--muted)',fontSize:14,margin:0}}>Aucun document.</p>}
    <div style={{display:'grid',gap:8}}>
      {docs.map(d=><div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',
        border:'1px solid var(--line)',borderRadius:'var(--r-input)',background:'#fff'}}>
        <div onClick={()=>d.url&&window.open(d.url,'_blank','noopener,noreferrer')}
          style={{width:38,height:38,borderRadius:8,background:'var(--bg-soft)',display:'grid',
            placeItems:'center',color:'var(--jaune-deep)',flex:'0 0 auto',cursor:d.url?'pointer':'default'}}>
          <Icon name="file" size={19}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div onClick={()=>d.url&&window.open(d.url,'_blank','noopener,noreferrer')}
            style={{fontFamily:'var(--font-head)',fontWeight:600,fontSize:14,color:'var(--ink)',
              display:'flex',alignItems:'center',gap:5,cursor:d.url?'pointer':'default'}}>
            {d.nom}{d.url&&<Icon name="extLink" size={12} style={{color:'var(--muted)',flex:'0 0 auto'}}/>}
          </div>
          <div style={{fontSize:12,color:'var(--muted)'}}>
            {d.categorie&&CAT_LABELS[d.categorie]?CAT_LABELS[d.categorie]:d.type_fichier||''}
          </div>
        </div>
        <button title={d.visible_client?'Visible client':'Masqué client'}
          onClick={()=>toggleVisible(d)}
          style={{width:32,height:32,borderRadius:7,border:'1px solid var(--line-strong)',
            background:d.visible_client?'var(--jaune)':'#fff',cursor:'pointer',
            color:d.visible_client?'#1a1a1a':'var(--muted)',display:'grid',placeItems:'center',flex:'0 0 auto'}}>
          <Icon name={d.visible_client?'eye':'eyeOff'} size={15}/>
        </button>
        <button title="Supprimer" onClick={()=>deleteDoc(d)}
          style={{width:32,height:32,borderRadius:7,border:'1px solid var(--line-strong)',
            background:'#fff',cursor:'pointer',color:'var(--c-blocked)',
            display:'grid',placeItems:'center',flex:'0 0 auto'}}>
          <Icon name="trash" size={15}/>
        </button>
      </div>)}
    </div>
  </Card>;
}

// ═════════════════════════════════════════════════════════════
//  MODAL NOUVEAU CLIENT
// ═════════════════════════════════════════════════════════════
function ModalNouveauClient({ onClose, onCreated }) {
  const [form,setForm]=useState({nom:"",email:"",telephone:"",pdl:"",societe_id:"",role_societe:"basic"});
  const [societes,setSocietes]=useState([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [code,setCode]=useState(null);

  useEffect(()=>{ apiFetch('/api/admin/societes').then(setSocietes).catch(()=>{}); },[]);

  const submit = async e => {
    e.preventDefault();
    if (!form.nom||!form.email){setErr("Nom et e-mail requis.");return;}
    setLoading(true);setErr("");
    try {
      const data = await apiFetch('/api/admin/clients',{method:'POST',body:{
        ...form, societe_id: form.societe_id||null,
      }});
      setCode(data.code_suivi);
      onCreated(data);
    } catch(e){setErr(e.message);}
    finally{setLoading(false);}
  };

  if (code) return <Modal title="Client créé ✓" onClose={onClose}>
    <div style={{textAlign:"center",padding:"10px 0 20px"}}>
      <div style={{width:56,height:56,borderRadius:999,background:"color-mix(in srgb,var(--c-done) 15%,#fff)",
        display:"grid",placeItems:"center",margin:"0 auto 18px",color:"var(--c-done)"}}>
        <Icon name="check" size={28}/>
      </div>
      <p style={{margin:"0 0 16px",color:"var(--slate)",fontSize:15}}>Le mot de passe provisoire du client est :</p>
      <div style={{background:"var(--bg-soft)",border:"2px dashed var(--line-strong)",borderRadius:"var(--r-input)",
        padding:"16px 20px",fontFamily:"var(--font-mono)",fontSize:22,fontWeight:700,
        color:"var(--ink)",letterSpacing:".1em",marginBottom:20}}>{code}</div>
      <p style={{margin:"0 0 24px",fontSize:13.5,color:"var(--muted)"}}>
        Transmettez ce code au client — il ne sera plus affiché.
      </p>
      <Btn variant="primary" full onClick={onClose}>Fermer</Btn>
    </div>
  </Modal>;

  return <Modal title="Nouveau client" onClose={onClose}>
    <form onSubmit={submit} style={{display:"grid",gap:16}}>
      <Field label="Nom du client *" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))} placeholder="ex. Martin Construction"/>
      <Field label="E-mail *" icon="mail" type="email" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="client@exemple.fr"/>
      <Field label="Téléphone" icon="phone" value={form.telephone} onChange={v=>setForm(f=>({...f,telephone:v}))} placeholder="06 XX XX XX XX"/>
      <Field label="N° PDL (Point de livraison)" value={form.pdl} onChange={v=>setForm(f=>({...f,pdl:v}))} placeholder="Optionnel"/>
      <div className="fb-form2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div>
          <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>Société (optionnel)</span>
          <select value={form.societe_id} onChange={e=>setForm(f=>({...f,societe_id:e.target.value}))}
            style={{width:"100%",height:50,padding:"0 12px",border:"1.5px solid var(--line-strong)",
              borderRadius:"var(--r-input)",fontSize:15,fontFamily:"var(--font-body)",background:"#fff"}}>
            <option value="">— Aucune —</option>
            {societes.map(s=><option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
        {form.societe_id&&<div>
          <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>Rôle dans la société</span>
          <select value={form.role_societe} onChange={e=>setForm(f=>({...f,role_societe:e.target.value}))}
            style={{width:"100%",height:50,padding:"0 12px",border:"1.5px solid var(--line-strong)",
              borderRadius:"var(--r-input)",fontSize:15,fontFamily:"var(--font-body)",background:"#fff"}}>
            <option value="basic">Basic — voit ses chantiers</option>
            <option value="admin">Admin — voit toute la société</option>
          </select>
        </div>}
      </div>
      {err&&<div style={{color:"var(--c-blocked-ink)",fontSize:14,display:"flex",gap:8,alignItems:"center"}}>
        <Icon name="alert" size={16}/>{err}</div>}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" type="submit" loading={loading} icon="plus">Créer le client</Btn>
      </div>
    </form>
  </Modal>;
}

// ═════════════════════════════════════════════════════════════
//  CRÉER UN CHANTIER (admin) — formulaire pleine page
// ═════════════════════════════════════════════════════════════
export function AdminNouveauChantier({ go, openChantier, onLogout, isAdmin }) {
  const [clients,setClients]=useState([]);
  const [loadingClients,setLoadingClients]=useState(true);
  const [form,setForm]=useState({client_id:'',adresse:'',commune:'',code_postal:'',puissance_demandee:'',puissance_type:'',date_debut_chantier:'',terrain_viabilise:'',reference_client:''});
  const [factType,setFactType]=useState('identique');
  const [factAdresse,setFactAdresse]=useState('');
  const [factCp,setFactCp]=useState('');
  const [factCommune,setFactCommune]=useState('');
  const [factReference,setFactReference]=useState('');
  const [factTelephone,setFactTelephone]=useState('');
  const [factEmail,setFactEmail]=useState('');
  const [mandatLoading,setMandatLoading]=useState(false);
  const [dureeMontant,setDureeMontant]=useState('');
  const [dureeUnite,setDureeUnite]=useState('semaines');
  const [docs,setDocs]=useState({permis_construire:null,plan_situation:null,plan_masse:null,mandat:null});
  const [photos,setPhotos]=useState([]);
  const [commentaire,setCommentaire]=useState('');
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [step,setStep]=useState(1);
  const [showNouveauClient,setShowNouveauClient]=useState(false);

  useEffect(()=>{
    apiFetch('/api/admin/clients').then(setClients).catch(console.error).finally(()=>setLoadingClients(false));
  },[]);

  const setF=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const setDoc=k=>e=>setDocs(d=>({...d,[k]:e.target.files[0]||null}));
  const addPhotos=e=>setPhotos(p=>[...p,...Array.from(e.target.files)]);
  const removePhoto=i=>setPhotos(p=>p.filter((_,j)=>j!==i));

  const adresseFact = factType==='identique'
    ? [form.adresse,form.code_postal,form.commune].filter(Boolean).join(', ')
    : [factAdresse,factCp,factCommune].filter(Boolean).join(', ');
  const dureeFinal = dureeMontant ? `${dureeMontant} ${dureeUnite}` : '';
  const canStep2 = form.client_id&&form.adresse&&form.commune&&form.puissance_demandee&&form.puissance_type
    &&form.date_debut_chantier&&dureeMontant&&form.terrain_viabilise&&form.reference_client.trim()
    &&(factType==='identique'||(factAdresse&&factCommune&&factReference.trim()));
  const canStep3 = CAT_REQUIRED.every(k=>docs[k]);

  async function submit() {
    setErr(''); setLoading(true);
    try {
      const chantier=await apiFetch('/api/admin/chantiers',{method:'POST',body:{
        ...form, client_id:parseInt(form.client_id),
        adresse_facturation:adresseFact, duree_chantier:dureeFinal,
        terrain_viabilise: form.terrain_viabilise==='oui',
        reference_facturation: factType==='differente'?factReference:'',
        facturation_telephone: factType==='differente'?factTelephone:'',
        facturation_email: factType==='differente'?factEmail:'',
        mandat_fourni: !!docs.mandat,
        commentaire: commentaire.trim(),
      }});
      for (const [cat,file] of Object.entries(docs)) {
        if (!file) continue;
        const fd=new FormData();
        fd.append('fichier',file); fd.append('nom',CAT_LABELS[cat]||cat);
        fd.append('categorie',cat); fd.append('visible_client','true');
        await apiFetch(`/api/admin/chantiers/${chantier.id}/documents`,{method:'POST',body:fd});
      }
      for (const photo of photos) {
        const fd=new FormData(); fd.append('photos',photo);
        await apiFetch(`/api/admin/chantiers/${chantier.id}/photos`,{method:'POST',body:fd});
      }
      openChantier(chantier.id);
    } catch(e){setErr(e.message||'Erreur lors de la création.');}
    finally{setLoading(false);}
  }

  const inputSt={width:'100%',padding:'11px 14px',border:'1px solid var(--line)',borderRadius:'var(--r-input)',
    fontSize:15,fontFamily:'var(--font-body)',background:'#fff',boxSizing:'border-box'};
  const labelSt={display:'block',fontSize:13,fontFamily:'var(--font-head)',fontWeight:700,color:'var(--ink)',marginBottom:6};

  return <div style={{minHeight:'100vh',background:'var(--bg-soft)',display:'flex',flexDirection:'column'}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/>
    <div className="fb-wrap" style={{paddingTop:22}}>
      <button onClick={()=>go('admin-list')} style={{display:'inline-flex',alignItems:'center',gap:7,
        background:'none',border:'none',cursor:'pointer',color:'var(--slate)',fontSize:14,
        fontFamily:'var(--font-head)',fontWeight:600,padding:0}}>
        <Icon name="arrowL" size={17}/>Tous les chantiers
      </button>
    </div>
    <main className="fb-wrap" style={{paddingTop:20,paddingBottom:60,maxWidth:680}}>
      <div style={{marginBottom:28}}>
        <p style={{margin:'0 0 4px',color:'var(--jaune-deep)',fontFamily:'var(--font-head)',fontWeight:700,
          letterSpacing:'.08em',fontSize:13,textTransform:'uppercase'}}>Back-office</p>
        <h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:36,
          textTransform:'uppercase',color:'var(--ink)',letterSpacing:'-.01em'}}>Nouveau chantier</h1>
      </div>

      {/* Indicateur étapes */}
      <div style={{display:'flex',gap:8,rowGap:10,flexWrap:'wrap',marginBottom:28}}>
        {[['1','Informations'],['2','Documents'],['3','Validation']].map(([n,lbl])=>{
          const active=parseInt(n)===step, done=parseInt(n)<step;
          return <div key={n} style={{display:'flex',alignItems:'center',gap:7}}>
            <div style={{width:28,height:28,borderRadius:999,display:'grid',placeItems:'center',
              background:done?'var(--jaune)':active?'var(--noir)':'var(--line-strong)',
              color:done?'#1a1a1a':active?'#fff':'var(--muted)',fontWeight:700,fontSize:13,flex:'0 0 auto'}}>
              {done?<Icon name="check" size={14}/>:n}
            </div>
            <span style={{fontSize:14,fontFamily:'var(--font-head)',fontWeight:600,
              color:active?'var(--ink)':'var(--muted)'}}>{lbl}</span>
            {n!=='3'&&<span style={{color:'var(--line-strong)',fontSize:18,margin:'0 4px'}}>›</span>}
          </div>;
        })}
      </div>

      {step===1&&<Card>
        <SectionTitle icon="user">Client &amp; informations</SectionTitle>
        <div style={{display:'grid',gap:16}}>
          <div>
            <label style={labelSt}>Client *</label>
            <div style={{display:'flex',gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <SearchableSelect loading={loadingClients}
                  options={clients.map(c=>({value:String(c.id),label:`${c.nom} — ${c.email}`}))}
                  value={form.client_id} onChange={v=>setForm(f=>({...f,client_id:v}))}
                  placeholder="Sélectionner un client"/>
              </div>
              <Btn variant="ghost" icon="plus" onClick={()=>setShowNouveauClient(true)}>Nouveau</Btn>
            </div>
          </div>
          <div>
            <label style={labelSt}>Référence *</label>
            <input style={inputSt} value={form.reference_client} onChange={setF('reference_client')}
              placeholder="Société ou nom du client"/>
          </div>
          <div>
            <label style={labelSt}>Adresse du chantier *</label>
            <AddressAutocomplete value={form.adresse}
              onChange={v=>setForm(f=>({...f,adresse:v}))}
              onSelect={a=>setForm(f=>({...f,adresse:a.adresse,
                code_postal:a.code_postal||f.code_postal, commune:a.commune||f.commune}))}
              inputStyle={inputSt} placeholder="ex. 12 rue des Acacias…"/>
          </div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div><label style={labelSt}>Commune *</label>
              <input style={inputSt} value={form.commune} onChange={setF('commune')}/></div>
            <div><label style={labelSt}>Code postal</label>
              <input style={inputSt} value={form.code_postal} onChange={setF('code_postal')}/></div>
          </div>
          <div style={{maxWidth:300}}>
            <label style={labelSt}>Terrain viabilisé *</label>
            <select style={inputSt} value={form.terrain_viabilise} onChange={setF('terrain_viabilise')}>
              <option value="">— Sélectionner —</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </div>
          <div>
            <label style={labelSt}>Adresse de facturation *</label>
            <select style={inputSt} value={factType}
              onChange={e=>{ const v=e.target.value; setFactType(v);
                if(v==='differente'&&!factReference)setFactReference(form.reference_client); }}>
              <option value="identique">Identique à l'adresse du chantier</option>
              <option value="differente">Différente</option>
            </select>
          </div>
          {factType==='differente'&&<>
            <div>
              <label style={labelSt}>Référence *</label>
              <input style={inputSt} value={factReference} onChange={e=>setFactReference(e.target.value)}
                placeholder="Société ou nom du client"/>
            </div>
            <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div>
                <label style={labelSt}>Téléphone <span style={{color:'var(--muted)',fontWeight:400}}>(optionnel)</span></label>
                <input style={inputSt} value={factTelephone} onChange={e=>setFactTelephone(e.target.value)}
                  placeholder="06 XX XX XX XX"/>
              </div>
              <div>
                <label style={labelSt}>Mail <span style={{color:'var(--muted)',fontWeight:400}}>(optionnel)</span></label>
                <input style={inputSt} type="email" value={factEmail} onChange={e=>setFactEmail(e.target.value)}
                  placeholder="facturation@exemple.fr"/>
              </div>
            </div>
          </>}
          <div>
            <label style={labelSt}>Adresse</label>
            {factType==='identique'
              ? <input readOnly disabled value={form.adresse}
                  style={{...inputSt,background:'var(--bg-soft)',color:'var(--muted)',cursor:'not-allowed'}}/>
              : <AddressAutocomplete value={factAdresse} onChange={setFactAdresse}
                  onSelect={a=>{ setFactAdresse(a.adresse); if(a.code_postal)setFactCp(a.code_postal); if(a.commune)setFactCommune(a.commune); }}
                  inputStyle={inputSt} placeholder="ex. 5 avenue Victor Hugo…"/>}
          </div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'140px 1fr',gap:14}}>
            <div>
              <label style={labelSt}>Code postal</label>
              <input style={{...inputSt,background:factType==='identique'?'var(--bg-soft)':'#fff',
                color:factType==='identique'?'var(--muted)':'var(--ink)',cursor:factType==='identique'?'not-allowed':'text'}}
                disabled={factType==='identique'}
                value={factType==='identique'?form.code_postal:factCp}
                onChange={e=>setFactCp(e.target.value)}/>
            </div>
            <div>
              <label style={labelSt}>Commune</label>
              <input style={{...inputSt,background:factType==='identique'?'var(--bg-soft)':'#fff',
                color:factType==='identique'?'var(--muted)':'var(--ink)',cursor:factType==='identique'?'not-allowed':'text'}}
                disabled={factType==='identique'}
                value={factType==='identique'?form.commune:factCommune}
                onChange={e=>setFactCommune(e.target.value)}/>
            </div>
          </div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div><label style={labelSt}>Puissance demandée (kVA) *</label>
              <input style={inputSt} value={form.puissance_demandee} onChange={setF('puissance_demandee')}/></div>
            <div><label style={labelSt}>Type *</label>
              <select style={inputSt} value={form.puissance_type} onChange={setF('puissance_type')}>
                <option value="">— Sélectionner —</option>
                <option value="monophase">Monophasé</option>
                <option value="triphase">Triphasé</option>
              </select></div>
          </div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div>
              <label style={labelSt}>Durée prévisionnelle *</label>
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:8}}>
                <input type="number" min="1" style={inputSt} value={dureeMontant} onChange={e=>setDureeMontant(e.target.value)}/>
                <select style={{...inputSt,padding:'11px 10px'}} value={dureeUnite} onChange={e=>setDureeUnite(e.target.value)}>
                  <option value="jours">Jours</option>
                  <option value="semaines">Semaines</option>
                  <option value="mois">Mois</option>
                  <option value="années">Années</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelSt}>Date de début souhaitée *</label>
              <input type="date" style={inputSt} value={form.date_debut_chantier} onChange={setF('date_debut_chantier')}/>
            </div>
          </div>
        </div>
        <div style={{marginTop:22,display:'flex',justifyContent:'flex-end'}}>
          <Btn variant="dark" iconR="chevR" disabled={!canStep2} onClick={()=>canStep2&&setStep(2)}>Continuer</Btn>
        </div>
      </Card>}

      {step===2&&<Card>
        <SectionTitle icon="file">Documents</SectionTitle>
        <p style={{margin:'0 0 18px',fontSize:14,color:'var(--slate)'}}>Les documents marqués * sont obligatoires.</p>
        <div style={{display:'grid',gap:14}}>
          {Object.entries(CAT_LABELS).map(([cat,lbl])=>{
            const file=docs[cat];
            const req=CAT_REQUIRED.includes(cat);
            return <div key={cat} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',
              background:file?'color-mix(in srgb,var(--c-done) 8%,#fff)':'#fff',
              border:`1px solid ${file?'color-mix(in srgb,var(--c-done) 40%,transparent)':'var(--line)'}`,
              borderRadius:'var(--r-input)'}}>
              <div style={{width:40,height:40,borderRadius:9,background:'var(--bg-soft)',
                display:'grid',placeItems:'center',color:file?'var(--c-done-ink)':'var(--slate)',flex:'0 0 auto'}}>
                <Icon name={file?'check':'file'} size={20}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'var(--font-head)',fontWeight:700,fontSize:14.5,color:'var(--ink)'}}>
                  {lbl}{req&&<span style={{color:'var(--c-blocked)',marginLeft:4}}>*</span>}
                </div>
                <div style={{fontSize:12.5,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {file?file.name
                    :cat==='mandat'?'Généré automatiquement si absent'
                    :'Aucun fichier sélectionné'}
                </div>
              </div>
              <label style={{cursor:'pointer',padding:'8px 14px',border:'1px solid var(--line)',borderRadius:'var(--r-input)',
                fontSize:13,fontFamily:'var(--font-head)',fontWeight:600,color:'var(--ink)',background:'#fff',whiteSpace:'nowrap'}}>
                {file?'Changer':'Choisir'}
                <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png" onChange={setDoc(cat)}/>
              </label>
            </div>;
          })}
        </div>
        <div style={{marginTop:18,borderTop:'1px solid var(--line)',paddingTop:18}}>
          <label style={{...labelSt,marginBottom:10}}>Photos (optionnel)</label>
          {photos.length>0&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            {photos.map((p,i)=><div key={i} style={{position:'relative',width:80,height:80}}>
              <img src={URL.createObjectURL(p)} alt="" className="fb-img"
                style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:8,border:'1px solid var(--line)'}}/>
              <button onClick={()=>removePhoto(i)} style={{position:'absolute',top:-6,right:-6,
                width:20,height:20,borderRadius:999,background:'var(--c-blocked)',color:'#fff',
                border:'none',cursor:'pointer',display:'grid',placeItems:'center',fontSize:11,padding:0}}>×</button>
            </div>)}
          </div>}
          <label style={{cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8,
            padding:'9px 16px',border:'1px dashed var(--line-strong)',borderRadius:'var(--r-input)',
            fontSize:13.5,fontFamily:'var(--font-head)',fontWeight:600,color:'var(--slate)'}}>
            <Icon name="camera" size={17}/>Ajouter des photos
            <input type="file" style={{display:'none'}} accept="image/*" multiple onChange={addPhotos}/>
          </label>
        </div>
        <div style={{marginTop:18,borderTop:'1px solid var(--line)',paddingTop:18}}>
          <label style={labelSt}>Commentaire (optionnel)</label>
          <textarea value={commentaire} onChange={e=>setCommentaire(e.target.value)} rows={3}
            placeholder="Informations importantes pour le chantier…"
            style={{...inputSt,resize:'vertical',lineHeight:1.5,fontSize:14.5}}/>
        </div>
        <div style={{marginTop:22,display:'flex',gap:12,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setStep(1)}>Retour</Btn>
          <Btn variant="dark" iconR="chevR" disabled={!canStep3} onClick={()=>canStep3&&setStep(3)}>Continuer</Btn>
        </div>
      </Card>}

      {step===3&&<Card>
        <SectionTitle icon="check">Récapitulatif</SectionTitle>
        <div style={{display:'grid',gap:10,marginBottom:20}}>
          {[
            ['Client',clients.find(c=>String(c.id)===String(form.client_id))?.nom||'—'],
            ['Référence',form.reference_client||'—'],
            ['Adresse',`${form.adresse}, ${form.commune}${form.code_postal?' '+form.code_postal:''}`],
            ['Adresse facturation',adresseFact],
            ['Puissance',`${form.puissance_demandee} kVA — ${form.puissance_type==='monophase'?'Monophasé':'Triphasé'}`],
            ['Terrain viabilisé',form.terrain_viabilise==='oui'?'Oui':'Non'],
            ['Date de début',form.date_debut_chantier],
            ['Durée',dureeFinal],
          ].map(([k,v])=><div key={k} style={{display:'flex',gap:12,alignItems:'baseline'}}>
            <span style={{fontSize:13,color:'var(--muted)',fontFamily:'var(--font-head)',fontWeight:700,
              minWidth:160,textTransform:'uppercase',letterSpacing:'.05em'}}>{k}</span>
            <span style={{fontSize:15,color:'var(--ink)',fontWeight:600}}>{v}</span>
          </div>)}
        </div>
        <div style={{borderTop:'1px solid var(--line)',paddingTop:16,marginBottom:16}}>
          <div style={{fontSize:13,color:'var(--muted)',fontFamily:'var(--font-head)',fontWeight:700,
            textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Documents</div>
          {Object.entries(CAT_LABELS).map(([cat,lbl])=>{
            const file=docs[cat];
            return <div key={cat} style={{display:'flex',alignItems:'center',gap:9,marginBottom:6}}>
              <Icon name={file?'check':'x'} size={16} style={{color:file?'var(--c-done-ink)':'var(--c-blocked)'}}/>
              <span style={{fontSize:14,color:file?'var(--ink)':'var(--muted)'}}>{lbl}</span>
              {file&&<span style={{fontSize:12,color:'var(--muted)'}}>({file.name})</span>}
            </div>;
          })}
          {photos.length>0&&<div style={{display:'flex',alignItems:'center',gap:9,marginTop:4}}>
            <Icon name="camera" size={16} style={{color:'var(--slate)'}}/>
            <span style={{fontSize:14,color:'var(--ink)'}}>{photos.length} photo(s)</span>
          </div>}
        </div>
        {commentaire.trim()&&<div style={{borderTop:'1px solid var(--line)',paddingTop:16,marginBottom:16}}>
          <div style={{fontSize:13,color:'var(--muted)',fontFamily:'var(--font-head)',fontWeight:700,
            textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>Commentaire</div>
          <p style={{margin:0,fontSize:14.5,color:'var(--ink)',lineHeight:1.55,whiteSpace:'pre-wrap'}}>{commentaire.trim()}</p>
        </div>}
        {/* Mandat EDF prérempli — masqué si un mandat a été fourni à l'étape Documents */}
        {!docs.mandat&&<div style={{borderTop:'1px solid var(--line)',paddingTop:16,marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:220}}>
              <div style={{fontFamily:'var(--font-head)',fontWeight:700,fontSize:14.5,color:'var(--ink)'}}>Mandat EDF</div>
              <div style={{fontSize:13,color:'var(--slate)',lineHeight:1.5}}>
                Téléchargez le mandat prérempli avec les informations du chantier.
              </div>
            </div>
            <Btn variant="ghost" icon="download" loading={mandatLoading} onClick={async()=>{
              setMandatLoading(true);
              try {
                await downloadPdf('/api/admin/chantiers/mandat',{
                  reference: form.reference_client,
                  adresse: [form.adresse, form.code_postal, form.commune].filter(Boolean).join(', '),
                  ville: form.commune,
                }, `Mandat-EDF-${(form.reference_client||'chantier').replace(/[^\w-]+/g,'_')}.pdf`);
              } catch(e){ setErr(e.message); }
              finally{ setMandatLoading(false); }
            }}>Télécharger le mandat (PDF)</Btn>
          </div>
        </div>}
        {err&&<p style={{margin:'0 0 12px',color:'var(--c-blocked)',fontSize:14}}>{err}</p>}
        <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setStep(2)}>Retour</Btn>
          <Btn variant="dark" disabled={loading} onClick={submit}>
            {loading?'Création en cours…':'Créer le chantier'}
          </Btn>
        </div>
      </Card>}
    </main>
    <Footer/>
    {showNouveauClient&&<ModalNouveauClient
      onClose={()=>setShowNouveauClient(false)}
      onCreated={client=>{
        setClients(cs=>[...cs,client]);
        setForm(f=>({...f,client_id:String(client.id)}));
        setShowNouveauClient(false);
      }}/>}
  </div>;
}

// ═════════════════════════════════════════════════════════════
//  LISTE ADMIN
// ═════════════════════════════════════════════════════════════
export function AdminList({ go, openChantier, onLogout, isAdmin }) {
  const [chantiers,setChantiers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [toast,showToast]=useToast();
  const [filtres,setFiltres]=useState({nom:"",client:"",statut:""});
  const [deleting,setDeleting]=useState(null);
  const [archiving,setArchiving]=useState(null);
  const [view,setView]=useState('encours'); // 'encours' | 'archives'

  const reload = () => {
    setLoading(true);
    apiFetch('/api/admin/chantiers'+(view==='archives'?'?archived=1':''))
      .then(setChantiers).catch(console.error).finally(()=>setLoading(false));
  };
  useEffect(()=>{reload();},[view]); // eslint-disable-line react-hooks/exhaustive-deps

  const setF = (k,v) => setFiltres(f=>({...f,[k]:v}));

  const archiveChantier = async (e, c, toArchive) => {
    e.stopPropagation();
    setArchiving(c.id);
    try {
      await apiFetch(`/api/admin/chantiers/${c.id}`,{method:'PUT',body:{archive:toArchive}});
      setChantiers(cs=>cs.filter(x=>x.id!==c.id));
      showToast(toArchive?"Chantier archivé ✓":"Chantier désarchivé ✓");
    } catch(e){showToast(e.message,"error");}
    finally{setArchiving(null);}
  };

  const deleteChantier = async (e, c) => {
    e.stopPropagation();
    if (!confirm(`Supprimer le chantier « ${c.nom} » ? Cette action est irréversible.`)) return;
    setDeleting(c.id);
    try {
      await apiFetch(`/api/admin/chantiers/${c.id}`,{method:'DELETE'});
      setChantiers(cs=>cs.filter(x=>x.id!==c.id));
      showToast("Chantier supprimé ✓");
    } catch(e){showToast(e.message,"error");}
    finally{setDeleting(null);}
  };

  const visible = chantiers.filter(c=>{
    if (filtres.nom && c.reference_client!==filtres.nom) return false;
    if (filtres.client && (c.societe_nom||'—')!==filtres.client) return false;
    if (filtres.statut && (c.etape_courante||'—')!==filtres.statut) return false;
    return true;
  }).sort((a,b)=>{
    // Tri par défaut sur la société (comptes sans société en dernier), puis client.
    const sa=a.societe_nom||'￿', sb=b.societe_nom||'￿';
    return sa.localeCompare(sb,'fr') || (a.client_nom||'').localeCompare(b.client_nom||'','fr');
  });

  if (loading) return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/><div className="fb-spinner"/></div>;

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/>
    <main className="fb-wrap" style={{paddingTop:32,paddingBottom:60}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap",marginBottom:24}}>
        <div>
          <p style={{margin:"0 0 4px",color:"var(--jaune-deep)",fontFamily:"var(--font-head)",fontWeight:700,
            letterSpacing:".08em",fontSize:13,textTransform:"uppercase"}}>Back-office FB ELEC</p>
          <h1 style={{margin:0,fontFamily:"var(--font-display)",fontWeight:700,fontSize:38,
            textTransform:"uppercase",color:"var(--ink)",letterSpacing:"-.01em"}}>Chantiers suivis</h1>
        </div>
        <div className="fb-toolbar">
          <Btn variant="ghost" icon="user" onClick={()=>go("admin-clients")}>Clients</Btn>
          <Btn variant="ghost" icon="briefcase" onClick={()=>go("admin-societes")}>Sociétés</Btn>
          <Btn variant="ghost" icon="settings" onClick={()=>go("admin-etapes")}>Gérer les étapes</Btn>
          <Btn variant="primary" icon="plus" onClick={()=>go("admin-nouveau-chantier")}>Nouveau chantier</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[['encours','En cours'],['archives','Archivés']].map(([v,lbl])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{padding:"8px 16px",borderRadius:999,cursor:"pointer",fontFamily:"var(--font-head)",
              fontWeight:600,fontSize:13.5,border:"1.5px solid "+(view===v?"var(--jaune-deep)":"var(--line-strong)"),
              background:view===v?"var(--jaune)":"#fff",color:"var(--ink)"}}>
            {lbl}
          </button>
        ))}
      </div>
      <Card pad={0} style={{overflow:"visible",position:"relative"}}>
        {/* En-têtes avec filtres intégrés */}
        <div className="fb-ch-head" style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1.3fr 1fr auto",
          gap:12,padding:"10px 16px",background:"var(--bg-soft)",borderBottom:"1px solid var(--line)"}}>
          <ColFilter label="Chantier"
            allValues={chantiers.map(c=>c.reference_client)}
            value={filtres.nom} onChange={v=>setF("nom",v)}/>
          <ColFilter label="Société"
            allValues={chantiers.map(c=>c.societe_nom||'—')}
            value={filtres.client} onChange={v=>setF("client",v)}/>
          <span style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:11.5,textTransform:"uppercase",
            letterSpacing:".05em",color:"var(--muted)"}}>Avancement</span>
          <ColFilter label="Étape"
            allValues={chantiers.map(c=>c.etape_courante||'—')}
            value={filtres.statut} onChange={v=>setF("statut",v)}/>
          <span style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:11.5,textTransform:"uppercase",
            letterSpacing:".05em",color:"var(--muted)"}}>Mise à jour</span>
          <span/>
        </div>
        {/* Lignes — wrapper avec overflow:hidden pour clips coins bas */}
        <div style={{overflow:"hidden",borderRadius:"0 0 var(--r-card) var(--r-card)"}}>
        {visible.map(c=>{
          const st=chantierBadge(c);
          const total=parseInt(c.etapes_total)||0;
          const done=parseInt(c.etapes_done)||0;
          const pct=total>0?Math.round((done/total)*100):0;
          const etapeNum=done<total?done+1:null;
          return <div key={c.id} className="fb-ch-row" style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 1.3fr 1fr auto",
            gap:12,alignItems:"center",padding:"12px 16px",borderBottom:"1px solid var(--line)",
            cursor:"pointer",transition:"background .12s"}}
            onClick={()=>openChantier(c.id)}
            onMouseEnter={e=>e.currentTarget.style.background="var(--bg-soft)"}
            onMouseLeave={e=>e.currentTarget.style.background=""}>
            {/* Chantier */}
            <span>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {c.photo_couverture
                  ?<img src={c.photo_couverture} alt="" className="fb-img"
                      style={{width:40,height:40,borderRadius:8,objectFit:"cover",flex:"0 0 auto"}}/>
                  :<div style={{width:40,height:40,borderRadius:8,background:"var(--bg-soft)",
                      display:"grid",placeItems:"center",flex:"0 0 auto"}}>
                     <Icon name="camera" size={17} style={{color:"var(--muted)"}}/></div>}
                <div style={{minWidth:0}}>
                  {c.reference_client&&<div style={{fontFamily:"var(--font-head)",fontSize:13.5,color:"#000",fontWeight:700,
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.reference_client}</div>}
                  <div style={{fontFamily:"var(--font-head)",fontWeight:500,fontSize:12.5,color:"var(--slate)",
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.nom}</div>
                </div>
              </div>
            </span>
            {/* Société */}
            <span style={{fontSize:13,color:c.societe_nom?"var(--ink)":"var(--muted)",fontWeight:c.societe_nom?600:400,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.societe_nom||"—"}</span>
            {/* Avancement */}
            <span>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{flex:1,height:6,background:"var(--line-strong)",borderRadius:999,overflow:"hidden"}}>
                  <div style={{width:pct+"%",height:"100%",background:"var(--jaune)",borderRadius:999}}/>
                </div>
                <span style={{fontSize:12,fontWeight:600,color:"var(--slate)",whiteSpace:"nowrap"}}>{pct}%</span>
              </div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>{done}/{total} étapes</div>
            </span>
            {/* Étape / Statut */}
            <span>
              {etapeNum&&<div style={{fontSize:11.5,color:"var(--jaune-deep)",fontWeight:700,
                fontFamily:"var(--font-mono)",marginBottom:4}}>Étape {etapeNum}</div>}
              {c.action_requise_titre
                ?<StatusPill kind="action" size="sm">Action requise</StatusPill>
                :<StatusPill kind={st.kind} size="sm">{st.label}</StatusPill>}
            </span>
            {/* Mise à jour */}
            <span style={{fontSize:13,color:"var(--slate)"}}>{c.derniere_maj||"—"}</span>
            {/* Action */}
            <span className="fb-row-actions" style={{display:"flex",gap:6}}>
              <Btn variant="soft" size="sm" iconR="chevR" onClick={e=>{e.stopPropagation();openChantier(c.id);}}>Gérer</Btn>
              <Btn variant="ghost" size="sm" icon="archive" loading={archiving===c.id}
                title={view==='archives'?'Désarchiver':'Archiver'}
                onClick={e=>archiveChantier(e,c,view!=='archives')}></Btn>
              <Btn variant="ghost" size="sm" icon="trash" loading={deleting===c.id}
                onClick={e=>deleteChantier(e,c)}
                style={{color:"var(--c-blocked-ink)"}}></Btn>
            </span>
          </div>;
        })}
        {visible.length===0&&<div style={{padding:"30px 16px",textAlign:"center",color:"var(--muted)"}}>
          {chantiers.length===0
            ?(view==='archives'?"Aucun chantier archivé.":"Aucun chantier pour le moment.")
            :"Aucun résultat pour ces filtres."}
        </div>}
        </div>{/* fin wrapper lignes */}
      </Card>
      {view==='encours'&&chantiers.length===0&&<div style={{marginTop:40,textAlign:"center",color:"var(--muted)"}}>
        <button onClick={()=>go("admin-nouveau-chantier")} style={{background:"none",border:"none",
          color:"var(--jaune-deep)",fontWeight:700,cursor:"pointer",fontSize:15,padding:0}}>
          Créer le premier chantier →
        </button>
      </div>}
    </main>
    <Footer/>
    <Toast message={toast.msg} type={toast.type}/>
  </div>;
}

// ── Fiche admin d'un chantier ─────────────────────────────────
export function AdminChantier({ chantierId, go, onLogout, isAdmin }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [toast,showToast]=useToast();
  const [comment,setComment]=useState("");
  const [uploadEtapeId,setUploadEtapeId]=useState("");
  const fileInputRef=useRef(null);

  const reload=useCallback(()=>{
    apiFetch(`/api/admin/chantiers/${chantierId}`).then(setData).catch(console.error).finally(()=>setLoading(false));
  },[chantierId]);

  useEffect(()=>{reload();},[reload]);

  if (loading||!data) return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/><div className="fb-spinner"/></div>;

  const c=data;

  const setEtapeEtat = async (etapeId, etat) => {
    try {
      await apiFetch(`/api/admin/chantiers/${chantierId}/etapes`,{
        method:'PUT',body:[{etape_id:etapeId,etat}]});
      reload(); showToast("Étape mise à jour — client notifié ✓");
    } catch(e){showToast(e.message,"error");}
  };

  const setEtapeDate = async (etapeId, date) => {
    try {
      await apiFetch(`/api/admin/chantiers/${chantierId}/etapes/${etapeId}`,{
        method:'PUT',body:{date_valeur:date||null}});
      reload(); showToast(date?"Date enregistrée ✓":"Date effacée ✓");
    } catch(e){showToast(e.message,"error");}
  };

  const toggleMasquee = async (etapeId, masquee) => {
    try {
      await apiFetch(`/api/admin/chantiers/${chantierId}/etapes/${etapeId}`,{
        method:'PUT',body:{masquee}});
      reload(); showToast(masquee?"Étape masquée côté client ✓":"Étape visible côté client ✓");
    } catch(e){showToast(e.message,"error");}
  };

  const publishNote = async () => {
    if (!comment.trim()) return;
    try {
      await apiFetch(`/api/admin/chantiers/${chantierId}/notes`,{
        method:'POST',body:{texte:comment,date_affichee:new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}});
      setComment(""); reload(); showToast("Message publié côté client ✓");
    } catch(e){showToast(e.message,"error");}
  };

  const uploadPhotos = async (files) => {
    if (!files.length) return;
    setSaving(true);
    try {
      const form=new FormData();
      for (const f of files) form.append('photos',f);
      if (uploadEtapeId) form.append('etape_id', uploadEtapeId);
      await apiFetch(`/api/admin/chantiers/${chantierId}/photos`,{method:'POST',body:form});
      reload(); showToast(`${files.length} photo(s) ajoutée(s) ✓`);
    } catch(e){showToast(e.message,"error");}
    finally{setSaving(false);}
  };

  const deletePhoto = async (photoId) => {
    try {
      await apiFetch(`/api/admin/photos/${photoId}`,{method:'DELETE'});
      reload(); showToast("Photo supprimée ✓");
    } catch(e){showToast(e.message,"error");}
  };

  const toggleVisible = async (photo) => {
    try {
      await apiFetch(`/api/admin/photos/${photo.id}`,{method:'PUT',body:{visible_client:!photo.visible_client}});
      reload();
    } catch(e){showToast(e.message,"error");}
  };

  const deleteChantier = async () => {
    if (!window.confirm(`Supprimer définitivement le chantier "${c.nom}" ?\n\nToutes les photos, documents et notes seront supprimés. Cette action est irréversible.`)) return;
    try {
      await apiFetch(`/api/admin/chantiers/${chantierId}`,{method:'DELETE'});
      go("admin-list");
    } catch(e){showToast(e.message,"error");}
  };

  const toggleArchive = async () => {
    const toArchive = !c.archive;
    try {
      await apiFetch(`/api/admin/chantiers/${chantierId}`,{method:'PUT',body:{archive:toArchive}});
      reload(); showToast(toArchive?"Chantier archivé ✓":"Chantier désarchivé ✓");
    } catch(e){showToast(e.message,"error");}
  };

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/>
    <div className="fb-wrap" style={{paddingTop:22,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <button onClick={()=>go("admin-list")} style={{display:"inline-flex",alignItems:"center",gap:7,
        background:"none",border:"none",cursor:"pointer",color:"var(--slate)",fontSize:14,
        fontFamily:"var(--font-head)",fontWeight:600,padding:0}}>
        <Icon name="arrowL" size={17}/>Tous les chantiers
      </button>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button onClick={toggleArchive}
          style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 14px",
            background:c.archive?"var(--jaune)":"#fff",border:"1px solid var(--line-strong)",
            borderRadius:8,cursor:"pointer",color:"var(--ink)",
            fontFamily:"var(--font-head)",fontWeight:600,fontSize:13.5}}>
          <Icon name="archive" size={15}/>{c.archive?"Désarchiver":"Archiver"}
        </button>
        <button onClick={deleteChantier}
          style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 14px",
            background:"#fff",border:"1px solid color-mix(in srgb,var(--c-blocked) 40%,transparent)",
            borderRadius:8,cursor:"pointer",color:"var(--c-blocked)",
            fontFamily:"var(--font-head)",fontWeight:600,fontSize:13.5}}>
          <Icon name="trash" size={15}/>Supprimer le chantier
        </button>
      </div>
    </div>

    <div className="fb-wrap" style={{paddingTop:12}}>
      <h1 style={{margin:"0 0 6px",fontFamily:"var(--font-display)",fontWeight:700,fontSize:32,
        textTransform:"uppercase",color:"var(--ink)",lineHeight:1.06}}>{c.nom}</h1>
      <div style={{display:"flex",gap:14,color:"var(--slate)",fontSize:14,flexWrap:"wrap"}}>
        <span style={{fontFamily:"var(--font-mono)"}}>{c.reference}</span>
        <span>{c.adresse}, {c.commune}</span>
        {c.enedis_pdl&&<span>PDL {c.enedis_pdl}</span>}
      </div>
    </div>

    <main className="fb-wrap fb-detail-body" style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",
      gap:24,paddingTop:22,paddingBottom:70,alignItems:"start"}}>

      {/* Colonne gauche : timeline */}
      <div style={{display:"grid",gap:24}}>

        {/* Informations du dossier (saisies à la création) */}
        <Card>
          <SectionTitle icon="info">Informations du dossier</SectionTitle>
          <div className="fb-form2" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"14px 20px"}}>
            {[
              ["Client", c.client_nom],
              ["Référence client", c.reference_client],
              ["Adresse du chantier", [c.adresse, c.code_postal, c.commune].filter(Boolean).join(', ')],
              ["Adresse de facturation", c.adresse_facturation],
              ["Référence facturation", c.reference_facturation],
              ["Téléphone facturation", c.facturation_telephone],
              ["Mail facturation", c.facturation_email],
              ["Puissance demandée", c.puissance_demandee],
              ["Type", c.puissance_type==='monophase'?'Monophasé':c.puissance_type==='triphase'?'Triphasé':null],
              ["Durée prévisionnelle", c.duree_chantier],
              ["Date de début souhaitée", c.date_debut_chantier?.slice(0,10)],
              ["Terrain viabilisé", c.terrain_viabilise===true?"Oui":c.terrain_viabilise===false?"Non":null],
              ["Type de prestation", c.type_prestation],
              ["Commentaire", c.commentaire],
            ].filter(([,v])=>v).map(([k,v])=><div key={k} style={{minWidth:0}}>
              <div style={{fontSize:11.5,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700,marginBottom:3}}>{k}</div>
              <div style={{fontSize:14.5,color:"var(--ink)",fontWeight:500,wordBreak:"break-word"}}>{v}</div>
            </div>)}
          </div>
        </Card>

        {/* Timeline admin — modifiable */}
        <Card>
          <SectionTitle icon="bolt">Avancement — modifier les étapes</SectionTitle>
          <p style={{margin:"0 0 16px",fontSize:13.5,color:"var(--slate)"}}>
            Cliquez sur une étape pour changer son état. Une seule étape peut être "En cours" à la fois.
          </p>
          <div style={{display:"grid",gap:8}}>
            {c.etapes.map(step=>{
              const opts=[
                {val:"done",    label:"Terminée"},
                {val:"current", label:"En cours"},
                {val:"future",  label:"À venir"},
                {val:"blocked", label:"Bloquée"},
                {val:"na",      label:"Non applicable"},
              ];
              return <div key={step.etape_id} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
                padding:"10px 14px",
                background:step.masquee?"var(--bg-soft)":step.etat==="current"?"color-mix(in srgb,var(--jaune) 10%,#fff)":"var(--bg-soft)",
                borderRadius:"var(--r-input)",
                border:"1px solid "+(step.masquee?"var(--line)":step.etat==="current"?"var(--jaune-deep)":"var(--line)"),
                opacity:step.masquee?.55:1}}>
                <span style={{flex:1,fontFamily:"var(--font-head)",fontWeight:step.etat==="current"&&!step.masquee?700:500,
                  fontSize:14,color:"var(--ink)",
                  textDecoration:step.etat==="na"?"line-through":"none",
                  opacity:step.etat==="future"||step.etat==="na"?.65:1}}>
                  {step.label}
                  {step.masquee&&<span style={{marginLeft:7,fontSize:11,fontWeight:600,color:"var(--muted)",
                    background:"var(--line-strong)",borderRadius:4,padding:"1px 5px"}}>masqué</span>}
                </span>
                <select value={step.etat}
                  onChange={e=>setEtapeEtat(step.etape_id,e.target.value)}
                  style={{border:"1px solid var(--line-strong)",borderRadius:7,padding:"5px 8px",
                    fontSize:12.5,fontFamily:"var(--font-body)",color:"var(--ink)",background:"#fff",cursor:"pointer"}}>
                  {opts.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
                <button title={step.masquee?"Afficher au client":"Masquer au client"}
                  onClick={()=>toggleMasquee(step.etape_id,!step.masquee)}
                  style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                    background:step.masquee?"#fff":"var(--bg-soft)",
                    color:step.masquee?"var(--muted)":"var(--slate)",
                    display:"grid",placeItems:"center",flexShrink:0}}>
                  <Icon name={step.masquee?"eyeOff":"eye"} size={15}/>
                </button>
                {step.avec_date&&<div style={{flexBasis:"100%",display:"flex",alignItems:"center",gap:9,flexWrap:"wrap",
                  marginTop:4,paddingTop:8,borderTop:"1px dashed var(--line-strong)"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,color:"var(--slate)",
                    fontFamily:"var(--font-head)",fontWeight:600}}><Icon name="clock" size={14}/>Date communiquée au client</span>
                  <input type="date" value={step.date_valeur||""} onChange={e=>setEtapeDate(step.etape_id,e.target.value)}
                    style={{padding:"6px 9px",border:"1px solid var(--line-strong)",borderRadius:7,fontSize:13,
                      fontFamily:"var(--font-body)",color:"var(--ink)",background:"#fff"}}/>
                </div>}
              </div>;
            })}
          </div>
        </Card>

      </div>

      {/* Colonne droite : documents + photos + statut + note */}
      <div style={{display:"grid",gap:24}}>
        {/* Documents */}
        <AdminDocumentsSection chantierId={chantierId} docs={c.documents} reload={reload} showToast={showToast}/>

        {/* Photos */}
        <Card>
          <SectionTitle icon="camera">Photos du chantier</SectionTitle>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:13,fontWeight:600,color:"var(--ink)",marginBottom:6}}>
              Attribuer les photos à une étape (optionnel)
            </label>
            <select value={uploadEtapeId} onChange={e=>setUploadEtapeId(e.target.value)}
              style={{width:"100%",padding:"9px 12px",border:"1px solid var(--line-strong)",borderRadius:"var(--r-input)",
                fontSize:13.5,fontFamily:"var(--font-body)",color:"var(--ink)",background:"#fff"}}>
              <option value="">— Aucune étape —</option>
              {c.etapes.filter(e=>e.etat!=="na").map(e=><option key={e.etape_id} value={e.etape_id}>{e.label}</option>)}
            </select>
          </div>
          <div
            onClick={()=>fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault();}}
            onDrop={e=>{e.preventDefault();uploadPhotos([...e.dataTransfer.files]);}}
            style={{border:"2px dashed var(--line-strong)",background:"var(--bg-soft)",borderRadius:"var(--r-card)",
              padding:"30px 20px",textAlign:"center",cursor:"pointer",marginBottom:18,transition:"all .15s"}}>
            <div style={{display:"inline-grid",placeItems:"center",width:52,height:52,borderRadius:999,
              background:"var(--jaune)",color:"#1a1a1a",marginBottom:12}}><Icon name="upload" size={26}/></div>
            <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:16,color:"var(--ink)"}}>
              {saving?"Upload en cours…":"Glissez vos photos ici"}
            </div>
            <div style={{fontSize:13.5,color:"var(--slate)",marginTop:4}}>
              iPhone, Android, ordinateur — JPG, PNG, HEIC · max 20 Mo
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
              capture="environment" onChange={e=>uploadPhotos([...e.target.files])}/>
          </div>
          <div style={{display:"grid",gap:12}}>
            {c.photos.map(p=><div key={p.id} style={{display:"flex",gap:13,alignItems:"center",
              padding:11,border:"1px solid var(--line)",borderRadius:"var(--r-input)",background:"#fff"}}>
              <img src={p.url} alt="" className="fb-img"
                style={{width:64,height:64,borderRadius:8,objectFit:"cover",flex:"0 0 auto"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"var(--ink)",fontWeight:600,marginBottom:4}}>{p.legende||p.nom_fichier||"Sans légende"}</div>
                <div style={{fontSize:12,color:"var(--muted)"}}>
                  {p.etape_label||"Étape non définie"}{p.date_photo?" · "+p.date_photo:""}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7,alignItems:"center"}}>
                <button title="Télécharger" onClick={()=>downloadFile(p.url, p.nom_fichier||undefined)}
                  style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                    background:"#fff",color:"var(--slate)",display:"grid",placeItems:"center"}}>
                  <Icon name="download" size={16}/>
                </button>
                <button title={p.visible_client?"Visible client":"Masqué"} onClick={()=>toggleVisible(p)}
                  style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                    background:p.visible_client?"var(--jaune)":"#fff",color:p.visible_client?"#1a1a1a":"var(--muted)",
                    display:"grid",placeItems:"center"}}>
                  <Icon name={p.visible_client?"eye":"eyeOff"} size={16}/>
                </button>
                <button title="Supprimer" onClick={()=>deletePhoto(p.id)}
                  style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                    background:"#fff",color:"var(--c-blocked)",display:"grid",placeItems:"center"}}>
                  <Icon name="trash" size={16}/>
                </button>
              </div>
            </div>)}
          </div>
        </Card>

        {/* Message au client */}
        <Card>
          <SectionTitle icon="mail">Message au client</SectionTitle>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4}
            placeholder="ex. Le coffret est prêt, nous attendons la validation Enedis."
            style={{width:"100%",border:"1.5px solid var(--line-strong)",borderRadius:"var(--r-input)",
              padding:"12px 14px",fontSize:14.5,color:"var(--ink)",resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
          <div style={{marginTop:12}}>
            <Btn variant="primary" full icon="check" onClick={publishNote}>Publier côté client</Btn>
          </div>
          {c.notes.length>0&&<div style={{marginTop:18}}>
            <Notes notes={c.notes.slice(0,5)}/>
          </div>}
        </Card>
      </div>
    </main>
    <Footer/>
    <Toast message={toast.msg} type={toast.type}/>
  </div>;
}

// ── Modale d'édition d'une étape du référentiel ──────────────
function ModalEditEtape({ etape, onClose, onSaved }) {
  const [form,setForm]=useState({label:etape.label||"",sous_texte:etape.sous_texte||"",avec_date:!!etape.avec_date});
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  const submit = async e => {
    e.preventDefault();
    if (!form.label.trim()){setErr("Libellé requis.");return;}
    setLoading(true);setErr("");
    try {
      await apiFetch(`/api/admin/etapes/${etape.id}`,{method:'PUT',body:{
        label:form.label.trim(), sous_texte:form.sous_texte, avec_date:form.avec_date,
      }});
      onSaved();
    } catch(e){setErr(e.message);}
    finally{setLoading(false);}
  };

  return <Modal title={`Modifier — ${etape.label}`} onClose={onClose}>
    <form onSubmit={submit} style={{display:"grid",gap:16}}>
      <Field label="Libellé *" value={form.label} onChange={v=>setForm(f=>({...f,label:v}))} placeholder="ex. Validation préfecture"/>
      <Field label="Sous-texte (facultatif)" value={form.sous_texte} onChange={v=>setForm(f=>({...f,sous_texte:v}))} placeholder="Description"/>
      <label style={{display:"flex",alignItems:"center",gap:9,fontSize:14,color:"var(--ink)",cursor:"pointer"}}>
        <input type="checkbox" checked={form.avec_date} onChange={e=>setForm(f=>({...f,avec_date:e.target.checked}))}/>
        Comporte une date (saisie par chantier, visible du client)
      </label>
      {err&&<div style={{color:"var(--c-blocked-ink)",fontSize:14,display:"flex",gap:8,alignItems:"center"}}>
        <Icon name="alert" size={16}/>{err}</div>}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" type="submit" loading={loading} icon="check">Enregistrer</Btn>
      </div>
    </form>
  </Modal>;
}

// ── Gestion des étapes (admin) ────────────────────────────────
export function AdminEtapes({ go, onLogout, isAdmin }) {
  const [etapes,setEtapes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [toast,showToast]=useToast();
  const [form,setForm]=useState({label:"",sous_texte:"",avec_date:false});
  const [editing,setEditing]=useState(null);
  const [dragIdx,setDragIdx]=useState(null);

  const reload=()=>apiFetch('/api/admin/etapes').then(setEtapes).catch(console.error).finally(()=>setLoading(false));
  useEffect(()=>{reload();},[]);

  const add = async () => {
    if (!form.label) return showToast("Libellé requis","error");
    try {
      await apiFetch('/api/admin/etapes',{method:'POST',body:form});
      setForm({label:"",sous_texte:"",avec_date:false});
      reload(); showToast("Étape ajoutée en fin de liste ✓");
    } catch(e){showToast(e.message,"error");}
  };

  // Déplace l'étape d'index `from` vers `to`, puis persiste l'ordre complet.
  const move = async (from, to) => {
    if (to<0||to>=etapes.length||from===to) return;
    const list=[...etapes];
    const [item]=list.splice(from,1);
    list.splice(to,0,item);
    setEtapes(list); // optimiste
    try {
      await apiFetch('/api/admin/etapes/reorder',{method:'PUT',
        body:list.map((e,i)=>({id:e.id,ordre:(i+1)*10}))});
      showToast("Ordre enregistré ✓");
    } catch(e){showToast(e.message,"error");}
    finally{reload();}
  };

  const toggle = async (etape) => {
    try {
      await apiFetch(`/api/admin/etapes/${etape.id}`,{method:'PUT',body:{actif:!etape.actif}});
      reload();
    } catch(e){showToast(e.message,"error");}
  };

  const del = async (etape) => {
    if (!window.confirm(`Supprimer définitivement l'étape « ${etape.label} » ?\n\nElle sera retirée de tous les chantiers (l'avancement sera recalculé). Pour la masquer sans la supprimer, utilisez plutôt l'œil.`)) return;
    try {
      await apiFetch(`/api/admin/etapes/${etape.id}`,{method:'DELETE'});
      reload(); showToast("Étape supprimée ✓");
    } catch(e){showToast(e.message,"error");}
  };

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/>
    <main className="fb-wrap" style={{paddingTop:32,paddingBottom:60}}>
      <div style={{marginBottom:28}}>
        <button onClick={()=>go("admin-list")} style={{display:"inline-flex",alignItems:"center",gap:7,
          background:"none",border:"none",cursor:"pointer",color:"var(--slate)",fontSize:14,
          fontFamily:"var(--font-head)",fontWeight:600,padding:0}}>
          <Icon name="arrowL" size={17}/>Retour
        </button>
        <h1 style={{margin:"12px 0 4px",fontFamily:"var(--font-display)",fontWeight:700,fontSize:36,
          textTransform:"uppercase",color:"var(--ink)"}}>Référentiel des étapes</h1>
        <p style={{margin:0,color:"var(--slate)",fontSize:15}}>
          Ces étapes composent la timeline de tous les chantiers. Modifiable à tout moment.
        </p>
      </div>

      <div className="fb-etapes-grid" style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:24,alignItems:"start"}}>
        <Card>
          {loading?<div className="fb-spinner"/>:
          <div style={{display:"grid",gap:10}}>
            {etapes.map((e,i)=><div key={e.id} draggable
              onDragStart={()=>setDragIdx(i)}
              onDragOver={ev=>ev.preventDefault()}
              onDrop={()=>{ if(dragIdx!==null) move(dragIdx,i); setDragIdx(null); }}
              onDragEnd={()=>setDragIdx(null)}
              style={{display:"flex",alignItems:"center",gap:10,
              padding:"12px 14px",border:"1px solid "+(dragIdx===i?"var(--jaune-deep)":"var(--line)"),
              borderRadius:"var(--r-input)",cursor:"grab",
              background:e.actif?"#fff":"var(--bg-soft)",opacity:e.actif?1:.6}}>
              <span title="Glisser pour réordonner" style={{color:"var(--muted)",display:"flex",flex:"0 0 auto",cursor:"grab"}}>
                <Icon name="grip" size={17}/>
              </span>
              <div style={{display:"flex",flexDirection:"column",gap:2,flex:"0 0 auto"}}>
                <button onClick={()=>move(i,i-1)} disabled={i===0} title="Monter"
                  style={{width:24,height:20,border:"1px solid var(--line-strong)",borderRadius:5,background:"#fff",
                    cursor:i===0?"default":"pointer",opacity:i===0?.35:1,display:"grid",placeItems:"center",padding:0,color:"var(--slate)"}}>
                  <Icon name="chevD" size={12} style={{transform:"rotate(180deg)"}}/>
                </button>
                <button onClick={()=>move(i,i+1)} disabled={i===etapes.length-1} title="Descendre"
                  style={{width:24,height:20,border:"1px solid var(--line-strong)",borderRadius:5,background:"#fff",
                    cursor:i===etapes.length-1?"default":"pointer",opacity:i===etapes.length-1?.35:1,display:"grid",placeItems:"center",padding:0,color:"var(--slate)"}}>
                  <Icon name="chevD" size={12}/>
                </button>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontWeight:600,fontSize:14.5,color:"var(--ink)",
                    textDecoration:e.actif?"none":"line-through"}}>{e.label}</span>
                  {e.avec_date&&<span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,
                    color:"var(--jaune-deep)",background:"color-mix(in srgb,var(--jaune) 18%,#fff)",padding:"2px 8px",borderRadius:999}}>
                    <Icon name="clock" size={12}/>date</span>}
                </div>
                {e.sous_texte&&<div style={{fontSize:12.5,color:"var(--muted)",marginTop:2}}>{e.sous_texte}</div>}
              </div>
              <div style={{display:"flex",gap:6,flex:"0 0 auto"}}>
                <button onClick={()=>setEditing(e)} title="Modifier"
                  style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                    background:"#fff",color:"var(--slate)",display:"grid",placeItems:"center"}}>
                  <Icon name="edit" size={16}/>
                </button>
                <button onClick={()=>toggle(e)} title={e.actif?"Désactiver (masquer)":"Activer"}
                  style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                    background:e.actif?"var(--jaune)":"#fff",color:e.actif?"#1a1a1a":"var(--muted)",
                    display:"grid",placeItems:"center"}}>
                  <Icon name={e.actif?"eye":"eyeOff"} size={16}/>
                </button>
                <button onClick={()=>del(e)} title="Supprimer définitivement"
                  style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                    background:"#fff",color:"var(--c-blocked)",display:"grid",placeItems:"center"}}>
                  <Icon name="trash" size={16}/>
                </button>
              </div>
            </div>)}
          </div>}
        </Card>

        <Card>
          <SectionTitle icon="plus">Ajouter une étape</SectionTitle>
          <div style={{display:"grid",gap:14}}>
            <Field label="Libellé" value={form.label} onChange={v=>setForm(f=>({...f,label:v}))} placeholder="ex. Validation préfecture"/>
            <Field label="Sous-texte (facultatif)" value={form.sous_texte} onChange={v=>setForm(f=>({...f,sous_texte:v}))} placeholder="Description technique"/>
            <label style={{display:"flex",alignItems:"center",gap:9,fontSize:14,color:"var(--ink)",cursor:"pointer"}}>
              <input type="checkbox" checked={form.avec_date} onChange={e=>setForm(f=>({...f,avec_date:e.target.checked}))}/>
              Comporte une date (saisie par chantier, visible du client)
            </label>
            <p style={{margin:0,fontSize:12.5,color:"var(--muted)"}}>
              L'étape est ajoutée en fin de liste — glissez-la ensuite à sa place (ou utilisez les flèches).
            </p>
            <Btn variant="primary" full icon="plus" onClick={add}>Ajouter</Btn>
          </div>
        </Card>
      </div>
    </main>
    {editing&&<ModalEditEtape etape={editing}
      onClose={()=>setEditing(null)}
      onSaved={()=>{ setEditing(null); reload(); showToast("Étape modifiée ✓"); }}/>}
    <Footer/>
    <Toast message={toast.msg} type={toast.type}/>
  </div>;
}

// ═════════════════════════════════════════════════════════════
//  ADMIN — GESTION DES CLIENTS
// ═════════════════════════════════════════════════════════════
function ModalEditClient({ client, onClose, onSaved }) {
  const [form,setForm]=useState({nom:client.nom||"",email:client.email||"",telephone:client.telephone||"",pdl:client.pdl||"",
    societe_id:client.societe_id?String(client.societe_id):"",role_societe:client.role_societe||"basic"});
  const [societes,setSocietes]=useState([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  useEffect(()=>{ apiFetch('/api/admin/societes').then(setSocietes).catch(()=>{}); },[]);

  const submit = async e => {
    e.preventDefault();
    if (!form.nom||!form.email){setErr("Nom et e-mail requis.");return;}
    setLoading(true);setErr("");
    try {
      const data = await apiFetch(`/api/admin/clients/${client.id}`,{method:'PUT',body:{
        ...form, societe_id: form.societe_id||null,
      }});
      onSaved(data);
    } catch(e){setErr(e.message);}
    finally{setLoading(false);}
  };

  return <Modal title={`Modifier — ${client.nom}`} onClose={onClose}>
    <form onSubmit={submit} style={{display:"grid",gap:16}}>
      <Field label="Nom *" value={form.nom} onChange={v=>setForm(f=>({...f,nom:v}))} placeholder="Nom du client"/>
      <Field label="E-mail *" icon="mail" type="email" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="client@exemple.fr"/>
      <Field label="Téléphone" icon="phone" value={form.telephone} onChange={v=>setForm(f=>({...f,telephone:v}))} placeholder="06 XX XX XX XX"/>
      <Field label="N° PDL" value={form.pdl} onChange={v=>setForm(f=>({...f,pdl:v}))} placeholder="Optionnel"/>
      <div className="fb-form2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div>
          <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>Société (optionnel)</span>
          <select value={form.societe_id} onChange={e=>setForm(f=>({...f,societe_id:e.target.value}))}
            style={{width:"100%",height:50,padding:"0 12px",border:"1.5px solid var(--line-strong)",
              borderRadius:"var(--r-input)",fontSize:15,fontFamily:"var(--font-body)",background:"#fff"}}>
            <option value="">— Aucune —</option>
            {societes.map(s=><option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
        {form.societe_id&&<div>
          <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>Rôle dans la société</span>
          <select value={form.role_societe} onChange={e=>setForm(f=>({...f,role_societe:e.target.value}))}
            style={{width:"100%",height:50,padding:"0 12px",border:"1.5px solid var(--line-strong)",
              borderRadius:"var(--r-input)",fontSize:15,fontFamily:"var(--font-body)",background:"#fff"}}>
            <option value="basic">Basic — voit ses chantiers</option>
            <option value="admin">Admin — voit toute la société</option>
          </select>
        </div>}
      </div>
      {err&&<div style={{color:"var(--c-blocked-ink)",fontSize:14,display:"flex",gap:8,alignItems:"center"}}>
        <Icon name="alert" size={16}/>{err}</div>}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8}}>
        <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
        <Btn variant="primary" type="submit" loading={loading} icon="check">Enregistrer</Btn>
      </div>
    </form>
  </Modal>;
}

// ═════════════════════════════════════════════════════════════
//  ADMIN — GESTION DES SOCIÉTÉS
// ═════════════════════════════════════════════════════════════
export function AdminSocietes({ go, onLogout, isAdmin }) {
  const [societes,setSocietes]=useState([]);
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [toast,showToast]=useToast();
  const [nom,setNom]=useState("");
  const [creating,setCreating]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [editNom,setEditNom]=useState("");
  const [managing,setManaging]=useState(null); // société dont on gère les utilisateurs

  const reload=()=>Promise.all([
    apiFetch('/api/admin/societes').then(setSocietes),
    apiFetch('/api/admin/clients').then(setClients),
  ]).catch(console.error).finally(()=>setLoading(false));
  useEffect(()=>{reload();},[]);

  const create=async e=>{
    e.preventDefault();
    if(!nom.trim())return;
    setCreating(true);
    try {
      await apiFetch('/api/admin/societes',{method:'POST',body:{nom:nom.trim()}});
      setNom(""); reload(); showToast("Société créée ✓");
    } catch(e){showToast(e.message,"error");}
    finally{setCreating(false);}
  };

  const rename=async s=>{
    if(!editNom.trim()||editNom.trim()===s.nom){setEditingId(null);return;}
    try {
      await apiFetch(`/api/admin/societes/${s.id}`,{method:'PUT',body:{nom:editNom.trim()}});
      setEditingId(null); reload(); showToast("Société renommée ✓");
    } catch(e){showToast(e.message,"error");}
  };

  const del=async s=>{
    const nb=clients.filter(c=>c.societe_id===s.id).length;
    if(!confirm(`Supprimer la société « ${s.nom} » ?\n\nLes ${nb} compte(s) rattaché(s) resteront actifs mais sans société.`))return;
    try {
      await apiFetch(`/api/admin/societes/${s.id}`,{method:'DELETE'});
      reload(); showToast("Société supprimée ✓");
    } catch(e){showToast(e.message,"error");}
  };

  const setRole=async (client,role)=>{
    try {
      await apiFetch(`/api/admin/clients/${client.id}`,{method:'PUT',body:{role_societe:role}});
      reload(); showToast(role==='admin'
        ?`${client.nom} est admin — il voit tous les chantiers de la société ✓`
        :`${client.nom} est basic — il ne voit que ses chantiers ✓`);
    } catch(e){showToast(e.message,"error");}
  };

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/>
    <main className="fb-wrap" style={{paddingTop:32,paddingBottom:60}}>
      <div style={{marginBottom:28}}>
        <button onClick={()=>go("admin-list")} style={{display:"inline-flex",alignItems:"center",gap:7,
          background:"none",border:"none",cursor:"pointer",color:"var(--slate)",fontSize:14,
          fontFamily:"var(--font-head)",fontWeight:600,padding:0}}>
          <Icon name="arrowL" size={17}/>Retour
        </button>
        <h1 style={{margin:"12px 0 4px",fontFamily:"var(--font-display)",fontWeight:700,fontSize:36,
          textTransform:"uppercase",color:"var(--ink)"}}>Sociétés</h1>
        <p style={{margin:0,color:"var(--slate)",fontSize:15}}>
          Regroupez vos comptes clients par société. Un compte « Admin » voit tous les chantiers de sa société.
        </p>
      </div>

      <div className="fb-etapes-grid" style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:24,alignItems:"start"}}>
        <div style={{display:"grid",gap:16}}>
          {loading&&<div className="fb-spinner"/>}
          {!loading&&societes.length===0&&<Card>
            <p style={{color:"var(--muted)",fontSize:14.5,margin:0}}>Aucune société pour le moment — créez-en une ci-contre.</p>
          </Card>}
          {societes.map(s=>{
            const membres=clients.filter(c=>c.societe_id===s.id);
            return <Card key={s.id} pad={0}>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 18px"}}>
                {editingId===s.id
                  ? <form onSubmit={e=>{e.preventDefault();rename(s);}} style={{flex:1,display:"flex",gap:8,minWidth:0}}>
                      <input autoFocus value={editNom} onChange={e=>setEditNom(e.target.value)}
                        style={{flex:1,minWidth:0,padding:"8px 11px",border:"1.5px solid var(--jaune-deep)",
                          borderRadius:8,fontSize:14.5,fontFamily:"var(--font-body)",outline:"none"}}/>
                      <Btn variant="primary" size="sm" type="submit" icon="check">OK</Btn>
                      <Btn variant="ghost" size="sm" onClick={()=>setEditingId(null)}>Annuler</Btn>
                    </form>
                  : <>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:16,color:"var(--ink)"}}>{s.nom}</div>
                        <div style={{fontSize:12.5,color:"var(--muted)"}}>{membres.length} compte(s) rattaché(s)</div>
                      </div>
                      <button title="Gérer les utilisateurs" onClick={()=>setManaging(s)}
                        style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                          background:"#fff",color:"var(--slate)",display:"grid",placeItems:"center",flex:"0 0 auto"}}>
                        <Icon name="user" size={16}/>
                      </button>
                      <button title="Renommer" onClick={()=>{setEditingId(s.id);setEditNom(s.nom);}}
                        style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                          background:"#fff",color:"var(--slate)",display:"grid",placeItems:"center",flex:"0 0 auto"}}>
                        <Icon name="edit" size={16}/>
                      </button>
                      <button title="Supprimer" onClick={()=>del(s)}
                        style={{width:34,height:34,borderRadius:8,border:"1px solid var(--line-strong)",cursor:"pointer",
                          background:"#fff",color:"var(--c-blocked)",display:"grid",placeItems:"center",flex:"0 0 auto"}}>
                        <Icon name="trash" size={16}/>
                      </button>
                    </>}
              </div>
            </Card>;
          })}
        </div>

        <Card>
          <SectionTitle icon="plus">Créer une société</SectionTitle>
          <form onSubmit={create} style={{display:"grid",gap:14}}>
            <Field label="Nom de la société" value={nom} onChange={setNom} placeholder="ex. Bâti Ouest"/>
            <Btn variant="primary" full icon="plus" type="submit" loading={creating}>Créer</Btn>
          </form>
          <p style={{margin:"14px 0 0",fontSize:12.5,color:"var(--muted)",lineHeight:1.5}}>
            Le rattachement d'un compte à une société se fait depuis la page Clients
            (créer ou modifier un client).
          </p>
        </Card>
      </div>
    </main>
    {managing&&(()=>{
      const membres=clients.filter(c=>c.societe_id===managing.id);
      return <Modal title={`Utilisateurs — ${managing.nom}`} onClose={()=>setManaging(null)}>
        {membres.length===0&&<p style={{color:"var(--muted)",fontSize:14,margin:0}}>
          Aucun compte rattaché. Le rattachement se fait depuis la page Clients (créer ou modifier un client).
        </p>}
        <div style={{display:"grid",gap:10}}>
          {membres.map(m=><div key={m.id}
            style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:10,alignItems:"center",
              padding:"10px 13px",border:"1px solid var(--line)",borderRadius:"var(--r-input)"}}>
            <div style={{minWidth:0}}>
              <div style={{fontFamily:"var(--font-head)",fontWeight:600,fontSize:14,color:"var(--ink)",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.nom}</div>
              <div style={{fontSize:12,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email}</div>
            </div>
            <select value={m.role_societe||'basic'} onChange={e=>setRole(m,e.target.value)}
              style={{padding:"7px 10px",border:"1px solid var(--line-strong)",borderRadius:8,
                fontSize:13,fontFamily:"var(--font-body)",color:"var(--ink)",background:"#fff",cursor:"pointer",maxWidth:180}}>
              <option value="basic">Basic — ses chantiers</option>
              <option value="admin">Admin — toute la société</option>
            </select>
          </div>)}
        </div>
      </Modal>;
    })()}
    <Footer/>
    <Toast message={toast.msg} type={toast.type}/>
  </div>;
}

export function AdminClients({ go, onLogout, isAdmin }) {
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [toast,showToast]=useToast();
  const [resetting,setResetting]=useState(null);
  const [deleting,setDeleting]=useState(null);
  const [showNew,setShowNew]=useState(false);
  const [editing,setEditing]=useState(null);
  const [search,setSearch]=useState("");
  const [filtreSociete,setFiltreSociete]=useState("");
  const [filtreRole,setFiltreRole]=useState("");
  const [filtresCol,setFiltresCol]=useState({client:"",email:"",societe:"",chantiers:""});
  const setFC=(k,v)=>setFiltresCol(f=>({...f,[k]:v}));

  const reload = () => apiFetch('/api/admin/clients').then(setClients).catch(console.error).finally(()=>setLoading(false));
  useEffect(()=>{reload();},[]);

  const resetPassword = async (client) => {
    if (!confirm(`Réinitialiser le mot de passe de ${client.nom} ? Un nouveau mot de passe provisoire sera envoyé par email.`)) return;
    setResetting(client.id);
    try {
      await apiFetch(`/api/admin/clients/${client.id}/reset-code`,{method:'POST'});
      showToast(`Nouveau mot de passe envoyé à ${client.email} ✓`);
    } catch(e){showToast(e.message,"error");}
    finally{setResetting(null);}
  };

  const deleteClient = async (c) => {
    const msg = c.nb_chantiers>0
      ? `Supprimer ${c.nom} et ses ${c.nb_chantiers} chantier(s) ? Cette action est irréversible.`
      : `Supprimer le client ${c.nom} ? Cette action est irréversible.`;
    if (!confirm(msg)) return;
    setDeleting(c.id);
    try {
      await apiFetch(`/api/admin/clients/${c.id}`,{method:'DELETE'});
      setClients(cs=>cs.filter(x=>x.id!==c.id));
      showToast("Client supprimé ✓");
    } catch(e){showToast(e.message,"error");}
    finally{setDeleting(null);}
  };

  // Sociétés présentes (pour le filtre) + liste filtrée/triée par société.
  const societesUniq = [...new Map(clients.filter(c=>c.societe_id).map(c=>[c.societe_id,{id:c.societe_id,nom:c.societe_nom}])).values()]
    .sort((a,b)=>(a.nom||'').localeCompare(b.nom||'','fr'));
  const q = search.trim().toLowerCase();
  const visible = clients.filter(c=>{
    if (filtreSociete==='none' && c.societe_id) return false;
    if (filtreSociete && filtreSociete!=='none' && String(c.societe_id)!==String(filtreSociete)) return false;
    if (filtreRole && (c.role_societe||'basic')!==filtreRole) return false;
    if (filtresCol.client && c.nom!==filtresCol.client) return false;
    if (filtresCol.email && c.email!==filtresCol.email) return false;
    if (filtresCol.societe && (c.societe_nom||'—')!==filtresCol.societe) return false;
    if (filtresCol.chantiers && String(c.nb_chantiers)!==filtresCol.chantiers) return false;
    if (q) {
      const hay=[c.nom,c.email,c.telephone,c.societe_nom].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a,b)=>{
    const sa=a.societe_nom||'￿', sb=b.societe_nom||'￿';
    return sa.localeCompare(sb,'fr') || (a.nom||'').localeCompare(b.nom||'','fr');
  });
  const filStyle={height:44,padding:"0 12px",border:"1.5px solid var(--line-strong)",borderRadius:"var(--r-input)",
    fontSize:14.5,fontFamily:"var(--font-body)",background:"#fff",color:"var(--ink)",cursor:"pointer",flex:"1 1 160px",minWidth:0};

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin isAdmin={isAdmin} onLogout={onLogout}/>
    <main className="fb-wrap" style={{paddingTop:32,paddingBottom:60}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap",marginBottom:24}}>
        <div>
          <button onClick={()=>go("admin-list")} style={{display:"inline-flex",alignItems:"center",gap:7,
            background:"none",border:"none",cursor:"pointer",color:"var(--slate)",fontSize:14,
            fontFamily:"var(--font-head)",fontWeight:600,padding:0,marginBottom:14}}>
            <Icon name="arrowL" size={17}/>Retour
          </button>
          <h1 style={{margin:0,fontFamily:"var(--font-display)",fontWeight:700,fontSize:36,
            textTransform:"uppercase",color:"var(--ink)"}}>Gestion des clients</h1>
        </div>
        <Btn variant="primary" icon="plus" onClick={()=>setShowNew(true)}>Nouveau client</Btn>
      </div>

      {/* Recherche + filtres */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:"2 1 240px",minWidth:0}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",pointerEvents:"none",display:"flex"}}>
            <Icon name="search" size={17}/>
          </span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher (nom, e-mail, société…)"
            style={{width:"100%",boxSizing:"border-box",height:44,paddingLeft:38,paddingRight:14,
              border:"1.5px solid var(--line-strong)",borderRadius:"var(--r-input)",fontSize:14.5,
              fontFamily:"var(--font-body)",outline:"none",background:"#fff",color:"var(--ink)"}}/>
        </div>
        <select value={filtreSociete} onChange={e=>setFiltreSociete(e.target.value)} style={filStyle}>
          <option value="">Toutes les sociétés</option>
          <option value="none">Sans société</option>
          {societesUniq.map(s=><option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
        <select value={filtreRole} onChange={e=>setFiltreRole(e.target.value)} style={filStyle}>
          <option value="">Tous les rôles</option>
          <option value="admin">Admin société</option>
          <option value="basic">Basic</option>
        </select>
      </div>

      {loading ? <div className="fb-spinner"/> :
      <Card pad={0} style={{overflow:"visible",position:"relative"}}>
        <div className="fb-clients-head" style={{background:"var(--bg-soft)",padding:"12px 20px",borderBottom:"1px solid var(--line)",
          borderRadius:"var(--r-card) var(--r-card) 0 0",
          display:"grid",gridTemplateColumns:"1.2fr 1.2fr 1.2fr .8fr auto",gap:16,alignItems:"center"}}>
          <ColFilter label="Client"
            allValues={clients.map(c=>c.nom)}
            value={filtresCol.client} onChange={v=>setFC("client",v)}/>
          <ColFilter label="E-mail"
            allValues={clients.map(c=>c.email)}
            value={filtresCol.email} onChange={v=>setFC("email",v)}/>
          <ColFilter label="Société"
            allValues={clients.map(c=>c.societe_nom||'—')}
            value={filtresCol.societe} onChange={v=>setFC("societe",v)}/>
          <ColFilter label="Chantiers"
            allValues={clients.map(c=>String(c.nb_chantiers))}
            value={filtresCol.chantiers} onChange={v=>setFC("chantiers",v)}/>
          <span/>
        </div>
        <div style={{overflow:"hidden",borderRadius:"0 0 var(--r-card) var(--r-card)"}}>
        {visible.map(c=><div key={c.id} className="fb-clients-row" style={{display:"grid",gridTemplateColumns:"1.2fr 1.2fr 1.2fr .8fr auto",
          gap:16,alignItems:"center",padding:"14px 20px",borderBottom:"1px solid var(--line)"}}>
          <div style={{minWidth:0}}>
            <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:14.5,color:"var(--ink)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nom}</div>
            {c.telephone&&<div style={{fontSize:12.5,color:"var(--muted)"}}>{c.telephone}</div>}
          </div>
          <div style={{fontSize:13.5,color:"var(--slate)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{c.email}</div>
          <div style={{minWidth:0}}>
            {c.societe_nom
              ? <><div style={{fontSize:13.5,color:"var(--ink)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.societe_nom}</div>
                  {c.role_societe==='admin'&&<div style={{fontSize:11.5,color:"var(--jaune-deep)",fontWeight:700}}>Admin société</div>}</>
              : <span style={{fontSize:13.5,color:"var(--muted)"}}>—</span>}
          </div>
          <div style={{fontSize:13.5,color:"var(--slate)"}}>{c.nb_chantiers} chantier(s)</div>
          <div className="fb-row-actions" style={{display:"flex",gap:8}}>
            <Btn variant="soft" size="sm" icon="edit" onClick={()=>setEditing(c)}>Modifier</Btn>
            <Btn variant="ghost" size="sm" icon="lock" loading={resetting===c.id}
              onClick={()=>resetPassword(c)}>Réinit. MDP</Btn>
            <Btn variant="ghost" size="sm" icon="trash" loading={deleting===c.id}
              onClick={()=>deleteClient(c)}
              style={{color:"var(--c-blocked-ink)"}}></Btn>
          </div>
        </div>)}
        {visible.length===0&&<div style={{padding:40,textAlign:"center",color:"var(--muted)"}}>
          {clients.length===0?"Aucun client pour le moment.":"Aucun résultat pour cette recherche."}
        </div>}
        </div>{/* fin wrapper lignes */}
      </Card>}
    </main>
    <Footer/>
    <Toast message={toast.msg} type={toast.type}/>
    {showNew&&<ModalNouveauClient
      onClose={()=>setShowNew(false)}
      onCreated={c=>{setClients(cs=>[...cs,c]);showToast("Client créé ✓");setShowNew(false);reload();}}/>}
    {editing&&<ModalEditClient
      client={editing}
      onClose={()=>setEditing(null)}
      onSaved={updated=>{
        setClients(cs=>cs.map(c=>c.id===updated.id?{...c,...updated}:c));
        showToast("Client mis à jour ✓");
        setEditing(null);
      }}/>}
  </div>;
}

// ── Vue "côté client" pour les admins ────────────────────────
export function AdminVueClient({ go, openVueChantier, onLogout, isAdmin }) {
  const [chantiers,setChantiers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");

  useEffect(()=>{
    apiFetch('/api/admin/vue-client/chantiers').then(setChantiers).catch(console.error).finally(()=>setLoading(false));
  },[]);

  if (loading) return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/><div className="fb-spinner"/></div>;

  const q=search.trim().toLowerCase();
  const filtered=q
    ?chantiers.filter(c=>c.nom.toLowerCase().includes(q)||c.reference.toLowerCase().includes(q)||c.client_nom?.toLowerCase().includes(q))
    :chantiers;

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/>
    <main className="fb-wrap" style={{paddingTop:32,paddingBottom:60}}>
      <div style={{marginBottom:24}}>
        <p style={{margin:"0 0 4px",color:"var(--jaune-deep)",fontFamily:"var(--font-head)",fontWeight:700,
          letterSpacing:".08em",fontSize:13,textTransform:"uppercase"}}>Vue côté client</p>
        <h1 style={{margin:"0 0 4px",fontFamily:"var(--font-display)",fontWeight:700,fontSize:40,
          textTransform:"uppercase",color:"var(--ink)",letterSpacing:"-.01em"}}>Tous les chantiers</h1>
        <p style={{margin:0,color:"var(--slate)",fontSize:15}}>{chantiers.length} chantier(s) — tel que vu par vos clients</p>
      </div>

      {/* Barre de recherche */}
      <div style={{position:"relative",marginBottom:26,maxWidth:460}}>
        <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"var(--muted)",pointerEvents:"none"}}>
          <Icon name="search" size={17}/>
        </span>
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher par référence, nom ou client…"
          style={{width:"100%",paddingLeft:40,paddingRight:14,paddingTop:11,paddingBottom:11,
            border:"1px solid var(--line-strong)",borderRadius:"var(--r-input)",
            fontFamily:"var(--font-body)",fontSize:14,color:"var(--ink)",background:"#fff",
            boxSizing:"border-box",outline:"none"}}/>
      </div>

      {filtered.length===0&&<Card pad={40} style={{textAlign:"center"}}>
        <Icon name="bolt" size={36} style={{color:"var(--muted)",margin:"0 auto 14px",display:"block"}}/>
        <p style={{color:"var(--slate)",margin:0}}>
          {q?"Aucun résultat pour cette recherche.":"Aucun chantier actif pour le moment."}
        </p>
      </Card>}

      <div className="fb-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:22,marginBottom:32}}>
        {filtered.map(c=><ChantierCardVue key={c.id} c={c} onOpen={()=>openVueChantier(c.id)}/>)}
      </div>
    </main>
    <Footer/>
  </div>;
}

function ChantierCardVue({ c, onOpen }) {
  const st=chantierBadge(c);
  const pct=c.etapes_total>0?Math.round((c.etapes_done/c.etapes_total)*100):0;
  return <Card pad={0} hover onClick={onOpen} style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>
    <div style={{position:"relative",height:140,background:"var(--bg-soft)",overflow:"hidden"}}>
      {c.photo_couverture
        ?<img src={c.photo_couverture} alt="" className="fb-img" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        :<div style={{width:"100%",height:"100%",display:"grid",placeItems:"center",color:"var(--muted)"}}><Icon name="camera" size={26}/></div>}
      <div style={{position:"absolute",top:10,left:10}}>
        <StatusPill kind={st.kind} size="sm">{st.label}</StatusPill>
      </div>
    </div>
    <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:10,flex:1}}>
      <div>
        <div style={{fontSize:11,color:"var(--jaune-deep)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>
          {c.client_nom}
        </div>
        <h3 style={{margin:"0 0 4px",fontFamily:"var(--font-head)",fontWeight:700,fontSize:17,color:"var(--ink)"}}>{c.reference_client||c.nom}</h3>
        <div style={{fontSize:12.5,color:"var(--slate)",fontFamily:"var(--font-mono)"}}>{c.reference}</div>
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--slate)",marginBottom:5}}>
          <span>Avancement visible client</span><span>{c.etapes_done}/{c.etapes_total}</span>
        </div>
        <div style={{height:6,background:"var(--line-strong)",borderRadius:999,overflow:"hidden"}}>
          <div style={{width:pct+"%",height:"100%",background:"var(--jaune)",borderRadius:999}}/>
        </div>
      </div>
      <Btn variant="dark" full iconR="chevR" onClick={e=>{e.stopPropagation();onOpen();}}>Voir le détail</Btn>
    </div>
  </Card>;
}
