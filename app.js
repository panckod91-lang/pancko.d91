const SHEET_ID = "1wHdgm_V0mloLaIsVPIIqbmTYBomx8DIUmXEplClCMz8";
const WEBHOOK_URL = "/.netlify/functions/order";
const OPEN_SHEET = (sheet) => `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(sheet)}`;
const STORAGE_KEYS = {
  seller: "d9_usuario",
  history: "d9_historial",
  pending: "d9_pendientes",
  guestClient: "d9_invitado_cliente"
};

const state = {
  config: {},
  users: [],
  clients: [],
  products: [],
  ads: [],
  support: {},
  seller: null,
  activePriceList: "lista_1",
  priceSearch: "",
  priceCategory: "",
  selectedClient: null,
  guestClientDraft: null,
  selectedCategory: "",
  cart: [],
  currentView: "home",
  historyOpenId: null,
  isSending: false,
  isSyncing: false,
  manualPriceOverride: false
};

const $ = (s) => document.querySelector(s);
const money = (v) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(v) || 0);
const readJSON = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const onlyDigits = (v) => String(v || "").replace(/\D+/g, "");
const isTrue = (v) => String(v).trim().toLowerCase() === "true";
function esc(v){ return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"); }


function renderDualButton(btn, title, sub = "") {
  if (!btn) return;
  btn.innerHTML = `<span class="home-btn-title">${esc(title)}</span><span class="home-btn-sub">${esc(sub)}</span>`;
}

function setButtonBusy(btn, busy, busyLabel = "Procesando...", idleLabel = "", busySub = "") {
  if (!btn) return;
  const dual = btn.classList.contains("home-btn");

  if (!btn.dataset.idleTitle) btn.dataset.idleTitle = btn.dataset.title || btn.querySelector(".home-btn-title")?.textContent?.trim() || idleLabel || btn.textContent.trim();
  if (!btn.dataset.idleSub) btn.dataset.idleSub = btn.dataset.sub || btn.querySelector(".home-btn-sub")?.textContent?.trim() || "";
  if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.dataset.title || idleLabel || btn.textContent.trim();

  if (busy) {
    btn.disabled = true;
    btn.classList.add("is-busy");
    btn.setAttribute("aria-busy", "true");
    if (dual) renderDualButton(btn, busyLabel, busySub || "Esperá un momento");
    else btn.textContent = busyLabel;
    return;
  }

  btn.disabled = false;
  btn.classList.remove("is-busy");
  btn.setAttribute("aria-busy", "false");
  if (dual) renderDualButton(btn, btn.dataset.idleTitle || idleLabel || "", btn.dataset.idleSub || "");
  else btn.textContent = btn.dataset.idleLabel || idleLabel || btn.textContent;
}



function pulseSuccess(btn, label = "Listo", sublabel = "") {
  if (!btn) return;
  const dual = btn.classList.contains("home-btn");
  const idleTitle = btn.dataset.idleTitle || btn.dataset.title || btn.textContent.trim();
  const idleSub = btn.dataset.idleSub || btn.dataset.sub || "";
  const idle = btn.dataset.idleLabel || btn.dataset.title || btn.textContent.trim();

  btn.classList.add("is-success");
  if (dual) renderDualButton(btn, label, sublabel || idleSub || "Todo sincronizado");
  else btn.textContent = label;

  setTimeout(() => {
    btn.classList.remove("is-success");
    if (dual) renderDualButton(btn, idleTitle, idleSub);
    else btn.textContent = idle;
  }, 1400);
}



function openWhatsApp(phone, message) {
  const digits = onlyDigits(phone);
  if (!digits) return false;
  const encoded = encodeURIComponent(message);
  const directUrl = `whatsapp://send?phone=${digits}&text=${encoded}`;
  const fallbackUrl = `https://api.whatsapp.com/send?phone=${digits}&text=${encoded}&type=phone_number&app_absent=0`;

  const startedAt = Date.now();
  let hidden = false;
  const onHide = () => { hidden = true; };
  document.addEventListener("visibilitychange", onHide, { once: true });

  const a = document.createElement("a");
  a.href = directUrl;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    if (!hidden && Date.now() - startedAt < 2200) {
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
    }
  }, 900);
  return true;
}


async function fetchSheet(name) {
  const r = await fetch(OPEN_SHEET(name), { cache: "no-store" });
  if (!r.ok) throw new Error(`No pude leer ${name}`);
  return r.json();
}

async function loadAllData() {
  const [confi, sellers, clients, products, ads, support] = await Promise.all([
    fetchSheet("confi"),
    fetchSheet("usuarios"),
    fetchSheet("clientes"),
    fetchSheet("productos"),
    fetchSheet("publicidad"),
    fetchSheet("soporte")
  ]);

  state.config = Object.fromEntries(confi.map(r => [String(r.clave || "").trim(), String(r.valor || "").trim()]));
  state.users = sellers.filter(r => isTrue(r.activo)).map(r => ({
    id: String(r.id || "").trim(),
    usuario: String(r.usuario || "").trim().toLowerCase(),
    nombre: String(r.nombre || "").trim(),
    clave: String(r.clave || "").trim(),
    rol: String(r.rol || "cliente").trim().toLowerCase(),
    lista_precio: String(r.lista_precio || "").trim().toLowerCase(),
    cliente_id: String(r.cliente_id || "").trim(),
    wasap_report: String(r.wasap_report || "").trim()
  }));
  state.clients = clients.filter(r => isTrue(r.activo)).map(r => ({
    id: String(r.id || "").trim(),
    nombre: String(r.nombre || "").trim(),
    telefono: String(r.telefono || "").trim(),
    direccion: String(r.direccion || "").trim(),
    ciudad: String(r.ciudad || r.localidad || "").trim(),
    lista_precio: String(r.lista_precio || "").trim().toLowerCase()
  }));
  state.products = products.filter(r => isTrue(r.activo)).map(r => ({
    id: String(r.id || "").trim(),
    nombre: String(r.nombre || "").trim(),
    categoria: String(r.categoria || "Sin categoría").trim() || "Sin categoría",
    precios: {
      lista_1: Number(r.lista_1 || r.precio || 0),
      lista_2: Number(r.lista_2 || r.precio || 0),
      lista_3: Number(r.lista_3 || r.precio || 0)
    }
  }));
  state.ads = ads.filter(r => isTrue(r.activo));
  state.support = Object.fromEntries(support.map(r => [String(r.clave || "").trim(), String(r.valor || "").trim()]));
}

