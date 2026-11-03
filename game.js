/* =========================================================
   遊戲核心狀態與邏輯 (game.js - 第十二版 v12)
   包含：方案 B 標準平衡數值、左上角「測試者」按鈕（999 無敵套裝＋自由選層）、
   頂部面板「物攻｜物防｜魔攻｜魔防」位置對調、雙模式穿盾與花色加成、
   一階段魔王掙扎／暴走（擊敗前保密前勇者身分）、勇者之劍殘魂燃燒、
   二階段心魔戰（半血前保密真名只顯示 @$+%^&¥，半血後顯露真名文字.沙坦）
   ========================================================= */
let hero, floor, round, turn, floorDeck, enemy, gameOver;
let lastHeroHp = HERO_BASE.hp;
let lastEnemyHp = null;
let lastHeroShield = 0;
let lastEnemyShield = null;
let lastRenderedEnemyRef = null;
let gameMode = "dice"; // "dice" (0–20 骰子模式) 或 "poker" (1–13 撲克模式)
let lastDrawnCard = null; // 紀錄最近一次抽出的撲克牌資訊
let equipExpanded = false; // 頂部裝備浮動版面展開狀態
let skillExpanded = false; // 頂部技能浮動版面展開狀態
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
const $testerModal = document.getElementById("tester-modal");
const $testerFloorList = document.getElementById("tester-floor-list");

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
// 第十版（v10）新增：生成護盾特效內部圖層（敵人面板與勇者中間對話框共用，無文字提示）
function buildShieldFxLayerHtml(isDialogue) {
  const shardConfigs = isDialogue
    ? [
        { sx: "24%", sy: "28%", sw: "16px", sh: "18px", tx: "-110px", ty: "-65px", rot: "-145deg" },
        { sx: "38%", sy: "24%", sw: "14px", sh: "16px", tx: "-45px",  ty: "-80px", rot: "120deg" },
        { sx: "52%", sy: "30%", sw: "18px", sh: "20px", tx: "20px",   ty: "-85px", rot: "165deg" },
        { sx: "68%", sy: "26%", sw: "15px", sh: "17px", tx: "95px",   ty: "-70px", rot: "-130deg" },
        { sx: "80%", sy: "34%", sw: "13px", sh: "15px", tx: "125px",  ty: "-35px", rot: "140deg" },
        { sx: "22%", sy: "52%", sw: "15px", sh: "17px", tx: "-120px", ty: "10px",  rot: "-160deg" },
        { sx: "42%", sy: "48%", sw: "19px", sh: "22px", tx: "-65px",  ty: "-25px", rot: "135deg" },
        { sx: "58%", sy: "50%", sw: "18px", sh: "21px", tx: "70px",   ty: "-20px", rot: "-115deg" },
        { sx: "76%", sy: "54%", sw: "15px", sh: "17px", tx: "130px",  ty: "20px",  rot: "175deg" },
        { sx: "28%", sy: "74%", sw: "14px", sh: "16px", tx: "-95px",  ty: "75px",  rot: "-110deg" },
        { sx: "45%", sy: "70%", sw: "17px", sh: "19px", tx: "-30px",  ty: "88px",  rot: "150deg" },
        { sx: "56%", sy: "72%", sw: "16px", sh: "18px", tx: "45px",   ty: "85px",  rot: "-140deg" },
        { sx: "72%", sy: "74%", sw: "14px", sh: "16px", tx: "105px",  ty: "72px",  rot: "125deg" },
        { sx: "62%", sy: "40%", sw: "13px", sh: "15px", tx: "85px",   ty: "-50px", rot: "-95deg" },
      ]
    : [
        { sx: "32%", sy: "45%", sw: "13px", sh: "15px", tx: "-68px", ty: "-42px", rot: "-140deg" },
        { sx: "42%", sy: "38%", sw: "10px", sh: "12px", tx: "-35px", ty: "-55px", rot: "110deg" },
        { sx: "50%", sy: "50%", sw: "15px", sh: "16px", tx: "12px",  ty: "-60px", rot: "165deg" },
        { sx: "62%", sy: "42%", sw: "12px", sh: "14px", tx: "58px",  ty: "-46px", rot: "-125deg" },
        { sx: "74%", sy: "48%", sw: "11px", sh: "13px", tx: "82px",  ty: "-22px", rot: "145deg" },
        { sx: "36%", sy: "62%", sw: "12px", sh: "11px", tx: "-62px", ty: "38px",  rot: "-160deg" },
        { sx: "48%", sy: "65%", sw: "14px", sh: "14px", tx: "-18px", ty: "54px",  rot: "130deg" },
        { sx: "58%", sy: "60%", sw: "11px", sh: "15px", tx: "36px",  ty: "52px",  rot: "-115deg" },
        { sx: "70%", sy: "62%", sw: "13px", sh: "12px", tx: "76px",  ty: "36px",  rot: "175deg" },
        { sx: "82%", sy: "52%", sw: "10px", sh: "12px", tx: "92px",  ty: "12px",  rot: "-95deg" },
      ];
  const shardsHtml = shardConfigs.map(c =>
    `<div class="ice-shard" style="--sx:${c.sx};--sy:${c.sy};--sw:${c.sw};--sh:${c.sh};--tx:${c.tx};--ty:${c.ty};--rot:${c.rot};"></div>`
  ).join("");
  const svgHtml = isDialogue
    ? `<svg class="shield-crack-svg" viewBox="0 0 600 220" preserveAspectRatio="none">
         <path d="M300,0 L275,58 L185,95 L268,140 L235,220 M275,58 L385,42 L465,105 M268,140 L375,165 L435,220 M185,95 L85,52 M185,95 L115,175 M385,42 L515,18" fill="none" stroke="#aef6ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M300,0 L328,72 L415,112 L318,168 L345,220 M415,112 L530,145" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-dasharray="6 3"/>
       </svg>`
    : `<svg class="shield-crack-svg" viewBox="0 0 400 100" preserveAspectRatio="none">
         <path d="M195,0 L210,30 L265,42 L205,62 L225,100 M210,30 L155,20 L115,48 M205,62 L150,74 L120,98 M265,42 L310,22 M265,42 L298,82" fill="none" stroke="#aef6ff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M195,0 L180,36 L142,52 L188,75 L175,100" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4 2"/>
       </svg>`;
  const layerId = isDialogue ? ' id="dialogue-fx-layer"' : "";
  return `<div class="shield-fx-layer"${layerId} aria-hidden="true"><div class="shield-wave-sweep"></div><div class="shield-hex-barrier"></div>${svgHtml}<div class="ice-shards-container">${shardsHtml}</div></div>`;
}

function ensureDialogueShieldFxLayer() {
  if (!$dialogueStage) return;
  if (!document.getElementById("dialogue-fx-layer")) {
    $dialogueStage.insertAdjacentHTML("afterbegin", buildShieldFxLayerHtml(true));
  }
}

/* ===== 第十二版（v12）新增：技能美術特效、雙色分段護盾、全域 +X 跳字與跨面板光點動畫系統 ===== */
const $fxFlightLayer = document.getElementById("fx-flight-layer");

function getSkillColorByCategory(cat) {
  if (typeof SKILL_CATEGORY_INFO !== "undefined" && SKILL_CATEGORY_INFO[cat]) {
    return SKILL_CATEGORY_INFO[cat].color;
  }
  if (cat === "attack") return "#ff4d4d";
  if (cat === "defense") return "#ffd23f";
  return "#38d399";
}

// 技能按鈕按下時向外擴散一圈能量光圈（僅限技能按鈕）
function playSkillButtonEnergyRipple(btnEl, colorHex) {
  if (!btnEl || !$fxFlightLayer) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = btnEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const ring = document.createElement("div");
  ring.className = "skill-energy-ripple";
  ring.style.left = rect.left + "px";
  ring.style.top = rect.top + "px";
  ring.style.width = rect.width + "px";
  ring.style.height = rect.height + "px";
  ring.style.setProperty("--ripple-color", colorHex || "#38d399");
  $fxFlightLayer.appendChild(ring);
  setTimeout(() => { ring.remove(); }, 960);
}

// 在指定元素旁浮現「+X」往上輕飄淡出（綠字加血／綠字屬性 或 黃字加護盾）
function spawnFloatingPlus($anchorEl, text, isYellow = false) {
  if (!$anchorEl || !$fxFlightLayer) return;
  const rect = $anchorEl.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) return;
  const badge = document.createElement("div");
  badge.className = "float-plus-badge " + (isYellow ? "plus-yellow" : "plus-green");
  badge.textContent = text;
  badge.style.left = (rect.left + rect.width * 0.5) + "px";
  badge.style.top = Math.max(8, rect.top - 4) + "px";
  $fxFlightLayer.appendChild(badge);
  setTimeout(() => { badge.remove(); }, 1960);
}

// 全域勇者加血視覺回饋：頂部生命條閃綠光並於旁邊浮現綠色「+X」往上輕飄淡出
function triggerHeroHealVisual(amount) {
  if (!amount || amount <= 0) return;
  renderStatus();
  const $hpTrack = document.getElementById("hero-hp-track");
  const $hpNum = document.getElementById("hero-hp-num");
  if ($hpTrack) replayClass($hpTrack, "bar-flash-green");
  spawnFloatingPlus($hpNum || $hpTrack || $status, `+${amount}`, false);
}

// 全域技能加黃色護盾視覺回饋：增加黃色技能護盾、頂部護盾條閃黃光並浮現黃色「+X」往上輕飄淡出
function addHeroSkillShield(amount, triggerVisual = true) {
  if (!hero || !amount || amount <= 0) return;
  hero.shield += amount;
  hero.skillShield = (hero.skillShield || 0) + amount;
  renderStatus();
  if (triggerVisual) {
    const $shTrack = document.getElementById("hero-sh-track");
    const $shNum = document.getElementById("hero-sh-num");
    if ($shTrack) replayClass($shTrack, "bar-flash-yellow");
    spawnFloatingPlus($shNum || $shTrack || $status, `+${amount}`, true);
  }
}

// 跨面板飛行光點動畫（從 $fromEl 飛向 $toEl）
async function playParticlesBetween($fromEl, $toEl, colorHex, count = 6, durationMs = 880) {
  if (!$fromEl || !$toEl || !$fxFlightLayer) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await sleep(120);
    return;
  }
  const r1 = $fromEl.getBoundingClientRect();
  const r2 = $toEl.getBoundingClientRect();
  if (r1.width <= 0 || r2.width <= 0) return;
  const sx = r1.left + r1.width * 0.5;
  const sy = r1.top + r1.height * 0.5;
  const ex = r2.left + r2.width * 0.5;
  const ey = r2.top + r2.height * 0.5;

  const promises = [];
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "fx-flying-dot";
    dot.style.setProperty("--dot-color", colorHex || "#38d399");
    dot.style.setProperty("--dot-size", count === 1 ? "11px" : "8px");
    const ox = (count === 1) ? 0 : (Math.random() - 0.5) * Math.min(80, r1.width * 0.5);
    const oy = (count === 1) ? 0 : (Math.random() - 0.5) * Math.min(36, r1.height * 0.5);
    const mx = (sx + ex) * 0.5 + (Math.random() - 0.5) * 40;
    const my = (sy + ey) * 0.5 - 18;
    $fxFlightLayer.appendChild(dot);

    const delay = i * 70;
    const anim = dot.animate([
      { left: (sx + ox) + "px", top: (sy + oy) + "px", opacity: 0.95, transform: "translate(-50%, -50%) scale(0.9)" },
      { left: mx + "px", top: my + "px", opacity: 1, transform: "translate(-50%, -50%) scale(1.15)", offset: 0.5 },
      { left: ex + "px", top: ey + "px", opacity: 0.2, transform: "translate(-50%, -50%) scale(0.5)" },
    ], { duration: durationMs, delay, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" });

    promises.push(anim.finished.catch(() => {}).then(() => { dot.remove(); }));
  }
  await Promise.all(promises);
}

// 獲得技能時的動畫：中央殘頁卡片浮現消散 ➔ 化為光點飛入頂部勇者面板的「技能」按鈕
async function playSkillAcquireAnim(sk) {
  const $ov = document.getElementById("skill-acquire-overlay");
  const $card = document.getElementById("skill-acquire-card");
  const $name = document.getElementById("skill-acquire-name");
  const $cat = document.getElementById("skill-acquire-cat");
  const $btnSkill = document.getElementById("btn-toggle-skill");
  const cHex = getSkillColorByCategory(sk.category);

  if (!$ov || !$card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  $card.style.setProperty("--acq-color", cHex);
  if ($name) $name.textContent = `【${sk.name}】`;
  if ($cat) $cat.textContent = `${sk.categoryLabel}｜冷卻 ${sk.cd} 回合`;

  $ov.classList.remove("hidden", "card-in");
  void $ov.offsetWidth;
  $ov.classList.add("show", "card-in");
  await sleep(1040);

  if ($btnSkill) {
    await playParticlesBetween($card, $btnSkill, cHex, 9, 880);
    $btnSkill.style.borderColor = cHex;
    $btnSkill.style.boxShadow = `0 0 14px ${cHex}`;
    setTimeout(() => {
      $btnSkill.style.borderColor = "";
      $btnSkill.style.boxShadow = "";
    }, 1300);
  } else {
    await sleep(480);
  }

  $ov.classList.remove("show");
  await sleep(440);
  $ov.classList.remove("card-in");
  $ov.classList.add("hidden");
}

// 勇者對話框由下往上掃過綠色波紋或黃色六角網格
async function playDialogueSweep(sweepClass, durationMs = 920) {
  if (!$dialogueStage) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    await sleep(100);
    return;
  }
  const el = document.createElement("div");
  el.className = `dialogue-sweep-fx ${sweepClass}`;
  $dialogueStage.appendChild(el);
  await sleep(durationMs);
  el.remove();
}

// 勇者對話框邊框短暫微光閃爍
async function playDialogueMicroGlow(glowClass, durationMs = 680) {
  if (!$dialogueStage) return;
  replayClass($dialogueStage, glowClass);
  await sleep(durationMs);
  $dialogueStage.classList.remove(glowClass);
}

// 敵人面板中央閃一下紅／綠色十字準星鎖定框
async function playEnemyCrosshairFx(colorHex = "#ff4d4d", durationMs = 1040) {
  if (!$enemyPanel) return;
  const el = document.createElement("div");
  el.className = "enemy-crosshair-fx";
  el.style.setProperty("--ch-color", colorHex);
  $enemyPanel.appendChild(el);
  await sleep(durationMs);
  el.remove();
}

// 【墨焰燃蝕】命中與每回合燃燒時：敵人面板中央浮現「🔥」放大淡出並由下往上飄橘紅小光點
async function playEnemyFlameHitFx(durationMs = 1360) {
  if (!$enemyPanel) return;
  const wrap = document.createElement("div");
  wrap.className = "enemy-flame-burst";
  const emberCoords = [
    { ex: "22%", ey: "-52px", edx: "-6px" },
    { ex: "34%", ey: "-64px", edx: "8px" },
    { ex: "46%", ey: "-58px", edx: "-10px" },
    { ex: "54%", ey: "-68px", edx: "6px" },
    { ex: "66%", ey: "-54px", edx: "10px" },
    { ex: "78%", ey: "-60px", edx: "-8px" },
  ];
  const embersHtml = emberCoords.map(c =>
    `<div class="flame-ember" style="--ex:${c.ex};--ey:${c.ey};--edx:${c.edx};"></div>`
  ).join("");
  wrap.innerHTML = `<div class="flame-icon">🔥</div>${embersHtml}`;
  $enemyPanel.appendChild(wrap);
  await sleep(durationMs);
  wrap.remove();
}

