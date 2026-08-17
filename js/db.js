import { APP_CONFIG } from "./config.js";

const DB_NAME = "almox-predial";
const DB_VERSION = 1;

export const DEMO_ITEMS = [
  { id: "item-ele-001", code: "ELE-001", name: "Lâmpada LED 12W", category: "Elétrica", unit: "un", location: "Prateleira A-01", minStock: 20, currentStock: 48, unitCost: 9.9, supplier: "Luz & Cia", notes: "Luz branca 6500K", createdAt: "2026-07-15T10:00:00.000Z" },
  { id: "item-hid-004", code: "HID-004", name: "Torneira de jardim 1/2\"", category: "Hidráulica", unit: "un", location: "Prateleira B-03", minStock: 8, currentStock: 5, unitCost: 32.5, supplier: "Hidro Forte", notes: "Metal cromado", createdAt: "2026-07-16T10:00:00.000Z" },
  { id: "item-lim-012", code: "LIM-012", name: "Detergente neutro 5L", category: "Limpeza", unit: "gl", location: "Corredor C-02", minStock: 10, currentStock: 18, unitCost: 21.75, supplier: "Limpa Brasil", notes: "Galão de 5 litros", createdAt: "2026-07-17T10:00:00.000Z" },
  { id: "item-fer-007", code: "FER-007", name: "Broca para concreto 8mm", category: "Ferramentas", unit: "un", location: "Gaveta D-04", minStock: 6, currentStock: 0, unitCost: 14.2, supplier: "Casa do Instalador", notes: "Encaixe cilíndrico", createdAt: "2026-07-18T10:00:00.000Z" },
  { id: "item-pin-003", code: "PIN-003", name: "Tinta acrílica branca 18L", category: "Pintura", unit: "un", location: "Piso E-01", minStock: 4, currentStock: 7, unitCost: 289.9, supplier: "Cores Prediais", notes: "Acabamento fosco", createdAt: "2026-07-19T10:00:00.000Z" },
  { id: "item-epi-009", code: "EPI-009", name: "Luva nitrílica reforçada", category: "EPI", unit: "par", location: "Armário F-02", minStock: 15, currentStock: 12, unitCost: 18.6, supplier: "Protege EPI", notes: "Tamanho G", createdAt: "2026-07-20T10:00:00.000Z" },
  { id: "item-ele-015", code: "ELE-015", name: "Disjuntor monopolar 20A", category: "Elétrica", unit: "un", location: "Prateleira A-04", minStock: 10, currentStock: 24, unitCost: 17.8, supplier: "Luz & Cia", notes: "Curva C", createdAt: "2026-07-21T10:00:00.000Z" },
  { id: "item-hid-011", code: "HID-011", name: "Fita veda rosca 18mm", category: "Hidráulica", unit: "un", location: "Prateleira B-01", minStock: 12, currentStock: 31, unitCost: 3.45, supplier: "Hidro Forte", notes: "Rolo 25m", createdAt: "2026-07-22T10:00:00.000Z" },
  { id: "item-lim-021", code: "LIM-021", name: "Saco de lixo 100L", category: "Limpeza", unit: "pct", location: "Corredor C-05", minStock: 20, currentStock: 27, unitCost: 26.9, supplier: "Limpa Brasil", notes: "Pacote com 100 unidades", createdAt: "2026-07-23T10:00:00.000Z" },
];

export const DEMO_MOVEMENTS = [
  { id: "mov-001", itemId: "item-lim-012", type: "out", quantity: 2, requester: "Equipe de limpeza", documentNumber: "REQ-1842", note: "Reposição semanal", stockAfter: 18, createdAt: "2026-08-14T12:15:00.000Z" },
  { id: "mov-002", itemId: "item-ele-001", type: "in", quantity: 24, requester: "Marcos", documentNumber: "NF-7751", note: "Compra mensal", stockAfter: 48, createdAt: "2026-08-14T09:30:00.000Z" },
  { id: "mov-003", itemId: "item-epi-009", type: "out", quantity: 4, requester: "Manutenção civil", documentNumber: "OS-349", note: "Serviço no bloco B", stockAfter: 12, createdAt: "2026-08-13T16:45:00.000Z" },
  { id: "mov-004", itemId: "item-hid-004", type: "out", quantity: 3, requester: "Equipe hidráulica", documentNumber: "OS-345", note: "Troca no jardim", stockAfter: 5, createdAt: "2026-08-12T14:10:00.000Z" },
  { id: "mov-005", itemId: "item-pin-003", type: "in", quantity: 4, requester: "Ana", documentNumber: "NF-7698", note: "Reposição", stockAfter: 7, createdAt: "2026-08-09T11:05:00.000Z" },
  { id: "mov-006", itemId: "item-fer-007", type: "out", quantity: 2, requester: "Manutenção geral", documentNumber: "OS-338", note: "Últimas unidades", stockAfter: 0, createdAt: "2026-08-08T15:25:00.000Z" },
];

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Operação cancelada."));
  });
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

