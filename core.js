/* Courier Supply Models core: one made-up city, one day, three ways to get couriers on the road.
   Works in the browser (window.SupplyCore) and in Node (module.exports), so the app and the tests share this file. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SupplyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIRST_HOUR = 10, LAST_HOUR = 23;      // service hours: 10:00 to 24:00
  var PACE = 3;                             // orders one courier can deliver per hour when fully busy
  var TARGET_UTIL = 0.7;                    // the planner books couriers so they are ~70% busy
  var BASE_MIN = 22;                        // delivery time with a nearly empty city, in minutes

  function rng(seed) {                      // small seeded generator, so a "day" can be replayed
    var s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bump(h, center, width) { return Math.exp(-Math.pow((h - center) / width, 2)); }

  /* Share of the day's orders in each hour: a lunch peak and a bigger dinner peak.
     peakiness 0 = flat day, 1 = very sharp peaks. */
  function shape(peakiness) {
    var out = [], sum = 0, h;
    for (h = FIRST_HOUR; h <= LAST_HOUR; h++) {
      var flat = 1;
      var peaks = 0.9 * bump(h + 0.5, 13, 1.1) + 1.5 * bump(h + 0.5, 20, 1.4) + 0.15;
      var v = (1 - peakiness) * flat + peakiness * peaks * 1.6;
      out.push(v); sum += v;
    }
    return out.map(function (v) { return v / sum; });
  }

  /* What actually happens: baseline curve, a surprise window, and a little noise. */
  function demandCurves(p) {
    var base = shape(p.peakiness).map(function (s) { return s * p.dailyOrders; });
    var rand = rng(p.seed);
    var forecast = base.map(function (v) { return v * (1 + p.forecastBias); });
    var actual = base.map(function (v, i) {
      var h = FIRST_HOUR + i;
      var shock = (h >= p.shockFrom && h < p.shockTo) ? 1 + p.shock : 1;
      var noise = 1 + (rand() - 0.5) * 2 * p.noise;
      return v * shock * noise;
    });
    return { forecast: forecast, actual: actual };
  }

  /* How a given number of couriers handles a given number of orders in one hour. */
  function service(demand, couriers) {
    if (demand <= 0) return { served: 0, time: BASE_MIN, util: 0, lostShare: 0 };
    if (couriers < 0.05) return { served: 0, time: 70, util: 1, lostShare: 1 };
    var util = demand / (couriers * PACE);
    var u = Math.min(util, 0.97);
    var time = Math.min(70, BASE_MIN + 8 * u / (1 - u));
    var lostShare = Math.min(0.5, Math.max(0, (time - 40) / 60));   // customers give up when it takes too long
    var served = Math.min(demand * (1 - lostShare), couriers * PACE);
    return { served: served, time: time, util: Math.min(1, served / (couriers * PACE)), lostShare: 1 - served / demand };
  }

  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  /* Open market: couriers come online when expected earnings beat their reservation wage.
     Solve N = pool * sigmoid((earnings(N) - wage) / spread) by bisection. earnings(N) falls as N rises, so there is one answer. */
  function openEquilibrium(demand, p, pool) {
    var lo = 0, hi = pool, i;
    function gap(n) {
      var svc = service(demand, n);
      var earn = n > 0.05 ? p.perOrderFee * svc.served / n : p.perOrderFee * PACE;
      return pool * sigmoid((earn - p.reservation) / p.spread) - n;
    }
    for (i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (gap(mid) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* Run one model over the day.
     model: 'booked' | 'open' | 'hybrid' */
  function simulate(p, model) {
    var d = demandCurves(p), hours = [], prevOpen = null, i;
    for (i = 0; i < d.actual.length; i++) {
      var h = FIRST_HOUR + i, demand = d.actual[i], fc = d.forecast[i];
      var planned = Math.max(p.minBooked, Math.ceil(fc / (PACE * TARGET_UTIL)));
      var bookedOn = 0, openOn = 0, bookedShare = model === 'booked' ? 1 : model === 'hybrid' ? p.hybridShare : 0;

      if (bookedShare > 0) bookedOn = Math.round(planned * bookedShare) * (1 - p.noShow);
      if (model === 'open' || model === 'hybrid') {
        var residual = demand;
        if (model === 'hybrid') residual = Math.max(0, demand - bookedOn * PACE * TARGET_UTIL);
        var target = openEquilibrium(residual, p, p.pool);
        var start = prevOpen === null ? target * 0.5 : prevOpen;
        openOn = start + p.response * (target - start);        // couriers do not all react within the hour
        prevOpen = openOn;
      }
      var total = bookedOn + openOn;
      var svc = service(demand, total);
      var openServed = total > 0 ? svc.served * openOn / total : 0;
      var cost = bookedOn * p.hourlyRate + openServed * p.perOrderFee;
      hours.push({
        hour: h, demand: demand, forecast: fc, planned: planned, booked: bookedOn, open: openOn, couriers: total,
        capacity: total * PACE * TARGET_UTIL, served: svc.served, lost: demand - svc.served, time: svc.time, util: svc.util,
        cost: cost, bookedPay: bookedOn * p.hourlyRate, openPay: openServed * p.perOrderFee,
        earnPerHour: total > 0 ? ((bookedOn * p.hourlyRate + openServed * p.perOrderFee) / total) : 0
      });
    }
    return { model: model, hours: hours, summary: summarize(hours) };
  }

  function summarize(hours) {
    var placed = 0, served = 0, cost = 0, timeW = 0, courierHours = 0, busyHours = 0, peak = 0, idleCost = 0, minEarn = Infinity;
    hours.forEach(function (x) {
      placed += x.demand; served += x.served; cost += x.cost; timeW += x.time * x.served;
      courierHours += x.couriers; busyHours += x.couriers * x.util;
      if (x.time > peak) peak = x.time;
      idleCost += x.bookedPay * (1 - x.util);
      if (x.couriers > 0.5 && x.earnPerHour < minEarn) minEarn = x.earnPerHour;
    });
    return {
      placed: placed, served: served, lost: placed - served, lostPct: placed ? 100 * (placed - served) / placed : 0,
      cost: cost, costPerOrder: served ? cost / served : 0,
      avgTime: served ? timeW / served : 0, peakTime: peak,
      courierHours: courierHours, utilization: courierHours ? 100 * busyHours / courierHours : 0,
      idleCost: idleCost, earnPerHour: courierHours ? cost / courierHours : 0, minEarnPerHour: minEarn === Infinity ? 0 : minEarn
    };
  }

  var DEFAULTS = {
    dailyOrders: 1800, peakiness: 0.7, noise: 0.05, seed: 7,
    shock: 0, shockFrom: 19, shockTo: 22, forecastBias: 0, noShow: 0.05, minBooked: 2,
    hourlyRate: 10.5, perOrderFee: 4.5, pool: 160, reservation: 8, spread: 2, response: 0.6, hybridShare: 0.6
  };

  var SCENES = {
    normal: { label: 'Normal weekday', set: {} },
    rain: { label: 'Rain at dinner', set: { shock: 0.4, shockFrom: 19, shockTo: 22 } },
    slow: { label: 'Slow Tuesday', set: { dailyOrders: 1100, forecastBias: 0.3 } },
    thin: { label: 'Thin courier pool', set: { pool: 70 } },
    sharp: { label: 'Sharp peaks', set: { peakiness: 1 } },
    wrong: { label: 'Forecast is off', set: { forecastBias: -0.25, noShow: 0.12 } }
  };

  function params(over) {
    var p = {}, k;
    for (k in DEFAULTS) p[k] = DEFAULTS[k];
    for (k in (over || {})) p[k] = over[k];
    return p;
  }

  return {
    FIRST_HOUR: FIRST_HOUR, LAST_HOUR: LAST_HOUR, PACE: PACE, TARGET_UTIL: TARGET_UTIL,
    rng: rng, shape: shape, demandCurves: demandCurves, service: service, openEquilibrium: openEquilibrium,
    simulate: simulate, summarize: summarize, params: params, DEFAULTS: DEFAULTS, SCENES: SCENES
  };
});
