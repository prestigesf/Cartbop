/* Cartbop — Hero v3 scene. Browser simulation only: no network, no storage, no payment.
   Uses the shared approval machine (approval.js), so the hero follows the same rule as the console:
   any edit after approval voids it; undo restores values only and needs a fresh check + approval. */
(function () {
  'use strict';
  var doc = document, AP = window.CartbopApproval, scene = doc.getElementById('hx-scene');
  if (!scene || !AP) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }

  var MERCHANTS = { northside: { name: 'Northside Hardware', allowed: true }, harbor: { name: 'Harbor Tool Supply', allowed: true } };
  var ITEMS = [{ id: 'bat', name: 'Drill battery, 18V', price: 64.00 }];
  var INITIAL = { merchant: 'northside', fulfil: 'ship', qty: { bat: 1 } };
  var FUL = { ship: 'Ship to operator address', pickup: 'In-store pickup' };
  var M = AP.createMachine({ cap: 150, maxRetries: 2, merchants: MERCHANTS, items: ITEMS, initial: INITIAL });
  var S = M.state, hashes = {}, controls = $('#hx-controls'), statusEl = $('#hx-status'), live = $('#hx-live');
  var FIELDS = ['merchant', 'item', 'qty', 'fulfil', 'total'];
  var LABEL = { merchant: 'merchant', item: 'item', qty: 'quantity', fulfil: 'fulfilment', total: 'total' };

  function short(h) { return h ? h.slice(0, 8) + '…' + h.slice(-4) : '…'; }
  function hashInto(canon, el) {
    if (!el) return;
    if (hashes[canon]) { el.textContent = short(hashes[canon]); return; }
    el.textContent = '…'; el.setAttribute('data-c', canon);
    AP.sha256(canon).then(function (h) { hashes[canon] = h; if (el.getAttribute('data-c') === canon) el.textContent = short(h); });
  }
  function vals(snap) {
    return { merchant: snap.merchant, item: 'Drill battery, 18V', qty: String(snap.qty.bat || 0), fulfil: FUL[snap.fulfilment], total: '$' + snap.amount };
  }
  function visualState() {
    var st = S.stage;
    return (st === 'receipt' || st === 'escalated') ? 'approved' : st;
  }

  var STORY = { intent: 0, recheck: 1, policy: 1, blocked: 1, review: 1, approved: 2, voided: 4 };
  function render() {
    var snap = M.snapshot(), now = vals(snap), vs = visualState();
    var bound = S.stage === 'voided' ? S.voided : S.approval;
    var base = (S.stage === 'voided' && bound) ? vals(bound.snap) : now;
    var changed = [];
    FIELDS.forEach(function (f) {
      var row = $('.hx-row[data-f="' + f + '"]', scene), was = $('.v-was', row), nw = $('.v-now', row);
      was.textContent = base[f];
      var isCh = S.stage === 'voided' && base[f] !== now[f];
      row.classList.toggle('is-changed', isCh);
      nw.textContent = isCh ? now[f] : '';
      if (isCh) changed.push(f);
    });
    scene.setAttribute('data-state', vs);
    scene.setAttribute('data-changed', changed.join(' '));
    if (bound) { $('#hx-seal-amt').textContent = '$' + bound.snap.amount; hashInto(bound.canon, $('#hx-fp-ok')); }
    hashInto(M.canonical(snap), $('#hx-fp-now'));
    var p = M.policy(), bad = p.filter(function (r) { return !r.ok; })[0];
    $('.hx-chk', scene).innerHTML = bad ? '<span class="ck no" aria-hidden="true"></span>Blocked: ' + bad.why
      : '<span class="ck ok" aria-hidden="true"></span>Policy: under cap · merchant allowed';

    var t = { tone: '', html: '' };
    if (S.stage === 'intent') t.html = '<strong>Request.</strong> The agent proposes an order. Nothing is authorized yet.';
    else if (S.stage === 'policy') { t.tone = 'ok'; t.html = '<strong>Policy check passed.</strong> Under the $150 cap, merchant on the allow-list.'; }
    else if (S.stage === 'blocked') { t.tone = 'bad'; t.html = '<strong>Blocked before checkout.</strong> ' + (bad ? bad.why : '') + ' Nothing was authorized.'; }
    else if (S.stage === 'review') { t.tone = 'warn'; t.html = '<strong>Review.</strong> Approving binds to exactly these five values.'; }
    else if (vs === 'approved') { t.tone = 'ok'; t.html = '<strong>Approved for $' + S.approval.snap.amount + '.</strong> Bound to this merchant, item, qty, fulfilment and total. No payment was made.'; }
    else if (S.stage === 'voided') {
      t.tone = 'bad';
      var names = changed.filter(function (f) { return f !== 'total'; }); if (!names.length && changed.length) names = ['total'];
      t.html = '<strong>Approval void.</strong> ' + (names.length ? 'The ' + names.map(function (f) { return LABEL[f]; }).join(' and ') + ' changed after approval, so it no longer covers this order.' : 'It was voided by a change and stays void, even when the values match again.');
    }
    else if (S.stage === 'recheck') { t.tone = 'warn'; t.html = '<strong>Values restored — approval still void.</strong> Needs a fresh policy check, review and approval.'; }
    statusEl.innerHTML = t.html; statusEl.setAttribute('data-tone', t.tone);

    var cur = STORY[S.stage] != null ? STORY[S.stage] : 2;
    $$('#hx-story li').forEach(function (li, i) {
      li.classList.toggle('is-on', i === cur || (cur === 4 && i === 3));
      li.classList.toggle('is-done', i < cur && !(cur === 4 && i === 3));
      if (i === cur) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    var chg = $('#hx-story li[data-s=change] span');
    if (chg) chg.textContent = S.stage === 'voided' && changed.length ? changed.map(function (f) { return LABEL[f] + ' ' + base[f] + ' → ' + now[f]; }).join(', ') + '.' : 'Any approved value changes.';
    renderControls();
  }

  var playing = false, paused = false, timer = null, queue = [];
  function b(label, act, cls) { return '<button type="button" class="' + (cls || 'btn btn-primary') + '" data-hx="' + act + '">' + label + '</button>'; }
  function renderControls() {
    var h = '', st = S.stage;
    if (st === 'intent' || st === 'recheck') h = b('Run policy check', 'policy');
    else if (st === 'policy') h = b('Review the exact order', 'review');
    else if (st === 'review') h = b('Approve these exact values', 'approve');
    else if (st === 'blocked') h = b('Reset the example', 'reset', 'btn btn-ghost');
    else if (visualState() === 'approved') h = '<span class="hx-hint">Now change it:</span>' + b('Qty +1', 'qty', 'btn-chip') + b('Switch merchant', 'merchant', 'btn-chip') + b(S.fulfil === 'ship' ? 'Pickup instead' : 'Ship instead', 'fulfil', 'btn-chip');
    else if (st === 'voided') h = b('Undo my change', 'undo', 'btn btn-ghost') + b('Re-run policy check', 'policy');
    var util = '<span class="hx-util">' + (playing ? b(paused ? 'Resume' : 'Pause', 'pause', 'btn-util') : '') + b(reduce ? 'Start over' : 'Replay', 'replay', 'btn-util') + '</span>';
    controls.innerHTML = h + util;
  }

  function announce(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }
  M.subscribe(function (ev) {
    render();
    if (!playing || ev.user) {
      if (ev.type === 'voided') announce('Approval void. The order changed after approval.');
      else if (ev.type === 'undo') announce('Values restored. The approval stays void. Run a fresh policy check.');
      else if (ev.type === 'approved') announce('Approved for these exact values. Example only, no payment.');
      else if (ev.type === 'policy') announce('Policy check passed.');
      else if (ev.type === 'blocked') announce('Blocked by policy. Nothing authorized.');
      else if (ev.type === 'review') announce('Review the exact order before approving.');
    }
  });

  function stopPlay() { playing = false; paused = false; clearTimeout(timer); queue = []; }
  function next() {
    if (!playing || paused) return;
    var s = queue.shift();
    if (!s) { playing = false; renderControls(); return; }
    timer = setTimeout(function () { s.fn(); next(); }, s.wait);
  }
  function play() {
    stopPlay(); M.load(INITIAL);
    if (reduce) return;
    playing = true;
    queue = [
      { wait: 1500, fn: function () { M.act.policy(); } },
      { wait: 1300, fn: function () { M.act.review(); } },
      { wait: 1400, fn: function () { M.act.approve(); } },
      { wait: 2200, fn: function () { M.bumpQty('bat', 1); } },
      { wait: 10, fn: function () {} }
    ];
    renderControls(); next();
  }

  controls.addEventListener('click', function (e) {
    var t = e.target.closest('[data-hx]'); if (!t) return;
    var a = t.getAttribute('data-hx');
    if (a === 'pause') { paused = !paused; if (!paused) next(); else clearTimeout(timer); renderControls(); focusCtl('[data-hx=pause]'); return; }
    if (a === 'replay') { if (reduce) { stopPlay(); M.load(INITIAL); } else play(); focusCtl('[data-hx]'); return; }
    stopPlay();
    if (a === 'policy') M.act.policy();
    else if (a === 'review') M.act.review();
    else if (a === 'approve') M.act.approve();
    else if (a === 'undo') M.act.undo();
    else if (a === 'reset') M.load(INITIAL);
    else if (a === 'qty') M.bumpQty('bat', 1);
    else if (a === 'merchant') M.setMerchant(S.merchant === 'northside' ? 'harbor' : 'northside');
    else if (a === 'fulfil') M.setFulfil(S.fulfil === 'ship' ? 'pickup' : 'ship');
    renderControls(); focusCtl('[data-hx]');
  });
  function focusCtl(sel) { var el = $(sel, controls); if (el) el.focus({ preventScroll: true }); }

  /* subtle pointer parallax (fine pointers, motion allowed) */
  var view = $('.hx-view');
  if (!reduce && view && window.matchMedia('(pointer:fine)').matches) {
    view.addEventListener('pointermove', function (e) {
      var r = view.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      scene.style.setProperty('--ry', (-16 + x * 8).toFixed(2) + 'deg'); scene.style.setProperty('--rx', (9 - y * 6).toFixed(2) + 'deg');
    });
    view.addEventListener('pointerleave', function () { scene.style.removeProperty('--ry'); scene.style.removeProperty('--rx'); });
  }

  controls.hidden = false;
  if (reduce) {
    /* static composed state, reached through the real rule: approve, then change -> VOID */
    M.act.policy(); M.act.review(); M.act.approve(); M.bumpQty('bat', 1);
  } else {
    render();
    setTimeout(play, 350);
  }
})();
