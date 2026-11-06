import { useEffect, useRef, useState } from 'react';
import { communeDuPoint, centreCommune } from './carte.js';

// Clé Maps JavaScript API : publique par nature (visible dans le navigateur) ; sa protection =
// restriction aux domaines du site + à cette seule API, côté Google Cloud (SECURITY_AUDIT.md).
const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
const FRANCE = { lat: 46.6, lng: 2.4 };
const DELAI_CHARGEMENT = 10000;

// Parcelles cadastrales IGN (gratuites) superposées à l'imagerie Google, visibles en zoomant.
const CADASTRE_ZOOM = [15, 19];
const TAILLE_BOUTONS = 30;
const cadastreUrl = (x, y, z) => 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
  + '&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=PCI%20vecteur&TILEMATRIXSET=PM'
  + `&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/png`;

// Erreur Google mémorisée pour la session : clé refusée (Google appelle gm_authFailure, une
// seule fois par page) ou carte dégradée — facturation, quota… — que Google signale uniquement
// dans la console (« Google Maps JavaScript API error: … », messages documentés). La carte
// affichée, s'il y en a une, bascule alors sur la carte IGN de secours.
let erreurGoogle = false;
let surErreur = null;
const signalerErreur = () => { erreurGoogle = true; surErreur?.(); };

// Chargement unique du script Google (balise script, sans dépendance npm).
let chargement = null;
function chargerGoogle() {
  if (!chargement) {
    window.gm_authFailure = signalerErreur;
    if (!console.error.__fbCarte) {
      const consoleError = console.error;
      const espion = function (...args) {
        if (typeof args[0] === 'string' && args[0].startsWith('Google Maps JavaScript API error')) signalerErreur();
        return consoleError.apply(this, args);
      };
      espion.__fbCarte = true;
      console.error = espion;
    }
    chargement = new Promise((ok, ko) => {
      window.__fbGoogleMapsPret = () => ok();
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(KEY)
        + '&v=weekly&loading=async&language=fr&region=FR&callback=__fbGoogleMapsPret';
      s.async = true;
      s.onerror = () => { chargement = null; s.remove(); ko(new Error('Google Maps injoignable')); };
      document.head.appendChild(s);
    }).then(() => Promise.all(['core', 'maps', 'marker'].map(l => window.google.maps.importLibrary(l))));
  }
  return chargement;
}

