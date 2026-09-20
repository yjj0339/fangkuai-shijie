// ===== 方块注册表 =====
// tiles: {top, bottom, side} → 纹理图集 tile 名
// solid: 参与碰撞  opaque: 完全遮挡邻面（剔除+遮蔽AO+天光）
// cross: 交叉面片植物  hardness: 徒手挖掘秒数  drop: 掉落方块id(默认自身, 0=无)
// snd: 音色材质类型  lum: 自发光

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG: 5, LEAVES: 6,
  PLANKS: 7, SAND: 8, WATER: 9, GLASS: 10, COAL: 11, IRON: 12, GOLD: 13,
  DIAMOND: 14, BEDROCK: 15, SNOW_GRASS: 16, SNOW: 17, GRAVEL: 18,
  GLOWSTONE: 19, BRICKS: 20, TNT: 21, WOOL: 22, DANDELION: 23, POPPY: 24,
  TALLGRASS: 25, CACTUS: 26, BIRCH_LOG: 27, BIRCH_LEAVES: 28,
  SPRUCE_LOG: 29, SPRUCE_LEAVES: 30, CRAFTING: 31, BOOKSHELF: 32,
  SANDSTONE: 33, PUMPKIN: 34, PORK: 35, STEAK: 36,
};

export const BLOCKS = [];

function reg(id, def) {
  def.id = id;
  if (def.solid === undefined) def.solid = true;
  if (def.opaque === undefined) def.opaque = def.solid && !def.cross;
  if (def.hardness === undefined) def.hardness = 1;
  def.drop = def.drop === undefined ? id : def.drop;
  if (!def.snd) def.snd = 'stone';
  BLOCKS[id] = def;
  return id;
}

