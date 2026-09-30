/* Cartbop — shared approval state machine for the in-browser examples (hero + console).
   BROWSER SIMULATION ONLY. No network requests, no storage, no payment. This models the
   intended rule for the example; it is not a backend security control.

   Rule: an approval is bound to the exact order values it was given for. Any real edit after
   approval voids it permanently. Undo restores the cart values only; the order then needs a
   fresh policy check, a fresh review and a fresh explicit approval. VOID can only exist after
   an approval existed. */
(function (g) {
  'use strict';
  var APPROVED_LIKE = { approved: 1, receipt: 1, escalated: 1 };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function createMachine(cfg) {
    var S = { merchant: '', fulfil: '', qty: {}, stage: 'intent', approval: null, voided: null, reviewed: null, retries: 0, seq: 0 };
    var subs = [];
    function emit(ev) { subs.forEach(function (fn) { fn(ev, S); }); }

    function total() { return cfg.items.reduce(function (s, it) { return s + it.price * (S.qty[it.id] || 0); }, 0); }
    function lines() {
      return cfg.items.filter(function (it) { return S.qty[it.id] > 0; })
        .map(function (it) { return [it.name, S.qty[it.id], (it.price * S.qty[it.id]).toFixed(2)]; });
    }
    function snapshot() {
      return { merchant: cfg.merchants[S.merchant].name, merchantKey: S.merchant, fulfilment: S.fulfil, qty: clone(S.qty), items: lines(), amount: total().toFixed(2) };
    }
    function canonical(snap) {
      snap = snap || snapshot();
      return JSON.stringify({ app: 'bopcart', example: true, merchant: snap.merchant, fulfilment: snap.fulfilment, items: snap.items, amount: snap.amount, currency: 'USD' });
    }
    function policy() {
      var amt = total(), m = cfg.merchants[S.merchant], money = function (n) { return '$' + n.toFixed(2); };
      return [
        { k: 'Spending cap', ok: amt <= cfg.cap && amt > 0, v: money(amt) + ' / ' + money(cfg.cap), why: amt <= 0 ? 'The cart is empty.' : 'Order is ' + money(amt - cfg.cap) + ' over the per-order cap.' },
        { k: 'Allowed merchant', ok: !!m.allowed, v: m.name, why: m.name + ' is not on the allow-list.' },
        { k: 'Retry limit', ok: S.retries <= cfg.maxRetries, v: S.retries + ' of ' + cfg.maxRetries + ' used', why: 'Too many failed attempts.' }
      ];
    }
    function passes() { return policy().every(function (r) { return r.ok; }); }

    function load(v) {
      S.merchant = v.merchant; S.fulfil = v.fulfil; S.qty = clone(v.qty);
      S.stage = 'intent'; S.approval = null; S.voided = null; S.reviewed = null; S.retries = 0;
      emit({ type: 'load' });
    }

    /* Any change to merchant / fulfilment / quantities goes through edit(). */
    function edit(mutate) {
      var before = canonical();
      mutate(S);
      var after = canonical();
      if (after === before) return false;
      var from = S.stage;
      S.reviewed = null;
      if (APPROVED_LIKE[from] && S.approval) {
        S.voided = S.approval; S.voided.isVoid = true; S.approval = null; S.stage = 'voided';
        emit({ type: 'voided', from: from });
      } else if (from === 'voided' || from === 'recheck') {
        emit({ type: 'edit', from: from }); // stays voided / still needs a fresh check; never re-approves
      } else {
        S.stage = 'intent';                  // policy / blocked / review / intent: start again, no VOID
        emit({ type: 'edit', from: from });
      }
      return true;
    }
    function setMerchant(k) { return edit(function (s) { s.merchant = k; }); }
    function setFulfil(f) { return edit(function (s) { s.fulfil = f; }); }
    function setQty(id, n) { n = Math.max(0, Math.min(9, n)); return edit(function (s) { s.qty[id] = n; }); }
    function bumpQty(id, d) { return setQty(id, (S.qty[id] || 0) + d); }

    function to(st, ev) { S.stage = st; emit(ev || { type: st }); return true; }

    var act = {
      intent: function () { if (S.stage !== 'policy' && S.stage !== 'blocked') return false; S.reviewed = null; return to('intent'); },
      policy: function () {
        if (!{ intent: 1, recheck: 1, voided: 1, review: 1, policy: 1, blocked: 1 }[S.stage]) return false;
        if (S.stage === 'voided') S.retries = 0;
        S.reviewed = null;
        return to(passes() ? 'policy' : 'blocked');
      },
      review: function () {
        if (S.stage !== 'policy' || !passes()) return false;
        S.reviewed = canonical();
        return to('review');
      },
      approve: function () {
        if (S.stage !== 'review' || S.reviewed !== canonical()) return false;
        var snap = snapshot();
        S.approval = { id: ++S.seq, snap: snap, canon: canonical(snap), hash: '' };
        S.voided = null; S.reviewed = null;
        return to('approved');
      },
      receipt: function () { return S.stage === 'approved' ? to('receipt') : false; },
      back: function () { return S.stage === 'receipt' ? to('approved') : false; },
      fail: function () {
        if (S.stage !== 'approved') return false;
        S.retries++;
        if (S.retries > cfg.maxRetries) return to('escalated');
        emit({ type: 'fail' }); return true;
      },
      undo: function () {
        if (S.stage !== 'voided' || !S.voided) return false;
        var v = S.voided.snap;
        S.merchant = v.merchantKey; S.fulfil = v.fulfilment; S.qty = clone(v.qty);
        S.reviewed = null; S.approval = null;
        return to('recheck', { type: 'undo' }); // values restored; approval stays void
      }
    };

    load(cfg.initial);
    return {
      state: S, cfg: cfg, subscribe: function (fn) { subs.push(fn); },
      snapshot: snapshot, canonical: canonical, total: total, policy: policy, passes: passes,
      load: load, setMerchant: setMerchant, setFulfil: setFulfil, setQty: setQty, bumpQty: bumpQty, act: act,
      canApprove: function () { return S.stage === 'review' && S.reviewed === canonical(); }
    };
  }

  /* SHA-256 (WebCrypto when available, small JS fallback otherwise) */
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
    if (g.crypto && g.crypto.subtle && g.TextEncoder) {
      return g.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      }).catch(function () { return sha256js(str); });
    }
    return Promise.resolve(sha256js(str));
  }

  g.CartbopApproval = { createMachine: createMachine, sha256: sha256, sha256js: sha256js };
})(window);