class LocalRepository {
  constructor() {
    this.mode = "local";
    this.database = null;
  }

  async init() {
    if (!("indexedDB" in window)) throw new Error("Este navegador não oferece suporte ao banco local IndexedDB.");

    this.database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("items")) {
          const store = db.createObjectStore("items", { keyPath: "id" });
          store.createIndex("code", "code", { unique: true });
          store.createIndex("category", "category", { unique: false });
        }
        if (!db.objectStoreNames.contains("movements")) {
          const store = db.createObjectStore("movements", { keyPath: "id" });
          store.createIndex("itemId", "itemId", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const items = await this.getItems();
    if (!items.length) await this.seed();
    return this;
  }

  async seed() {
    const tx = this.database.transaction(["items", "movements"], "readwrite");
    DEMO_ITEMS.forEach((item) => tx.objectStore("items").put({ ...item }));
    DEMO_MOVEMENTS.forEach((movement) => tx.objectStore("movements").put({ ...movement }));
    await transactionDone(tx);
  }

  async getItems() {
    const tx = this.database.transaction("items", "readonly");
    const values = await requestToPromise(tx.objectStore("items").getAll());
    return values.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async saveItem(item) {
    const normalized = {
      ...item,
      id: item.id || makeId("item"),
      code: item.code.trim().toUpperCase(),
      name: item.name.trim(),
      category: item.category.trim(),
      location: item.location.trim(),
      supplier: item.supplier?.trim() || "",
      notes: item.notes?.trim() || "",
      currentStock: Number(item.currentStock),
      minStock: Number(item.minStock),
      unitCost: Number(item.unitCost),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const tx = this.database.transaction("items", "readwrite");
    await requestToPromise(tx.objectStore("items").put(normalized));
    await transactionDone(tx);
    return normalized;
  }

  async deleteItem(id) {
    const movements = await this.getMovements();
    if (movements.some((movement) => movement.itemId === id)) {
      throw new Error("Este item possui movimentações e não pode ser excluído. Edite-o para manter o histórico.");
    }
    const tx = this.database.transaction("items", "readwrite");
    tx.objectStore("items").delete(id);
    await transactionDone(tx);
  }

  async getMovements() {
    const tx = this.database.transaction("movements", "readonly");
    const values = await requestToPromise(tx.objectStore("movements").getAll());
    return values.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async addMovement(movement) {
    const tx = this.database.transaction(["items", "movements"], "readwrite");
    const itemStore = tx.objectStore("items");
    const movementStore = tx.objectStore("movements");
    const item = await requestToPromise(itemStore.get(movement.itemId));
    if (!item) throw new Error("O item selecionado não foi encontrado.");

    const quantity = Number(movement.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Informe uma quantidade maior que zero.");
    if (movement.type === "out" && quantity > item.currentStock) throw new Error(`Saldo insuficiente. Disponível: ${item.currentStock} ${item.unit}.`);

    item.currentStock = Number(item.currentStock) + (movement.type === "in" ? quantity : -quantity);
    item.updatedAt = new Date().toISOString();
    const record = {
      ...movement,
      id: makeId("mov"),
      quantity,
      requester: movement.requester?.trim() || "Não informado",
      documentNumber: movement.documentNumber?.trim() || "",
      note: movement.note?.trim() || "",
      stockAfter: item.currentStock,
      createdAt: new Date().toISOString(),
    };
    itemStore.put(item);
    movementStore.add(record);
    await transactionDone(tx);
    return record;
  }

  async exportAll() {
    return { version: 1, exportedAt: new Date().toISOString(), items: await this.getItems(), movements: await this.getMovements() };
  }

  async importAll(payload) {
    if (!Array.isArray(payload?.items) || !Array.isArray(payload?.movements)) throw new Error("Arquivo de backup inválido.");
    const tx = this.database.transaction(["items", "movements"], "readwrite");
    const itemStore = tx.objectStore("items");
    const movementStore = tx.objectStore("movements");
    itemStore.clear();
    movementStore.clear();
    payload.items.forEach((item) => itemStore.put(item));
    payload.movements.forEach((movement) => movementStore.put(movement));
    await transactionDone(tx);
  }

  async reset() {
    const tx = this.database.transaction(["items", "movements"], "readwrite");
    tx.objectStore("items").clear();
    tx.objectStore("movements").clear();
    await transactionDone(tx);
    await this.seed();
  }

  async getSession() { return { user: null }; }
  onAuthStateChange() { return () => {}; }
  async signIn() { throw new Error("O login só é usado quando o Supabase está conectado."); }
  async signOut() {}
}

function mapItem(row) {
  return { id: row.id, code: row.code, name: row.name, category: row.category, unit: row.unit, location: row.location, minStock: Number(row.min_stock), currentStock: Number(row.current_stock), unitCost: Number(row.unit_cost), supplier: row.supplier || "", notes: row.notes || "", createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapMovement(row) {
  return { id: row.id, itemId: row.item_id, type: row.type, quantity: Number(row.quantity), requester: row.requester || "Não informado", documentNumber: row.document_number || "", note: row.note || "", stockAfter: Number(row.stock_after), createdAt: row.created_at };
}

class SupabaseRepository {
  constructor(url, key) {
    this.mode = "supabase";
    this.url = url;
    this.key = key;
    this.client = null;
  }

  async init() {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    this.client = createClient(this.url, this.key, { auth: { persistSession: true, autoRefreshToken: true } });
    return this;
  }

  async getItems() {
    const { data, error } = await this.client.from("inventory_items").select("*").order("name");
    if (error) throw error;
    return data.map(mapItem);
  }

  async saveItem(item) {
    const row = { code: item.code.trim().toUpperCase(), name: item.name.trim(), category: item.category.trim(), unit: item.unit, location: item.location.trim(), min_stock: Number(item.minStock), current_stock: Number(item.currentStock), unit_cost: Number(item.unitCost), supplier: item.supplier?.trim() || null, notes: item.notes?.trim() || null };
    if (item.id) row.id = item.id;
    const { data, error } = await this.client.from("inventory_items").upsert(row).select().single();
    if (error) throw error;
    return mapItem(data);
  }

  async deleteItem(id) {
    const { error } = await this.client.from("inventory_items").delete().eq("id", id);
    if (error) throw error;
  }

  async getMovements() {
    const { data, error } = await this.client.from("inventory_movements").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(mapMovement);
  }

  async addMovement(movement) {
    const { data, error } = await this.client.rpc("register_inventory_movement", { p_item_id: movement.itemId, p_type: movement.type, p_quantity: Number(movement.quantity), p_requester: movement.requester?.trim() || null, p_document_number: movement.documentNumber?.trim() || null, p_note: movement.note?.trim() || null });
    if (error) throw error;
    return mapMovement(Array.isArray(data) ? data[0] : data);
  }

  async exportAll() { return { version: 1, exportedAt: new Date().toISOString(), items: await this.getItems(), movements: await this.getMovements() }; }
  async importAll() { throw new Error("No modo compartilhado, restaure backups diretamente no painel do Supabase."); }
  async reset() { throw new Error("A restauração da demonstração só está disponível no modo local."); }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  onAuthStateChange(callback) {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  }

  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }

  async signOut() { await this.client.auth.signOut(); }
}

export function isSupabaseConfigured() {
  return Boolean(APP_CONFIG.supabaseUrl?.startsWith("https://") && APP_CONFIG.supabaseAnonKey?.length > 40);
}

export async function createRepository() {
  const repository = isSupabaseConfigured()
    ? new SupabaseRepository(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey)
    : new LocalRepository();
  return repository.init();
}