function showView(name) {
  state.currentView = name;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(name) {
  const modal = document.getElementById(`${name}Modal`);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(name) {
  const modal = document.getElementById(`${name}Modal`);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  if (name === "product") {
    renderQuickLabels();
    renderCart();
  }
  if (name === "category") {
    renderQuickLabels();
    renderProducts();
  }
  if (name === "occasionalClient") {
    renderQuickLabels();
    renderSelectedClient();
  }
}

function renderTop() {
  $("#appTitle").textContent = state.config.nombre_app || "D9 Pedidos";
  $("#empresaLabel").textContent = state.config.empresa || "Empresa";
}

function renderNetwork() {
  $("#networkStatus").textContent = navigator.onLine ? "Online" : "Offline";
}

function renderSellerBadge() {
  if (!state.seller) {
    $("#sellerBadge").textContent = "Modo invitado";
    return;
  }
  $("#sellerBadge").textContent = `Usuario: ${state.seller.nombre}`;
}

function renderPendingBadge() {
  const pending = readJSON(STORAGE_KEYS.pending, []);
  const el = $("#pendingBadge");
  if (!pending.length) {
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  el.textContent = `${pending.length} pendientes`;
}

function renderBanner() {
  const box = $("#bannerWrap");
  const first = state.ads[0];
  if (!first) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const text = first.texto || "Publicidad";
  const img = first.imagen_url || "";
  const link = first.link_url || "#";
  box.classList.remove("hidden");
  box.innerHTML = `
    <a class="banner-link" href="${esc(link)}" ${link && link !== "#" ? 'target="_blank" rel="noopener noreferrer"' : ""}>
      <div class="banner-content">
        <div class="banner-copy">
          <div class="banner-kicker">Publicidad</div>
          <div class="banner-title">${esc(text)}</div>
        </div>
        ${img ? `<img class="banner-thumb" src="${esc(img)}" alt="Publicidad">` : `<div class="banner-thumb"></div>`}
      </div>
    </a>`;
}

function renderSupport() {
  const s = state.support;
  $("#supportBox").innerHTML = `
    <strong>${esc(s.nombre || "Sin dato")}</strong>
    <div class="mini-text">WhatsApp: ${s.whatsapp ? `<a href="https://wa.me/${onlyDigits(s.whatsapp)}" target="_blank">${esc(s.whatsapp)}</a>` : "-"}</div>
    <div class="mini-text">Email: ${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : "-"}</div>
    <div class="mini-text">Web: ${s.web ? `<a href="${esc(s.web)}" target="_blank">${esc(s.web)}</a>` : "-"}</div>`;
}

function syncSessionUI() {
  const btn = $("#btnChangeSeller");
  if (!btn) return;
  if (state.seller) {
    renderDualButton(btn, "Cambiar usuario", `${state.seller.nombre}`);
    btn.dataset.title = "Cambiar usuario";
    btn.dataset.sub = state.seller.nombre;
  } else {
    renderDualButton(btn, "Ingresar", "Acceder con usuario y clave");
    btn.dataset.title = "Ingresar";
    btn.dataset.sub = "Acceder con usuario y clave";
  }
}

function applyUserContext() {
  if (!state.seller) {
    state.activePriceList = "lista_1";
    if (state.guestClientDraft && !state.selectedClient) state.selectedClient = state.guestClientDraft;
    return;
  }
  if (state.seller.rol === "cliente") {
    const byId = state.seller.cliente_id ? state.clients.find(c => String(c.id) === String(state.seller.cliente_id)) : null;
    const byName = !byId ? state.clients.find(c => c.nombre.trim().toLowerCase() === state.seller.nombre.trim().toLowerCase()) : null;
    const matched = byId || byName;
    state.selectedClient = matched || {
      id: state.seller.cliente_id || state.seller.id,
      nombre: state.seller.nombre,
      telefono: "",
      direccion: "",
      lista_precio: state.seller.lista_precio || "lista_1"
    };
    state.activePriceList = state.selectedClient.lista_precio || state.seller.lista_precio || "lista_1";
  } else {
    state.selectedClient = null;
    state.activePriceList = state.activePriceList || "lista_1";
  }
}

function openLogin(force = false) {
  $("#sellerUser").value = "";
  $("#sellerPass").value = "";
  $("#btnLogout").classList.toggle("hidden", !state.seller);
  openModal("login");
  $("#btnCloseLogin").classList.toggle("hidden", force);
}

function closeLogin() {
  closeModal("login");
}

function logoutSeller() {
  localStorage.removeItem(STORAGE_KEYS.seller);
  window.location.reload();
}

function loginSeller() {
  const userValue = $("#sellerUser").value.trim().toLowerCase();
  const pass = $("#sellerPass").value.trim();
  const seller = state.users.find(s => s.usuario === userValue);
  if (!seller) return toast("Usuario no encontrado.");
  if (!pass || pass !== String(seller.clave || "").trim()) return toast("Clave incorrecta.");
  state.seller = seller;
  saveJSON(STORAGE_KEYS.seller, { id: seller.id, nombre: seller.nombre, usuario: seller.usuario });
  applyUserContext();
  syncSessionUI();
  renderAll();
  closeLogin();
  showView("home");
  toast(`Hola, ${seller.nombre}`);
}

function getActivePriceList() {
  if (!state.seller) return "lista_1";
  if (state.seller?.rol === "cliente") return state.selectedClient?.lista_precio || state.seller.lista_precio || "lista_1";
  return state.activePriceList || "lista_1";
}

function priceLabel(key) {
  const labels = {
    lista_1: "Lista_1 · Contado",
    lista_2: "Lista_2 · Pueblos",
    lista_3: "Lista_3 · Vendedores"
  };
  return labels[key] || key || "Lista";
}

function productPrice(product) {
  const key = getActivePriceList();
  return Number(product?.precios?.[key] || 0);
}

function renderQuickLabels() {
  const isClient = state.seller?.rol === "cliente";
  const guestMode = !state.seller;
  $("#selectedClientLabel").textContent = isClient
    ? (state.selectedClient?.nombre_real || state.selectedClient?.nombre || "Cliente asignado")
    : (state.selectedClient
        ? (state.selectedClient.ocasional ? (state.selectedClient.nombre_real || "Cliente nuevo / ocasional") : state.selectedClient.nombre)
        : (guestMode ? "Cliente nuevo / ocasional" : "Seleccionar cliente"));
  $("#selectedCategoryLabel").textContent = state.selectedCategory || "Todas las categorías";
  $("#selectedProductsLabel").textContent = state.cart.length ? `${state.cart.length} productos seleccionados` : "Seleccionar productos";
  const clientBtn = $("#btnOpenClients");
  if (clientBtn) {
    clientBtn.disabled = isClient;
    clientBtn.classList.toggle("is-locked", isClient);
    if (guestMode) {
      const guestSource = state.selectedClient || state.guestClientDraft;
      const guestLabel = guestSource
        ? [guestSource.nombre_real || guestSource.nombre || "Cliente nuevo / ocasional", guestSource.telefono || guestSource.ciudad || ""].filter(Boolean).join(" · ")
        : "Cargar datos primero";
      const titleEl = clientBtn.querySelector(".picker-label");
      const valueEl = document.getElementById("selectedClientLabel");
      if (titleEl) titleEl.textContent = "Cliente";
      if (valueEl) valueEl.textContent = guestLabel;
      clientBtn.dataset.title = "Cliente";
      clientBtn.dataset.sub = guestSource ? guestLabel : "Cargar datos del comprador";
      clientBtn.classList.toggle("has-client", !!guestSource);
    }
  }
  const clientSearch = $("#clientSearch");
  if (clientSearch && isClient) clientSearch.value = "";
  $("#productModalHint").textContent = state.selectedCategory
    ? `Categoría activa: ${state.selectedCategory}. Podés marcar varios.`
    : "Todas las categorías. Podés marcar varios.";
}

function renderClients() {
  const term = $("#clientSearch").value.trim().toLowerCase();
  const list = $("#clientList");
  const canBrowseClients = state.seller?.rol === "vendedor";
  const filtered = canBrowseClients
    ? state.clients.filter(c => c.nombre.toLowerCase().includes(term)).slice(0, 80)
    : [];
  const occasionalBtn = `
    <button class="option-item option-button special-option" id="btnOccasionalClient" type="button">
      <strong>+ Cliente nuevo / ocasional</strong>
      <div class="option-meta">Cargar nombre, dirección, ciudad y teléfono para este pedido</div>
    </button>`;

  if (!canBrowseClients) {
    list.innerHTML = occasionalBtn;
    return;
  }

  list.innerHTML = filtered.length
    ? occasionalBtn + filtered.map(c => `
      <button class="option-item option-button ${state.selectedClient?.id === c.id ? "is-selected" : ""}" data-client-id="${esc(c.id)}" type="button">
        <strong>${esc(c.nombre)}</strong>
        <div class="option-meta">${esc(c.telefono || "Sin teléfono")} · ${esc(c.direccion || "Sin dirección")}</div>
      </button>`).join("")
    : occasionalBtn || '<div class="empty-state">No encontré clientes.</div>';
}

function selectClient(id) {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  const previousClientId = state.selectedClient?.id || "";
  state.selectedClient = c;
  if (state.seller?.rol === "vendedor") {
    const previousActive = state.activePriceList || "lista_1";
    const nextList = c.lista_precio || "lista_1";
    const changedClient = previousClientId && String(previousClientId) !== String(c.id);
    const changedList = nextList !== previousActive;
    state.activePriceList = nextList;
    state.manualPriceOverride = false;
    if ((changedClient || changedList) && state.cart.length) {
      state.cart = state.cart.map(item => ({ ...item, precio: productPrice(item) }));
      toast("Cambiaste de cliente. Se actualizaron los precios del pedido.");
    }
    refreshPricesAcrossApp();
  }
  renderSelectedClient();
  renderOrderPriceListControls();
  renderClients();
  renderQuickLabels();
  renderCart();
  closeModal("client");
}

function renderSelectedClient() {
  const box = $("#selectedClientCard");
  if (!box) return;
  if (!state.selectedClient || !state.seller) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <strong>${esc(state.selectedClient.ocasional ? "Cliente nuevo / ocasional" : state.selectedClient.nombre)}</strong>
    <div class="mini-text">${esc(state.selectedClient.ocasional ? (state.selectedClient.nombre_real || state.selectedClient.nombre) : (state.selectedClient.telefono || "Sin teléfono"))}</div>
    <div class="mini-text">${esc(state.selectedClient.direccion || "Sin dirección")}</div>`;
}

function renderOrderPriceListControls() {
  const box = $("#orderPriceListBox");
  const select = $("#orderPriceListSelect");
  const info = $("#orderPriceListInfo");
  if (!box || !select || !info) return;

  if (state.seller?.rol === "vendedor") {
    box.classList.remove("hidden");
    select.value = state.activePriceList || "lista_1";
    const clientName = state.selectedClient?.nombre_real || state.selectedClient?.nombre || "sin cliente";
    const defaultList = state.selectedClient?.lista_precio || "lista_1";
    const currentList = state.activePriceList || defaultList;
    const override = !!state.selectedClient && currentList !== defaultList;
    info.textContent = override
      ? `Lista cambiada para ${clientName}: ${priceLabel(currentList)} (por defecto ${priceLabel(defaultList)}).`
      : `Precio activo para ${clientName}: ${priceLabel(currentList)}.`;
  } else {
    box.classList.add("hidden");
    info.textContent = "";
  }
}

function openOccasionalClientModal() {
  $("#occasionalName").value = "";
  $("#occasionalPhone").value = "";
  $("#occasionalAddress").value = "";
  $("#occasionalCity").value = "";
  const priceField = $("#occasionalPriceList");
  const priceWrap = $("#occasionalPriceWrap");
  if (priceField) priceField.value = getActivePriceList() || "lista_1";
  if (priceWrap) priceWrap.classList.toggle("hidden", !state.seller || state.seller?.rol !== "vendedor");
  closeModal("client");
  openModal("occasionalClient");
}

function saveOccasionalClient() {
  const nombre = $("#occasionalName").value.trim();
  const telefono = $("#occasionalPhone").value.trim();
  const direccion = $("#occasionalAddress").value.trim();
  const ciudad = $("#occasionalCity").value.trim();
  const lista = !state.seller ? "lista_1" : ($("#occasionalPriceList").value || "lista_1");

  if (!nombre) return toast("Cargá al menos el nombre del cliente.");

  const previousId = state.selectedClient?.id || "";
  const nextId = `ocasional_${Date.now()}`;
  state.selectedClient = {
    id: nextId,
    nombre: `NUEVO | ${nombre}${telefono ? ' | ' + telefono : ''}${direccion ? ' | ' + direccion : ''}${ciudad ? ' | ' + ciudad : ''}`,
    nombre_real: nombre,
    telefono,
    direccion: [direccion, ciudad].filter(Boolean).join(" · "),
    ciudad,
    lista_precio: lista,
    ocasional: true
  };
  state.guestClientDraft = state.selectedClient;
  if (!state.seller) {
    saveJSON(STORAGE_KEYS.guestClient, state.guestClientDraft);
  }
  state.activePriceList = lista;
  if (previousId && previousId !== nextId && state.cart.length) {
    state.cart = state.cart.map(item => ({ ...item, precio: productPrice(item) }));
    toast("Cliente ocasional cargado. Se actualizaron los precios del pedido.");
  }
  closeModal("occasionalClient");
  closeModal("client");
  closeModal("category");
  closeModal("product");
  renderSelectedClient();
  renderOrderPriceListControls();
  renderClients();
  renderQuickLabels();
  const valueEl = document.getElementById("selectedClientLabel");
  if (valueEl) valueEl.textContent = [nombre, telefono || ciudad || ""].filter(Boolean).join(" · ");
  refreshPricesAcrossApp();
  renderCart();
  showView("order");
}

function renderPriceListControls() {
  const modeBox = $("#priceListModeBox");
  const info = $("#priceListInfo");
  const select = $("#priceListSelect");
  if (!modeBox || !info || !select) return;

  if (!state.seller) {
    state.activePriceList = "lista_1";
    modeBox.classList.add("hidden");
    info.textContent = "Consulta general de precios.";
    renderPriceCategoryChips();
    return;
  }

  if (state.seller.rol === "vendedor") {
    modeBox.classList.remove("hidden");
    select.value = getActivePriceList();
    info.textContent = `Estás viendo ${priceLabel(getActivePriceList())}.`;
  } else {
    modeBox.classList.add("hidden");
    info.textContent = "Estás viendo tus precios asignados.";
  }

  renderPriceCategoryChips();
}

function renderPriceCategoryChips() {
  const wrap = $("#priceCategoryWrap");
  if (!wrap) return;
  const label = state.priceCategory || "Todas las categorías";
  wrap.innerHTML = `
    <button id="btnOpenPriceCategories" class="picker-btn compact-picker" type="button">
      <span class="picker-label-inline">Categoría</span>
      <strong>${esc(label)}</strong>
    </button>`;
  renderPriceCategoryModal();
}

function renderPriceCategoryModal() {
  const list = $("#priceCategoryList");
  if (!list) return;
  const cats = categoriesList();
  list.innerHTML = `
    <button class="option-item option-button ${!state.priceCategory ? "is-selected" : ""}" data-price-category="" type="button">
      <strong>Todas las categorías</strong>
    </button>` + cats.map(cat => `
    <button class="option-item option-button ${state.priceCategory === cat ? "is-selected" : ""}" data-price-category="${esc(cat)}" type="button">
      <strong>${esc(cat)}</strong>
    </button>`).join("");
}

function renderPriceProducts() {
  const box = $("#priceProductsList");
  if (!box) return;
  const term = (state.priceSearch || "").toLowerCase();
  const cat = state.priceCategory;
  const filtered = state.products
    .filter(p => p.nombre.toLowerCase().includes(term) && (!cat || p.categoria === cat))
    .slice(0, 200);

  if (!filtered.length) {
    box.innerHTML = '<div class="empty-state">No encontré productos para esa lista.</div>';
    return;
  }

  box.innerHTML = filtered.map(p => `
    <div class="price-row">
      <div class="price-row-main">
        <strong>${esc(p.nombre)}</strong>
        <div class="option-meta">${esc(p.categoria)}</div>
      </div>
      <div class="price-row-side">
        <strong>${money(productPrice(p))}</strong>
        ${state.seller?.rol === "vendedor" ? `<div class="mini-text">${priceLabel(getActivePriceList())}</div>` : ``}
      </div>
    </div>
  `).join("");
}

function refreshPricesAcrossApp() {
  state.cart = state.cart.map(item => ({ ...item, precio: productPrice(item) }));
  renderQuickLabels();
  renderProducts();
  renderCart();
  renderOrderPriceListControls();
  renderPriceListControls();
  renderPriceProducts();
}

function categoriesList() {
  return [...new Set(state.products.map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderCategories() {
  const list = $("#categoryList");
  const cats = categoriesList();
  const allItem = `
    <button class="option-item option-button ${!state.selectedCategory ? "is-selected" : ""}" data-category="" type="button">
      <strong>Todas las categorías</strong>
      <div class="option-meta">Mostrar todos los productos activos</div>
    </button>`;
  list.innerHTML = allItem + cats.map(c => `
    <button class="option-item option-button ${state.selectedCategory === c ? "is-selected" : ""}" data-category="${esc(c)}" type="button">
      <strong>${esc(c)}</strong>
    </button>`).join("");
}

function selectCategory(category) {
  state.selectedCategory = category;
  $("#productSearch").value = "";
  renderCategories();
  renderProducts();
  renderQuickLabels();
  closeModal("category");
}

function renderProducts() {
  const term = $("#productSearch").value.trim().toLowerCase();
  const cat = state.selectedCategory;
  const list = $("#productList");
  const filtered = state.products
    .filter(p => p.nombre.toLowerCase().includes(term) && (!cat || p.categoria === cat))
    .slice(0, 200);
  list.innerHTML = filtered.length
    ? filtered.map(p => {
      const selected = state.cart.some(x => x.id === p.id);
      return `
        <button class="product-item product-picker ${selected ? "is-selected" : ""}" data-toggle-product="${esc(p.id)}" type="button">
          <div class="product-copy">
            <strong>${esc(p.nombre)}</strong>
            <div class="option-meta">${esc(p.categoria)}</div>
          </div>
          <div class="product-side">
            <div class="product-price">${money(productPrice(p))}</div>
            <div class="pick-state">${selected ? "Seleccionado" : "Tocar para agregar"}</div>
          </div>
        </button>`;
    }).join("")
    : '<div class="empty-state">No encontré productos.</div>';
}

function toggleProduct(id) {
  const existing = state.cart.find(x => x.id === id);
  if (existing) {
    state.cart = state.cart.filter(x => x.id !== id);
  } else {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.cart.push({ ...p, precio: productPrice(p), cantidad: 1 });
  }
  renderProducts();
  renderQuickLabels();
  renderCart();
}

function updateQty(id, delta) {
  const item = state.cart.find(x => x.id === id);
  if (!item) return;
  item.cantidad += delta;
  item.precio = productPrice(item);
  if (item.cantidad <= 0) state.cart = state.cart.filter(x => x.id !== id);
  renderProducts();
  renderQuickLabels();
  renderCart();
}

function removeItem(id) {
  state.cart = state.cart.filter(x => x.id !== id);
  renderProducts();
  renderQuickLabels();
  renderCart();
}

function clearCart() {
  state.cart = [];
  renderProducts();
  renderQuickLabels();
  renderCart();
}

function cartTotal() {
  return state.cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
}

function generateMessageText(payload = null) {
  const source = payload || {
    cliente: state.selectedClient,
    carrito: state.cart,
    vendedor: state.seller,
    total: cartTotal()
  };
  if (!source.cliente || !source.carrito.length) return "Seleccioná cliente y productos.";
  const lines = [
    "Pedido:",
    `Cliente: ${source.cliente.nombre_real || source.cliente.nombre}`,
    source.vendedor?.nombre ? `Usuario: ${source.vendedor.nombre}` : "",
    ""
  ].filter(Boolean);
  source.carrito.forEach(item => {
    lines.push(`- ${item.nombre} x${item.cantidad} = ${money(item.precio * item.cantidad)}`);
  });
  lines.push("", `Total: ${money(source.total)}`);
  return lines.join("\n");
}

function renderCart() {
  const box = $("#cartList");
  if (!state.cart.length) {
    box.className = "cart-list empty-state";
    box.textContent = "Todavía no agregaste productos.";
  } else {
    box.className = "cart-list";
    box.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <div class="cart-top">
          <div>
            <strong>${esc(item.nombre)}</strong>
            <div class="mini-text">${money(item.precio)} c/u</div>
          </div>
          <button class="remove-btn" data-remove-id="${esc(item.id)}" type="button">Quitar</button>
        </div>
        <div class="qty-row">
          <button class="qty-btn" data-qty="minus" data-id="${esc(item.id)}" type="button">−</button>
          <div class="qty-value">${item.cantidad}</div>
          <button class="qty-btn" data-qty="plus" data-id="${esc(item.id)}" type="button">+</button>
          <div class="product-price">${money(item.precio * item.cantidad)}</div>
        </div>
      </div>`).join("");
  }
  $("#summaryItems").textContent = state.cart.reduce((acc, item) => acc + item.cantidad, 0);
  $("#summaryTotal").textContent = money(cartTotal());
  $("#messagePreview").textContent = generateMessageText();
}

function buildOrderPayload() {
  return {
    fecha: new Date().toISOString(),
    vendedor: state.seller,
    cliente: state.selectedClient,
    carrito: state.cart.map(x => ({ id: x.id, nombre: x.nombre, cantidad: x.cantidad, precio: x.precio })),
    total: cartTotal(),
    detalle: state.cart.map(x => `${x.nombre} x${x.cantidad}`).join(" | ")
  };
}

function validateOrder() {
  if (!state.selectedClient) return toast(state.seller?.rol === "cliente" ? "No se encontró el cliente asignado." : "Elegí o cargá un cliente.");
  if (!state.cart.length) return toast("Agregá productos.");
  return true;
}

function buildWebhookPayload(payload) {
  return {
    vendedor_id: payload?.vendedor?.id || "",
    vendedor: payload?.vendedor?.nombre || "",
    cliente: payload?.cliente?.nombre_real || payload?.cliente?.nombre || "",
    items: (payload?.carrito || []).map(item => ({
      nombre: item.nombre,
      cantidad: Number(item.cantidad || 0),
      precio: Number(item.precio || 0)
    })),
    total: Number(payload?.total || 0),
    fecha: payload?.fecha || new Date().toISOString()
  };
}

async function trySendToWebhook(payload) {
  if (!WEBHOOK_URL) return { ok: false, error: "Webhook no configurado" };
  const sendPayload = buildWebhookPayload(payload);
  const r = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sendPayload)
  });

  let data = null;
  const raw = await r.text();
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (!r.ok) {
    return { ok: false, status: r.status, error: data?.error || raw || "Error HTTP" };
  }

  return { ok: !!data?.ok, data };
}

