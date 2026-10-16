import { useState, useEffect, useRef } from 'react';
import { apiFetch, API_BASE, chantierBadge, downloadFile, downloadPdf, CAT_LABELS, CAT_REQUIRED, DOC_OPTIONS, libelleGps } from './api.js';
import { Icon, Logo, Btn, StatusPill, Card, Field, SectionTitle, Toast, useToast, AppHeader,
         AddressAutocomplete, CarteGps, GpsLinks, Footer } from './ui.jsx';

// ═════════════════════════════════════════════════════════════
//  ÉCRAN LOGIN
// ═════════════════════════════════════════════════════════════
export function Login({ onLogin }) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPwd,setShowPwd]=useState(false);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const [forgotMode,setForgotMode]=useState(false);
  const [forgotEmail,setForgotEmail]=useState("");
  const [forgotSent,setForgotSent]=useState(false);
  const [forgotLoading,setForgotLoading]=useState(false);

  // Login direct sans apiFetch pour éviter le reload sur 401.
  // Erreurs typées pour afficher la vraie cause : e.network (serveur injoignable,
  // wifi public/portail captif qui intercepte la requête) et e.status (401, 429…).
  const NET_ERR = "Connexion au serveur impossible. Vérifiez votre réseau (wifi public, portail captif…) puis réessayez.";
  const tryLogin = async (path, body) => {
    let r;
    try {
      r = await fetch(API_BASE + path, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
    } catch { const e=new Error(NET_ERR); e.network=true; throw e; }
    let data;
    try { data = await r.json(); }
    catch {
      // Réponse non-JSON : portail captif qui réécrit la page, ou limiteur global (texte brut)
      const e = r.status===429 ? new Error("Trop de tentatives, réessayez plus tard.") : new Error(NET_ERR);
      if (r.status!==429) e.network=true; else e.status=429;
      throw e;
    }
    if (!r.ok) { const e=new Error(data.error||'Erreur'); e.status=r.status; throw e; }
    return data;
  };

  const submit = async e => {
    e.preventDefault();
    if (!email.trim()||!password.trim()){setErr("Merci de renseigner votre e-mail et votre mot de passe.");return;}
    setLoading(true);setErr("");
    try {
      // Essai admin d'abord
      try {
        const data = await tryLogin('/api/auth/admin/login',{email,password});
        localStorage.setItem('fb_token',data.token);
        // Rechargement complet : repartir d'un état neuf (aucun cache en mémoire).
        window.location.reload();
        return;
      } catch(adminErr) {
        if (!adminErr.message.includes('Identifiants')) throw adminErr;
      }
      // Essai client
      const data = await tryLogin('/api/auth/client/login',{email,code_suivi:password});
      localStorage.setItem('fb_token',data.token);
      localStorage.setItem('fb_client',JSON.stringify(data.client));
      if (data.must_change_code) { onLogin(data.client, true); return; }
      window.location.reload();
    } catch(e){
      if (e.network) setErr(e.message);
      else if (e.status===429) setErr(e.message); // « Trop de tentatives, réessayez dans 15 minutes. »
      else if (e.status===401) setErr("Identifiants incorrects.");
      else setErr(e.message||"Erreur inattendue. Réessayez.");
    }
    finally{setLoading(false);}
  };

  const submitForgot = async e => {
    e.preventDefault();
    if (!forgotEmail.trim()){return;}
    setForgotLoading(true);
    try {
      await fetch(API_BASE+'/api/auth/forgot-password',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:forgotEmail.trim()})
      });
      setForgotSent(true);
    } catch {}
    finally{setForgotLoading(false);}
  };

  const aside = <div className="fb-login-aside" style={{position:"relative",background:"var(--noir)",
    padding:40,color:"#fff",display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:460}}>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,rgba(15,15,15,.6),rgba(15,15,15,.88))"}}/>
    <div style={{position:"relative"}}><Icon name="bolt" size={40} style={{color:"var(--jaune)"}}/></div>
    <div style={{position:"relative"}}>
      <h2 style={{margin:"0 0 14px",fontFamily:"var(--font-display)",fontWeight:700,fontSize:32,
        textTransform:"uppercase",lineHeight:1.1}}>Votre chantier,<br/>en toute clarté</h2>
      <p style={{margin:0,fontSize:15.5,color:"rgba(255,255,255,.8)",lineHeight:1.6}}>
        Retrouvez l'avancement de votre raccordement et les informations transmises par FB ELEC.
      </p>
    </div>
  </div>;

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <div style={{background:"#fff",borderBottom:"1px solid var(--line)"}}>
      <div className="fb-wrap" style={{height:70,display:"flex",alignItems:"center"}}>
        <Logo height={40} onClick={()=>window.location.href='https://suividechantier.fbelec.fr'}/>
      </div>
    </div>
    <div style={{flex:1,display:"grid",placeItems:"center",padding:"40px 20px"}}>
      <div className="fb-login" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0,
        maxWidth:900,width:"100%",background:"#fff",border:"1px solid var(--line)",
        borderRadius:"var(--r-card)",overflow:"hidden",boxShadow:"var(--shadow-lg)"}}>
        {aside}

        {/* Panneau droite : connexion ou mot de passe oublié */}
        {!forgotMode
          ? <form onSubmit={submit} style={{padding:40,display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <h1 style={{margin:"0 0 6px",fontFamily:"var(--font-head)",fontWeight:700,fontSize:26,color:"var(--ink)"}}>
                Connexion
              </h1>
              <p style={{margin:"0 0 28px",fontSize:15,color:"var(--slate)"}}>
                Accédez à votre espace de suivi de chantier.
              </p>
              <div style={{display:"grid",gap:18}}>
                <Field label="E-mail" icon="mail" type="email" value={email}
                  onChange={v=>{setEmail(v);setErr("");}} placeholder="vous@exemple.fr"/>
                <label style={{display:"block"}}>
                  <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>Mot de passe</span>
                  <span style={{display:"flex",alignItems:"center",gap:10,padding:"0 14px",background:"#fff",
                    border:"1.5px solid var(--line-strong)",borderRadius:"var(--r-input)",height:50}}>
                    <span style={{color:"var(--muted)",display:"flex"}}><Icon name="lock" size={19}/></span>
                    <input type={showPwd?"text":"password"} value={password}
                      onChange={e=>{setPassword(e.target.value);setErr("");}}
                      placeholder="••••••••"
                      style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:15.5,color:"var(--ink)",minWidth:0}}/>
                    <button type="button" onClick={()=>setShowPwd(s=>!s)}
                      style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",display:"flex",padding:0}}>
                      <Icon name={showPwd?"eyeOff":"eye"} size={18}/>
                    </button>
                  </span>
                </label>
              </div>
              {err&&<div style={{marginTop:16,display:"flex",gap:9,alignItems:"center",
                background:"color-mix(in srgb,var(--c-blocked) 8%,#fff)",
                border:"1px solid color-mix(in srgb,var(--c-blocked) 25%,transparent)",
                color:"var(--c-blocked-ink)",fontSize:14,padding:"10px 14px",borderRadius:"var(--r-input)"}}>
                <Icon name="alert" size={17}/>{err}
              </div>}
              <div style={{marginTop:24,display:"grid",gap:12}}>
                <Btn variant="primary" size="lg" full type="submit" iconR="chevR" loading={loading}>
                  Se connecter
                </Btn>
                <button type="button" onClick={()=>{setForgotMode(true);setForgotEmail(email);}}
                  style={{background:"none",border:"none",cursor:"pointer",color:"var(--slate)",
                    fontSize:13.5,textDecoration:"underline",padding:0,textAlign:"center"}}>
                  Mot de passe oublié ?
                </button>
              </div>
            </form>

          : <div style={{padding:40,display:"flex",flexDirection:"column",justifyContent:"center"}}>
              {forgotSent
                ? <div style={{textAlign:"center"}}>
                    <div style={{width:56,height:56,borderRadius:999,background:"color-mix(in srgb,var(--c-done) 15%,#fff)",
                      display:"grid",placeItems:"center",margin:"0 auto 20px",color:"var(--c-done)"}}>
                      <Icon name="check" size={28}/>
                    </div>
                    <h2 style={{margin:"0 0 12px",fontFamily:"var(--font-head)",fontWeight:700,fontSize:22,color:"var(--ink)"}}>
                      E-mail envoyé !
                    </h2>
                    <p style={{margin:"0 0 28px",fontSize:15,color:"var(--slate)",lineHeight:1.6}}>
                      Si cet e-mail est lié à un compte, vous recevrez un mot de passe temporaire d'ici quelques instants.
                    </p>
                    <Btn variant="primary" full onClick={()=>{setForgotMode(false);setForgotSent(false);}}>
                      Retour à la connexion
                    </Btn>
                  </div>
                : <form onSubmit={submitForgot}>
                    <button type="button" onClick={()=>setForgotMode(false)}
                      style={{display:"inline-flex",alignItems:"center",gap:7,background:"none",border:"none",
                        cursor:"pointer",color:"var(--slate)",fontSize:14,fontFamily:"var(--font-head)",
                        fontWeight:600,padding:0,marginBottom:28}}>
                      <Icon name="arrowL" size={17}/>Retour
                    </button>
                    <h1 style={{margin:"0 0 8px",fontFamily:"var(--font-head)",fontWeight:700,fontSize:24,color:"var(--ink)"}}>
                      Mot de passe oublié
                    </h1>
                    <p style={{margin:"0 0 28px",fontSize:15,color:"var(--slate)",lineHeight:1.55}}>
                      Entrez votre e-mail, vous recevrez un mot de passe temporaire.
                    </p>
                    <div style={{display:"grid",gap:18}}>
                      <Field label="E-mail" icon="mail" type="email" value={forgotEmail}
                        onChange={v=>setForgotEmail(v)} placeholder="vous@exemple.fr"/>
                    </div>
                    <div style={{marginTop:24}}>
                      <Btn variant="primary" size="lg" full type="submit" iconR="chevR" loading={forgotLoading}>
                        Envoyer le mot de passe temporaire
                      </Btn>
                    </div>
                  </form>
              }
            </div>
        }
      </div>
    </div>
    <Footer/>
  </div>;
}

