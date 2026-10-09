import * as THREE from 'three';
import './styles.css';
import { CITIES, kmFromCity } from '../shared/geo.js';
import { currentMission, missionIndex, missionText } from '../shared/missions.js';
import { RINA } from '../shared/farm.js';
import { SPOTS } from '../shared/spots.js';
import { standByKey, standsFor, type HomeSite, type Stand } from '../shared/stands.js';
import { SIGHTS, dailyDeliveries, deliveryById } from '../shared/errands.js';
import { isNight } from '../shared/time.js';
import { play, toggleSound, unlockAudio } from './audio.js';
import { auth, loadAuthConfig, signIn, takeAuthResult } from './auth.js';
import { blocked } from './collide.js';
import { Game } from './game.js';
import { buildSpots, findTarget, missionTarget, type Ctx } from './interact.js';
import { HomeView } from './home.js';
import { findHomeSite, findLocality, localities } from './map/places.js';
import { fixName, getH, loadMap } from './map/data.js';
import { Net } from './net.js';
import { buildNeighbours, kaamFor } from './npcs.js';
import { Player, isTouch } from './player.js';
import { RideView } from './ride.js';
import { RoadGraph } from './route.js';
import { City, KitFleet, loadKit, planBuildings } from './scene/buildings.js';
import { FarmView } from './scene/farm.js';
import { PALACE, StandsView, buildBus, buildCrowds, buildNPCs, buildPalace, buildPandal, buildStall } from './scene/landmarks.js';
import { animPerson, sit, Traffic } from './scene/people.js';
import { Labels, buildGround, buildHills, buildRoads, buildSky, buildTrees } from './scene/world.js';
import { Lighting } from './sky.js';
import { $, closePanels, esc, fade, modalOpen, toast, wait } from './ui/dom.js';
import { setPrompt, updateHud } from './ui/hud.js';
import { MapView } from './ui/map.js';
import { dialog, nextPage, openBoard, renderShop, showEnd, wireShop } from './ui/panels.js';

const TOMTOM_COLOURS = ['#2f8f4e', '#3a9a5a', '#e3b23c', '#2f8f4e', '#2a7fb0', '#c94a3a', '#3a9a5a'];

