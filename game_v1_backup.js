/* =========================================================
   遊戲狀態
   ========================================================= */
let hero, turn, enemy, gameOver;

const $status = document.getElementById("status");
const $log = document.getElementById("log");
const $choices = document.getElementById("choices");

/* ===== 小工具 ===== */
// 把文字中的勇者／敵人名字包上顏色（「魔王之劍」「魔王鎧甲」是裝備，不上色）
function escapeHtml(t) {
  return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
const NAME_REGEX = new RegExp(
  "(勇者)|(" + Object.keys(ENEMY_COLORS).map(n => n === "魔王" ? "魔王(?!之劍|鎧甲)" : n).join("|") + ")", "g");
function colorize(html) {
  return html.replace(NAME_REGEX, (m, hero) => {
    if (hero) return `<span class="name" style="color:${HERO_COLOR}">${m}</span>`;
    const boss = m === "魔王" ? " name-boss" : "";
    return `<span class="name${boss}" style="color:${ENEMY_COLORS[m]}">${m}</span>`;
  });
}
function rollD20() { return Math.floor(Math.random() * 21); } // 0–20
function randomPick(list) { return list[Math.floor(Math.random() * list.length)]; }
function weightedPick(list) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of list) { if ((r -= x.weight) < 0) return x; }
  return list[list.length - 1];
}
function itemText(item) {
  return item ? `${item.name}（${STAT_NAME[item.slot]}+${item.value}）` : "無";
}
function bossChance() {
  return Math.min(BOSS_MAX, BOSS_START + BOSS_STEP * (turn - 1));
}

// 從裝備算出實際數值（勇者有初始數值，怪物初始為 0）
function calcStats(base, equip) {
  return {
    atk: base.atk + (equip.weapon ? equip.weapon.value : 0),
    def: base.def + (equip.armor ? equip.armor.value : 0),
    shield: base.shield + (equip.shield ? equip.shield.value : 0),
  };
}

/* ===== 畫面輸出 ===== */
function log(text, cls) {
  const p = document.createElement("p");
  p.innerHTML = colorize(escapeHtml(text));
  if (cls) p.className = cls;
  $log.appendChild(p);
  $log.scrollTop = $log.scrollHeight;
}
function sep() { log("────────────────────────", "sep"); }

function setChoices(list) {
  $choices.innerHTML = "";
  list.forEach(({ label, action }) => {
    const b = document.createElement("button");
    b.innerHTML = colorize(escapeHtml(label));
    b.onclick = action;
    $choices.appendChild(b);
  });
}

function renderStatus() {
  const s = calcStats(HERO_BASE, hero.equip);
  const curShield = enemy ? hero.shield : s.shield;
  let html = `
    <div class="title">勇者　第 ${turn} 回合</div>
    <div>生命：${Math.max(0, hero.hp)} / ${HERO_BASE.hp}</div>
    <div>護盾：${curShield} / ${s.shield}</div>
    <div>攻擊：${s.atk}</div>
    <div>防禦：${s.def}</div>
    <div class="full">武器：${itemText(hero.equip.weapon)}</div>
    <div class="full">裝甲：${itemText(hero.equip.armor)}</div>
    <div class="full">盾牌：${itemText(hero.equip.shield)}</div>
    <div class="full dim">魔王出現機率：${bossChance()}%</div>`;
  if (enemy) {
    html += `<div class="full dim">── 敵人：${enemy.name}　生命 ${Math.max(0, enemy.hp)} / ${enemy.maxHp}　護盾 ${enemy.shield}　攻擊 ${enemy.atk}　防禦 ${enemy.def}</div>`;
  }
  $status.innerHTML = colorize(html);
}

