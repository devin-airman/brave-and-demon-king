/* =========================================================
   遊戲核心狀態與邏輯 (game.js - 第六版 v6 雙模式與終局魔王平衡更新)
   包含：1–5 層 6 回合爬塔、物/魔雙攻防、可收合 5 格裝備抽屜、
   勇者與敵人生命/護盾雙動態條與外框微光、頂部拉下／底部收回戰鬥對話框、
   無前綴雙行戰報、歷史對話視窗、雙模式（骰子／撲克）專屬穿盾與花色機制、
   一階段魔王掙扎／暴走（擊敗前保密前勇者身分）、勇者之劍殘魂燃燒、
   二階段心魔戰（半血前保密真名只顯示 @$+%^&¥，半血後顯露真名文字.沙坦）
   ========================================================= */
let hero, floor, round, turn, floorDeck, enemy, gameOver;
let gameMode = "dice"; // "dice" (0–20 骰子模式) 或 "poker" (1–13 撲克模式)
let lastDrawnCard = null; // 紀錄最近一次抽出的撲克牌資訊
let equipExpanded = false; // 頂部裝備抽屜展開狀態
let isBattleDrawerActive = false; // 是否正在拉下的戰鬥對話框中輸出
let historyLogs = []; // 歷史對話紀錄（包含一般對話、戰鬥標題、戰鬥對話與雙行戰報）

const $status = document.getElementById("status");
const $enemyPanel = document.getElementById("enemy-panel");
const $dialogueStage = document.getElementById("dialogue-stage");
const $log = document.getElementById("log");
const $battleIntroOverlay = document.getElementById("battle-intro-overlay");
const $battleDrawer = document.getElementById("battle-drawer");
const $battleDrawerTitle = document.getElementById("battle-drawer-title");
const $battleLog = document.getElementById("battle-log");
const $choices = document.getElementById("choices");
const $historyModal = document.getElementById("history-modal");
const $historyContent = document.getElementById("history-content");

/* ===== 小工具 ===== */
function escapeHtml(t) {
  return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildNameRegex() {
  const escapedKeys = Object.keys(ENEMY_COLORS)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const htmlEscapedHidden = escapeRegExp(escapeHtml(PHASE2_BOSS_HIDDEN_NAME));
  if (!escapedKeys.includes(htmlEscapedHidden)) {
    escapedKeys.push(htmlEscapedHidden);
  }
  return new RegExp("(勇者)|(" + escapedKeys.join("|") + ")", "g");
}

const NAME_REGEX = buildNameRegex();

function colorize(html) {
  return html.replace(NAME_REGEX, (m, isHero) => {
    if (isHero) return `<span class="name" style="color:${HERO_COLOR}">${m}</span>`;
    const rawKey = m.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    const isBoss = (rawKey === "文字魔王" || rawKey === PHASE2_BOSS_HIDDEN_NAME || rawKey === PHASE2_BOSS_TRUE_NAME || rawKey === "真魔王")
      ? " name-boss"
      : "";
    return `<span class="name${isBoss}" style="color:${ENEMY_COLORS[rawKey] || "#ff5c5c"}">${m}</span>`;
  });
}

// 將 #rrggbb 色碼轉為 rgba 字串，供敵人對戰卡外框微光使用
function hexToRgba(hex, alpha) {
  const clean = String(hex || "#ff5c5c").replace("#", "");
  if (clean.length !== 6) return `rgba(255, 92, 92, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rollD20() { return Math.floor(Math.random() * 21); } // 0–20

// 從 52 張標準撲克牌（4 花色 × 13 點數，不含鬼牌）隨機洗抽 1 張
function drawPokerCard() {
  const suit = POKER_SUITS[Math.floor(Math.random() * POKER_SUITS.length)];
  const rankObj = POKER_RANKS[Math.floor(Math.random() * POKER_RANKS.length)];
  return {
    suit,
    rank: rankObj.rank,
    value: rankObj.value,
    label: `${suit.symbol}${rankObj.rank}`,
    fullLabel: `${suit.name}${suit.symbol}${rankObj.rank}`,
  };
}

// 宮廷人頭牌 (J=騎士、Q=皇后、K=國王) 向量圖騰
function getCourtSvg(rank) {
  if (rank === "J") {
    return `<svg viewBox="0 0 60 90" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 22 L30 10 L42 22 L38 40 L22 40 Z" fill="currentColor" fill-opacity="0.12"/><path d="M22 28 H38 M30 10 V40"/><path d="M14 58 C14 46, 46 46, 46 58 L50 74 H10 Z" fill="currentColor" fill-opacity="0.18"/><path d="M46 14 L46 76 M46 18 L54 24 L46 30"/><circle cx="30" cy="56" r="3" fill="currentColor"/></svg>`;
  }
  if (rank === "Q") {
    return `<svg viewBox="0 0 60 90" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 28 L20 14 L30 24 L40 14 L46 28 Z" fill="currentColor" fill-opacity="0.22"/><circle cx="20" cy="11" r="2" fill="currentColor"/><circle cx="30" cy="10" r="2.5" fill="currentColor"/><circle cx="40" cy="11" r="2" fill="currentColor"/><circle cx="30" cy="39" r="9" fill="currentColor" fill-opacity="0.1"/><path d="M13 74 C15 54, 45 54, 47 74 Z" fill="currentColor" fill-opacity="0.18"/><path d="M22 54 L30 64 L38 54"/><circle cx="47" cy="44" r="4.5" fill="currentColor" fill-opacity="0.25"/><path d="M47 49 V72"/></svg>`;
  }
  return `<svg viewBox="0 0 60 90" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 28 L16 12 L25 22 L30 10 L35 22 L44 12 L48 28 Z" fill="currentColor" fill-opacity="0.25"/><path d="M30 5 V10 M27 7 H33"/><rect x="19" y="30" width="22" height="16" rx="4" fill="currentColor" fill-opacity="0.1"/><path d="M23 42 L30 48 L37 42"/><path d="M11 75 C13 52, 47 52, 49 75 Z" fill="currentColor" fill-opacity="0.2"/><path d="M16 18 L44 72 M12 24 L22 16"/><circle cx="30" cy="60" r="3" fill="currentColor"/></svg>`;
}

function renderCardBackHtml() {
  return `<div class="poker-card-back"><div class="card-back-inner"><div class="card-back-emblem"><span>勇✦魔</span></div></div></div>`;
}

function renderPokerCardHtml(card) {
  const val = card.value;
  const r = card.rank;
  const s = card.suit.symbol;
  let centerContent = "";
  if (val === 1) {
    centerContent = `<div class="pip-ace">${s}</div>`;
  } else if (val >= 2 && val <= 10) {
    const coords = POKER_PIP_LAYOUTS[val] || [];
    const denseClass = val >= 9 ? "dense" : "";
    const pipsHtml = coords.map(([x, y, inv]) =>
      `<span class="pip${inv ? " inv" : ""}" style="left:${x}%; top:${y}%;">${s}</span>`
    ).join("");
    centerContent = `<div class="pip-grid ${denseClass}">${pipsHtml}</div>`;
  } else {
    centerContent = `<div class="court-box"><span class="court-suit-tl">${s}</span>${getCourtSvg(r)}<span class="court-watermark">${r}=${val}</span><span class="court-suit-br">${s}</span></div>`;
  }
  return `<div class="poker-card ${card.suit.colorClass}"><div class="card-corner top-left"><span class="corner-rank">${r}</span><span class="corner-suit">${s}</span></div><div class="card-center">${centerContent}</div><div class="card-corner bottom-right"><span class="corner-rank">${r}</span><span class="corner-suit">${s}</span></div></div>`;
}

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
  if (item.slot === "accessory") {
    if (item.isHeroSword) {
      const blocks = item.blocksLeft > 0 ? `殘魂擋死剩餘 ${item.blocksLeft} 次` : "殘魂已消逝";
      const multStr = item.atkMult > 1 ? `攻擊×${item.atkMult}／` : "攻擊加成已消逝／";
      return `${item.name}（${multStr}${blocks}）`;
    }
    return item.desc ? `${item.name}（${item.desc}）` : item.name;
  }
  return item.name;
}

