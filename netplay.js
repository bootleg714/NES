/*
 * Lockstep netplay for JSNES, for up to 4 players (with a Four Score).
 *
 * Every player runs their own copy of the emulator. Each frame, every player
 * sends their controller input for a frame a few steps in the future (DELAY).
 * A frame only runs once every active player's input for it has arrived, so
 * all copies of the game stay identical.
 *
 * The host is Player 1 and the hub: guests send their inputs to the host,
 * which forwards them to everyone else. Players can join or leave mid-game.
 * A joining player receives a snapshot of the host's game and takes a free
 * seat a few frames in the future; a leaving player's seat goes idle (no
 * buttons pressed) from the first frame nobody has their input for.
 *
 * Every 60 frames the host sends a checksum of the console's RAM. A guest
 * whose checksum differs asks for a fresh snapshot.
 *
 * Transport (provided by the page):
 *   host:  o.broadcast(msg, exceptSeat), o.sendTo(seat, msg)
 *   guest: o.send(msg)
 * This file has no DOM code, so it can be tested outside a browser.
 */
(function (root) {
  var MAX_SEATS = 4;

  function createLockstep(o) {
    var nes = o.nes, runFrame = o.runFrame, isHost = !!o.isHost;
    var DELAY = o.delay || 5;
    var maxSeats = Math.min(o.maxSeats || MAX_SEATS, MAX_SEATS);
    var KEEP = 240;

    var frame = 0, mySeat = isHost ? 1 : 0, mask = 0, lastSent = -1;
    var inputs = { 1: {}, 2: {}, 3: {}, 4: {} };
    var seats = {};          // seat -> [{s: firstFrame, e: endFrame or null}]
    var lastRecv = {};       // host: last input frame received per guest seat
    var running = false, waiting = false, resyncing = false;
    var myHash = {}, peerHash = {};

    var api = { active: false, isHost: isHost, stalled: 0, resyncs: 0 };

    function out(msg, except) {
      if (isHost) o.broadcast(msg, except);
      else o.send(msg);
    }

    function isActive(p, f) {
      var list = seats[p];
      if (!list) return false;
      for (var i = 0; i < list.length; i++) {
        if (f >= list[i].s && (list[i].e === null || f < list[i].e)) return true;
      }
      return false;
    }
    function openInterval(p) {
      var list = seats[p];
      if (!list) return null;
      for (var i = 0; i < list.length; i++) if (list[i].e === null) return list[i];
      return null;
    }
    function lastEnd(p) {
      var list = seats[p] || [], e = 0;
      for (var i = 0; i < list.length; i++) if (list[i].e !== null && list[i].e > e) e = list[i].e;
      return e;
    }
    function fillIdle(p, from) {
      for (var k = from; k < from + DELAY; k++) inputs[p][k] = 0;
    }

    function apply(ctrl, m) {
      if (!ctrl) return;
      for (var b = 0; b < 8; b++) ctrl.state[b] = (m >> b) & 1 ? 0x41 : 0x40;
      ctrl.baseA = ctrl.state[0];
      ctrl.baseB = ctrl.state[1];
      ctrl.turboA = false;
      ctrl.turboB = false;
    }

    function ramHash() {
      var m = nes.cpu.mem, h = 2166136261;
      for (var i = 0; i < 0x800; i++) { h ^= m[i]; h = Math.imul(h, 16777619); }
      return h >>> 0;
    }

    function compare(f) {
      if (isHost || myHash[f] === undefined || peerHash[f] === undefined) return;
      if (myHash[f] !== peerHash[f] && !resyncing) {
        resyncing = true;
        api.resyncs++;
        o.send({ t: "rq" });
        if (o.onDesync) o.onDesync(api.resyncs);
      }
      delete myHash[f];
      delete peerHash[f];
    }

    function snapshot(type, extra) {
      var inp = {};
      for (var p = 1; p <= MAX_SEATS; p++) {
        inp[p] = {};
        for (var k in inputs[p]) if (+k >= frame) inp[p][k] = inputs[p][k];
      }
      var msg = { t: type, f: frame, d: DELAY, s: nes.toJSON(), seats: JSON.parse(JSON.stringify(seats)), inp: inp };
      for (var key in extra) msg[key] = extra[key];
      return msg;
    }

    // ---- Host API ----

    // Start hosting from the current moment of the game (no restart).
    api.begin = function () {
      frame = 0; mask = 0;
      inputs = { 1: {}, 2: {}, 3: {}, 4: {} };
      seats = { 1: [{ s: 0, e: null }] };
      lastRecv = {};
      fillIdle(1, 0);
      lastSent = DELAY - 1;
      running = true;
      api.active = true;
    };

    // Lowest free seat for a new guest, or 0 if the room is full.
    api.freeSeat = function () {
      for (var p = 2; p <= maxSeats; p++) if (!openInterval(p)) return p;
      return 0;
    };

    // Seat a new guest. The page must already be routing sendTo(seat) to them.
    api.admit = function (p) {
      // No player can have run frame + DELAY yet, so it's a safe start frame.
      var start = Math.max(frame + DELAY, lastEnd(p));
      seats[p] = (seats[p] || []).concat([{ s: start, e: null }]);
      fillIdle(p, start);
      lastRecv[p] = start + DELAY - 1;
      o.sendTo(p, snapshot("w", { p: p }));
      o.broadcast({ t: "join", p: p, s: start }, p);
    };

    // A guest left: their seat goes idle from the first frame nobody has input for.
    api.remove = function (p) {
      var iv = openInterval(p);
      if (!iv) return;
      iv.e = Math.max(lastRecv[p] === undefined ? -1 : lastRecv[p], iv.s + DELAY - 1) + 1;
      delete lastRecv[p];
      o.broadcast({ t: "drop", p: p, e: iv.e }, p);
    };

    // Seats that are currently playing (for the page's player list).
    api.seatsInUse = function () {
      var list = [];
      for (var p = 1; p <= MAX_SEATS; p++) if (openInterval(p)) list.push(p);
      return list;
    };

    // ---- Both ----

    api.press = function (btn, down) {
      if (btn === 8) btn = 0;      // turbo A -> A
      else if (btn === 9) btn = 1; // turbo B -> B
      if (btn < 0 || btn > 7) return;
      mask = down ? mask | (1 << btn) : mask & ~(1 << btn);
    };

    // Called in place of nes.frame(). Returns true if a frame ran.
    api.step = function () {
      if (!running || waiting) return false;
      var p;
      for (p = 1; p <= MAX_SEATS; p++) {
        if (isActive(p, frame) && inputs[p][frame] === undefined) { api.stalled++; return false; }
      }
      api.stalled = 0;

      var target = frame + DELAY;
      for (var k = lastSent + 1; k <= target; k++) {
        inputs[mySeat][k] = mask;
        out({ t: "i", p: mySeat, f: k, m: mask });
      }
      if (target > lastSent) lastSent = target;

      for (p = 1; p <= MAX_SEATS; p++) apply(nes.controllers[p], isActive(p, frame) ? inputs[p][frame] : 0);
      try {
        runFrame();
      } catch (e) {
        if (isHost) throw e;
        // A guest that drifted out of sync can crash; fetch the host's state.
        waiting = true;
        if (!resyncing) { resyncing = true; api.resyncs++; o.send({ t: "rq" }); }
        return false;
      }

      for (p = 1; p <= MAX_SEATS; p++) delete inputs[p][frame - KEEP];
      frame++;

      if (frame % 60 === 0) {
        var h = ramHash();
        if (isHost) o.broadcast({ t: "h", f: frame, h: h });
        else { myHash[frame] = h; compare(frame); }
      }
      return true;
    };

    // fromSeat: on the host, which guest sent this message.
    api.onMessage = function (m, fromSeat) {
      if (!m || typeof m !== "object") return;
      var k, p, iv;
      switch (m.t) {
        case "i":
          if (isHost) {
            if (m.p !== fromSeat || !openInterval(m.p)) return;
            inputs[m.p][m.f] = m.m | 0;
            if (m.f > (lastRecv[m.p] || -1)) lastRecv[m.p] = m.f;
            o.broadcast({ t: "i", p: m.p, f: m.f, m: m.m | 0 }, m.p);
          } else {
            inputs[m.p][m.f] = m.m | 0;
          }
          break;
        case "join":
          if (isHost) return;
          seats[m.p] = (seats[m.p] || []).concat([{ s: m.s, e: null }]);
          fillIdle(m.p, m.s);
          break;
        case "drop":
          if (isHost) return;
          iv = openInterval(m.p);
          if (iv) iv.e = m.e;
          break;
        case "h":
          if (isHost) return;
          peerHash[m.f] = m.h;
          compare(m.f);
          break;
        case "rq":
          if (isHost && running && fromSeat) o.sendTo(fromSeat, snapshot("s", {}));
          break;
        case "w": // welcome: snapshot + our seat
        case "s": // resync snapshot
          if (isHost) return;
          nes.fromJSON(m.s);
          frame = m.f;
          DELAY = m.d || DELAY;
          seats = m.seats;
          for (p in m.inp) for (k in m.inp[p]) inputs[p][k] = m.inp[p][k];
          if (m.t === "w") {
            mySeat = m.p;
            mask = 0;
            lastSent = openInterval(mySeat).s + DELAY - 1;
          } else {
            for (k = lastSent + 1; k < frame + DELAY; k++) {
              inputs[mySeat][k] = mask;
              o.send({ t: "i", p: mySeat, f: k, m: mask });
            }
            if (frame + DELAY - 1 > lastSent) lastSent = frame + DELAY - 1;
          }
          myHash = {};
          peerHash = {};
          resyncing = false;
          waiting = false;
          running = true;
          api.active = true;
          break;
      }
    };

    // Stop syncing. The game keeps running locally.
    api.end = function () {
      running = false;
      api.active = false;
      mask = 0;
      for (var p = 1; p <= MAX_SEATS; p++) apply(nes.controllers[p], 0);
    };

    api.getFrame = function () { return frame; };
    api.getSeat = function () { return mySeat; };
    api.ramHash = ramHash;
    return api;
  }

  root.createLockstep = createLockstep;
  if (typeof module !== "undefined" && module.exports) module.exports = createLockstep;
})(typeof window !== "undefined" ? window : globalThis);
