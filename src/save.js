// ===== 存档：localStorage =====
const KEY = 'wds_save_v1';

export const Save = {
  exists() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },

  save(game) {
    try {
      const p = game.player;
      const data = {
        seed: game.world.seed,
        time: game.sky.timeOfDay,
        edits: [...game.world.edits.entries()],
        player: {
          pos: p.pos, yaw: p.yaw, pitch: p.pitch,
          hp: p.hp, mode: p.mode, spawn: p.spawn,
          hotbar: p.hotbar, backpack: p.backpack,
          selected: p.selected,
        },
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },

  clear() {
    try { localStorage.removeItem(KEY); } catch (e) { }
  },
};