/* ===== 擲骰動畫 ===== */
const $dice = document.getElementById("dice");
const sleep = ms => new Promise(r => setTimeout(r, ms));
// who：誰在擲骰；color：名字顏色（null＝白色）；result：最後點數；note：下面的小字說明
async function rollDiceAnim(who, color, result, note) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $who = $dice.querySelector(".who"), $face = $dice.querySelector(".face"), $note = $dice.querySelector(".note");
  $who.innerHTML = colorize(escapeHtml(who)) + " 擲骰";
  $who.style.color = color || "#e8e8e8";
  $note.innerHTML = colorize(escapeHtml(note || ""));
  $face.classList.remove("landed");
  $face.style.borderColor = color || "#e8e8e8";
  $dice.classList.add("show");
  if (!reduce) {
    $face.classList.add("rolling");
    const end = Date.now() + DICE_ROLL_MS;
    while (Date.now() < end) {
      $face.textContent = rollD20();
      await sleep(DICE_TICK_MS);
    }
    $face.classList.remove("rolling");
  }
  $face.textContent = result;
  $face.classList.add("landed");
  await sleep(DICE_HOLD_MS);
  $dice.classList.remove("show");
  await sleep(120);
}

/* ===== 戰鬥效果動畫 ===== */
// 重新觸發 CSS 動畫
function replayClass(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
async function bossAppearAnim() {
  const $b = document.getElementById("boss-appear");
  replayClass($b, "show");
  await sleep(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 600 : BOSS_APPEAR_MS);
  $b.classList.remove("show");
}
// 劇情文字：文字浮現 → 停一下 → 漸漸透明消失
async function storyTextAnim(text) {
  const $t = document.querySelector("#story .text");
  $t.innerHTML = colorize(escapeHtml(text));
  const total = STORY_SHOW_MS + STORY_HOLD_MS + STORY_FADE_MS;
  const a = $t.animate([
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: STORY_SHOW_MS / total },
    { opacity: 1, offset: (STORY_SHOW_MS + STORY_HOLD_MS) / total },
    { opacity: 0, offset: 1 },
  ], { duration: total, easing: "ease-in-out", fill: "forwards" });
  await a.finished;
}
// 背景暗度動畫（0＝透明，1＝全黑）
async function storyBg(from, to, ms) {
  const $s = document.getElementById("story");
  const a = $s.animate([{ backgroundColor: `rgba(0,0,0,${from})` }, { backgroundColor: `rgba(0,0,0,${to})` }],
    { duration: ms, easing: "ease-in-out", fill: "forwards" });
  await a.finished;
}
// 開始遊戲：黑畫面顯示「冒險開始了.....」，文字消失後畫面亮起
async function playStartText() {
  const $s = document.getElementById("story");
  $s.classList.add("show");
  $s.getAnimations().forEach(a => a.cancel());
  $s.style.backgroundColor = "rgba(0,0,0,1)";
  await storyTextAnim(START_TEXT);
  await storyBg(1, 0, 500);
  $s.classList.remove("show");
  $s.getAnimations().forEach(a => a.cancel());
}
// 逃跑：畫面變暗 →「勇者轉身就跑……」→ 畫面亮起
async function playEscapeText() {
  const $s = document.getElementById("story");
  $s.getAnimations().forEach(a => a.cancel());
  $s.style.backgroundColor = "rgba(0,0,0,0)";
  $s.classList.add("show");
  await storyBg(0, DEFEAT_DARKNESS, 500);
  await storyTextAnim(ESCAPE_TEXT);
  await storyBg(DEFEAT_DARKNESS, 0, 400);
  $s.classList.remove("show");
  $s.getAnimations().forEach(a => a.cancel());
}
// 被打敗：畫面變暗 →「勇者敗了......」→ 返回標題畫面
async function playDefeatText() {
  const $s = document.getElementById("story");
  await sleep(DEFEAT_WAIT_MS);
  $s.getAnimations().forEach(a => a.cancel());
  $s.style.backgroundColor = "rgba(0,0,0,0)";
  $s.classList.add("show");
  await storyBg(0, DEFEAT_DARKNESS, DEFEAT_DARKEN_MS);
  await storyTextAnim(DEFEAT_TEXT);
  showScreen($title, () => {
    $s.classList.remove("show");
    $s.getAnimations().forEach(a => a.cancel());
  });
}

