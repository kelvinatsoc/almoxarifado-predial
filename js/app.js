import { createRepository, isSupabaseConfigured } from "./db.js";

const state = {
  repository: null,
  items: [],
  movements: [],
  currentView: "dashboard",
  itemSearch: "",
  categoryFilter: "",
  stockFilter: "",
  movementTypeFilter: "",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const viewMeta = {
  dashboard: ["Painel operacional", "Visão geral"],
  items: ["Inventário completo", "Estoque"],
  movements: ["Fluxo de materiais", "Movimentações"],
  reports: ["Indicadores", "Relatórios"],
  settings: ["Administração", "Configurações"],
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function normalizeSearch(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatQuantity(value) {
  return number.format(Number(value) || 0);
}

function getStockStatus(item) {
  if (Number(item.currentStock) <= 0) return { key: "empty", label: "Esgotado" };
  if (Number(item.currentStock) <= Number(item.minStock)) return { key: "low", label: "Estoque baixo" };
  return { key: "healthy", label: "Normal" };
}

function getItem(itemId) {
  return state.items.find((item) => item.id === itemId);
}

let toastTimer;
function showToast(message, type = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("is-error", type === "error");
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3600);
}

function friendlyError(error) {
  const message = error?.message || String(error);
  if (/duplicate|unique|inventory_items_code_key/i.test(message)) return "Já existe um item com esse código.";
  if (/row-level security/i.test(message)) return "Seu usuário não tem permissão para realizar esta ação.";
  if (/Invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  return message;
}

function setConnectionStatus(mode, error = false) {
  const dot = $("#connectionDot");
  const label = $("#connectionLabel");
  dot.className = `status-dot ${error ? "is-error" : "is-online"}`;
  label.textContent = error ? "Falha de conexão" : mode === "supabase" ? "Supabase conectado" : "Banco local ativo";

  if (!error) {
    $("#databaseModeTitle").textContent = mode === "supabase" ? "Banco compartilhado ativo" : "Modo local";
    $("#databaseModeText").textContent = mode === "supabase"
      ? "Itens e movimentações são sincronizados entre os usuários autorizados."
      : "Os dados ficam salvos com segurança neste navegador. Use o backup para transferi-los.";
    $("#logoutButton").classList.toggle("hidden", mode !== "supabase");
    $("#resetButton").disabled = mode === "supabase";
    $("#restoreInput").disabled = mode === "supabase";
  }
}

async function refreshData() {
  const [items, movements] = await Promise.all([
    state.repository.getItems(),
    state.repository.getMovements(),
  ]);
  state.items = items;
  state.movements = movements;
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderItems();
  renderMovementOptions();
  renderMovements();
  renderReports();
}

function renderDashboard() {
  const totalValue = state.items.reduce((sum, item) => sum + Number(item.currentStock) * Number(item.unitCost), 0);
  const totalUnits = state.items.reduce((sum, item) => sum + Number(item.currentStock), 0);
  const lowItems = state.items.filter((item) => getStockStatus(item).key !== "healthy");
  const emptyItems = state.items.filter((item) => getStockStatus(item).key === "empty");
  const healthyItems = state.items.filter((item) => getStockStatus(item).key === "healthy");
  const now = new Date();
  const monthMovements = state.movements.filter((movement) => {
    const date = new Date(movement.createdAt);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  $("#statValue").textContent = currency.format(totalValue);
  $("#statItems").textContent = state.items.length;
  $("#statUnits").textContent = `${formatQuantity(totalUnits)} unidades armazenadas`;
  $("#statLow").textContent = lowItems.length;
  $("#statMoves").textContent = monthMovements.length;
  $("#heroSummary").textContent = lowItems.length ? `${lowItems.length} ${lowItems.length === 1 ? "item requer" : "itens requerem"} atenção` : "Tudo em ordem por aqui";

  const health = state.items.length ? Math.round((healthyItems.length / state.items.length) * 100) : 0;
  $("#healthDonut").style.setProperty("--value", health);
  $("#healthPercent").textContent = `${health}%`;
  $("#healthyCount").textContent = healthyItems.length;
  $("#lowCount").textContent = lowItems.length - emptyItems.length;
  $("#emptyCount").textContent = emptyItems.length;

  const categories = summarizeCategories();
  const maxCategoryUnits = Math.max(...categories.map((category) => category.units), 1);
  $("#categoryBars").innerHTML = categories.slice(0, 5).map((category) => `
    <div class="category-row">
      <span title="${escapeHtml(category.name)}">${escapeHtml(category.name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (category.units / maxCategoryUnits) * 100)}%"></div></div>
      <strong>${formatQuantity(category.units)}</strong>
    </div>
  `).join("") || emptyState("Nenhuma categoria", "Cadastre o primeiro item para começar.");

  $("#alertCount").textContent = lowItems.length;
  $("#lowStockList").innerHTML = lowItems
    .sort((a, b) => Number(a.currentStock) - Number(b.currentStock))
    .slice(0, 4)
    .map((item) => `
      <div class="stack-item">
        <div class="stack-info"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.code)} · mínimo ${formatQuantity(item.minStock)} ${escapeHtml(item.unit)}</span></div>
        <span class="stock-pill">${formatQuantity(item.currentStock)} ${escapeHtml(item.unit)}</span>
      </div>
    `).join("") || emptyState("Nenhuma reposição pendente", "Todos os itens estão acima do estoque mínimo.");

  $("#recentMovements").innerHTML = state.movements.slice(0, 4).map((movement) => {
    const item = getItem(movement.itemId);
    return `
      <div class="stack-item">
        <div class="stack-info"><strong>${escapeHtml(item?.name || "Item removido")}</strong><span>${escapeHtml(movement.requester)} · ${shortDate.format(new Date(movement.createdAt))}</span></div>
        <span class="movement-pill ${movement.type}">${movement.type === "in" ? "+" : "−"}${formatQuantity(movement.quantity)} ${escapeHtml(item?.unit || "")}</span>
      </div>`;
  }).join("") || emptyState("Nenhuma movimentação", "Entradas e saídas aparecerão aqui.");
}

function summarizeCategories() {
  const map = new Map();
  state.items.forEach((item) => {
    const current = map.get(item.category) || { name: item.category, items: 0, units: 0, value: 0 };
    current.items += 1;
    current.units += Number(item.currentStock);
    current.value += Number(item.currentStock) * Number(item.unitCost);
    map.set(item.category, current);
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function filteredItems() {
  const query = normalizeSearch(state.itemSearch);
  return state.items.filter((item) => {
    const haystack = normalizeSearch(`${item.name} ${item.code} ${item.location} ${item.supplier}`);
    const matchesSearch = !query || haystack.includes(query);
    const matchesCategory = !state.categoryFilter || item.category === state.categoryFilter;
    const matchesStock = !state.stockFilter || getStockStatus(item).key === state.stockFilter;
    return matchesSearch && matchesCategory && matchesStock;
  });
}

function renderItems() {
  const categories = [...new Set(state.items.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const categorySelect = $("#categoryFilter");
  const savedCategory = categorySelect.value;
  categorySelect.innerHTML = '<option value="">Todas as categorias</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  categorySelect.value = categories.includes(savedCategory) ? savedCategory : "";

  const items = filteredItems();
  $("#itemsTableCount").textContent = `${items.length} ${items.length === 1 ? "item" : "itens"}`;
  $("#itemsTableBody").innerHTML = items.map((item) => {
    const status = getStockStatus(item);
    return `
      <tr>
        <td><div class="item-cell"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.code)} · ${escapeHtml(item.supplier || "Sem fornecedor")}</span></div></td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.location)}</td>
        <td><span class="quantity-value">${formatQuantity(item.currentStock)} <small>${escapeHtml(item.unit)}</small></span></td>
        <td><span class="status-pill status-${status.key}">${status.label}</span></td>
        <td><div class="row-actions"><button class="small-action" data-edit-item="${escapeHtml(item.id)}" type="button">Editar</button><button class="small-action danger" data-delete-item="${escapeHtml(item.id)}" type="button">Excluir</button></div></td>
      </tr>`;
  }).join("") || `<tr><td colspan="6">${emptyState("Nenhum item encontrado", "Ajuste os filtros ou cadastre um novo material.")}</td></tr>`;
}

function renderMovementOptions() {
  const select = $("#movementItem");
  const selected = select.value;
  select.innerHTML = '<option value="">Selecione um item</option>' + state.items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.code)} — ${escapeHtml(item.name)}</option>`).join("");
  if (state.items.some((item) => item.id === selected)) select.value = selected;
  updateSelectedStock();
}

function renderMovements() {
  const movements = state.movements.filter((movement) => !state.movementTypeFilter || movement.type === state.movementTypeFilter);
  $("#movementTimeline").innerHTML = movements.map((movement) => {
    const item = getItem(movement.itemId);
    const direction = movement.type === "in" ? "Entrada" : "Saída";
    const details = [movement.documentNumber, movement.requester, shortDate.format(new Date(movement.createdAt))].filter(Boolean).join(" · ");
    return `
      <div class="timeline-item">
        <div class="timeline-icon ${movement.type}" aria-hidden="true">${movement.type === "in" ? "↓" : "↑"}</div>
        <div class="timeline-copy"><strong>${direction} · ${escapeHtml(item?.name || "Item removido")}</strong><span>${escapeHtml(details)}${movement.note ? `<br>${escapeHtml(movement.note)}` : ""}</span></div>
        <div class="timeline-quantity ${movement.type}">${movement.type === "in" ? "+" : "−"}${formatQuantity(movement.quantity)} ${escapeHtml(item?.unit || "")}</div>
      </div>`;
  }).join("") || emptyState("Nenhum registro", "As movimentações aparecerão nesta linha do tempo.");
}

function renderReports() {
  const categories = summarizeCategories();
  const totalValue = categories.reduce((sum, category) => sum + category.value, 0);
  const lowValue = state.items.filter((item) => getStockStatus(item).key !== "healthy").reduce((sum, item) => sum + Math.max(0, Number(item.minStock) - Number(item.currentStock)) * Number(item.unitCost), 0);
  const last30 = state.movements.filter((movement) => Date.now() - new Date(movement.createdAt).getTime() <= 30 * 86400000);
  const inQuantity = last30.filter((movement) => movement.type === "in").reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const outQuantity = last30.filter((movement) => movement.type === "out").reduce((sum, movement) => sum + Number(movement.quantity), 0);

  $("#reportHighlights").innerHTML = `
    <article class="report-highlight"><span>Patrimônio em materiais</span><strong>${currency.format(totalValue)}</strong><small>Valor calculado pelo custo unitário</small></article>
    <article class="report-highlight"><span>Estimativa de reposição</span><strong>${currency.format(lowValue)}</strong><small>Para alcançar o estoque mínimo</small></article>
    <article class="report-highlight"><span>Giro em 30 dias</span><strong>${last30.length}</strong><small>${formatQuantity(inQuantity)} entradas · ${formatQuantity(outQuantity)} saídas</small></article>`;

  $("#categoryReportBody").innerHTML = categories.map((category) => `
    <tr><td><strong>${escapeHtml(category.name)}</strong></td><td>${category.items}</td><td>${formatQuantity(category.units)}</td><td>${currency.format(category.value)}</td></tr>
  `).join("") || `<tr><td colspan="4">${emptyState("Sem dados", "Cadastre itens para gerar o relatório.")}</td></tr>`;

  const comparisonMax = Math.max(inQuantity, outQuantity, 1);
  $("#movementComparison").innerHTML = `
    <div class="compare-row"><div class="compare-meta"><span>Entradas</span><strong>${formatQuantity(inQuantity)}</strong></div><div class="compare-track"><div class="compare-fill in" style="width:${(inQuantity / comparisonMax) * 100}%"></div></div></div>
    <div class="compare-row"><div class="compare-meta"><span>Saídas</span><strong>${formatQuantity(outQuantity)}</strong></div><div class="compare-track"><div class="compare-fill out" style="width:${(outQuantity / comparisonMax) * 100}%"></div></div></div>
    <div class="selected-stock">As quantidades somam unidades de medidas diferentes e representam o volume de registros, não uma conversão física.</div>`;
}

function emptyState(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`;
}

function goToView(view) {
  if (!viewMeta[view]) return;
  state.currentView = view;
  $$("[data-view-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  $("#viewEyebrow").textContent = viewMeta[view][0];
  $("#viewTitle").textContent = viewMeta[view][1];
  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openItemModal(item = null) {
  const modal = $("#itemModal");
  $("#itemModalTitle").textContent = item ? "Editar item" : "Novo item";
  $("#itemId").value = item?.id || "";
  $("#itemName").value = item?.name || "";
  $("#itemCode").value = item?.code || "";
  $("#itemCategory").value = item?.category || "";
  $("#itemUnit").value = item?.unit || "un";
  $("#itemLocation").value = item?.location || "";
  $("#itemCurrentStock").value = item?.currentStock ?? 0;
  $("#itemCurrentStock").disabled = Boolean(item);
  $("#itemMinStock").value = item?.minStock ?? 0;
  $("#itemUnitCost").value = item?.unitCost ?? 0;
  $("#itemSupplier").value = item?.supplier || "";
  $("#itemNotes").value = item?.notes || "";
  modal.showModal();
  requestAnimationFrame(() => $("#itemName").focus());
}

async function saveItem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const existing = getItem($("#itemId").value);
  const item = {
    id: $("#itemId").value || undefined,
    createdAt: existing?.createdAt,
    name: $("#itemName").value,
    code: $("#itemCode").value,
    category: $("#itemCategory").value,
    unit: $("#itemUnit").value,
    location: $("#itemLocation").value,
    currentStock: existing?.currentStock ?? $("#itemCurrentStock").value,
    minStock: $("#itemMinStock").value,
    unitCost: $("#itemUnitCost").value,
    supplier: $("#itemSupplier").value,
    notes: $("#itemNotes").value,
  };
  try {
    $("#saveItemButton").disabled = true;
    await state.repository.saveItem(item);
    await refreshData();
    $("#itemModal").close();
    showToast(existing ? "Item atualizado com sucesso." : "Item cadastrado com sucesso.");
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    $("#saveItemButton").disabled = false;
  }
}

async function deleteItem(id) {
  const item = getItem(id);
  if (!item || !window.confirm(`Excluir “${item.name}”? Esta ação não pode ser desfeita.`)) return;
  try {
    await state.repository.deleteItem(id);
    await refreshData();
    showToast("Item excluído.");
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
}

function updateSelectedStock() {
  const item = getItem($("#movementItem").value);
  $("#selectedStock").textContent = item
    ? `Saldo disponível: ${formatQuantity(item.currentStock)} ${item.unit}. Estoque mínimo: ${formatQuantity(item.minStock)} ${item.unit}.`
    : "Selecione um item para ver o saldo disponível.";
}

async function saveMovement(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const data = {
    type: $("input[name='movementType']:checked").value,
    itemId: $("#movementItem").value,
    quantity: $("#movementQuantity").value,
    documentNumber: $("#movementDocument").value,
    requester: $("#movementRequester").value,
    note: $("#movementNote").value,
  };
  try {
    await state.repository.addMovement(data);
    event.currentTarget.reset();
    await refreshData();
    showToast(data.type === "in" ? "Entrada registrada com sucesso." : "Saída registrada com sucesso.");
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
}

function csvCell(value) {
  let safeValue = String(value ?? "");
  if (/^[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const headers = ["Código", "Item", "Categoria", "Unidade", "Localização", "Estoque atual", "Estoque mínimo", "Custo unitário", "Fornecedor", "Situação"];
  const rows = filteredItems().map((item) => [item.code, item.name, item.category, item.unit, item.location, item.currentStock, item.minStock, item.unitCost, item.supplier, getStockStatus(item).label]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `estoque-${new Date().toISOString().slice(0, 10)}.csv`);
  showToast("Planilha CSV gerada.");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function backupData() {
  try {
    const payload = await state.repository.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, `backup-almox-predial-${new Date().toISOString().slice(0, 10)}.json`);
    showToast("Backup baixado com sucesso.");
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
}

async function restoreData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (!window.confirm(`Restaurar ${payload.items?.length || 0} itens? Os dados locais atuais serão substituídos.`)) return;
    await state.repository.importAll(payload);
    await refreshData();
    showToast("Backup restaurado com sucesso.");
  } catch (error) {
    showToast(friendlyError(error), "error");
  } finally {
    event.target.value = "";
  }
}

async function resetDemo() {
  if (!window.confirm("Restaurar os dados de demonstração? Todos os dados locais atuais serão apagados.")) return;
  try {
    await state.repository.reset();
    await refreshData();
    showToast("Demonstração restaurada.");
  } catch (error) {
    showToast(friendlyError(error), "error");
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("almox-theme", next);
}

function openSidebar() { $("#sidebar").classList.add("is-open"); $("#sidebarScrim").classList.add("is-visible"); }
function closeSidebar() { $("#sidebar").classList.remove("is-open"); $("#sidebarScrim").classList.remove("is-visible"); }

function attachEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => goToView(button.dataset.view)));
  $$("[data-go-view]").forEach((button) => button.addEventListener("click", () => goToView(button.dataset.goView)));
  ["#quickAddItem", "#addItemButton"].forEach((selector) => $(selector).addEventListener("click", () => openItemModal()));
  $("#heroMovementButton").addEventListener("click", () => goToView("movements"));
  $("#itemForm").addEventListener("submit", saveItem);
  $("#closeItemModal").addEventListener("click", () => $("#itemModal").close());
  $("#cancelItemButton").addEventListener("click", () => $("#itemModal").close());
  $("#movementForm").addEventListener("submit", saveMovement);
  $("#movementItem").addEventListener("change", updateSelectedStock);
  $("#itemSearch").addEventListener("input", (event) => { state.itemSearch = event.target.value; renderItems(); });
  $("#categoryFilter").addEventListener("change", (event) => { state.categoryFilter = event.target.value; renderItems(); });
  $("#stockFilter").addEventListener("change", (event) => { state.stockFilter = event.target.value; renderItems(); });
  $("#movementTypeFilter").addEventListener("change", (event) => { state.movementTypeFilter = event.target.value; renderMovements(); });
  $("#itemsTableBody").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-item]");
    const deleteButton = event.target.closest("[data-delete-item]");
    if (editButton) openItemModal(getItem(editButton.dataset.editItem));
    if (deleteButton) deleteItem(deleteButton.dataset.deleteItem);
  });
  $("#exportCsvButton").addEventListener("click", exportCsv);
  $("#printReportButton").addEventListener("click", () => window.print());
  $("#backupButton").addEventListener("click", backupData);
  $("#restoreInput").addEventListener("change", restoreData);
  $("#resetButton").addEventListener("click", resetDemo);
  $("#logoutButton").addEventListener("click", async () => {
    await state.repository.signOut();
    state.items = [];
    state.movements = [];
    renderAll();
    if (!$("#authModal").open) $("#authModal").showModal();
  });
  $("#themeButton").addEventListener("click", toggleTheme);
  $("#menuButton").addEventListener("click", openSidebar);
  $("#sidebarScrim").addEventListener("click", closeSidebar);
}

async function handleAuthentication() {
  if (!isSupabaseConfigured()) return true;
  const modal = $("#authModal");
  const session = await state.repository.getSession();
  if (session) return true;
  modal.showModal();
  state.repository.onAuthStateChange((nextSession) => {
    if (nextSession && modal.open) {
      modal.close();
      refreshData().catch((error) => showToast(friendlyError(error), "error"));
    } else if (!nextSession && !modal.open) {
      state.items = [];
      state.movements = [];
      renderAll();
      modal.showModal();
    }
  });
  return false;
}

async function signIn(event) {
  event.preventDefault();
  const errorLabel = $("#authError");
  errorLabel.textContent = "";
  try {
    await state.repository.signIn($("#authEmail").value, $("#authPassword").value);
    $("#authModal").close();
    await refreshData();
  } catch (error) {
    errorLabel.textContent = friendlyError(error);
  }
}

async function init() {
  document.documentElement.dataset.theme = localStorage.getItem("almox-theme") || "light";
  $("#todayLabel").textContent = longDate.format(new Date());
  attachEvents();
  $("#authForm").addEventListener("submit", signIn);
  $("#authModal").addEventListener("cancel", (event) => event.preventDefault());
  try {
    state.repository = await createRepository();
    setConnectionStatus(state.repository.mode);
    const authenticated = await handleAuthentication();
    if (authenticated) await refreshData();
  } catch (error) {
    setConnectionStatus("local", true);
    showToast(`Não foi possível iniciar o sistema: ${friendlyError(error)}`, "error");
  }
}

init();