// 從基礎數值與裝備計算實際雙攻、雙防與護盾
// 註：allowAccessory = true 時計算飾品【勇者之劍】的未計算前攻擊力倍率加成；二階段複製時設為 false
function calcStats(base, equip, allowAccessory = true) {
  let physAtk = (base.physAtk || 0) + (equip.physWeapon ? equip.physWeapon.physAtk : 0);
  let magAtk = (base.magAtk || 0) + (equip.magWeapon ? equip.magWeapon.magAtk : 0);
  const physDef = (base.physDef || 0) + (equip.armor ? equip.armor.physDef : 0);
  const magDef = (base.magDef || 0) + (equip.armor ? equip.armor.magDef : 0);
  const shield = (base.shield || 0) + (equip.shield ? equip.shield.shield : 0);

  if (allowAccessory && equip.accessory && equip.accessory.atkMult && equip.accessory.atkMult > 1) {
    physAtk = Math.floor(physAtk * equip.accessory.atkMult);
    magAtk = Math.floor(magAtk * equip.accessory.atkMult);
  }
  return { physAtk, magAtk, physDef, magDef, shield };
}

// 檢查勇者是否全程未穿戴任何文字裝備（完全徒手／初始狀態）
function isCompletelyUnarmed() {
  if (!hero || !hero.equip) return false;
  return !hero.equip.physWeapon && !hero.equip.magWeapon && !hero.equip.armor && !hero.equip.shield;
}

function getFloorInfo(fl) {
  return FLOORS.find(f => f.floor === fl) || { floor: fl, name: `第 ${fl} 層`, desc: "" };
}

/* ===== 畫面輸出（一般對話框 + 戰鬥拉簾對話框 + 歷史對話紀錄） ===== */
function log(text, cls) {
  const html = colorize(escapeHtml(text));
  const p = document.createElement("p");
  p.innerHTML = html;
  if (cls) p.className = cls;

  const targetBox = (isBattleDrawerActive && $battleLog) ? $battleLog : $log;
  targetBox.appendChild(p);
  targetBox.scrollTop = targetBox.scrollHeight;

  historyLogs.push({
    kind: isBattleDrawerActive ? "battle" : "general",
    html,
    cls: cls || "",
  });
}

function sep() { log("────────────────────────", "sep"); }

// 雙行戰報輸出（第 1 行：招式與總傷害結果；第 2 行：無「└ 算式：」前綴之純算式）
function logCombatReport(isHero, mainText, formulaText) {
  const mainHtml = colorize(escapeHtml(mainText));
  const formulaHtml = colorize(escapeHtml(formulaText));
  const div = document.createElement("div");
  div.className = "combat-report" + (isHero ? "" : " enemy-atk");
  div.innerHTML = `<div class="line-main">${mainHtml}</div><div class="line-formula">${formulaHtml}</div>`;

  const targetBox = (isBattleDrawerActive && $battleLog) ? $battleLog : $log;
  targetBox.appendChild(div);
  targetBox.scrollTop = targetBox.scrollHeight;

  historyLogs.push({
    kind: "combat_report",
    isHero,
    mainHtml,
    formulaHtml,
  });
}

function openHistoryModal() {
  if (!$historyModal || !$historyContent) return;
  $historyContent.innerHTML = "";
  if (historyLogs.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.className = "dim";
    emptyP.textContent = "目前尚無歷史對話紀錄。";
    $historyContent.appendChild(emptyP);
  } else {
    historyLogs.forEach(entry => {
      if (entry.kind === "battle_header") {
        const h = document.createElement("div");
        h.className = "history-battle-header";
        h.innerHTML = colorize(escapeHtml(entry.title));
        $historyContent.appendChild(h);
      } else if (entry.kind === "combat_report") {
        const div = document.createElement("div");
        div.className = "combat-report" + (entry.isHero ? "" : " enemy-atk");
        div.innerHTML = `<div class="line-main">${entry.mainHtml}</div><div class="line-formula">${entry.formulaHtml}</div>`;
        $historyContent.appendChild(div);
      } else {
        const p = document.createElement("p");
        if (entry.cls) p.className = entry.cls;
        p.innerHTML = entry.html;
        $historyContent.appendChild(p);
      }
    });
  }
  $historyModal.classList.remove("hidden");
  $historyContent.scrollTop = $historyContent.scrollHeight;
}

function closeHistoryModal() {
  if ($historyModal) $historyModal.classList.add("hidden");
}

const $btnCloseHistory = document.getElementById("btn-close-history");
if ($btnCloseHistory) {
  $btnCloseHistory.onclick = closeHistoryModal;
}
if ($historyModal) {
  $historyModal.addEventListener("click", e => {
    if (e.target === $historyModal) closeHistoryModal();
  });
}

function setChoices(list) {
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  $choices.innerHTML = "";
  list.forEach(({ label, action }) => {
    const b = document.createElement("button");
    b.innerHTML = colorize(escapeHtml(label));
    b.onclick = () => {
      b.blur();
      action();
    };
    $choices.appendChild(b);
  });
}