reg(B.AIR, { name: '空气', solid: false, opaque: false, hardness: 0, drop: 0 });
reg(B.GRASS, { name: '草方块', tiles: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.9, drop: B.DIRT, snd: 'grass' });
reg(B.DIRT, { name: '泥土', tiles: { all: 'dirt' }, hardness: 0.75, snd: 'grass' });
reg(B.STONE, { name: '石头', tiles: { all: 'stone' }, hardness: 2.2, drop: B.COBBLE });
reg(B.COBBLE, { name: '圆石', tiles: { all: 'cobble' }, hardness: 2.5 });
reg(B.LOG, { name: '橡木原木', tiles: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: 1.6, snd: 'wood' });
reg(B.LEAVES, { name: '橡树树叶', tiles: { all: 'leaves' }, hardness: 0.35, snd: 'grass', lightAtten: 3 });
reg(B.PLANKS, { name: '橡木木板', tiles: { all: 'planks' }, hardness: 1.6, snd: 'wood' });
reg(B.SAND, { name: '沙子', tiles: { all: 'sand' }, hardness: 0.7, snd: 'sand' });
reg(B.WATER, { name: '水', tiles: { all: 'water' }, solid: false, opaque: false, hardness: 0, drop: 0, snd: 'water', lightAtten: 1 });
reg(B.GLASS, { name: '玻璃', tiles: { all: 'glass' }, opaque: false, hardness: 0.5, drop: 0, snd: 'glass', cutout: true });
reg(B.COAL, { name: '煤矿石', tiles: { all: 'coal_ore' }, hardness: 3 });
reg(B.IRON, { name: '铁矿石', tiles: { all: 'iron_ore' }, hardness: 3.5 });
reg(B.GOLD, { name: '金矿石', tiles: { all: 'gold_ore' }, hardness: 3.5 });
reg(B.DIAMOND, { name: '钻石矿石', tiles: { all: 'diamond_ore' }, hardness: 4.5 });
reg(B.BEDROCK, { name: '基岩', tiles: { all: 'bedrock' }, hardness: Infinity });
reg(B.SNOW_GRASS, { name: '积雪草方块', tiles: { top: 'snow', bottom: 'dirt', side: 'snow_side' }, hardness: 0.9, drop: B.DIRT, snd: 'grass' });
reg(B.SNOW, { name: '雪块', tiles: { all: 'snow' }, hardness: 0.5, snd: 'sand' });
reg(B.GRAVEL, { name: '砂砾', tiles: { all: 'gravel' }, hardness: 0.8, snd: 'sand' });
reg(B.GLOWSTONE, { name: '荧石', tiles: { all: 'glowstone' }, hardness: 0.6, lum: 1, snd: 'glass' });
reg(B.BRICKS, { name: '砖块', tiles: { all: 'bricks' }, hardness: 2.5 });
reg(B.TNT, { name: 'TNT', tiles: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0.2, snd: 'grass' });
reg(B.WOOL, { name: '白色羊毛', tiles: { all: 'wool' }, hardness: 0.9, snd: 'wool' });
reg(B.DANDELION, { name: '蒲公英', tiles: { all: 'dandelion' }, cross: true, hardness: 0.05, snd: 'grass' });
reg(B.POPPY, { name: '虞美人', tiles: { all: 'poppy' }, cross: true, hardness: 0.05, snd: 'grass' });
reg(B.TALLGRASS, { name: '草丛', tiles: { all: 'tallgrass' }, cross: true, hardness: 0.05, drop: 0, snd: 'grass' });
reg(B.CACTUS, { name: '仙人掌', tiles: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' }, hardness: 0.6, snd: 'wool' });
reg(B.BIRCH_LOG, { name: '白桦原木', tiles: { top: 'birch_top', bottom: 'birch_top', side: 'birch_side' }, hardness: 1.6, snd: 'wood' });
reg(B.BIRCH_LEAVES, { name: '白桦树叶', tiles: { all: 'birch_leaves' }, hardness: 0.35, snd: 'grass', lightAtten: 3 });
reg(B.SPRUCE_LOG, { name: '云杉原木', tiles: { top: 'spruce_top', bottom: 'spruce_top', side: 'spruce_side' }, hardness: 1.6, snd: 'wood' });
reg(B.SPRUCE_LEAVES, { name: '云杉树叶', tiles: { all: 'spruce_leaves' }, hardness: 0.35, snd: 'grass', lightAtten: 3 });
reg(B.CRAFTING, { name: '工作台', tiles: { top: 'craft_top', bottom: 'planks', side: 'craft_side' }, hardness: 1.6, snd: 'wood' });
reg(B.BOOKSHELF, { name: '书架', tiles: { top: 'planks', bottom: 'planks', side: 'bookshelf' }, hardness: 1.6, snd: 'wood' });
reg(B.SANDSTONE, { name: '砂岩', tiles: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone' }, hardness: 1.6 });
reg(B.PUMPKIN, { name: '南瓜', tiles: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side' }, hardness: 1, snd: 'wood' });
reg(B.PORK, { name: '生猪排', tiles: { all: 'pork' }, item: true, snd: 'wool' });
reg(B.STEAK, { name: '牛排', tiles: { all: 'steak' }, item: true, snd: 'wool' });

// 创造模式物品栏展示顺序
export const CREATIVE_ITEMS = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.SAND, B.SANDSTONE, B.GRAVEL,
  B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.PLANKS, B.LEAVES, B.BIRCH_LEAVES,
  B.SPRUCE_LEAVES, B.GLASS, B.WOOL, B.BRICKS, B.BOOKSHELF, B.CRAFTING,
  B.GLOWSTONE, B.PUMPKIN, B.TNT, B.CACTUS, B.SNOW, B.COAL, B.IRON,
  B.GOLD, B.DIAMOND, B.BEDROCK, B.DANDELION, B.POPPY, B.TALLGRASS,
  B.WATER, B.PORK, B.STEAK,
];

export function blockInfo(id) { return BLOCKS[id] || BLOCKS[0]; }
export function isSolid(id) { return BLOCKS[id] ? BLOCKS[id].solid : false; }
export function isOpaque(id) { return BLOCKS[id] ? BLOCKS[id].opaque : false; }