// ═════════════════════════════════════════════════════════════
//  CONTACT BLOCK
// ═════════════════════════════════════════════════════════════
function ContactBlock({ chantierId, lectureSeule=false }) {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
  const [showPhone,setShowPhone]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [message,setMessage]=useState("");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await apiFetch('/api/client/contact',{method:'POST',
        body:chantierId?{message,chantier_id:chantierId}:{message}});
      setSent(true); setMessage("");
      setTimeout(()=>{setSent(false);setShowForm(false);},3500);
    } catch {}
    finally{setSending(false);}
  };

  return <Card pad={22} style={{background:"var(--noir)",borderColor:"var(--noir)"}}>
    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
      <div style={{width:46,height:46,borderRadius:999,background:"var(--jaune)",
        display:"grid",placeItems:"center",color:"#1a1a1a",flex:"0 0 auto"}}>
        <Icon name="user" size={24}/>
      </div>
      <div style={{flex:1,minWidth:160}}>
        <div style={{color:"#fff",fontFamily:"var(--font-head)",fontWeight:700,fontSize:16}}>FB ELEC</div>
        <div style={{color:"rgba(255,255,255,.65)",fontSize:13.5}}>Électricité provisoire</div>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        {isMobile
          ? <Btn variant="primary" icon="phone" href="tel:+33675435556">Appeler FB ELEC</Btn>
          : showPhone
            ? <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",
                background:"var(--jaune)",borderRadius:999,fontFamily:"var(--font-head)",
                fontWeight:700,fontSize:16,color:"#1a1a1a"}}>
                <Icon name="phone" size={18}/>06 75 43 55 56
              </div>
            : <Btn variant="primary" icon="phone" onClick={()=>setShowPhone(true)}>Appeler FB ELEC</Btn>
        }
        {!lectureSeule&&<Btn variant="ghost" icon="mail" onClick={()=>setShowForm(f=>!f)}
          style={{color:"#fff",borderColor:"rgba(255,255,255,.3)",
            background:showForm?"rgba(255,255,255,.1)":"transparent"}}>Écrire</Btn>}
      </div>
    </div>

    {showForm&&<div style={{marginTop:16,borderTop:"1px solid rgba(255,255,255,.12)",paddingTop:16}}>
      {sent
        ? <div style={{display:"flex",alignItems:"center",gap:10,color:"var(--jaune)",
            fontFamily:"var(--font-head)",fontWeight:700,fontSize:15}}>
            <Icon name="check" size={20}/>Message envoyé à FB ELEC ✓
          </div>
        : <div style={{display:"grid",gap:10}}>
            <textarea value={message} onChange={e=>setMessage(e.target.value)}
              placeholder="Votre message pour FB ELEC…"
              rows={3}
              style={{width:"100%",padding:"12px 14px",borderRadius:"var(--r-input)",border:"1px solid rgba(255,255,255,.2)",
                background:"rgba(255,255,255,.08)",color:"#fff",fontSize:14.5,fontFamily:"var(--font-body)",
                resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.55}}/>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
              <button onClick={()=>{setShowForm(false);setMessage("");}}
                style={{background:"none",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,
                  padding:"8px 16px",color:"rgba(255,255,255,.7)",cursor:"pointer",
                  fontFamily:"var(--font-head)",fontWeight:600,fontSize:13.5}}>
                Annuler
              </button>
              <button onClick={sendMessage} disabled={!message.trim()||sending}
                style={{display:"inline-flex",alignItems:"center",gap:8,padding:"9px 18px",
                  background:message.trim()&&!sending?"var(--jaune)":"rgba(255,255,255,.2)",
                  border:"none",borderRadius:8,cursor:message.trim()&&!sending?"pointer":"default",
                  fontFamily:"var(--font-head)",fontWeight:700,fontSize:14,
                  color:message.trim()&&!sending?"#1a1a1a":"rgba(255,255,255,.5)",transition:"all .15s"}}>
                <Icon name="send" size={15}/>
                {sending?"Envoi…":"Envoyer"}
              </button>
            </div>
          </div>
      }
    </div>}
  </Card>;
}