// 渲染第 1 部分（頂部勇者資訊欄）與第 2 部分（獨立 3 行敵人對戰卡）
function renderStatus() {
  const s = calcStats(HERO_BASE, hero.equip, true);
  const curShield = enemy ? hero.shield : s.shield;
  const maxShield = s.shield;
  const hpCur = Math.max(0, hero.hp);
  const hpPct = hero.maxHp > 0 ? Math.max(0, Math.min(100, (hpCur / hero.maxHp) * 100)) : 0;
  const shPct = maxShield > 0 ? Math.max(0, Math.min(100, (Math.max(0, curShield) / maxShield) * 100)) : 0;

  const fInfo = getFloorInfo(floor);
  const modeTag = gameMode === "poker" ? "［撲克模式］" : "［骰子模式］";
  const stageTitle = (enemy && enemy.isPhase2Boss)
    ? `勇者${modeTag}　精神世界【心魔決戰】`
    : `勇者${modeTag}　第 ${floor} 層【${fInfo.name}】　第 ${round} / ${ROUNDS_PER_FLOOR} 回合`;

  const equipBtnLabel = equipExpanded ? "裝備 ▲" : "裝備 ▼";
  const equipBtnActive = equipExpanded ? " active" : "";
  const drawerHidden = equipExpanded ? "" : " hidden";

  const statusHtml = `
    <div class="panel-row-top">
      <div class="panel-title">${colorize(escapeHtml(stageTitle))}</div>
      <div class="header-actions">
        <button type="button" class="mini-btn${equipBtnActive}" id="btn-toggle-equip">${equipBtnLabel}</button>
        <button type="button" class="mini-btn" id="btn-open-history">歷史對話</button>
      </div>
    </div>
    <div class="bars-row">
      <div class="stat-bar-group">
        <span class="stat-label">生命</span>
        <div class="bar-track"><div class="bar-fill hp-hero" style="width:${hpPct}%"></div></div>
        <span class="stat-num">${hpCur} / ${hero.maxHp}</span>
      </div>
      <div class="stat-bar-group">
        <span class="stat-label">護盾</span>
        <div class="bar-track"><div class="bar-fill shield-fill" style="width:${shPct}%"></div></div>
        <span class="stat-num">${Math.max(0, curShield)} / ${maxShield}</span>
      </div>
    </div>
    <div class="stats-quad-row">
      <div class="stat-cell">物攻 <span class="val">${s.physAtk}</span></div>
      <div class="stat-cell">魔攻 <span class="val">${s.magAtk}</span></div>
      <div class="stat-cell">物防 <span class="val">${s.physDef}</span></div>
      <div class="stat-cell">魔防 <span class="val">${s.magDef}</span></div>
    </div>
    <div id="equip-drawer" class="${drawerHidden.trim()}">
      <div>物理武器：${escapeHtml(itemText(hero.equip.physWeapon))}</div>
      <div>魔法武器：${escapeHtml(itemText(hero.equip.magWeapon))}</div>
      <div>裝甲：${escapeHtml(itemText(hero.equip.armor))}</div>
      <div>盾牌：${escapeHtml(itemText(hero.equip.shield))}</div>
      <div>飾品：${escapeHtml(itemText(hero.equip.accessory))}</div>
    </div>`;

  $status.innerHTML = statusHtml;

  const $btnEquip = document.getElementById("btn-toggle-equip");
  if ($btnEquip) {
    $btnEquip.onclick = () => {
      equipExpanded = !equipExpanded;
      renderStatus();
    };
  }
  const $btnHist = document.getElementById("btn-open-history");
  if ($btnHist) {
    $btnHist.onclick = openHistoryModal;
  }

  // 第 2 部分：獨立 3 行「敵人對戰卡」（依敵人名字顏色變換外框微光）
  if (enemy && $enemyPanel) {
    const eColor = ENEMY_COLORS[enemy.name] || "#ff5c5c";
    $enemyPanel.style.setProperty("--enemy-glow", eColor);
    $enemyPanel.style.setProperty("--enemy-glow-soft", hexToRgba(eColor, 0.42));
    $enemyPanel.style.setProperty("--enemy-glow-inset", hexToRgba(eColor, 0.14));

    let weakNote = "";
    if (enemy.weakness === "phys") {
      weakNote = enemy.isBoss ? "［破綻：物防−30%］" : "［破綻：物防減半］";
    } else if (enemy.weakness === "mag") {
      weakNote = enemy.isBoss ? "［破綻：魔防−30%］" : "［破綻：魔防減半］";
    } else if (enemy.isPhase2Boss) {
      weakNote = enemy.inRage
        ? `［真名狂暴：攻擊×${PHASE2_BOSS_RAGE_MULT}］`
        : `［亂碼侵蝕：攻擊×${PHASE2_BOSS_INIT_MULT}／吸血+${PHASE2_BOSS_LIFESTEAL}］`;
    }

    const eHpCur = Math.max(0, enemy.hp);
    const eHpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (eHpCur / enemy.maxHp) * 100)) : 0;
    const eShMax = enemy.maxShield || 0;
    const eShCur = Math.max(0, enemy.shield);
    const eShPct = eShMax > 0 ? Math.max(0, Math.min(100, (eShCur / eShMax) * 100)) : 0;

    const pDefHtml = enemy.weakness === "phys"
      ? `<span class="debuff">${enemy.curPhysDef}↓</span>`
      : `<span class="val">${enemy.curPhysDef}</span>`;
    const mDefHtml = enemy.weakness === "mag"
      ? `<span class="debuff">${enemy.curMagDef}↓</span>`
      : `<span class="val">${enemy.curMagDef}</span>`;

    $enemyPanel.innerHTML = `
      <div class="panel-row-top">
        <div class="panel-title">敵人：${colorize(escapeHtml(enemy.name))}</div>
        <div class="enemy-tag">${escapeHtml(weakNote)}</div>
      </div>
      <div class="bars-row">
        <div class="stat-bar-group">
          <span class="stat-label">生命</span>
          <div class="bar-track"><div class="bar-fill hp-enemy" style="width:${eHpPct}%"></div></div>
          <span class="stat-num">${eHpCur} / ${enemy.maxHp}</span>
        </div>
        <div class="stat-bar-group">
          <span class="stat-label">護盾</span>
          <div class="bar-track"><div class="bar-fill shield-fill" style="width:${eShPct}%"></div></div>
          <span class="stat-num">${eShCur} / ${eShMax}</span>
        </div>
      </div>
      <div class="stats-quad-row">
        <div class="stat-cell">物攻 <span class="val">${enemy.physAtk}</span></div>
        <div class="stat-cell">魔攻 <span class="val">${enemy.magAtk}</span></div>
        <div class="stat-cell">物防 ${pDefHtml}</div>
        <div class="stat-cell">魔防 ${mDefHtml}</div>
      </div>`;
    $enemyPanel.classList.remove("hidden");
  } else if ($enemyPanel) {
    $enemyPanel.classList.add("hidden");
  }
}

/* ===== 擲骰、抽撲克牌、戰鬥拉簾對話框與戰鬥效果動畫 ===== */
const $dice = document.getElementById("dice");
const $pokerDraw = document.getElementById("poker-draw");
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 初始化撲克牌背 DOM
if ($pokerDraw) {
  $pokerDraw.querySelectorAll(".deck-card, .drawn-face.back").forEach(el => {
    el.innerHTML = renderCardBackHtml();
  });
}

// 進入戰鬥動畫：先顯示「戰鬥開始了！！！」並漸漸消失，隨後從頂部拉下戰鬥對話框
async function openBattleDrawerAnim(enemyName) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ($battleLog) $battleLog.innerHTML = "";
  if ($battleDrawerTitle) {
    $battleDrawerTitle.innerHTML = colorize(`與 ${escapeHtml(enemyName)} 的戰鬥`);
  }

  if ($battleIntroOverlay && !reduce) {
    const $txt = document.getElementById("battle-intro-text");
    if ($txt) $txt.textContent = BATTLE_INTRO_TEXT;
    $battleIntroOverlay.classList.remove("active");
    void $battleIntroOverlay.offsetWidth;
    $battleIntroOverlay.classList.add("active");
    await sleep(BATTLE_INTRO_MS);
    $battleIntroOverlay.classList.remove("active");
  }

  if ($battleDrawer) {
    $battleDrawer.classList.add("open");
    if (!reduce) {
      await sleep(BATTLE_DRAWER_MS);
    }
  }
  isBattleDrawerActive = true;
}

// 戰鬥結束動畫：從底部往上收回戰鬥對話框
async function closeBattleDrawerAnim() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  isBattleDrawerActive = false;
  if ($battleDrawer && $battleDrawer.classList.contains("open")) {
    $battleDrawer.classList.remove("open");
    if (!reduce) {
      await sleep(BATTLE_DRAWER_MS);
    }
  }
}

