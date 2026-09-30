/* Bopcart V2 — progressive enhancement only. No network requests, no storage, no trackers. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  root.classList.remove('no-js'); root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Menu + (full-screen dialog) ---------- */
  var menu = $('#menu'), openBtn = $('#menu-open'), closeBtn = $('#menu-close');
  var outside = [$('header.bar'), $('#main'), $('footer.foot')];
  function focusables() { return $$('a[href],button:not([disabled])', menu); }
  function openMenu() {
    menu.hidden = false; menu.classList.add('is-open');
    openBtn.setAttribute('aria-expanded', 'true');
    doc.body.classList.add('menu-lock');
    outside.forEach(function (el) { if (el) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); } });
    closeBtn.focus();
  }
  function closeMenu(restore) {
    menu.classList.remove('is-open'); menu.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
    doc.body.classList.remove('menu-lock');
    outside.forEach(function (el) { if (el) { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); } });
    if (restore !== false) openBtn.focus();
  }
  if (menu && openBtn) {
    openBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', function () { closeMenu(); });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(false); });
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = $$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) reveals.forEach(function (el) { el.classList.add('in'); });
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Waitlist tabs ---------- */
  var tabs = $('#tabs'), tabBtns = [$('#tab-op'), $('#tab-run')];
  function sel(i, focus) {
    tabBtns.forEach(function (t, j) {
      var on = i === j;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      doc.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tabBtns[i].focus();
  }
  if (tabs) {
    tabs.hidden = false;
    tabBtns.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); sel((i + 1) % 2, true); }
      });
    });
    sel(0);
    $$('[data-join]').forEach(function (a) {
      a.addEventListener('click', function () { sel(a.getAttribute('data-join') === 'runner' ? 1 : 0); });
    });
  }

  /* ---------- Waitlist validation (plain POST still works without JS) ---------- */
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  $$('form.wl-form').forEach(function (form) {
    form.setAttribute('novalidate', '');
    var summary = $('.err-summary', form), btn = $('button[type=submit]', form);
    function check(input) {
      var v = input.value.trim(), msg = '';
      if (input.required && !v) msg = input.type === 'email' ? 'Enter your email address.' : 'Enter your city or ZIP code.';
      else if (input.type === 'email' && v && !emailRe.test(v)) msg = 'Enter an email address like name@example.com.';
      var err = doc.getElementById(input.id + '-err');
      if (msg) { input.setAttribute('aria-invalid', 'true'); if (err) { err.textContent = msg; err.hidden = false; } }
      else { input.removeAttribute('aria-invalid'); if (err) { err.textContent = ''; err.hidden = true; } }
      return !msg;
    }
    var fields = $$('input[required]', form);
    fields.forEach(function (inp) {
      inp.addEventListener('blur', function () { if (inp.value.trim() || inp.hasAttribute('aria-invalid')) check(inp); });
      inp.addEventListener('input', function () { if (inp.hasAttribute('aria-invalid')) check(inp); });
    });
    form.addEventListener('submit', function (e) {
      var bad = fields.filter(function (f) { return !check(f); });
      if (bad.length) {
        e.preventDefault();
        summary.textContent = bad.length === 1 ? 'One field needs attention before you can join.' : bad.length + ' fields need attention before you can join.';
        summary.hidden = false; bad[0].focus();
        return;
      }
      summary.hidden = true;
      btn.setAttribute('aria-disabled', 'true'); btn.textContent = 'Joining…';
    });
  });

  /* ---------- SHA-256 (WebCrypto when available, small JS fallback otherwise) ---------- */
  function sha256js(str) {
    var K = [], H = [], i, j, isP = function (n) { for (var f = 2; f * f <= n; f++) if (n % f === 0) return false; return true; };
    for (i = 2, j = 0; j < 64; i++) if (isP(i)) { if (j < 8) H[j] = (Math.pow(i, 1 / 2) * 4294967296) | 0; K[j++] = (Math.pow(i, 1 / 3) * 4294967296) | 0; }
    var bytes = unescape(encodeURIComponent(str)), l = bytes.length, w = [], words = [];
    for (i = 0; i < l; i++) words[i >> 2] |= bytes.charCodeAt(i) << ((3 - i) % 4) * 8;
    words[l >> 2] |= 0x80 << ((3 - l) % 4) * 8; words[((l + 8) >> 6 << 4) + 15] = l * 8;
    var r = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (j = 0; j < words.length; j += 16) {
      var a = H.slice(0);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        w[i] = i < 16 ? (words[j + i] | 0) : (w[i - 16] + (r(w15, 7) ^ r(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (r(w2, 17) ^ r(w2, 19) ^ (w2 >>> 10))) | 0;
        var t1 = a[7] + (r(a[4], 6) ^ r(a[4], 11) ^ r(a[4], 25)) + ((a[4] & a[5]) ^ (~a[4] & a[6])) + K[i] + w[i];
        var t2 = (r(a[0], 2) ^ r(a[0], 13) ^ r(a[0], 22)) + ((a[0] & a[1]) ^ (a[0] & a[2]) ^ (a[1] & a[2]));
        a = [(t1 + t2) | 0].concat(a); a[4] = (a[4] + t1) | 0; a.pop();
      }
      for (i = 0; i < 8; i++) H[i] = (H[i] + a[i]) | 0;
    }
    return H.map(function (h) { return ('00000000' + (h >>> 0).toString(16)).slice(-8); }).join('');
  }
  function sha256(str) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      }).catch(function () { return sha256js(str); });
    }
    return Promise.resolve(sha256js(str));
  }

  /* ---------- Signature interaction: example order console ---------- */
  var con = $('#console'); if (!con) return;
  var CAP = 150, MAX_RETRIES = 2;
  var MERCHANTS = {
    northside: { name: 'Northside Hardware', allowed: true },
    corner: { name: 'Corner Pharmacy', allowed: true },
    quickdeals: { name: 'QuickDeals Outlet', allowed: false }
  };
  var ITEMS = [
    { id: 'bat', name: 'Drill battery, 18V', price: 64.00 },
    { id: 'scr', name: 'Wood screws, 100-pack', price: 9.95 },
    { id: 'gls', name: 'Safety glasses', price: 12.40 },
    { id: 'saw', name: 'Circular saw', price: 129.00 }
  ];
  var PRESETS = {
    ok: { merchant: 'northside', fulfil: 'ship', qty: { bat: 1, scr: 2, gls: 0, saw: 0 } },
    cap: { merchant: 'northside', fulfil: 'ship', qty: { bat: 1, scr: 2, gls: 0, saw: 1 } },
    merchant: { merchant: 'quickdeals', fulfil: 'ship', qty: { bat: 1, scr: 2, gls: 0, saw: 0 } },
    pickup: { merchant: 'northside', fulfil: 'pickup', qty: { bat: 1, scr: 2, gls: 0, saw: 0 } }
  };
  var S = { merchant: 'northside', fulfil: 'ship', qty: {}, stage: 'intent', approval: null, retries: 0, hash: '' };
  var elM = $('#ex-merchant'), elF = $('#ex-fulfil'), elItems = $('#ex-items'), elTotal = $('#ex-total'), stage = $('#stage'), live = $('#ex-live');
  var money = function (n) { return '$' + n.toFixed(2); };

  elItems.innerHTML = ITEMS.map(function (it) {
    return '<li><span class="item-name" id="nm-' + it.id + '">' + esc(it.name) + '</span>' +
      '<span class="qty" role="group" aria-labelledby="nm-' + it.id + '">' +
      '<button type="button" data-q="' + it.id + '" data-d="-1" aria-label="Remove one ' + esc(it.name) + '">−</button>' +
      '<output id="q-' + it.id + '" aria-live="off">0</output>' +
      '<button type="button" data-q="' + it.id + '" data-d="1" aria-label="Add one ' + esc(it.name) + '">+</button></span>' +
      '<span class="item-price">' + money(it.price) + ' each</span></li>';
  }).join('');

  function total() { return ITEMS.reduce(function (s, it) { return s + it.price * (S.qty[it.id] || 0); }, 0); }
  function lines() { return ITEMS.filter(function (it) { return S.qty[it.id] > 0; }).map(function (it) { return [it.name, S.qty[it.id], (it.price * S.qty[it.id]).toFixed(2)]; }); }
  function snapshot() { return { merchant: MERCHANTS[S.merchant].name, fulfilment: S.fulfil, items: lines(), amount: total().toFixed(2) }; }
  function canonical(snap) { return JSON.stringify({ app: 'bopcart', example: true, merchant: snap.merchant, fulfilment: snap.fulfilment, items: snap.items, amount: snap.amount, currency: 'USD' }); }
  function summaryText(snap) { return snap.items.map(function (l) { return l[1] + ' × ' + l[0]; }).join(', ') || 'nothing yet'; }

  function syncControls() {
    elM.value = S.merchant; elF.value = S.fulfil;
    ITEMS.forEach(function (it) { $('#q-' + it.id).textContent = S.qty[it.id] || 0; });
    elTotal.textContent = money(total());
  }
  function applyPreset(key) {
    var p = PRESETS[key]; S.merchant = p.merchant; S.fulfil = p.fulfil; S.qty = JSON.parse(JSON.stringify(p.qty));
    S.stage = 'intent'; S.approval = null; S.retries = 0;
    $$('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-preset') === key ? 'true' : 'false'); });
    syncControls(); render();
  }
  function edited() {
    $$('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    syncControls();
    if (S.stage === 'approved' || S.stage === 'receipt' || S.stage === 'escalated' || S.stage === 'voided') {
      var now = canonical(snapshot());
      if (S.approval && now === S.approval.canon) { S.stage = 'approved'; announce('Order matches the approval again. Approval restored.'); }
      else { S.stage = 'voided'; announce('Approval voided. The order changed after it was approved.'); }
    } else if (S.stage !== 'intent') { S.stage = 'intent'; announce('Order changed. Start again from the intent.'); }
    render();
  }
  function announce(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }

  elM.addEventListener('change', function () { S.merchant = elM.value; edited(); });
  elF.addEventListener('change', function () { S.fulfil = elF.value; edited(); });
  elItems.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-q]'); if (!b) return;
    var id = b.getAttribute('data-q'), n = Math.max(0, Math.min(9, (S.qty[id] || 0) + Number(b.getAttribute('data-d'))));
    if (n === S.qty[id]) return; S.qty[id] = n; edited();
  });
  $$('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { applyPreset(b.getAttribute('data-preset')); focusStage(); }); });

  function policy() {
    var amt = total(), m = MERCHANTS[S.merchant];
    return [
      { k: 'Spending cap', ok: amt <= CAP && amt > 0, v: money(amt) + ' / ' + money(CAP), why: amt <= 0 ? 'The cart is empty.' : 'Order is ' + money(amt - CAP) + ' over the per-order cap.' },
      { k: 'Allowed merchant', ok: m.allowed, v: m.name, why: m.name + ' is not on the allow-list.' },
      { k: 'Retry limit', ok: S.retries <= MAX_RETRIES, v: S.retries + ' of ' + MAX_RETRIES + ' used', why: 'Too many failed attempts.' }
    ];
  }
  var ORDER = { intent: 0, policy: 1, blocked: 1, review: 2, approved: 3, voided: 3, escalated: 3, receipt: 4 };
  function steps() {
    var cur = ORDER[S.stage];
    $$('.steps li').forEach(function (li, i) {
      li.className = i < cur ? 'done' : i === cur ? 'current' : '';
      if (i === cur && (S.stage === 'blocked' || S.stage === 'voided')) li.className = 'bad';
      if (i === cur) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    con.setAttribute('data-state', S.stage);
  }
  function btn(label, act, kind) { return '<button type="button" class="btn ' + (kind || 'btn-primary') + '" data-act="' + act + '">' + label + '</button>'; }
  function badge(cls, t) { return '<p class="state-badge ' + cls + '">' + t + '</p>'; }
  function runnerTask(snap, reason) {
    return '<div class="runner"><h4>Human fallback · masked runner task (example)</h4><dl>' +
      '<dt>Why</dt><dd>' + esc(reason) + '</dd>' +
      '<dt>Task</dt><dd>' + (snap.fulfilment === 'pickup' ? 'Collect the order at the counter and hand it off' : 'Complete the step the agent could not') + '</dd>' +
      '<dt>Where</dt><dd>' + esc(snap.merchant) + ' — general area only</dd>' +
      '<dt>Items</dt><dd>' + esc(summaryText(snap)) + '</dd>' +
      '<dt>Pickup</dt><dd class="mono">{{PICKUP_TOKEN}}</dd>' +
      '<dt>Buyer</dt><dd class="mono">{{BUYER}} · masked</dd>' +
      '<dt>Payment</dt><dd class="mono">{{CARD}} · never shown</dd></dl></div>';
  }
  function short(h) { return h ? h.slice(0, 12) + '…' + h.slice(-6) : '…'; }

  function render() {
    steps();
    var snap = snapshot(), html = '';
    if (S.stage === 'intent') {
      html = badge('', 'Step 1 · Intent') +
        '<h3 tabindex="-1">What the agent wants to do</h3>' +
        '<p class="intent-q">“Buy ' + esc(summaryText(snap)) + ' from ' + esc(snap.merchant) + (snap.fulfilment === 'pickup' ? ' for in-store pickup' : '') + '. Stay inside policy.”</p>' +
        '<p class="sub">Nothing is checked out yet. First, the order is tested against the operator’s rules.</p>' +
        '<div class="actions">' + btn('Run policy check', 'policy') + '</div>';
    } else if (S.stage === 'policy' || S.stage === 'blocked') {
      var p = policy(), pass = p.every(function (r) { return r.ok; });
      html = (pass ? badge('ok', 'Policy check passed') : badge('bad', 'Blocked before checkout')) +
        '<h3 tabindex="-1">' + (pass ? 'Inside the rules. Ready for review.' : 'This order doesn’t fit the policy.') + '</h3>' +
        '<ul class="rows">' + p.map(function (r) {
          return '<li><span class="ck ' + (r.ok ? 'ok' : 'no') + '" aria-hidden="true"></span><span class="rk">' + r.k + ' <span class="sr-only">' + (r.ok ? 'passed' : 'failed') + '</span></span><span class="rv">' + esc(r.v) + '</span>' + (r.ok ? '' : '<span class="why">' + esc(r.why) + '</span>') + '</li>';
        }).join('') + '</ul>' +
        (pass ? '<div class="actions">' + btn('Review the order', 'review') + btn('Back', 'intent', 'btn-ghost') + '</div>'
          : '<p class="sub">Nothing was authorized. The agent can’t continue until the order fits, or the operator changes the policy.</p><div class="actions">' + btn('Edit the cart', 'edit', 'btn-ghost') + btn('Load a within-policy order', 'preset-ok', 'btn-ghost') + '</div>');
    } else if (S.stage === 'review') {
      html = badge('warn', 'Step 3 · Review') +
        '<h3 tabindex="-1">Review exactly what will be approved</h3>' +
        '<div class="review">' +
        '<div><p class="rv-k">Merchant</p><p class="rv-v">' + esc(snap.merchant) + '</p></div>' +
        '<div><p class="rv-k">Amount</p><p class="rv-v rv-amt">$' + snap.amount + '</p></div>' +
        '<div class="wide"><p class="rv-k">Items</p><ul class="rv-list">' + snap.items.map(function (l) { return '<li>' + l[1] + ' × ' + esc(l[0]) + ' — $' + l[2] + '</li>'; }).join('') + '</ul></div>' +
        '<div class="wide"><p class="rv-k">Conditions</p><ul class="rv-list"><li>Within the ' + money(CAP) + ' cap</li><li>Merchant on the allow-list</li><li>Up to ' + MAX_RETRIES + ' automatic retries</li>' + (snap.fulfilment === 'pickup' ? '<li>In-store pickup — a masked runner will be needed</li>' : '<li>Shipped to the operator’s address (token, not shown)</li>') + '</ul></div>' +
        '</div>' +
        '<div class="bind"><span class="lock" aria-hidden="true"></span><div>Approving binds to this merchant, these items and this amount. <span class="fp">Fingerprint (SHA-256 of the order, computed in your browser): ' + short(S.hash) + '</span></div></div>' +
        '<div class="actions">' + btn('Approve this exact order', 'approve') + btn('Back', 'policy', 'btn-ghost') + '</div>';
    } else if (S.stage === 'approved') {
      var a = S.approval;
      html = badge('ok', 'Approved · example only') +
        '<h3 tabindex="-1">Approved for $' + a.snap.amount + ' at ' + esc(a.snap.merchant) + '</h3>' +
        '<p>This approval covers this exact order and nothing else. No payment was made — this is a simulation.</p>' +
        '<div class="bind"><span class="lock" aria-hidden="true"></span><div>Bound to fingerprint <span class="fp">' + short(a.hash) + '</span><br><strong>Now try it:</strong> change the merchant or a quantity in the cart.</div></div>' +
        (a.snap.fulfilment === 'pickup' ? runnerTask(a.snap, 'In-store pickup needs a person.') : '') +
        '<div class="actions">' + btn('View example receipt', 'receipt') + btn('Simulate a failed checkout attempt', 'fail', 'btn-ghost') + '</div>' +
        '<p class="fine">Automatic retries used: ' + S.retries + ' of ' + MAX_RETRIES + '.</p>';
    } else if (S.stage === 'escalated') {
      html = badge('info', 'Retry limit reached') +
        '<h3 tabindex="-1">The agent stops. A person takes over.</h3>' +
        '<p>After ' + MAX_RETRIES + ' automatic retries the agent doesn’t keep trying. The step goes to the human fallback, still bound to the same approved order.</p>' +
        runnerTask(S.approval.snap, 'Checkout failed more than ' + MAX_RETRIES + ' times.') +
        '<div class="actions">' + btn('Start over', 'preset-ok', 'btn-ghost') + '</div>';
    } else if (S.stage === 'voided') {
      var ap = S.approval, changed = [];
      if (ap.snap.merchant !== snap.merchant) changed.push('merchant');
      if (ap.snap.amount !== snap.amount) changed.push('amount');
      if (JSON.stringify(ap.snap.items) !== JSON.stringify(snap.items)) changed.push('items');
      if (ap.snap.fulfilment !== snap.fulfilment) changed.push('fulfilment');
      html = badge('bad', 'Approval voided') +
        '<h3 tabindex="-1">This approval no longer covers the order.</h3>' +
        '<p>Changed: <strong>' + changed.join(', ') + '</strong>. An approval is tied to exact values, so any change needs a fresh policy check and review.</p>' +
        '<div class="diff"><div class="was"><p class="rv-k">Approved for</p><p class="rv-v">$' + ap.snap.amount + ' · ' + esc(ap.snap.merchant) + '</p><p class="fp">' + short(ap.hash) + '</p></div>' +
        '<div class="now"><p class="rv-k">Order now</p><p class="rv-v">$' + snap.amount + ' · ' + esc(snap.merchant) + '</p><p class="fp">' + short(S.hash) + '</p></div></div>' +
        '<div class="actions">' + btn('Re-run policy check', 'policy') + btn('Undo my change', 'undo', 'btn-ghost') + '</div>';
    } else if (S.stage === 'receipt') {
      var r = S.approval;
      html = badge('warn', 'Example receipt · unsigned · simulated') +
        '<h3 tabindex="-1">What an inspectable receipt records</h3>' +
        '<p class="sub">The nine receipt fields, filled with example data. Only <span class="mono">payload_hash</span> is computed for real (in your browser). There is no signature, so this is not a verified receipt.</p>' +
        '<div class="receipt"><dl>' +
        '<dt>kid</dt><dd>example-key-id · no key used</dd>' +
        '<dt>alg</dt><dd class="null">none · post-quantum signing in development</dd>' +
        '<dt>payload_hash</dt><dd id="rc-hash">' + r.hash + '</dd>' +
        '<dt>chain_root</dt><dd class="null">null · not anchored</dd>' +
        '<dt>smt_root</dt><dd class="null">null · not anchored</dd>' +
        '<dt>sig</dt><dd class="null">null · unsigned</dd>' +
        '<dt>tsa</dt><dd class="null">null · no timestamp authority</dd>' +
        '<dt>tsa_time</dt><dd class="null">null</dd>' +
        '<dt>app</dt><dd>bopcart</dd>' +
        '</dl></div>' +
        '<details class="fine"><summary>Show the example payload that was hashed</summary><pre class="mono fp" id="rc-payload">' + esc(r.canon) + '</pre></details>' +
        '<div class="actions">' + btn('Recompute the hash', 'verify', 'btn-ghost') + btn('Back to approval', 'back-approved', 'btn-ghost') + '</div>' +
        '<p class="fine" id="rc-verify" aria-live="polite"></p>';
    }
    stage.innerHTML = '<div class="panel">' + html + '</div>';
    var cs = $('#cart-status'), st = S.stage;
    if (st === 'approved' || st === 'receipt' || st === 'escalated') { cs.hidden = false; cs.className = 'cart-status ok'; cs.textContent = 'Approval bound to $' + S.approval.snap.amount + ' at ' + S.approval.snap.merchant; }
    else if (st === 'voided') { cs.hidden = false; cs.className = 'cart-status bad'; cs.textContent = 'Approval voided — the order changed'; }
    else if (st === 'blocked') { cs.hidden = false; cs.className = 'cart-status bad'; cs.textContent = 'Blocked by policy — nothing authorized'; }
    else cs.hidden = true;
  }
  function focusStage() { var h = $('h3', stage); if (h) h.focus({ preventScroll: false }); }
  function refreshHash() { return sha256(canonical(snapshot())).then(function (h) { S.hash = h; }); }

  stage.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    var go = function (st) { S.stage = st; render(); focusStage(); };
    if (act === 'intent') go('intent');
    else if (act === 'policy') { if (S.stage === 'voided') { S.approval = null; S.retries = 0; } go(policy().every(function (r) { return r.ok; }) ? 'policy' : 'blocked'); }
    else if (act === 'review') refreshHash().then(function () { go('review'); });
    else if (act === 'approve') refreshHash().then(function () { var snap = snapshot(); S.approval = { snap: snap, canon: canonical(snap), hash: S.hash }; go('approved'); });
    else if (act === 'receipt') go('receipt');
    else if (act === 'back-approved') go('approved');
    else if (act === 'fail') { S.retries++; if (S.retries > MAX_RETRIES) go('escalated'); else { render(); announce('Checkout attempt failed. Retries used: ' + S.retries + ' of ' + MAX_RETRIES + '.'); var f = $('[data-act=fail]', stage); if (f) f.focus(); } }
    else if (act === 'undo') { var a = S.approval.snap; S.merchant = Object.keys(MERCHANTS).filter(function (k) { return MERCHANTS[k].name === a.merchant; })[0]; S.fulfil = a.fulfilment; ITEMS.forEach(function (it) { var l = a.items.filter(function (x) { return x[0] === it.name; })[0]; S.qty[it.id] = l ? l[1] : 0; }); syncControls(); refreshHash().then(function () { go('approved'); }); }
    else if (act === 'edit') elM.focus();
    else if (act === 'preset-ok') { applyPreset('ok'); focusStage(); }
    else if (act === 'verify') sha256($('#rc-payload').textContent).then(function (h) {
      $('#rc-verify').textContent = (h === S.approval.hash ? 'Match: ' : 'Mismatch: ') + h.slice(0, 16) + '… This only shows the payload is unchanged since hashing. Without a signature it says nothing about who created it.';
    });
  });

  // keep the voided view's "order now" fingerprint current
  var baseEdited = edited;
  edited = function () { refreshHash().then(baseEdited); };
  applyPreset('ok');
})();
