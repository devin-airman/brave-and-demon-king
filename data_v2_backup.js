/* =========================================================
   樓層、三系怪物、裝備與跨層寶箱資料庫 (data.js)
   資料來源：《勇者與魔王_全樓層怪物與裝備數值表.xlsx》與定案規格
   ========================================================= */

// 1–5 層樓層基本資訊
const FLOORS = [
  { floor: 1, name: "殘墨林徑", desc: "林間的草木皆已化為扭曲的黑墨字元，微風中傳來紙頁摩擦的沙沙聲。" },
  { floor: 2, name: "蝕骨石窟", desc: "陰暗的石窟內壁刻滿了尖銳的部首與筆畫，踏入一步便覺寒意刺骨。" },
  { floor: 3, name: "亂碼陵墓", desc: "古老的墓碑上閃爍著錯亂的字節與遺言，死去的守衛已被文字重構。" },
  { floor: 4, name: "斷章深淵", desc: "失去了上下文的斷章裂谷，星辰與深淵的文字在此處劇烈碰撞。" },
  { floor: 5, name: "原典王座", desc: "萬物文字化的源頭，純白與漆黑的原典文字拱衛著最深處的王座。" },
];

// 1–5 層怪物與攜帶裝備設定表（怪物除生命外，所有攻防護盾數值皆來自攜帶裝備）
// slot 分為：physWeapon (物理武器)、magWeapon (魔法武器)、armor (雙防裝甲)、shield (護盾)
const FLOOR_MONSTERS = {
  1: [
    {
      name: "墨染史萊姆", type: "phys", typeLabel: "物理怪", hp: 18, weight: 40,
      items: [
        { slot: "physWeapon", name: "墨痕鈍刺", physAtk: 3, textDesc: "右手掌被黏稠的黑墨浸染，化作了「刺」字...力量湧現。" },
        { slot: "armor", name: "凝墨外皮", physDef: 6, magDef: 1, textDesc: "胸口肌膚浮現墨色硬甲，化為「革」字...防護提升。" },
      ],
    },
    {
      name: "漂浮符文妖", type: "mag", typeLabel: "魔法怪", hp: 14, weight: 40,
      items: [
        { slot: "magWeapon", name: "散佚字元杖", magAtk: 4, textDesc: "右臂蔓延出幽藍的筆畫，握柄處凝成了「杖」字...魔力湧動。" },
        { slot: "armor", name: "虛質殘頁", physDef: 0, magDef: 7, textDesc: "肩頭飄落半透明書頁，皮膚化作了「紋」字...魔抗增強。" },
        { slot: "shield", name: "浮文字力場", shield: 2, textDesc: "左手浮起旋轉的字元屏障，生成了「盾」字護體力場。" },
      ],
    },
    {
      name: "墨痕聚合體", type: "chaos", typeLabel: "渾沌怪", hp: 24, weight: 20,
      items: [
        { slot: "physWeapon", name: "錯亂墨骨刃", physAtk: 5, textDesc: "右手骨骼劇痛並扭曲，凝結成一把墨色「刃」字骨刃。" },
        { slot: "magWeapon", name: "錯亂符文刃", magAtk: 5, textDesc: "左臂被流動的藍光符碼覆蓋，化作散發微光的「咒」字短刃。" },
        { slot: "armor", name: "拼湊符號殼", physDef: 4, magDef: 4, textDesc: "身軀被交錯的標點符號包裹，化作「甲」字保護內臟。" },
        { slot: "shield", name: "殘墨重圓盾", shield: 4, textDesc: "左手凝固為厚重墨石，堅實的「壁」字環繞四周。" },
      ],
    },
  ],
  2: [
    {
      name: "蝕刻穴居人", type: "phys", typeLabel: "物理怪", hp: 26, weight: 40,
      items: [
        { slot: "physWeapon", name: "粗糙岩鑿斧", physAtk: 6, textDesc: "小臂肌肉骨化為粗獷的「斧」字...揮擊沉重有力。" },
        { slot: "armor", name: "石刻重甲", physDef: 10, magDef: 2, textDesc: "軀幹石化剝落，背後烙印著厚重的「磐」字...物防大增。" },
        { slot: "shield", name: "石板骨盾", shield: 3, textDesc: "一面粗糙的石質骨盾融入左腕，浮現「障」字。" },
      ],
    },
    {
      name: "洞窟秘術咒靈", type: "mag", typeLabel: "魔法怪", hp: 22, weight: 40,
      items: [
        { slot: "magWeapon", name: "石窟咒印杖", magAtk: 8, textDesc: "指尖流瀉暗色咒文，化作閃耀的「術」字...魔能澎湃。" },
        { slot: "armor", name: "低語法袍", physDef: 2, magDef: 11, textDesc: "輕柔的絮語纏繞胸膛，皮膚化為幽暗的「霧」字抵禦法術。" },
        { slot: "shield", name: "幽微咒靈盾", shield: 4, textDesc: "靈體光環在身前結成「御」字符印，吸收衝擊。" },
      ],
    },
    {
      name: "裂隙蝕骨獸", type: "chaos", typeLabel: "渾沌怪", hp: 34, weight: 20,
      items: [
        { slot: "physWeapon", name: "裂隙碎骨爪", physAtk: 8, textDesc: "右手五指化作泛著骨白的「爪」字...撕裂皮肉。" },
        { slot: "magWeapon", name: "蝕隙咒魂爪", magAtk: 8, textDesc: "左手纏繞著幽紫色的文字「痕」...魔力破壞力劇增。" },
        { slot: "armor", name: "骨甲與岩紋", physDef: 7, magDef: 7, textDesc: "肋骨外翻硬化，全身覆蓋「鎧」字符文，防禦均衡。" },
        { slot: "shield", name: "蝕裂晶盾", shield: 6, textDesc: "晶體碎片在左臂聚合為「晶」字盾牌，堅固無比。" },
      ],
    },
  ],
  3: [
    {
      name: "亂碼骸骨死士", type: "phys", typeLabel: "物理怪", hp: 36, weight: 40,
      items: [
        { slot: "physWeapon", name: "鏽蝕斷碼劍", physAtk: 10, textDesc: "手骨徹底金屬文字化，凝結出殘破的「劍」字鋒刃。" },
        { slot: "armor", name: "骨片鏈甲", physDef: 15, magDef: 4, textDesc: "鏈條與骨片穿透皮肉，在胸腹拼湊出冰冷的「鐵」字。" },
        { slot: "shield", name: "亡者木盾", shield: 5, textDesc: "死寂的腐木附著於左臂，化為枯朽的「干」字格擋傷害。" },
      ],
    },
    {
      name: "哀號字節幽魂", type: "mag", typeLabel: "魔法怪", hp: 30, weight: 40,
      items: [
        { slot: "magWeapon", name: "噪點引魂幡", magAtk: 13, textDesc: "耳旁響起淒厲噪音，掌心文字炸裂為「魄」字魔引。" },
        { slot: "armor", name: "虛無靈衣", physDef: 4, magDef: 16, textDesc: "身體漸趨透明虛化，軀幹化為空洞的「虛」字避開魔法。" },
        { slot: "shield", name: "相位符文障", shield: 6, textDesc: "扭曲的字節在周身流轉，形成「界」字阻隔結界。" },
      ],
    },
    {
      name: "亂碼編譯魔像", type: "chaos", typeLabel: "渾沌怪", hp: 48, weight: 20,
      items: [
        { slot: "physWeapon", name: "編譯破壞槌", physAtk: 12, textDesc: "右臂化作沉重的符碼巨槌，砸下時顯現「碎」字威力。" },
        { slot: "magWeapon", name: "重構解碼杖", magAtk: 12, textDesc: "左腕重組為閃爍錯誤代碼的法杖，激盪「析」字魔力。" },
        { slot: "armor", name: "重構金屬軀", physDef: 11, magDef: 11, textDesc: "全身皮膚徹底質變為冰冷符文金屬，「鋼」字入骨。" },
        { slot: "shield", name: "邏輯壁壘盾", shield: 8, textDesc: "縝密的編譯邏輯化作厚實光盾，顯露「絕」字屏障。" },
      ],
    },
  ],
  4: [
    {
      name: "淵面行刑者", type: "phys", typeLabel: "物理怪", hp: 48, weight: 40,
      items: [
        { slot: "physWeapon", name: "斷頭重鋼斧", physAtk: 15, textDesc: "肌肉撕裂並重組，化為充斥殺戮血光的「斬」字巨刃。" },
        { slot: "armor", name: "淵黑重鎧", physDef: 22, magDef: 6, textDesc: "深淵重鐵吸附於骨骼，化作沉重而不可撼動的「固」字。" },
        { slot: "shield", name: "深淵棘盾", shield: 8, textDesc: "尖刺自盾面暴突，刻印著漆黑的「拒」字反斥外力。" },
      ],
    },
    {
      name: "斷章星象術士", type: "mag", typeLabel: "魔法怪", hp: 40, weight: 40,
      items: [
        { slot: "magWeapon", name: "虛空星象儀", magAtk: 18, textDesc: "星辰軌跡在眼中轉動，指引出無窮星輝的「星」字法器。" },
        { slot: "armor", name: "星痕深淵袍", physDef: 6, magDef: 23, textDesc: "法袍如同深空夜幕披身，體內鐫刻「曜」字吞噬法能。" },
        { slot: "shield", name: "星穹光環盾", shield: 9, textDesc: "群星光暈化作環形光幕，在體表形成「域」字護罩。" },
      ],
    },
    {
      name: "虛空斷章巨靈", type: "chaos", typeLabel: "渾沌怪", hp: 65, weight: 20,
      items: [
        { slot: "physWeapon", name: "湮滅碎裂核", physAtk: 17, textDesc: "右掌中文字崩塌為引力核心，爆發「坍」字物理重擊。" },
        { slot: "magWeapon", name: "虛無噬靈核", magAtk: 17, textDesc: "左手浮現深空文字漩渦，釋放撕裂維度的「噬」字魔能。" },
        { slot: "armor", name: "次元褶皺護甲", physDef: 16, magDef: 16, textDesc: "空間褶皺化為戰衣，身軀化為折射萬物的「界」字防甲。" },
        { slot: "shield", name: "虛無湮滅盾", shield: 12, textDesc: "空間虛無深洞化作巨盾，浮現「封」字抵禦衝擊。" },
      ],
    },
  ],
  5: [
    {
      name: "原典禁衛巨兵", type: "phys", typeLabel: "物理怪", hp: 62, weight: 40,
      items: [
        { slot: "physWeapon", name: "王座金敕戟", physAtk: 21, textDesc: "神聖金光貫通右臂，血肉完形為神聖威嚴的「敕」字金戟。" },
        { slot: "armor", name: "原典神聖板甲", physDef: 30, magDef: 8, textDesc: "宛如聖殿梁柱般的純白文字化作胸甲，「城」字固若金湯。" },
        { slot: "shield", name: "原初巨壁盾", shield: 12, textDesc: "原初文字構成的通天巨壁，散發不可逾越的「塹」字神威。" },
      ],
    },
    {
      name: "王座吟唱主教", type: "mag", typeLabel: "魔法怪", hp: 52, weight: 40,
      items: [
        { slot: "magWeapon", name: "終焉聖典", magAtk: 25, textDesc: "原典之言在心頭響起，右手捧起散發耀眼光芒的「典」字之書。" },
        { slot: "armor", name: "審判聖輝袍", physDef: 8, magDef: 31, textDesc: "聖潔經文流淌周身，皮膚化作「聖」字，一切魔法皆化泡影。" },
        { slot: "shield", name: "聖言庇護盾", shield: 14, textDesc: "頌唱之聲具象化為聖光壁，形成「佑」字終極聖盾。" },
      ],
    },
    {
      name: "文字同化核心", type: "chaos", typeLabel: "渾沌怪", hp: 85, weight: 20,
      items: [
        { slot: "physWeapon", name: "原典創生之刃", physAtk: 23, textDesc: "右臂文字凝聚為萬物實體，化為裁斷因果的「創」字巨劍。" },
        { slot: "magWeapon", name: "原典終焉法杖", magAtk: 23, textDesc: "左手文字昇華為能量狂潮，點燃終結萬象的「滅」字法杖。" },
        { slot: "armor", name: "文字萬象本體", physDef: 22, magDef: 22, textDesc: "全身完全同化為純粹文字，浮現「元」字不可摧毀之體。" },
        { slot: "shield", name: "本源真理盾", shield: 16, textDesc: "真理文字構築的絕對防禦，展現終極「極」字力場。" },
      ],
    },
  ],
};