// 【蓄力類】當回合：一圈綠光從對話框周圍向中心聚攏成一顆綠點 ➔ 飛到頂部 Buff 顯示位置變為 Buff 標籤
async function playChargeCondenseToBuffAnim(onBuffAppearCallback) {
  if (!$dialogueStage) {
    if (onBuffAppearCallback) onBuffAppearCallback();
    return;
  }
  const ring = document.createElement("div");
  ring.className = "charge-condense-ring";
  $dialogueStage.appendChild(ring);
  await sleep(780);
  ring.remove();

  const $targetTag = document.getElementById("hero-panel-tag") || document.getElementById("hero-panel-title") || $status;
  await playParticlesBetween($dialogueStage, $targetTag, "#38d399", 1, 700);

  if (onBuffAppearCallback) onBuffAppearCallback();
  const $tag = document.getElementById("hero-panel-tag");
  if ($tag) replayClass($tag, "pop-in");
}

// 【蓄力類】當 Buff 效果消耗後：Buff 標籤化為綠色光點向上向外飛走消失
async function playBuffFlyAwayAnim() {
  const $tag = document.getElementById("hero-panel-tag");
  if (!$tag || !$fxFlightLayer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = $tag.getBoundingClientRect();
  if (r.width <= 0) return;
  const sx = r.left + r.width * 0.5;
  const sy = r.top + r.height * 0.5;

  const dot = document.createElement("div");
  dot.className = "fx-flying-dot";
  dot.style.setProperty("--dot-color", "#38d399");
  dot.style.setProperty("--dot-size", "10px");
  $fxFlightLayer.appendChild(dot);

  const anim = dot.animate([
    { left: sx + "px", top: sy + "px", opacity: 1, transform: "translate(-50%, -50%) scale(1.1)" },
    { left: (sx + 60) + "px", top: Math.max(4, sy - 42) + "px", opacity: 0, transform: "translate(-50%, -50%) scale(0.2)" },
  ], { duration: 840, easing: "ease-out", fill: "forwards" });
  await anim.finished.catch(() => {});
  dot.remove();
}

// 【護盾反震】：受擊後從勇者對話框向外擴散一圈黃色圓形波紋，碰到敵人面板時造成傷害，並持續擴散至螢幕邊界
async function playReflectWaveAnim(onTouchEnemyCallback) {
  if (!$dialogueStage || !$fxFlightLayer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (onTouchEnemyCallback) await onTouchEnemyCallback();
    return;
  }
  const dRect = $dialogueStage.getBoundingClientRect();
  const cx = dRect.left + dRect.width * 0.5;
  const cy = dRect.top + dRect.height * 0.5;
  const maxRadius = Math.hypot(window.innerWidth, window.innerHeight) * 1.15;
  const maxDiam = maxRadius * 2;

  const ring = document.createElement("div");
  ring.className = "reflect-expand-ring";
  ring.style.left = cx + "px";
  ring.style.top = cy + "px";
  $fxFlightLayer.appendChild(ring);

  const totalMs = 1480;
  const touchMs = 460;
  const anim = ring.animate([
    { width: "24px", height: "24px", opacity: 0.98 },
    { width: (maxDiam * 0.42) + "px", height: (maxDiam * 0.42) + "px", opacity: 0.92, offset: 0.35 },
    { width: maxDiam + "px", height: maxDiam + "px", opacity: 0 },
  ], { duration: totalMs, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" });

  await sleep(touchMs);
  let hitPromise = Promise.resolve();
  if (onTouchEnemyCallback) {
    hitPromise = onTouchEnemyCallback();
  }
  await Promise.all([anim.finished.catch(() => {}), hitPromise]);
  ring.remove();
}

// 取得頂部勇者面板常駐 Buff 標籤顯示文字
function getHeroBuffTagText() {
  if (!enemy || !hero) return "";
  const tags = [];
  if (hero.battleStatBonus && hero.battleStatBonus > 0) {
    tags.push(`［✨突破：全屬性+${hero.battleStatBonus}］`);
  }
  const chargeId = hero.activeChargeBuff || (hero.chargeBuffVisible ? hero.pendingChargeSkill : null);
  if (chargeId === "limit_overload") {
    tags.push("［⚡蓄力：攻擊×2.0＋穿盾50%］");
  } else if (chargeId === "condense_qi") {
    tags.push("［🎯凝神：攻擊+25%＋極限穿甲］");
  } else if (chargeId === "bulwark_convert") {
    tags.push(`［🛡️壁壘：攻擊+${Math.max(0, hero.shield)}（護盾附加）］`);
  } else if (chargeId === "full_focus") {
    tags.push("［💥聚氣：總傷害×2.25］");
  } else if (chargeId === "desperate_break") {
    tags.push("［✨突破待發：下回全屬性+5＋重置CD］");
  }
  return tags.join(" ");
}

// 第十版（v10）新增：統一產生勇者與敵人的撲克牌面下方特殊效果提示（選項 A：花色加攻 ＋ K/A 穿盾雙行提示）
function buildPokerSpecialPrompt(atkType, drawnCard) {
  if (!drawnCard) return "";
  const isBlackSuit = (drawnCard.suit.key === "S" || drawnCard.suit.key === "C");
  const suitMatched = (atkType === "phys" && isBlackSuit) || (atkType === "mag" && !isBlackSuit);
  const suitText = suitMatched ? (atkType === "phys" ? "物攻暫時增加！" : "魔攻暫時增加！") : "";

  let rankText = "";
  if (drawnCard.rank === "K") {
    rankText = "【K】無視護盾！";
  } else if (drawnCard.rank === "A") {
    rankText = "【A】無視護盾與部分防禦！";
  }

  const promptLines = [suitText, rankText].filter(Boolean);
  return promptLines.join("<br>");
}

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
// 註：若穿戴測試者無敵套裝 (isTesterItem)，該項數值固定顯示為 999；allowAccessory = true 時計算飾品【勇者之劍】倍率
function calcStats(base, equip, allowAccessory = true) {
  const bBonus = (allowAccessory && hero && enemy && hero.battleStatBonus) ? hero.battleStatBonus : 0;
  let physAtk = (equip.physWeapon && equip.physWeapon.isTesterItem)
    ? TESTER_STAT_VAL
    : (base.physAtk || 0) + (equip.physWeapon ? equip.physWeapon.physAtk : 0) + bBonus;
  let magAtk = (equip.magWeapon && equip.magWeapon.isTesterItem)
    ? TESTER_STAT_VAL
    : (base.magAtk || 0) + (equip.magWeapon ? equip.magWeapon.magAtk : 0) + bBonus;
  const physDef = (equip.armor && equip.armor.isTesterItem)
    ? TESTER_STAT_VAL
    : (base.physDef || 0) + (equip.armor ? equip.armor.physDef : 0) + bBonus;
  const magDef = (equip.armor && equip.armor.isTesterItem)
    ? TESTER_STAT_VAL
    : (base.magDef || 0) + (equip.armor ? equip.armor.magDef : 0) + bBonus;
  const shield = (base.shield || 0) + (equip.shield ? equip.shield.shield : 0);

  if (allowAccessory && equip.accessory && equip.accessory.atkMult && equip.accessory.atkMult > 1) {
    physAtk = Math.floor(physAtk * equip.accessory.atkMult);
    magAtk = Math.floor(magAtk * equip.accessory.atkMult);
  }
  return { physAtk, magAtk, physDef, magDef, shield };
}

function getSkillCategoryBtnClass(cat) {
  if (typeof SKILL_CATEGORY_INFO !== "undefined" && SKILL_CATEGORY_INFO[cat]) {
    return SKILL_CATEGORY_INFO[cat].btnClass;
  }
  if (cat === "attack") return "skill-btn-attack";
  if (cat === "defense") return "skill-btn-defense";
  return "skill-btn-charge";
}

// 二階段心魔複製勇者屬性時，若勇者穿戴的是「測試者 999 無敵套裝」，心魔只複製第 5 層標準數值，避免測試時卡死
function calcMirrorStatsForPhase2(base, equip) {
  const safeEquip = {
    physWeapon: (equip.physWeapon && equip.physWeapon.isTesterItem) ? { physAtk: 21 } : equip.physWeapon,
    magWeapon: (equip.magWeapon && equip.magWeapon.isTesterItem) ? { magAtk: 21 } : equip.magWeapon,
    armor: (equip.armor && equip.armor.isTesterItem) ? { physDef: 20, magDef: 20 } : equip.armor,
    shield: equip.shield,
  };
  return calcStats(base, safeEquip, false);
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

/* ===== 第七版新增：左上角「測試者」按鈕（一鍵獲得 999 無敵套裝 ＋ 自由選擇前往樓層） ===== */
function equipTesterSuit() {
  if (!hero) return;
  hero.equip.physWeapon = { ...TESTER_EQUIP_SET.physWeapon };
  hero.equip.magWeapon = { ...TESTER_EQUIP_SET.magWeapon };
  hero.equip.armor = { ...TESTER_EQUIP_SET.armor };
  hero.hp = hero.maxHp;
}

function jumpToTesterFloor(targetFloor, targetRound = 1) {
  closeTesterModal();
  isBattleDrawerActive = false;
  if ($battleDrawer) $battleDrawer.classList.remove("open");
  if ($battleLog) $battleLog.innerHTML = "";
  enemy = null;
  gameOver = false;

  floor = targetFloor;
  round = targetRound;
  floorDeck = buildFloorDeck(floor);
  hero.maxHp = HERO_BASE.hp + (floor - 1) * FLOOR_HP_BONUS;
  hero.hp = hero.maxHp;
  equipTesterSuit();

  const fInfo = getFloorInfo(floor);
  $log.innerHTML = "";
  log(`【測試者模式】已裝備無敵套裝（物理武器 999、魔法武器 999、物理防禦 999、魔法防禦 999），並傳送至第 ${floor} 層【${fInfo.name}】（第 ${round} 回合）！`, "big");
  presentRound();
}

function openTesterModal() {
  if (!hero) return;
  equipTesterSuit();
  renderStatus();

  if (!$testerModal || !$testerFloorList) return;
  $testerFloorList.innerHTML = "";

  FLOORS.forEach(f => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `前往第 ${f.floor} 層【${f.name}】（第 1 回合）`;
    btn.onclick = () => jumpToTesterFloor(f.floor, 1);
    $testerFloorList.appendChild(btn);
  });

  const btnBoss = document.createElement("button");
  btnBoss.type = "button";
  btnBoss.textContent = "直達第 5 層【文字魔王戰】（第 6 回合）";
  btnBoss.onclick = () => jumpToTesterFloor(5, ROUNDS_PER_FLOOR);
  $testerFloorList.appendChild(btnBoss);

  const btnStay = document.createElement("button");
  btnStay.type = "button";
  btnStay.textContent = "留在當前位置繼續（僅穿戴 999 無敵套裝）";
  btnStay.onclick = () => {
    closeTesterModal();
    log("【測試者模式】已穿戴 999 無敵套裝（物理武器 999、魔法武器 999、物理防禦 999、魔法防禦 999）！", "hit");
    renderStatus();
    if (enemy) showCombatButtons();
  };
  $testerFloorList.appendChild(btnStay);

  $testerModal.classList.remove("hidden");
}

function closeTesterModal() {
  if ($testerModal) $testerModal.classList.add("hidden");
}

const $btnCloseTester = document.getElementById("btn-close-tester");
if ($btnCloseTester) {
  $btnCloseTester.onclick = closeTesterModal;
}
if ($testerModal) {
  $testerModal.addEventListener("click", e => {
    if (e.target === $testerModal) closeTesterModal();
  });
}

function setChoices(list) {
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  $choices.innerHTML = "";
  list.forEach(({ label, action, btnClass, disabled, cdReadyGlow, rippleColor, skillId }) => {
    const b = document.createElement("button");
    if (btnClass) b.className = btnClass;
    if (cdReadyGlow && !disabled) {
      b.classList.add("skill-cd-ready");
    }
    if (skillId) {
      b.dataset.skillId = skillId;
    }
    if (disabled) {
      b.disabled = true;
      b.classList.add("skill-btn-disabled");
    }
    b.innerHTML = colorize(escapeHtml(label));
    b.onclick = () => {
      if (disabled) return;
      if (rippleColor) {
        playSkillButtonEnergyRipple(b, rippleColor);
      }
      b.blur();
      if (action) action();
    };
    $choices.appendChild(b);
  });
}

// 渲染第 1 部分（頂部勇者資訊欄：左上角附「測試者」按鈕；第 3 行順序改為「物攻｜物防｜魔攻｜魔防」）與第 2 部分（敵人對戰卡）
function renderStatus() {
  const s = calcStats(HERO_BASE, hero.equip, true);
  const curShield = enemy ? hero.shield : s.shield;
  if (enemy && curShield > (hero.maxBattleShield || 0)) {
    hero.maxBattleShield = curShield;
  }
  const maxShield = enemy ? Math.max(s.shield, hero.maxBattleShield || 0, curShield) : s.shield;
  const hpCur = Math.max(0, hero.hp);
  const hpPct = hero.maxHp > 0 ? Math.max(0, Math.min(100, (hpCur / hero.maxHp) * 100)) : 0;
  const isHeroHealing = (lastHeroHp !== null && hero.hp >= lastHeroHp);
  lastHeroHp = hero.hp;
  const shCur = Math.max(0, curShield);
  const skillShCur = enemy ? Math.max(0, Math.min(shCur, hero.skillShield || 0)) : 0;
  const baseShCur = Math.max(0, shCur - skillShCur);
  const isHeroShieldGain = (lastHeroShield !== null && shCur >= lastHeroShield);
  lastHeroShield = shCur;
  const shPct = maxShield > 0 ? Math.max(0, Math.min(100, (shCur / maxShield) * 100)) : 0;
  const baseShPct = maxShield > 0 ? Math.max(0, Math.min(100, (baseShCur / maxShield) * 100)) : 0;
  const skillShPct = maxShield > 0 ? Math.max(0, Math.min(100 - baseShPct, (skillShCur / maxShield) * 100)) : 0;

  const fInfo = getFloorInfo(floor);
  const modeTag = gameMode === "poker" ? "［撲克模式］" : "［骰子模式］";
  const stageTitle = (enemy && enemy.isPhase2Boss)
    ? `勇者${modeTag}　精神世界【心魔決戰】`
    : `勇者${modeTag}　第 ${floor} 層【${fInfo.name}】　第 ${round} / ${ROUNDS_PER_FLOOR} 回合`;

  const skillCount = (hero && hero.skills) ? hero.skills.length : 0;
  const skillBtnLabel = skillExpanded ? `技能(${skillCount}/2) ▲` : `技能(${skillCount}/2) ▼`;
  const equipBtnLabel = equipExpanded ? "裝備 ▲" : "裝備 ▼";

  // 第 1 部分：頂部勇者面板（單次建立骨架＋原地更新 DOM 以確保 CSS transition 與白色受傷殘影流暢運作）
  let $heroHpFill = $status.querySelector(".bar-fill.hp-hero");
  if (!$heroHpFill) {
    $status.innerHTML = `
      <div class="panel-row-top">
        <div class="panel-title-group">
          <button type="button" class="tester-btn" id="btn-tester">測試者</button>
          <div class="panel-title" id="hero-panel-title"></div>
          <div class="hero-buff-tag" id="hero-panel-tag"></div>
        </div>
        <div class="header-actions">
          <button type="button" class="mini-btn" id="btn-toggle-skill"></button>
          <button type="button" class="mini-btn" id="btn-toggle-equip"></button>
          <button type="button" class="mini-btn" id="btn-open-history">歷史對話</button>
        </div>
      </div>
      <div class="bars-row">
        <div class="stat-bar-group">
          <span class="stat-label">生命</span>
          <div class="bar-track" id="hero-hp-track">
            <div class="bar-ghost hp-hero-ghost" style="width:${hpPct}%"></div>
            <div class="bar-fill hp-hero" style="width:${hpPct}%"></div>
          </div>
          <span class="stat-num" id="hero-hp-num"></span>
        </div>
        <div class="stat-bar-group">
          <span class="stat-label">護盾</span>
          <div class="bar-track" id="hero-sh-track">
            <div class="bar-ghost shield-ghost hp-hero-sh-ghost" style="width:${shPct}%"></div>
            <div class="bar-fill shield-fill" id="hero-sh-fill" style="width:${baseShPct}%"></div>
            <div class="bar-fill shield-fill-yellow" id="hero-sh-fill-yellow" style="left:${baseShPct}%; width:${skillShPct}%"></div>
          </div>
          <span class="stat-num" id="hero-sh-num"></span>
        </div>
      </div>
      <div class="stats-quad-row" id="hero-stats-quad"></div>
      <div id="skill-drawer" class="hidden"></div>
      <div id="equip-drawer" class="hidden"></div>`;

    const $btnTester = document.getElementById("btn-tester");
    if ($btnTester) $btnTester.onclick = openTesterModal;
    const $btnSkill = document.getElementById("btn-toggle-skill");
    if ($btnSkill) {
      $btnSkill.onclick = () => {
        skillExpanded = !skillExpanded;
        if (skillExpanded) equipExpanded = false;
        renderStatus();
      };
    }
    const $btnEquip = document.getElementById("btn-toggle-equip");
    if ($btnEquip) {
      $btnEquip.onclick = () => {
        equipExpanded = !equipExpanded;
        if (equipExpanded) skillExpanded = false;
        renderStatus();
      };
    }
    const $btnHist = document.getElementById("btn-open-history");
    if ($btnHist) $btnHist.onclick = openHistoryModal;
  }

  const $title = document.getElementById("hero-panel-title");
  if ($title) $title.innerHTML = colorize(escapeHtml(stageTitle));

  const $btnSkill = document.getElementById("btn-toggle-skill");
  if ($btnSkill) {
    $btnSkill.textContent = skillBtnLabel;
    $btnSkill.classList.toggle("active", !!skillExpanded);
  }

  const $btnEquip = document.getElementById("btn-toggle-equip");
  if ($btnEquip) {
    $btnEquip.textContent = equipBtnLabel;
    $btnEquip.classList.toggle("active", !!equipExpanded);
  }

  $heroHpFill = $status.querySelector(".bar-fill.hp-hero");
  const $heroHpGhost = $status.querySelector(".bar-ghost.hp-hero-ghost");
  const $heroShFill = document.getElementById("hero-sh-fill");

  if ($heroHpGhost && $heroHpFill) {
    if (isHeroHealing) {
      $heroHpGhost.classList.add("instant");
      $heroHpGhost.style.width = hpPct + "%";
      $heroHpFill.style.width = hpPct + "%";
    } else {
      $heroHpGhost.classList.remove("instant");
      $heroHpFill.style.width = hpPct + "%";
      $heroHpGhost.style.width = hpPct + "%";
    }
  }
  const $heroTag = document.getElementById("hero-panel-tag");
  if ($heroTag) {
    $heroTag.textContent = getHeroBuffTagText();
  }

  const $heroShYellow = document.getElementById("hero-sh-fill-yellow");
  const $heroShGhost = $status.querySelector(".bar-ghost.hp-hero-sh-ghost");
  if ($heroShGhost && $heroShFill) {
    if (isHeroShieldGain) {
      $heroShGhost.classList.add("instant");
      $heroShGhost.style.width = shPct + "%";
      $heroShFill.style.width = baseShPct + "%";
    } else {
      $heroShGhost.classList.remove("instant");
      $heroShFill.style.width = baseShPct + "%";
      $heroShGhost.style.width = shPct + "%";
    }
  } else if ($heroShFill) {
    $heroShFill.style.width = baseShPct + "%";
  }
  if ($heroShYellow) {
    $heroShYellow.style.left = baseShPct + "%";
    $heroShYellow.style.width = skillShPct + "%";
  }

  const $hpNum = document.getElementById("hero-hp-num");
  if ($hpNum) $hpNum.textContent = `${hpCur} / ${hero.maxHp}`;
  const $shNum = document.getElementById("hero-sh-num");
  if ($shNum) $shNum.textContent = `${Math.max(0, curShield)} / ${maxShield}`;

  const $quad = document.getElementById("hero-stats-quad");
  if ($quad) {
    $quad.innerHTML = `
      <div class="stat-cell" id="hero-stat-physAtk">物攻 <span class="val">${s.physAtk}</span></div>
      <div class="stat-cell" id="hero-stat-physDef">物防 <span class="val">${s.physDef}</span></div>
      <div class="stat-cell" id="hero-stat-magAtk">魔攻 <span class="val">${s.magAtk}</span></div>
      <div class="stat-cell" id="hero-stat-magDef">魔防 <span class="val">${s.magDef}</span></div>`;
  }

  const $skillDrawer = document.getElementById("skill-drawer");
  if ($skillDrawer) {
    $skillDrawer.classList.toggle("hidden", !skillExpanded);
    const heroSkills = (hero && hero.skills) ? hero.skills : [];
    let skillsHtml = `<div class="floating-drawer-header"><span>已裝備局內技能（${heroSkills.length} / ${MAX_EQUIPPED_SKILLS}）</span><button type="button" class="mini-btn" id="btn-close-skill-drawer">✕ 關閉</button></div>`;
    if (heroSkills.length === 0) {
      skillsHtml += `<div class="dim">尚未領悟任何技能（可於探索途中選擇「戰技殘頁」事件抽取領悟）。</div>`;
    } else {
      heroSkills.forEach((sk, idx) => {
        const cdLeft = (hero.skillCooldowns && hero.skillCooldowns[sk.id]) ? hero.skillCooldowns[sk.id] : 0;
        const cdTag = enemy
          ? (cdLeft > 0 ? `冷卻中（剩餘 ${cdLeft} 回合）` : "立即可用")
          : `冷卻 ${sk.cd} 回合（每戰重置）`;
        skillsHtml += `
          <div class="skill-detail-card cat-${sk.category}">
            <div class="skill-detail-title">
              <span>槽位 ${idx + 1}：【${escapeHtml(sk.name)}】</span>
              <span class="skill-cat-badge cat-${sk.category}">${escapeHtml(sk.categoryLabel)}｜${escapeHtml(cdTag)}</span>
            </div>
            <div class="skill-detail-desc">${escapeHtml(sk.desc)}</div>
          </div>`;
      });
    }
    $skillDrawer.innerHTML = skillsHtml;
    const $btnCloseSk = document.getElementById("btn-close-skill-drawer");
    if ($btnCloseSk) {
      $btnCloseSk.onclick = () => {
        skillExpanded = false;
        renderStatus();
      };
    }
  }

  const $drawer = document.getElementById("equip-drawer");
  if ($drawer) {
    $drawer.classList.toggle("hidden", !equipExpanded);
    $drawer.innerHTML = `
      <div class="floating-drawer-header"><span>當前穿戴文字裝備（共 5 格）</span><button type="button" class="mini-btn" id="btn-close-equip-drawer">✕ 關閉</button></div>
      <div>物理武器：${escapeHtml(itemText(hero.equip.physWeapon))}</div>
      <div>魔法武器：${escapeHtml(itemText(hero.equip.magWeapon))}</div>
      <div>裝甲：${escapeHtml(itemText(hero.equip.armor))}</div>
      <div>盾牌：${escapeHtml(itemText(hero.equip.shield))}</div>
      <div>飾品：${escapeHtml(itemText(hero.equip.accessory))}</div>`;
    const $btnCloseEq = document.getElementById("btn-close-equip-drawer");
    if ($btnCloseEq) {
      $btnCloseEq.onclick = () => {
        equipExpanded = false;
        renderStatus();
      };
    }
  }

  // 第 2 部分：獨立 3 行「敵人對戰卡」（原地更新 DOM 保留生命殘影與護盾平滑過渡）
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
    if (enemy.burnTurns && enemy.burnTurns > 0) {
      weakNote += (weakNote ? " " : "") + `［🔥燃燒：剩 ${enemy.burnTurns} 回合］`;
    }

    const eHpCur = Math.max(0, enemy.hp);
    const eHpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (eHpCur / enemy.maxHp) * 100)) : 0;
    const isEnemyHealing = (lastEnemyHp !== null && enemy.hp >= lastEnemyHp);
    lastEnemyHp = enemy.hp;
    const eShMax = enemy.maxShield || 0;
    const eShCur = Math.max(0, enemy.shield);
    const isEnemyShieldGain = (lastEnemyShield !== null && eShCur >= lastEnemyShield);
    lastEnemyShield = eShCur;
    const eShPct = eShMax > 0 ? Math.max(0, Math.min(100, (eShCur / eShMax) * 100)) : 0;

    const pDefHtml = enemy.weakness === "phys"
      ? `<span class="debuff">${enemy.curPhysDef}↓</span>`
      : `<span class="val">${enemy.curPhysDef}</span>`;
    const mDefHtml = enemy.weakness === "mag"
      ? `<span class="debuff">${enemy.curMagDef}↓</span>`
      : `<span class="val">${enemy.curMagDef}</span>`;

    let $eHpFill = $enemyPanel.querySelector(".bar-fill.hp-enemy");
    if (!$eHpFill || lastRenderedEnemyRef !== enemy) {
      lastRenderedEnemyRef = enemy;
      $enemyPanel.innerHTML = `
        <div class="enemy-panel-slash" aria-hidden="true"></div>
        <div class="enemy-panel-slash-2" aria-hidden="true"></div>
        ${buildShieldFxLayerHtml(false)}
        <div class="panel-row-top">
          <div class="panel-title" id="enemy-panel-title"></div>
          <div class="enemy-tag" id="enemy-panel-tag"></div>
        </div>
        <div class="bars-row">
          <div class="stat-bar-group">
            <span class="stat-label">生命</span>
            <div class="bar-track">
              <div class="bar-ghost hp-enemy-ghost" style="width:${eHpPct}%"></div>
              <div class="bar-fill hp-enemy" style="width:${eHpPct}%"></div>
            </div>
            <span class="stat-num" id="enemy-hp-num"></span>
          </div>
          <div class="stat-bar-group">
            <span class="stat-label">護盾</span>
            <div class="bar-track" id="enemy-sh-track">
              <div class="bar-ghost shield-ghost hp-enemy-sh-ghost" style="width:${eShPct}%"></div>
              <div class="bar-fill shield-fill" id="enemy-sh-fill" style="width:${eShPct}%"></div>
            </div>
            <span class="stat-num" id="enemy-sh-num"></span>
          </div>
        </div>
        <div class="stats-quad-row" id="enemy-stats-quad"></div>`;
    }

    const $eTitle = document.getElementById("enemy-panel-title");
    if ($eTitle) $eTitle.innerHTML = `敵人：${colorize(escapeHtml(enemy.name))}`;
    const $eTag = document.getElementById("enemy-panel-tag");
    if ($eTag) $eTag.textContent = weakNote;

    $eHpFill = $enemyPanel.querySelector(".bar-fill.hp-enemy");
    const $eHpGhost = $enemyPanel.querySelector(".bar-ghost.hp-enemy-ghost");
    const $eShFill = document.getElementById("enemy-sh-fill");

    if ($eHpGhost && $eHpFill) {
      if (isEnemyHealing) {
        $eHpGhost.classList.add("instant");
        $eHpGhost.style.width = eHpPct + "%";
        $eHpFill.style.width = eHpPct + "%";
      } else {
        $eHpGhost.classList.remove("instant");
        $eHpFill.style.width = eHpPct + "%";
        $eHpGhost.style.width = eHpPct + "%";
      }
    }
    const $eShGhost = $enemyPanel.querySelector(".bar-ghost.hp-enemy-sh-ghost");
    if ($eShGhost && $eShFill) {
      if (isEnemyShieldGain) {
        $eShGhost.classList.add("instant");
        $eShGhost.style.width = eShPct + "%";
        $eShFill.style.width = eShPct + "%";
      } else {
        $eShGhost.classList.remove("instant");
        $eShFill.style.width = eShPct + "%";
        $eShGhost.style.width = eShPct + "%";
      }
    } else if ($eShFill) {
      $eShFill.style.width = eShPct + "%";
    }

    const $eHpNum = document.getElementById("enemy-hp-num");
    if ($eHpNum) $eHpNum.textContent = `${eHpCur} / ${enemy.maxHp}`;
    const $eShNum = document.getElementById("enemy-sh-num");
    if ($eShNum) $eShNum.textContent = `${eShCur} / ${eShMax}`;

    const $eQuad = document.getElementById("enemy-stats-quad");
    if ($eQuad) {
      $eQuad.innerHTML = `
        <div class="stat-cell" id="enemy-stat-physAtk">物攻 <span class="val">${enemy.physAtk}</span></div>
        <div class="stat-cell" id="enemy-stat-physDef">物防 ${pDefHtml}</div>
        <div class="stat-cell" id="enemy-stat-magAtk">魔攻 <span class="val">${enemy.magAtk}</span></div>
        <div class="stat-cell" id="enemy-stat-magDef">魔防 ${mDefHtml}</div>`;
    }

    $enemyPanel.classList.remove("hidden");
  } else if ($enemyPanel) {
    lastRenderedEnemyRef = null;
    $enemyPanel.classList.add("hidden");
  }
}