async function rollPokerAnim(who, color, card, note) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $who = $pokerDraw.querySelector(".who");
  const $stage = $pokerDraw.querySelector(".stage-label");
  const $deckStack = $pokerDraw.querySelector(".deck-stack");
  const $drawnWrap = $pokerDraw.querySelector(".drawn-card-wrapper");
  const $drawnFront = $pokerDraw.querySelector(".drawn-face.front");
  const $badge = $pokerDraw.querySelector(".value-badge");
  const $note = $pokerDraw.querySelector(".note");

  $who.innerHTML = colorize(escapeHtml(who)) + " 抽撲克牌";
  $who.style.color = color || "#e8e8e8";
  $note.innerHTML = colorize(escapeHtml(note || ""));
  $badge.textContent = "";
  $drawnFront.innerHTML = renderPokerCardHtml(card);
  $drawnWrap.style.setProperty("--poker-draw-ms", POKER_DRAW_MS + "ms");
  $drawnWrap.className = "drawn-card-wrapper";

  $pokerDraw.classList.add("show");
  if (!reduce) {
    $stage.textContent = "正在洗牌...";
    $deckStack.className = "deck-stack shuffling";
    await sleep(POKER_SHUFFLE_MS);

    $stage.textContent = "抽出撲克牌！";
    $deckStack.className = "deck-stack recede";
    $drawnWrap.className = "drawn-card-wrapper drawing";
    await sleep(POKER_DRAW_MS);
  } else {
    $deckStack.className = "deck-stack recede";
  }

  $drawnWrap.className = "drawn-card-wrapper landed";
  const isLetter = (card.rank === "A" || card.rank === "J" || card.rank === "Q" || card.rank === "K");
  const hint = isLetter ? `（${card.rank} 代表數字 ${card.value}）` : `（點數 ${card.value}）`;
  $stage.textContent = "抽牌結果";
  $badge.textContent = `抽中：${card.suit.name} ${card.label} ${hint}`;

  await sleep(POKER_HOLD_MS);
  $pokerDraw.classList.remove("show");
  await sleep(120);
}

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

// 通用黑幕文字消失演出：畫面變暗 → 依序在畫面中心浮現每句文字並漸漸增加透明度直到完全消失 → 畫面亮度回復正常
async function playStorySequence(lines, darkness = DEFEAT_DARKNESS, restoreBrightness = true) {
  const $s = document.getElementById("story");
  $s.getAnimations().forEach(a => a.cancel());
  $s.style.backgroundColor = "rgba(0,0,0,0)";
  $s.classList.add("show");
  await storyBg(0, darkness, 500);
  for (const line of lines) {
    await storyTextAnim(line);
  }
  if (restoreBrightness) {
    await storyBg(darkness, 0, 500);
    $s.classList.remove("show");
    $s.getAnimations().forEach(a => a.cancel());
  }
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

async function playDefeatText(customLines) {
  const $s = document.getElementById("story");
  await sleep(DEFEAT_WAIT_MS);
  $s.getAnimations().forEach(a => a.cancel());
  $s.style.backgroundColor = "rgba(0,0,0,0)";
  $s.classList.add("show");
  await storyBg(0, DEFEAT_DARKNESS, DEFEAT_DARKEN_MS);
  const lines = Array.isArray(customLines) && customLines.length > 0 ? customLines : [DEFEAT_TEXT];
  for (const line of lines) {
    await storyTextAnim(line);
  }
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
  const $box = $dialogueStage || $log;
  $box.classList.remove("glow-gold", "glow-red");
  $g.classList.remove("shake");
  if (lostHp) {
    replayClass($box, "glow-red");
    replayClass($g, "shake");
  } else {
    replayClass($box, "glow-gold");
  }
  await sleep(HIT_MS);
  $box.classList.remove("glow-gold", "glow-red");
  $g.classList.remove("shake");
}

/* =========================================================
   1–5 層幕後事件池與爬塔流程（已全面隱藏牌庫顯示與相關對白）
   ========================================================= */

// 建立單層的 5 個幕後遭遇事件（營地回復 50% 最大生命，殘頁篝火回復 35% 最大生命）
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
        label: `遭遇${m.name}，迎戰`,
      };
    } else if (type === "camp") {
      return {
        id: `fl${fl}_card${idx}_${Math.random()}`,
        type: "camp",
        label: "在營地生火休息，回復 50% 最大生命",
      };
    } else {
      return {
        id: `fl${fl}_card${idx}_${Math.random()}`,
        type: "skill_camp",
        label: "在殘頁篝火旁調息，回復 35% 最大生命（暫代技能）",
      };
    }
  });
}

// 從當前樓層事件池隨機抽取 count 個不重複的事件
function drawFromDeck(deck, count) {
  const indices = deck.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, Math.min(count, deck.length)).map(i => deck[i]);
}

function newGame(selectedMode) {
  if (selectedMode === "dice" || selectedMode === "poker") {
    gameMode = selectedMode;
  }
  lastDrawnCard = null;
  equipExpanded = false;
  isBattleDrawerActive = false;
  historyLogs = [];
  if ($battleDrawer) $battleDrawer.classList.remove("open");
  if ($battleLog) $battleLog.innerHTML = "";
  closeHistoryModal();

  hero = {
    hp: HERO_BASE.hp,
    maxHp: HERO_BASE.hp,
    shield: 0,
    equip: { physWeapon: null, magWeapon: null, armor: null, shield: null, accessory: null },
  };
  floor = 1;
  round = 1;
  turn = 1;
  enemy = null;
  gameOver = false;
  floorDeck = buildFloorDeck(floor);

  $log.innerHTML = "";
  const modeTitle = gameMode === "poker"
    ? "【撲克模式】"
    : "【骰子模式】";
  log(`【勇者與魔王】${modeTitle}`, "big");
  log("你踏入被文字魔王侵蝕的領域。每層共有 6 個回合，擊敗怪物穿戴文字裝備，邁向第五層的原典王座。");
  const fInfo = getFloorInfo(floor);
  log(`── 進入第 ${floor} 層【${fInfo.name}】：${fInfo.desc}`, "big");
  presentRound();
}

// 顯示當前樓層與回合的選項（完全不提及牌庫／抽取庫）
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

  // 第 1–5 回合：二選一遭遇（第 5 回合為本層最後一段路途）
  const drawn = drawFromDeck(floorDeck, 2);
  if (drawn.length > 1) {
    log("前方出現了兩條分岔的道路，請選擇你的下一步行動：");
  } else {
    log("前方只剩下本層的最後一段路途：");
  }

  setChoices(
    drawn.map(card => ({
      label: card.label,
      action: () => selectCard(card),
    }))
  );
}

// 玩家選擇一個行動後執行
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

/* ===== 營地回復（選項 3A：營地回復 50% 最大生命，殘頁篝火回復 35% 最大生命） ===== */
function camp(isSkillPlaceholder) {
  const ratio = isSkillPlaceholder ? SKILL_CAMP_HEAL_RATIO : CAMP_HEAL_RATIO;
  const healTarget = Math.max(1, Math.floor(hero.maxHp * ratio));
  const beforeHp = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + healTarget);
  const healed = hero.hp - beforeHp;
  if (isSkillPlaceholder) {
    log(`你在殘頁篝火旁靜心調息（暫代技能，回復 35% 最大生命）。生命回復 ${healed} 點，現在是 ${hero.hp} / ${hero.maxHp}。`);
  } else {
    log(`你在營地生火休息（回復 50% 最大生命）。生命回復 ${healed} 點，現在是 ${hero.hp} / ${hero.maxHp}。`);
  }
  renderStatus();
  setChoices([{ label: "繼續前進", action: advanceAfterEvent }]);
}

