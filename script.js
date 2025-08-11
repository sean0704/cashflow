// 現金流遊戲 — 純前端 JS（正體中文）
// 本檔案負責遊戲邏輯、DOM 更新與 localStorage

// --- 遊戲設定（可依需求調整） ---
const BOARD = [
  { id: 0, type: "payday", label: "發薪日" },
  { id: 1, type: "opportunity", label: "機會" },
  { id: 2, type: "doodad", label: "雜支" },
  { id: 3, type: "market", label: "市場" },
  { id: 4, type: "opportunity", label: "機會" },
  { id: 5, type: "payday", label: "發薪日" },
  { id: 6, type: "opportunity", label: "機會" },
  { id: 7, type: "doodad", label: "雜支" },
  { id: 8, type: "market", label: "市場" },
  { id: 9, type: "opportunity", label: "機會" },
];

const SAMPLE_ASSETS = [
  { id: "small-rental", name: "小型出租屋", cost: 3000, passive: 300 },
  { id: "index-etf", name: "全球指數 ETF", cost: 2000, passive: 120 },
  { id: "side-business", name: "副業商店", cost: 5000, passive: 600 },
];

const OPPORTUNITY_CARDS = [
  { id: 1, text: "購買小型出租屋", type: "asset", assetId: "small-rental" },
  { id: 2, text: "購買全球指數 ETF", type: "asset", assetId: "index-etf" },
  { id: 3, text: "啟動副業", type: "asset", assetId: "side-business" },
  { id: 4, text: "中了小獎", type: "cash", amount: 1000 },
  { id: 5, text: "重大維修（雜支）", type: "expense", amount: 800 },
];

const STORAGE_KEY = "cashflow_player_v1";

// --- 初始玩家狀態 --- (如 localStorage 沒有則用初始值)
const defaultPlayer = {
  cash: 5000,
  salary: 2000,
  expenses: 1500,
  passive: 0,
  position: 0,
  assets: [],
  turn: 1,
  inFastTrack: false,
};

let player = loadPlayer();

// --- DOM 參照 ---
const boardEl = document.getElementById("board");
const rollBtn = document.getElementById("rollBtn");
const diceEl = document.getElementById("dice");
const paydayBtn = document.getElementById("paydayBtn");
const resetBtn = document.getElementById("resetBtn");
const messageEl = document.getElementById("message");
const turnEl = document.getElementById("turn");
const positionEl = document.getElementById("position");
const positionLabelEl = document.getElementById("positionLabel");
const cashEl = document.getElementById("cash");
const salaryEl = document.getElementById("salary");
const expensesEl = document.getElementById("expenses");
const passiveEl = document.getElementById("passive");
const fasttrackEl = document.getElementById("fasttrack");
const assetListEl = document.getElementById("assetList");
const shopListEl = document.getElementById("shopList");

// --- 初始化畫面 ---
renderBoard();
renderShop();
renderAll();

// --- 事件綁定 ---
rollBtn.addEventListener("click", handleRoll);
paydayBtn.addEventListener("click", applyPayday);
resetBtn.addEventListener("click", resetGame);

// --- 函式實作 ---
function loadPlayer() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch (e) {
    console.warn("localStorage 讀取失敗", e);
  }
  return { ...defaultPlayer };
}

function savePlayer() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
  } catch (e) {
    console.warn("localStorage 存檔失敗", e);
  }
}

function renderBoard() {
  boardEl.innerHTML = "";
  for (let space of BOARD) {
    const div = document.createElement("div");
    div.className = "space " + space.type;
    div.dataset.id = space.id;
    div.innerHTML = `<div class="id">#${space.id}</div><div class="label">${space.label}</div><div class="type">${space.type}</div>`;
    boardEl.appendChild(div);
  }
}

function updateBoardActive() {
  // 標示現在位置
  const nodes = boardEl.querySelectorAll(".space");
  nodes.forEach(n => n.classList.remove("active"));
  const cur = boardEl.querySelector(`.space[data-id='${player.position}']`);
  if (cur) cur.classList.add("active");
}

function renderShop() {
  shopListEl.innerHTML = "";
  for (let a of SAMPLE_ASSETS) {
    const item = document.createElement("div");
    item.className = "shop-item";
    item.innerHTML = `<div><div style="font-weight:700">${a.name}</div><div class="meta">價格：$${a.cost} — 被動收入：$${a.passive}</div></div>`;
    const btn = document.createElement("button");
    btn.textContent = "購買";
    btn.addEventListener("click", () => buyAsset(a.id));
    item.appendChild(btn);
    shopListEl.appendChild(item);
  }
}

function renderAll() {
  turnEl.textContent = `回合 ${player.turn}`;
  diceEl.textContent = 1;
  positionEl.textContent = player.position;
  positionLabelEl.textContent = BOARD[player.position]?.label || "";
  cashEl.textContent = `$${player.cash}`;
  salaryEl.textContent = `$${player.salary}`;
  expensesEl.textContent = `$${player.expenses}`;
  passiveEl.textContent = `$${player.passive}`;
  fasttrackEl.textContent = player.inFastTrack ? "是" : "否";
  renderAssets();
  updateBoardActive();
  savePlayer();
}