async function boot(): Promise<void> {
  const loading = $('#loading');
  const net = new Net();
  const authResult = takeAuthResult();
  if (authResult?.token) net.adopt(authResult.token);
  void loadAuthConfig();
  const [map, kit, first] = await Promise.all([
    loadMap('/agartala-map.json', (f) => (loading.textContent = `Loading the streets of Agartala… ${Math.round(f * 100)}%`)),
    loadKit('/models/kit.glb'),
    net.start(),
  ]);
  map.places.push(
    { x: 84, z: -1600, name: 'Circuit House', kind: 'landmark' }, { x: -760, z: -1540, name: 'Bhati Abhoynagar fields', kind: 'landmark' },
    { x: PALACE.x, z: PALACE.z, name: 'Ujjayanta Palace', kind: 'landmark' }, { x: -94, z: 149, name: 'Jagannath Lake', kind: 'landmark' },
    { x: 250, z: 1255, name: 'Maharajganj Bazar', kind: 'landmark' }, { x: 26, z: -547, name: 'Lake Chowmuhani Bazar', kind: 'landmark' },
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
  const city = new City(scene, kit, planBuildings(map));
  const palaceLights = buildPalace(scene); const pandal = buildPandal(scene, map); buildStall(scene, map);
  const standFleet = new KitFleet(scene, kit, 'tomtom', 10, TOMTOM_COLOURS);
  const standsView = new StandsView(scene, map, standFleet, 10); buildBus(scene, map);
  const farm = new FarmView(scene);
  buildTrees(scene, map);
  const skyFx = buildSky(scene);
  const npc = buildNPCs(scene, map);
  const home = new HomeView(scene, npc.grandpa);
  const neighbours = buildNeighbours(scene, map);
  const { dancers, crowd } = buildCrowds(scene, map);
  const trafficFleet = new KitFleet(scene, kit, 'tomtom', 70, TOMTOM_COLOURS);
  const traffic = new Traffic(scene, map, trafficFleet, 70);
  const graph = new RoadGraph(map);
  const rideView = new RideView(scene, map, graph, new KitFleet(scene, kit, 'tomtom', 1, ['#2f8f4e']), 0);
  const lighting = new Lighting(scene, skyFx, palaceLights, pandal);
  const mapView = new MapView(map);
  const player = new Player(scene, map, camera, canvas);
  const labels = new Labels(scene);
  let homeLabel: THREE.Sprite | null = null;
  void (document.fonts?.ready ?? Promise.resolve()).then(() => {
    labels.add('Ujjayanta Palace', 'উজ্জয়ন্ত প্রাসাদ', PALACE.x, 62, PALACE.z, 3.2, 2500);
    labels.add('Lake Chowmuhani Bazar', 'লেক চৌমুহনী বাজার', SPOTS.gopal[0], 14, SPOTS.gopal[1], 1.4, 1200);
    labels.add('Durgabari', 'দুর্গাবাড়ি', SPOTS.pandal[0], 16, SPOTS.pandal[1], 1.2, 900);
    labels.add('Radhanagar Bus Terminus', 'রাধানগর বাস টার্মিনাস', SPOTS.busTerminus[0], 12, SPOTS.busTerminus[1], 1.2, 900);
    labels.add('Jagannath Lake', 'জগন্নাথ দিঘি', -94, 8, 149, 1.2, 700);
    labels.add('Haora river', 'হাওড়া নদী', 300, 6, 1150, 1.6, 1200);
    homeLabel = labels.add('Your bari', 'বাড়ি', -720, 12, -1472, 1, 900); placeHome();
    labels.add('Family fields', 'খেত', -790, 10, -1560, 1, 900);
    labels.add('Circuit House', 'সার্কিট হাউস', 84, 12, -1600, 1.1, 800);
    for (const p of map.chowmuhanis) labels.add(fixName(p.name), null, p.x, 9, p.z, 0.9, 450);
  });

  /* ---------- game state & feedback ---------- */
  const game = new Game(first, net, (events, err) => {
    if (err) { toast(err); play('no'); }
    for (const e of events) {
      if (e.kind === 'toast' || e.kind === 'day') { toast(e.text); play(e.sfx); }
      else if (e.kind === 'sfx') play(e.sfx);
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
    if (key === placedHome) return; placedHome = key; home.place(h);
    if (homeLabel) { const f = home.front; homeLabel.position.set(f.x, 12, f.z); }
  }
  const refresh = () => {
    const S = game.S; farm.refresh(S); placeHome();
    player.body.userData.shawl.visible = !!S.flags.shawl; pandal.visible = S.mission >= durgaIdx;
    if (!$('#shop').hidden) renderShop(S);
    hudTick(true);
  };
  game.onChange(refresh);
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
  const ctx: Ctx = {
    game, map, npc, neighbours, traffic, home,
    player: () => ({ x: player.x, z: player.z, face: player.face }),
    sleep: async () => { fade(true); await wait(650); game.dispatch({ t: 'sleep' }); await wait(350); fade(false); },
    ride: startRide,
    kharchiTrip: async () => {
      play('horn'); fade(true); await wait(700); fade(false);
      dialog({ name: 'The Chantai', role: 'Chaturdasha Devata Mandir · Old Agartala' }, [
        'You came by bus from Radhanagar? Half of Agartala has done the same today.',
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
  const marks = () => ({ player: { x: player.x, z: player.z, face: player.face }, target, kaam: kaamMarks(), errand: errandMarks(), sights: sightMarks(), home: home.front });
  function hudTick(force = false) {
    target = rideView.active ? null : missionTarget(game.S, { x: player.x, z: player.z }, spots, { x: npc.grandpa.x, z: npc.grandpa.z });
    updateHud({ S: game.S, place: map.placeName(player.x, player.z), target, px: player.x, pz: player.z, yaw: player.yaw, online: net.online, lost: net.lost }, force);
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
  const board = () => void openBoard(game, net, auth);
  $('#bMap').onclick = toggleMap; $('#mini').onclick = toggleMap; $('#mapClose').onclick = () => ($('#bigmap').hidden = true);

  /* ---------- where is home? ---------- */
  const LOCALITIES = localities(map);
  const FIELDS_NAME = 'Bhati Abhoynagar (the family fields)';
  $('#homeList').innerHTML = [FIELDS_NAME, ...LOCALITIES.map((l) => l.name)].map((n) => `<option value="${esc(n)}"></option>`).join('');
  const homeLabelText = () => game.S.home ? game.S.home.name : FIELDS_NAME;
  /** Turns what the player typed into a house site, or null for the fields. undefined = not found. */
  const resolveHome = (q: string): HomeSite | null | undefined => {
    const t = q.trim(); if (!t || /family fields|^bhati abhoynagar( fields)?$/i.test(t)) return null;
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
    { name: 'Family fields · Bhati Abhoynagar', x: -790, z: -1525 },
    ...standsFor(game.S.home).map((st) => ({ name: `Tomtom stand · ${st.name}`, x: st.x, z: st.z })),
    ...neighbours.map((n) => ({ name: `${n.name} · ${n.role}`, x: n.x, z: n.z })),
    ...SIGHTS.map((x) => ({ name: `${x.name} · sight`, x: x.x, z: x.z })),
    ...map.places.map((p) => ({ name: p.name, x: p.x, z: p.z })),
    { name: 'Durgabari pandal', x: SPOTS.pandal[0], z: SPOTS.pandal[1] },
    { name: 'Gopal Saha · Lake Chowmuhani Bazar', x: SPOTS.gopal[0], z: SPOTS.gopal[1] },
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
      player.teleport(p.x, p.z, face); player.yaw = face + Math.PI; $('#bigmap').hidden = true;
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
  $('#bSound').onclick = () => ($('#bSound').textContent = toggleSound() ? 'Sound on' : 'Sound off');
  $('#dlgNext').onclick = nextPage; $('#endClose').onclick = () => ($('#endcard').hidden = true);
  for (const s of ['#bigmap', '#help', '#shop', '#ride', '#endcard', '#board']) $(s).addEventListener('click', (e) => { if (e.target === $(s)) $(s).hidden = true; });
  wireShop(game);
  $('#nameSave').onclick = () => { if (game.dispatch({ t: 'name', name: ($('#nameIn') as HTMLInputElement).value }).ok) { toast('Your farm is on the leaderboard.'); setTimeout(board, 900); } };
  $('#codeGo').onclick = async () => {
    try { const s = await net.restore(($('#codeIn') as HTMLInputElement).value); game.replace(s); player.teleport(s.pos.x, s.pos.z, s.pos.face); toast('Farm restored on this device.'); board(); }
    catch (e) { toast((e as Error).message); }
  };
  $('#gIn').onclick = async () => { try { await net.flush(); toast(await signIn(net.session, 'google')); } catch (e) { toast((e as Error).message); } };
  $('#eIn').onclick = async () => { try { toast(await signIn(net.session, 'email', ($('#emailIn') as HTMLInputElement).value)); } catch (e) { toast((e as Error).message); } };
  $('#resetFarm').onclick = async () => {
    const b = $('#resetFarm'); if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to start over'; return; }
    const s = await net.reset(); game.replace(s); player.teleport(s.pos.x, s.pos.z, s.pos.face); b.dataset.armed = ''; b.textContent = 'Start a new farm'; $('#board').hidden = true;
  };

  /* ---------- keyboard & touch ---------- */
  let playing = false;
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.target as HTMLElement).tagName === 'INPUT') { if (k === 'escape') closePanels(); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!playing) return;
    if (!$('#dialog').hidden) { if (k === 'e' || k === 'enter' || k === ' ') { nextPage(); e.preventDefault(); } return; }
    if (k === 'escape') return closePanels();
    if (k === 'm') return toggleMap();
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
    playing = true; unlockAudio(); $('#title').hidden = true; $('#hud').hidden = false;
    if (isTouch) { $('#touch').hidden = false; $('#game').classList.add('touch'); }
    if (game.S.ride) game.dispatch({ t: 'arrive' }); // a ride left running from last time
    const p = game.S.pos; player.teleport(p.x, p.z, p.face); player.resetView();
    refresh(); canvas.focus();
    const m = currentMission(game.S);
    if (m) toast(missionText(m.text, game.S).split('. ')[0] + '.', m.title);
    if (m?.id === 'arrive') setTimeout(() => dialog({ name: 'Circuit House', role: 'Agartala · day 1' }, [
      `The flight from ${game.S.from || 'the city'} landed at Maharaja Bir Bikram Airport an hour ago. The cab driver dropped you at Circuit House and left in a cloud of dust.`,
      'The air is thick and green after the rain. Somewhere a temple bell is ringing. Grandpa is waiting at Bhati Abhoynagar, a short tomtom ride west.',
      'The green tomtoms at the stand here go anywhere in the city. Walk up to one and press E.',
    ]), 900);
  }
  const progressed = first.mission > 0 || first.day > 1;
  $('#bContinue').hidden = !progressed; $('#bContinue').onclick = start;
  $('#bNew').textContent = progressed ? 'New farm' : 'Start';
  $('#bNew').onclick = async () => { if (progressed) { const s = await net.reset(); game.replace(s); } start(); };
  $('#offline').hidden = net.online;
  if (authResult?.error) toast(authResult.error);
  else if (authResult?.token && net.signedIn) toast(`Signed in${net.email ? ` as ${net.email}` : ''}. Your farm now follows your account.`);
  refresh(); resize(); loading.hidden = true; $('#title').hidden = false;
  // test hooks for scripted play-throughs and screenshots (only when a test page asks for them)
  if ((window as unknown as { __HAORA_DEBUG__?: boolean }).__HAORA_DEBUG__) {
    (window as unknown as Record<string, unknown>).__haora = {
      start, game, ride: (a: string, b: string) => startRide(standByKey(a)!, standByKey(b)!),
      teleport: (x: number, z: number, face = 0) => player.teleport(x, z, face), view: (yaw: number, pitch: number, dist: number) => { player.yaw = yaw; player.pitch = pitch; player.dist = dist; },
    };
  }

  /* ---------- loop ---------- */
  const clock = new THREE.Clock(); let hudT = 0, slowT = 0, posT = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    if (playing) {
      if (rideView.active) {
        const info = rideView.update(net.now(), player.body);
        if (!info) leaveRide(false);
        else {
          rideTo = info.to;
          let d = rideView.heading() + Math.PI - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); player.yaw += d * Math.min(1, dt * 1.5);
          promptP = { label: `Riding to ${info.to.name} · ${(info.left / 1000).toFixed(1)} km to go · E or Space to skip`, run: () => leaveRide(true) }; prompt = null;
        }
      } else if (!modalOpen()) player.move(dt, game.S.cycle, time);
      game.tick();
      const S = game.S;
      if (!rideView.active) {
        rideTo = null;
        prompt = findTarget(ctx, spots); promptP = prompt ? prompt.get() : null;
      }
      if (prompt) { ring.visible = true; ring.position.set(prompt.x, getH(prompt.x, prompt.z) + 0.35, prompt.z); const s = Math.min(3, prompt.r * 0.9) * (1 + Math.sin(time * 5) * 0.05); ring.scale.set(s, s, s); (ring.material as THREE.MeshBasicMaterial).color.set(promptP?.run ? '#f2c14a' : '#f6efe0'); } else ring.visible = false;
      if (target) { marker.visible = true; const dd = Math.hypot(target.x - player.x, target.z - player.z); marker.position.set(target.x, getH(target.x, target.z) + 3 + Math.sin(time * 2.4) * 0.2, target.z); gem.rotation.y = time * 1.5; gem.scale.setScalar(Math.min(8, Math.max(1, dd / 60))); gem.scale.y *= 1.5; beam.visible = dd > 15; } else marker.visible = false;
      hudT += dt; if (hudT > 0.2) { hudT = 0; hudTick(); setPrompt(promptP, isTouch); }
      slowT += dt; if (slowT > 0.5) { slowT = 0; farm.growing(S); labels.update(player.x, player.z); city.update(player.x, player.z); }
      posT += dt; if (posT > 10 && !rideView.active) { posT = 0; game.dispatch({ t: 'pos', x: player.x, z: player.z, face: player.face }); }
      player.updateCamera(dt);
    } else {
      const a = time * 0.04; camera.position.set(PALACE.x + Math.cos(a) * 260, 120, PALACE.z + 120 + Math.sin(a) * 260); camera.lookAt(PALACE.x, 0, PALACE.z + 80);
      slowT += dt; if (slowT > 0.5) { slowT = 0; city.update(PALACE.x, PALACE.z + 120); }
    }
    const S = game.S;
    traffic.update(dt, player.x, player.z);
    const dancing = S.flags.gariaDone && S.flags.gariaDay === S.day && S.hour >= 16;
    dancers.forEach((g, i) => { g.visible = !!dancing; if (!dancing) return; const a = time * 0.5 + (i / dancers.length) * Math.PI * 2; g.position.set(RINA.pole.x + Math.cos(a) * 3.2, Math.abs(Math.sin(time * 4 + i)) * 0.15, RINA.pole.z + Math.sin(a) * 3.2); g.rotation.y = a + Math.PI; animPerson(g, 0.6, dt); g.userData.armL.rotation.z = -0.6; g.userData.armR.rotation.z = 0.6; });
    const durgaOn = !!S.flags.durga || (currentMission(S)?.id === 'durga' && isNight(S));
    crowd.forEach((g, i) => { g.visible = durgaOn; if (durgaOn) g.position.y = Math.max(0, Math.sin(time * 6 + i)) * 0.06; });
    lighting.update(S, player.body.position, dt);
    kit.material.emissiveIntensity = lighting.nightFactor * 0.85;
    renderer.render(scene, camera);
  });
  addEventListener('beforeunload', () => { void net.flush(); });
}

boot().catch((err) => { console.error(err); const l = document.getElementById('loading'); if (l) { l.hidden = false; l.textContent = 'Something went wrong: ' + (err as Error).message; } });