/* ===== 第 6 回合：跨層寶箱與傳送門推進（每過一層清空一般對話框） ===== */
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

  // 每層清空一次一般對話框（歷史紀錄仍完整保留於 historyLogs）
  $log.innerHTML = "";
  log(`你踏入傳送門，成功抵達第 ${floor} 層【${fInfo.name}】！`, "big");
  log(`跨層祝福發動：勇者最大生命 +${FLOOR_HP_BONUS}，並回復 ${FLOOR_HP_BONUS} 點生命（目前生命 ${hero.hp} / ${hero.maxHp}）。`, "hit");
  log(`── 進入第 ${floor} 層【${fInfo.name}】：${fInfo.desc}`, "big");
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
   戰鬥系統（拉簾戰鬥對話框、無前綴雙行戰報、極簡上下按鈕）
   ========================================================= */

// 更新渾沌怪與一階段魔王每回合動態排斥弱點（一般渾沌怪防禦減半 ×0.5；一階段魔王防禦減免 30% 即 ×0.7）
function refreshChaosWeakness(announce) {
  if (!enemy || enemy.type !== "chaos" || enemy.isPhase2Boss) return;
  enemy.weakness = Math.random() < 0.5 ? "phys" : "mag";
  const mult = enemy.isBoss ? BOSS_WEAKNESS_MULT : 0.5;
  const descWord = enemy.isBoss ? "降低 30%" : "減半";
  if (enemy.weakness === "phys") {
    enemy.curPhysDef = Math.floor(enemy.physDef * mult);
    enemy.curMagDef = enemy.magDef;
    if (announce) {
      log(`【破綻】${enemy.name}體內的文字結構劇烈排斥，本回合「物理防禦」${descWord}（${enemy.physDef} → ${enemy.curPhysDef}）！`, "hit");
    }
  } else {
    enemy.curPhysDef = enemy.physDef;
    enemy.curMagDef = Math.floor(enemy.magDef * mult);
    if (announce) {
      log(`【破綻】${enemy.name}體內的文字結構劇烈排斥，本回合「魔法防禦」${descWord}（${enemy.magDef} → ${enemy.curMagDef}）！`, "hit");
    }
  }
}

// 第 4 部分：採用方案 B 極簡單行文字，並維持上下堆疊模式（預留未來局內技能空間）
function showCombatButtons() {
  if (!enemy || hero.hp <= 0) return;
  const wPhys = hero.equip.physWeapon ? hero.equip.physWeapon.name : "徒手";
  const wMag = hero.equip.magWeapon ? hero.equip.magWeapon.name : "基礎魔力";
  const hasSwordMult = (hero.equip.accessory && hero.equip.accessory.isHeroSword && hero.equip.accessory.atkMult > 1);
  const swordTag = hasSwordMult ? `［勇者之劍×${hero.equip.accessory.atkMult}］` : "";
  setChoices([
    {
      label: `【物理攻擊】使用${wPhys}${swordTag}`,
      action: () => heroAttack("phys"),
    },
    {
      label: `【魔法攻擊】使用${wMag}${swordTag}`,
      action: () => heroAttack("mag"),
    },
  ]);
}

async function startBattle(template) {
  if (template.isPhase2Boss) {
    // 二階段（選項 3A）：除生命（160）與飾品（勇者之劍）外，1:1 鏡像複製勇者並加上本源加成（雙攻+4、雙防+2），前半血處於【亂碼侵蝕】（攻擊×1.15／吸血+3）
    const mirror = calcStats(HERO_BASE, hero.equip, false);
    const baseMirrorPhysAtk = mirror.physAtk + PHASE2_BOSS_BONUS_ATK;
    const baseMirrorMagAtk = mirror.magAtk + PHASE2_BOSS_BONUS_ATK;
    const baseMirrorPhysDef = mirror.physDef + PHASE2_BOSS_BONUS_DEF;
    const baseMirrorMagDef = mirror.magDef + PHASE2_BOSS_BONUS_DEF;
    enemy = {
      name: template.name,
      trueName: template.trueName,
      type: "chaos",
      typeLabel: template.typeLabel || PHASE2_BOSS_HIDDEN_NAME,
      isBoss: false,
      isPhase2Boss: true,
      hp: template.hp,
      maxHp: template.hp,
      baseMirrorPhysAtk,
      baseMirrorMagAtk,
      physAtk: Math.floor(baseMirrorPhysAtk * PHASE2_BOSS_INIT_MULT),
      magAtk: Math.floor(baseMirrorMagAtk * PHASE2_BOSS_INIT_MULT),
      physDef: baseMirrorPhysDef,
      magDef: baseMirrorMagDef,
      curPhysDef: baseMirrorPhysDef,
      curMagDef: baseMirrorMagDef,
      shield: mirror.shield,
      maxShield: mirror.shield,
      weakness: null,
      halfHpTriggered: false,
      firstAttackDone: false,
      inRage: false,
      items: [],
    };
  } else {
    const equip = { physWeapon: null, magWeapon: null, armor: null, shield: null };
    template.items.forEach(it => { equip[it.slot] = it; });
    const baseSt = template.baseStats || { physAtk: 0, magAtk: 0, physDef: 0, magDef: 0, shield: 0 };
    const st = calcStats(baseSt, equip, false);

    enemy = {
      name: template.name,
      type: template.type || "phys",
      typeLabel: template.typeLabel || "怪物",
      isBoss: !!template.isBoss,
      isPhase2Boss: false,
      hp: template.hp,
      maxHp: template.hp,
      physAtk: st.physAtk,
      magAtk: st.magAtk,
      physDef: st.physDef,
      magDef: st.magDef,
      curPhysDef: st.physDef,
      curMagDef: st.magDef,
      shield: st.shield,
      maxShield: st.shield,
      weakness: null,
      halfHpTriggered: false,
      items: template.items,
    };
  }

  // 護盾每場戰鬥開始時刷新
  hero.shield = calcStats(HERO_BASE, hero.equip, true).shield;
  setChoices([]);
  renderStatus();

  // 於歷史對話中加入粗體標題「與XXX的戰鬥」
  historyLogs.push({
    kind: "battle_header",
    title: `與 ${enemy.name} 的戰鬥`,
  });

  // 播放「戰鬥開始了！！！」漸隱動畫，並從對話框頂部拉下專屬戰鬥對話框
  await openBattleDrawerAnim(enemy.name);

  log(`對手是${enemy.name}！`, "big");

  if (enemy.isBoss) {
    log("魔王的力量有點奇怪，似乎不屬於這裏……", "text-curse");
  } else if (enemy.isPhase2Boss) {
    log(`【精神世界】${enemy.name}完全複製了你身上的文字裝備與基礎能力（不包含飾品【勇者之劍】），並發動【亂碼侵蝕】（攻擊×${PHASE2_BOSS_INIT_MULT}／命中吸取 ${PHASE2_BOSS_LIFESTEAL} 點生命）！`, "text-curse");
  }

  if (enemy.type === "chaos" && !enemy.isPhase2Boss) {
    refreshChaosWeakness(true);
  }
  renderStatus();

  // 決定先攻：單數勇者先、雙數對手先（依模式使用 0–20 擲骰或 A–K 抽撲克牌）
  let r;
  if (gameMode === "poker") {
    const card = drawPokerCard();
    lastDrawnCard = card;
    r = card.value;
    await rollPokerAnim("先攻判定", null, card, "單數(A,3,5,7,9,J,K)＝勇者先攻／雙數＝" + enemy.name + "先攻");
    if (r % 2 === 1) {
      log(`先攻抽牌：${card.fullLabel}（代表點數 ${r}，單數），勇者先攻。`);
    } else {
      log(`先攻抽牌：${card.fullLabel}（代表點數 ${r}，雙數），${enemy.name}先攻。`);
      await enemyAttack();
      if (!enemy || hero.hp <= 0) return;
    }
  } else {
    r = rollD20();
    await rollDiceAnim("先攻判定", null, r, "單數＝勇者先攻／雙數＝" + enemy.name + "先攻");
    if (r % 2 === 1) {
      log(`先攻骰：${r}（單數），勇者先攻。`);
    } else {
      log(`先攻骰：${r}（雙數），${enemy.name}先攻。`);
      await enemyAttack();
      if (!enemy || hero.hp <= 0) return;
    }
  }
  renderStatus();
  showCombatButtons();
}

