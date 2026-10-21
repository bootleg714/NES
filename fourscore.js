/*
 * NES Four Score (4-player adapter) for JSNES.
 *
 * With a Four Score plugged in, each controller port reports 24 bits per read
 * cycle instead of 8 (see https://www.nesdev.org/wiki/Four_Score):
 *   $4016: controller 1 (bits 0-7), controller 3 (bits 8-15), signature (bit 19 = 1)
 *   $4017: controller 2 (bits 0-7), controller 4 (bits 8-15), signature (bit 18 = 1)
 *
 * JSNES already counts 24 reads per port but returns 1s after the first 8.
 * This wraps its port-read functions to return controllers 3 and 4 and the
 * signature instead. JSNES rebuilds its mapper on every reset and save-state
 * load, so the wrapper is re-applied automatically whenever that happens.
 *
 * Usage: var fs = enableFourScore(nes);  fs.on = false to unplug it.
 */
(function (root) {
  function enableFourScore(nes, opts) {
    var Controller = nes.controllers[1].constructor;
    if (!nes.controllers[3]) nes.controllers[3] = new Controller();
    if (!nes.controllers[4]) nes.controllers[4] = new Controller();
    var adapter = { on: !opts || opts.on !== false };

    function wrapPort(m, port) {
      var flag = "__fourScore" + port;
      if (!m || m[flag]) return;
      m[flag] = true;
      var counter = port === 1 ? "joy1StrobeState" : "joy2StrobeState";
      var readFn = port === 1 ? "joy1Read" : "joy2Read";
      var original = m[readFn];
      var extra = port === 1 ? 3 : 4;
      var signatureBit = port === 1 ? 19 : 18;

      m[readFn] = function () {
        var before = m[counter];
        var value = original.call(m);
        var after = m[counter];
        // While the strobe is held the counter doesn't move: that's a normal read.
        if (!adapter.on || after === before) return value;
        var bit = (after === 0 ? 24 : after) - 1; // which of the 24 bits was just read
        if (bit < 8) return value;                // controller 1 or 2
        if (bit < 16) return nes.controllers[extra].state[bit - 8]; // controller 3 or 4
        return bit === signatureBit ? 0x41 : 0x40; // signature
      };
    }

    function patch(m) { wrapPort(m, 1); wrapPort(m, 2); }

    var current = nes.mmap;
    Object.defineProperty(nes, "mmap", {
      configurable: true,
      enumerable: true,
      get: function () { return current; },
      set: function (m) { current = m; patch(m); }
    });
    patch(current);
    return adapter;
  }

  root.enableFourScore = enableFourScore;
  if (typeof module !== "undefined" && module.exports) module.exports = enableFourScore;
})(typeof window !== "undefined" ? window : globalThis);