// Carte de localisation Google : clic = place le point (marqueur déplaçable). Le point remplace
// l'adresse quand elle n'existe pas encore. onLocalite reçoit la commune qui CONTIENT le point.
// onEchec : Google indisponible (script bloqué, délai dépassé, clé refusée, carte dégradée)
// → carte de secours.
export default function MapGoogle({ value, onChange, centre, commune, codePostal, onLocalite, onEchec }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onChange, onLocalite, codePostal, onEchec };
  const [prete, setPrete] = useState(false); // carte créée (le script Google arrive après le rendu)
  const centreRef = useRef(centre);
  centreRef.current = centre;
  const centreInitial = useRef(centre);

  useEffect(() => {
    let actif = true;
    const echec = () => { if (actif) { actif = false; cbRef.current.onEchec?.(); } };
    if (erreurGoogle) { echec(); return; }
    surErreur = echec;
    const delai = setTimeout(echec, DELAI_CHARGEMENT);

    chargerGoogle().then(([core, maps, marker]) => {
      clearTimeout(delai);
      if (!actif) return;
      if (erreurGoogle) { echec(); return; }
      const map = new maps.Map(boxRef.current, {
        center: value || FRANCE, zoom: value ? 17 : 6, maxZoom: CADASTRE_ZOOM[1],
        mapTypeId: 'hybrid', tilt: 0,
        mapTypeControl: false, // remplacé par des boutons compacts (voir plus bas)
        fullscreenControl: true, streetViewControl: false, rotateControl: false,
        controlSize: TAILLE_BOUTONS, // boutons compacts (40 px par défaut)
        // Défilement de la page conservé (deux doigts / Ctrl + molette pour la carte) ;
        // double-clic désactivé : sinon zoomer par double-clic place aussi le point.
        gestureHandling: 'cooperative', disableDoubleClickZoom: true, clickableIcons: false,
      });

      const calqueCadastre = new maps.ImageMapType({
        name: 'Cadastre', tileSize: new core.Size(256, 256),
        getTileUrl: (c, z) => {
          if (z < CADASTRE_ZOOM[0] || z > CADASTRE_ZOOM[1]) return null;
          const n = 2 ** z;
          return cadastreUrl(((c.x % n) + n) % n, c.y, z);
        },
      });
      map.overlayMapTypes.push(calqueCadastre);
      const ign = document.createElement('div');
      ign.textContent = 'Cadastre © IGN';
      ign.style.cssText = 'font:10px Roboto,Arial,sans-serif;color:#444;background:rgba(255,255,255,.7);padding:0 6px;line-height:14px';
      map.controls[core.ControlPosition.BOTTOM_RIGHT].push(ign);

      // Boutons compacts Plan / Satellite / Cadastre sur une ligne (ceux de Google gardent un texte en 18 px).
      const barre = document.createElement('div');
      barre.style.cssText = `margin:${Math.round(TAILLE_BOUTONS/3)}px 0 0 ${Math.round(TAILLE_BOUTONS/3)}px;display:flex;gap:6px`;
      const bouton = (texte, titre) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = texte;
        b.title = titre;
        b.style.cssText = `height:${TAILLE_BOUTONS}px;padding:0 10px;border:0;border-radius:2px;background:#fff;`
          + 'box-shadow:rgba(0,0,0,.3) 0 1px 4px -1px;font:13px Roboto,Arial,sans-serif;cursor:pointer';
        barre.appendChild(b);
        return b;
      };
      const marquer = (b, actif) => {
        b.setAttribute('aria-pressed', String(actif));
        b.style.color = actif ? '#000' : '#666';
        b.style.fontWeight = actif ? '500' : '400';
      };
      const bPlan = bouton('Plan', 'Afficher le plan');
      const bSat = bouton('Satellite', 'Afficher la vue satellite');
      const bCad = bouton('Cadastre', 'Afficher ou masquer le cadastre');
      const majFond = () => { const sat = map.getMapTypeId() !== 'roadmap'; marquer(bPlan, !sat); marquer(bSat, sat); };
      const majCad = actifCad => { marquer(bCad, actifCad); ign.style.display = actifCad ? '' : 'none'; };
      bPlan.addEventListener('click', () => { map.setMapTypeId('roadmap'); majFond(); });
      bSat.addEventListener('click', () => { map.setMapTypeId('hybrid'); majFond(); });
      bCad.addEventListener('click', () => {
        const actifCad = map.overlayMapTypes.getLength() === 0;
        if (actifCad) map.overlayMapTypes.push(calqueCadastre); else map.overlayMapTypes.clear();
        majCad(actifCad);
      });
      majFond(); majCad(true);
      map.controls[core.ControlPosition.TOP_LEFT].push(barre);

      // Seule la réponse du dernier point placé renseigne commune et code postal.
      let dernier = 0;
      const localiser = async (p) => {
        const n = ++dernier;
        const loc = await communeDuPoint(p, cbRef.current.codePostal);
        if (loc && n === dernier) cbRef.current.onLocalite?.(loc);
      };
      // Coordonnées transmises : 6 décimales, longitude ramenée dans ±180°.
      const placer = (pos, notifier = true) => {
        const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
        const p = { lat: +lat.toFixed(6), lng: +((((lng + 180) % 360) + 360) % 360 - 180).toFixed(6) };
        if (!markerRef.current) {
          markerRef.current = new marker.Marker({ map, position: p, draggable: true });
          markerRef.current.addListener('dragend', e => placer(e.latLng));
        } else markerRef.current.setPosition(p);
        if (notifier) { cbRef.current.onChange?.(p); localiser(p); }
      };

      map.addListener('click', e => placer(e.latLng));
      if (value) placer(value, false);
      mapRef.current = map;
      setPrete(true);
    }).catch(echec);

    return () => {
      actif = false;
      clearTimeout(delai);
      if (surErreur === echec) surErreur = null;
      if (mapRef.current) window.google?.maps?.event?.clearInstanceListeners(mapRef.current);
      markerRef.current?.setMap(null);
      mapRef.current = null; markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Adresse choisie dans la liste : la carte zoome dessus, le point reste à placer ou à déplacer.
  // Au montage avec un point déjà placé (retour depuis l'étape 2), la vue reste sur le point.
  useEffect(() => {
    if (!prete || !centre || !mapRef.current) return;
    if (centre === centreInitial.current && value) return;
    mapRef.current.setCenter({ lat: centre.lat, lng: centre.lng });
    mapRef.current.setZoom(centre.zoom);
  }, [prete, centre]); // eslint-disable-line react-hooks/exhaustive-deps

  // Point retiré depuis le formulaire : le marqueur disparaît, un clic en replace un.
  useEffect(() => {
    if (!value && markerRef.current) { markerRef.current.setMap(null); markerRef.current = null; }
  }, [value]);

  // Tant qu'aucun point n'est placé ni aucune adresse choisie, la carte se centre sur la commune saisie.
  useEffect(() => {
    if (!prete || markerRef.current || centreRef.current || !commune || commune.trim().length < 2) return;
    const t = setTimeout(async () => {
      const c = await centreCommune(commune, codePostal);
      if (c && mapRef.current && !markerRef.current && !centreRef.current) { mapRef.current.setCenter(c); mapRef.current.setZoom(14); }
    }, 500);
    return () => clearTimeout(t);
  }, [prete, commune, codePostal]);

  return <div style={{position:'relative'}}>
    <div ref={boxRef} className="fb-map"/>
    {!prete&&<div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',color:'var(--muted)',fontSize:14,pointerEvents:'none'}}>
      Chargement de la carte…
    </div>}
  </div>;
}
