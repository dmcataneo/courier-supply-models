/* Courier Supply Models UI: sliders in, three simulated days out. */
(function () {
  'use strict';
  var C = window.SupplyCore;
  var INK = '#1c2127', REQ = '#e8590c';
  var MODELS = [
    { id: 'booked', name: 'Booked shifts', blurb: 'Planner books each hour from a forecast. Fixed hourly pay.' },
    { id: 'open', name: 'Open market', blurb: 'Couriers log on when it pays. Paid per delivered order.' },
    { id: 'hybrid', name: 'Hybrid', blurb: 'A booked base, topped up by the open market.' }
  ];
  var KNOBS = [
    { group: 'The day', items: [
      { k: 'dailyOrders', label: 'Orders in the day', min: 400, max: 4000, step: 50, fmt: function (v) { return Math.round(v); }, note: 'Total orders placed between 10:00 and 24:00.' },
      { k: 'peakiness', label: 'How sharp the peaks are', min: 0, max: 1, step: 0.05, fmt: pct, note: '0% is a flat day. 100% is a big lunch and a bigger dinner.' },
      { k: 'shock', label: 'Surprise demand, 19:00 to 22:00', min: -0.3, max: 0.8, step: 0.05, fmt: signedPct, note: 'Rain, a match, a promo. Not in the forecast.' },
      { k: 'noise', label: 'Random noise per hour', min: 0, max: 0.2, step: 0.01, fmt: pct, note: 'Same noise for all models. Press "New random day" to change it.' }
    ] },
    { group: 'Booked shifts', items: [
      { k: 'forecastBias', label: 'Forecast error', min: -0.4, max: 0.4, step: 0.05, fmt: signedPct, note: 'Negative: the planner under-forecast. Positive: over-forecast.' },
      { k: 'noShow', label: 'No-shows', min: 0, max: 0.25, step: 0.01, fmt: pct, note: 'Booked couriers who do not turn up.' },
      { k: 'hourlyRate', label: 'Guaranteed pay per hour (EUR)', min: 6, max: 18, step: 0.5, fmt: eur, note: 'Paid for every booked hour, busy or not.' }
    ] },
    { group: 'Open market', items: [
      { k: 'perOrderFee', label: 'Pay per delivered order (EUR)', min: 2, max: 8, step: 0.1, fmt: eur, note: 'Only paid when an order is delivered.' },
      { k: 'pool', label: 'Couriers who could log on', min: 20, max: 300, step: 5, fmt: function (v) { return Math.round(v); }, note: 'The size of the pool in this city.' },
      { k: 'reservation', label: 'Lowest hourly pay they accept (EUR)', min: 4, max: 14, step: 0.5, fmt: eur, note: 'Below this, fewer couriers come online.' },
      { k: 'response', label: 'How fast supply reacts', min: 0.1, max: 1, step: 0.05, fmt: pct, note: 'Share of the gap closed each hour. 100% is instant.' },
      { k: 'hybridShare', label: 'Hybrid: booked share of the plan', min: 0, max: 1, step: 0.05, fmt: pct, note: 'The rest of the demand is left to the open market.' }
    ] }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var state = { p: C.params(), model: 'booked', scene: 'normal' };
  var results = {};

  function pct(v) { return Math.round(v * 100) + '%'; }
  function signedPct(v) { var n = Math.round(v * 100); return (n > 0 ? '+' : '') + n + '%'; }
  function eur(v) { return 'EUR ' + v.toFixed(2).replace(/\.00$/, ''); }
  function n0(v) { return Math.round(v).toLocaleString('en-US'); }
  function el(tag, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag), k;
    for (k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- run ---------- */
  function run() {
    MODELS.forEach(function (m) { results[m.id] = C.simulate(state.p, m.id); });
    draw();
  }

  /* ---------- charts ---------- */
  function drawOrders(r) {
    var svg = $('chartOrders'); svg.textContent = '';
    var W = 720, H = 280, L = 40, R = 8, T = 10, B = 28, hours = r.hours;
    var max = 0; hours.forEach(function (h) { max = Math.max(max, h.demand, h.capacity); });
    var top = Math.ceil(max / 50) * 50 || 50;
    function y(v) { return T + (H - T - B) * (1 - v / top); }
    var bw = (W - L - R) / hours.length, i;
    for (i = 0; i <= 4; i++) {
      var v = top * i / 4;
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), 'class': 'axis' }));
      svg.appendChild(el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, Math.round(v)));
    }
    hours.forEach(function (h, i) {
      var x = L + i * bw + bw * 0.14, w = bw * 0.72;
      svg.appendChild(el('rect', { x: x, y: y(h.served), width: w, height: Math.max(0, y(0) - y(h.served)), fill: '#9ad3cc', rx: 2 }));
      if (h.lost > 0.5) svg.appendChild(el('rect', { x: x, y: y(h.demand), width: w, height: Math.max(0, y(h.served) - y(h.demand)), fill: '#f6b4cc', rx: 2 }));
      var t = el('title', {}, h.hour + ':00  placed ' + n0(h.demand) + ', delivered ' + n0(h.served) + ', lost ' + n0(h.lost) + '\ncouriers ' + h.couriers.toFixed(0) + ', delivery ' + h.time.toFixed(0) + ' min');
      var hit = el('rect', { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: 'transparent' });
      hit.appendChild(t); svg.appendChild(hit);
      svg.appendChild(el('text', { x: L + i * bw + bw / 2, y: H - 10, 'text-anchor': 'middle' }, h.hour));
    });
    var d = '';
    hours.forEach(function (h, i) {
      var x0 = L + i * bw, x1 = x0 + bw;
      d += (i ? ' L' : 'M') + x0 + ' ' + y(h.capacity) + ' L' + x1 + ' ' + y(h.capacity);
    });
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
  }

  function drawTime(r) {
    var svg = $('chartTime'); svg.textContent = '';
    var W = 720, H = 150, L = 40, R = 8, T = 8, B = 24, hours = r.hours, top = 70, bot = 20;
    function y(v) { return T + (H - T - B) * (1 - (v - bot) / (top - bot)); }
    var bw = (W - L - R) / hours.length;
    [20, 40, 60].forEach(function (v) {
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), 'class': v === 40 ? 'ref' : 'axis' }));
      svg.appendChild(el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, v));
    });
    svg.appendChild(el('text', { x: L + 6, y: T + 10 }, 'dashed line: customers start to give up past 40 min'));
    var d = '';
    hours.forEach(function (h, i) {
      var x = L + i * bw + bw / 2;
      d += (i ? ' L' : 'M') + x + ' ' + y(h.time);
      svg.appendChild(el('text', { x: x, y: H - 6, 'text-anchor': 'middle' }, h.hour));
    });
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: REQ, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
    hours.forEach(function (h, i) { svg.appendChild(el('circle', { cx: L + i * bw + bw / 2, cy: y(h.time), r: 3, fill: REQ })); });
  }

  /* ---------- tables and text ---------- */
  var ROWS = [
    { label: 'Orders lost', key: 'lostPct', fmt: function (v) { return v.toFixed(1) + '%'; }, best: 'min', hint: 'Customers who gave up waiting' },
    { label: 'Average delivery time', key: 'avgTime', fmt: function (v) { return v.toFixed(0) + ' min'; }, best: 'min', hint: 'Weighted by delivered orders' },
    { label: 'Slowest hour', key: 'peakTime', fmt: function (v) { return v.toFixed(0) + ' min'; }, best: 'min', hint: 'Where the model breaks first' },
    { label: 'Cost per delivered order', key: 'costPerOrder', fmt: function (v) { return 'EUR ' + v.toFixed(2); }, best: 'min', hint: 'Courier pay only' },
    { label: 'Total courier pay', key: 'cost', fmt: function (v) { return 'EUR ' + n0(v); }, best: null, hint: '' },
    { label: 'Courier hours on the road', key: 'courierHours', fmt: n0, best: null, hint: '' },
    { label: 'Couriers busy', key: 'utilization', fmt: function (v) { return v.toFixed(0) + '%'; }, best: null, hint: 'Share of road time spent delivering' },
    { label: 'Paid for nothing', key: 'idleCost', fmt: function (v) { return 'EUR ' + n0(v); }, best: 'min', hint: 'Booked hours with no order to carry' },
    { label: 'Courier earnings per hour', key: 'earnPerHour', fmt: function (v) { return 'EUR ' + v.toFixed(2); }, best: null, hint: 'Average over the day' },
    { label: 'Courier earnings, worst hour', key: 'minEarnPerHour', fmt: function (v) { return 'EUR ' + v.toFixed(2); }, best: 'max', hint: 'How bumpy the income is' }
  ];

  function drawCompare() {
    var t = $('compare'); t.textContent = '';
    var head = '<thead><tr><th></th>' + MODELS.map(function (m) { return '<th>' + m.name + '</th>'; }).join('') + '<th></th></tr></thead>';
    var body = '<tbody>' + ROWS.map(function (row) {
      var vals = MODELS.map(function (m) { return results[m.id].summary[row.key]; });
      var bestV = null;
      if (row.best === 'min') bestV = Math.min.apply(null, vals);
      if (row.best === 'max') bestV = Math.max.apply(null, vals);
      var cells = vals.map(function (v) {
        var tie = row.best && vals.filter(function (x) { return Math.abs(x - bestV) < 1e-9 * Math.max(1, Math.abs(bestV)) + 0.005; }).length === vals.length;
        var win = row.best && !tie && Math.abs(v - bestV) <= 0.005 + 1e-9;
        return '<td' + (win ? ' class="win"' : '') + '>' + row.fmt(v) + '</td>';
      }).join('');
      return '<tr><td>' + row.label + '</td>' + cells + '<td class="hint">' + row.hint + '</td></tr>';
    }).join('') + '</tbody>';
    t.innerHTML = head + body;
  }

  function takeaway() {
    var s = {}; MODELS.forEach(function (m) { s[m.id] = results[m.id].summary; });
    var byLost = MODELS.slice().sort(function (a, b) { return s[a.id].lostPct - s[b.id].lostPct; });
    var byCost = MODELS.slice().sort(function (a, b) { return s[a.id].costPerOrder - s[b.id].costPerOrder; });
    var a = byLost[0], c = byCost[0];
    var txt = 'Fewest lost orders: ' + a.name + ' (' + s[a.id].lostPct.toFixed(1) + '%). Cheapest per order: ' + c.name + ' (EUR ' + s[c.id].costPerOrder.toFixed(2) + ').';
    if (a.id === c.id) txt = a.name + ' wins on both lost orders (' + s[a.id].lostPct.toFixed(1) + '%) and cost per order (EUR ' + s[a.id].costPerOrder.toFixed(2) + ') on this day.';
    $('takeaway').textContent = txt;
  }

  function drawModels() {
    var box = $('models'); box.textContent = '';
    MODELS.forEach(function (m) {
      var s = results[m.id].summary;
      var b = document.createElement('button');
      b.className = 'model' + (state.model === m.id ? ' is-on' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', state.model === m.id);
      b.innerHTML = '<b>' + m.name + '</b><span>' + m.blurb + '</span><br><span><strong>' + s.lostPct.toFixed(1) + '%</strong> lost · <strong>EUR ' + s.costPerOrder.toFixed(2) + '</strong> per order · <strong>' + s.avgTime.toFixed(0) + ' min</strong></span>';
      b.onclick = function () { state.model = m.id; draw(); };
      box.appendChild(b);
    });
  }

  function draw() {
    var r = results[state.model];
    drawOrders(r); drawTime(r); drawModels(); drawCompare(); takeaway();
    markScenes();
    writeHash();
  }

  /* ---------- controls ---------- */
  function buildScenes() {
    var box = $('scenes'); box.textContent = '';
    Object.keys(C.SCENES).forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'chip'; b.dataset.scene = k; b.textContent = C.SCENES[k].label;
      b.onclick = function () { applyScene(k); };
      box.appendChild(b);
    });
    var r = document.createElement('button');
    r.className = 'chip ghost'; r.textContent = 'New random day';
    r.onclick = function () { state.p.seed = (state.p.seed * 7919 + 13) % 100000; syncKnobs(); run(); };
    box.appendChild(r);
  }
  function markScenes() {
    var chips = document.querySelectorAll('#scenes .chip[data-scene]');
    Array.prototype.forEach.call(chips, function (c) { c.style.fontWeight = c.dataset.scene === state.scene ? '800' : ''; c.style.borderColor = c.dataset.scene === state.scene ? 'var(--accent)' : ''; });
  }
  function applyScene(k) {
    state.scene = k;
    var seed = state.p.seed;
    state.p = C.params(C.SCENES[k].set); state.p.seed = seed;
    syncKnobs(); run();
  }

  function buildKnobs() {
    var box = $('params'); box.textContent = '';
    KNOBS.forEach(function (g) {
      var col = document.createElement('div');
      var h = document.createElement('h2'); h.textContent = g.group; col.appendChild(h);
      g.items.forEach(function (it) {
        var d = document.createElement('div'); d.className = 'param';
        d.innerHTML = '<label for="k_' + it.k + '">' + it.label + '<output id="o_' + it.k + '"></output></label>' +
          '<input type="range" id="k_' + it.k + '" min="' + it.min + '" max="' + it.max + '" step="' + it.step + '"><small>' + it.note + '</small>';
        col.appendChild(d);
        d.querySelector('input').addEventListener('input', function (e) {
          state.p[it.k] = parseFloat(e.target.value);
          $('o_' + it.k).textContent = it.fmt(state.p[it.k]);
          state.scene = null; run();
        });
      });
      box.appendChild(col);
    });
  }
  function syncKnobs() {
    KNOBS.forEach(function (g) { g.items.forEach(function (it) {
      $('k_' + it.k).value = state.p[it.k]; $('o_' + it.k).textContent = it.fmt(state.p[it.k]);
    }); });
  }

  /* ---------- link state ---------- */
  function writeHash() {
    var o = {}, k;
    for (k in state.p) if (state.p[k] !== C.DEFAULTS[k]) o[k] = Math.round(state.p[k] * 1000) / 1000;
    var s = Object.keys(o).length || state.model !== 'booked' ? '#' + encodeURIComponent(JSON.stringify({ p: o, m: state.model })) : '';
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + s);
  }
  function readHash() {
    if (location.hash.length < 3) return;
    try {
      var o = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      var k; for (k in (o.p || {})) if (k in C.DEFAULTS && isFinite(o.p[k])) state.p[k] = +o.p[k];
      if (o.m && MODELS.some(function (m) { return m.id === o.m; })) state.model = o.m;
      state.scene = null;
    } catch (e) { /* ignore a broken link */ }
  }

  $('share').onclick = function () {
    var b = $('share'), done = function () { b.textContent = 'Link copied'; b.classList.add('ok'); setTimeout(function () { b.textContent = 'Copy link'; b.classList.remove('ok'); }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, done); else done();
  };
  $('reset').onclick = function () { state.p = C.params(); state.model = 'booked'; state.scene = 'normal'; syncKnobs(); run(); };

  buildScenes(); buildKnobs(); readHash(); syncKnobs();
  if (state.scene === 'normal' && location.hash.length > 2) state.scene = null;
  run();
})();