async function swordAnim() {
  const $sword = document.getElementById("sword");
  replayClass($sword, "show");
  await sleep(SWORD_MS);
  $sword.classList.remove("show");
}
// lostHp：勇者這次有沒有扣生命
async function heroHitAnim(lostHp) {
  const $g = document.getElementById("game");
  $log.classList.remove("glow-gold", "glow-red");
  $g.classList.remove("shake");
  if (lostHp) {
    replayClass($log, "glow-red");
    replayClass($g, "shake");
  } else {
    replayClass($log, "glow-gold");
  }
  await sleep(HIT_MS);
  $log.classList.remove("glow-gold", "glow-red");
  $g.classList.remove("shake");
}

/* =========================================================
   遊戲流程
   ========================================================= */
function newGame() {
  hero = { hp: HERO_BASE.hp, shield: 0, equip: { weapon: null, armor: null, shield: null } };
  turn = 1;
  enemy = null;
  gameOver = false;
  $log.innerHTML = "";
  log("【勇者與魔王】", "big");
  log("你是一名勇者，踏上了討伐魔王的旅程。");
  log("每回合從兩個選項中選一個前進。走得越遠，魔王出現的機率就越高。");
  nextTurn();
}

// 產生一個普通選項（exclude：要排除的類型，避免兩個選項同類型）
function makeOption(exclude) {
  const pool = EVENT_WEIGHTS.filter(e => e.type !== exclude);
  const ev = weightedPick(pool).type;
  let opt;
  if (ev === "monster") {
    const m = weightedPick(MONSTERS);
    opt = { label: `【遭遇】${m.name}出現了，迎戰`, action: () => choose(() => startBattle(m)) };
  } else if (ev === "camp") {
    opt = { label: "【營地】休息一下，生命回滿", action: () => choose(camp) };
  } else {
    opt = { label: "【寶箱】打開一個神秘寶箱", action: () => choose(openChest) };
  }
  opt.type = ev;
  return opt;
}

// 逃離魔王：播放文字動畫後進入下一回合（生命、裝備不變）
async function escapeBoss() {
  setChoices([]);
  log("你轉身逃離了魔王。");
  await playEscapeText();
  nextTurn();
}

function nextTurn() {
  enemy = null;
  renderStatus();
  sep();
  log(`第 ${turn} 回合。`);

  // 先判定魔王是否出現
  if (Math.random() * 100 < bossChance()) {
    log("空氣突然變得沉重……一股強大的氣息逼近。", "big");
    setChoices([]);
    const canEscape = turn <= BOSS_ESCAPE_TURN;
    bossAppearAnim().then(() => {
      if (canEscape) {
        log(BOSS_MERCY_TEXT, "big");
        setChoices([
          { label: "【魔王】魔王出現了，迎戰", action: () => choose(() => startBattle(BOSS)) },
          { label: "【逃跑】轉身逃跑，變強後再來", action: () => choose(escapeBoss) },
        ]);
      } else {
        setChoices([{ label: "【魔王】魔王出現了，無法逃避，迎戰", action: () => choose(() => startBattle(BOSS)) }]);
      }
    });
    return;
  }

  log("前方出現兩條路，你要選哪一條？");
  // 兩個選項不可同類型：第二個從剩下的類型中抽（按原本比例）
  const first = makeOption();
  const second = makeOption(first.type);
  setChoices([first, second]);
}

// 玩家做出選擇：回合數 +1，再執行事件
function choose(eventFn) {
  turn++;
  eventFn();
}

/* ===== 營地 ===== */
function camp() {
  const healed = HERO_BASE.hp - hero.hp;
  hero.hp = HERO_BASE.hp;
  log(`你在營地生火休息。生命回復 ${healed} 點，現在是 ${hero.hp} / ${HERO_BASE.hp}。`);
  renderStatus();
  setChoices([{ label: "繼續前進", action: nextTurn }]);
}

/* ===== 寶箱 ===== */
function openChest() {
  const item = randomPick(CHEST_ITEMS);
  log(`你打開寶箱，裡面有一件${SLOT_NAME[item.slot]}：${itemText(item)}。`);
  offerItem(item);
}

