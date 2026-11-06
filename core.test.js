const test = require('node:test');
const assert = require('node:assert');
const C = require('./core.js');

const P = C.params();

test('hourly shape sums to one and peaks at dinner', () => {
  const s = C.shape(0.7);
  assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const top = s.indexOf(Math.max.apply(null, s)) + C.FIRST_HOUR;
  assert.ok(top >= 19 && top <= 21);
});

test('same seed gives the same day, another seed does not', () => {
  const a = C.demandCurves(C.params({ seed: 3 })).actual;
  const b = C.demandCurves(C.params({ seed: 3 })).actual;
  const c = C.demandCurves(C.params({ seed: 4 })).actual;
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
});

test('more couriers never means slower delivery or fewer orders served', () => {
  let prevTime = Infinity, prevServed = -1;
  for (let n = 2; n <= 60; n += 2) {
    const s = C.service(100, n);
    assert.ok(s.time <= prevTime + 1e-9);
    assert.ok(s.served >= prevServed - 1e-9);
    prevTime = s.time; prevServed = s.served;
  }
});

test('served orders never exceed demand or courier capacity', () => {
  for (const d of [0, 10, 100, 400]) for (const n of [0, 1, 10, 80]) {
    const s = C.service(d, n);
    assert.ok(s.served <= d + 1e-9);
    assert.ok(s.served <= n * C.PACE + 1e-9);
  }
});

test('open market equilibrium stays inside the pool and grows with demand', () => {
  let prev = -1;
  for (const d of [10, 50, 100, 200, 400]) {
    const n = C.openEquilibrium(d, P, P.pool);
    assert.ok(n >= 0 && n <= P.pool);
    assert.ok(n >= prev - 1e-9);
    prev = n;
  }
});

test('equilibrium is a fixed point', () => {
  const d = 120, n = C.openEquilibrium(d, P, P.pool);
  const svc = C.service(d, n);
  const earn = P.perOrderFee * svc.served / n;
  const back = P.pool / (1 + Math.exp(-(earn - P.reservation) / P.spread));
  assert.ok(Math.abs(back - n) < 1e-6);
});

test('cost adds up over the day', () => {
  for (const m of ['booked', 'open', 'hybrid']) {
    const r = C.simulate(P, m);
    const sum = r.hours.reduce((a, h) => a + h.cost, 0);
    assert.ok(Math.abs(sum - r.summary.cost) < 1e-6);
    assert.ok(r.summary.served <= r.summary.placed + 1e-9);
    assert.strictEqual(r.hours.length, C.LAST_HOUR - C.FIRST_HOUR + 1);
  }
});

test('an unplanned dinner surge hurts booked shifts more than a big open pool', () => {
  const p = C.params({ shock: 0.5, pool: 220 });
  const booked = C.simulate(p, 'booked').summary, open = C.simulate(p, 'open').summary;
  assert.ok(booked.lostPct > open.lostPct);
});

test('an over-forecast slow day leaves booked shifts paying for idle couriers', () => {
  const p = C.params({ dailyOrders: 1100, forecastBias: 0.3 });
  const booked = C.simulate(p, 'booked').summary;
  assert.ok(booked.idleCost > 0);
  assert.ok(booked.utilization < C.simulate(C.params(), 'booked').summary.utilization);
});

test('hybrid with a booked share of 0 is the open market, and a share of 1 costs at least the booked plan', () => {
  const o = C.simulate(C.params({ hybridShare: 0, noise: 0 }), 'hybrid').summary;
  const oo = C.simulate(C.params({ noise: 0 }), 'open').summary;
  assert.ok(Math.abs(o.cost - oo.cost) < 1e-6);
  const h = C.simulate(C.params({ hybridShare: 1, noise: 0 }), 'hybrid').summary;
  const bb = C.simulate(C.params({ noise: 0 }), 'booked').summary;
  assert.ok(h.cost >= bb.cost - 1e-6);
  assert.ok(h.lostPct <= bb.lostPct + 1e-6);
});

test('every scene runs and produces finite numbers', () => {
  for (const k of Object.keys(C.SCENES)) for (const m of ['booked', 'open', 'hybrid']) {
    const s = C.simulate(C.params(C.SCENES[k].set), m).summary;
    for (const v of Object.values(s)) assert.ok(Number.isFinite(v), k + ' ' + m);
  }
});