/* ===== 第九版新增：裝備紫色文字縮小消失動畫（2.5 秒無二次閃退）與全螢幕文字轉場 ===== */
async function playEquipTextAnim(char) {
  const $ov = document.getElementById("equip-anim-overlay");
  if (!$ov) return;
  const $char = $ov.querySelector(".equip-anim-char");
  if ($char) $char.textContent = char;
  $ov.classList.remove("hidden", "animating");
  void $ov.offsetWidth;
  $ov.classList.add("show", "animating");
  await sleep(2500);
  // 先僅移除 show 讓背景平滑淡出，保留 animating 讓文字維持在縮小至 0 的終點狀態，絕不二次閃現
  $ov.classList.remove("show");
  await sleep(300);
  $ov.classList.remove("animating");
  $ov.classList.add("hidden");
}

async function playFadeOutTextScreen(text, color = "#ffd23f", withScanline = false, durationMs = 2800) {
  const $ov = document.getElementById("text-fade-overlay");
  if (!$ov) return;
  const $cnt = $ov.querySelector(".fade-content");
  if ($cnt) {
    $cnt.textContent = text;
    $cnt.style.color = color;
  }
  $ov.style.setProperty("--fade-text-ms", durationMs + "ms");
  $ov.classList.remove("hidden", "animating", "with-scanline");
  if (withScanline) $ov.classList.add("with-scanline");
  void $ov.offsetWidth;
  $ov.classList.add("show", "animating");
  await sleep(durationMs);
  $ov.classList.remove("show");
  await sleep(300);
  $ov.classList.remove("animating", "with-scanline");
  $ov.classList.add("hidden");
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

async function rollPokerAnim(who, color, card, note, specialPrompt = "") {
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

  // 第九版更新：抽牌動畫完結前撲克下方不提前顯示提示
  $note.innerHTML = "";

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

  $drawnWrap.className = "drawn-card-wrapper landed" + (card.forceAcePierce ? " force-max-green-glow" : "");
  const isLetter = (card.rank === "A" || card.rank === "J" || card.rank === "Q" || card.rank === "K");
  const hint = isLetter ? `（${card.rank} 代表數字 ${card.value}）` : `（點數 ${card.value}）`;
  $stage.textContent = "抽牌結果";
  $badge.textContent = `抽中：${card.suit.name} ${card.label} ${hint}`;

  // 第九版更新：抽牌動畫完結後才顯示特殊效果提示（支援雙行並列），並在此定格停留 1 秒（POKER_HOLD_MS）
  if (specialPrompt) {
    $note.innerHTML = `<span class="poker-special-hint">${specialPrompt}</span>`;
  } else {
    $note.innerHTML = "";
  }

  await sleep(POKER_HOLD_MS);
  $pokerDraw.classList.remove("show");
  await sleep(120);
}

async function rollDiceAnim(who, color, result, note, isForceMaxGreen = false) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $who = $dice.querySelector(".who"), $face = $dice.querySelector(".face"), $note = $dice.querySelector(".note");
  $who.innerHTML = colorize(escapeHtml(who)) + " 擲骰";
  $who.style.color = color || "#e8e8e8";
  $note.innerHTML = colorize(escapeHtml(note || ""));
  $face.classList.remove("landed", "force-max-green-glow");
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
  if (isForceMaxGreen) $face.classList.add("force-max-green-glow");
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

// 第八版更新：魔王過場文字停留5秒，並支援點擊螢幕任意處或按鍵立即跳過該段文字前往下一段
async function storyTextAnim(text, customDuration = STORY_BOSS_LINE_MS) {
  const $t = document.querySelector("#story .text");
  $t.innerHTML = colorize(escapeHtml(text));

  const total = customDuration;
  const showRatio = 0.08;
  const holdRatio = 0.84;

  return new Promise((resolve) => {
    let finished = false;
    let anim = null;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("pointerdown", onSkip, true);
      window.removeEventListener("keydown", onSkip, true);
      if (anim) {
        try { anim.cancel(); } catch (e) {}
      }
      $t.style.opacity = "0";
      resolve();
    };

    const onSkip = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cleanup();
    };

    window.addEventListener("pointerdown", onSkip, { capture: true, once: true });
    window.addEventListener("keydown", onSkip, { capture: true, once: true });

    anim = $t.animate([
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: showRatio },
      { opacity: 1, offset: holdRatio },
      { opacity: 0, offset: 1 },
    ], { duration: total, easing: "ease-in-out", fill: "forwards" });

    anim.finished.then(() => {
      cleanup();
    }).catch(() => {
      cleanup();
    });
  });
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
  if ($sword) {
    replayClass($sword, "show");
    await sleep(SWORD_MS);
    $sword.classList.remove("show");
  }
}

