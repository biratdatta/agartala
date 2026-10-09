import * as THREE from 'three';
import { clamp } from '../shared/rng.js';
import './styles.css';
import { CITIES, kmFromCity } from '../shared/geo.js';
import { currentMission, missionIndex, missionText } from '../shared/missions.js';
import { RINA } from '../shared/farm.js';
import { SPOTS } from '../shared/spots.js';
import { standByKey, standsFor, type HomeSite, type Stand } from '../shared/stands.js';
import { SIGHTS, dailyDeliveries, deliveryById } from '../shared/errands.js';
import { isNight } from '../shared/time.js';
import { festivalsOn, isFestival } from '../shared/festivals.js';
import { HOME } from '../shared/farm.js';
import { tripOpen, type Trip } from '../shared/trips.js';
import type { ItemKey } from '../shared/constants.js';
import { Ambience, play, setVolume, toggleSound, unlockAudio } from './audio.js';
import { OtherPlayers } from './social.js';
import { RealPlaces } from './scene/realplaces.js';
import { buildRealism } from './scene/realism.js';
import { REAL_PLACES } from '../shared/places.js';
import { Vehicles } from './vehicles.js';
import { PhotoMode } from './photo.js';
import { StreetLamps, buildDiyas, buildKer, buildStalls, updateStalls } from './scene/citylife.js';
import { auth, loadAuthConfig, signIn, takeAuthResult } from './auth.js';
import { blocked } from './collide.js';
import { Game } from './game.js';
import { buildSpots, findTarget, missionTarget, readChapter, type Ctx } from './interact.js';
import { HomeView } from './home.js';
import { findHomeSite, findLocality, localities } from './map/places.js';
import { fixName, getH, loadMap } from './map/data.js';
import { Net } from './net.js';
import { buildNeighbours, kaamFor } from './npcs.js';
import { Player, isTouch } from './player.js';
import { autoQuality, onSettings, settings, updateSettings, type Graphics, type TextSize } from './settings.js';
import { RideView } from './ride.js';
import { RoadGraph } from './route.js';
import { City, KitFleet, loadKit, planBuildings } from './scene/buildings.js';
import { FarmView } from './scene/farm.js';
import { shuffledTour } from './scene/tour.js';
import { STADIUM, StandsView, buildBus, buildCrowds, buildNPCs, buildPandal, buildStadiumLights, buildStall } from './scene/landmarks.js';
import { PARAS } from '../shared/area.js';
import { Crowd, animPerson, sit, Traffic } from './scene/people.js';
import { Labels, buildGround, buildHills, buildRoads, buildSky, buildTrees } from './scene/world.js';
import { Lighting } from './sky.js';
import { $, closePanels, esc, fade, modalOpen, toast, wait } from './ui/dom.js';
import { setPrompt, updateHud } from './ui/hud.js';
import { MapView } from './ui/map.js';
import { dialog, nextPage, openBoard, renderShop, showEnd, wireBoard, wireShop } from './ui/panels.js';

const TOMTOM_COLOURS = ['#2f8f4e', '#3a9a5a', '#e3b23c', '#2f8f4e', '#2a7fb0', '#c94a3a', '#3a9a5a'];

declare const __MAP_V__: string, __KIT_V__: string;