/* ===== 拾取裝備（替換同部位） ===== */
function offerItem(item) {
  const old = hero.equip[item.slot];
  log(`目前的${SLOT_NAME[item.slot]}：${itemText(old)}。`, "dim");
  renderStatus();
  setChoices([
    {
      label: old ? `拾取 ${item.name}（替換掉 ${old.name}）` : `拾取 ${item.name}`,
      action: () => {
        hero.equip[item.slot] = item;
        log(`你裝備了 ${itemText(item)}。`);
        nextTurn();
      },
    },
    {
      label: "不要，保留現有裝備",
      action: () => { log(`你放棄了 ${item.name}。`); nextTurn(); },
    },
  ]);
}

/* ===== 戰鬥 ===== */
async function startBattle(template) {
  const equip = { weapon: null, armor: null, shield: null };
  template.items.forEach(it => { equip[it.slot] = it; });
  const st = calcStats({ atk: 0, def: 0, shield: 0 }, equip);
  enemy = {
    name: template.name, isBoss: !!template.isBoss,
    hp: template.hp, maxHp: template.hp,
    atk: st.atk, def: st.def, shield: st.shield,
    items: template.items,
  };
  // 護盾每場戰鬥刷新
  hero.shield = calcStats(HERO_BASE, hero.equip).shield;
  setChoices([]); // 動畫期間不能按按鈕
  renderStatus();

  log(`戰鬥開始，對手是${enemy.name}（生命 ${enemy.hp}、攻擊 ${enemy.atk}、防禦 ${enemy.def}、護盾 ${enemy.shield}）。`, "big");

  // 擲骰決定先攻：單數勇者先、雙數對手先
  const r = rollD20();
  await rollDiceAnim("先攻判定", null, r, "單數＝勇者先攻／雙數＝" + enemy.name + "先攻");
  if (r % 2 === 1) {
    log(`先攻骰：${r}（單數），勇者先攻。`);
  } else {
    log(`先攻骰：${r}（雙數），${enemy.name}先攻。`);
    await enemyAttack();
    if (hero.hp <= 0) return;
  }
  renderStatus();
  setChoices([{ label: "攻擊", action: heroAttack }]);
}

// 計算並套用傷害：先扣護盾，再扣生命（骰子點數由外面傳入，方便先播動畫）
function dealDamage(attackerName, atk, target, targetName, dice) {
  const dmg = Math.max(0, atk + dice - target.def);
  const toShield = Math.min(target.shield, dmg);
  const toHp = dmg - toShield;
  target.shield -= toShield;
  target.hp -= toHp;
  let msg = `${attackerName}攻擊：${atk} + 骰子 ${dice} − 防禦 ${target.def} = ${dmg} 傷害`;
  if (dmg > 0) {
    const parts = [];
    if (toShield > 0) parts.push(`護盾 −${toShield}`);
    if (toHp > 0) parts.push(`生命 −${toHp}`);
    msg += `（${parts.join("，")}）`;
  }
  msg += `。${targetName}剩下生命 ${Math.max(0, target.hp)}、護盾 ${target.shield}。`;
  return msg;
}

async function heroAttack() {
  setChoices([]); // 動畫期間不能連按
  const s = calcStats(HERO_BASE, hero.equip);
  const dice = rollD20();
  await rollDiceAnim("勇者", HERO_COLOR, dice, `攻擊 ${s.atk} + 骰子 − 防禦 ${enemy.def}`);
  await swordAnim();
  const heroTarget = { def: enemy.def, shield: enemy.shield, hp: enemy.hp };
  log(dealDamage("勇者", s.atk, heroTarget, enemy.name, dice), "hit");
  enemy.shield = heroTarget.shield;
  enemy.hp = heroTarget.hp;
  renderStatus();

  if (enemy.hp <= 0) return winBattle();

  await enemyAttack();
  if (hero.hp <= 0) return;
  renderStatus();
  setChoices([{ label: "攻擊", action: heroAttack }]);
}