// ═════════════════════════════════════════════════════════════
//  DASHBOARD CLIENT
// ═════════════════════════════════════════════════════════════
export function Dashboard({ go, openChantier, onLogout, isAdmin }) {
  const [chantiers,setChantiers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [archived,setArchived]=useState(null); // null = pas encore chargé
  const [showArchived,setShowArchived]=useState(false);

  useEffect(()=>{
    apiFetch('/api/client/chantiers').then(setChantiers).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const toggleArchived = () => {
    const next=!showArchived;
    setShowArchived(next);
    if (next && archived===null) {
      apiFetch('/api/client/chantiers?archived=1').then(setArchived).catch(()=>setArchived([]));
    }
  };

  if (loading) return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/><div className="fb-spinner"/></div>;

  const actions=chantiers.filter(c=>c.action_requise_titre);
  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/>
    <main className="fb-wrap" style={{paddingTop:32,paddingBottom:60}}>
      <div style={{marginBottom:26,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <div>
          <p style={{margin:"0 0 4px",color:"var(--jaune-deep)",fontFamily:"var(--font-head)",fontWeight:700,
            letterSpacing:".08em",fontSize:13,textTransform:"uppercase"}}>Bonjour</p>
          <h1 style={{margin:0,fontFamily:"var(--font-display)",fontWeight:700,fontSize:40,
            textTransform:"uppercase",color:"var(--ink)",letterSpacing:"-.01em"}}>Mes chantiers</h1>
          <p style={{margin:"8px 0 0",color:"var(--slate)",fontSize:16}}>{chantiers.length} chantier(s) suivi(s) par FB ELEC.</p>
        </div>
        <Btn variant="dark" icon="plus" onClick={()=>go("nouveau-chantier")}>Créer un chantier</Btn>
      </div>

      {actions.length>0&&<div style={{marginBottom:24,padding:"16px 18px",borderRadius:"var(--r-card)",
        background:"color-mix(in srgb,var(--c-blocked) 9%,#fff)",
        border:"1px solid color-mix(in srgb,var(--c-blocked) 30%,transparent)",
        display:"flex",gap:13,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{color:"var(--c-blocked)",display:"flex"}}><Icon name="alert" size={22}/></span>
        <div style={{flex:1,minWidth:200}}>
          <div style={{fontFamily:"var(--font-head)",fontWeight:700,color:"var(--c-blocked-ink)",fontSize:15.5}}>
            {actions.length} chantier(s) nécessite(nt) votre attention
          </div>
          <div style={{color:"var(--slate)",fontSize:14}}>{actions[0].nom} — {actions[0].action_requise_titre}</div>
        </div>
        <Btn variant="dark" size="sm" iconR="chevR" onClick={()=>openChantier(actions[0].id)}>Traiter</Btn>
      </div>}

      {chantiers.length===0&&<Card pad={40} style={{textAlign:"center"}}>
        <Icon name="bolt" size={40} style={{color:"var(--muted)",margin:"0 auto 16px"}}/>
        <p style={{color:"var(--slate)",margin:0}}>Aucun chantier pour le moment.</p>
      </Card>}

      <div className="fb-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:22,marginBottom:32}}>
        {chantiers.map(c=><ChantierCard key={c.id} c={c} onOpen={()=>openChantier(c.id)}/>)}
      </div>

      {/* Chantiers archivés */}
      <div style={{borderTop:"1px solid var(--line)",paddingTop:20,marginBottom:32}}>
        <button onClick={toggleArchived} style={{display:"inline-flex",alignItems:"center",gap:8,
          background:"none",border:"none",cursor:"pointer",color:"var(--slate)",
          fontFamily:"var(--font-head)",fontWeight:700,fontSize:15,padding:0}}>
          <Icon name="archive" size={18}/>Chantiers archivés
          {archived!==null&&<span style={{color:"var(--muted)",fontWeight:600}}>({archived.length})</span>}
          <Icon name={showArchived?"chevD":"chevR"} size={16}/>
        </button>
        {showArchived&&<div style={{marginTop:18}}>
          {archived===null
            ? <div className="fb-spinner" style={{margin:"20px auto"}}/>
            : archived.length===0
              ? <p style={{color:"var(--muted)",fontSize:14,margin:0}}>Aucun chantier archivé.</p>
              : <div className="fb-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:22}}>
                  {archived.map(c=><ChantierCard key={c.id} c={c} onOpen={()=>openChantier(c.id)}/>)}
                </div>}
        </div>}
      </div>
      <ContactBlock/>
    </main>
    <Footer/>
  </div>;
}

function ChantierCard({ c, onOpen }) {
  const st=chantierBadge(c);
  const pct=c.etapes_total>0?Math.round((c.etapes_done/c.etapes_total)*100):0;
  return <Card pad={0} hover onClick={onOpen} style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>
    <div style={{position:"relative",height:150,background:"var(--bg-soft)",overflow:"hidden"}}>
      {c.photo_couverture
        ?<img src={c.photo_couverture} alt="" className="fb-img" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        :<div style={{width:"100%",height:"100%",display:"grid",placeItems:"center",color:"var(--muted)"}}><Icon name="camera" size={28}/></div>}
      <div style={{position:"absolute",top:12,left:12}}>
        <StatusPill kind={st.kind} size="sm">{st.label}</StatusPill>
      </div>
      {c.action_requise_titre&&<div style={{position:"absolute",top:12,right:12,background:"var(--c-blocked)",
        color:"#fff",borderRadius:999,padding:"4px 10px",fontSize:12,fontWeight:700,
        display:"flex",alignItems:"center",gap:5}}>
        <Icon name="alert" size={13}/>Action requise
      </div>}
    </div>
    <div style={{padding:22,display:"flex",flexDirection:"column",gap:14,flex:1}}>
      <div>
        <h3 style={{margin:"0 0 5px",fontFamily:"var(--font-head)",fontWeight:700,fontSize:19,color:"var(--ink)"}}>{c.reference_client||c.nom}</h3>
        <div style={{display:"flex",alignItems:"center",gap:6,color:"var(--slate)",fontSize:14}}>
          <Icon name="pin" size={15}/>{c.adresse}, {c.commune}
        </div>
        {c.proprietaire_nom&&<div style={{display:"flex",alignItems:"center",gap:6,color:"var(--muted)",fontSize:12.5,marginTop:4}}>
          <Icon name="user" size={13}/>Créé par {c.proprietaire_nom}{c.peut_modifier===false?' · consultation seule':''}
        </div>}
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,color:"var(--slate)",marginBottom:6}}>
          <span style={{fontWeight:600}}>Avancement</span>
          <span>{c.etapes_done}/{c.etapes_total} étapes · {pct}%</span>
        </div>
        <div style={{height:7,background:"var(--bg-soft)",borderRadius:999,overflow:"hidden"}}>
          <div style={{width:pct+"%",height:"100%",background:"var(--jaune)",borderRadius:999}}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:13}}>
        <div>
          <div style={{color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",fontSize:11,fontWeight:600,marginBottom:2}}>Dossier</div>
          <div style={{color:"var(--ink)",fontWeight:600,fontFamily:"var(--font-mono)",fontSize:12.5}}>{c.reference}</div>
        </div>
        <div>
          <div style={{color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",fontSize:11,fontWeight:600,marginBottom:2}}>Mise à jour</div>
          <div style={{color:"var(--ink)",fontWeight:600}}>{c.derniere_maj||"—"}</div>
        </div>
      </div>
      {c.prochaine_action&&<div style={{marginTop:"auto",padding:"11px 13px",background:"var(--bg-soft)",
        borderRadius:"var(--r-input)",display:"flex",gap:9,alignItems:"flex-start"}}>
        <Icon name="chevR" size={16} style={{color:"var(--jaune-deep)",marginTop:2,flex:"0 0 auto"}}/>
        <div>
          <div style={{fontSize:11,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>Prochaine étape</div>
          <div style={{fontSize:13.5,color:"var(--ink)",fontWeight:600}}>{c.prochaine_action}</div>
        </div>
      </div>}
      <Btn variant="dark" full iconR="chevR" onClick={e=>{e.stopPropagation();onOpen();}}>Voir le détail</Btn>
    </div>
  </Card>;
}

// ═════════════════════════════════════════════════════════════
//  PAGE DÉTAIL CHANTIER
// ═════════════════════════════════════════════════════════════
export function ChantierDetail({ chantierId, go, onLogout, isAdmin, backTo, apiBase }) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [reloadKey,setReloadKey]=useState(0);
  const [toast,showToast]=useToast();
  const base = apiBase || '/api/client/chantiers';
  const retour = backTo || "dashboard";
  const isClientView = !apiBase && !backTo;

  const reload = () => setReloadKey(k=>k+1);

  useEffect(()=>{
    if (reloadKey===0) setLoading(true);
    apiFetch(`${base}/${chantierId}`).then(setData).catch(console.error).finally(()=>setLoading(false));
  },[chantierId,reloadKey]);

  if (loading||!data) return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/><div className="fb-spinner"/></div>;

  const c=data;
  // Chantier d'un collègue vu par un compte « suivi » : consultation seule.
  const lectureSeule=isClientView&&c.peut_modifier===false;
  const st=chantierBadge(c);
  const doneCount=c.etapes.filter(e=>e.etat==="done").length;
  const total=c.etapes.filter(e=>e.etat!=="na").length;
  const pct=total>0?Math.round((doneCount/total)*100):0;

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/>
    <div className="fb-wrap" style={{paddingTop:22}}>
      <button onClick={()=>go(retour)} style={{display:"inline-flex",alignItems:"center",gap:7,
        background:"none",border:"none",cursor:"pointer",color:"var(--slate)",fontSize:14,
        fontFamily:"var(--font-head)",fontWeight:600,padding:0}}>
        <Icon name="arrowL" size={17}/>{retour==="admin-vue-client"?"Tous les chantiers":"Mes chantiers"}
      </button>
    </div>

    {/* En-tête */}
    <div className="fb-wrap" style={{paddingTop:14}}>
      <Card pad={0} style={{overflow:"hidden"}}>
        <div className="fb-detail-head" style={{display:"grid",gridTemplateColumns:"1.4fr 1fr"}}>
          <div style={{padding:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
              <StatusPill kind={st.kind}>{st.label}</StatusPill>
              <span style={{fontSize:13,color:"var(--muted)",fontFamily:"var(--font-mono)"}}>Dossier {c.reference}</span>
            </div>
            {lectureSeule&&<div style={{display:"inline-flex",alignItems:"center",gap:7,marginBottom:12,padding:"6px 12px",
              background:"var(--bg-soft)",border:"1px solid var(--line)",borderRadius:999,fontSize:13,color:"var(--slate)",fontWeight:600}}>
              <Icon name="eye" size={15}/>Consultation seule{c.proprietaire_nom?` — chantier de ${c.proprietaire_nom}`:''}
            </div>}
            <h1 style={{margin:"0 0 10px",fontFamily:"var(--font-display)",fontWeight:700,fontSize:34,
              textTransform:"uppercase",color:"var(--ink)",letterSpacing:"-.01em",lineHeight:1.05}}>{c.reference_client||c.nom}</h1>
            <div style={{display:"flex",flexDirection:"column",gap:6,color:"var(--slate)",fontSize:14.5}}>
              <span style={{display:"flex",alignItems:"center",gap:8}}><Icon name="pin" size={16}/>{c.adresse}, {c.commune}</span>
              {c.type_prestation&&<span style={{display:"flex",alignItems:"center",gap:8}}><Icon name="bolt" size={16}/>{c.type_prestation}</span>}
              {c.derniere_maj&&<span style={{display:"flex",alignItems:"center",gap:8}}><Icon name="clock" size={16}/>Mis à jour le {c.derniere_maj}</span>}
            </div>
            {c.resume&&<div style={{marginTop:20,padding:"15px 17px",background:"var(--bg-soft)",borderRadius:"var(--r-input)",borderLeft:"4px solid var(--jaune)"}}>
              <p style={{margin:0,fontSize:15,color:"var(--ink)",lineHeight:1.55}}>{c.resume}</p>
            </div>}
            <div style={{marginTop:18}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:7}}>
                <span style={{fontFamily:"var(--font-head)",fontWeight:700,color:"var(--ink)"}}>Avancement global</span>
                <span style={{color:"var(--slate)"}}>{doneCount}/{total} étapes · {pct}%</span>
              </div>
              <div style={{height:9,background:"var(--bg-soft)",borderRadius:999,overflow:"hidden",border:"1px solid var(--line)"}}>
                <div style={{width:pct+"%",height:"100%",background:"var(--jaune)"}}/>
              </div>
            </div>
          </div>
          <div style={{position:"relative",background:"var(--noir)",padding:28,color:"#fff",
            display:"flex",flexDirection:"column",justifyContent:"flex-end",minHeight:240}}>
            {c.photos[0]&&<img src={c.photos[0].url} alt="" className="fb-img"
              style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.35}}/>}
            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(15,15,15,.3),rgba(15,15,15,.82))"}}/>
            <div style={{position:"relative"}}>
              <div style={{fontSize:12,color:"var(--jaune)",textTransform:"uppercase",letterSpacing:".08em",fontWeight:700,marginBottom:8}}>Prochaine action</div>
              <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:20,lineHeight:1.25,marginBottom:8}}>{c.prochaine_action||(c.etapes&&(c.etapes.find(e=>e.etat==='current')?.label||c.etapes.find(e=>e.etat==='future')?.label))||"—"}</div>
              {c.prochaine_action_date&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13.5,color:"rgba(255,255,255,.78)"}}>
                <Icon name="clock" size={15}/>{c.prochaine_action_date}</div>}
              {c.prochaine_action_qui&&c.prochaine_action_qui!=="—"&&<div style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:7,
                background:"rgba(255,255,255,.12)",borderRadius:999,padding:"5px 12px",fontSize:13,fontWeight:600}}>
                <Icon name="user" size={14}/>À traiter par {c.prochaine_action_qui}</div>}
            </div>
          </div>
        </div>
      </Card>
    </div>

    {/* Action requise */}
    {c.action_requise_titre&&<div className="fb-wrap" style={{marginTop:18}}>
      <div style={{padding:"18px 20px",borderRadius:"var(--r-card)",
        background:"color-mix(in srgb,var(--c-blocked) 9%,#fff)",
        border:"1.5px solid color-mix(in srgb,var(--c-blocked) 32%,transparent)",
        display:"flex",gap:15,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{width:44,height:44,borderRadius:999,background:"var(--c-blocked)",color:"#fff",
          display:"grid",placeItems:"center",flex:"0 0 auto"}}><Icon name="alert" size={24}/></span>
        <div style={{flex:1,minWidth:220}}>
          <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:17,color:"var(--c-blocked-ink)"}}>{c.action_requise_titre}</div>
          {c.action_requise_texte&&<p style={{margin:"3px 0 0",fontSize:14.5,color:"var(--slate)",lineHeight:1.5}}>{c.action_requise_texte}</p>}
        </div>
        {c.action_requise_cta&&<Btn variant="dark" icon="check">{c.action_requise_cta}</Btn>}
      </div>
    </div>}

    {/* Corps */}
    <main className="fb-wrap fb-detail-body" style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",
      gap:24,paddingTop:24,paddingBottom:60,alignItems:"start"}}>
      <div style={{display:"grid",gap:24}}>
        <Card>
          <SectionTitle icon="bolt">Avancement de votre raccordement</SectionTitle>
          <Timeline etapes={c.etapes} photos={c.photos}/>
        </Card>
        {!isClientView&&!backTo&&c.photos.length>0&&<Card>
          <SectionTitle icon="camera" right={<span style={{fontSize:13,color:"var(--muted)"}}>{c.photos.length} photo(s)</span>}>
            Photos du chantier
          </SectionTitle>
          <Gallery photos={c.photos}/>
        </Card>}
      </div>
      <div style={{display:"grid",gap:24,position:"sticky",top:84}}>
        <ContactBlock chantierId={chantierId} lectureSeule={lectureSeule}/>
        {/* Informations administratives */}
        {(c.adresse_facturation||c.puissance_demandee||c.date_debut_chantier||c.duree_chantier)&&
          !isAdmin&&<Card pad={0} style={{overflow:"hidden"}}>
          <div style={{padding:"16px 20px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <SectionTitle icon="info" style={{margin:0}}>Informations du dossier</SectionTitle>
            {!lectureSeule&&<button onClick={()=>go("edit-chantier")}
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 13px",
                border:"1px solid var(--line)",borderRadius:"var(--r-input)",background:"#fff",
                cursor:"pointer",fontSize:13,fontFamily:"var(--font-head)",fontWeight:600,color:"var(--slate)"}}>
              <Icon name="settings" size={15}/>Modifier
            </button>}
          </div>
          <div style={{padding:"0 20px 18px",display:"grid",gap:10}}>
            {[
              ["Référence",c.reference_client],
              ["Localisation GPS",c.gps_lat!=null&&c.gps_lng!=null?<GpsLinks lat={c.gps_lat} lng={c.gps_lng}/>:null],
              ["Adresse facturation",c.adresse_facturation],
              ["Référence facturation",c.reference_facturation],
              ["Téléphone facturation",c.facturation_telephone],
              ["Mail facturation",c.facturation_email],
              ["Puissance demandée",c.puissance_demandee],
              ["Type",c.puissance_type==='monophase'?'Monophasé':c.puissance_type==='triphase'?'Triphasé':null],
              ["Terrain viabilisé",c.terrain_viabilise===true?"Oui":c.terrain_viabilise===false?"Non":null],
              ["Date de début",c.date_debut_chantier?.slice(0,10)],
              ["Durée prévisionnelle",c.duree_chantier],
            ].filter(([,v])=>v).map(([k,v])=><div key={k}>
              <div style={{fontSize:11.5,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:700,marginBottom:2}}>{k}</div>
              <div style={{fontSize:14.5,color:"var(--ink)",fontWeight:500}}>{v}</div>
            </div>)}
          </div>
        </Card>}
        {c.notes.length>0&&<Card>
          <SectionTitle icon="mail">Messages</SectionTitle>
          <Notes notes={c.notes}/>
        </Card>}
        {isClientView||backTo==='admin-vue-client'
          ? <>
              <ClientDocumentsSection chantierId={chantierId} docs={c.documents} reload={reload} showToast={showToast} readonly={!isClientView||lectureSeule}/>
              <ClientPhotosSection chantierId={chantierId} photos={c.photos} reload={reload} showToast={showToast} readonly={!isClientView||lectureSeule}/>
            </>
          : c.documents.length>0&&<Card>
              <SectionTitle icon="file">Documents</SectionTitle>
              <Documents documents={c.documents}/>
            </Card>
        }
        {/* Détails techniques repliables */}
        <TechDetails chantier={c}/>
      </div>
    </main>
    <Footer/>
    <Toast message={toast.msg} type={toast.type}/>
  </div>;
}

