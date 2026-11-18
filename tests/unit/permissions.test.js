import { test } from 'node:test';
import assert from 'node:assert/strict';
import { permissionList, missing, normState, PERMS } from '../../web/js/permissions.js';
import { ensureLocation, onlineOn, getLoc, forgetWeather } from '../../web/js/weatherApi.js';
import { tilesOn } from '../../web/js/ui/maptiles.js';
import { planNetOn } from '../../web/js/planApi.js';
import { setPref, getPref } from '../../web/js/store.js';

const phone = (raw) => ({ available: true, permissionState: () => raw });
const browser = (geo, notif) => ({ app: { available: false }, nav: { geolocation: {}, permissions: { query: async ({ name }) => ({ state: name === 'geolocation' ? geo : 'prompt' }) } }, Notif: notif });

test('normState keeps the four known states and treats anything else as unsupported', () => {
  for (const s of ['granted', 'ask', 'blocked', 'unsupported']) assert.equal(normState(s), s);
  for (const s of ['', 'yes', null, undefined, '__proto__']) assert.equal(normState(s), 'unsupported');
});
test('on the phone the list follows the native answer, in order, without unsupported rows', async () => {
  const list = await permissionList({ app: phone({ location: 'granted', notifications: 'ask', activity: 'blocked', battery: 'unsupported' }) });
  assert.deepEqual(list.map((p) => [p.id, p.state]), [['location', 'granted'], ['notifications', 'ask'], ['activity', 'blocked']]);
});
test('missing = required rows that are not allowed (ask or blocked); the optional battery row never counts', async () => {
  const list = await permissionList({ app: phone({ location: 'granted', notifications: 'ask', activity: 'blocked', battery: 'ask' }) });
  assert.deepEqual(missing(list).map((p) => p.id), ['notifications', 'activity']);
  assert.deepEqual(missing(await permissionList({ app: phone({ location: 'granted', notifications: 'granted', activity: 'granted', battery: 'ask' }) })), []);
  assert.ok(PERMS.find((p) => p.id === 'battery').required === false);
});
test('in a browser only location and notifications exist, read from the Permissions API and Notification', async () => {
  const list = await permissionList(browser('denied', { permission: 'granted' }));
  assert.deepEqual(list.map((p) => [p.id, p.state]), [['location', 'blocked'], ['notifications', 'granted']]);
  assert.deepEqual((await permissionList(browser('prompt', { permission: 'default' }))).map((p) => p.state), ['ask', 'ask']);
  assert.deepEqual((await permissionList(browser('granted', undefined))).map((p) => [p.id, p.state]), [['location', 'granted']]); // no Notification API: that row is left out
});
test('a browser that cannot say still offers the location when it has geolocation', async () => {
  const env = { app: { available: false }, nav: { geolocation: {}, permissions: { query: async () => { throw new Error('no'); } } }, Notif: undefined };
  assert.deepEqual((await permissionList(env)).map((p) => [p.id, p.state]), [['location', 'ask']]);
});

test('the map, the weather and the planner are on unless the person turned them off', () => {
  assert.equal(tilesOn(), true); assert.equal(onlineOn(), true); assert.equal(planNetOn(), true);
  setPref('mapTiles', '0'); setPref('onlineWx', '0'); setPref('planNet', '0'); assert.equal(tilesOn(), false); assert.equal(onlineOn(), false); assert.equal(planNetOn(), false);
  for (const k of ['mapTiles', 'onlineWx', 'planNet']) setPref(k, '1');
});
test('ensureLocation saves a rounded position, refreshes after 6 hours, keeps the old one on failure, and does nothing when the weather is off', async () => {
  forgetWeather(); setPref('onlineWx', '1'); let calls = 0; const at = (lat, lon) => async () => { calls++; return { lat, lon }; };
  assert.deepEqual(await ensureLocation({ now: 1e12, locateFn: at(32.08123, 34.78456) }), { lat: 32.08, lon: 34.78 }); assert.equal(calls, 1);
  await ensureLocation({ now: 1e12 + 3600000, locateFn: at(10, 10) }); assert.equal(calls, 1, 'fresh enough: not asked again');
  assert.equal((await ensureLocation({ now: 1e12 + 7 * 3600000, locateFn: at(33.1, 35.2) })).lat, 33.1); assert.equal(calls, 2);
  assert.deepEqual(await ensureLocation({ now: 1e12 + 20 * 3600000, locateFn: async () => { throw new Error('no signal'); } }), getLoc(), 'a failure keeps what was saved');
  setPref('onlineWx', '0'); const before = calls; await ensureLocation({ now: 2e12, locateFn: at(1, 1) }); assert.equal(calls, before); assert.equal(getPref('onlineWx', '1'), '0');
  setPref('onlineWx', '1');
});