async function boot(): Promise<void> {
  const loading = $('#loading');
  const net = new Net();
  /** The lantern comes out by itself after dark; T puts it out or lights it again. */
  let lanternWanted = true;
  const authResult = takeAuthResult();
  if (authResult?.token) net.adopt(authResult.token);
  const authReady = loadAuthConfig();
  const [map, kit, first] = await Promise.all([
    loadMap(`/agartala-map.json?v=${__MAP_V__}`, (f) => (loading.textContent = `Loading the streets of Agartala… ${Math.round(f * 100)}%`)),
    loadKit(`/models/kit.glb?v=${__KIT_V__}`),
    net.start(),
  ]);
  map.places.push(
    { x: STADIUM.x, z: STADIUM.z, name: 'MBB Stadium', kind: 'landmark' }, { x: 1660, z: 1190, name: 'The fields by the Haora', kind: 'landmark' },
    ...REAL_PLACES.map((p) => ({ x: p.x, z: p.z, name: p.name, kind: 'landmark' })), { x: SPOTS.gopal[0], z: SPOTS.gopal[1], name: 'Math Chowmuhani Bazar', kind: 'landmark' },
    { x: 920, z: 975, name: 'Modern Club', kind: 'landmark' }, { x: 1470, z: 1640, name: 'The Haora bridge', kind: 'landmark' },
  );
  loading.textContent = `Raising ${map.buildings.length.toLocaleString('en-IN')} buildings…`;
  await wait(20);

  /* ---------- renderer & world ---------- */
  const canvas = $('#c') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.2, 2600);
  const resize = () => { renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize);

  buildGround(scene, map); buildRoads(scene, map); buildHills(scene);
  const plans = planBuildings(map); const city = new City(scene, kit, plans); const real = new RealPlaces(scene, map, kit, plans); buildRealism(scene, map, kit, plans);
  const palaceLights = buildStadiumLights(scene); const pandal = buildPandal(scene, map); buildStall(scene, map);
  const standFleet = new KitFleet(scene, kit, 'tomtom', 10, TOMTOM_COLOURS);
  const standsView = new StandsView(scene, map, standFleet, 10); buildBus(scene, map);
  const farm = new FarmView(scene);
  buildTrees(scene, map);
  const skyFx = buildSky(scene);
  const npc = buildNPCs(scene, map);
  const home = new HomeView(scene, npc.grandpa);
  const neighbours = buildNeighbours(scene, map);
  const { dancers, crowd } = buildCrowds(scene, map);
  const trafficFleet = new KitFleet(scene, kit, 'tomtom', 28, TOMTOM_COLOURS);
  const traffic = new Traffic(scene, map, trafficFleet, 28);
  const graph = new RoadGraph(map);
  const rideView = new RideView(scene, map, graph, new KitFleet(scene, kit, 'tomtom', 1, ['#2f8f4e']), 0);
  const lighting = new Lighting(scene, skyFx, palaceLights, pandal);

  /* ---------- settings: applied now and whenever they change ---------- */
  const QUALITY: Record<Exclude<Graphics, 'auto'>, { pr: number; shadow: number }> = {
    low: { pr: Math.min(devicePixelRatio || 1, 1) * 0.75, shadow: 0 }, medium: { pr: Math.min(devicePixelRatio || 1, 1), shadow: 1024 }, high: { pr: Math.min(devicePixelRatio || 1, 1.5), shadow: 2048 },
  };
  let autoLevel = autoQuality(isTouch); let quality: Exclude<Graphics, 'auto'> = autoLevel;
  const applyQuality = (q: Exclude<Graphics, 'auto'>) => {
    quality = q; const Q = QUALITY[q]; renderer.setPixelRatio(Q.pr);
    lighting.sun.castShadow = Q.shadow > 0;
    if (Q.shadow && lighting.sun.shadow.mapSize.x !== Q.shadow) { lighting.sun.shadow.mapSize.set(Q.shadow, Q.shadow); lighting.sun.shadow.map?.dispose(); (lighting.sun.shadow as { map: unknown }).map = null; }
    resize();
    const label = $('#setGfxV'); label.textContent = `Running at ${q[0].toUpperCase()}${q.slice(1)}`;
  };
  // Auto quality: if the frame rate stays low for a few seconds, step down one level
  let fpsT = 0, fpsN = 0;
  const watchFps = (dt: number) => {
    if (settings().graphics !== 'auto' || quality === 'low') return;
    fpsT += dt; fpsN++;
    if (fpsT >= 5) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (fps < 28) { autoLevel = quality === 'high' ? 'medium' : 'low'; applyQuality(autoLevel); toast(`Graphics lowered to ${autoLevel === 'medium' ? 'Medium' : 'Low'} so the game runs smoothly.`); } }
  };
  const openSettings = () => {
    const st = settings(); closePanels();
    const look = $('#setLook') as HTMLInputElement, view = $('#setView') as HTMLInputElement, vol = $('#setVol') as HTMLInputElement;
    look.value = String(st.look); view.value = String(st.view); vol.value = String(st.volume);
    ($('#setMotion') as HTMLInputElement).checked = st.reduceMotion; ($('#setGfx') as HTMLSelectElement).value = st.graphics;
    ($('#setGfx').querySelector('option[value="auto"]') as HTMLOptionElement).textContent = `Auto (best for this device: ${autoQuality(isTouch)})`;
    showSettingValues(); $('#settings').hidden = false;
  };
  const showSettingValues = () => {
    const st = settings(); $('#setLookV').textContent = st.look.toFixed(1); $('#setViewV').textContent = `${st.view} m`; $('#setVolV').textContent = `${st.volume}%`;
    document.querySelectorAll<HTMLButtonElement>('#settings .seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.text === st.text)));
  };
  $('#setLook').oninput = (e) => { updateSettings({ look: Number((e.target as HTMLInputElement).value) }); showSettingValues(); };
  $('#setView').oninput = (e) => { updateSettings({ view: Number((e.target as HTMLInputElement).value) }); showSettingValues(); };
  $('#setVol').oninput = (e) => { updateSettings({ volume: Number((e.target as HTMLInputElement).value) }); showSettingValues(); };
  $('#setVol').onchange = () => play('coin');
  document.querySelectorAll<HTMLButtonElement>('#settings .seg button').forEach((b) => { b.onclick = () => { updateSettings({ text: b.dataset.text as TextSize }); showSettingValues(); }; });
  ($('#setMotion') as HTMLInputElement).onchange = (e) => updateSettings({ reduceMotion: (e.target as HTMLInputElement).checked });
  ($('#setGfx') as HTMLSelectElement).onchange = (e) => updateSettings({ graphics: (e.target as HTMLSelectElement).value as Graphics });
  for (const id of ['#setClose', '#setDone']) $(id).onclick = () => { $('#settings').hidden = true; };
  $('#bSettings').onclick = openSettings; $('#titleSettings').onclick = openSettings;
  const stalls = buildStalls(scene, map); const lamps = new StreetLamps(scene, map); const diyas = buildDiyas(scene, map); const kerShrine = buildKer(scene);
  const others = new OtherPlayers(scene, net); const ambience = new Ambience();
  const mapView = new MapView(map);
  const player = new Player(scene, map, camera, canvas);
  // apply the saved settings now that the player exists (and again whenever they change)
  onSettings((st) => {
    player.lookScale = st.look; lighting.viewFar = st.view; camera.far = Math.max(1200, st.view * 1.6); camera.updateProjectionMatrix();
    setVolume(st.volume / 100);
    document.documentElement.dataset.text = st.text; document.documentElement.dataset.motion = st.reduceMotion ? 'reduce' : '';
    applyQuality(st.graphics === 'auto' ? autoLevel : st.graphics);
  });
  const vehicles = new Vehicles(scene, map, player, (i) => home.parking(i), stalls);
  const labels = new Labels(scene);
  let homeLabel: THREE.Sprite | null = null;
  void (document.fonts?.ready ?? Promise.resolve()).then(() => {
    labels.add('MBB Stadium', 'মহারাজা বীর বিক্রম স্টেডিয়াম', STADIUM.x, 44, STADIUM.z, 3, 2500);
    labels.add('Math Chowmuhani Bazar', 'মঠ চৌমুহনী বাজার', SPOTS.gopal[0], 14, SPOTS.gopal[1], 1.4, 1200);
    labels.add('Modern Club', 'মডার্ন ক্লাব', SPOTS.pandal[0], 16, SPOTS.pandal[1], 1.2, 900);
    labels.add('Joynagar bus stop', 'জয়নগর বাস স্টপ', SPOTS.busTerminus[0], 12, SPOTS.busTerminus[1], 1.2, 900);
    for (const p of REAL_PLACES) if (!['stadium', 'shivmandir', 'bhaumik', 'carshringaar', 'pathshala', 'masjid', 'bijoy'].includes(p.id)) labels.add(p.name, p.bn || null, p.x, p.kind === 'lake' || p.kind === 'park' ? 8 : 16, p.z, p.kind === 'college' ? 1.5 : 1.1, p.kind === 'college' ? 1400 : 800);
    for (const p of PARAS) if (!/Stadium|Math/.test(p.name)) labels.add(p.name, null, p.x, 14, p.z, 1.3, 1400);
    labels.add('Haora river', 'হাওড়া নদী', 1760, 6, 1300, 1.6, 1200);
    homeLabel = labels.add('Your bari', 'বাড়ি', -720, 12, -1472, 1, 900); placeHome();
    labels.add('Family fields', 'খেত', 1700, 10, 1150, 1, 900);
    for (const p of map.chowmuhanis) labels.add(fixName(p.name), null, p.x, 9, p.z, 0.9, 450);
  });

  /* ---------- game state & feedback ---------- */
  const game = new Game(first, net, (events, err) => {
    if (err) { toast(err); play('no'); }
    for (const e of events) {
      if (e.kind === 'toast' || e.kind === 'day') { toast(e.text); play(e.sfx); }
      else if (e.kind === 'sfx') play(e.sfx);
      else if (e.kind === 'phrase') { play('mission'); toast(`means "${e.text}" · +₹10`, `New phrase · ${e.title}`); }
      else if (e.kind === 'chapter') { play('mission'); toast(e.text, e.title); }
      else if (e.kind === 'mission') {
        play('mission'); toast(e.text, e.title);
        if (e.next) setTimeout(() => { const n = currentMission(game.S); if (n) toast(missionText(n.text, game.S).split('. ')[0] + '.', `New: ${n.title}`); }, 1600);
      } else if (e.kind === 'ending') setTimeout(() => showEnd(game.S), 2400);
    }
  });
  const durgaIdx = missionIndex('durga');
  let placedHome = '';
  /** Moves the house, Grandpa, the Home stand and the label to wherever home is now. */
  function placeHome() {
    const h = game.S.home; const key = h ? `${h.x},${h.z}` : 'fields';
    standsView.update(standsFor(h));
    if (homeLabel) { const f = home.front; homeLabel.position.set(f.x, 12, f.z); }
    if (key === placedHome) { vehicles.sync(game.S); return; } placedHome = key; home.place(h); vehicles.sync(game.S, true);
    if (homeLabel) { const f = home.front; homeLabel.position.set(f.x, 12, f.z); }
  }
  const refresh = () => {
    const S = game.S; farm.refresh(S); placeHome();
    player.body.userData.shawl.visible = !!S.flags.shawl; pandal.visible = S.mission >= durgaIdx || isFestival(S.day, 'durga');
    kerShrine.visible = isFestival(S.day, 'ker'); showInbox(S);
    if (!$('#shop').hidden) renderShop(S);
    hudTick(true);
  };
  game.onChange(refresh);
  /** Notes from friends (gifts, help) appear once as toasts; they stay listed on the farm board. */
  function showInbox(S: typeof game.S) {
    let seen = 0; try { seen = Number(localStorage.getItem('haora.agartala.inboxSeen')) || 0; } catch { /* private mode */ }
    const fresh = S.inbox.filter((n) => n.t > seen); if (!fresh.length) return;
    fresh.forEach((n, i) => setTimeout(() => { toast(n.text, 'From a friend'); play('coin'); }, 600 + i * 1800));
    try { localStorage.setItem('haora.agartala.inboxSeen', String(Math.max(...fresh.map((n) => n.t)))); } catch { /* private mode */ }
  }
  net.onStatus = () => hudTick();

  /* ---------- tomtom rides ---------- */
  let rideTo: Stand | null = null;
  const startRide = (from: Stand, to: Stand) => {
    if (rideView.active || game.S.ride) return;
    const ride = () => game.S.ride;
    if (!game.dispatch({ t: 'ride', from: from.k, to: to.k }).ok) return;
    const r = ride(); if (!r) return; rideView.begin(from, to, r.start, r.ms); rideTo = to; sit(player.body, true);
    toast('Sit back and watch the city go by. Press E or Space to skip ahead.');
  };
  const leaveRide = (skip: boolean) => {
    const st = rideTo || (game.S.ride ? standByKey(game.S.ride.to, game.S.home) : undefined) || standByKey('stHome', game.S.home)!;
    if (skip && game.S.ride) game.dispatch({ t: 'arrive' });
    rideView.end(); sit(player.body, false); rideTo = null; const rr = standsView.rot(st); const ox = Math.cos(rr) * 2.6, oz = -Math.sin(rr) * 2.6;
    let x = st.x + ox, z = st.z + oz; if (blocked(map, x, z)) { x = st.x - ox; z = st.z - oz; }
    player.teleport(x, z, rr);
  };

  /* ---------- interactions ---------- */
  vehicles.onFare = (veh, from, to) => { game.dispatch({ t: 'fare', veh, from, to }); };
  vehicles.onMessage = (text) => toast(text);
  vehicles.onRent = (veh, at) => game.dispatch({ t: 'rent', veh, at }).ok;
  vehicles.onReturn = (at) => game.dispatch({ t: 'returnRental', at }).ok;
  const ctx: Ctx = {
    game, map, npc, neighbours, traffic, home, stalls, extra: () => vehicles.spots(game.S),
    trip: async (t: Trip, sell?: Partial<Record<ItemKey, number>>) => {
      const why = tripOpen(game.S, t); if (why) { toast(why); play('no'); return; }
      play('horn'); fade(true); await wait(700); fade(false);
      dialog({ name: t.name, role: `${t.where} · ${t.km} km by bus` }, t.pages, () => game.dispatch({ t: 'trip', id: t.id, sell }));
    },
    fair: async () => {
      play('horn'); fade(true); await wait(700); fade(false);
      dialog({ name: 'Kharchi Puja fair', role: 'Old Agartala · 8 km east' }, [
        'The fair spreads out along the river below the Chaturdasha Devata Mandir: giant wheels, bangle stalls, jalebi frying in great black pans.',
        'Families from every corner of Tripura have come. You try your luck at the stalls.',
      ], () => game.dispatch({ t: 'fest', id: 'kharchiFair' }));
    },
    player: () => ({ x: player.x, z: player.z, face: player.face }),
    sleep: async () => { if (vehicles.riding) { toast('Get off first (E).'); return; } fade(true); await wait(650); game.dispatch({ t: 'sleep' }); await wait(350); fade(false); },
    ride: startRide,
    kharchiTrip: async () => {
      play('horn'); fade(true); await wait(700); fade(false);
      dialog({ name: 'The Chantai', role: 'Chaturdasha Devata Mandir · Old Agartala' }, [
        'You came by bus from Joynagar? Half of Agartala has done the same today.',
        'Kharchi Puja cleanses the earth after Ambubachi, and for seven days we worship the fourteen gods here.',
        'Rice from your lunga and fruit from your tilla. The gods will be pleased, and so will the people who eat the prasad.',
        'Go well. Your fields are blessed this year. They will grow a little faster.',
      ], () => game.dispatch({ t: 'kharchi' }));
    },
  };
  const spots = buildSpots(ctx);
  let prompt: ReturnType<typeof findTarget> = null; let promptP: { label: string; run?: () => void } | null = null;
  const interact = () => { if (promptP?.run) promptP.run(); else if (prompt) play('no'); };

  /* ---------- HUD & panels ---------- */
  let target: ReturnType<typeof missionTarget> = null;
  const kaamMarks = () => neighbours.filter((n) => { const k = kaamFor(game.S, n.id); return k && !k.done; }).map((n) => ({ x: n.x, z: n.z }));
  const npcPos = (id: string) => neighbours.find((n) => n.id === id);
  /** Orange: where to drop the parcel you carry, or who has parcels waiting. */
  const errandMarks = () => {
    const S = game.S;
    if (S.carry) { const d = deliveryById(S.carry); const n = d && npcPos(d.to); return n ? [{ x: n.x, z: n.z }] : []; }
    return dailyDeliveries(S.day).filter((d) => !S.delivered.includes(d.id)).map((d) => npcPos(d.from)).filter((n): n is NonNullable<typeof n> => !!n).map((n) => ({ x: n.x, z: n.z }));
  };
  const sightMarks = () => SIGHTS.filter((x) => !game.S.visited.includes(x.id)).map((x) => ({ x: x.x, z: x.z }));
  const marks = () => ({ player: { x: player.x, z: player.z, face: player.face }, target, kaam: kaamMarks(), errand: errandMarks(), sights: sightMarks(), home: home.front, others: others.marks(), stalls, rentals: vehicles.rentalMarks });
  function hudTick(force = false) {
    target = rideView.active ? null : vehicles.target || missionTarget(game.S, { x: player.x, z: player.z }, spots, { x: npc.grandpa.x, z: npc.grandpa.z });
    updateHud({ S: game.S, place: map.placeName(player.x, player.z), target, px: player.x, pz: player.z, yaw: player.yaw, online: net.online, lost: net.lost, others: others.count }, force);
    mapView.drawMini(marks());
  }
  let mapMode: 'jump' | 'home' = 'jump';
  const openMap = (mode: 'jump' | 'home') => {
    mapMode = mode; const el = $('#bigmap'); el.hidden = false; mapView.drawBig(marks());
    $('#mapTitle').textContent = mode === 'home' ? 'Where is home?' : 'Agartala';
    $('#jumpHint').textContent = mode === 'home' ? 'Click the spot in Agartala where your home is. Your house, Grandpa and a tomtom stand will move there.' : 'Click anywhere on the map to jump there.';
    ($('.jumprow') as HTMLElement).hidden = mode === 'home';
  };
  const toggleMap = () => { if ($('#bigmap').hidden) openMap('jump'); else $('#bigmap').hidden = true; };
  const board = () => openBoard({ game, net, auth, readChapter: (id) => readChapter(ctx, id), onState: (s) => game.replace(s) });
  wireBoard();
  const photo = new PhotoMode(renderer, scene, camera, () => map.placeName(player.x, player.z) || 'Agartala', () => { const S = game.S; return `day ${S.day}, ${String(Math.floor(S.hour)).padStart(2, '0')}:${String(Math.floor((S.hour % 1) * 60)).padStart(2, '0')}`; });
  const togglePhoto = () => { photo.toggle(); player.maxDist = photo.active ? 90 : 22; if (!photo.active && player.dist > 22) player.dist = 22; closePanels(); };
  $('#bPhoto').onclick = togglePhoto;
  $('#bMap').onclick = toggleMap; $('#mini').onclick = toggleMap; $('#mapClose').onclick = () => ($('#bigmap').hidden = true);

  /* ---------- where is home? ---------- */
  const LOCALITIES = localities(map);
  const FIELDS_NAME = 'The fields by the Haora (the family bari)';
  $('#homeList').innerHTML = [FIELDS_NAME, ...LOCALITIES.map((l) => l.name)].map((n) => `<option value="${esc(n)}"></option>`).join('');
  const homeLabelText = () => game.S.home ? game.S.home.name : FIELDS_NAME;
  /** Turns what the player typed into a house site, or null for the fields. undefined = not found. */
  const resolveHome = (q: string): HomeSite | null | undefined => {
    const t = q.trim(); if (!t || /family (fields|bari)|fields by the haora/i.test(t)) return null;
    const loc = findLocality(LOCALITIES, t); if (!loc) return undefined;
    return findHomeSite(map, loc.x, loc.z, loc.name) || undefined;
  };
  const setHome = (site: HomeSite | null) => {
    if (rideView.active) { toast('Finish the ride first.'); return false; }
    if (!game.dispatch({ t: 'home', site }).ok) return false;
    placeHome(); hudTick(true); return true;
  };
  const homeFromInput = (input: HTMLInputElement): boolean => {
    const site = resolveHome(input.value);
    if (site === undefined) { toast(`Couldn't find "${input.value}" on the map. Pick a name from the list, or choose a spot on the map.`); return false; }
    const cur = game.S.home; if ((site === null && !cur) || (site && cur && site.name === cur.name)) return true;
    return setHome(site);
  };

  /* ---------- jump to a place from the map ---------- */
  const jumps = (): { name: string; x: number; z: number }[] => [
    { name: `Home · ${homeLabelText()}`, ...home.front },
    { name: 'Family fields · by the Haora', x: 1664, z: 1175 },
    ...standsFor(game.S.home).map((st) => ({ name: `Tomtom stand · ${st.name}`, x: st.x, z: st.z })),
    ...neighbours.map((n) => ({ name: `${n.name} · ${n.role}`, x: n.x, z: n.z })),
    ...SIGHTS.map((x) => ({ name: `${x.name} · sight`, x: x.x, z: x.z })),
    ...map.places.map((p) => ({ name: p.name, x: p.x, z: p.z })),
    { name: 'Modern Club pandal', x: SPOTS.pandal[0], z: SPOTS.pandal[1] },
    { name: 'Gopal Saha · Math Chowmuhani Bazar', x: SPOTS.gopal[0], z: SPOTS.gopal[1] },
  ].filter((j, i, a) => a.findIndex((k) => k.name === j.name) === i);
  const fillJumps = () => { $('#placeList').innerHTML = jumps().map((j) => `<option value="${esc(j.name)}"></option>`).join(''); };
  fillJumps();
  /** Nearest walkable ground to a point: spirals out until it finds open, dry land. */
  const openGround = (x: number, z: number): { x: number; z: number } | null => {
    for (let r = 0; r <= 60; r += 1.5) for (let k = 0; k < Math.max(1, Math.round(r * 2)); k++) {
      const a = (k / Math.max(1, Math.round(r * 2))) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!blocked(map, px, pz)) return { x: px, z: pz };
    }
    return null;
  };
  const jumpTo = (x: number, z: number, label: string) => {
    if (rideView.active) { toast('You are on a tomtom. Skip the ride first (E or Space).'); return; }
    const p = openGround(x, z); if (!p) { toast('Nowhere to stand there. Try a spot nearer a road.'); return; }
    fade(true);
    setTimeout(() => {
      const rn = map.roadNear(p.x, p.z); const face = rn ? Math.atan2(rn.px - p.x, rn.pz - p.z) : player.face;
      if (vehicles.riding) vehicles.teleport(p.x, p.z, face); else { player.teleport(p.x, p.z, face); player.yaw = face + Math.PI; } $('#bigmap').hidden = true;
      game.dispatch({ t: 'pos', x: p.x, z: p.z, face }); city.update(p.x, p.z); hudTick(true);
      fade(false); toast(`You are at ${label}.`);
    }, 350);
  };
  const jumpByName = () => {
    const q = ($('#jumpIn') as HTMLInputElement).value.trim().toLowerCase(); if (!q) return;
    const list = jumps(); const j = list.find((x) => x.name.toLowerCase() === q) || list.find((x) => x.name.toLowerCase().includes(q));
    if (!j) { toast(`No place called "${q}" on the map.`); return; }
    ($('#jumpIn') as HTMLInputElement).value = ''; jumpTo(j.x, j.z, j.name.split(' · ')[0]);
  };
  $('#jumpGo').onclick = jumpByName;
  ($('#jumpIn') as HTMLInputElement).addEventListener('focus', fillJumps);
  ($('#jumpIn') as HTMLInputElement).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jumpByName(); } });
  /* the big map: scroll or pinch to zoom, drag to move, buttons for zoom; a drag is never taken as a click */
  {
    const cv = $('#mapCv') as HTMLCanvasElement; const pts = new Map<number, { x: number; y: number }>(); let moved = 0, pinch = 0;
    const frac = (x: number, y: number) => { const r = cv.getBoundingClientRect(); return { fx: (x - r.left) / r.width, fy: (y - r.top) / r.height, r }; };
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const { fx, fy } = frac(e.clientX, e.clientY); mapView.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), fx, fy); }, { passive: false });
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) moved = 0; cv.classList.add('dragging'); pinch = 0; });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      if (pts.size === 1) {
        const { r } = frac(e.clientX, e.clientY); const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) mapView.panBy(dx / r.width, dy / r.height);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()]; const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY; const [a2, b2] = [...pts.values()]; const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
        const { fx, fy } = frac((a2.x + b2.x) / 2, (a2.y + b2.y) / 2); if (before > 0) mapView.zoomBy(after / before, fx, fy); moved = 999; pinch = 1; return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (!pts.size) cv.classList.remove('dragging'); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('click', (e) => { if (moved > 6 || pinch) { e.stopImmediatePropagation(); moved = 0; pinch = 0; } }, true);
    $('#mapIn').onclick = () => mapView.zoomBy(1.6); $('#mapOut').onclick = () => mapView.zoomBy(1 / 1.6); $('#mapReset').onclick = () => mapView.resetView();
  }
  $('#mapCv').addEventListener('click', (e) => {
    const w = mapView.worldAt(e.clientX, e.clientY);
    if (mapMode === 'home') {
      const name = map.placeName(w.x, w.z).replace(/^.* · /, '').replace(/^near /, '') || 'Agartala';
      const site = findHomeSite(map, w.x, w.z, name, 400);
      if (!site) { toast('No open plot near there. Try a spot closer to a lane.'); return; }
      ($('#homeIn') as HTMLInputElement).value = site.name; ($('#homeIn2') as HTMLInputElement).value = site.name;
      $('#bigmap').hidden = true;
      if (playing) { if (setHome(site)) toast(`Your house is now in ${site.name}. Take a tomtom to the Home stand.`); }
      else { pendingSite = site; $('#homeNote').textContent = `Home: a plot in ${site.name}.`; }
      return;
    }
    jumpTo(w.x, w.z, map.placeName(w.x, w.z) || 'the spot you picked');
  });
  let pendingSite: HomeSite | null | undefined;
  $('#homePick').onclick = () => openMap('home');
  $('#homePick2').onclick = () => { $('#board').hidden = true; openMap('home'); };
  $('#homeMove').onclick = () => { if (homeFromInput($('#homeIn2') as HTMLInputElement)) { toast(`Home is ${homeLabelText()}. Take a tomtom to the Home stand to get there.`); board(); } };
  ($('#homeIn') as HTMLInputElement).addEventListener('input', () => { pendingSite = undefined; $('#homeNote').textContent = ''; });
  $('#bHelp').onclick = () => ($('#help').hidden = false); $('#helpClose').onclick = () => ($('#help').hidden = true);
  $('#bBoard').onclick = board; $('#boardClose').onclick = () => ($('#board').hidden = true);
  // Hamburger menu for the HUD buttons on phones: tap to open, and any choice (or a tap elsewhere) closes it.
  const btns = $('#btns'), menuBtn = $('#bMenu');
  const setMenu = (open: boolean) => { btns.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.onclick = (e) => { e.stopPropagation(); setMenu(!btns.classList.contains('open')); };
  btns.addEventListener('click', (e) => { if (e.target !== menuBtn && !menuBtn.contains(e.target as Node)) setMenu(false); });
  document.addEventListener('pointerdown', (e) => { if (btns.classList.contains('open') && !btns.contains(e.target as Node)) setMenu(false); });
  function toggleLantern(): void {
    lanternWanted = !lanternWanted; toast(lanternWanted ? 'Lantern lit.' : 'Lantern out.');
    $('#bLantern').lastChild!.textContent = lanternWanted ? 'Lantern on' : 'Lantern off';
  }
  $('#bLantern').onclick = toggleLantern;
  /** Sign out on this device: back to the title screen, ready for someone else (or another account) to sign in. */
  async function signOut(): Promise<void> {
    if (!confirm('Sign out on this device? Your farm stays safe with your account.')) return;
    await net.signOut(); location.replace(location.pathname);
  }
  $('#signOut').onclick = signOut;
  $('#bSound').onclick = () => ($('#bSound').textContent = toggleSound() ? 'Sound on' : 'Sound off');
  $('#dlgNext').onclick = nextPage; $('#endClose').onclick = () => ($('#endcard').hidden = true);
  for (const s of ['#bigmap', '#help', '#shop', '#ride', '#endcard', '#board', '#stall', '#trips']) $(s).addEventListener('click', (e) => { if (e.target === $(s)) $(s).hidden = true; });
  wireShop(game);
  $('#nameSave').onclick = () => { if (game.dispatch({ t: 'name', name: ($('#nameIn') as HTMLInputElement).value }).ok) { toast('Your farm is on the leaderboard.'); setTimeout(board, 900); } };
  $('#codeGo').onclick = async () => {
    try { const s = await net.restore(($('#codeIn') as HTMLInputElement).value); vehicles.sendHome(); game.replace(s); player.teleport(s.pos.x, s.pos.z, s.pos.face); toast('Farm restored on this device.'); board(); }
    catch (e) { toast((e as Error).message); }
  };
  $('#gIn').onclick = async () => { try { await net.flush(); toast(await signIn(net.session, 'google')); } catch (e) { toast((e as Error).message); } };
  $('#eIn').onclick = async () => { try { toast(await signIn(net.session, 'email', ($('#emailIn') as HTMLInputElement).value)); } catch (e) { toast((e as Error).message); } };
  $('#resetFarm').onclick = async () => {
    const b = $('#resetFarm'); if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to start over'; return; }
    vehicles.sendHome(); const s = await net.reset(); game.replace(s); player.teleport(s.pos.x, s.pos.z, s.pos.face); b.dataset.armed = ''; b.textContent = 'Start a new farm'; $('#board').hidden = true;
  };

  /* ---------- keyboard & touch ---------- */
  let playing = false;
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.target as HTMLElement).tagName === 'INPUT') { if (k === 'escape') closePanels(); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!playing) return;
    if (!$('#dialog').hidden) { if (k === 'e' || k === 'enter' || k === ' ') { nextPage(); e.preventDefault(); } return; }
    if (k === 'escape') { if (photo.active) return togglePhoto(); return closePanels(); }
    if (k === 'p' && !e.repeat) return togglePhoto();
    if (k === 'm') return toggleMap();
    if (k === 't' && !e.repeat) return toggleLantern();
    if (k === 'o' && !e.repeat) { if ($('#settings').hidden) openSettings(); else $('#settings').hidden = true; return; }
    if (k === 'h') { $('#help').hidden = !$('#help').hidden; return; }
    if (k === 'l') { if ($('#board').hidden) board(); else $('#board').hidden = true; return; }
    if (modalOpen()) return;
    if (rideView.active && (k === ' ' || k === 'e') && !e.repeat) { leaveRide(true); return; }
    if (k === 'e' && !e.repeat) interact();
    if (k === 'z') { if (isNight(game.S)) void ctx.sleep(); else toast('It is too early to sleep. You can sleep after 19:00.'); }
  });
  const jEl = $('#joy'), kEl = $('#joyKnob'); let joyId: number | null = null;
  const moveJoy = (e: PointerEvent) => { const r = jEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const L = Math.hypot(dx, dy); if (L > 40) { dx *= 40 / L; dy *= 40 / L; } player.joy.x = dx / 40; player.joy.y = dy / 40; kEl.style.transform = `translate(${dx}px,${dy}px)`; };
  jEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; player.joy.active = true; jEl.setPointerCapture(e.pointerId); moveJoy(e); });
  jEl.addEventListener('pointermove', (e) => { if (joyId === e.pointerId) moveJoy(e); });
  const endJoy = (e: PointerEvent) => { if (joyId === e.pointerId) { joyId = null; player.joy.active = false; player.joy.x = player.joy.y = 0; kEl.style.transform = ''; } };
  jEl.addEventListener('pointerup', endJoy); jEl.addEventListener('pointercancel', endJoy);
  $('#tAct').onclick = () => { if (!$('#dialog').hidden) nextPage(); else if (rideView.active) leaveRide(true); else if (!modalOpen()) interact(); };
  $('#tSleep').onclick = () => { if (!modalOpen() && isNight(game.S)) void ctx.sleep(); };
  $('#tRun').onclick = () => { player.autoRun = !player.autoRun; $('#tRun').setAttribute('aria-pressed', String(player.autoRun)); };

  /* ---------- marker ---------- */
  const marker = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: '#f2c14a', fog: false })); gem.scale.y = 1.5; marker.add(gem);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 120, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#f2c14a', transparent: true, opacity: 0.3, depthWrite: false, fog: false })); beam.position.y = 60; marker.add(beam);
  marker.visible = false; scene.add(marker);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32), new THREE.MeshBasicMaterial({ color: '#f6efe0', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

  /* ---------- title: where are you coming home from? ---------- */
  const fromIn = $('#fromIn') as HTMLInputElement;
  $('#cityList').innerHTML = CITIES.map(([n]) => `<option value="${esc(n)}"></option>`).join('');
  fromIn.value = first.from || net.geo?.city || 'Bengaluru';
  $('#geoNote').textContent = net.geo?.city ? `Detected from your connection: ${net.geo.city}${net.geo.km ? `, ${net.geo.km.toLocaleString('en-IN')} km from Agartala` : ''}. Change it if you like.` : 'Type the city you live in now. The story will follow you home from there.';
  const applyFrom = () => {
    const city = fromIn.value.trim() || 'Bengaluru'; if (city === game.S.from) return;
    const km = net.geo && net.geo.city.toLowerCase() === city.toLowerCase() ? net.geo.km : kmFromCity(city);
    game.dispatch({ t: 'from', city, km });
  };
  ($('#homeIn') as HTMLInputElement).value = homeLabelText(); ($('#homeIn2') as HTMLInputElement).value = homeLabelText();
  function start() {
    applyFrom();
    if (pendingSite !== undefined) setHome(pendingSite);
    else if (!homeFromInput($('#homeIn') as HTMLInputElement)) return;
    playing = true; unlockAudio(); $('#title').hidden = true; $('#hud').hidden = false; $('#tourFade').classList.remove('on');
    if (isTouch) { $('#touch').hidden = false; $('#game').classList.add('touch'); }
    if (game.S.ride) game.dispatch({ t: 'arrive' }); // a ride left running from last time
    const p = game.S.pos; player.teleport(p.x, p.z, p.face); player.resetView();
    refresh(); canvas.focus();
    const m = currentMission(game.S);
    if (m) toast(missionText(m.text, game.S).split('. ')[0] + '.', m.title);
    if (m?.id === 'arrive') setTimeout(() => dialog({ name: 'MBB Stadium gate', role: 'Agartala · day 1' }, [
      `The flight from ${game.S.from || 'the city'} landed at Maharaja Bir Bikram Airport an hour ago. The cab driver dropped you at the stadium gate and left in a cloud of dust.`,
      'The air is thick and green after the rain. Somewhere a temple bell is ringing. Grandpa is waiting at the old bari on the river bank, a short tomtom ride round the stadium.',
      'The green tomtoms at the stand here go anywhere in the city. Walk up to one and press E.',
    ]), 900);
  }
  const progressed = first.mission > 0 || first.day > 1;
  $('#bContinue').hidden = !progressed; $('#bContinue').onclick = start;
  $('#bNew').textContent = progressed ? 'New farm' : 'Start';
  $('#bNew').onclick = async () => { if (progressed) { const s = await net.reset(); game.replace(s); } start(); };
  $('#offline').hidden = net.online;
  // Sign in with Google right on the title screen (it's also in the Farm panel, L, for later).
  await authReady;
  $('#titleSignin').hidden = !auth.config.google || !net.online || net.signedIn;
  if (net.needsSignin) {
    // This server only lets signed-in players in (keeps bots out): Google is the only way past the title.
    $('#bNew').hidden = true; $('#bContinue').hidden = true;
    $('#titleSignin').classList.add('gate');
    $('#titleSignin .sm').textContent = 'Sign in with Google to play. Your farm is kept with your account, on any device.';
  }
  $('#titleWho').hidden = !net.signedIn;
  $('#titleWhoText').textContent = net.signedIn ? `Signed in${net.email ? ` as ${net.email}` : ''}. This farm follows your account.` : '';
  $('#titleSignOut').onclick = signOut;
  $('#tgIn').onclick = async () => {
    const btn = $('#tgIn') as HTMLButtonElement; btn.disabled = true;
    try { applyFrom(); await net.flush(); toast(await signIn(net.session, 'google')); }
    catch (e) { btn.disabled = false; toast((e as Error).message); }
  };
  if (authResult?.error) toast(authResult.error);
  else if (authResult?.token && net.signedIn) toast(`Signed in${net.email ? ` as ${net.email}` : ''}. Your farm now follows your account.`);
  refresh(); resize(); loading.hidden = true; $('#title').hidden = false;
  // test hooks for scripted play-throughs and screenshots (only when a test page asks for them)
  // test hooks: a scripted test page sets __HAORA_DEBUG__, or open the game with ?debug=1 (play is then local only)
  if ((window as unknown as { __HAORA_DEBUG__?: boolean }).__HAORA_DEBUG__ || new URLSearchParams(location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__haora = {
      start, game, player, map, vehicles, ride: (a: string, b: string) => startRide(standByKey(a)!, standByKey(b)!),
      teleport: (x: number, z: number, face = 0) => player.teleport(x, z, face), view: (yaw: number, pitch: number, dist: number) => { player.yaw = yaw; player.pitch = pitch; player.dist = dist; },
    };
  }

  /* ---------- title fly-round: a random tour of real places, one every 12 s ---------- */
  const tour = shuffledTour(); const STOP_S = 12; let ti = 0, tourT = 0, tourA = Math.random() * Math.PI * 2;
  const showStop = () => {
    const s = tour[ti]; $('#tourName').textContent = s.name; $('#tourBn').textContent = s.bn; $('#tourCap').classList.remove('out');
    city.update(s.x, s.z); labels.update(s.x, s.z);
  };
  showStop();

  /* ---------- loop ---------- */
  const clock = new THREE.Clock(); let hudT = 0, slowT = 0, posT = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime; const calm = settings().reduceMotion;
    watchFps(dt);
    if (playing) {
      if (rideView.active) {
        const info = rideView.update(net.now(), player.body);
        if (!info) leaveRide(false);
        else {
          rideTo = info.to;
          let d = rideView.heading() + Math.PI - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); player.yaw += d * Math.min(1, dt * 1.5);
          promptP = { label: `Riding to ${info.to.name} · ${(info.left / 1000).toFixed(1)} km to go · E or Space to skip`, run: () => leaveRide(true) }; prompt = null;
        }
      } else if (vehicles.riding) {
        const k = player.keys; let f = 0, st = 0;
        if (!modalOpen()) { if (k.w || k.arrowup) f += 1; if (k.s || k.arrowdown) f -= 1; if (k.d || k.arrowright) st += 1; if (k.a || k.arrowleft) st -= 1; if (player.joy.active) { f -= player.joy.y; st += player.joy.x; } }
        vehicles.drive(dt, clamp(f, -1, 1), clamp(st, -1, 1), !!k[' '] && !modalOpen());
      } else if (!modalOpen()) { player.tired = game.S.energy < 15; player.move(dt, false, time); }
      game.tick();
      const S = game.S;
      if (vehicles.riding) { prompt = null; promptP = vehicles.prompt(S); }
      else if (!rideView.active) {
        rideTo = null;
        prompt = findTarget(ctx, spots); promptP = prompt ? prompt.get() : null;
      }
      if (prompt) { ring.visible = true; ring.position.set(prompt.x, getH(prompt.x, prompt.z) + 0.35, prompt.z); const s = Math.min(3, prompt.r * 0.9) * (1 + (calm ? 0 : Math.sin(time * 5) * 0.05)); ring.scale.set(s, s, s); (ring.material as THREE.MeshBasicMaterial).color.set(promptP?.run ? '#f2c14a' : '#f6efe0'); } else ring.visible = false;
      if (target) { marker.visible = true; const dd = Math.hypot(target.x - player.x, target.z - player.z); marker.position.set(target.x, getH(target.x, target.z) + 3 + (calm ? 0 : Math.sin(time * 2.4) * 0.2), target.z); gem.rotation.y = calm ? 0 : time * 1.5; gem.scale.setScalar(Math.min(8, Math.max(1, dd / 60))); gem.scale.y *= 1.5; beam.visible = dd > 15; } else marker.visible = false;
      hudT += dt; if (hudT > 0.2) { hudT = 0; hudTick(); setPrompt(promptP, isTouch); }
      slowT += dt; if (slowT > 0.5) {
        slowT = 0; farm.growing(S); labels.update(player.x, player.z); city.update(player.x, player.z);
        updateStalls(stalls, S.hour >= 7 && S.hour < 22);
        const dens = Crowd.densityAt(S.hour, S.rain); traffic.crowd.density = dens; traffic.density = Math.min(1, dens + 0.15);
        void others.tick(Date.now(), player.x, player.z, player.face, !rideView.active);
        const near = (x: number, z: number, r: number) => Math.hypot(player.x - x, player.z - z) < r;
        ambience.update(0.5, { hour: S.hour, rain: S.rain, flood: S.flood, nearTraffic: near(HOME.x, HOME.z, 300) ? 0.1 : dens, festival: festivalsOn(S.day)[0]?.id || null, nearPandal: near(SPOTS.pandal[0], SPOTS.pandal[1], 90), nearTemple: SIGHTS.some((x) => ['kalibari', 'jagannath', 'laxmi', 'melarmath'].includes(x.id) && near(x.x, x.z, 140)), farm: near(-780, -1540, 260) });
      }
      others.update(dt, player.x, player.z); farm.animate(time);
      posT += dt; if (posT > 10 && !rideView.active) { posT = 0; game.dispatch({ t: 'pos', x: player.x, z: player.z, face: player.face }); }
      player.updateCamera(dt);
    } else {
      const s = tour[ti]; tourT += dt;
      const a = tourA + tourT * 0.045; camera.position.set(s.x + Math.cos(a) * s.r, s.h, s.z + Math.sin(a) * s.r); camera.lookAt(s.x, 0, s.z);
      const fade = $('#tourFade');
      if (tourT > STOP_S - 0.8 && !fade.classList.contains('on')) { fade.classList.add('on'); $('#tourCap').classList.add('out'); }
      if (tourT > STOP_S) { ti = (ti + 1) % tour.length; tourT = 0; tourA = Math.random() * Math.PI * 2; showStop(); fade.classList.remove('on'); }
      slowT += dt; if (slowT > 0.5) { slowT = 0; city.update(s.x, s.z); }
    }
    const S = game.S;
    traffic.update(dt, player.x, player.z);
    const dancing = S.flags.gariaDone && S.flags.gariaDay === S.day && S.hour >= 16;
    dancers.forEach((g, i) => { g.visible = !!dancing; if (!dancing) return; const a = time * 0.5 + (i / dancers.length) * Math.PI * 2; g.position.set(RINA.pole.x + Math.cos(a) * 3.2, Math.abs(Math.sin(time * 4 + i)) * 0.15, RINA.pole.z + Math.sin(a) * 3.2); g.rotation.y = a + Math.PI; animPerson(g, 0.6, dt); g.userData.armL.rotation.z = -0.6; g.userData.armR.rotation.z = 0.6; });
    const durgaOn = !!S.flags.durga || (currentMission(S)?.id === 'durga' && isNight(S));
    crowd.forEach((g, i) => { g.visible = durgaOn; if (durgaOn) g.position.y = Math.max(0, Math.sin(time * 6 + i)) * 0.06; });
    const dark = lighting.nightFactor > 0.35 || (S.rain && lighting.nightFactor > 0.2);
    const lanternOn = playing && lanternWanted && dark;
    const hold = lanternOn && !vehicles.riding && !rideView.active && !photo.active;
    const flame = player.updateLantern(hold, lighting.nightFactor);
    lighting.update(S, player.body.position, dt, playing ? { at: hold ? flame : null, on: lanternOn } : null);
    kit.material.emissiveIntensity = lighting.nightFactor * 0.85;
    lamps.update(lighting.nightFactor); real.setNight(lighting.nightFactor); diyas.visible = isFestival(S.day, 'diwali') && lighting.nightFactor > 0.4;
    renderer.render(scene, camera);
  });
  addEventListener('beforeunload', () => { void net.flush(); });
  // installable and playable offline once loaded (production builds only)
  if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

boot().catch((err) => { console.error(err); const l = document.getElementById('loading'); if (l) { l.hidden = false; l.textContent = 'Something went wrong: ' + (err as Error).message; } });