// 第八版／第十二版升級：在敵人面板上劈砍動畫（支援普通白刀光與各技能專屬刀光變體，不震動螢幕）
const ALL_SLASH_CLASSES = [
  "slash-hit",
  "slash-x-red",
  "slash-bl-tr-crimson",
  "slash-flame-orange",
  "slash-thick-red-edge",
  "slash-thick-green-2x",
  "slash-thick-yellowgreen",
];

async function enemyPanelSlashAnim(variantClass = "slash-hit") {
  const $ep = document.getElementById("enemy-panel");
  if (!$ep) return;
  $ep.classList.remove(...ALL_SLASH_CLASSES);
  void $ep.offsetWidth;
  const cls = variantClass || "slash-hit";
  $ep.classList.add(cls);
  const dur = (cls === "slash-hit") ? SWORD_MS : (SWORD_MS * 2);
  await sleep(dur);
  $ep.classList.remove(...ALL_SLASH_CLASSES);
}

// 第十版（v10）升級：敵人面板受擊反饋（護盾破碎 ➔ shatter-ice-shield；護盾完全擋下 ➔ glow-ice-shield；扣HP ➔ glow-red；0傷防禦 ➔ glow-gold）
async function enemyHitAnim(lostHp, shieldState = "none") {
  const $ep = document.getElementById("enemy-panel");
  if (!$ep) return;
  const $eShTrack = document.getElementById("enemy-sh-track");
  $ep.classList.remove("glow-gold", "glow-red", "glow-ice-shield", "shatter-ice-shield");
  if ($eShTrack) $eShTrack.classList.remove("shield-track-glow", "shield-track-shatter");
  void $ep.offsetWidth;

  let waitMs = HIT_MS;
  if (shieldState === "shatter") {
    replayClass($ep, "shatter-ice-shield");
    if ($eShTrack) replayClass($eShTrack, "shield-track-shatter");
    waitMs = 760;
  } else if (shieldState === "block") {
    replayClass($ep, "glow-ice-shield");
    if ($eShTrack) replayClass($eShTrack, "shield-track-glow");
    waitMs = 650;
  } else if (lostHp) {
    replayClass($ep, "glow-red");
  } else {
    replayClass($ep, "glow-gold");
  }
  await sleep(waitMs);
  $ep.classList.remove("glow-gold", "glow-red", "glow-ice-shield", "shatter-ice-shield");
  if ($eShTrack) $eShTrack.classList.remove("shield-track-glow", "shield-track-shatter");
}

// 第十版／第十二版升級：勇者受擊反饋（支援原本藍色護盾與技能黃色護盾之光效與碎裂碎片區分）
async function heroHitAnim(lostHp, shieldState = "none") {
  const $g = document.getElementById("game");
  const $box = $dialogueStage || $log;
  const $hShTrack = document.getElementById("hero-sh-track");
  ensureDialogueShieldFxLayer();

  $box.classList.remove(
    "glow-gold", "glow-red",
    "glow-ice-shield", "shatter-ice-shield",
    "glow-yellow-shield", "shatter-yellow-shield"
  );
  $g.classList.remove("shake");
  if ($hShTrack) {
    $hShTrack.classList.remove(
      "shield-track-glow", "shield-track-shatter",
      "shield-track-glow-yellow", "shield-track-shatter-yellow"
    );
  }
  void $box.offsetWidth;

  let waitMs = HIT_MS;
  if (shieldState === "shatter-yellow") {
    replayClass($box, "shatter-yellow-shield");
    if ($hShTrack) replayClass($hShTrack, "shield-track-shatter-yellow");
    waitMs = 1520;
  } else if (shieldState === "block-yellow") {
    replayClass($box, "glow-yellow-shield");
    if ($hShTrack) replayClass($hShTrack, "shield-track-glow-yellow");
    waitMs = 1300;
  } else if (shieldState === "shatter") {
    replayClass($box, "shatter-ice-shield");
    replayClass($g, "shake");
    if ($hShTrack) replayClass($hShTrack, "shield-track-shatter");
    waitMs = 760;
  } else if (shieldState === "block") {
    replayClass($box, "glow-ice-shield");
    if ($hShTrack) replayClass($hShTrack, "shield-track-glow");
    waitMs = 650;
  } else if (lostHp) {
    replayClass($box, "glow-red");
    replayClass($g, "shake");
  } else {
    replayClass($box, "glow-gold");
  }
  await sleep(waitMs);
  $box.classList.remove(
    "glow-gold", "glow-red",
    "glow-ice-shield", "shatter-ice-shield",
    "glow-yellow-shield", "shatter-yellow-shield"
  );
  $g.classList.remove("shake");
  if ($hShTrack) {
    $hShTrack.classList.remove(
      "shield-track-glow", "shield-track-shatter",
      "shield-track-glow-yellow", "shield-track-shatter-yellow"
    );
  }
}

/* =========================================================
   1–5 層幕後事件池與爬塔流程（方案 B：營地回 60% 最大生命，殘頁篝火回 45% 最大生命）
   ========================================================= */

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
        label: "在營地生火休息，回復 60% 最大生命",
      };
    } else {
      return {
        id: `fl${fl}_card${idx}_${Math.random()}`,
        type: "skill_camp",
        label: "發現前人遺留的戰技殘頁，領悟技能",
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
  skillExpanded = false;
  isBattleDrawerActive = false;
  historyLogs = [];
  if ($battleDrawer) $battleDrawer.classList.remove("open");
  if ($battleLog) $battleLog.innerHTML = "";
  closeHistoryModal();
  closeTesterModal();
  lastHeroHp = HERO_BASE.hp;
  lastEnemyHp = null;
  lastHeroShield = HERO_BASE.shield;
  lastEnemyShield = null;
  lastRenderedEnemyRef = null;
  ensureDialogueShieldFxLayer();

  hero = {
    hp: HERO_BASE.hp,
    maxHp: HERO_BASE.hp,
    shield: 0,
    skillShield: 0,
    maxBattleShield: 0,
    equip: { physWeapon: null, magWeapon: null, armor: null, shield: null, accessory: null },
    skills: [],
    skillCooldowns: {},
    justReadySkills: {},
    battleStatBonus: 0,
    pendingChargeSkill: null,
    activeChargeBuff: null,
    chargeBuffVisible: false,
    turnBuff: {},
    usedSkillThisTurn: null,
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
            triggerPortalChestFlow();
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
    camp();
  } else {
    triggerSkillCardEvent();
  }
}

// 完成當前事件後推進到下一回合
function advanceAfterEvent() {
  round++;
  presentRound();
}

/* ===== 營地回復（方案 B：營地回復 60% 最大生命） ===== */
function camp() {
  const healTarget = Math.max(1, Math.floor(hero.maxHp * CAMP_HEAL_RATIO));
  const beforeHp = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + healTarget);
  const healed = hero.hp - beforeHp;
  log(`你在營地生火休息（回復 60% 最大生命）。生命回復 ${healed} 點，現在是 ${hero.hp} / ${hero.maxHp}。`);
  triggerHeroHealVisual(healed);
  setChoices([{ label: "繼續前進", action: advanceAfterEvent }]);
}

/* ===== 第十一版（v11）新增：樓層技能牌「三選一」抽取、滿槽替換與放棄無補償機制 ===== */
function triggerSkillCardEvent() {
  const ownedIds = new Set((hero.skills || []).map(s => s.id));
  const unownedPool = SKILLS.filter(s => !ownedIds.has(s.id));
  const candidates = drawFromDeck(unownedPool, SKILL_DRAW_COUNT);

  log("你在斷壁殘垣間發現了前人遺留的「戰技殘頁」，上面浮現出三道截然不同的戰技刻印：", "big");
  candidates.forEach((sk, idx) => {
    log(`${idx + 1}. 【${sk.name}】（${sk.categoryLabel}）— ${sk.desc}`);
  });
  if (hero.skills.length > 0) {
    const curNames = hero.skills.map(s => `【${s.name}】`).join("、");
    log(`目前裝備技能（${hero.skills.length} / ${MAX_EQUIPPED_SKILLS}）：${curNames}`, "dim");
  } else {
    log(`目前裝備技能（0 / ${MAX_EQUIPPED_SKILLS}）：尚未裝備任何技能。`, "dim");
  }
  renderStatus();

  const renderCandidateChoices = () => {
    const choiceList = candidates.map(sk => ({
      label: `領悟【${sk.name}】（${sk.categoryLabel}｜冷卻 ${sk.cd} 回合）`,
      btnClass: getSkillCategoryBtnClass(sk.category),
      rippleColor: getSkillColorByCategory(sk.category),
      action: () => onPickSkillCandidate(sk, renderCandidateChoices),
    }));
    choiceList.push({
      label: "放棄，不學習新技能（直接繼續前進）",
      action: () => {
        log("你合上戰技殘頁，未領悟新技能，繼續踏上旅途。");
        advanceAfterEvent();
      },
    });
    setChoices(choiceList);
  };

  renderCandidateChoices();
}

async function onPickSkillCandidate(newSkill, backToCandidatesFn) {
  if (hero.skills.length < MAX_EQUIPPED_SKILLS) {
    setChoices([]);
    hero.skills.push({ ...newSkill });
    hero.skillCooldowns[newSkill.id] = 0;
    log(`你成功領悟並裝備了${newSkill.categoryLabel}技能：【${newSkill.name}】！`, "hit");
    renderStatus();
    await playSkillAcquireAnim(newSkill);
    setChoices([{ label: "繼續前進", action: advanceAfterEvent }]);
    return;
  }

  // 已滿 2 個技能槽位：詢問玩家要捨棄哪一個舊技能（被捨棄的舊技能自動回池）
  log(`你目前已裝備 ${MAX_EQUIPPED_SKILLS} 個技能，請選擇要捨棄哪一個舊技能以替換為【${newSkill.name}】：`, "big");
  const replaceChoices = hero.skills.map((oldSk, slotIdx) => ({
    label: `捨棄【${oldSk.name}】，替換為【${newSkill.name}】`,
    btnClass: getSkillCategoryBtnClass(newSkill.category),
    rippleColor: getSkillColorByCategory(newSkill.category),
    action: async () => {
      setChoices([]);
      const removed = hero.skills[slotIdx];
      delete hero.skillCooldowns[removed.id];
      hero.skills[slotIdx] = { ...newSkill };
      hero.skillCooldowns[newSkill.id] = 0;
      log(`你捨棄了【${removed.name}】（已歸還至技能池），並裝備了新技能【${newSkill.name}】！`, "hit");
      renderStatus();
      await playSkillAcquireAnim(newSkill);
      setChoices([{ label: "繼續前進", action: advanceAfterEvent }]);
    },
  }));
  replaceChoices.push({
    label: "返回重新選擇",
    action: () => {
      log("你取消了替換，重新檢視三道戰技殘頁：", "dim");
      backToCandidatesFn();
    },
  });
  setChoices(replaceChoices);
}

/* ===== 第 6 回合：跨層寶箱與傳送門完整動畫鏈（第九版升級，延長開箱 2.8 秒與傳送門 3.0 秒） ===== */
async function triggerPortalChestFlow() {
  setChoices([]); // 禁用點擊防跳過

  // 1. 播放開寶箱全螢幕文字動畫（延長至 2.8 秒，變暗＋黃字淡出）
  await playFadeOutTextScreen("古老的寶箱緩緩開啟...", "#ffd23f", false, 2800);

  // 2. 開出秘寶並顯示於 log 中
  const pool = FLOOR_CHEST_ITEMS[floor] || FLOOR_CHEST_ITEMS[1];
  const item = randomPick(pool);
  log(`你打開了第 ${floor} 層的跨層寶箱，從 4 件秘寶中抽出了${SLOT_NAME[item.slot]}：${itemText(item)}！`, "big");

  // 3. 詢問玩家是否替換裝備
  const old = hero.equip[item.slot];
  log(`目前的${SLOT_NAME[item.slot]}：${itemText(old)}。`, "dim");
  renderStatus();

  setChoices([
    {
      label: old ? `替換 ${item.name}（替換掉 ${old.name}）` : `裝備 ${item.name}`,
      action: async () => {
        setChoices([]);
        hero.equip[item.slot] = item;
        log(`你裝備了 ${itemText(item)}。`);
        if (item.textDesc) {
          log(`「${item.textDesc}」`, "text-curse");
        } else {
          log(`「${SLOT_NAME[item.slot]}部位變爲文字了.....但是獲得了更強的力量。」`, "text-curse");
        }
        renderStatus();

        // 4. 若替換，播放裝備紫色「x」字縮小淡出動畫（2.5 秒無二次閃退）
        const match = (item.textDesc && !item.isHeroSword && !item.isTesterItem)
          ? item.textDesc.match(/「(.)」/)
          : null;
        if (match) {
          await playEquipTextAnim(match[1]);
        }

        // 5. 播放傳送門全螢幕文字動畫（延長至 3.0 秒，變暗＋黃字淡出＋白色掃描線雙重閃爍）
        await playFadeOutTextScreen("踏入扭曲的原典傳送門...", "#ffd23f", true, 3000);
        enterNextFloorPortal();
      }
    },
    {
      label: "不要，保留現有裝備",
      action: async () => {
        setChoices([]);
        log(`你放棄了 ${item.name}。`);
        // 放棄更換時直接播放傳送門動畫（3.0 秒）
        await playFadeOutTextScreen("踏入扭曲的原典傳送門...", "#ffd23f", true, 3000);
        enterNextFloorPortal();
      }
    }
  ]);
}