// ── Timeline (utilise les étapes dynamiques de l'API) ─────────
function Timeline({ etapes, photos=[] }) {
  const [lightbox,setLightbox]=useState(null);
  if (!etapes||!etapes.length) return <p style={{color:"var(--muted)"}}>Aucune étape configurée.</p>;
  return <div style={{position:"relative"}}>
    {etapes.map((step,i)=>{
      const state=step.etat;
      const last=i===etapes.length-1;
      const stepPhotos=photos.filter(p=>p.etape_id===step.etape_id);
      const cfg={
        done:{ring:"var(--jaune)",fill:"var(--jaune)",ic:"check",icColor:"#1a1a1a"},
        current:{ring:"var(--jaune)",fill:"var(--jaune)",ic:"bolt",icColor:"#1a1a1a"},
        future:{ring:"var(--line-strong)",fill:"#fff",ic:null,icColor:"var(--muted)"},
        blocked:{ring:"var(--c-blocked)",fill:"var(--c-blocked)",ic:"alert",icColor:"#fff"},
        na:{ring:"var(--line)",fill:"var(--bg-soft)",ic:null,icColor:"var(--muted)"},
      }[state]||{ring:"var(--line-strong)",fill:"#fff",ic:null,icColor:"var(--muted)"};
      const isCurrent=state==="current";
      const dim=state==="future"||state==="na";
      return <div key={step.etape_id} style={{display:"flex",gap:16,position:"relative"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:"0 0 auto"}}>
          <div style={{position:"relative",width:34,height:34,display:"grid",placeItems:"center"}}>
            {isCurrent&&<span className="fb-pulse" style={{position:"absolute",inset:-3,borderRadius:999,border:"2px solid var(--jaune)"}}/>}
            <span style={{width:30,height:30,borderRadius:999,background:cfg.fill,
              border:"2.5px solid "+cfg.ring,display:"grid",placeItems:"center",color:cfg.icColor,
              boxShadow:isCurrent?"0 0 0 4px color-mix(in srgb,var(--jaune) 25%,transparent)":"none"}}>
              {cfg.ic?<Icon name={cfg.ic} size={16} stroke={2.4}/>
                :<span style={{width:7,height:7,borderRadius:999,background:dim?"var(--muted)":"#fff"}}/>}
            </span>
          </div>
          {!last&&<span style={{flex:1,width:2.5,minHeight:22,
            background:state==="done"?"var(--jaune)":"var(--line-strong)",
            borderRadius:2,marginTop:2,marginBottom:2}}/>}
        </div>
        <div style={{paddingBottom:last?0:22,flex:1,minWidth:0,opacity:dim?.62:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontFamily:"var(--font-head)",fontWeight:isCurrent?700:600,
              fontSize:isCurrent?17:15.5,
              color:state==="blocked"?"var(--c-blocked-ink)":"var(--ink)",
              textDecoration:state==="na"?"line-through":"none"}}>{step.label}</span>
            {isCurrent&&<StatusPill kind="progress" size="sm">Étape actuelle</StatusPill>}
            {state==="done"&&<span style={{fontSize:12.5,color:"var(--c-done-ink)",fontWeight:600}}>Terminé</span>}
            {state==="na"&&<span style={{fontSize:12,color:"var(--muted)",fontWeight:600,
              background:"var(--bg-soft)",padding:"2px 8px",borderRadius:999}}>non nécessaire</span>}
            {state==="blocked"&&<StatusPill kind="blocked" size="sm">Point bloquant</StatusPill>}
            {step.date_valeur&&<span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:600,
              color:"var(--jaune-deep)",background:"color-mix(in srgb,var(--jaune) 16%,#fff)",padding:"3px 9px",borderRadius:999}}>
              <Icon name="clock" size={13}/>{step.date_valeur.split('-').reverse().join('/')}</span>}
          </div>
          {step.sous_texte&&state!=="na"&&<p style={{margin:"4px 0 0",fontSize:13.5,color:"var(--slate)",lineHeight:1.5,maxWidth:560}}>{step.sous_texte}</p>}
          {stepPhotos.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
            {stepPhotos.map((p,pi)=><div key={p.id} onClick={()=>setLightbox({photos:stepPhotos,idx:pi})}
              style={{width:72,height:72,borderRadius:8,overflow:"hidden",border:"1.5px solid var(--line-strong)",
                cursor:"pointer",flex:"0 0 auto",background:"var(--bg-soft)"}}>
              <img src={p.url} alt={p.legende||""} className="fb-img"
                style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            </div>)}
          </div>}
        </div>
      </div>;
    })}
    {lightbox&&<div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,zIndex:200,
      background:"rgba(10,10,10,.92)",display:"grid",placeItems:"center",padding:24}}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:760,width:"100%",position:"relative"}}>
        <img src={lightbox.photos[lightbox.idx].url} alt="" className="fb-img"
          style={{width:"100%",maxHeight:"75vh",objectFit:"contain",borderRadius:10,background:"#000"}}/>
        {lightbox.photos[lightbox.idx].legende&&<div style={{textAlign:"center",marginTop:12,
          color:"rgba(255,255,255,.8)",fontSize:14}}>{lightbox.photos[lightbox.idx].legende}</div>}
        <button onClick={()=>setLightbox(null)} style={{position:"absolute",top:-14,right:-14,width:40,height:40,
          borderRadius:999,background:"#fff",border:"none",cursor:"pointer",display:"grid",placeItems:"center"}}>
          <Icon name="x" size={20}/></button>
        {lightbox.photos.length>1&&<>
          <button onClick={()=>setLightbox(l=>({...l,idx:(l.idx-1+l.photos.length)%l.photos.length}))}
            style={{position:"absolute",left:-52,top:"50%",transform:"translateY(-50%)",width:40,height:40,
              borderRadius:999,background:"rgba(255,255,255,.15)",border:"none",cursor:"pointer",
              display:"grid",placeItems:"center",color:"#fff"}}>
            <Icon name="arrowL" size={20}/></button>
          <button onClick={()=>setLightbox(l=>({...l,idx:(l.idx+1)%l.photos.length}))}
            style={{position:"absolute",right:-52,top:"50%",transform:"translateY(-50%)",width:40,height:40,
              borderRadius:999,background:"rgba(255,255,255,.15)",border:"none",cursor:"pointer",
              display:"grid",placeItems:"center",color:"#fff"}}>
            <Icon name="chevR" size={20}/></button>
        </>}
      </div>
    </div>}
  </div>;
}

// ── Galerie ───────────────────────────────────────────────────
function Gallery({ photos }) {
  const [open,setOpen]=useState(null);
  const avant=photos.find(p=>p.pair==="avant");
  const apres=photos.find(p=>p.pair==="apres");
  const [reveal,setReveal]=useState(50);
  return <div>
    {avant&&apres&&<div style={{marginBottom:22}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <Icon name="swap" size={16} style={{color:"var(--jaune-deep)"}}/>
        <span style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:14.5}}>Avant / après</span>
      </div>
      <div style={{position:"relative",height:280,borderRadius:"var(--r-card)",overflow:"hidden",border:"1px solid var(--line)",userSelect:"none"}}>
        <img src={avant.url} alt="avant" className="fb-img" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
        <div style={{position:"absolute",inset:0,width:reveal+"%",overflow:"hidden"}}>
          <img src={apres.url} alt="après" className="fb-img" style={{position:"absolute",inset:0,width:(10000/reveal)+"%",maxWidth:"none",height:"100%",objectFit:"cover"}}/>
        </div>
        <div style={{position:"absolute",top:0,bottom:0,left:reveal+"%",width:3,background:"var(--jaune)",transform:"translateX(-50%)"}}>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            width:34,height:34,borderRadius:999,background:"var(--jaune)",display:"grid",placeItems:"center",color:"#1a1a1a"}}>
            <Icon name="swap" size={16}/>
          </div>
        </div>
        <span style={{position:"absolute",top:12,left:12,background:"rgba(0,0,0,.6)",color:"#fff",fontSize:12,fontWeight:600,padding:"3px 9px",borderRadius:999}}>Avant</span>
        <span style={{position:"absolute",top:12,right:12,background:"var(--jaune)",color:"#1a1a1a",fontSize:12,fontWeight:700,padding:"3px 9px",borderRadius:999}}>Après</span>
        <input type="range" min="2" max="98" value={reveal} onChange={e=>setReveal(+e.target.value)}
          style={{position:"absolute",left:0,right:0,bottom:14,width:"90%",margin:"0 5%",accentColor:"var(--jaune-deep)"}}/>
      </div>
    </div>}
    <div className="fb-gallery" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
      {photos.map((p,i)=><div key={p.id} onClick={()=>setOpen(i)}
        style={{cursor:"pointer",borderRadius:"var(--r-input)",overflow:"hidden",border:"1px solid var(--line)",background:"#fff"}}>
        <div style={{position:"relative",height:130,background:"var(--bg-soft)"}}>
          <img src={p.url} alt="" className="fb-img" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          <span style={{position:"absolute",top:8,left:8,background:"var(--jaune)",color:"#1a1a1a",
            fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:999,display:"flex",alignItems:"center",gap:4}}>
            <Icon name="bolt" size={11}/>FB ELEC</span>
        </div>
        <div style={{padding:"9px 11px"}}>
          <div style={{fontSize:13,color:"var(--ink)",fontWeight:600,lineHeight:1.35,
            display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.legende||"Photo de chantier"}</div>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:4,display:"flex",justifyContent:"space-between"}}>
            <span>{p.date_photo||""}</span>
            {p.etape_label&&<span style={{color:"var(--jaune-deep)",fontWeight:600}}>{p.etape_label}</span>}
          </div>
        </div>
      </div>)}
    </div>
    {open!==null&&<div onClick={()=>setOpen(null)} style={{position:"fixed",inset:0,zIndex:200,
      background:"rgba(10,10,10,.9)",display:"grid",placeItems:"center",padding:24}}>
      <div onClick={e=>e.stopPropagation()} style={{maxWidth:760,width:"100%"}}>
        <div style={{position:"relative"}}>
          <img src={photos[open].url} alt="" className="fb-img"
            style={{width:"100%",maxHeight:"72vh",objectFit:"contain",borderRadius:10,background:"#000"}}/>
          <button onClick={()=>setOpen(null)} style={{position:"absolute",top:-14,right:-14,width:40,height:40,
            borderRadius:999,background:"#fff",border:"none",cursor:"pointer",display:"grid",placeItems:"center"}}>
            <Icon name="x" size={20}/></button>
        </div>
        <div style={{marginTop:14,color:"#fff",display:"flex",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
          <div>
            <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:17}}>{photos[open].legende||"Photo de chantier"}</div>
            <div style={{color:"rgba(255,255,255,.65)",fontSize:14,marginTop:3}}>Ajouté par FB ELEC{photos[open].date_photo?" · "+photos[open].date_photo:""}</div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn variant="ghost" size="sm" icon="download" onClick={()=>downloadFile(photos[open].url, photos[open].nom_fichier||undefined)}
              style={{color:"#fff",borderColor:"rgba(255,255,255,.3)"}}>Télécharger</Btn>
            <Btn variant="ghost" size="sm" icon="arrowL" onClick={()=>setOpen((open-1+photos.length)%photos.length)}
              style={{color:"#fff",borderColor:"rgba(255,255,255,.3)"}}>Préc.</Btn>
            <Btn variant="primary" size="sm" iconR="chevR" onClick={()=>setOpen((open+1)%photos.length)}>Suiv.</Btn>
          </div>
        </div>
      </div>
    </div>}
  </div>;
}