function saveHistory(payload, status = "enviado", error = "") {
  const history = readJSON(STORAGE_KEYS.history, []);
  history.unshift({
    id: `${payload.fecha}_${payload.cliente?.id || payload.cliente?.nombre_real || payload.cliente?.nombre || "pedido"}_${Math.random().toString(36).slice(2, 8)}`,
    fecha: payload.fecha,
    vendedor: payload.vendedor?.nombre || "",
    cliente: payload.cliente?.nombre_real || payload.cliente?.nombre || "",
    cliente_id: payload.cliente?.id || "",
    detalle: payload.detalle,
    total: payload.total,
    status,
    items: (payload.carrito || []).map(x => ({
      id: x.id,
      nombre: x.nombre,
      cantidad: x.cantidad,
      precio: x.precio,
      subtotal: Number(x.precio || 0) * Number(x.cantidad || 0)
    })),
    error
  });
  saveJSON(STORAGE_KEYS.history, history.slice(0, 300));
  renderHistory();
}

function savePendingPayload(payload) {
  const pending = readJSON(STORAGE_KEYS.pending, []);
  pending.push(payload);
  saveJSON(STORAGE_KEYS.pending, pending);
  renderPendingBadge();
}

async function sendOrder() {
  if (state.isSending) return;
  if (validateOrder() !== true) return;

  state.isSending = true;
  const sendBtn = $("#btnSend");
  const pendingBtn = $("#btnSyncPending");
  setButtonBusy(sendBtn, true, "Enviando...", "Enviar pedido");

  try {
    const payload = buildOrderPayload();
    const waPhone = state.seller?.rol === "vendedor" ? (state.seller.wasap_report || state.config.telefono_wa || "") : (state.config.telefono_wa || "");
    const waText = generateMessageText(payload);

    if (!navigator.onLine) {
      savePendingPayload(payload);
      saveHistory(payload, "pendiente", "Sin conexión");
      toast("Sin internet. Pedido guardado pendiente.");
      if (pendingBtn) pulseSuccess(pendingBtn, "Pendiente guardado", "Se enviará al recuperar conexión");
      return;
    }

    const webhookResult = await trySendToWebhook(payload).catch(error => ({ ok: false, error: String(error) }));

    if (!webhookResult.ok) {
      savePendingPayload(payload);
      saveHistory(payload, "pendiente", webhookResult.error || "No pude confirmar el envío");
      toast("No pude confirmar el envío. Quedó pendiente.");
      if (pendingBtn) pulseSuccess(pendingBtn, "Quedó pendiente", "Reintentar registros pendientes");
      return;
    }

    saveHistory(payload, "enviado", "");
    renderPendingBadge();
    pulseSuccess(sendBtn, "Enviado");

    if (!openWhatsApp(waPhone, waText)) {
      toast("Falta telefono_wa en confi.");
    }
  } finally {
    if (state.seller?.rol === "cliente") {
      applyUserContext();
    } else if (!state.seller) {
      state.selectedClient = state.guestClientDraft || state.selectedClient;
    } else {
      state.selectedClient = null;
    }
    clearCart();
    renderSelectedClient();
    renderClients();
    state.isSending = false;
    setButtonBusy(sendBtn, false, "Enviando...", "Enviar pedido");
  }
}