async function enemyAttack() {
  const s = calcStats(HERO_BASE, hero.equip);
  const dice = rollD20();
  await rollDiceAnim(enemy.name, ENEMY_COLORS[enemy.name], dice, `攻擊 ${enemy.atk} + 骰子 − 防禦 ${s.def}`);
  const target = { def: s.def, shield: hero.shield, hp: hero.hp };
  const hpBefore = hero.hp;
  log(dealDamage(enemy.name, enemy.atk, target, "勇者", dice), "hurt");
  hero.shield = target.shield;
  hero.hp = target.hp;
  renderStatus();
  await heroHitAnim(hero.hp < hpBefore);
  if (hero.hp <= 0) loseGame();
}

function winBattle() {
  if (enemy.isBoss) {
    log("魔王倒下了。你成功討伐魔王，世界恢復了和平。", "big");
    log(`【勝利】共經過 ${turn - 1} 次選擇。`, "big");
    enemy = null;
    renderStatus();
    setChoices([{ label: "再玩一次", action: () => { newGame(); playStartText(); } }, { label: "返回標題畫面", action: goTitle }]);
    return;
  }
  log(`你打倒了${enemy.name}。`, "big");
  const drop = randomPick(enemy.items);
  log(`${enemy.name}掉落了一件${SLOT_NAME[drop.slot]}：${itemText(drop)}。`);
  enemy = null;
  offerItem(drop);
}

function loseGame() {
  gameOver = true;
  hero.hp = 0;
  log(`勇者倒下了……被${enemy.name}打敗。`, "big");
  log(`【遊戲結束】共經過 ${turn - 1} 次選擇。`, "big");
  enemy = null;
  renderStatus();
  setChoices([]);
  playDefeatText(); // 畫面變暗 → 勇者敗了...... → 自動返回標題畫面
}

/* =========================================================
   標題畫面、介紹畫面與轉場
   ========================================================= */
const $title = document.getElementById("title-screen");
const $intro = document.getElementById("intro-screen");
const $game = document.getElementById("game");
const $fade = document.getElementById("fade");
let transitioning = false;

document.documentElement.style.setProperty("--fade-ms", FADE_MS + "ms");
document.documentElement.style.setProperty("--sword-ms", SWORD_MS + "ms");
document.documentElement.style.setProperty("--boss-ms", BOSS_APPEAR_MS + "ms");
document.documentElement.style.setProperty("--boss-from", BOSS_SCALE_FROM);
document.documentElement.style.setProperty("--boss-to", BOSS_SCALE_TO);
document.documentElement.style.setProperty("--hit-ms", HIT_MS + "ms");
document.documentElement.style.setProperty("--gold", GOLD_GLOW);
document.documentElement.style.setProperty("--red", RED_GLOW);
document.documentElement.style.setProperty("--scan-ms", SCAN_MS + "ms");
document.getElementById("title-logo").textContent = TITLE_TEXT;
document.getElementById("title-sub").textContent = TITLE_SUB;
document.getElementById("intro-box").innerHTML = colorize(
  "<h2>【遊戲背景】</h2>" + INTRO_STORY.map(t => `<p>${t}</p>`).join("") +
  "<h2>【基本玩法】</h2><ul>" + INTRO_RULES.map(t => `<li>${t}</li>`).join("") + "</ul>");

// 轉場：黑幕淡入＋掃描線 → 切換畫面 → 黑幕淡出、新畫面淡入
function showScreen(target, beforeShow) {
  if (transitioning) return;
  transitioning = true;
  $fade.classList.add("on");
  setTimeout(() => {
    [$title, $intro, $game].forEach(el => el.classList.add("hidden"));
    if (beforeShow) beforeShow();
    target.classList.remove("hidden");
    target.classList.remove("enter");
    void target.offsetWidth; // 重新觸發動畫
    target.classList.add("enter");
    $fade.classList.remove("on");
    setTimeout(() => { transitioning = false; }, FADE_MS);
  }, Math.max(FADE_MS, SCAN_MS));
}

function goTitle() { showScreen($title); }
function goIntro() { showScreen($intro, () => { document.getElementById("intro-box").scrollTop = 0; }); }
function goGame()  { showScreen($game, () => { newGame(); playStartText(); }); }

document.getElementById("btn-start").onclick = goGame;
document.getElementById("btn-intro").onclick = goIntro;
document.getElementById("btn-back").onclick = goTitle;
document.getElementById("btn-intro-start").onclick = goGame;