// ── Documents (lecture seule, liste client) ───────────────────
function Documents({ documents, showStatut=false }) {
  const DS={valide:{label:"Validé",kind:"done"},recu:{label:"Reçu",kind:"progress"},attente:{label:"En attente",kind:"wait"}};
  return <div style={{display:"grid",gap:10}}>
    {documents.map(d=>{
      const ds=DS[d.statut]||{label:d.statut,kind:"neutral"};
      const openDoc=()=>d.url&&window.open(d.url,'_blank','noopener,noreferrer');
      return <div key={d.id} onClick={openDoc}
        style={{display:"flex",alignItems:"center",gap:13,padding:"13px 15px",
          background:"#fff",border:"1px solid var(--line)",borderRadius:"var(--r-input)",
          cursor:d.url?"pointer":"default",transition:"border-color .15s"}}
        onMouseEnter={e=>{if(d.url)e.currentTarget.style.borderColor="var(--jaune-deep)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--line)";}}>
        <div style={{width:40,height:40,borderRadius:9,background:"var(--bg-soft)",display:"grid",
          placeItems:"center",color:d.url?"var(--jaune-deep)":"var(--slate)",flex:"0 0 auto"}}>
          <Icon name="file" size={20}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"var(--font-head)",fontWeight:600,fontSize:14.5,color:"var(--ink)",
            display:"flex",alignItems:"center",gap:6}}>
            {d.nom}
            {d.url&&<Icon name="extLink" size={13} style={{color:"var(--muted)",flex:"0 0 auto"}}/>}
          </div>
          <div style={{fontSize:12.5,color:"var(--muted)"}}>
            {d.categorie&&CAT_LABELS[d.categorie]?CAT_LABELS[d.categorie]+" · ":""}{d.type_fichier}{d.date_document?" · "+d.date_document:""}
          </div>
        </div>
        {showStatut&&<StatusPill kind={ds.kind} size="sm">{ds.label}</StatusPill>}
      </div>;
    })}
  </div>;
}

// ── Notes (fil de messages — partagé avec la fiche admin) ────
export function Notes({ notes }) {
  return <div style={{display:"grid",gap:14}}>
    {notes.map(n=>{
      const deClient=!!n.de_client;
      const initiales=deClient
        ?(n.auteur||"C").split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase()
        :"FB";
      return <div key={n.id} style={{display:"flex",gap:12}}>
      <div style={{width:38,height:38,borderRadius:999,background:deClient?"var(--line-strong)":"var(--jaune)",color:"#1a1a1a",
        display:"grid",placeItems:"center",flex:"0 0 auto",fontFamily:"var(--font-head)",fontWeight:700,fontSize:deClient?13:undefined}}>{initiales}</div>
      <div style={{flex:1,background:"var(--bg-soft)",borderRadius:"var(--r-input)",padding:"13px 16px",borderTopLeftRadius:4}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:5,flexWrap:"wrap"}}>
          <span style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:13.5,color:"var(--ink)"}}>{n.auteur}</span>
          <span style={{fontSize:12.5,color:"var(--muted)"}}>{n.date_affichee||""}</span>
        </div>
        <p style={{margin:0,fontSize:14.5,color:"var(--ink)",lineHeight:1.55}}>{n.texte}</p>
      </div>
    </div>;})}
  </div>;
}

// ── Détails techniques repliables ─────────────────────────────
function TechDetails({ chantier: c }) {
  const [open,setOpen]=useState(false);
  const rows=[
    ["Référence affaire",c.enedis_ref_affaire],["N° prestation",c.enedis_delivery_id],
    ["N° contrat",c.enedis_contrat],["PDL",c.enedis_pdl],
    ["Type de prestation",c.enedis_type_prestation],["Statut Enedis",c.enedis_delivery_status],
    ["Date de demande",c.enedis_date_demande],["Date d'étude",c.enedis_date_etude],
    ["Date de travaux",c.enedis_date_travaux],["Coordonnées",c.enedis_lat?`${c.enedis_lat}, ${c.enedis_lng}`:null],
    ["Points d'arrêt",c.enedis_point_arret],
  ].filter(([,v])=>v);
  if (!rows.length) return null;
  return <Card pad={0} style={{overflow:"hidden"}}>
    <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",
      gap:11,padding:"16px 20px",background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>
      <Icon name="info" size={20} style={{color:"var(--slate)"}}/>
      <div style={{flex:1}}>
        <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:16,color:"var(--ink)"}}>Détails techniques</div>
        <div style={{fontSize:13,color:"var(--muted)"}}>Données Enedis / e-Plans (lecture seule)</div>
      </div>
      <Icon name={open?"chevD":"chevR"} size={20} style={{color:"var(--muted)"}}/>
    </button>
    {open&&<div style={{padding:"4px 20px 20px"}}>
      <div className="fb-tech-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 28px"}}>
        {rows.map(([k,v],i)=><div key={i} style={{borderTop:"1px solid var(--line)",paddingTop:10}}>
          <div style={{fontSize:11.5,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".05em",fontWeight:600,marginBottom:3}}>{k}</div>
          <div style={{fontSize:14,color:"var(--ink)",fontWeight:500,fontFamily:"var(--font-mono)",wordBreak:"break-word"}}>{v}</div>
        </div>)}
      </div>
    </div>}
  </Card>;
}

// ─── Documents client (upload + liste) ───────────────────────
function ClientDocumentsSection({ chantierId, docs, reload, showToast, readonly=false }) {
  const [nomCat,setNomCat]=useState('permis_construire');
  const [nomLibre,setNomLibre]=useState('');
  const [file,setFile]=useState(null);
  const [uploading,setUploading]=useState(false);

  const inputSt={padding:'8px 11px',border:'1px solid var(--line-strong)',borderRadius:'var(--r-input)',
    fontSize:13.5,fontFamily:'var(--font-body)',color:'var(--ink)',background:'#fff'};
  const nomFinal=nomCat==='autre'?nomLibre.trim():(CAT_LABELS[nomCat]||nomCat);

  const upload=async()=>{
    if (!file) return showToast('Fichier requis','error');
    if (!nomFinal) return showToast('Nom du document requis','error');
    setUploading(true);
    try {
      const fd=new FormData();
      fd.append('fichier',file);
      fd.append('nom',nomFinal);
      fd.append('categorie',nomCat==='autre'?'':nomCat);
      await apiFetch(`/api/client/chantiers/${chantierId}/documents`,{method:'POST',body:fd});
      setNomCat('permis_construire');setNomLibre('');setFile(null);
      reload();showToast('Document ajouté ✓');
    } catch(e){showToast(e.message,'error');}
    finally{setUploading(false);}
  };

  const deleteDoc=async(doc)=>{
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return;
    try {
      await apiFetch(`/api/client/chantiers/${chantierId}/documents/${doc.id}`,{method:'DELETE'});
      reload();showToast('Document supprimé ✓');
    } catch(e){showToast(e.message,'error');}
  };

  return <Card>
    <SectionTitle icon="file" right={<span style={{fontSize:13,color:"var(--muted)"}}>{docs.length} doc(s)</span>}>
      Mes documents
    </SectionTitle>
    {!readonly&&<div style={{background:'var(--bg-soft)',borderRadius:'var(--r-input)',padding:'14px 16px',marginBottom:16}}>
      <div style={{fontSize:13,fontFamily:'var(--font-head)',fontWeight:700,color:'var(--ink)',marginBottom:10}}>
        Ajouter un document
      </div>
      <div style={{display:'grid',gap:8}}>
        <select value={nomCat} onChange={e=>setNomCat(e.target.value)} style={{...inputSt,width:'100%',boxSizing:'border-box'}}>
          {DOC_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {nomCat==='autre'&&<input style={{...inputSt,width:'100%',boxSizing:'border-box'}}
          value={nomLibre} onChange={e=>setNomLibre(e.target.value)}/>}
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
        <Btn variant="dark" disabled={uploading||!nomFinal||!file} onClick={upload}>
          {uploading?'Upload…':'Ajouter'}
        </Btn>
      </div>
    </div>}
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
        {!readonly&&<button title="Supprimer" onClick={()=>deleteDoc(d)}
          style={{width:32,height:32,borderRadius:7,border:'1px solid var(--line-strong)',
            background:'#fff',cursor:'pointer',color:'var(--c-blocked)',
            display:'grid',placeItems:'center',flex:'0 0 auto'}}>
          <Icon name="trash" size={15}/>
        </button>}
      </div>)}
    </div>
  </Card>;
}