// 第 1–4 層跨層寶箱裝備池（每層 4 件：物理武器、魔法武器、裝甲、護盾各 1 件，開寶箱時隨機 4 抽 1）
// 強度嚴格設定於「當前層 (N) 與下一層 (N+1)」之間
const FLOOR_CHEST_ITEMS = {
  1: [
    { slot: "physWeapon", name: "篆刻黑鐵劍", physAtk: 6, textDesc: "右手掌浮現鋒利的黑鐵筆畫，化作「鋒」字...斬擊更為凌厲。" },
    { slot: "magWeapon", name: "螢光殘卷杖", magAtk: 6, textDesc: "左手指尖凝聚微光字元，化作「螢」字法杖...魔力穩定輸出。" },
    { slot: "armor", name: "碑文護心鏡", physDef: 6, magDef: 6, textDesc: "胸前烙印出古樸的碑文，化作「護」字...物魔防護同時提升。" },
    { slot: "shield", name: "凝字方盾", shield: 3, textDesc: "左臂文字緊密交織，化為堅固的「防」字方盾。" },
  ],
  2: [
    { slot: "physWeapon", name: "碎岩重字錘", physAtk: 9, textDesc: "右臂骨肉與岩石文字融合，化作「錘」字...一擊足以碎石。" },
    { slot: "magWeapon", name: "幽谷迴響杖", magAtk: 10, textDesc: "左手繚繞著石窟的低語文字，化作「響」字...魔能激盪。" },
    { slot: "armor", name: "刻紋岩晶鎧", physDef: 9, magDef: 9, textDesc: "全身覆蓋上結晶化的岩紋文字，化作「堅」字重鎧。" },
    { slot: "shield", name: "石髓壁壘盾", shield: 5, textDesc: "深層石髓文字在左腕隆起，化作厚重的「壘」字護盾。" },
  ],
  3: [
    { slot: "physWeapon", name: "破碼斬鐵刀", physAtk: 14, textDesc: "右手徹底化為閃爍寒光的代碼刀刃，浮現「斷」字鋒芒。" },
    { slot: "magWeapon", name: "亂流演算杖", magAtk: 15, textDesc: "左手被高速流動的演算符碼吞沒，化作「算」字魔杖。" },
    { slot: "armor", name: "秘銀代碼甲", physDef: 14, magDef: 14, textDesc: "軀幹被精密的符文鎖甲覆蓋，烙印出無懈可擊的「密」字。" },
    { slot: "shield", name: "防禦矩陣盾", shield: 8, textDesc: "立體文字矩陣在身前展開，凝結成「陣」字光盾。" },
  ],
  4: [
    { slot: "physWeapon", name: "深淵裂界槍", physAtk: 19, textDesc: "右臂與深淵文字同化，延伸出貫穿空間的「裂」字長槍。" },
    { slot: "magWeapon", name: "星淵詠嘆書", magAtk: 21, textDesc: "左手懸浮著吞吐星光的深淵法典，化作「詠」字魔導器。" },
    { slot: "armor", name: "虛空星鎧", physDef: 19, magDef: 19, textDesc: "星辰與虛空文字交織成戰甲，胸口閃耀著「宙」字神威。" },
    { slot: "shield", name: "次元折躍盾", shield: 12, textDesc: "扭曲的次元文字固定在左臂，化為偏轉萬物的「折」字巨盾。" },
  ],
};

// 第 5 層終局魔王設定（《勇者與魔王_全樓層怪物與裝備數值表.xlsx》）
const BOSS = {
  name: "文字魔王",
  fullTitle: "文字魔王（前代勇者殘軀）",
  type: "chaos",
  typeLabel: "魔王",
  hp: 110,
  isBoss: true,
  items: [
    { slot: "physWeapon", name: "褪色誓約聖劍·破甲", physAtk: 28, textDesc: "【前勇者的遺物】昔日佩劍的物理鋒芒，鏽跡斑斑卻飽含殺意。" },
    { slot: "magWeapon", name: "褪色誓約聖劍·魔湧", magAtk: 28, textDesc: "【前勇者的遺物】昔日佩劍的殘留聖光，如今轉化為文字詛咒魔潮。" },
    { slot: "armor", name: "破碎文字枷鎖鎧", physDef: 26, magDef: 26, textDesc: "【前勇者的遺物】被無數文字生生烙印在肉身骨髓的束縛重甲，無法脫卸。" },
    { slot: "shield", name: "苦痛抗爭之盾", shield: 20, textDesc: "【前勇者的遺物】殘留著前代勇者微弱抗爭意識的盾牌，偶爾發出哀鳴。" },
  ],
};