// 計算並套用傷害：支援【骰子模式】（0失手、18-20無視護盾、20無視50%防禦）與【撲克模式】（黑紅花色臨時+3、J/Q/K無視護盾、A無視50%防禦與護盾）
function dealDamage(attackerName, atkType, atk, def, target, dice, cardInfo) {
  const atkLabel = atkType === "mag" ? "魔法攻擊" : "物理攻擊";
  const defLabel = atkType === "mag" ? "魔防" : "物防";

  // 1. 骰子模式（cardInfo 為 null）
  if (!cardInfo) {
    if (dice === 0) {
      const mainLine = `${attackerName}發動【${atkLabel}】 ➔ 骰出 0 點失手，造成 0 點傷害！`;
      const formulaLine = `骰子 0（失手） = 0 傷害`;
      return { mainLine, formulaLine, dmg: 0, toShield: 0, toHp: 0 };
    }
    const isCrit20 = (dice === 20);
    const ignoreShield = (dice >= DICE_PIERCE_SHIELD_MIN);
    const effDef = isCrit20 ? Math.floor(def * DICE_CRIT_DEF_MULT) : def;
    const dmg = Math.max(0, atk + dice - effDef);
    const toShield = ignoreShield ? 0 : Math.min(target.shield, dmg);
    const toHp = dmg - toShield;
    target.shield -= toShield;
    target.hp -= toHp;

    let specialTag = "";
    if (isCrit20) {
      specialTag = "［骰出20：無視50%防禦＋無視護盾］";
    } else if (ignoreShield) {
      specialTag = `［骰出${dice}：無視護盾］`;
    }

    let mainLine = `${attackerName}發動【${atkLabel}】${specialTag} ➔ 造成 ${dmg} 點傷害！`;
    if (dmg > 0) {
      const parts = [];
      if (toShield > 0) parts.push(`護盾 −${toShield}`);
      if (toHp > 0) parts.push(`生命 −${toHp}`);
      mainLine += `（${parts.join("，")}）`;
    }
    const rollExpr = ignoreShield ? `骰子 ${dice}（穿盾）` : `骰子 ${dice}`;
    const defExpr = isCrit20 ? `${defLabel} ${effDef}（原 ${def} 減半）` : `${defLabel} ${def}`;
    const formulaLine = `${atk} + ${rollExpr} − ${defExpr} = ${dmg} 傷害`;
    return { mainLine, formulaLine, dmg, toShield, toHp };
  }

  // 2. 撲克模式（cardInfo 存在：無失手；黑色花色物攻臨時+3、紅色花色魔攻臨時+3；J/Q/K 無視護盾；A 無視50%防禦＋無視護盾）
  const isBlackSuit = (cardInfo.suit.key === "S" || cardInfo.suit.key === "C");
  const suitMatched = (atkType === "phys" && isBlackSuit) || (atkType === "mag" && !isBlackSuit);
  const suitBonus = suitMatched ? POKER_SUIT_ATK_BONUS : 0;
  const effAtk = atk + suitBonus;

  const isAce = (cardInfo.rank === "A");
  const isFace = (dice >= POKER_FACE_PIERCE_MIN);
  const ignoreShield = (isAce || isFace);
  const effDef = isAce ? Math.floor(def * POKER_ACE_DEF_MULT) : def;

  const dmg = Math.max(0, effAtk + dice - effDef);
  const toShield = ignoreShield ? 0 : Math.min(target.shield, dmg);
  const toHp = dmg - toShield;
  target.shield -= toShield;
  target.hp -= toHp;

  const tags = [];
  if (suitBonus > 0) {
    tags.push(`${ isBlackSuit ? "黑花色物攻" : "紅花色魔攻" }+${suitBonus}`);
  }
  if (isAce) {
    tags.push("王牌A：無視50%防禦＋無視護盾");
  } else if (isFace) {
    tags.push(`人頭牌${cardInfo.rank}：無視護盾`);
  }
  const tagStr = tags.length > 0 ? `［${tags.join("｜")}］` : "";

  let mainLine = `${attackerName}發動【${atkLabel}】${tagStr} ➔ 造成 ${dmg} 點傷害！`;
  if (dmg > 0) {
    const parts = [];
    if (toShield > 0) parts.push(`護盾 −${toShield}`);
    if (toHp > 0) parts.push(`生命 −${toHp}`);
    mainLine += `（${parts.join("，")}）`;
  }

  const atkExpr = suitBonus > 0 ? `${effAtk}（${atk}+花色${suitBonus}）` : `${atk}`;
  const rollExpr = ignoreShield
    ? `撲克 ${dice}（${cardInfo.label} 穿盾）`
    : `撲克 ${dice}（${cardInfo.label}）`;
  const defExpr = isAce ? `${defLabel} ${effDef}（原 ${def} 減半）` : `${defLabel} ${def}`;
  const formulaLine = `${atkExpr} + ${rollExpr} − ${defExpr} = ${dmg} 傷害`;
  return { mainLine, formulaLine, dmg, toShield, toHp };
}

