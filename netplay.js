/*
 * Lockstep netplay for JSNES.
 *
 * Both players run their own copy of the emulator. Every frame, each side
 * sends its controller input for a frame a few steps in the future (DELAY).
 * A frame only runs once both players' inputs for it have arrived, so the
 * two games stay identical. The host is Player 1, the guest is Player 2.
 *
 * Every 60 frames the host sends a checksum of the console's RAM. If the
 * guest's checksum differs, the guest asks for a full snapshot and resyncs.
 *
 * This file has no DOM code, so it can be tested outside a browser.
 */
(function (root) {
  function createLockstep(o) {
    var nes = o.nes;          // jsnes NES instance
    var runFrame = o.runFrame; // the emulator's original frame() function
    var send = o.send;        // function(message) -> sends to the other player
    var isHost = !!o.isHost;
    var DELAY = o.delay || 5; // frames of input delay (~83 ms at 5)
    var KEEP = 240;           // how many past frames of input to keep

    var frame = 0, local = {}, remote = {}, lastSent = -1, mask = 0;
    var running = false, myHash = {}, peerHash = {}, resyncing = false, waiting = false;

    var api = { active: false, isHost: isHost, stalled: 0, resyncs: 0 };

    function reset() {
      frame = 0; local = {}; remote = {}; myHash = {}; peerHash = {};
      resyncing = false; waiting = false; api.stalled = 0;
      for (var i = 0; i < DELAY; i++) { local[i] = 0; remote[i] = 0; }
      lastSent = DELAY - 1;
    }

    function apply(ctrl, m) {
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
        send({ t: "rq" });
        if (o.onDesync) o.onDesync(api.resyncs);
      }
      delete myHash[f];
      delete peerHash[f];
    }

    // Host: start a synced match. Both sides restart the game from power-on.
    api.begin = function () {
      reset();
      nes.reloadROM();
      running = true;
      api.active = true;
      send({ t: "start", d: DELAY });
    };

    // Local button press/release (from keyboard, gamepad or touch).
    api.press = function (btn, down) {
      if (btn === 8) btn = 0;      // turbo A -> A
      else if (btn === 9) btn = 1; // turbo B -> B
      if (btn < 0 || btn > 7) return;
      mask = down ? mask | (1 << btn) : mask & ~(1 << btn);
    };

    // Called in place of nes.frame(). Returns true if a frame ran.
    api.step = function () {
      if (!running || waiting) return false;
      if (remote[frame] === undefined || local[frame] === undefined) {
        api.stalled++;
        return false;
      }
      api.stalled = 0;

      var target = frame + DELAY;
      for (var k = lastSent + 1; k <= target; k++) {
        local[k] = mask;
        send({ t: "i", f: k, m: mask });
      }
      if (target > lastSent) lastSent = target;

      apply(nes.controllers[1], isHost ? local[frame] : remote[frame]);
      apply(nes.controllers[2], isHost ? remote[frame] : local[frame]);
      try {
        runFrame();
      } catch (e) {
        // A guest that drifted out of sync can crash; fetch the host's state.
        if (isHost) throw e;
        waiting = true;
        if (!resyncing) { resyncing = true; api.resyncs++; send({ t: "rq" }); }
        return false;
      }

      delete local[frame - KEEP];
      delete remote[frame - KEEP];
      frame++;

      if (frame % 60 === 0) {
        var h = ramHash();
        if (isHost) send({ t: "h", f: frame, h: h });
        else { myHash[frame] = h; compare(frame); }
      }
      return true;
    };

    api.onMessage = function (m) {
      if (!m || typeof m !== "object") return;
      var k;
      switch (m.t) {
        case "i":
          remote[m.f] = m.m | 0;
          break;
        case "start":
          if (isHost) return;
          DELAY = m.d || DELAY;
          reset();
          nes.reloadROM();
          running = true;
          api.active = true;
          break;
        case "h":
          peerHash[m.f] = m.h;
          compare(m.f);
          break;
        case "rq":
          if (!isHost || !running) return;
          var inp = {};
          for (k = frame; k <= lastSent; k++) inp[k] = local[k];
          send({ t: "s", f: frame, s: nes.toJSON(), inp: inp });
          break;
        case "s":
          if (isHost || !running) return;
          nes.fromJSON(m.s);
          frame = m.f;
          for (k in m.inp) remote[k] = m.inp[k];
          for (k = lastSent + 1; k < frame + DELAY; k++) {
            local[k] = mask;
            send({ t: "i", f: k, m: mask });
          }
          if (frame + DELAY - 1 > lastSent) lastSent = frame + DELAY - 1;
          myHash = {};
          peerHash = {};
          resyncing = false;
          waiting = false;
          break;
      }
    };

    // Stop syncing (other player left). The game keeps running locally.
    api.end = function () {
      running = false;
      api.active = false;
      mask = 0;
      apply(nes.controllers[1], 0);
      apply(nes.controllers[2], 0);
    };

    api.getFrame = function () { return frame; };
    api.ramHash = ramHash;
    return api;
  }

  root.createLockstep = createLockstep;
  if (typeof module !== "undefined" && module.exports) module.exports = createLockstep;
})(typeof window !== "undefined" ? window : globalThis);
