import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapHeadingForCamera } from '../src/lib/mapHeadingScope.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const camera = (zoom, lat=48.946, lng=9.43) => ({zoom,lat,lng});

test('zooming out changes nearby heading through region, country, Europe and world', () => {
  assert.deepEqual(mapHeadingForCamera(camera(16), 'Backnang', true, 'map'),
    {title:'RENNEN IN DEINER NÄHE', subtitle:'Backnang'});
  assert.deepEqual(mapHeadingForCamera(camera(10), 'Backnang', true, 'map'),
    {title:'RENNEN IN DER REGION', subtitle:'Regionale Kartenansicht'});
  assert.deepEqual(mapHeadingForCamera(camera(6), 'Backnang', true, 'map'),
    {title:'COMMUNITY-NETZWERK', subtitle:'Länderübersicht'});
  assert.deepEqual(mapHeadingForCamera(camera(3.2), 'Backnang', true, 'map'),
    {title:'EUROPA · COMMUNITY', subtitle:'Europaübersicht'});
  assert.deepEqual(mapHeadingForCamera(camera(2), 'Backnang', true, 'map'),
    {title:'WELTWEITES NETZWERK', subtitle:'Weltübersicht'});
});

test('region claims never follow the GPS city after the camera pans overseas', () => {
  assert.deepEqual(mapHeadingForCamera(camera(3.5, 35.7, 139.7), 'Backnang', true, 'map'),
    {title:'COMMUNITY-NETZWERK', subtitle:'Kontinentübersicht'});
  assert.equal(mapHeadingForCamera(camera(1.4, 0, 0), 'Backnang', false, 'map').subtitle,'Weltübersicht');
  assert.equal(mapHeadingForCamera(camera(NaN, 0, 0), 'Backnang', true, 'map').subtitle,'Weltübersicht');
});

test('local list keeps its truthful nearby title, even after distant map zoom', () => {
  assert.deepEqual(mapHeadingForCamera(camera(1.8, 35.7, 139.7), 'Backnang', true, 'list'),
    {title:'RENNEN IN DEINER NÄHE', subtitle:'Backnang'});
  assert.equal(mapHeadingForCamera(camera(17), null, false, 'list').subtitle,
    'Standort für genaue Entfernungen aktivieren');
});

test('camera events update the heading without reinitializing MapLibre on every gesture', () => {
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  const chrome = read('src/components/map/ArcadeMapChrome.tsx');
  assert.match(map, /map\.on\('moveend', onCameraIdle\)/);
  assert.match(map, /map\.off\('moveend', onCameraIdle\)/);
  assert.match(map, /callbacks\.current\.onCameraChange\(\{ zoom: map\.getZoom\(\), lat: center\.lat, lng: center\.lng \}\)/);
  assert.match(screen, /onCameraChange=\{setMapCamera\}/);
  assert.match(screen, /camera=\{mapCamera\}/);
  assert.match(chrome, /const heading = mapHeadingForCamera\(camera, cityName, hasGps, view\)/);
  assert.match(chrome, /<h1>\{heading\.title\}<\/h1>/);
  assert.match(chrome, /<p>\{heading\.subtitle\}<\/p>/);
});

test('world border glow is dimmer than regional border emphasis', () => {
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(map, /name === 'boundary_2'/);
  assert.match(map, /0, 0\.65, 2, 0\.9, 4, 1\.25, 7, 1\.65/);
  assert.match(map, /0, 0\.34, 2, 0\.48, 4, 0\.66, 7, 0\.88/);
  assert.match(map, /1, 0\.055, 3, 0\.095, 5, 0\.17, 8, 0\.20/);
  assert.match(map, /'line-blur': 2\.4/);
  assert.match(map, /name === 'boundary_3'/);
  assert.match(map, /name === 'boundary_disputed'/);
});

test('far-away landcover and roads lose contrast without harming street zoom', () => {
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(map, /name === 'natural_earth'/);
  assert.match(map, /0, 0\.09, 3, 0\.065, 6, 0\.02/);
  assert.match(map, /name === 'park_outline'/);
  assert.match(map, /3, 0, 8, 0\.045, 11, 0\.12/);
  assert.match(map, /ice \? 0\.12 : 0\.035, 7, 0\.08/);
  assert.match(map, /residential \? '#143348' : '#17394b'/);
  assert.match(map, /main \? \['interpolate', \['linear'\], \['zoom'\], 3, 0\.20/);
  assert.match(map, /3, 0\.06, 6, 0\.12, 9, 0\.35/);
  assert.match(map, /12, 0\.82, 16, 0\.96/);
});

test('3D switch has both CSS and React safeguards for host and race popups', () => {
  const map = read('src/components/map/ArcadeMapLibreView.tsx');
  const css = read('src/styles/maplibreArcade.css');
  assert.match(map, /const \[popupVisible, setPopupVisible\] = useState\(false\)/);
  assert.match(map, /setPopupVisible\(true\)/);
  assert.match(map, /setPopupVisible\(Boolean\(activeRunPopupRef\.current \|\| hostPopupRef\.current\)\)/);
  assert.match(map, /setPopupVisible\(Boolean\(hostPopupRef\.current \|\| activeRunPopupRef\.current\)\)/);
  assert.match(map, /' is-obscured-by-popup'/);
  assert.match(map, /aria-hidden=\{popupVisible\}/);
  assert.match(map, /disabled=\{popupVisible\}/);
  assert.match(css, /\.runnit-gl-tilt-button\.is-obscured-by-popup/);
  assert.match(css, /visibility:hidden!important/);
  assert.match(css, /:has\(\.maplibregl-popup\.runnit-gl-race-popup\)/);
});
