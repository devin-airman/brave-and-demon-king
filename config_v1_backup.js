/* =========================================================
   遊戲設定（階段一確認的數值，想調整就改這裡）
   ========================================================= */

// 名字顏色：勇者藍色；敵人紅色，越強越深
const HERO_COLOR = "#4da6ff";
const ENEMY_COLORS = {
  "史萊姆": "#ff9e9e",  // 最弱：淺紅
  "哥布林": "#ff5c5c",
  "骷髏兵": "#e82a2a",
  "魔王":   "#c40000",  // 最強：深紅（另加粗體）
};

// 勇者初始數值
const HERO_BASE = { hp: 10, atk: 8, def: 8, shield: 0 };

// 選項池機率（%）——每回合兩個選項必定不同類型，第二個會從剩下兩種類型中按這裡的比例抽
const EVENT_WEIGHTS = [
  { type: "monster", weight: 67 },
  { type: "camp",    weight: 25 },
  { type: "chest",   weight: 8 },
];

// 魔王出現機率：起始 0%，每回合 +2%，上限 100%（第 51 回合必定出現）
const BOSS_START = 0;
const BOSS_STEP = 2;

// 魔王逃跑規則：第 BOSS_ESCAPE_TURN 回合或之前遇到魔王，可以選擇逃跑
const BOSS_ESCAPE_TURN = 10;
const BOSS_MERCY_TEXT = "魔王十分「仁慈」，從來不對弱者下手，變強後再來吧。";
const ESCAPE_TEXT = "勇者轉身就跑，只聽見身後傳來邪惡的笑聲......";
const BOSS_MAX = 100;

// 部位名稱
const SLOT_NAME = { weapon: "武器", armor: "裝甲", shield: "盾牌" };
const STAT_NAME = { weapon: "攻擊", armor: "防禦", shield: "護盾" };

// 小怪（數值由裝備決定）
const MONSTERS = [
  {
    name: "史萊姆", hp: 20, weight: 60,
    items: [
      { slot: "weapon", name: "黏液觸手", value: 3 },
      { slot: "armor",  name: "凝膠外皮", value: 2 },
    ],
  },
  {
    name: "哥布林", hp: 30, weight: 30,
    items: [
      { slot: "weapon", name: "木棒",     value: 5 },
      { slot: "armor",  name: "皮甲",     value: 3 },
      { slot: "shield", name: "破舊木盾", value: 2 },
    ],
  },
  {
    name: "骷髏兵", hp: 40, weight: 10,
    items: [
      { slot: "weapon", name: "骨刃",     value: 8 },
      { slot: "armor",  name: "骨甲",     value: 6 },
      { slot: "shield", name: "亡者之盾", value: 4 },
    ],
  },
];

// 魔王
const BOSS = {
  name: "魔王", hp: 50, isBoss: true,
  items: [
    { slot: "weapon", name: "魔王之劍", value: 15 },
    { slot: "armor",  name: "魔王鎧甲", value: 12 },
    { slot: "shield", name: "暗黑護盾", value: 8 },
  ],
};

// 寶箱專屬裝備（6 件，平均機率）
const CHEST_ITEMS = [
  { slot: "weapon", name: "烈焰長劍",   value: 12 },
  { slot: "weapon", name: "雷霆戰斧",   value: 14 },
  { slot: "armor",  name: "龍鱗鎧甲",   value: 10 },
  { slot: "armor",  name: "聖騎士鎧甲", value: 11 },
  { slot: "shield", name: "神聖之盾",   value: 6 },
  { slot: "shield", name: "星辰護盾",   value: 7 },
];

// 標題畫面文字
const TITLE_TEXT = "勇者與魔王";
const TITLE_SUB = "一款純文字冒險 RPG";

// 遊戲介紹文字（可自由修改）
const INTRO_STORY = [
  "很久很久以前，魔王從黑暗中甦醒，帶領史萊姆、哥布林和骷髏兵佔據了大地。",
  "王國的騎士一個接一個倒下，人們只能把最後的希望交給一位年輕的勇者。",
  "你就是那位勇者。帶上簡陋的裝備出發吧，在魔王找上門之前，盡可能變強。",
];
const INTRO_RULES = [
  "每回合會出現兩個選項，二選一前進：遭遇怪物、營地（生命回滿）或寶箱（強力裝備）。兩個選項一定是不同類型，不會同時出現兩隻怪物、兩個營地或兩個寶箱。",
  `每做一次選擇，回合數 +1。第 1 回合魔王不會出現，之後每回合出現機率 +${BOSS_STEP}%。`,
  `魔王十分「仁慈」，從來不對弱者下手：第 ${BOSS_ESCAPE_TURN} 回合或之前遇到魔王，可以選擇逃跑（逃跑也算一次選擇）；第 ${BOSS_ESCAPE_TURN + 1} 回合起遇到魔王就必須戰鬥。`,
  "戰鬥無法逃跑，只能攻擊。開場擲 0–20 骰：單數勇者先攻，雙數對手先攻。",
  "傷害 = 攻擊力 + 骰子(0–20) − 對方防禦力（最低 0）。受傷先扣護盾，再扣生命。",
  "護盾每場戰鬥開始時刷新，但生命不會自動回復，記得找營地休息。",
  "裝備分武器（攻擊）、裝甲（防禦）、盾牌（護盾）三個部位。打倒怪物會掉落 1 件裝備，可以選擇拾取或放棄。",
  "打敗魔王就勝利；勇者生命歸零就失敗。",
];

// 擲骰動畫時間（毫秒）
const DICE_ROLL_MS = 1400; // 數字亂跳多久
const DICE_TICK_MS = 100;  // 每隔多久換一次數字
const DICE_HOLD_MS = 1000; // 停在結果上多久

// 戰鬥效果動畫時間（毫秒）
const SWORD_MS = 650;  // 勇者揮劍
const HIT_MS = 500;    // 受到攻擊：金光（無傷）／搖動＋紅光（受傷）
const GOLD_GLOW = "#ffd23f";  // 無傷金光顏色
const RED_GLOW = "#ff2b2b";   // 受傷紅光顏色

// 魔王出現動畫：頭像由小放大、越來越透明
const BOSS_APPEAR_MS = 1800;     // 動畫長度
const BOSS_SCALE_FROM = 0.2;     // 開始大小（倍數）
const BOSS_SCALE_TO = 1.8;       // 結束大小（倍數）

// 劇情文字動畫：文字出現後漸漸透明並消失
const START_TEXT = "冒險開始了.....";   // 按下開始遊戲後
const DEFEAT_TEXT = "勇者敗了......";    // 勇者被打敗後
const STORY_SHOW_MS = 300;    // 文字浮現
const STORY_HOLD_MS = 900;    // 文字完全清楚的時間
const STORY_FADE_MS = 1600;   // 文字漸漸透明到消失
const DEFEAT_WAIT_MS = 1200;  // 被打敗後先停一下，讓玩家看清最後一擊
const DEFEAT_DARKEN_MS = 1200; // 畫面變暗所需時間
const DEFEAT_DARKNESS = 0.85;  // 變暗程度（0＝不變暗，1＝全黑）

// 轉場動畫時間（毫秒）
const FADE_MS = 300;   // 淡出 / 淡入
const SCAN_MS = 400;   // 掃描線掃過

