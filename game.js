/* =========================================================
   遊戲核心狀態與邏輯 (game.js)
   包含：1–5 層 6 回合抽取庫、物/魔雙攻防、三系怪物與渾沌破綻、文字化演繹
   ========================================================= */
let hero, floor, round, turn, floorDeck, enemy, gameOver;

const $status = document.getElementById("status");
const $log = document.getElementById("log");
const $choices = document.getElementById("choices");

/* ===== 小工具 ===== */
function escapeHtml(t) {
  return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const NAME_REGEX = new RegExp(
  "(勇者)|(" + Object.keys(ENEMY_COLORS).sort((a, b) => b.length - a.length).join("|") + ")", "g"
);

function colorize(html) {
  return html.replace(NAME_REGEX, (m, isHero) => {
    if (isHero) return `<span class="name" style="color:${HERO_COLOR}">${m}</span>`;
    const isBoss = m === "文字魔王" ? " name-boss" : "";
    return `<span class="name${isBoss}" style="color:${ENEMY_COLORS[m] || "#ff5c5c"}">${m}</span>`;
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

// 格式化單件裝備顯示文字
function itemText(item) {
  if (!item) return "無";
  if (item.slot === "physWeapon") return `${item.name}（物攻+${item.physAtk}）`;
  if (item.slot === "magWeapon") return `${item.name}（魔攻+${item.magAtk}）`;
  if (item.slot === "armor") return `${item.name}（物防+${item.physDef}／魔防+${item.magDef}）`;
  if (item.slot === "shield") return `${item.name}（護盾+${item.shield}）`;
  return item.name;
}

// 從基礎數值與 4 格裝備計算實際雙攻、雙防與護盾
function calcStats(base, equip) {
  return {
    physAtk: (base.physAtk || 0) + (equip.physWeapon ? equip.physWeapon.physAtk : 0),
    magAtk: (base.magAtk || 0) + (equip.magWeapon ? equip.magWeapon.magAtk : 0),
    physDef: (base.physDef || 0) + (equip.armor ? equip.armor.physDef : 0),
    magDef: (base.magDef || 0) + (equip.armor ? equip.armor.magDef : 0),
    shield: (base.shield || 0) + (equip.shield ? equip.shield.shield : 0),
  };
}

function getFloorInfo(fl) {
  return FLOORS.find(f => f.floor === fl) || { floor: fl, name: `第 ${fl} 層`, desc: "" };
}

function cardTypeName(type) {
  if (type === "monster") return "打鬥牌";
  if (type === "camp") return "回復牌";
  if (type === "skill_camp") return "技能牌(暫代回復)";
  return "事件牌";
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
  const fInfo = getFloorInfo(floor);
  const deckText = floorDeck && floorDeck.length > 0
    ? floorDeck.map(c => cardTypeName(c.type)).join("、")
    : (round === ROUNDS_PER_FLOOR ? (floor < MAX_FLOOR ? "【傳送門 + 寶箱】" : "【終局魔王戰】") : "無");

  let html = `
    <div class="title">勇者　第 ${floor} 層【${fInfo.name}】　第 ${round} / ${ROUNDS_PER_FLOOR} 回合</div>
    <div>生命：${Math.max(0, hero.hp)} / ${hero.maxHp}</div>
    <div>護盾：${curShield} / ${s.shield}</div>
    <div>物攻：${s.physAtk}　魔攻：${s.magAtk}</div>
    <div>物防：${s.physDef}　魔防：${s.magDef}</div>
    <div class="full">物理武器：${itemText(hero.equip.physWeapon)}</div>
    <div class="full">魔法武器：${itemText(hero.equip.magWeapon)}</div>
    <div class="full">裝甲：${itemText(hero.equip.armor)}</div>
    <div class="full">盾牌：${itemText(hero.equip.shield)}</div>
    <div class="full dim">本層抽取庫剩餘（${floorDeck ? floorDeck.length : 0} 張）：${deckText}</div>`;

  if (enemy) {
    const weakNote = enemy.weakness === "phys"
      ? "［破綻：物防減半］"
      : (enemy.weakness === "mag" ? "［破綻：魔防減半］" : "");
    const atkSummary = enemy.type === "phys"
      ? `物攻 ${enemy.physAtk}`
      : (enemy.type === "mag" ? `魔攻 ${enemy.magAtk}` : `物攻 ${enemy.physAtk}／魔攻 ${enemy.magAtk}`);
    html += `<div class="full enemy-bar">── 敵人：${enemy.name}${weakNote}　生命 ${Math.max(0, enemy.hp)} / ${enemy.maxHp}　護盾 ${enemy.shield}　${atkSummary}　物防 ${enemy.curPhysDef}　魔防 ${enemy.curMagDef}</div>`;
  }
  $status.innerHTML = colorize(html);
}

/* ===== 擲骰與戰鬥效果動畫 ===== */
const $dice = document.getElementById("dice");
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

async function storyBg(from, to, ms) {
  const $s = document.getElementById("story");
  const a = $s.animate([{ backgroundColor: `rgba(0,0,0,${from})` }, { backgroundColor: `rgba(0,0,0,${to})` }],
    { duration: ms, easing: "ease-in-out", fill: "forwards" });
  await a.finished;
}

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
   1–5 層抽取庫與爬塔流程
   ========================================================= */

// 建立單層的 5 張牌抽取庫（4 張固定牌 + 1 張隨機牌）
function buildFloorDeck(fl) {
  const rawTypes = [...FIXED_FLOOR_CARDS, randomPick(RANDOM_FIFTH_POOL)];
  const monsters = FLOOR_MONSTERS[fl] || FLOOR_MONSTERS[1];
  return rawTypes.map((type, idx) => {
    if (type === "monster") {
      const m = weightedPick(monsters);
      return {
        id: `fl${fl}_card${idx}_${Math.random()}`,
        type: "monster",
        monster: m,
        label: `【打鬥牌】遭遇${m.name}，迎戰`,
      };
    } else if (type === "camp") {
      return {
        id: `fl${fl}_card${idx}_${Math.random()}`,
        type: "camp",
        label: "【回復牌】在營地生火休息，生命回滿",
      };
    } else {
      return {
        id: `fl${fl}_card${idx}_${Math.random()}`,
        type: "skill_camp",
        label: "【技能牌（暫代：回復）】在殘頁篝火旁調息，生命回滿",
      };
    }
  });
}

// 從當前樓層抽取庫隨機抽取 count 張不重複的牌
function drawFromDeck(deck, count) {
  const indices = deck.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, Math.min(count, deck.length)).map(i => deck[i]);
}

function newGame() {
  hero = {
    hp: HERO_BASE.hp,
    maxHp: HERO_BASE.hp,
    shield: 0,
    equip: { physWeapon: null, magWeapon: null, armor: null, shield: null },
  };
  floor = 1;
  round = 1;
  turn = 1;
  enemy = null;
  gameOver = false;
  floorDeck = buildFloorDeck(floor);

  $log.innerHTML = "";
  log("【勇者與魔王】", "big");
  log("你踏入被文字魔王侵蝕的領域。每層共有 6 個回合，擊敗怪物穿戴文字裝備，邁向第五層的原典王座。");
  const fInfo = getFloorInfo(floor);
  log(`── 進入第 ${floor} 層【${fInfo.name}】：${fInfo.desc}`, "big");
  presentRound();
}

// 顯示當前樓層與回合的選項
function presentRound() {
  enemy = null;
  renderStatus();
  sep();
  const fInfo = getFloorInfo(floor);
  log(`第 ${floor} 層【${fInfo.name}】— 第 ${round} / ${ROUNDS_PER_FLOOR} 回合（總第 ${turn} 回合）。`);

  // 第 6 回合：第 1–4 層為【傳送門 + 寶箱】；第 5 層為【終局魔王戰】
  if (round === ROUNDS_PER_FLOOR) {
    if (floor < MAX_FLOOR) {
      log("前方浮現通往下一層的文字傳送門，門前擺放著一個散發微光的跨層寶箱。", "big");
      setChoices([
        {
          label: `【傳送門 + 寶箱】開啟第 ${floor} 層跨層寶箱並前往第 ${floor + 1} 層`,
          action: () => {
            turn++;
            openFloorChest();
          },
        },
      ]);
    } else {
      log("空氣突然變得沉重……王座上的鎖鏈寸寸斷裂，文字魔王緩緩抬起頭。", "big");
      setChoices([]);
      bossAppearAnim().then(() => {
        setChoices([
          {
            label: `【魔王】${BOSS.fullTitle}出現了，無法逃避，迎戰`,
            action: () => {
              turn++;
              startBattle(BOSS);
            },
          },
        ]);
      });
    }
    return;
  }

  // 第 1–5 回合：從本層抽取庫隨機抽取 2 張牌（第 5 回合只剩 1 張牌）
  const drawn = drawFromDeck(floorDeck, 2);
  if (drawn.length > 1) {
    log(`從本層抽取庫（剩餘 ${floorDeck.length} 張）隨機抽出 2 張牌，請選擇一張前進（選中後該牌會從抽取庫消失）：`);
  } else {
    log("本層抽取庫只剩下最後 1 張牌：");
  }

  setChoices(
    drawn.map(card => ({
      label: card.label,
      action: () => selectCard(card),
    }))
  );
}

// 玩家選擇一張牌後，將該張牌從抽取庫移除並執行
function selectCard(card) {
  const idx = floorDeck.findIndex(c => c.id === card.id);
  if (idx !== -1) floorDeck.splice(idx, 1);
  turn++;

  if (card.type === "monster") {
    startBattle(card.monster);
  } else if (card.type === "camp") {
    camp(false);
  } else {
    camp(true);
  }
}

// 完成當前事件後推進到下一回合
function advanceAfterEvent() {
  round++;
  presentRound();
}

/* ===== 營地回復（含暫代技能牌的回復） ===== */
function camp(isSkillPlaceholder) {
  const healed = hero.maxHp - hero.hp;
  hero.hp = hero.maxHp;
  if (isSkillPlaceholder) {
    log(`【技能牌（暫以回復代替）】你在殘頁篝火旁靜心調息。生命回復 ${healed} 點，現在是 ${hero.hp} / ${hero.maxHp}。`);
  } else {
    log(`你在營地生火休息。生命回復 ${healed} 點，現在是 ${hero.hp} / ${hero.maxHp}。`);
  }
  renderStatus();
  setChoices([{ label: "繼續前進", action: advanceAfterEvent }]);
}

/* ===== 第 6 回合：跨層寶箱與傳送門推進 ===== */
function openFloorChest() {
  const pool = FLOOR_CHEST_ITEMS[floor] || FLOOR_CHEST_ITEMS[1];
  const item = randomPick(pool);
  log(`你打開了第 ${floor} 層的跨層寶箱，從 4 件秘寶中抽出了${SLOT_NAME[item.slot]}：${itemText(item)}！`, "big");
  offerItem(item, enterNextFloorPortal);
}

function enterNextFloorPortal() {
  floor++;
  round = 1;
  floorDeck = buildFloorDeck(floor);
  hero.maxHp += FLOOR_HP_BONUS;
  hero.hp = Math.min(hero.maxHp, hero.hp + FLOOR_HP_BONUS);
  const fInfo = getFloorInfo(floor);
  sep();
  log(`你踏入傳送門，成功抵達第 ${floor} 層【${fInfo.name}】！`, "big");
  log(`跨層祝福發動：勇者最大生命 +${FLOOR_HP_BONUS}，並回復 ${FLOOR_HP_BONUS} 點生命（目前生命 ${hero.hp} / ${hero.maxHp}）。`, "hit");
  log(`【${fInfo.name}】${fInfo.desc}`);
  presentRound();
}

/* ===== 拾取裝備（替換同部位 + 身體文字化演繹） ===== */
function offerItem(item, onDone) {
  const old = hero.equip[item.slot];
  log(`目前的${SLOT_NAME[item.slot]}：${itemText(old)}。`, "dim");
  renderStatus();
  setChoices([
    {
      label: old ? `拾取 ${item.name}（替換掉 ${old.name}）` : `拾取 ${item.name}`,
      action: () => {
        hero.equip[item.slot] = item;
        log(`你裝備了 ${itemText(item)}。`);
        if (item.textDesc) {
          log(`「${item.textDesc}」`, "text-curse");
        } else {
          log(`「${SLOT_NAME[item.slot]}部位變爲文字了.....但是獲得了更強的力量。」`, "text-curse");
        }
        renderStatus();
        onDone();
      },
    },
    {
      label: "不要，保留現有裝備",
      action: () => {
        log(`你放棄了 ${item.name}。`);
        onDone();
      },
    },
  ]);
}

/* =========================================================
   戰鬥系統（雙武器切換、雙防禦結算、渾沌怪動態弱點）
   ========================================================= */

// 更新渾沌怪每回合動態排斥弱點（隨機物防減半或魔防減半）
function refreshChaosWeakness(announce) {
  if (!enemy || enemy.type !== "chaos") return;
  enemy.weakness = Math.random() < 0.5 ? "phys" : "mag";
  if (enemy.weakness === "phys") {
    enemy.curPhysDef = Math.floor(enemy.physDef / 2);
    enemy.curMagDef = enemy.magDef;
    if (announce) {
      log(`【破綻】${enemy.name}體內的文字結構劇烈排斥，本回合「物理防禦」減半（${enemy.physDef} → ${enemy.curPhysDef}）！`, "hit");
    }
  } else {
    enemy.curPhysDef = enemy.physDef;
    enemy.curMagDef = Math.floor(enemy.magDef / 2);
    if (announce) {
      log(`【破綻】${enemy.name}體內的文字結構劇烈排斥，本回合「魔法防禦」減半（${enemy.magDef} → ${enemy.curMagDef}）！`, "hit");
    }
  }
}

function showCombatButtons() {
  if (!enemy || hero.hp <= 0) return;
  const s = calcStats(HERO_BASE, hero.equip);
  const wPhys = hero.equip.physWeapon ? hero.equip.physWeapon.name : "徒手";
  const wMag = hero.equip.magWeapon ? hero.equip.magWeapon.name : "基礎魔力";
  setChoices([
    {
      label: `【物理攻擊】使用${wPhys}（物攻 ${s.physAtk} vs 敵物防 ${enemy.curPhysDef}）`,
      action: () => heroAttack("phys"),
    },
    {
      label: `【魔法攻擊】使用${wMag}（魔攻 ${s.magAtk} vs 敵魔防 ${enemy.curMagDef}）`,
      action: () => heroAttack("mag"),
    },
  ]);
}

async function startBattle(template) {
  const equip = { physWeapon: null, magWeapon: null, armor: null, shield: null };
  template.items.forEach(it => { equip[it.slot] = it; });
  const st = calcStats({ physAtk: 0, magAtk: 0, physDef: 0, magDef: 0, shield: 0 }, equip);

  enemy = {
    name: template.name,
    type: template.type || "phys",
    typeLabel: template.typeLabel || "怪物",
    isBoss: !!template.isBoss,
    hp: template.hp,
    maxHp: template.hp,
    physAtk: st.physAtk,
    magAtk: st.magAtk,
    physDef: st.physDef,
    magDef: st.magDef,
    curPhysDef: st.physDef,
    curMagDef: st.magDef,
    shield: st.shield,
    weakness: null,
    items: template.items,
  };

  // 護盾每場戰鬥開始時刷新
  hero.shield = calcStats(HERO_BASE, hero.equip).shield;
  setChoices([]);
  renderStatus();

  const atkDesc = enemy.type === "phys"
    ? `物攻 ${enemy.physAtk}`
    : (enemy.type === "mag" ? `魔攻 ${enemy.magAtk}` : `物攻 ${enemy.physAtk}／魔攻 ${enemy.magAtk}`);
  log(`戰鬥開始！對手是${enemy.name}（生命 ${enemy.hp}、${atkDesc}、物防 ${enemy.physDef}、魔防 ${enemy.magDef}、護盾 ${enemy.shield}）。`, "big");

  if (enemy.type === "chaos") {
    refreshChaosWeakness(true);
  }
  renderStatus();

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
  showCombatButtons();
}

// 計算並套用傷害：先扣護盾，再扣生命
function dealDamage(attackerName, atkType, atk, def, target, targetName, dice) {
  const atkLabel = atkType === "mag" ? "魔法攻擊" : "物理攻擊";
  const defLabel = atkType === "mag" ? "魔防" : "物防";
  const dmg = Math.max(0, atk + dice - def);
  const toShield = Math.min(target.shield, dmg);
  const toHp = dmg - toShield;
  target.shield -= toShield;
  target.hp -= toHp;

  let msg = `${attackerName}發動${atkLabel}：${atk} + 骰子 ${dice} − ${defLabel} ${def} = ${dmg} 傷害`;
  if (dmg > 0) {
    const parts = [];
    if (toShield > 0) parts.push(`護盾 −${toShield}`);
    if (toHp > 0) parts.push(`生命 −${toHp}`);
    msg += `（${parts.join("，")}）`;
  }
  msg += `。${targetName}剩下生命 ${Math.max(0, target.hp)}、護盾 ${target.shield}。`;
  return msg;
}

async function heroAttack(atkType) {
  setChoices([]); // 動畫期間鎖定按鈕
  const s = calcStats(HERO_BASE, hero.equip);
  const isMag = atkType === "mag";
  const atkVal = isMag ? s.magAtk : s.physAtk;
  const defVal = isMag ? enemy.curMagDef : enemy.curPhysDef;
  const labelNote = isMag
    ? `魔攻 ${atkVal} + 骰子 − 魔防 ${defVal}`
    : `物攻 ${atkVal} + 骰子 − 物防 ${defVal}`;

  const dice = rollD20();
  await rollDiceAnim("勇者", HERO_COLOR, dice, labelNote);
  await swordAnim();

  const heroTarget = { shield: enemy.shield, hp: enemy.hp };
  log(dealDamage("勇者", atkType, atkVal, defVal, heroTarget, enemy.name, dice), "hit");
  enemy.shield = heroTarget.shield;
  enemy.hp = heroTarget.hp;
  renderStatus();

  if (enemy.hp <= 0) return winBattle();

  await enemyAttack();
  if (hero.hp <= 0) return;

  // 渾沌怪每回合結束後動態切換排斥弱點
  if (enemy.type === "chaos") {
    refreshChaosWeakness(true);
  }
  renderStatus();
  showCombatButtons();
}

async function enemyAttack() {
  const s = calcStats(HERO_BASE, hero.equip);
  let atkType = "phys";
  if (enemy.type === "mag") {
    atkType = "mag";
  } else if (enemy.type === "chaos") {
    atkType = Math.random() < 0.5 ? "phys" : "mag";
  }

  const isMag = atkType === "mag";
  const atkVal = isMag ? enemy.magAtk : enemy.physAtk;
  const defVal = isMag ? s.magDef : s.physDef;
  const labelNote = isMag
    ? `魔法攻擊 ${atkVal} + 骰子 − 勇者魔防 ${defVal}`
    : `物理攻擊 ${atkVal} + 骰子 − 勇者物防 ${defVal}`;

  const dice = rollD20();
  await rollDiceAnim(enemy.name, ENEMY_COLORS[enemy.name], dice, labelNote);

  const target = { shield: hero.shield, hp: hero.hp };
  const hpBefore = hero.hp;
  log(dealDamage(enemy.name, atkType, atkVal, defVal, target, "勇者", dice), "hurt");
  hero.shield = target.shield;
  hero.hp = target.hp;
  renderStatus();

  await heroHitAnim(hero.hp < hpBefore);
  if (hero.hp <= 0) loseGame();
}

function winBattle() {
  if (enemy.isBoss) {
    log("文字魔王倒下了！束縛大地的文字詛咒隨之瓦解，萬物重新恢復了血肉與生機。", "big");
    log(`【勝利】你成功突破全部 ${MAX_FLOOR} 層，討伐了文字魔王！`, "big");
    enemy = null;
    renderStatus();
    setChoices([
      { label: "再玩一次", action: () => { newGame(); playStartText(); } },
      { label: "返回標題畫面", action: goTitle },
    ]);
    return;
  }
  log(`你打倒了${enemy.name}！`, "big");
  const drop = randomPick(enemy.items);
  log(`${enemy.name}掉落了一件${SLOT_NAME[drop.slot]}：${itemText(drop)}。`);
  enemy = null;
  offerItem(drop, advanceAfterEvent);
}

function loseGame() {
  gameOver = true;
  hero.hp = 0;
  log(`勇者倒下了……被${enemy.name}擊敗，意識逐漸被冰冷的文字吞噬。`, "big");
  log(`【遊戲結束】止步於第 ${floor} 層第 ${round} 回合。`, "big");
  enemy = null;
  renderStatus();
  setChoices([]);
  playDefeatText();
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
  "<h2>【基本玩法】</h2><ul>" + INTRO_RULES.map(t => `<li>${t}</li>`).join("") + "</ul>"
);

function showScreen(target, beforeShow) {
  if (transitioning) return;
  transitioning = true;
  $fade.classList.add("on");
  setTimeout(() => {
    [$title, $intro, $game].forEach(el => el.classList.add("hidden"));
    if (beforeShow) beforeShow();
    target.classList.remove("hidden");
    target.classList.remove("enter");
    void target.offsetWidth;
    target.classList.add("enter");
    $fade.classList.remove("on");
    setTimeout(() => { transitioning = false; }, FADE_MS);
  }, Math.max(FADE_MS, SCAN_MS));
}

function goTitle() { showScreen($title); }
function goIntro() { showScreen($intro, () => { document.getElementById("intro-box").scrollTop = 0; }); }
function goGame() { showScreen($game, () => { newGame(); playStartText(); }); }

document.getElementById("btn-start").onclick = goGame;
document.getElementById("btn-intro").onclick = goIntro;
document.getElementById("btn-back").onclick = goTitle;
document.getElementById("btn-intro-start").onclick = goGame;
