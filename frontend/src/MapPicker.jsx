import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fonds libres et sans clé : OpenStreetMap (plan) + IGN Géoplateforme (photo aérienne, cadastre).
// Schémas https explicites assumés (services tiers fixes, jamais en mixed-content).
const IGN = (layer, style, format) =>
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
  + `&LAYER=${layer}&STYLE=${encodeURIComponent(style)}&TILEMATRIXSET=PM`
  + `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`;
const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';
const GEO_URL = 'https://geo.api.gouv.fr/communes';
const FRANCE = [46.6, 2.4];

const pin = L.divIcon({ className: 'fb-map-pin', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 29] });

// Carte de localisation : clic = place le point (déplaçable). Le point remplace l'adresse
// quand elle n'existe pas encore. onLocalite reçoit la commune qui CONTIENT le point.
export default function MapPicker({ value, onChange, commune, codePostal, onLocalite }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onChange, onLocalite, codePostal };

  useEffect(() => {
    // Double-clic désactivé : sinon zoomer par double-clic place aussi le point.
    const map = L.map(boxRef.current, { scrollWheelZoom: false, doubleClickZoom: false });
    const plan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap' });
    const photo = L.tileLayer(IGN('ORTHOIMAGERY.ORTHOPHOTOS', 'normal', 'image/jpeg'),
      { maxZoom: 19, attribution: '© IGN' });
    const cadastre = L.tileLayer(IGN('CADASTRALPARCELS.PARCELLAIRE_EXPRESS', 'PCI vecteur', 'image/png'),
      { minZoom: 14, maxZoom: 19, attribution: '© IGN' });
    // Vue aérienne par défaut : repérer un terrain sans adresse (lot, parcelle nue).
    photo.addTo(map);
    L.control.layers({ 'Vue aérienne': photo, 'Plan': plan }, { 'Cadastre': cadastre }).addTo(map);

    const localiser = async (p) => {
      try {
        const r = await fetch(`${GEO_URL}?lat=${p.lat}&lon=${p.lng}&fields=nom,codesPostaux&format=json`);
        const c = (await r.json())?.[0];
        if (c) {
          // Code postal : celui saisi s'il appartient à la commune, sinon l'unique code de la
          // commune ; vide si la commune en a plusieurs (l'utilisateur le précise).
          const cps = c.codesPostaux || [];
          const saisi = (cbRef.current.codePostal || '').trim();
          const cp = cps.includes(saisi) ? saisi : (cps.length === 1 ? cps[0] : '');
          cbRef.current.onLocalite?.({ commune: c.nom, code_postal: cp });
        }
      } catch { /* hors ligne : la commune reste saisissable à la main */ }
    };

    // Marqueur posé là où l'utilisateur a cliqué ; coordonnées transmises ramenées dans ±180°.
    const placer = (latlng, notifier = true) => {
      const w = L.latLng(latlng).wrap();
      const p = { lat: +w.lat.toFixed(6), lng: +w.lng.toFixed(6) };
      if (!markerRef.current) {
        markerRef.current = L.marker(latlng, { icon: pin, draggable: true }).addTo(map);
        markerRef.current.on('dragend', e => placer(e.target.getLatLng()));
      } else markerRef.current.setLatLng(latlng);
      if (notifier) { cbRef.current.onChange?.(p); localiser(p); }
    };

    map.on('click', e => placer(e.latlng));
    if (value) { placer(value, false); map.setView([value.lat, value.lng], 17); }
    else map.setView(FRANCE, 6);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tant qu'aucun point n'est placé, la carte se centre sur la commune saisie.
  useEffect(() => {
    if (markerRef.current || !commune || commune.trim().length < 2) return;
    const t = setTimeout(async () => {
      try {
        const cp = /^\d{5}$/.test(codePostal || '') ? `&postcode=${codePostal}` : '';
        const r = await fetch(`${BAN_URL}?q=${encodeURIComponent(commune)}&type=municipality&limit=1${cp}`);
        const f = (await r.json())?.features?.[0];
        if (f && mapRef.current && !markerRef.current) {
          mapRef.current.setView([f.geometry.coordinates[1], f.geometry.coordinates[0]], 14);
        }
      } catch { /* centrage indicatif, sans effet si le service ne répond pas */ }
    }, 500);
    return () => clearTimeout(t);
  }, [commune, codePostal]);

  return <div ref={boxRef} className="fb-map"/>;
}