// ─── Photos client (upload + liste) ──────────────────────────
function ClientPhotosSection({ chantierId, photos, reload, showToast, readonly=false }) {
  const fileInputRef=useRef(null);
  const [uploading,setUploading]=useState(false);
  const [open,setOpen]=useState(null);

  const uploadPhotos=async(files)=>{
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const fd=new FormData();
        fd.append('photo',f);
        await apiFetch(`/api/client/chantiers/${chantierId}/photos`,{method:'POST',body:fd});
      }
      reload();showToast(`${files.length} photo(s) ajoutée(s) ✓`);
    } catch(e){showToast(e.message,'error');}
    finally{setUploading(false);}
  };

  const deletePhoto=async(id)=>{
    if (!confirm('Supprimer cette photo ?')) return;
    try {
      await apiFetch(`/api/client/chantiers/${chantierId}/photos/${id}`,{method:'DELETE'});
      reload();showToast('Photo supprimée ✓');
    } catch(e){showToast(e.message,'error');}
  };

  return <Card>
    <SectionTitle icon="camera" right={<span style={{fontSize:13,color:"var(--muted)"}}>{photos.length} photo(s)</span>}>
      Photos du chantier
    </SectionTitle>
    {!readonly&&<div onClick={()=>fileInputRef.current?.click()}
      onDragOver={e=>e.preventDefault()}
      onDrop={e=>{e.preventDefault();uploadPhotos([...e.dataTransfer.files]);}}
      style={{border:"2px dashed var(--line-strong)",background:"var(--bg-soft)",borderRadius:"var(--r-card)",
        padding:"22px 16px",textAlign:"center",cursor:"pointer",marginBottom:photos.length?16:0}}>
      <div style={{display:"inline-grid",placeItems:"center",width:44,height:44,borderRadius:999,
        background:"var(--jaune)",color:"#1a1a1a",marginBottom:8}}><Icon name="upload" size={22}/></div>
      <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:15,color:"var(--ink)"}}>
        {uploading?"Upload en cours…":"Ajouter des photos"}
      </div>
      <div style={{fontSize:13,color:"var(--slate)",marginTop:3}}>JPG, PNG, HEIC · max 20 Mo</div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
        capture="environment" onChange={e=>uploadPhotos([...e.target.files])}/>
    </div>}
    {photos.length===0&&readonly&&<p style={{color:'var(--muted)',fontSize:14,margin:0}}>Aucune photo.</p>}
    {photos.length>0&&<div style={{display:"grid",gap:10}}>
      {photos.map((p,i)=><div key={p.id} style={{display:"flex",gap:12,alignItems:"center",
        padding:10,border:"1px solid var(--line)",borderRadius:"var(--r-input)",background:"#fff"}}>
        <img src={p.url} alt="" className="fb-img" onClick={()=>setOpen(i)}
          style={{width:56,height:56,borderRadius:8,objectFit:"cover",flex:"0 0 auto",cursor:"pointer"}}/>
        <div style={{flex:1,minWidth:0,fontSize:13,color:"var(--muted)"}}>
          {p.legende||p.etape_label||"Sans légende"}
        </div>
        <button title="Télécharger" onClick={()=>downloadFile(p.url)}
          style={{width:32,height:32,borderRadius:7,border:"1px solid var(--line-strong)",
            background:"#fff",cursor:"pointer",color:"var(--slate)",display:"grid",placeItems:"center",flex:"0 0 auto"}}>
          <Icon name="download" size={15}/>
        </button>
        {!readonly&&<button title="Supprimer" onClick={()=>deletePhoto(p.id)}
          style={{width:32,height:32,borderRadius:7,border:"1px solid var(--line-strong)",
            background:"#fff",cursor:"pointer",color:"var(--c-blocked)",display:"grid",placeItems:"center",flex:"0 0 auto"}}>
          <Icon name="trash" size={15}/>
        </button>}
      </div>)}
    </div>}
    {open!==null&&<div onClick={()=>setOpen(null)} style={{position:"fixed",inset:0,zIndex:400,
      background:"rgba(0,0,0,.88)",display:"grid",placeItems:"center",padding:20}}>
      <img src={photos[open].url} alt="" className="fb-img"
        style={{maxWidth:"90vw",maxHeight:"85vh",borderRadius:12,objectFit:"contain"}}/>
    </div>}
  </Card>;
}

// ═════════════════════════════════════════════════════════════
//  GUIDE CLIENT — mode opératoire (création + suivi d'un chantier)
// ═════════════════════════════════════════════════════════════
export function GuideClient({ go, onLogout, isAdmin }) {
  // Étapes de création — fidèles au formulaire NouveauChantierClient (3 étapes).
  const createSteps = [
    { n:1, icon:"pin", titre:"Vos informations",
      texte:"Renseignez l'adresse du chantier, l'adresse de facturation et les informations principales de votre projet." },
    { n:2, icon:"file", titre:"Vos documents",
      texte:"Déposez les pièces du dossier. Trois sont obligatoires : le permis de construire, le plan de situation et le mandat. Le plan de masse et des photos sont facultatifs mais utiles." },
    { n:3, icon:"check", titre:"Validation",
      texte:"Vérifiez le récapitulatif puis envoyez votre demande. L'équipe FB ELEC la reçoit aussitôt et vous recontacte." },
  ];
  // Points de suivi — fidèles à la fiche chantier (timeline, e-mails, docs, contact…).
  const followCards = [
    { icon:"bolt", titre:"Suivez l'avancement",
      texte:"Chaque chantier affiche une frise d'étapes : terminée, en cours, à venir ou bloquée. Le badge coloré indique l'étape en cours d'un coup d'œil." },
    { icon:"mail", titre:"Soyez prévenu",
      texte:"À chaque étape franchie par FB ELEC, vous recevez un e-mail automatique. Inutile de vérifier en permanence." },
    { icon:"camera", titre:"Documents & photos",
      texte:"Consultez les documents et photos ajoutés par FB ELEC, et déposez vous-même de nouveaux fichiers depuis la fiche du chantier." },
    { icon:"alert", titre:"Action requise",
      texte:"Si une action de votre part est attendue, un bandeau « Action requise » apparaît sur le chantier concerné." },
    { icon:"phone", titre:"Restez en contact",
      texte:"Envoyez un message en un clic, ou appelez FB ELEC si besoin. Un bloc de contact est présent sur chaque page." },
    { icon:"settings", titre:"Modifiez vos infos",
      texte:"Besoin de corriger une adresse ou une date ? Le bouton « Modifier » sur la fiche du chantier met à jour vos informations." },
  ];

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/>
    <div className="fb-wrap" style={{paddingTop:22}}>
      <button onClick={()=>go("dashboard")} style={{display:"inline-flex",alignItems:"center",gap:7,
        background:"none",border:"none",cursor:"pointer",color:"var(--slate)",fontSize:14,
        fontFamily:"var(--font-head)",fontWeight:600,padding:0}}>
        <Icon name="arrowL" size={17}/>Mes chantiers
      </button>
    </div>

    <main className="fb-wrap" style={{paddingTop:20,paddingBottom:60}}>
      {/* Hero */}
      <div style={{position:"relative",overflow:"hidden",borderRadius:"var(--r-card)",
        background:"var(--noir)",color:"#fff",padding:"34px 30px",marginBottom:34}}>
        <div style={{position:"absolute",inset:0,
          background:"radial-gradient(circle at 100% 0%,rgba(245,197,24,.22),transparent 55%)"}}/>
        <div style={{position:"relative"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.1)",
            borderRadius:999,padding:"5px 12px",marginBottom:14}}>
            <Icon name="help" size={16} style={{color:"var(--jaune)"}}/>
            <span style={{fontSize:12.5,fontFamily:"var(--font-head)",fontWeight:700,
              letterSpacing:".06em",textTransform:"uppercase"}}>Guide d'utilisation</span>
          </div>
          <h1 style={{margin:"0 0 10px",fontFamily:"var(--font-display)",fontWeight:700,
            fontSize:"clamp(30px,5vw,44px)",textTransform:"uppercase",lineHeight:1.05}}>
            Créer et suivre<br/>votre chantier
          </h1>
          <p style={{margin:0,maxWidth:560,fontSize:16,color:"rgba(255,255,255,.8)",lineHeight:1.6}}>
            En quelques étapes simples, déposez votre demande de raccordement et suivez son
            avancement en temps réel, où que vous soyez.
          </p>
        </div>
      </div>

      {/* SECTION 1 — Créer un chantier */}
      <div style={{marginBottom:40}}>
        <SectionTitle icon="plus">Créer un chantier en 3 étapes</SectionTitle>
        <div className="fb-strip" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
          {createSteps.map(s=><Card key={s.n} pad={24} style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{position:"relative",width:48,height:48,borderRadius:14,flex:"0 0 auto",
                background:"var(--jaune)",display:"grid",placeItems:"center",color:"#1a1a1a"}}>
                <Icon name={s.icon} size={24}/>
                <span style={{position:"absolute",top:-8,right:-8,width:24,height:24,borderRadius:999,
                  background:"var(--noir)",color:"#fff",display:"grid",placeItems:"center",
                  fontFamily:"var(--font-head)",fontWeight:700,fontSize:13,
                  border:"2px solid var(--bg-soft)"}}>{s.n}</span>
              </div>
              <h3 style={{margin:0,fontFamily:"var(--font-head)",fontWeight:700,fontSize:18,color:"var(--ink)"}}>{s.titre}</h3>
            </div>
            <p style={{margin:0,fontSize:14.5,color:"var(--slate)",lineHeight:1.55}}>{s.texte}</p>
          </Card>)}
        </div>

        {/* Rappel documents obligatoires */}
        <div style={{marginTop:18,display:"flex",gap:13,alignItems:"flex-start",flexWrap:"wrap",
          padding:"16px 18px",borderRadius:"var(--r-card)",
          background:"color-mix(in srgb,var(--jaune) 12%,#fff)",
          border:"1px solid color-mix(in srgb,var(--jaune) 40%,transparent)"}}>
          <span style={{color:"var(--jaune-deep)",display:"flex",flex:"0 0 auto"}}><Icon name="info" size={20}/></span>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontFamily:"var(--font-head)",fontWeight:700,fontSize:15,color:"var(--ink)",marginBottom:3}}>
              Préparez vos documents obligatoires
            </div>
            <div style={{fontSize:14,color:"var(--slate)",lineHeight:1.5}}>
              {CAT_REQUIRED.map(k=>CAT_LABELS[k]).join(" · ")}. Formats acceptés : PDF, JPG, PNG.
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — Suivre son chantier */}
      <div style={{marginBottom:40}}>
        <SectionTitle icon="bolt">Suivre votre chantier au quotidien</SectionTitle>
        <div className="fb-strip" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
          {followCards.map((c,i)=><Card key={i} pad={22} style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,flex:"0 0 auto",
              background:"var(--bg-soft)",display:"grid",placeItems:"center",color:"var(--jaune-deep)"}}>
              <Icon name={c.icon} size={22}/>
            </div>
            <h3 style={{margin:0,fontFamily:"var(--font-head)",fontWeight:700,fontSize:16.5,color:"var(--ink)"}}>{c.titre}</h3>
            <p style={{margin:0,fontSize:14,color:"var(--slate)",lineHeight:1.55}}>{c.texte}</p>
          </Card>)}
        </div>
      </div>

      {/* CTA */}
      <Card pad={28} style={{textAlign:"center",background:"var(--noir)",borderColor:"var(--noir)"}}>
        <h2 style={{margin:"0 0 8px",fontFamily:"var(--font-display)",fontWeight:700,fontSize:28,
          textTransform:"uppercase",color:"#fff",letterSpacing:"-.01em"}}>Prêt à démarrer ?</h2>
        <p style={{margin:"0 0 20px",fontSize:15.5,color:"rgba(255,255,255,.78)"}}>
          Créez votre premier chantier ou retrouvez le suivi de vos demandes en cours.
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn variant="primary" icon="plus" onClick={()=>go("nouveau-chantier")}>Créer un chantier</Btn>
          <Btn variant="ghost" iconR="chevR" onClick={()=>go("dashboard")}
            style={{color:"#fff",borderColor:"rgba(255,255,255,.3)"}}>Voir mes chantiers</Btn>
        </div>
      </Card>
    </main>
    <Footer/>
  </div>;
}