async function heroAttack(atkType) {
  setChoices([]); // 動畫期間鎖定按鈕
  const s = calcStats(HERO_BASE, hero.equip, true);
  const isMag = atkType === "mag";
  const atkVal = isMag ? s.magAtk : s.physAtk;
  const defVal = isMag ? enemy.curMagDef : enemy.curPhysDef;
  const rollWord = gameMode === "poker" ? "撲克" : "骰子";
  const labelNote = isMag
    ? `魔攻 ${atkVal} + ${rollWord} − 魔防 ${defVal}`
    : `物攻 ${atkVal} + ${rollWord} − 物防 ${defVal}`;

  let dice, drawnCard = null;
  if (gameMode === "poker") {
    drawnCard = drawPokerCard();
    lastDrawnCard = drawnCard;
    dice = drawnCard.value;
    await rollPokerAnim("勇者", HERO_COLOR, drawnCard, labelNote);
  } else {
    dice = rollD20();
    await rollDiceAnim("勇者", HERO_COLOR, dice, labelNote);
  }
  await swordAnim();

  const heroTarget = { shield: enemy.shield, hp: enemy.hp };
  const report = dealDamage("勇者", atkType, atkVal, defVal, heroTarget, dice, drawnCard);
  logCombatReport(true, report.mainLine, report.formulaLine);
  enemy.shield = heroTarget.shield;
  enemy.hp = heroTarget.hp;
  renderStatus();

  // 二階段：勇者第一次攻擊後的專屬台詞（半血前 enemy.name 為 @$+%^&¥，完全不出現真魔王或沙坦）
  if (enemy.isPhase2Boss && !enemy.firstAttackDone) {
    enemy.firstAttackDone = true;
    log(`${enemy.name}：「啊啊你爲甚麼會有前勇者的武器，這個混蛋竟然死後也不安寧！！！」`, "text-curse");
  }

  if (enemy.hp <= 0) { await winBattle(); return; }

  // 一階段魔王半血掙扎加劇提示（完全不顯示任何有關前勇者的部分，只顯示「魔王突然劇烈掙扎」）
  if (enemy.isBoss && !enemy.halfHpTriggered && enemy.hp <= enemy.maxHp * BOSS_STRUGGLE_HP_RATIO) {
    enemy.halfHpTriggered = true;
    log(BOSS_STRUGGLE_TEXT, "text-curse");
  }

  // 二階段半血（HP <= 80）顯露真名「文字.沙坦」並進入狂暴狀態（雙攻提升為 ×1.45 ＋ 立即重鑄 15 點原典黑盾）
  if (enemy.isPhase2Boss && !enemy.halfHpTriggered && enemy.hp <= enemy.maxHp * PHASE2_BOSS_RAGE_HP_RATIO) {
    enemy.halfHpTriggered = true;
    const oldHiddenName = enemy.name;
    enemy.name = enemy.trueName || PHASE2_BOSS_TRUE_NAME;
    enemy.typeLabel = "真魔王";
    enemy.inRage = true;
    enemy.physAtk = Math.floor(enemy.baseMirrorPhysAtk * PHASE2_BOSS_RAGE_MULT);
    enemy.magAtk = Math.floor(enemy.baseMirrorMagAtk * PHASE2_BOSS_RAGE_MULT);
    enemy.shield += PHASE2_BOSS_RAGE_SHIELD;
    enemy.maxShield = Math.max(enemy.maxShield, enemy.shield);
    if ($battleDrawerTitle) {
      $battleDrawerTitle.innerHTML = colorize(`與 ${escapeHtml(enemy.name)} 的戰鬥`);
    }
    log(`【真名顯露】隨着重創，${oldHiddenName}身上的亂碼屏障碎裂，露出了它的真名——「${enemy.name}」！`, "big");
    log(`勇者：「原來魔王的名字叫${enemy.name}….」`, "hit");
    log(`${enemy.name}：「竟然被你看見了...那麼你就非死不可了！！」`, "text-curse");
    log(`【狂暴】${enemy.name}進入狂暴狀態！物理與魔法攻擊力提升為 ${PHASE2_BOSS_RAGE_MULT} 倍（物攻 ${enemy.physAtk}／魔攻 ${enemy.magAtk}），並重鑄了 ${PHASE2_BOSS_RAGE_SHIELD} 點原典黑盾！`, "text-curse");
    renderStatus();
  }

  await enemyAttack();
  if (!enemy || hero.hp <= 0) return;

  // 渾沌怪與一階段魔王每回合結束後動態切換排斥弱點（二階段不減防）
  if (enemy.type === "chaos" && !enemy.isPhase2Boss) {
    refreshChaosWeakness(true);
  }
  renderStatus();
  showCombatButtons();
}

async function enemyAttack() {
  // 一階段魔王掙扎判定（初期 15%，半血以下 30%）：
  // 嚴格不顯示任何有關前勇者的部分，只顯示「魔王突然劇烈掙扎」➔ 50%「魔王揮空並且傷到了自己」／ 50%「魔王暴走！！！」
  let berserkBonus = 0;
  if (enemy.isBoss) {
    const struggleChance = (enemy.hp <= enemy.maxHp * BOSS_STRUGGLE_HP_RATIO)
      ? BOSS_STRUGGLE_CHANCE_LOW_HP
      : BOSS_STRUGGLE_CHANCE_BASE;
    if (Math.random() < struggleChance) {
      log(BOSS_STRUGGLE_TEXT, "text-curse");
      if (Math.random() < 0.5) {
        enemy.hp = Math.max(0, enemy.hp - BOSS_STRUGGLE_SELF_DMG);
        log(BOSS_STRUGGLE_SELF_HIT_TEXT, "text-curse");
        renderStatus();
        await sleep(HIT_MS);
        if (enemy.hp <= 0) await winBattle();
        return;
      } else {
        berserkBonus = BOSS_STRUGGLE_BERSERK_ATK;
        log(BOSS_STRUGGLE_BERSERK_TEXT, "text-curse");
      }
    }
  }

  const s = calcStats(HERO_BASE, hero.equip, true);
  let atkType = "phys";
  if (enemy.type === "mag") {
    atkType = "mag";
  } else if (enemy.type === "chaos") {
    atkType = Math.random() < 0.5 ? "phys" : "mag";
  }

  const isMag = atkType === "mag";
  const atkVal = (isMag ? enemy.magAtk : enemy.physAtk) + berserkBonus;
  const defVal = isMag ? s.magDef : s.physDef;
  const rollWord = gameMode === "poker" ? "撲克" : "骰子";
  const labelNote = isMag
    ? `魔法攻擊 ${atkVal} + ${rollWord} − 勇者魔防 ${defVal}`
    : `物理攻擊 ${atkVal} + ${rollWord} − 勇者物防 ${defVal}`;

  let dice, drawnCard = null;
  if (gameMode === "poker") {
    drawnCard = drawPokerCard();
    lastDrawnCard = drawnCard;
    dice = drawnCard.value;
    await rollPokerAnim(enemy.name, ENEMY_COLORS[enemy.name], drawnCard, labelNote);
  } else {
    dice = rollD20();
    await rollDiceAnim(enemy.name, ENEMY_COLORS[enemy.name], dice, labelNote);
  }

  const target = { shield: hero.shield, hp: hero.hp };
  const hpBefore = hero.hp;
  const report = dealDamage(enemy.name, atkType, atkVal, defVal, target, dice, drawnCard);

  // 檢查是否觸發飾品【勇者之劍】殘魂免疫致命傷（選項 2A：最多 2 次，鎖 1 血，且每觸發 1 次攻擊倍率下降 0.15）
  const acc = hero.equip.accessory;
  if (target.hp <= 0 && acc && acc.isHeroSword && acc.blocksLeft > 0) {
    acc.blocksLeft--;
    acc.atkMult = Math.max(1.0, Math.round((acc.atkMult - HERO_SWORD_BLOCK_DECAY) * 100) / 100);
    hero.shield = 0;
    hero.hp = 1; // 保留 1 點生命（鎖 1 血）
    logCombatReport(false, report.mainLine, report.formulaLine);
    renderStatus();

    // 觸發「受到攻擊後生命值沒有減少」的視覺特效（面板周圍閃金光）
    await heroHitAnim(false);

    // 畫面變暗並在中心顯示文字消失效果
    if (acc.blocksLeft > 0) {
      log(`勇者之劍裏的殘魂突然出現，爲勇者擋下了致命一擊。勇者的殘魂變弱了一分（攻擊倍率降至 ×${acc.atkMult}，勇者保留 1 點生命）。`, "hit");
      renderStatus();
      await playStorySequence([HERO_SWORD_BLOCK_TEXT]);
    } else {
      log("勇者之劍裏的殘魂拼盡最後一份力爲勇者擋下致命一擊。勇者的殘魂消失了...（攻擊加成消逝，勇者保留 1 點生命）", "hit");
      log(`${enemy.name}：「（邪笑）看你還有甚麼手段抵擋我」`, "text-curse");
      renderStatus();
      await playStorySequence([HERO_SWORD_BLOCK_TEXT, HERO_SWORD_VANISH_TEXT]);
    }
    return;
  }

  logCombatReport(false, report.mainLine, report.formulaLine);
  hero.shield = target.shield;
  hero.hp = target.hp;

  // 二階段前半血【亂碼侵蝕】吸血機制：若本次攻擊對勇者造成實際生命傷害且勇者尚未倒下，吸取 3 點生命
  if (enemy && enemy.isPhase2Boss && !enemy.inRage && report.toHp > 0 && hero.hp > 0) {
    const beforeEnemyHp = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + PHASE2_BOSS_LIFESTEAL);
    const healedEnemy = enemy.hp - beforeEnemyHp;
    if (healedEnemy > 0) {
      log(`【亂碼侵蝕】${enemy.name}吞噬了飛濺的血肉文字，回復 ${healedEnemy} 點生命（目前生命 ${enemy.hp} / ${enemy.maxHp}）！`, "text-curse");
    }
  }

  renderStatus();

  await heroHitAnim(hero.hp < hpBefore);
  if (hero.hp <= 0) loseGame();
}

