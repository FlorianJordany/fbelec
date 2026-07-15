import { useState } from 'react';
import { Btn } from './ui.jsx';
import {
  Login, Dashboard, ChantierDetail, NouveauChantierClient,
  EditChantierInfos, ChangeCode, GuideClient,
} from './client.jsx';
import {
  AdminList, AdminNouveauChantier, AdminChantier,
  AdminEtapes, AdminClients, AdminSocietes, AdminVueClient,
} from './admin.jsx';

export default function App() {
  const detectRole = () => {
    try {
      const token=localStorage.getItem('fb_token');
      if (!token) return null;
      const payload=JSON.parse(atob(token.split('.')[1]));
      if (payload.exp&&payload.exp<Date.now()/1000){localStorage.removeItem('fb_token');return null;}
      return payload.role;
    } catch { return null; }
  };

  const getUrlChantier = () => {
    const p = new URLSearchParams(window.location.search);
    const id = parseInt(p.get('chantier'));
    return id || null;
  };

  const [role,setRole]=useState(()=>detectRole());
  const [view,setView]=useState(()=>{
    const r=detectRole();
    if (!r) return "login";
    if (getUrlChantier()) return r==="client"?"detail":"admin-chantier";
    return r==="client"?"dashboard":"admin-list";
  });
  const [cid,setCid]=useState(()=>getUrlChantier());

  const go = v => { setView(v); window.scrollTo(0,0); };
  const openChantier = id => { setCid(id); go(role==="client"?"detail":"admin-chantier"); };
  const openVueChantier = id => { setCid(id); go("admin-vue-chantier"); };

  const onLogin = (user, mustChangeCode=false) => {
    const r=detectRole();
    setRole(r);
    if (mustChangeCode) { go("change-code"); return; }
    const chId = getUrlChantier();
    if (chId) { setCid(chId); setView(r==="client"?"detail":"admin-chantier"); return; }
    go(r==="client"?"dashboard":"admin-list");
  };

  const onLogout = () => {
    localStorage.removeItem('fb_token');
    localStorage.removeItem('fb_client');
    setRole(null);
    go("login");
  };

  if (view==="login") return <Login onLogin={onLogin}/>;
  if (view==="change-code") return <ChangeCode onDone={()=>go("dashboard")}/>;
  const ia = role==='admin';
  if (view==="dashboard") return <Dashboard go={go} openChantier={openChantier} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="guide") return <GuideClient go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="nouveau-chantier") return <NouveauChantierClient go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="detail"&&cid) return <ChantierDetail chantierId={cid} go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="edit-chantier"&&cid) return <EditChantierInfos chantierId={cid} go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-list") return <AdminList go={go} openChantier={openChantier} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-nouveau-chantier") return <AdminNouveauChantier go={go} openChantier={openChantier} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-chantier"&&cid) return <AdminChantier chantierId={cid} go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-etapes") return <AdminEtapes go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-clients") return <AdminClients go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-societes") return <AdminSocietes go={go} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-vue-client") return <AdminVueClient go={go} openVueChantier={openVueChantier} onLogout={onLogout} isAdmin={ia}/>;
  if (view==="admin-vue-chantier"&&cid) return <ChantierDetail chantierId={cid} go={go} onLogout={onLogout} isAdmin={ia} backTo="admin-vue-client" apiBase="/api/admin/vue-client/chantiers"/>;
  return <div style={{padding:40,textAlign:"center"}}>
    <Btn variant="dark" onClick={()=>go(role==="client"?"dashboard":"admin-list")}>Retour</Btn>
  </div>;
}