function renderAssets() {
  assetListEl.innerHTML = "";
  if (!player.assets || player.assets.length === 0) {
    assetListEl.innerHTML = `<li class="text-muted">尚未擁有資產。</li>`;
    return;
  }
  player.assets.forEach((aid, idx) => {
    const a = SAMPLE_ASSETS.find(x => x.id === aid);
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.padding = "6px 0";
    li.innerHTML = `<div><div style="font-weight:600">${a.name}</div><div style="font-size:12px;color:#6b7280">被動收入：$${a.passive}</div></div>`;
    const btn = document.createElement("button");
    btn.textContent = "賣出";
    btn.style.padding = "4px 8px";
    btn.addEventListener("click", () => {
      if (!confirm(`確定要賣出 ${a.name} 嗎？（以 80% 回收）`)) return;
      sellAsset(idx);
    });
    li.appendChild(btn);
    assetListEl.appendChild(li);
  });
}

// 擲骰子
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function handleRoll() {
  const r = rollDice();
  diceEl.textContent = r;
  showMessage(`擲出 ${r}`);
  movePlayer(r);
  player.turn += 1;
  renderAll();
}

// 移動並處理落格事件
function movePlayer(steps) {
  player.position = (player.position + steps) % BOARD.length;
  positionEl.textContent = player.position;
  positionLabelEl.textContent = BOARD[player.position]?.label || "";
  landOnSpace(BOARD[player.position]);
}

// 發薪日（收到薪資 + 被動收入，扣支出）
function applyPayday() {
  const income = player.salary + player.passive;
  player.cash = player.cash + income - player.expenses;
  showMessage(`發薪日！ +${income} - ${player.expenses} 支出 => 現金 ${player.cash}`);
  checkFastTrack();
  renderAll();
}

// 落格事件
function landOnSpace(space) {
  if (!space) return;
  switch (space.type) {
    case "payday":
      applyPayday();
      break;
    case "opportunity":
      drawOpportunityCard();
      break;
    case "doodad":
      const doodadCost = Math.floor(Math.random() * 800) + 200;
      player.cash = Math.max(0, player.cash - doodadCost);
      showMessage(`雜支支出： -${doodadCost}`);
      renderAll();
      break;
    case "market":
      // 市場小幅度影響被動收入（+-10% of passive）
      const change = Math.round((Math.random() * 0.2 - 0.1) * player.passive);
      player.passive = Math.max(0, player.passive + change);
      showMessage(`市場波動：被動收入 ${change >= 0 ? '+' : ''}${change}`);
      checkFastTrack();
      renderAll();
      break;
    default:
      break;
  }
}

// 機會卡
function drawOpportunityCard() {
  const card = OPPORTUNITY_CARDS[Math.floor(Math.random() * OPPORTUNITY_CARDS.length)];
  showMessage(`卡片：${card.text}`);
  if (card.type === "asset") {
    // 自動檢查是否有足夠現金，足夠則購買（簡化邏輯）
    setTimeout(() => {
      promptBuyAsset(card.assetId);
      renderAll();
    }, 250);
  } else if (card.type === "cash") {
    player.cash += card.amount;
    renderAll();
  } else if (card.type === "expense") {
    player.cash = Math.max(0, player.cash - card.amount);
    renderAll();
  }
}

// 提示購買（自動購買）
function promptBuyAsset(assetId) {
  const asset = SAMPLE_ASSETS.find(a => a.id === assetId);
  if (!asset) return;
  if (player.cash >= asset.cost) {
    // 自動購買（可以改成顯示確認 UI）
    buyAsset(assetId);
  } else {
    showMessage(`機會：${asset.name} 價格 $${asset.cost}，現金不足。`);
  }
}

function buyAsset(assetId) {
  const asset = SAMPLE_ASSETS.find(a => a.id === assetId);
  if (!asset) return;
  if (player.cash < asset.cost) {
    showMessage("現金不足，無法購買。");
    return;
  }
  player.cash -= asset.cost;
  player.passive += asset.passive;
  player.assets.push(assetId);
  showMessage(`購買 ${asset.name} 花費 ${asset.cost}。被動收入 +${asset.passive}`);
  checkFastTrack();
  renderAll();
}

function sellAsset(index) {
  const assetId = player.assets[index];
  const asset = SAMPLE_ASSETS.find(a => a.id === assetId);
  if (!asset) return;
  const recover = Math.round(asset.cost * 0.8);
  player.assets.splice(index, 1);
  player.passive = Math.max(0, player.passive - asset.passive);
  player.cash += recover;
  showMessage(`賣出 ${asset.name}，獲得 ${recover}`);
  checkFastTrack();
  renderAll();
}

function checkFastTrack() {
  player.inFastTrack = player.passive > player.expenses;
}

// 重置遊戲
function resetGame() {
  if (!confirm("重置遊戲？這會清除本機儲存的進度。")) return;
  player = { ...defaultPlayer };
  savePlayer();
  showMessage("遊戲已重置。祝你好運！");
  renderAll();
}

// 顯示訊息
function showMessage(txt) {
  messageEl.textContent = txt;
}

// 最後再 render 一次並儲存
renderAll();