async function winBattle() {
  setChoices([]);
  // 先播放「從底部收回戰鬥對話框」動畫，使後續劇情與掉寶回到外層一般對話框
  await closeBattleDrawerAnim();

  // 一階段魔王被擊敗：此時勇者才發現魔王的真實身分是「前勇者」！
  if (enemy.isBoss) {
    enemy = null;
    renderStatus();

    // 隱藏彩蛋：全程未穿戴任何文字裝備（完全徒手／初始狀態）
    if (isCompletelyUnarmed()) {
      log("【隱藏彩蛋】你全程沒有借助任何文字裝備的力量，以純粹的血肉之軀擊倒了文字魔王，揭開了他是前勇者的真相！", "big");
      for (const line of UNARMED_EGG_TEXTS) {
        log(line, "hit");
      }
      await playStorySequence(UNARMED_EGG_TEXTS);
      log("【特殊完勝結局：純粹血肉之奇蹟】你連精神世界的心魔都無從誕生，徹底粉碎了文字魔王的詛咒！", "big");
      setChoices([
        { label: "再玩一次", action: showReplayModeChoices },
        { label: "返回標題畫面", action: goTitle },
      ]);
      return;
    }

    // 正常路線：文字魔王倒下後，勇者發現其身分為「前勇者」，獲得【勇者之劍】（回復 50% 最大生命、初始 ×1.3 攻擊、2 次殘魂擋死）
    const swordItem = { ...HERO_SWORD_ITEM };
    hero.equip.accessory = swordItem;
    const healGain = Math.max(1, Math.floor(hero.maxHp * HERO_SWORD_HEAL_RATIO));
    const beforeHp = hero.hp;
    hero.hp = Math.min(hero.maxHp, hero.hp + healGain);
    const actualHealed = hero.hp - beforeHp;
    sep();
    log("文字魔王倒下了……他身上的文字枷鎖出現裂痕，露出了底下的真容——竟然是前勇者！", "big");
    log(`你獲得了前勇者的遺物飾品：【${swordItem.name}】（${swordItem.desc}）！勇者生命回復 ${actualHealed} 點（目前生命 ${hero.hp} / ${hero.maxHp}）！`, "hit");
    for (const line of PHASE1_CLEAR_TEXTS) {
      log(line, "text-curse");
    }
    renderStatus();

    await playStorySequence(PHASE1_CLEAR_TEXTS);

    sep();
    log(`── 意識墜入精神世界，${PHASE2_BOSS_HIDDEN_NAME}降臨！`, "big");
    await bossAppearAnim();
    await startBattle(PHASE2_BOSS);
    return;
  }

  // 二階段（文字.沙坦）被擊敗：演出 4 句勝利結局文字消失動畫
  if (enemy.isPhase2Boss) {
    enemy = null;
    renderStatus();
    sep();
    for (const line of PHASE2_VICTORY_TEXTS) {
      log(line, "big");
    }
    await playStorySequence(PHASE2_VICTORY_TEXTS);
    log(`【勝利結局：血肉重鑄】你成功擊潰真魔王「${PHASE2_BOSS_TRUE_NAME}」，奪回血肉之身並拯救了村落！`, "big");
    setChoices([
      { label: "再玩一次", action: showReplayModeChoices },
      { label: "返回標題畫面", action: goTitle },
    ]);
    return;
  }

  const defeatedEnemy = enemy;
  enemy = null;
  renderStatus();

  log(`你打倒了${defeatedEnemy.name}！`, "big");
  const drop = randomPick(defeatedEnemy.items);
  log(`${defeatedEnemy.name}掉落了一件${SLOT_NAME[drop.slot]}：${itemText(drop)}。`);
  offerItem(drop, advanceAfterEvent);
}

function loseGame() {
  gameOver = true;
  hero.hp = 0;
  const wasPhase2 = enemy && enemy.isPhase2Boss;
  const killerName = enemy ? enemy.name : "魔王";
  log(`勇者倒下了……被${killerName}擊敗，意識逐漸被冰冷的文字吞噬。`, "big");
  if (wasPhase2) {
    log("【敗北結局：文字魔王】你的意識被徹底吞噬，肉身化為冰冷文字，成為王座上靜候下一位挑戰者的新任文字魔王……", "text-curse");
  } else {
    log(`【遊戲結束】止步於第 ${floor} 層第 ${round} 回合。`, "big");
  }
  enemy = null;
  renderStatus();
  setChoices([]);
  playDefeatText(wasPhase2 ? PHASE2_DEFEAT_TEXTS : [DEFEAT_TEXT]);
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
document.documentElement.style.setProperty("--battle-intro-ms", BATTLE_INTRO_MS + "ms");
document.documentElement.style.setProperty("--battle-drawer-ms", BATTLE_DRAWER_MS + "ms");
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

const $titleMainMenu = document.getElementById("title-main-menu");
const $titleModeMenu = document.getElementById("title-mode-menu");

function resetTitleMenu() {
  if ($titleMainMenu && $titleModeMenu) {
    $titleMainMenu.classList.remove("hidden");
    $titleModeMenu.classList.add("hidden");
  }
}

function openTitleModeSelect() {
  if ($titleMainMenu && $titleModeMenu) {
    $titleMainMenu.classList.add("hidden");
    $titleModeMenu.classList.remove("hidden");
  }
}

// 通關後按下「再玩一次」時，顯示兩個模式按鈕供玩家選擇
function showReplayModeChoices() {
  log(MODE_PROMPT_TEXT, "big");
  setChoices([
    { label: MODE_DICE_BTN_TEXT, action: () => { newGame("dice"); playStartText(); } },
    { label: MODE_POKER_BTN_TEXT, action: () => { newGame("poker"); playStartText(); } },
    { label: "返回標題畫面", action: goTitle },
  ]);
}

function goTitle() { showScreen($title, resetTitleMenu); }
function goIntro() { showScreen($intro, () => { document.getElementById("intro-box").scrollTop = 0; }); }
function goGameWithMode(selectedMode) {
  showScreen($game, () => {
    resetTitleMenu();
    newGame(selectedMode);
    playStartText();
  });
}

// 標題畫面按下「開始遊戲」：展開【骰子模式】與【撲克模式】兩個按鈕
document.getElementById("btn-start").onclick = openTitleModeSelect;
document.getElementById("btn-mode-dice").onclick = () => goGameWithMode("dice");
document.getElementById("btn-mode-poker").onclick = () => goGameWithMode("poker");
document.getElementById("btn-mode-back").onclick = resetTitleMenu;

document.getElementById("btn-intro").onclick = goIntro;
document.getElementById("btn-back").onclick = goTitle;
// 介紹畫面按下「開始遊戲」：切換回標題畫面並直接展開雙模式選擇按鈕
document.getElementById("btn-intro-start").onclick = () => showScreen($title, openTitleModeSelect);