function enterNextFloorPortal() {
  floor++;
  round = 1;
  floorDeck = buildFloorDeck(floor);
  hero.maxHp += FLOOR_HP_BONUS;
  const beforeHp = hero.hp;
  hero.hp = Math.min(hero.maxHp, hero.hp + FLOOR_HP_BONUS);
  const healed = hero.hp - beforeHp;
  const fInfo = getFloorInfo(floor);

  // 每層清空一次一般對話框（歷史紀錄仍完整保留於 historyLogs）
  $log.innerHTML = "";
  log(`你踏入傳送門，成功抵達第 ${floor} 層【${fInfo.name}】！`, "big");
  log(`跨層祝福發動：勇者最大生命 +${FLOOR_HP_BONUS}，並回復 ${FLOOR_HP_BONUS} 點生命（目前生命 ${hero.hp} / ${hero.maxHp}）。`, "hit");
  log(`── 進入第 ${floor} 層【${fInfo.name}】：${fInfo.desc}`, "big");
  presentRound();
  triggerHeroHealVisual(healed);
}

/* ===== 拾取裝備（替換同部位 + 身體文字化演繹） ===== */
function offerItem(item, onDone) {
  const old = hero.equip[item.slot];
  log(`目前的${SLOT_NAME[item.slot]}：${itemText(old)}。`, "dim");
  renderStatus();
  setChoices([
    {
      label: old ? `拾取 ${item.name}（替換掉 ${old.name}）` : `拾取 ${item.name}`,
      action: async () => {
        setChoices([]);
        hero.equip[item.slot] = item;
        log(`你裝備了 ${itemText(item)}。`);
        if (item.textDesc) {
          log(`「${item.textDesc}」`, "text-curse");
        } else {
          log(`「${SLOT_NAME[item.slot]}部位變爲文字了.....但是獲得了更強的力量。」`, "text-curse");
        }
        renderStatus();

        // 第九版新增：抓取引號中的「x」字進行紫色文字縮小消失動畫（延長至 2.5 秒且無二次閃現）
        const match = (item.textDesc && !item.isHeroSword && !item.isTesterItem)
          ? item.textDesc.match(/「(.)」/)
          : null;
        if (match) {
          await playEquipTextAnim(match[1]);
        }
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

/* =========================================================
   第十一版（v11）：戰鬥二階段按鈕流程（階段1：技能選擇［紅/藍/綠分類邊框］➔ 階段2：物理／魔法攻擊）
   ========================================================= */

function canCastSkill(sk) {
  if (!enemy || !hero || hero.hp <= 0) return { ok: false, reason: "" };
  const cdLeft = (hero.skillCooldowns && hero.skillCooldowns[sk.id]) ? hero.skillCooldowns[sk.id] : 0;
  if (cdLeft > 0) {
    return { ok: false, reason: `(冷卻${cdLeft})` };
  }
  if (sk.hpLimitRatio) {
    const limitHp = Math.floor(hero.maxHp * sk.hpLimitRatio);
    if (hero.hp > limitHp) {
      return { ok: false, reason: `(需生命≤${limitHp})` };
    }
  }
  return { ok: true, reason: "" };
}

// 回合開始：結算上一回合蓄力覺醒狀態，並進入第一階段（技能選擇）或第二階段（攻擊選擇）
async function beginHeroTurn() {
  if (!enemy || !hero || hero.hp <= 0) return;
  hero.turnBuff = {};
  hero.usedSkillThisTurn = null;
  if ($dialogueStage) {
    $dialogueStage.classList.remove("crystal-wall-active", "charge-dmg-reduce-active");
  }

  // 若上一回合施放了【蓄力類】技能，於本回合開始時顯露效果！
  if (hero.pendingChargeSkill) {
    const pendingId = hero.pendingChargeSkill;
    hero.pendingChargeSkill = null;

    if (pendingId === "desperate_break") {
      // 【絕境突破】下回合開始覺醒：綠光飛入四格屬性（各閃綠光浮現 +5）與另一個技能按鈕（閃光重置 CD），且 Buff 標籤改為常駐顯示「［✨突破：全屬性+5］」
      let refreshedSkillId = null;
      let refreshedName = "";
      (hero.skills || []).forEach(sk => {
        if (sk.id !== "desperate_break") {
          hero.skillCooldowns[sk.id] = 0;
          hero.justReadySkills[sk.id] = true;
          refreshedSkillId = sk.id;
          refreshedName = sk.name;
        }
      });

      const $fromTag = document.getElementById("hero-panel-tag") || $status;
      const statIds = ["hero-stat-physAtk", "hero-stat-physDef", "hero-stat-magAtk", "hero-stat-magDef"];
      const flyPromises = statIds.map(id => {
        const $cell = document.getElementById(id);
        return $cell ? playParticlesBetween($fromTag, $cell, "#38d399", 1, 760) : Promise.resolve();
      });
      await Promise.all(flyPromises);

      hero.battleStatBonus = (hero.battleStatBonus || 0) + 5;
      hero.chargeBuffVisible = false;
      renderStatus();

      statIds.forEach(id => {
        const $cell = document.getElementById(id);
        if ($cell) {
          replayClass($cell, "stat-flash-green");
          spawnFloatingPlus($cell, "+5", false);
        }
      });

      const refreshMsg = refreshedName ? `，且【${refreshedName}】冷卻時間已完全重置` : "";
      log(`【絕境突破・覺醒】潛能徹底爆發！勇者物攻、物防、魔攻、魔防永久 +5（持續至本場戰鬥結束）${refreshMsg}！`, "hit");

      showCombatButtons();
      if (refreshedSkillId && $choices) {
        const $refBtn = $choices.querySelector(`button[data-skill-id="${refreshedSkillId}"]`);
        if ($refBtn) {
          playParticlesBetween($fromTag, $refBtn, "#38d399", 2, 720).then(() => {
            replayClass($refBtn, "skill-cd-ready");
          });
        }
      }
      return;
    } else {
      hero.activeChargeBuff = pendingId;
      hero.chargeBuffVisible = true;
      if (pendingId === "full_focus") {
        log("【全神蓄勢・爆發就緒】蓄力完成！下次發動的物理或魔法普通攻擊將造成 2.25 倍最終總傷害！", "hit");
      } else if (pendingId === "condense_qi") {
        log("【凝神聚氣・爆發就緒】鎖定敵方命門！下次普通攻擊基礎攻擊力 +25%，且必定觸發極限點數與穿盾破甲！", "hit");
      } else if (pendingId === "limit_overload") {
        log("【極限過載・爆發就緒】能量全面過載！下次普通攻擊未計算前基礎攻擊力直接翻倍（×2.0），且無視敵方 50% 護盾！", "hit");
      } else if (pendingId === "bulwark_convert") {
        log(`【壁壘轉化・爆發就緒】壁壘能量匯聚於兵刃！下次普通攻擊將全額附加當前剩餘護盾值（基礎攻擊力 +${hero.shield}）！`, "hit");
      }
    }
  }

  renderStatus();
  showCombatButtons();
}

// 第一階段：若已裝備技能且本回合尚未施放技能，先顯示【技能一】、【技能二】、【不使用技能】
function showCombatButtons() {
  if (!enemy || !hero || hero.hp <= 0) return;
  if (!hero.skills || hero.skills.length === 0 || hero.usedSkillThisTurn) {
    showAttackButtons();
    return;
  }

  const stage1Choices = hero.skills.map(sk => {
    const check = canCastSkill(sk);
    const btnText = check.ok ? `【${sk.name}】` : `【${sk.name} ${check.reason}】`;
    const isJustReady = !!(hero.justReadySkills && hero.justReadySkills[sk.id] && check.ok);
    if (isJustReady) {
      delete hero.justReadySkills[sk.id];
    }
    return {
      label: btnText,
      btnClass: getSkillCategoryBtnClass(sk.category),
      rippleColor: getSkillColorByCategory(sk.category),
      cdReadyGlow: isJustReady,
      skillId: sk.id,
      disabled: !check.ok,
      action: () => useCombatSkill(sk),
    };
  });

  stage1Choices.push({
    label: "【不使用技能】",
    action: () => showAttackButtons(),
  });

  setChoices(stage1Choices);
}

// 第二階段：顯示【物理攻擊】與【魔法攻擊】按鈕（僅顯示技能與武器名稱，保持極簡）
function showAttackButtons() {
  if (!enemy || !hero || hero.hp <= 0) return;
  const wPhys = hero.equip.physWeapon ? hero.equip.physWeapon.name : "徒手";
  const wMag = hero.equip.magWeapon ? hero.equip.magWeapon.name : "基礎魔力";
  const hasSwordMult = (hero.equip.accessory && hero.equip.accessory.isHeroSword && hero.equip.accessory.atkMult > 1);
  const swordTag = hasSwordMult ? `［勇者之劍×${hero.equip.accessory.atkMult}］` : "";
  const attackChoices = [
    {
      label: `【物理攻擊】使用${wPhys}${swordTag}`,
      action: () => heroAttack("phys"),
    },
    {
      label: `【魔法攻擊】使用${wMag}${swordTag}`,
      action: () => heroAttack("mag"),
    },
  ];
  if (!hero.usedSkillThisTurn && hero.skills && hero.skills.length > 0) {
    attackChoices.push({
      label: "返回技能選擇",
      action: () => showCombatButtons(),
    });
  }
  setChoices(attackChoices);
}

// 玩家點擊施放技能（第十二版 v12：實裝全 15 招時序分流特效、左藍右黃技能護盾與蓄力 Buff 保留提示）
async function useCombatSkill(sk) {
  if (!enemy || !hero || hero.hp <= 0) return;
  const check = canCastSkill(sk);
  if (!check.ok) return;

  setChoices([]);
  hero.usedSkillThisTurn = sk.id;
  hero.skillCooldowns[sk.id] = sk.cd; // 完整冷卻間隔回合制：施放當回合設定為 cd，且本回合結束不遞減

  const s = calcStats(HERO_BASE, hero.equip, true);
  const highAtk = Math.max(s.physAtk, s.magAtk);
  const highDef = Math.max(s.physDef, s.magDef);

  // ── A. 不跳過攻擊之技能（施放時播放專屬前導特效，隨後進入第二階段選擇物理／魔法攻擊） ──
  if (!sk.skipAttack) {
    if (sk.id === "ink_flame") {
      hero.turnBuff.applyBurn = true;
      log("勇者施放【墨焰燃蝕】！字元烈焰纏繞武器，本回合攻擊命中後將使敵方陷入 3 回合【燃燒】（每回合結束自動扣除目標當前剩餘生命的 1/5）！", "hit");
      await playDialogueMicroGlow("glow-orange-micro", 680);
    } else if (sk.id === "flaw_insight") {
      hero.turnBuff.defIgnoreRatio = 0.40;
      log("勇者施放【破綻洞悉】！看穿敵方文字防禦裂隙，本回合發動的物理或魔法攻擊將無視目標 40% 對應防禦力！", "hit");
      await playEnemyCrosshairFx("#ff4d4d", 1000);
    } else if (sk.id === "word_leech") {
      hero.turnBuff.leechHpRatio = 0.35;
      log("勇者施放【文字汲取】！本回合攻擊命中後，目標實際減少生命值的 35% 將轉化為勇者自身生命回復！", "hit");
      await playDialogueMicroGlow("glow-green-micro", 680);
    } else if (sk.id === "shield_reflect") {
      hero.turnBuff.reflectActive = true;
      log("勇者施放【護盾反震】！啟動防禦共鳴力場，本回合受擊時將以（護盾受傷 × 1 + 生命受傷 × 0.8）發動反擊！", "hit");
      await playDialogueMicroGlow("glow-yellow-micro", 680);
    } else if (sk.id === "crystal_wall") {
      hero.turnBuff.crystalWall = true;
      if ($dialogueStage) $dialogueStage.classList.add("crystal-wall-active");
      addHeroSkillShield(5, true);
      log(`勇者施放【晶化壁壘】！立即補充 5 點黃色護盾（目前護盾 ${hero.shield}）；本回合護盾受到的所有傷害降低 50%，且若護盾被擊碎，溢出傷害完全無效化！`, "hit");
      await sleep(360);
    } else if (sk.id === "word_shield_leech") {
      hero.turnBuff.leechShieldRatio = 0.35;
      log("勇者施放【文字汲盾】！本回合攻擊命中後，目標實際減少生命值的 35% 將轉化為勇者自身黃色護盾值！", "hit");
      await playDialogueMicroGlow("glow-yellow-micro", 680);
    } else if (sk.id === "barrier_revive") {
      // 【屏障復甦】兩段式分開結算：1. 掃過綠色波紋 ➔ 結算回血 +X；2. 掃過黃色六角網格 ➔ 結算黃盾 +8
      const healAmt = Math.max(3, Math.floor(hero.maxHp * 0.15));
      const beforeHp = hero.hp;
      await playDialogueSweep("sweep-green-wave", 880);
      hero.hp = Math.min(hero.maxHp, hero.hp + healAmt);
      const actualHeal = hero.hp - beforeHp;
      triggerHeroHealVisual(actualHeal);
      await sleep(440);

      await playDialogueSweep("sweep-yellow-grid", 880);
      addHeroSkillShield(8, true);
      log(`勇者施放【屏障復甦】！立即回復 ${actualHeal} 點生命（目前生命 ${hero.hp} / ${hero.maxHp}），並重新生成 8 點黃色護盾（目前護盾 ${hero.shield}）！`, "hit");
      await sleep(520);
    }
    renderStatus();
    showAttackButtons();
    return;
  }

  // ── B. 跳過攻擊之技能（直接結算效果，跳過本回合擲骰／抽牌與普攻階段） ──
  if (sk.id === "shield_slash") {
    // 【破盾斬】：敵人面板畫出 X 形交叉紅色刀光，不震動螢幕
    const baseDmg = Math.floor(highAtk * 1.4);
    const enemyShieldBefore = enemy.shield;
    const enemyHpBefore = enemy.hp;
    const shdBroken = Math.min(enemy.shield, baseDmg * 2);
    const baseUsed = Math.ceil(shdBroken / 2);
    const hpDmg = Math.max(0, baseDmg - baseUsed);

    const slashP = enemyPanelSlashAnim("slash-x-red");
    await sleep(300);
    enemy.shield -= shdBroken;
    enemy.hp -= hpDmg;
    const enemyLostHp = enemy.hp < enemyHpBefore;
    let enemyShieldState = "none";
    if (enemyShieldBefore > 0 && enemy.shield === 0 && shdBroken > 0) {
      enemyShieldState = "shatter";
    } else if (shdBroken > 0 && !enemyLostHp && enemy.shield > 0) {
      enemyShieldState = "block";
    }
    renderStatus();
    const parts = [];
    if (shdBroken > 0) parts.push(`護盾 −${shdBroken}`);
    if (hpDmg > 0) parts.push(`生命 −${hpDmg}`);
    const mainLine = `勇者施放【破盾斬】［必中｜雙倍破盾］ ➔ 造成 ${shdBroken + hpDmg} 點破障重擊！（${parts.join("，") || "0 傷害"}）`;
    const formulaLine = `基礎值 ${baseDmg}（較高攻 ${highAtk} × 1.4）➔ 破盾消耗 ${baseUsed}（雙倍擊碎 ${shdBroken} 盾），剩餘 ${hpDmg} 直扣生命`;
    logCombatReport(true, mainLine, formulaLine);
    if (hero.activeChargeBuff) {
      log("（※蓄力強化狀態依然保留，將於下次普攻觸發）", "charge-keep-hint");
    }
    const hitP = enemyHitAnim(enemyLostHp, enemyShieldState);
    await Promise.all([slashP, hitP]);
    await sleep(320);
    await finishHeroTurnAndEnemyAct(true);
    return;
  }

  if (sk.id === "desperate_strike") {
    // 【捨身決絕】：勇者對話框先閃暗紅光 ➔ 敵人面板從左下到右上畫出加粗深紅色刀光，不震動螢幕
    const calcCost = Math.max(1, Math.floor(hero.hp * 0.20));
    const actualCost = Math.min(Math.max(0, hero.hp - 1), calcCost);
    hero.hp = Math.max(1, hero.hp - actualCost);
    renderStatus();
    await playDialogueMicroGlow("glow-dark-red", 720);

    const trueDmg = Math.floor(calcCost * 2.5 + highAtk * 0.6);
    const slashP = enemyPanelSlashAnim("slash-bl-tr-crimson");
    await sleep(300);
    enemy.hp -= trueDmg;
    renderStatus();
    const mainLine = `勇者施放【捨身決絕】［消耗 ${actualCost} 點生命｜真實傷害］ ➔ 造成 ${trueDmg} 點真實傷害！（生命 −${trueDmg}）`;
    const formulaLine = `消耗生命 ${calcCost} × 2.5 + 較高攻 ${highAtk} × 60% = ${trueDmg} 無視防盾真實傷害`;
    logCombatReport(true, mainLine, formulaLine);
    if (hero.activeChargeBuff) {
      log("（※蓄力強化狀態依然保留，將於下次普攻觸發）", "charge-keep-hint");
    }
    const hitP = enemyHitAnim(true, "none");
    await Promise.all([slashP, hitP]);
    await sleep(320);
    await finishHeroTurnAndEnemyAct(true);
    return;
  }

  if (sk.id === "shield_rebuild") {
    // 【護盾重構】：對話框由下往上掃過黃色六角網格光效 ＋ 頂部護盾條閃黃光並浮現黃色「+X」
    const shdGain = 6 + Math.floor(highDef * 0.35);
    await playDialogueSweep("sweep-yellow-grid", 920);
    addHeroSkillShield(shdGain, true);
    logCombatReport(
      true,
      `勇者施放【護盾重構】［跳過攻擊］ ➔ 立即生成 ${shdGain} 點黃色護盾！（目前護盾 ${hero.shield}）`,
      `基礎 6 + 較高防 ${highDef} × 35% = +${shdGain} 護盾`
    );
    if (hero.activeChargeBuff) {
      log("（※蓄力強化狀態依然保留，將於下次普攻觸發）", "charge-keep-hint");
    }
    await sleep(360);
    await finishHeroTurnAndEnemyAct(false);
    return;
  }

  if (sk.id === "full_focus") {
    // 【全神蓄勢】：當回合綠光圈向中心聚成綠點飛去變 Buff（維持淡綠減傷框）
    hero.turnBuff.dmgReduceRatio = 0.30;
    hero.pendingChargeSkill = "full_focus";
    if ($dialogueStage) $dialogueStage.classList.add("charge-dmg-reduce-active");
    await playChargeCondenseToBuffAnim(() => {
      hero.chargeBuffVisible = true;
      renderStatus();
    });
    logCombatReport(
      true,
      "勇者施放【全神蓄勢】［跳過攻擊｜蓄力階段］ ➔ 本回合受傷降低 30%，下次普通攻擊造成 2.25 倍最終傷害！",
      "當回合減傷 30% ➔ 下次普攻最終傷害 × 2.25"
    );
    await sleep(320);
    await finishHeroTurnAndEnemyAct(false);
    return;
  }

  if (sk.id === "condense_qi") {
    // 【凝神聚氣】：當回合綠光圈向中心聚成綠點飛去變 Buff，與 Buff 同時在敵人面板閃一下綠色十字準星
    hero.pendingChargeSkill = "condense_qi";
    let crosshairP = Promise.resolve();
    await playChargeCondenseToBuffAnim(() => {
      hero.chargeBuffVisible = true;
      renderStatus();
      crosshairP = playEnemyCrosshairFx("#38d399", 1040);
    });
    logCombatReport(
      true,
      "勇者施放【凝神聚氣】［跳過攻擊｜蓄力階段］ ➔ 鎖定敵方命門，下次普通攻擊基礎攻擊 +25% 且必出極限穿盾破甲！",
      "下次普攻基礎攻擊 × 1.25 ＋ 必出骰子20／撲克同花色K+A穿甲"
    );
    await crosshairP;
    await sleep(200);
    await finishHeroTurnAndEnemyAct(false);
    return;
  }

  if (sk.id === "limit_overload") {
    // 【極限過載】：兩段式（1. 先掃黃色網格並結算護盾「+6」 ➔ 2. 再由綠色光圈聚成綠點飛去變 Buff）
    await playDialogueSweep("sweep-yellow-grid", 880);
    addHeroSkillShield(6, true);
    await sleep(400);

    hero.pendingChargeSkill = "limit_overload";
    await playChargeCondenseToBuffAnim(() => {
      hero.chargeBuffVisible = true;
      renderStatus();
    });
    logCombatReport(
      true,
      `勇者施放【極限過載】［跳過攻擊｜蓄力階段］ ➔ 立即獲得 6 點黃色護盾（目前護盾 ${hero.shield}），下次普通攻擊基礎攻擊翻倍（×2.0）且無視 50% 護盾！`,
      "當回合護盾 +6 ➔ 下次普攻基礎攻擊 × 2.0 ＋ 無視敵方 50% 護盾"
    );
    await sleep(300);
    await finishHeroTurnAndEnemyAct(false);
    return;
  }

  if (sk.id === "bulwark_convert") {
    // 【壁壘轉化】（選項 B）：先掃黃色網格並一次閃黃光結算「+6 後再翻倍」的總增加量 ➔ 再聚成綠點飛去變 Buff
    const beforeShd = hero.shield;
    const newTotalShd = (beforeShd + 6) * 2;
    const addedShd = newTotalShd - beforeShd;

    await playDialogueSweep("sweep-yellow-grid", 880);
    addHeroSkillShield(addedShd, true);
    await sleep(400);

    hero.pendingChargeSkill = "bulwark_convert";
    await playChargeCondenseToBuffAnim(() => {
      hero.chargeBuffVisible = true;
      renderStatus();
    });
    logCombatReport(
      true,
      `勇者施放【壁壘轉化】［跳過攻擊｜蓄力階段］ ➔ 護盾補充並翻倍至 ${hero.shield} 點（+${addedShd}），下次普通攻擊將剩餘護盾 100% 附加至攻擊力！`,
      `（原護盾 ${beforeShd} + 6）× 2 = ${hero.shield} 護盾 ➔ 下次普攻剩餘護盾 100% 轉加基礎攻擊`
    );
    await sleep(300);
    await finishHeroTurnAndEnemyAct(false);
    return;
  }

  if (sk.id === "desperate_break") {
    // 【絕境突破】（選項 B）：1. 先掃過綠色波紋回血「+X」 ➔ 2. 再聚成綠點飛去變待發 Buff
    const healAmt = Math.max(4, Math.floor(hero.maxHp * 0.20));
    const beforeHp = hero.hp;
    await playDialogueSweep("sweep-green-wave", 880);
    hero.hp = Math.min(hero.maxHp, hero.hp + healAmt);
    const actualHeal = hero.hp - beforeHp;
    triggerHeroHealVisual(actualHeal);
    await sleep(400);

    hero.pendingChargeSkill = "desperate_break";
    await playChargeCondenseToBuffAnim(() => {
      hero.chargeBuffVisible = true;
      renderStatus();
    });
    logCombatReport(
      true,
      `勇者施放【絕境突破】［跳過攻擊｜殘血蓄力］ ➔ 立即回復 ${actualHeal} 點生命（${hero.hp}/${hero.maxHp}），下一回合重置另一技能冷卻且全屬性永久 +5！`,
      `當回合回復 20% 最大生命（+${actualHeal} HP）➔ 下回合另一技能 CD 歸零 ＋ 雙攻雙防永久 +5`
    );
    await sleep(300);
    await finishHeroTurnAndEnemyAct(false);
    return;
  }
}

async function startBattle(template) {
  if (template.isPhase2Boss) {
    // 二階段（方案 B）：HP 135，1:1 鏡像複製勇者（排除勇者之劍與測試者 999 裝備），前半血處於【亂碼侵蝕】（攻擊×1.05／吸血+2）
    const mirror = calcMirrorStatsForPhase2(HERO_BASE, hero.equip);
    const baseMirrorPhysAtk = mirror.physAtk + PHASE2_BOSS_BONUS_ATK;
    const baseMirrorMagAtk = mirror.magAtk + PHASE2_BOSS_BONUS_ATK;
    const baseMirrorPhysDef = mirror.physDef + PHASE2_BOSS_BONUS_DEF;
    const baseMirrorMagDef = mirror.magDef + PHASE2_BOSS_BONUS_DEF;
    lastEnemyHp = template.hp;
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
      burnTurns: 0,
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
      burnTurns: 0,
      items: template.items,
    };
  }

  // 每場戰鬥開始時：刷新護盾（全部為藍色初始裝備護盾，技能黃色護盾歸 0）、重置所有已裝備技能冷卻為 0、重置戰鬥內臨時狀態
  hero.battleStatBonus = 0;
  hero.pendingChargeSkill = null;
  hero.activeChargeBuff = null;
  hero.chargeBuffVisible = false;
  hero.turnBuff = {};
  hero.usedSkillThisTurn = null;
  hero.justReadySkills = {};
  if ($dialogueStage) {
    $dialogueStage.classList.remove("crystal-wall-active", "charge-dmg-reduce-active");
  }
  if (hero.skills) {
    hero.skills.forEach(sk => { hero.skillCooldowns[sk.id] = 0; });
  }
  hero.shield = calcStats(HERO_BASE, hero.equip, true).shield;
  hero.skillShield = 0;
  hero.maxBattleShield = hero.shield;
  lastHeroShield = hero.shield;
  lastEnemyShield = enemy.shield;
  ensureDialogueShieldFxLayer();
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
    log(`【精神世界】${enemy.name}完全複製了你身上的文字裝備與基礎能力（不包含飾品【勇者之劍】與局內技能），並發動【亂碼侵蝕】（攻擊×${PHASE2_BOSS_INIT_MULT}／命中吸取 ${PHASE2_BOSS_LIFESTEAL} 點生命）！`, "text-curse");
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
    const isHeroFirst = (r % 2 === 1);
    log(`先攻抽牌：${card.fullLabel}，${isHeroFirst ? "單數，勇者先攻！" : "雙數，" + enemy.name + "先攻！"}`);
    if (!isHeroFirst) {
      await enemyAttack();
      if (!enemy || hero.hp <= 0 || enemy.hp <= 0) return;
    }
  } else {
    r = rollD20();
    await rollDiceAnim("先攻判定", null, r, "單數＝勇者先攻／雙數＝" + enemy.name + "先攻");
    const isHeroFirst = (r % 2 === 1);
    log(`先攻骰：${r}，${isHeroFirst ? "單數，勇者先攻！" : "雙數，" + enemy.name + "先攻！"}`);
    if (!isHeroFirst) {
      await enemyAttack();
      if (!enemy || hero.hp <= 0 || enemy.hp <= 0) return;
    }
  }
  await beginHeroTurn();
}

// 計算並套用傷害（支援第十一／十二版技能修飾：破綻洞悉 40% 穿防、全神蓄勢 2.25 倍終傷、極限過載無視 50% 護盾、晶化壁壘護盾減半與破盾溢傷無效化、全神蓄勢受擊 -30%）
function dealDamage(attackerName, atkType, atk, def, target, dice, cardInfo, options = {}) {
  const atkLabel = atkType === "mag" ? "魔法攻擊" : "物理攻擊";
  const defLabel = atkType === "mag" ? "魔防" : "物防";
  const defIgnoreRatio = options.defIgnoreRatio || 0;
  const finalDmgMult = options.finalDmgMult || 1;
  const ignoreHalfShield = !!options.ignoreHalfShield;
  const targetDmgReduceRatio = options.targetDmgReduceRatio || 0;
  const targetCrystalWall = !!options.targetCrystalWall;
  const extraTags = options.extraTags ? [...options.extraTags] : [];

  const baseDefAfterSkill = defIgnoreRatio > 0 ? Math.floor(def * (1 - defIgnoreRatio)) : def;

  // 1. 骰子模式（cardInfo 為 null）
  if (!cardInfo) {
    if (dice === 0) {
      const mainLine = `${attackerName}發動【${atkLabel}】 ➔ 骰出 0 點失手，造成 0 點傷害！`;
      const formulaLine = `骰子 0（失手） = 0 傷害`;
      return { mainLine, formulaLine, dmg: 0, toShield: 0, toHp: 0 };
    }
    const isCrit20 = (dice === 20);
    const ignoreShield = (dice >= DICE_PIERCE_SHIELD_MIN);
    const effDef = isCrit20 ? Math.floor(baseDefAfterSkill * DICE_CRIT_DEF_MULT) : baseDefAfterSkill;
    let dmg = Math.max(0, atk + dice - effDef);
    if (finalDmgMult !== 1) {
      dmg = Math.floor(dmg * finalDmgMult);
    }
    if (targetDmgReduceRatio > 0) {
      dmg = Math.floor(dmg * (1 - targetDmgReduceRatio));
    }

    let toShield = 0;
    let toHp = 0;
    if (targetCrystalWall && target.shield > 0) {
      const crystalDmg = Math.floor(dmg * 0.5);
      if (crystalDmg >= target.shield) {
        toShield = target.shield;
        target.shield = 0;
        toHp = 0; // 晶化壁壘：破盾溢出傷害完全無效化
        extraTags.push("晶化壁壘：護盾減傷50%＋溢傷無效化");
      } else {
        toShield = crystalDmg;
        target.shield -= toShield;
        toHp = 0;
        extraTags.push("晶化壁壘：護盾減傷50%");
      }
      dmg = toShield;
    } else if (ignoreShield) {
      toShield = 0;
      toHp = dmg;
      target.hp -= toHp;
    } else if (ignoreHalfShield && target.shield > 0) {
      const bypassedShield = Math.floor(target.shield * 0.5);
      const blockableShield = target.shield - bypassedShield;
      toShield = Math.min(blockableShield, dmg);
      toHp = dmg - toShield;
      target.shield -= toShield;
      target.hp -= toHp;
    } else {
      toShield = Math.min(target.shield, dmg);
      toHp = dmg - toShield;
      target.shield -= toShield;
      target.hp -= toHp;
    }

    if (isCrit20) {
      extraTags.unshift("骰出20：無視50%防禦＋無視護盾");
    } else if (ignoreShield) {
      extraTags.unshift(`骰出${dice}：無視護盾`);
    }
    const tagStr = extraTags.length > 0 ? `［${extraTags.join("｜")}］` : "";

    let mainLine = `${attackerName}發動【${atkLabel}】${tagStr} ➔ 造成 ${dmg} 點傷害！`;
    if (dmg > 0) {
      const parts = [];
      if (toShield > 0) parts.push(`護盾 −${toShield}`);
      if (toHp > 0) parts.push(`生命 −${toHp}`);
      mainLine += `（${parts.join("，")}）`;
    }
    const rollExpr = ignoreShield ? `骰子 ${dice}（穿盾）` : `骰子 ${dice}`;
    const defExpr = (effDef !== def) ? `${defLabel} ${effDef}（原 ${def}）` : `${defLabel} ${def}`;
    let formulaLine = `${atk} + ${rollExpr} − ${defExpr}`;
    if (finalDmgMult !== 1) formulaLine = `（${formulaLine}）× ${finalDmgMult}`;
    if (targetDmgReduceRatio > 0) formulaLine = `（${formulaLine}）× ${Math.round((1 - targetDmgReduceRatio) * 100)}%`;
    formulaLine += ` = ${dmg} 傷害`;
    return { mainLine, formulaLine, dmg, toShield, toHp };
  }

  // 2. 撲克模式（方案 B ＋ 第十一／十二版技能修飾）
  const isBlackSuit = (cardInfo.suit.key === "S" || cardInfo.suit.key === "C");
  const suitMatched = (atkType === "phys" && isBlackSuit) || (atkType === "mag" && !isBlackSuit);
  const suitBonus = suitMatched ? POKER_SUIT_ATK_BONUS : 0;
  const effAtk = atk + suitBonus;

  const isAce = (cardInfo.rank === "A") || !!cardInfo.forceAcePierce;
  const isKing = (dice === POKER_KING_PIERCE_VAL);
  const ignoreShield = (isAce || isKing);
  const effDef = isAce ? Math.floor(baseDefAfterSkill * POKER_ACE_DEF_MULT) : baseDefAfterSkill;

  let dmg = Math.max(0, effAtk + dice - effDef);
  if (finalDmgMult !== 1) {
    dmg = Math.floor(dmg * finalDmgMult);
  }
  if (targetDmgReduceRatio > 0) {
    dmg = Math.floor(dmg * (1 - targetDmgReduceRatio));
  }

  let toShield = 0;
  let toHp = 0;
  if (targetCrystalWall && target.shield > 0) {
    const crystalDmg = Math.floor(dmg * 0.5);
    if (crystalDmg >= target.shield) {
      toShield = target.shield;
      target.shield = 0;
      toHp = 0; // 晶化壁壘：破盾溢出傷害完全無效化
      extraTags.push("晶化壁壘：護盾減傷50%＋溢傷無效化");
    } else {
      toShield = crystalDmg;
      target.shield -= toShield;
      toHp = 0;
      extraTags.push("晶化壁壘：護盾減傷50%");
    }
    dmg = toShield;
  } else if (ignoreShield) {
    toShield = 0;
    toHp = dmg;
    target.hp -= toHp;
  } else if (ignoreHalfShield && target.shield > 0) {
    const bypassedShield = Math.floor(target.shield * 0.5);
    const blockableShield = target.shield - bypassedShield;
    toShield = Math.min(blockableShield, dmg);
    toHp = dmg - toShield;
    target.shield -= toShield;
    target.hp -= toHp;
  } else {
    toShield = Math.min(target.shield, dmg);
    toHp = dmg - toShield;
    target.shield -= toShield;
    target.hp -= toHp;
  }

  const tags = [];
  if (suitBonus > 0) {
    tags.push(`${isBlackSuit ? "黑花色物攻" : "紅花色魔攻"}+${suitBonus}`);
  }
  if (cardInfo.forceAcePierce && isKing) {
    tags.push("K+A：無視護盾與50%防禦");
  } else if (isAce) {
    tags.push("A：無視護盾與部分防禦");
  } else if (isKing) {
    tags.push("K：無視護盾");
  }
  tags.push(...extraTags);
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
  const defExpr = (effDef !== def) ? `${defLabel} ${effDef}（原 ${def}）` : `${defLabel} ${def}`;
  let formulaLine = `${atkExpr} + ${rollExpr} − ${defExpr}`;
  if (finalDmgMult !== 1) formulaLine = `（${formulaLine}）× ${finalDmgMult}`;
  if (targetDmgReduceRatio > 0) formulaLine = `（${formulaLine}）× ${Math.round((1 - targetDmgReduceRatio) * 100)}%`;
  formulaLine += ` = ${dmg} 傷害`;
  return { mainLine, formulaLine, dmg, toShield, toHp };
}

async function heroAttack(atkType) {
  setChoices([]); // 動畫期間鎖定按鈕
  const s = calcStats(HERO_BASE, hero.equip, true);
  const isMag = atkType === "mag";
  let atkVal = isMag ? s.magAtk : s.physAtk;
  const defVal = isMag ? enemy.curMagDef : enemy.curPhysDef;

  // 結算本回合攜帶的蓄力爆發與當回合技能增益
  const activeCharge = hero.activeChargeBuff;
  const extraTags = [];
  let finalDmgMult = 1;
  let ignoreHalfShield = false;
  let forceMaxRoll = false;
  const $atkStatCell = document.getElementById(isMag ? "hero-stat-magAtk" : "hero-stat-physAtk");

  if (activeCharge === "bulwark_convert") {
    // 【壁壘轉化】下次普攻：從頂部護盾條飛出一顆黃色光點進入物攻／魔攻數字並閃光
    const shdBonus = Math.max(0, hero.shield);
    atkVal += shdBonus;
    extraTags.push(`壁壘轉化：攻擊+${shdBonus}`);
    const $shTrack = document.getElementById("hero-sh-track");
    if ($shTrack && $atkStatCell) {
      await playParticlesBetween($shTrack, $atkStatCell, "#ffd23f", 1, 680);
      replayClass($atkStatCell, "stat-flash-green");
    }
  } else if (activeCharge === "condense_qi") {
    atkVal = Math.floor(atkVal * 1.25);
    forceMaxRoll = true;
    extraTags.push("凝神聚氣：攻擊+25%＋極限穿甲");
  } else if (activeCharge === "limit_overload") {
    // 【極限過載】下次普攻：頂部物攻／魔攻數字閃一下綠光
    atkVal = Math.floor(atkVal * 2.0);
    ignoreHalfShield = true;
    extraTags.push("極限過載：基礎攻×2＋無視50%護盾");
    if ($atkStatCell) {
      replayClass($atkStatCell, "stat-flash-green");
      await sleep(440);
    }
  } else if (activeCharge === "full_focus") {
    finalDmgMult = 2.25;
    extraTags.push("全神蓄勢：總傷×2.25");
  }

  const defIgnoreRatio = (hero.turnBuff && hero.turnBuff.defIgnoreRatio) ? hero.turnBuff.defIgnoreRatio : 0;
  if (defIgnoreRatio > 0) {
    extraTags.push("破綻洞悉：無視40%防禦");
  }

  const shownEffDef = defIgnoreRatio > 0 ? Math.floor(defVal * (1 - defIgnoreRatio)) : defVal;
  const rollWord = gameMode === "poker" ? "撲克" : "骰子";
  const labelNote = isMag
    ? `魔攻 ${atkVal} + ${rollWord} − 魔防 ${shownEffDef}`
    : `物攻 ${atkVal} + ${rollWord} − 物防 ${shownEffDef}`;

  let dice, drawnCard = null;
  let pokerSpecialPrompt = "";

  if (gameMode === "poker") {
    if (forceMaxRoll) {
      const forcedSuit = isMag ? POKER_SUITS[1] : POKER_SUITS[0]; // ♥紅心 or ♠黑桃
      drawnCard = {
        suit: forcedSuit,
        rank: "K",
        value: 13,
        label: `${forcedSuit.symbol}K`,
        fullLabel: `${forcedSuit.name}${forcedSuit.symbol}K`,
        forceAcePierce: true,
      };
    } else {
      drawnCard = drawPokerCard();
    }
    lastDrawnCard = drawnCard;
    dice = drawnCard.value;
    pokerSpecialPrompt = forceMaxRoll
      ? `${isMag ? "魔攻暫時增加！" : "物攻暫時增加！"}<br>【凝神聚氣】K+A 無視護盾與50%防禦！`
      : buildPokerSpecialPrompt(atkType, drawnCard);
    await rollPokerAnim("勇者", HERO_COLOR, drawnCard, labelNote, pokerSpecialPrompt);
  } else {
    dice = forceMaxRoll ? 20 : rollD20();
    await rollDiceAnim("勇者", HERO_COLOR, dice, labelNote, forceMaxRoll);
  }

  const enemyShieldBefore = enemy.shield;
  const enemyHpBefore = enemy.hp;
  const heroTarget = { shield: enemy.shield, hp: enemy.hp };
  const report = dealDamage("勇者", atkType, atkVal, defVal, heroTarget, dice, drawnCard, {
    defIgnoreRatio,
    finalDmgMult,
    ignoreHalfShield,
    extraTags,
  });
  const enemyLostHp = heroTarget.hp < enemyHpBefore;
  let enemyShieldState = "none";
  if (enemyShieldBefore > 0 && heroTarget.shield === 0 && report.toShield > 0) {
    enemyShieldState = "shatter";
  } else if (report.toShield > 0 && !enemyLostHp && heroTarget.shield > 0) {
    enemyShieldState = "block";
  }

  // 決定本次普攻刀光樣式（壁壘轉化黃綠邊／其他蓄力2倍綠邊／墨焰燃蝕橘紅刀光／破綻洞悉紅邊白刀光／預設白刀光）
  let slashVariant = "slash-hit";
  if (activeCharge === "bulwark_convert") {
    slashVariant = "slash-thick-yellowgreen";
  } else if (activeCharge === "full_focus" || activeCharge === "condense_qi" || activeCharge === "limit_overload") {
    slashVariant = "slash-thick-green-2x";
  } else if (hero.turnBuff && hero.turnBuff.applyBurn) {
    slashVariant = "slash-flame-orange";
  } else if (defIgnoreRatio > 0) {
    slashVariant = "slash-thick-red-edge";
  }

  const slashP = enemyPanelSlashAnim(slashVariant);
  await sleep(slashVariant === "slash-hit" ? 150 : 300);
  enemy.shield = heroTarget.shield;
  enemy.hp = heroTarget.hp;

  // 若本次普攻消耗了蓄力 Buff，將 Buff 標籤清除並播放化為綠色光點飛走動畫
  let buffFlyP = Promise.resolve();
  if (activeCharge) {
    buffFlyP = playBuffFlyAwayAnim();
    hero.activeChargeBuff = null;
    hero.chargeBuffVisible = false;
  }
  renderStatus();

  // 【破綻洞悉】命中時：敵人面板對應防禦數字閃紅光
  if (defIgnoreRatio > 0) {
    const $eDefCell = document.getElementById(isMag ? "enemy-stat-magDef" : "enemy-stat-physDef");
    if ($eDefCell) replayClass($eDefCell, "stat-flash-red");
  }

  logCombatReport(true, report.mainLine, report.formulaLine);
  const hitP = enemyHitAnim(enemyLostHp, enemyShieldState);
  await Promise.all([slashP, hitP, buffFlyP]);
  await sleep(260);

  // 結算攻擊命中後的附加技能效果（墨焰燃蝕、文字汲取、文字汲盾）
  const attackHit = !(gameMode === "dice" && dice === 0);
  if (attackHit && hero.turnBuff) {
    if (hero.turnBuff.applyBurn && enemy.hp > 0) {
      enemy.burnTurns = 3;
      const nextTickVal = Math.max(1, Math.floor(enemy.hp / 5));
      log(`【墨焰燃蝕】${enemy.name}被字元烈焰引燃，陷入【燃燒】狀態（每回合結束扣除 1/5 當前剩餘生命［預計扣除 ${nextTickVal} 點］，持續 3 回合）！`, "hit");
      renderStatus();
      await playEnemyFlameHitFx(1280);
    }
    if (hero.turnBuff.leechHpRatio && report.toHp > 0) {
      const healAmt = Math.floor(report.toHp * hero.turnBuff.leechHpRatio);
      if (healAmt > 0) {
        const $hpTrack = document.getElementById("hero-hp-track") || $status;
        await playParticlesBetween($enemyPanel, $hpTrack, "#38d399", 7, 840);
        const beforeHp = hero.hp;
        hero.hp = Math.min(hero.maxHp, hero.hp + healAmt);
        const actualHealed = hero.hp - beforeHp;
        log(`【文字汲取】勇者將敵方減少的 ${report.toHp} 點生命轉化為生機，回復 ${actualHealed} 點生命（目前生命 ${hero.hp} / ${hero.maxHp}）！`, "hit");
        triggerHeroHealVisual(actualHealed);
      }
    }
    if (hero.turnBuff.leechShieldRatio && report.toHp > 0) {
      const shdAmt = Math.floor(report.toHp * hero.turnBuff.leechShieldRatio);
      if (shdAmt > 0) {
        const $shTrack = document.getElementById("hero-sh-track") || $status;
        await playParticlesBetween($enemyPanel, $shTrack, "#ffd23f", 7, 840);
        addHeroSkillShield(shdAmt, true);
        log(`【文字汲盾】勇者將敵方減少的 ${report.toHp} 點生命轉化為屏障，獲得 ${shdAmt} 點黃色護盾（目前護盾 ${hero.shield}）！`, "hit");
      }
    }
  }

  await finishHeroTurnAndEnemyAct(true);
}

// 勇者完成本回合行動（普攻或跳過攻擊技能）後的統一結算流程：燃燒扣血（1/5 當前剩餘生命）➔ 階段判定 ➔ 技能 CD 遞減 ➔ 敵方行動
async function finishHeroTurnAndEnemyAct(didAttackAction) {
  if (!enemy) return;

  // 二階段：勇者第一次攻擊後的專屬台詞（半血前 enemy.name 為 @$+%^&¥，完全不出現真魔王或沙坦）
  if (didAttackAction && enemy.isPhase2Boss && !enemy.firstAttackDone) {
    enemy.firstAttackDone = true;
    log(`${enemy.name}：「啊啊你爲甚麼會有前勇者的武器，這個混蛋竟然死後也不安寧！！！」`, "text-curse");
  }

  if (enemy.hp <= 0) { await winBattle(); return; }

  // 結算敵方身上的【燃燒】持續傷害（第十二版 v12：每回合結束自動扣除目標當前剩餘生命值的 1/5 真實傷害）
  if (enemy.burnTurns && enemy.burnTurns > 0 && enemy.hp > 0) {
    const burnDmg = Math.max(1, Math.floor(enemy.hp / 5));
    enemy.hp = Math.max(0, enemy.hp - burnDmg);
    enemy.burnTurns--;
    renderStatus();
    log(`【燃燒】字元烈焰持續灼燒${enemy.name}（扣除 1/5 當前生命），造成 ${burnDmg} 點真實傷害（剩餘持續 ${enemy.burnTurns} 回合）！`, "hit");
    await Promise.all([playEnemyFlameHitFx(1280), enemyHitAnim(true, "none")]);
    await sleep(220);
    if (enemy.hp <= 0) { await winBattle(); return; }
  }

  // 一階段魔王半血掙扎加劇提示
  if (enemy.isBoss && !enemy.halfHpTriggered && enemy.hp <= enemy.maxHp * BOSS_STRUGGLE_HP_RATIO) {
    enemy.halfHpTriggered = true;
    log(BOSS_STRUGGLE_TEXT, "text-curse");
  }

  // 二階段半血（HP <= 67）顯露真名「文字.沙坦」並進入狂暴狀態
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

  // 完整冷卻間隔回合制：遞減「非本回合剛施放」之技能冷卻時間（若由 1 歸 0 則標記下回合微光提醒）
  if (hero && hero.skills) {
    hero.skills.forEach(sk => {
      if (sk.id !== hero.usedSkillThisTurn && (hero.skillCooldowns[sk.id] || 0) > 0) {
        hero.skillCooldowns[sk.id]--;
        if (hero.skillCooldowns[sk.id] === 0) {
          hero.justReadySkills[sk.id] = true;
        }
      }
    });
  }

  await enemyAttack();
  if (!enemy || hero.hp <= 0 || enemy.hp <= 0) return;

  // 渾沌怪與一階段魔王每回合結束後動態切換排斥弱點（二階段不減防）
  if (enemy.type === "chaos" && !enemy.isPhase2Boss) {
    refreshChaosWeakness(true);
  }
  await beginHeroTurn();
}

async function enemyAttack() {
  // 一階段魔王掙扎判定（初期 15%，半血以下 30%）
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
    const enemyPokerPrompt = buildPokerSpecialPrompt(atkType, drawnCard);
    await rollPokerAnim(enemy.name, ENEMY_COLORS[enemy.name], drawnCard, labelNote, enemyPokerPrompt);
  } else {
    dice = rollD20();
    await rollDiceAnim(enemy.name, ENEMY_COLORS[enemy.name], dice, labelNote);
  }

  const heroShieldBefore = hero.shield;
  const yellowShieldBefore = Math.max(0, Math.min(heroShieldBefore, hero.skillShield || 0));
  const target = { shield: hero.shield, hp: hero.hp };
  const hpBefore = hero.hp;
  const targetDmgReduceRatio = (hero.turnBuff && hero.turnBuff.dmgReduceRatio) ? hero.turnBuff.dmgReduceRatio : 0;
  const targetCrystalWall = !!(hero.turnBuff && hero.turnBuff.crystalWall);
  const extraEnemyTags = [];
  if (targetDmgReduceRatio > 0) {
    extraEnemyTags.push(`全神蓄勢：減傷${Math.round(targetDmgReduceRatio * 100)}%`);
  }

  const report = dealDamage(enemy.name, atkType, atkVal, defVal, target, dice, drawnCard, {
    targetDmgReduceRatio,
    targetCrystalWall,
    extraTags: extraEnemyTags,
  });

  // 檢查是否觸發飾品【勇者之劍】殘魂免疫致命傷（方案 B：最多 2 次，鎖 1 血並重鑄滿額護盾，每次倍率下降 0.15）
  const acc = hero.equip.accessory;
  if (target.hp <= 0 && acc && acc.isHeroSword && acc.blocksLeft > 0) {
    acc.blocksLeft--;
    acc.atkMult = Math.max(1.0, Math.round((acc.atkMult - HERO_SWORD_BLOCK_DECAY) * 100) / 100);
    hero.shield = calcStats(HERO_BASE, hero.equip, true).shield;
    hero.skillShield = 0;
    hero.maxBattleShield = Math.max(hero.maxBattleShield || 0, hero.shield);
    hero.hp = 1; // 保留 1 點生命（鎖 1 血並重鑄護盾）
    logCombatReport(false, report.mainLine, report.formulaLine);
    renderStatus();

    // 觸發「受到攻擊後生命值沒有減少」的視覺特效（面板周圍閃金光）
    await heroHitAnim(false);

    // 畫面變暗並在中心顯示文字消失效果
    if (acc.blocksLeft > 0) {
      log(`勇者之劍裏的殘魂突然出現，爲勇者擋下了致命一擊並重鑄護盾！勇者的殘魂變弱了一分（攻擊倍率降至 ×${acc.atkMult}，勇者保留 1 點生命）。`, "hit");
      renderStatus();
      await playStorySequence([HERO_SWORD_BLOCK_TEXT]);
    } else {
      log(`勇者之劍裏的殘魂拼盡最後一份力爲勇者擋下致命一擊並重鑄護盾！勇者的殘魂消失了...（攻擊倍率降至 ×${acc.atkMult}，勇者保留 1 點生命）`, "hit");
      log(`${enemy.name}：「（邪笑）看你還有甚麼手段抵擋我」`, "text-curse");
      renderStatus();
      await playStorySequence([HERO_SWORD_BLOCK_TEXT, HERO_SWORD_VANISH_TEXT]);
    }
    return;
  }

  // 優先扣除最外層（右側）的黃色技能護盾，黃色護盾扣完才扣原本的藍色護盾
  const yellowUsed = Math.min(yellowShieldBefore, report.toShield);
  hero.skillShield = Math.max(0, yellowShieldBefore - yellowUsed);

  logCombatReport(false, report.mainLine, report.formulaLine);
  hero.shield = target.shield;
  hero.hp = target.hp;

  // 二階段前半血【亂碼侵蝕】吸血機制：若本次攻擊對勇者造成實際生命傷害且勇者尚未倒下，吸取 2 點生命
  if (enemy && enemy.isPhase2Boss && !enemy.inRage && report.toHp > 0 && hero.hp > 0) {
    const beforeEnemyHp = enemy.hp;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + PHASE2_BOSS_LIFESTEAL);
    const healedEnemy = enemy.hp - beforeEnemyHp;
    if (healedEnemy > 0) {
      log(`【亂碼侵蝕】${enemy.name}吞噬了飛濺的血肉文字，回復 ${healedEnemy} 點生命（目前生命 ${enemy.hp} / ${enemy.maxHp}）！`, "text-curse");
    }
  }

  renderStatus();

  const heroLostHp = hero.hp < hpBefore;
  let heroShieldState = "none";
  if (targetCrystalWall) {
    // 【晶化壁壘】：敵人攻擊打中勇者時播放黃色護盾網格光效
    heroShieldState = "block-yellow";
  } else if (heroShieldBefore > 0 && hero.shield === 0 && report.toShield > 0) {
    heroShieldState = (yellowUsed > 0) ? "shatter-yellow" : "shatter";
  } else if (yellowShieldBefore > 0 && hero.skillShield === 0 && yellowUsed > 0 && !heroLostHp) {
    heroShieldState = "shatter-yellow";
  } else if (report.toShield > 0 && !heroLostHp && hero.shield > 0) {
    heroShieldState = (yellowUsed > 0) ? "block-yellow" : "block";
  }
  await heroHitAnim(heroLostHp, heroShieldState);

  // 回合受擊結束後，平滑淡出晶化壁壘雙層亮框與全神蓄勢減傷框
  if ($dialogueStage) {
    $dialogueStage.classList.remove("crystal-wall-active", "charge-dmg-reduce-active");
  }

  if (hero.hp <= 0) {
    loseGame();
    return;
  }

  // 結算勇者【護盾反震】反擊傷害：從勇者對話框向外擴散黃色圓形波紋，碰到敵人面板時造成傷害並延續至螢幕邊界
  if (enemy && enemy.hp > 0 && hero.turnBuff && hero.turnBuff.reflectActive && (report.toShield > 0 || report.toHp > 0)) {
    const reflectDmg = Math.floor(report.toShield * 1.0 + report.toHp * 0.8);
    if (reflectDmg > 0) {
      const eShieldBefore = enemy.shield;
      const eHpBefore = enemy.hp;
      const eShdHit = Math.min(enemy.shield, reflectDmg);
      const eHpHit = reflectDmg - eShdHit;

      await playReflectWaveAnim(async () => {
        enemy.shield -= eShdHit;
        enemy.hp -= eHpHit;
        renderStatus();

        const parts = [];
        if (eShdHit > 0) parts.push(`護盾 −${eShdHit}`);
        if (eHpHit > 0) parts.push(`生命 −${eHpHit}`);
        logCombatReport(
          true,
          `勇者觸發【護盾反震】 ➔ 反擊造成 ${reflectDmg} 點傷害！（${parts.join("，")}）`,
          `護盾受傷 ${report.toShield} × 1 + 生命受傷 ${report.toHp} × 0.8 = ${reflectDmg} 反擊傷害`
        );
        let eShdState = "none";
        if (eShieldBefore > 0 && enemy.shield === 0 && eShdHit > 0) {
          eShdState = "shatter";
        } else if (eShdHit > 0 && enemy.hp === eHpBefore && enemy.shield > 0) {
          eShdState = "block";
        }
        await enemyHitAnim(enemy.hp < eHpBefore, eShdState);
      });

      await sleep(180);
      if (enemy.hp <= 0) {
        await winBattle();
        return;
      }
    }
  }
}

async function winBattle() {
  setChoices([]);

  // 一階段魔王被擊敗：收回戰鬥拉簾並進入前勇者真相過場
  if (enemy.isBoss) {
    await closeBattleDrawerAnim();
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

    // 正常路線：文字魔王倒下後，勇者發現其身分為「前勇者」，獲得【勇者之劍】
    const swordItem = { ...HERO_SWORD_ITEM };
    hero.equip.accessory = swordItem;
    const healGain = Math.max(1, Math.floor(hero.maxHp * HERO_SWORD_HEAL_RATIO));
    const beforeHp = hero.hp;
    hero.hp = Math.min(hero.maxHp, hero.hp + healGain);
    const actualHealed = hero.hp - beforeHp;
    const clearLines = (hero.skills && hero.skills.length > 0)
      ? PHASE1_CLEAR_TEXTS
      : (typeof PHASE1_CLEAR_TEXTS_NO_SKILL !== "undefined" ? PHASE1_CLEAR_TEXTS_NO_SKILL : PHASE1_CLEAR_TEXTS);
    sep();
    log("文字魔王倒下了……他身上的文字枷鎖出現裂痕，露出了底下的真容——竟然是前勇者！", "big");
    log(`你獲得了前勇者的遺物飾品：【${swordItem.name}】（${swordItem.desc}）！勇者生命回復 ${actualHealed} 點（目前生命 ${hero.hp} / ${hero.maxHp}）！`, "hit");
    for (const line of clearLines) {
      log(line, "text-curse");
    }
    triggerHeroHealVisual(actualHealed);

    await playStorySequence(clearLines);

    sep();
    log(`── 意識墜入精神世界，${PHASE2_BOSS_HIDDEN_NAME}降臨！`, "big");
    await bossAppearAnim();
    await startBattle(PHASE2_BOSS);
    return;
  }

  // 二階段（文字.沙坦）被擊敗：收回戰鬥拉簾並演出 4 句勝利結局文字消失動畫
  if (enemy.isPhase2Boss) {
    await closeBattleDrawerAnim();
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

  // 常規小怪擊敗：保留敵人面板在 0 HP 狀態讓玩家看清血條歸零與白色殘影，先播放全螢幕黃字文字消失轉場（2.2秒），結束後回到戰鬥框顯示「繼續前進」按鈕
  const defeatedEnemy = enemy;
  const isNarrowVictory = hero.hp < (hero.maxHp * 0.25);
  const defeatMsg = isNarrowVictory ? `險勝${defeatedEnemy.name}….` : `打敗${defeatedEnemy.name}了`;

  await playFadeOutTextScreen(defeatMsg, "#ffd23f", false, 2200);

  if ($battleLog) {
    const vDiv = document.createElement("div");
    vDiv.className = "combat-report victory-report";
    vDiv.innerHTML = `<div class="line-main" style="color: #ffd23f; font-weight: bold; font-size: 15px;">${escapeHtml(defeatMsg)}</div>`;
    $battleLog.appendChild(vDiv);
    $battleLog.scrollTop = $battleLog.scrollHeight;
  }

  setChoices([
    {
      label: "繼續前進",
      action: async () => {
        setChoices([]);
        enemy = null;
        renderStatus();
        await closeBattleDrawerAnim();
        log(defeatMsg, "big");
        const drop = randomPick(defeatedEnemy.items);
        log(`${defeatedEnemy.name}掉落了一件${SLOT_NAME[drop.slot]}：${itemText(drop)}。`);
        offerItem(drop, advanceAfterEvent);
      }
    }
  ]);
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
const $compendium = document.getElementById("compendium-screen");
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
    [$title, $intro, $compendium, $game].filter(Boolean).forEach(el => el.classList.add("hidden"));
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


/* ===== 第十二版（v12）新增：遊戲開始頁面「技能圖鑑」渲染與分類篩選邏輯 ===== */
let currentCompendiumFilter = "all";

function renderCompendium(filterCat = "all") {
  currentCompendiumFilter = filterCat;
  const $box = document.getElementById("compendium-box");
  const $tabs = document.getElementById("compendium-tabs");
  if (!$box || typeof SKILLS === "undefined") return;

  if ($tabs) {
    $tabs.querySelectorAll(".comp-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.cat === filterCat);
    });
  }

  const catMeta = [
    { key: "attack", title: "⚔️ 【攻擊類技能】（共 5 種｜紅色邊框：專注破盾、燃血真傷、1/5當前生命燃燒、破防與吸血）" },
    { key: "defense", title: "🛡️ 【防禦類技能】（共 5 種｜黃色邊框：專注生成黃色技能護盾、反震波紋、晶化減傷保護與雙回）" },
    { key: "charge", title: "⚡ 【蓄力類技能】（共 5 種｜綠色邊框：當回合聚氣成點化為常駐 Buff，下次普攻或下回合爆發）" },
  ];

  let html = "";
  catMeta.forEach(group => {
    if (filterCat !== "all" && filterCat !== group.key) return;
    const list = SKILLS.filter(s => s.category === group.key);
    html += `<div class="comp-section-header cat-${group.key}">${escapeHtml(group.title)}</div>`;
    list.forEach((sk, idx) => {
      const actionTag = sk.skipAttack ? "跳過普通攻擊" : "不跳過普通攻擊";
      html += `
        <div class="skill-detail-card cat-${sk.category}">
          <div class="skill-detail-title">
            <span>${idx + 1}. 【${escapeHtml(sk.name)}】</span>
            <span class="skill-cat-badge cat-${sk.category}">${escapeHtml(sk.categoryLabel)}｜冷卻 ${sk.cd} 回合｜${actionTag}</span>
          </div>
          <div class="skill-detail-desc">${escapeHtml(sk.desc)}</div>
        </div>`;
    });
  });

  $box.innerHTML = html;
  $box.scrollTop = 0;
}

function goCompendium() {
  if (!$compendium) return;
  showScreen($compendium, () => {
    renderCompendium("all");
  });
}

const $btnCompendium = document.getElementById("btn-compendium");
if ($btnCompendium) $btnCompendium.onclick = goCompendium;
const $btnCompendiumBack = document.getElementById("btn-compendium-back");
if ($btnCompendiumBack) $btnCompendiumBack.onclick = goTitle;
const $btnCompendiumStart = document.getElementById("btn-compendium-start");
if ($btnCompendiumStart) $btnCompendiumStart.onclick = () => showScreen($title, openTitleModeSelect);

const $compTabs = document.getElementById("compendium-tabs");
if ($compTabs) {
  $compTabs.querySelectorAll(".comp-tab").forEach(btn => {
    btn.onclick = () => {
      btn.blur();
      renderCompendium(btn.dataset.cat || "all");
    };
  });
}