// ═════════════════════════════════════════════════════════════
//  CRÉER UN CHANTIER (client)
// ═════════════════════════════════════════════════════════════
export function NouveauChantierClient({ go, onLogout, isAdmin }) {
  const [form,setForm]=useState({adresse:'',commune:'',code_postal:'',puissance_demandee:'',puissance_type:'',date_debut_chantier:'',terrain_viabilise:'',reference_client:''});
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
  const [gpsMode,setGpsMode]=useState(false);
  const [gps,setGps]=useState(null);
  const [factForcee,setFactForcee]=useState(false);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');
  const [step,setStep]=useState(1);

  const setF=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const setDoc=k=>e=>setDocs(d=>({...d,[k]:e.target.files[0]||null}));
  const addPhotos=e=>setPhotos(p=>[...p,...Array.from(e.target.files)]);
  const removePhoto=i=>setPhotos(p=>p.filter((_,j)=>j!==i));

  // Sans adresse, le point GPS la remplace ; la facturation doit alors être une vraie adresse postale.
  // L'adresse éventuellement tapée est conservée (non envoyée en mode GPS) pour un retour sans perte.
  const basculerGps=()=>{
    if (!gpsMode) {
      setGpsMode(true);
      if (factType==='identique') { setFactType('differente'); setFactForcee(true); if(!factReference) setFactReference(form.reference_client); }
    } else {
      setGpsMode(false); setGps(null);
      if (factForcee) { setFactType('identique'); setFactForcee(false); }
    }
  };
  const adresseChantier = gpsMode ? (gps?libelleGps(gps):'') : form.adresse;
  const adresseFact = factType==='identique'
    ? [form.adresse,form.code_postal,form.commune].filter(Boolean).join(', ')
    : [factAdresse,factCp,factCommune].filter(Boolean).join(', ');
  const dureeFinal = dureeMontant ? `${dureeMontant} ${dureeUnite}` : '';
  const canStep2 = adresseChantier&&form.commune&&form.puissance_demandee&&form.puissance_type
    &&form.date_debut_chantier&&dureeMontant&&form.terrain_viabilise&&form.reference_client.trim()
    &&(factType==='identique'||(factAdresse&&factCommune&&factReference.trim()));
  const canSubmit=CAT_REQUIRED.every(k=>docs[k]);

  async function submit() {
    if (!canSubmit) return setErr('Veuillez fournir les documents obligatoires (*).');
    setErr(''); setLoading(true);
    try {
      const chantier=await apiFetch('/api/client/chantiers',{method:'POST',body:{
        ...form, adresse_facturation:adresseFact, duree_chantier:dureeFinal,
        terrain_viabilise: form.terrain_viabilise==='oui',
        reference_facturation: factType==='differente'?factReference:'',
        facturation_telephone: factType==='differente'?factTelephone:'',
        facturation_email: factType==='differente'?factEmail:'',
        mandat_fourni: !!docs.mandat,
        commentaire: commentaire.trim(),
        adresse: gpsMode?'':form.adresse,
        gps_lat: gpsMode&&gps?gps.lat:null, gps_lng: gpsMode&&gps?gps.lng:null
      }});
      // Upload docs
      for (const [cat,file] of Object.entries(docs)) {
        if (!file) continue;
        const fd=new FormData();
        fd.append('fichier',file);
        fd.append('categorie',cat);
        fd.append('nom',CAT_LABELS[cat]);
        await apiFetch(`/api/client/chantiers/${chantier.id}/documents`,{method:'POST',body:fd});
      }
      // Upload photos
      for (const photo of photos) {
        const fd=new FormData();
        fd.append('photo',photo);
        await apiFetch(`/api/client/chantiers/${chantier.id}/photos`,{method:'POST',body:fd});
      }
      go('dashboard');
    } catch(e) { setErr(e.message||'Erreur lors de la création.'); }
    finally { setLoading(false); }
  }

  const inputSt={width:'100%',padding:'11px 14px',border:'1px solid var(--line)',borderRadius:'var(--r-input)',
    fontSize:15,fontFamily:'var(--font-body)',background:'#fff',boxSizing:'border-box'};
  const labelSt={display:'block',fontSize:13,fontFamily:'var(--font-head)',fontWeight:700,
    color:'var(--ink)',marginBottom:6};

  return <div style={{minHeight:'100vh',background:'var(--bg-soft)',display:'flex',flexDirection:'column'}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/>
    <div className="fb-wrap" style={{paddingTop:22}}>
      <button onClick={()=>go('dashboard')} style={{display:'inline-flex',alignItems:'center',gap:7,
        background:'none',border:'none',cursor:'pointer',color:'var(--slate)',fontSize:14,
        fontFamily:'var(--font-head)',fontWeight:600,padding:0}}>
        <Icon name="arrowL" size={17}/>Mes chantiers
      </button>
    </div>
    <main className="fb-wrap" style={{paddingTop:20,paddingBottom:60,maxWidth:680}}>
      <div style={{marginBottom:28}}>
        <p style={{margin:'0 0 4px',color:'var(--jaune-deep)',fontFamily:'var(--font-head)',fontWeight:700,
          letterSpacing:'.08em',fontSize:13,textTransform:'uppercase'}}>Nouvelle demande</p>
        <h1 style={{margin:0,fontFamily:'var(--font-display)',fontWeight:700,fontSize:36,
          textTransform:'uppercase',color:'var(--ink)',letterSpacing:'-.01em'}}>Créer un chantier</h1>
      </div>

      {/* Indicateur d'étapes */}
      <div style={{display:'flex',gap:8,rowGap:10,flexWrap:'wrap',marginBottom:28}}>
        {[['1','Informations'],['2','Documents'],['3','Validation']].map(([n,lbl])=>{
          const active=parseInt(n)===step,done=parseInt(n)<step;
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

      {/* ÉTAPE 1 — Informations */}
      {step===1&&<Card>
        <SectionTitle icon="pin">Informations du chantier</SectionTitle>
        <div style={{display:'grid',gap:16}}>
          <div>
            <label style={labelSt}>Référence *</label>
            <input style={inputSt} value={form.reference_client} onChange={setF('reference_client')}
              placeholder="Société ou nom du client"/>
          </div>
          <div>
            <label style={labelSt}>{gpsMode?'Emplacement du chantier *':'Adresse du chantier *'}</label>
            {gpsMode
              ? <CarteGps value={gps} onChange={setGps} commune={form.commune} codePostal={form.code_postal}
                  onLocalite={l=>setForm(f=>({...f,commune:l.commune||f.commune,code_postal:l.code_postal}))}/>
              : <AddressAutocomplete value={form.adresse}
                  onChange={v=>setForm(f=>({...f,adresse:v}))}
                  onSelect={a=>setForm(f=>({...f,adresse:a.adresse,
                    code_postal:a.code_postal||f.code_postal, commune:a.commune||f.commune}))}
                  inputStyle={inputSt} placeholder="ex. 12 rue des Acacias…"/>}
            <button type="button" onClick={basculerGps}
              style={{marginTop:8,display:'inline-flex',alignItems:'center',gap:6,background:'none',border:'none',
                padding:0,cursor:'pointer',color:'var(--jaune-deep)',fontFamily:'var(--font-head)',fontWeight:700,fontSize:13.5}}>
              <Icon name="pin" size={15}/>{gpsMode?"J'ai une adresse : la saisir":"Pas encore d'adresse ? Placer un point sur la carte"}
            </button>
          </div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div>
              <label style={labelSt}>Commune *</label>
              <input style={inputSt} value={form.commune} onChange={setF('commune')}/>
            </div>
            <div>
              <label style={labelSt}>Code postal</label>
              <input style={inputSt} value={form.code_postal} onChange={setF('code_postal')}/>
            </div>
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
              <option value="identique" disabled={gpsMode}>Identique à l'adresse du chantier</option>
              <option value="differente">Différente</option>
            </select>
            {gpsMode&&<div style={{marginTop:5,fontSize:12.5,color:'var(--muted)'}}>
              Chantier localisé par point GPS : indiquez une adresse postale de facturation.
            </div>}
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
            <div>
              <label style={labelSt}>Puissance demandée (kVA) *</label>
              <input style={inputSt} value={form.puissance_demandee} onChange={setF('puissance_demandee')}/>
            </div>
            <div>
              <label style={labelSt}>Type *</label>
              <select style={inputSt} value={form.puissance_type} onChange={setF('puissance_type')}>
                <option value="">— Sélectionner —</option>
                <option value="monophase">Monophasé</option>
                <option value="triphase">Triphasé</option>
              </select>
            </div>
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
          <Btn variant="dark" iconR="chevR" disabled={!canStep2} onClick={()=>canStep2&&setStep(2)}>
            Continuer
          </Btn>
        </div>
      </Card>}

      {/* ÉTAPE 2 — Documents */}
      {step===2&&<Card>
        <SectionTitle icon="file">Documents à fournir</SectionTitle>
        <p style={{margin:'0 0 18px',fontSize:14,color:'var(--slate)'}}>Les documents marqués * sont obligatoires pour traiter votre demande.</p>
        <div style={{display:'grid',gap:14}}>
          {Object.entries(CAT_LABELS).map(([cat,lbl])=>{
            const req=CAT_REQUIRED.includes(cat);
            const file=docs[cat];
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
                <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png"
                  onChange={setDoc(cat)}/>
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
            placeholder="Informations que vous jugez importantes pour votre chantier…"
            style={{...inputSt,resize:'vertical',lineHeight:1.5,fontSize:14.5}}/>
        </div>
        {err&&<p style={{margin:'14px 0 0',color:'var(--c-blocked)',fontSize:14}}>{err}</p>}
        <div style={{marginTop:22,display:'flex',gap:12,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setStep(1)}>Retour</Btn>
          <Btn variant="dark" iconR="chevR" disabled={!canSubmit} onClick={()=>canSubmit&&setStep(3)}>
            Continuer
          </Btn>
        </div>
      </Card>}

      {/* ÉTAPE 3 — Confirmation */}
      {step===3&&<Card>
        <SectionTitle icon="check">Récapitulatif</SectionTitle>
        <div style={{display:'grid',gap:10,marginBottom:20}}>
          {[
            ['Adresse',`${adresseChantier}, ${form.commune}${form.code_postal?' '+form.code_postal:''}`],
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
        <div style={{borderTop:'1px solid var(--line)',paddingTop:16,marginBottom:8}}>
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
        {commentaire.trim()&&<div style={{borderTop:'1px solid var(--line)',paddingTop:16,marginBottom:8}}>
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
                Téléchargez le mandat prérempli avec vos informations, à faire signer par votre client.
              </div>
            </div>
            <Btn variant="ghost" icon="download" loading={mandatLoading} onClick={async()=>{
              setMandatLoading(true);
              try {
                await downloadPdf('/api/client/mandat',{
                  reference: form.reference_client,
                  adresse: [adresseChantier, form.code_postal, form.commune].filter(Boolean).join(', '),
                  ville: form.commune,
                }, `Mandat-EDF-${(form.reference_client||'chantier').replace(/[^\w-]+/g,'_')}.pdf`);
              } catch(e){ setErr(e.message); }
              finally{ setMandatLoading(false); }
            }}>Télécharger le mandat (PDF)</Btn>
          </div>
        </div>}
        <p style={{fontSize:14,color:'var(--slate)',margin:'14px 0 18px',lineHeight:1.55}}>
          En validant, votre demande sera transmise à l'équipe FB ELEC qui vous contactera sous 48h.
        </p>
        {err&&<p style={{margin:'0 0 12px',color:'var(--c-blocked)',fontSize:14}}>{err}</p>}
        <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>setStep(2)}>Retour</Btn>
          <Btn variant="dark" disabled={loading} onClick={submit}>
            {loading?'Envoi en cours…':'Envoyer ma demande'}
          </Btn>
        </div>
      </Card>}
    </main>
    <Footer/>
  </div>;
}

// ═════════════════════════════════════════════════════════════
//  MODIFIER LES INFOS D'UN CHANTIER (client)
// ═════════════════════════════════════════════════════════════
export function EditChantierInfos({ chantierId, go, onLogout, isAdmin }) {
  const [form,setForm]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState('');

  useEffect(()=>{
    apiFetch(`/api/client/chantiers/${chantierId}`).then(c=>{
      setForm({
        adresse:c.adresse||'', commune:c.commune||'', code_postal:c.code_postal||'',
        adresse_facturation:c.adresse_facturation||'', puissance_demandee:c.puissance_demandee||'',
        date_debut_chantier:c.date_debut_chantier?.slice(0,10)||'', duree_chantier:c.duree_chantier||'',
        terrain_viabilise: c.terrain_viabilise===true?'oui':c.terrain_viabilise===false?'non':'',
        puissance_type: c.puissance_type||'',
      });
    }).catch(console.error).finally(()=>setLoading(false));
  },[chantierId]);

  const setF=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const inputSt={width:'100%',padding:'11px 14px',border:'1px solid var(--line)',borderRadius:'var(--r-input)',
    fontSize:15,fontFamily:'var(--font-body)',background:'#fff',boxSizing:'border-box'};
  const labelSt={display:'block',fontSize:13,fontFamily:'var(--font-head)',fontWeight:700,color:'var(--ink)',marginBottom:6};

  async function save() {
    setErr(''); setSaving(true);
    try {
      await apiFetch(`/api/client/chantiers/${chantierId}/infos`,{method:'PUT',body:{
        ...form, terrain_viabilise: form.terrain_viabilise===''?null:form.terrain_viabilise==='oui',
      }});
      go('detail');
    } catch(e) { setErr(e.message||'Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  }

  if (loading||!form) return <div style={{minHeight:'100vh',background:'var(--bg-soft)',display:'flex',flexDirection:'column'}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/><div className="fb-spinner"/></div>;

  return <div style={{minHeight:'100vh',background:'var(--bg-soft)',display:'flex',flexDirection:'column'}}>
    <AppHeader go={go} admin={false} isAdmin={isAdmin} onLogout={onLogout}/>
    <div className="fb-wrap" style={{paddingTop:22}}>
      <button onClick={()=>go('detail')} style={{display:'inline-flex',alignItems:'center',gap:7,
        background:'none',border:'none',cursor:'pointer',color:'var(--slate)',fontSize:14,
        fontFamily:'var(--font-head)',fontWeight:600,padding:0}}>
        <Icon name="arrowL" size={17}/>Retour au chantier
      </button>
    </div>
    <main className="fb-wrap" style={{paddingTop:20,paddingBottom:60,maxWidth:680}}>
      <h1 style={{margin:'0 0 24px',fontFamily:'var(--font-display)',fontWeight:700,fontSize:32,
        textTransform:'uppercase',color:'var(--ink)',letterSpacing:'-.01em'}}>Modifier les informations</h1>
      <Card>
        <div style={{display:'grid',gap:16}}>
          <div><label style={labelSt}>Adresse des travaux</label>
            <AddressAutocomplete value={form.adresse}
              onChange={v=>setForm(f=>({...f,adresse:v}))}
              onSelect={a=>setForm(f=>({...f,adresse:a.adresse,
                code_postal:a.code_postal||f.code_postal, commune:a.commune||f.commune}))}
              inputStyle={inputSt} placeholder="ex. 12 rue des Acacias…"/></div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div><label style={labelSt}>Commune</label>
              <input style={inputSt} value={form.commune} onChange={setF('commune')}/></div>
            <div><label style={labelSt}>Code postal</label>
              <input style={inputSt} value={form.code_postal} onChange={setF('code_postal')}/></div>
          </div>
          <div><label style={labelSt}>Adresse de facturation</label>
            <AddressAutocomplete value={form.adresse_facturation}
              onChange={v=>setForm(f=>({...f,adresse_facturation:v}))}
              onSelect={a=>setForm(f=>({...f,adresse_facturation:[a.adresse,[a.code_postal,a.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ')}))}
              inputStyle={inputSt} placeholder="ex. 5 avenue Victor Hugo…"/></div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div><label style={labelSt}>Puissance demandée (kVA)</label>
              <input style={inputSt} value={form.puissance_demandee} onChange={setF('puissance_demandee')}/></div>
            <div><label style={labelSt}>Type</label>
              <select style={inputSt} value={form.puissance_type} onChange={setF('puissance_type')}>
                <option value="">— Non renseigné —</option>
                <option value="monophase">Monophasé</option>
                <option value="triphase">Triphasé</option>
              </select></div>
          </div>
          <div className="fb-form2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div><label style={labelSt}>Durée prévisionnelle</label>
              <input style={inputSt} value={form.duree_chantier} onChange={setF('duree_chantier')}/></div>
          </div>
          <div style={{maxWidth:300}}>
            <label style={labelSt}>Terrain viabilisé</label>
            <select style={inputSt} value={form.terrain_viabilise} onChange={setF('terrain_viabilise')}>
              <option value="">— Non renseigné —</option>
              <option value="oui">Oui</option>
              <option value="non">Non</option>
            </select>
          </div>
          <div style={{maxWidth:240}}>
            <label style={labelSt}>Date de début souhaitée</label>
            <input type="date" style={inputSt} value={form.date_debut_chantier} onChange={setF('date_debut_chantier')}/>
          </div>
        </div>
        {err&&<p style={{margin:'12px 0 0',color:'var(--c-blocked)',fontSize:14}}>{err}</p>}
        <div style={{marginTop:22,display:'flex',gap:12,justifyContent:'flex-end'}}>
          <Btn variant="ghost" onClick={()=>go('detail')}>Annuler</Btn>
          <Btn variant="dark" disabled={saving} onClick={save}>{saving?'Enregistrement…':'Enregistrer'}</Btn>
        </div>
      </Card>
    </main>
    <Footer/>
  </div>;
}

// ═════════════════════════════════════════════════════════════
//  ÉCRAN CHANGEMENT DE CODE (premier login client)
// ═════════════════════════════════════════════════════════════
export function ChangeCode({ onDone }) {
  const [code,setCode]=useState("");
  const [confirm,setConfirm]=useState("");
  const [show,setShow]=useState(false);
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);

  const submit = async e => {
    e.preventDefault();
    if (code.length < 6) {setErr("Le code doit faire au moins 6 caractères.");return;}
    if (code !== confirm) {setErr("Les deux codes ne correspondent pas.");return;}
    setLoading(true);setErr("");
    try {
      await apiFetch('/api/auth/client/change-code',{method:'POST',body:{new_code:code}});
      onDone();
    } catch(e){setErr(e.message);}
    finally{setLoading(false);}
  };

  return <div style={{minHeight:"100vh",background:"var(--bg-soft)",display:"flex",flexDirection:"column"}}>
    <div style={{background:"#fff",borderBottom:"1px solid var(--line)"}}>
      <div className="fb-wrap" style={{height:70,display:"flex",alignItems:"center"}}>
        <Logo height={40} onClick={()=>window.location.href='https://suividechantier.fbelec.fr'}/>
      </div>
    </div>
    <div style={{flex:1,display:"grid",placeItems:"center",padding:"40px 20px"}}>
      <div style={{maxWidth:440,width:"100%"}}>
        <div style={{background:"#fff",border:"1px solid var(--line)",borderRadius:"var(--r-card)",
          padding:40,boxShadow:"var(--shadow-lg)"}}>
          <div style={{width:52,height:52,borderRadius:999,background:"var(--jaune)",
            display:"grid",placeItems:"center",marginBottom:20}}>
            <Icon name="lock" size={26}/>
          </div>
          <h1 style={{margin:"0 0 8px",fontFamily:"var(--font-head)",fontWeight:700,fontSize:24,color:"var(--ink)"}}>
            Choisissez votre mot de passe
          </h1>
          <p style={{margin:"0 0 28px",fontSize:15,color:"var(--slate)",lineHeight:1.55}}>
            Pour sécuriser votre compte, définissez un mot de passe personnel.<br/>
            Vous l'utiliserez à chaque connexion.
          </p>
          <form onSubmit={submit} style={{display:"grid",gap:16}}>
            <label style={{display:"block"}}>
              <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>
                Nouveau mot de passe (min. 6 caractères)
              </span>
              <span style={{display:"flex",alignItems:"center",gap:10,padding:"0 14px",background:"#fff",
                border:"1.5px solid var(--line-strong)",borderRadius:"var(--r-input)",height:50}}>
                <span style={{color:"var(--muted)",display:"flex"}}><Icon name="lock" size={19}/></span>
                <input type={show?"text":"password"} value={code} onChange={e=>setCode(e.target.value)}
                  placeholder="Choisissez un mot de passe"
                  style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:15.5,color:"var(--ink)",minWidth:0}}/>
                <button type="button" onClick={()=>setShow(s=>!s)}
                  style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",display:"flex",padding:0}}>
                  <Icon name={show?"eyeOff":"eye"} size={18}/>
                </button>
              </span>
            </label>
            <label style={{display:"block"}}>
              <span style={{display:"block",fontSize:13.5,fontWeight:600,color:"var(--ink)",marginBottom:7}}>
                Confirmer le mot de passe
              </span>
              <span style={{display:"flex",alignItems:"center",gap:10,padding:"0 14px",background:"#fff",
                border:"1.5px solid var(--line-strong)",borderRadius:"var(--r-input)",height:50}}>
                <span style={{color:"var(--muted)",display:"flex"}}><Icon name="lock" size={19}/></span>
                <input type={show?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)}
                  placeholder="Répétez votre mot de passe"
                  style={{flex:1,border:"none",outline:"none",background:"transparent",fontSize:15.5,color:"var(--ink)",minWidth:0}}/>
              </span>
            </label>
            {err&&<div style={{color:"var(--c-blocked-ink)",fontSize:14,display:"flex",gap:8,alignItems:"center",
              background:"color-mix(in srgb,var(--c-blocked) 8%,#fff)",padding:"10px 14px",borderRadius:"var(--r-input)"}}>
              <Icon name="alert" size={16}/>{err}
            </div>}
            <Btn variant="primary" size="lg" full type="submit" iconR="chevR" loading={loading}>
              Valider mon mot de passe
            </Btn>
          </form>
        </div>
      </div>
    </div>
    <Footer/>
  </div>;
}