function savePendingNow() {
  if (validateOrder() !== true) return;
  const payload = buildOrderPayload();
  savePendingPayload(payload);
  saveHistory(payload, "pendiente");
  if (state.seller?.rol === "cliente") {
    applyUserContext();
  } else if (!state.seller) {
    state.selectedClient = state.guestClientDraft || state.selectedClient;
  } else {
    state.selectedClient = null;
  }
  clearCart();
  renderSelectedClient();
  renderClients();
  toast("Pedido guardado como pendiente.");
}

async function syncPending() {
  if (state.isSyncing) return;

  const pending = readJSON(STORAGE_KEYS.pending, []);
  if (!navigator.onLine || !pending.length) {
    renderPendingBadge();
    if (!pending.length) toast("No hay pendientes.");
    return;
  }

  state.isSyncing = true;
  const syncBtn = $("#btnSyncPending");
  setButtonBusy(syncBtn, true, "Sincronizando...", syncBtn?.textContent?.trim() || "Pendientes", "Revisando y enviando pendientes");

  try {
    const remaining = [];
    let sentCount = 0;

    for (const item of pending) {
      try {
        const result = await trySendToWebhook(item);
        if (result.ok) {
          sentCount++;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    saveJSON(STORAGE_KEYS.pending, remaining);
    renderPendingBadge();

    if (sentCount && !remaining.length) {
      toast("Pendientes sincronizados.");
      pulseSuccess(syncBtn, "Sin pendientes", "Todo sincronizado");
      return;
    }

    if (sentCount && remaining.length) {
      toast(`Se enviaron ${sentCount}. Quedaron ${remaining.length} pendientes.`);
      return;
    }

    if (remaining.length) {
      toast(`Quedaron ${remaining.length} pendientes.`);
    }
  } finally {
    state.isSyncing = false;
    setButtonBusy(syncBtn, false, "Sincronizando...", syncBtn?.dataset?.idleLabel || "Pendientes");
  }
}

function renderHistory() {
  const history = readJSON(STORAGE_KEYS.history, []);
  const list = $("#historyList");
  if (!history.length) {
    list.className = "history-list empty-state";
    list.textContent = "Sin movimientos todavía.";
    return;
  }

  list.className = "history-list";
  list.innerHTML = history.map(item => {
    const itemId = item.id || `${item.fecha}_${item.cliente}_${item.total}`;
    const isOpen = state.historyOpenId === itemId;
    const items = Array.isArray(item.items) ? item.items : [];
    const detailHtml = items.length
      ? `
        <div class="history-detail ${isOpen ? '' : 'hidden'}" id="detail-${esc(itemId)}">
          ${items.map(prod => `
            <div class="history-product-row">
              <div class="history-product-main">
                <strong>${esc(prod.nombre)}</strong>
                <div class="mini-text">${money(prod.precio)} c/u</div>
              </div>
              <div class="history-product-side">
                <span class="history-qty">x${esc(prod.cantidad)}</span>
                <strong>${money(prod.subtotal ?? (Number(prod.precio || 0) * Number(prod.cantidad || 0)))}</strong>
              </div>
            </div>`).join('')}
        </div>`
      : `
        <div class="history-detail ${isOpen ? '' : 'hidden'}" id="detail-${esc(itemId)}">
          <div class="mini-text">${esc(item.detalle || 'Sin detalle cargado.')}</div>
        </div>`;

    return `
      <button class="history-item ${isOpen ? 'is-open' : ''}" data-history-id="${esc(itemId)}" type="button">
        <div class="history-head-row">
          <div class="history-copy">
            <strong>${esc(item.cliente)}</strong>
            <div class="mini-text">${new Date(item.fecha).toLocaleString("es-AR")}</div>
            <div class="mini-text history-meta-line">${esc(item.vendedor)} · ${esc(item.status || "")}${item.error ? ' · ' + esc(item.error) : ''}</div>
          </div>
          <div class="history-side">
            <div class="product-price">${money(item.total)}</div>
            <div class="history-toggle">${isOpen ? '▲' : '▼'}</div>
          </div>
        </div>
        ${detailHtml}
      </button>`;
  }).join('');
}

function toggleHistoryItem(id) {
  state.historyOpenId = state.historyOpenId === id ? null : id;
  renderHistory();
}

function exportHistory() {
  const history = readJSON(STORAGE_KEYS.history, []);
  if (!history.length) return toast("No hay historial para exportar.");
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `d9_historial_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}


function resetTransientUI() {
  state.isSending = false;
  state.isSyncing = false;
  const sendBtn = $("#btnSend");
  const syncBtn = $("#btnSyncPending");
  if (sendBtn) setButtonBusy(sendBtn, false, "Enviando...", "Enviar pedido");
  if (syncBtn) setButtonBusy(syncBtn, false, "Sincronizando...", syncBtn?.dataset?.idleLabel || "Pendientes");
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function bind() {
  $("#btnGoOrder").addEventListener("click", () => showView("order"));
  $("#btnGoPrices").addEventListener("click", () => { renderPriceListControls(); renderPriceProducts(); showView("prices"); });
  $("#btnGoHistory").addEventListener("click", () => { renderHistory(); showView("history"); });
  $("#btnPancko").addEventListener("click", () => { renderSupport(); showView("support"); });
  $("#btnChangeSeller").addEventListener("click", () => openLogin(false));
  $("#btnSyncPending").addEventListener("click", syncPending);
  $("#btnLogin").addEventListener("click", loginSeller);
  $("#btnLogout").addEventListener("click", logoutSeller);
  $("#btnSaveOccasionalClient").addEventListener("click", saveOccasionalClient);
  $("#sellerUser").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#sellerPass").focus(); });
  $("#sellerPass").addEventListener("keydown", (e) => { if (e.key === "Enter") loginSeller(); });
  $("#btnCloseLogin").addEventListener("click", closeLogin);
  $("#clientSearch").addEventListener("input", renderClients);
  $("#productSearch").addEventListener("input", renderProducts);
  $("#priceSearch").addEventListener("input", (e) => { state.priceSearch = e.target.value.trim().toLowerCase(); renderPriceProducts(); });
  $("#priceListSelect").addEventListener("change", (e) => { state.activePriceList = e.target.value; refreshPricesAcrossApp(); });
  const orderPriceSelect = $("#orderPriceListSelect");
  if (orderPriceSelect) orderPriceSelect.addEventListener("change", (e) => {
    const next = e.target.value || "lista_1";
    if (state.activePriceList === next) {
      renderOrderPriceListControls();
      return;
    }
    state.activePriceList = next;
    state.manualPriceOverride = !!state.selectedClient && next !== (state.selectedClient.lista_precio || "lista_1");
    refreshPricesAcrossApp();
    if (state.cart.length) toast(`Se aplicó ${priceLabel(next)} al pedido.`);
  });
  $("#btnClearCart").addEventListener("click", clearCart);
  $("#btnSend").addEventListener("click", sendOrder);
  $("#btnSavePending").addEventListener("click", savePendingNow);
  $("#btnExportHistory").addEventListener("click", exportHistory);
  $("#btnOpenClients").addEventListener("click", () => {
    if (state.seller?.rol === "cliente") return;
    if (!state.seller) {
      openOccasionalClientModal();
      return;
    }
    renderClients();
    openModal("client");
  });
  $("#btnOpenCategories").addEventListener("click", () => {
    if (!state.selectedClient && !state.seller?.rol) {
      toast("Primero cargá los datos del comprador.");
      openOccasionalClientModal();
      return;
    }
    renderCategories();
    openModal("category");
  });
  $("#btnOpenProducts").addEventListener("click", () => {
    if (!state.selectedClient && !state.seller?.rol) {
      toast("Primero cargá los datos del comprador.");
      openOccasionalClientModal();
      return;
    }
    renderProducts();
    openModal("product");
  });

  document.addEventListener("click", (ev) => {
    const back = ev.target.closest("[data-back]");
    if (back) showView(back.dataset.back);

    const closeBtn = ev.target.closest("[data-close-modal]");
    if (closeBtn) closeModal(closeBtn.dataset.closeModal);

    const occasional = ev.target.closest("#btnOccasionalClient");
    if (occasional) openOccasionalClientModal();

    const client = ev.target.closest("[data-client-id]");
    if (client) selectClient(client.dataset.clientId);

    const cat = ev.target.closest("[data-category]");
    if (cat) selectCategory(cat.dataset.category);

    const toggle = ev.target.closest("[data-toggle-product]");
    if (toggle) toggleProduct(toggle.dataset.toggleProduct);

    const qty = ev.target.closest("[data-qty]");
    if (qty) updateQty(qty.dataset.id, qty.dataset.qty === "plus" ? 1 : -1);

    const remove = ev.target.closest("[data-remove-id]");
    if (remove) removeItem(remove.dataset.removeId);

    const historyItem = ev.target.closest("[data-history-id]");
    if (historyItem) toggleHistoryItem(historyItem.dataset.historyId);

    const openPriceCats = ev.target.closest("#btnOpenPriceCategories");
    if (openPriceCats) {
      renderPriceCategoryModal();
      openModal("priceCategory");
    }

    const priceCategory = ev.target.closest("[data-price-category]");
    if (priceCategory) {
      state.priceCategory = priceCategory.dataset.priceCategory || "";
      renderPriceCategoryChips();
      renderPriceProducts();
      closeModal("priceCategory");
    }
  });

  window.addEventListener("online", () => { renderNetwork(); syncPending(); });
  window.addEventListener("offline", renderNetwork);
  window.addEventListener("pageshow", () => { resetTransientUI(); renderQuickLabels(); renderCart(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resetTransientUI(); });
}

function hydrateGuestClient() {
  const stored = readJSON(STORAGE_KEYS.guestClient, null);
  if (!stored?.nombre) return false;
  state.guestClientDraft = stored;
  return true;
}

function hydrateSeller() {
  const stored = readJSON(STORAGE_KEYS.seller, null);
  if (!stored?.id) return false;
  const seller = state.users.find(s => s.id === stored.id);
  if (!seller) return false;
  state.seller = seller;
  return true;
}

function renderAll() {
  renderTop();
  renderNetwork();
  renderSellerBadge();
  renderPendingBadge();
  renderBanner();
  renderSupport();
  syncSessionUI();
  applyUserContext();
  renderQuickLabels();
  renderCategories();
  renderClients();
  renderSelectedClient();
  renderProducts();
  renderCart();
  renderPriceListControls();
  renderPriceProducts();
  renderHistory();
}


async function disableServiceWorkerAndCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    console.info('[D9] Service workers y caches limpiados para esta etapa de pruebas.');
  } catch (error) {
    console.warn('[D9] No pude limpiar service workers/caches:', error);
  }
}

async function init() {
  // disableServiceWorkerAndCaches(); // usar solo para debug de cache/SW
  bind();
  try {
    await loadAllData();
    hydrateGuestClient();
    hydrateSeller();
    renderAll();

    if (navigator.onLine) syncPending();
  } catch (error) {
    console.error(error);
    toast("No pude cargar los datos de la sheet.");
  }
}

init();
