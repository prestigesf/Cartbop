/* Cartbop — progressive enhancement only. No network requests, no storage, no trackers. */
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

  /* ---------- Signature interaction: example order console ----------
     Uses the shared approval machine in approval.js (browser simulation only). */
  var con = $('#console'); if (!con || !window.CartbopApproval) return;
  var AP = window.CartbopApproval, sha256 = AP.sha256;
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
  var M = AP.createMachine({ cap: CAP, maxRetries: MAX_RETRIES, merchants: MERCHANTS, items: ITEMS, initial: PRESETS.ok });
  var S = M.state, hashes = {};
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

  function summaryText(snap) { return snap.items.map(function (l) { return l[1] + ' × ' + l[0]; }).join(', ') || 'nothing yet'; }
  /* fingerprints: computed asynchronously for display only; approval binding itself is synchronous on the canonical values */
  function hashOf(canon) {
    if (hashes[canon]) return hashes[canon];
    sha256(canon).then(function (h) { hashes[canon] = h; $$('[data-fp]', stage).forEach(function (el) { if (el.getAttribute('data-fp') === canon) el.textContent = short(h); }); });
    return '';
  }
  function fp(canon) { var h = hashOf(canon); return '<span class="fp" data-fp="' + esc(canon) + '">' + short(h) + '</span>'; }

  function syncControls() {
    elM.value = S.merchant; elF.value = S.fulfil;
    ITEMS.forEach(function (it) { $('#q-' + it.id).textContent = S.qty[it.id] || 0; });
    elTotal.textContent = money(M.total());
  }
  function applyPreset(key) {
    M.load(PRESETS[key]);
    $$('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-preset') === key ? 'true' : 'false'); });
  }
  function announce(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }

  M.subscribe(function (ev) {
    if (ev.type === 'voided') announce('Approval voided. The order changed after it was approved. Undo restores the values only; it needs a fresh check and approval.');
    else if (ev.type === 'edit' && ev.from !== 'intent' && ev.from !== 'voided' && ev.from !== 'recheck') announce('Order changed. Start again from the intent.');
    else if (ev.type === 'undo') announce('Values restored. The earlier approval stays void. Run a fresh policy check.');
    if (ev.type === 'voided' || ev.type === 'edit') $$('[data-preset]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    syncControls(); render();
  });

  elM.addEventListener('change', function () { M.setMerchant(elM.value); });
  elF.addEventListener('change', function () { M.setFulfil(elF.value); });
  elItems.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-q]'); if (!b) return;
    M.bumpQty(b.getAttribute('data-q'), Number(b.getAttribute('data-d')));
  });
  $$('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { applyPreset(b.getAttribute('data-preset')); focusStage(); }); });

  var ORDER = { intent: 0, recheck: 0, policy: 1, blocked: 1, review: 2, approved: 3, voided: 3, escalated: 3, receipt: 4 };
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
  function changedFields(a, b) {
    var c = [];
    if (a.merchant !== b.merchant) c.push('merchant');
    if (a.amount !== b.amount) c.push('amount');
    if (JSON.stringify(a.items) !== JSON.stringify(b.items)) c.push('items');
    if (a.fulfilment !== b.fulfilment) c.push('fulfilment');
    return c;
  }

  function render() {
    steps();
    var snap = M.snapshot(), canon = M.canonical(snap), html = '';
    if (S.stage === 'intent' || S.stage === 'recheck') {
      html = (S.stage === 'recheck' ? badge('warn', 'Needs a fresh policy check') : badge('', 'Step 1 · Intent')) +
        '<h3 tabindex="-1">' + (S.stage === 'recheck' ? 'Values restored. The old approval stays void.' : 'What the agent wants to do') + '</h3>' +
        '<p class="intent-q">“Buy ' + esc(summaryText(snap)) + ' from ' + esc(snap.merchant) + (snap.fulfilment === 'pickup' ? ' for in-store pickup' : '') + '. Stay inside policy.”</p>' +
        (S.stage === 'recheck'
          ? '<p class="sub">Undo put the cart back, but an approval that was voided never comes back. This order needs a new policy check, a new review and a new explicit approval.</p>'
          : '<p class="sub">Nothing is checked out yet. First, the order is tested against the operator’s rules.</p>') +
        '<div class="actions">' + btn('Run policy check', 'policy') + '</div>';
    } else if (S.stage === 'policy' || S.stage === 'blocked') {
      var p = M.policy(), pass = S.stage === 'policy';
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
        '<div class="bind"><span class="lock" aria-hidden="true"></span><div>Approving binds to this merchant, these items and this amount. Fingerprint (SHA-256 of the order, computed in your browser): ' + fp(canon) + '</div></div>' +
        '<div class="actions">' + btn('Approve this exact order', 'approve') + btn('Back', 'policy', 'btn-ghost') + '</div>';
    } else if (S.stage === 'approved') {
      var a = S.approval;
      html = badge('ok', 'Approved · example only') +
        '<h3 tabindex="-1">Approved for $' + a.snap.amount + ' at ' + esc(a.snap.merchant) + '</h3>' +
        '<p>This approval covers this exact order and nothing else. No payment was made — this is a simulation.</p>' +
        '<div class="bind"><span class="lock" aria-hidden="true"></span><div>Bound to fingerprint ' + fp(a.canon) + '<br><strong>Now try it:</strong> change the merchant or a quantity in the cart.</div></div>' +
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
      var ap = S.voided, changed = changedFields(ap.snap, snap);
      html = badge('bad', 'Approval voided') +
        '<h3 tabindex="-1">This approval no longer covers the order.</h3>' +
        '<p>Changed: <strong>' + (changed.join(', ') || 'nothing now — but the approval was already voided') + '</strong>. An approval is tied to exact values. Once voided it stays void, even if you change things back: the order needs a fresh policy check, review and approval.</p>' +
        '<div class="diff"><div class="was"><p class="rv-k">Approved for</p><p class="rv-v">$' + ap.snap.amount + ' · ' + esc(ap.snap.merchant) + '</p>' + fp(ap.canon) + '</div>' +
        '<div class="now"><p class="rv-k">Order now</p><p class="rv-v">$' + snap.amount + ' · ' + esc(snap.merchant) + '</p>' + fp(canon) + '</div></div>' +
        '<div class="actions">' + btn('Re-run policy check', 'policy') + btn('Undo my change', 'undo', 'btn-ghost') + '</div>' +
        '<p class="fine">Undo restores the cart values only. It does not restore the approval.</p>';
    } else if (S.stage === 'receipt') {
      var r = S.approval, rh = hashOf(r.canon);
      html = badge('warn', 'Example receipt · unsigned · simulated') +
        '<h3 tabindex="-1">What an inspectable receipt records</h3>' +
        '<p class="sub">The nine receipt fields, filled with example data. Only <span class="mono">payload_hash</span> is computed for real (in your browser). There is no signature, so this is not a verified receipt.</p>' +
        '<div class="receipt"><dl>' +
        '<dt>kid</dt><dd>example-key-id · no key used</dd>' +
        '<dt>alg</dt><dd class="null">none · post-quantum signing in development</dd>' +
        '<dt>payload_hash</dt><dd id="rc-hash">' + (rh || '…') + '</dd>' +
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
      if (!rh) sha256(r.canon).then(function (h) { hashes[r.canon] = h; var el = $('#rc-hash'); if (el) el.textContent = h; });
    }
    stage.innerHTML = '<div class="panel">' + html + '</div>';
    var cs = $('#cart-status'), st = S.stage;
    if (st === 'approved' || st === 'receipt' || st === 'escalated') { cs.hidden = false; cs.className = 'cart-status ok'; cs.textContent = 'Approval bound to $' + S.approval.snap.amount + ' at ' + S.approval.snap.merchant; }
    else if (st === 'voided') { cs.hidden = false; cs.className = 'cart-status bad'; cs.textContent = 'Approval voided — the order changed'; }
    else if (st === 'recheck') { cs.hidden = false; cs.className = 'cart-status bad'; cs.textContent = 'Earlier approval void — needs a fresh check and approval'; }
    else if (st === 'blocked') { cs.hidden = false; cs.className = 'cart-status bad'; cs.textContent = 'Blocked by policy — nothing authorized'; }
    else cs.hidden = true;
  }
  function focusStage() { var h = $('h3', stage); if (h) h.focus({ preventScroll: false }); }

  stage.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act'), moved = false;
    if (a === 'intent') moved = M.act.intent();
    else if (a === 'policy') moved = M.act.policy();
    else if (a === 'review') moved = M.act.review();
    else if (a === 'approve') moved = M.act.approve();
    else if (a === 'receipt') moved = M.act.receipt();
    else if (a === 'back-approved') moved = M.act.back();
    else if (a === 'undo') moved = M.act.undo();
    else if (a === 'fail') {
      var before = S.stage; M.act.fail();
      if (S.stage === before) { announce('Checkout attempt failed. Retries used: ' + S.retries + ' of ' + MAX_RETRIES + '.'); var f = $('[data-act=fail]', stage); if (f) f.focus(); }
      else focusStage();
      return;
    }
    else if (a === 'edit') { elM.focus(); return; }
    else if (a === 'preset-ok') { applyPreset('ok'); moved = true; }
    else if (a === 'verify') {
      sha256($('#rc-payload').textContent).then(function (h) {
        var want = hashes[S.approval.canon];
        $('#rc-verify').textContent = (h === want ? 'Match: ' : 'Mismatch: ') + h.slice(0, 16) + '… This only shows the payload is unchanged since hashing. Without a signature it says nothing about who created it.';
      });
      return;
    }
    if (moved) focusStage();
  });

  syncControls(); render();
})();
