import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { communeDuPoint, centreCommune } from './carte.js';

// Carte de SECOURS (si Google Maps ne se charge pas) : fonds libres et sans clé, OpenStreetMap
// (plan) + IGN Géoplateforme (photo aérienne, cadastre).
// Schémas https explicites assumés (services tiers fixes, jamais en mixed-content).
const IGN = (layer, style, format) =>
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
  + `&LAYER=${layer}&STYLE=${encodeURIComponent(style)}&TILEMATRIXSET=PM`
  + `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`;
const FRANCE = [46.6, 2.4];

const pin = L.divIcon({ className: 'fb-map-pin', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 29] });

// Carte de localisation : clic = place le point (déplaçable). Le point remplace l'adresse
// quand elle n'existe pas encore. onLocalite reçoit la commune qui CONTIENT le point.
export default function MapPicker({ value, onChange, centre, commune, codePostal, onLocalite }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const cbRef = useRef({});
  cbRef.current = { onChange, onLocalite, codePostal };
  const centreRef = useRef(centre);
  centreRef.current = centre;
  const centreInitial = useRef(centre);

  useEffect(() => {
    // Double-clic désactivé : sinon zoomer par double-clic place aussi le point.
    // Mobile : un doigt fait défiler la page, deux doigts déplacent/zooment la carte.
    const map = L.map(boxRef.current, { scrollWheelZoom: false, doubleClickZoom: false, dragging: !L.Browser.mobile });
    const plan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap' });
    const photo = L.tileLayer(IGN('ORTHOIMAGERY.ORTHOPHOTOS', 'normal', 'image/jpeg'),
      { maxZoom: 19, attribution: '© IGN' });
    const cadastre = L.tileLayer(IGN('CADASTRALPARCELS.PARCELLAIRE_EXPRESS', 'PCI vecteur', 'image/png'),
      { minZoom: 14, maxZoom: 19, attribution: '© IGN' });
    // Vue aérienne par défaut : repérer un terrain sans adresse (lot, parcelle nue).
    photo.addTo(map);
    L.control.layers({ 'Vue aérienne': photo, 'Plan': plan }, { 'Cadastre': cadastre }).addTo(map);

    // Seule la réponse du dernier point placé renseigne commune et code postal.
    let dernier = 0;
    const localiser = async (p) => {
      const n = ++dernier;
      const loc = await communeDuPoint(p, cbRef.current.codePostal);
      if (loc && n === dernier) cbRef.current.onLocalite?.(loc);
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

  // Adresse choisie dans la liste : la carte zoome dessus, le point reste à placer ou à déplacer.
  // Au montage avec un point déjà placé (retour depuis l'étape 2), la vue reste sur le point.
  useEffect(() => {
    if (!centre || !mapRef.current) return;
    if (centre === centreInitial.current && value) return;
    mapRef.current.setView([centre.lat, centre.lng], centre.zoom);
  }, [centre]); // eslint-disable-line react-hooks/exhaustive-deps

  // Point retiré depuis le formulaire : le marqueur disparaît, un clic en replace un.
  useEffect(() => {
    if (!value && markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
  }, [value]);

  // Tant qu'aucun point n'est placé ni aucune adresse choisie, la carte se centre sur la commune saisie.
  useEffect(() => {
    if (markerRef.current || centreRef.current || !commune || commune.trim().length < 2) return;
    const t = setTimeout(async () => {
      const c = await centreCommune(commune, codePostal);
      if (c && mapRef.current && !markerRef.current && !centreRef.current) mapRef.current.setView([c.lat, c.lng], 14);
    }, 500);
    return () => clearTimeout(t);
  }, [commune, codePostal]);

  return <div ref={boxRef} className="fb-map"/>;
}
