// JS robusto con almacenamiento local, navegación y utilidades
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const logs = $("#logs");

  const log = (msg, obj) => {
    const time = new Date().toLocaleTimeString();
    logs.textContent += `[${time}] ${msg}\n`;
    if (obj) {
      try { logs.textContent += JSON.stringify(obj, null, 2) + "\n"; } catch {}
    }
  };

  // Errores globales visibles
  window.addEventListener("error", (e) => {
    log("ERROR: " + e.message + " (" + (e.filename || "inline") + ":" + e.lineno + ")");
  });
  window.addEventListener("unhandledrejection", (e) => {
    log("PROMESA NO MANEJADA: " + (e.reason?.message || String(e.reason)));
  });

  // ===== Estado =====
  const state = {
    inventory: [],
    cart: [],
    sales: [],
    clients: [],
    employees: [],
    suppliers: [],
    settings: { name: "Farmacia", logo: "", defaultTax: 0 }
  };

  const save = () => {
    localStorage.setItem("farmacia_state", JSON.stringify(state));
  };
  const load = () => {
    const raw = localStorage.getItem("farmacia_state");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      Object.assign(state, s);
    } catch (e) { log("load error: " + e.message); }
  };

  // ===== Utilidades =====
  const money = (n) => "$" + (Number(n || 0).toFixed(2));
  const uid = () => Math.random().toString(36).slice(2, 10);

  // ===== Render básico =====
  const renderHeader = () => {
    $("#businessNameDisplay").textContent = state.settings.name || "Farmacia";
    if (state.settings.logo) $("#logoDisplay").src = state.settings.logo;
    $("#currentDate").textContent = new Date().toLocaleDateString();
    const tick = () => { $("#currentTime").textContent = new Date().toLocaleTimeString(); requestAnimationFrame(tick); };
    tick();
  };

  // ===== Navegación =====
  const showSection = (id) => {
    $$(".app-section").forEach(s => s.classList.add("hidden"));
    const el = $("#"+id);
    if (el) { el.classList.remove("hidden"); el.classList.add("active"); }
    save();
  };

  // ===== Inventario =====
  const seedInventoryIfEmpty = () => {
    if (state.inventory.length) return;
    state.inventory = [
      { id: uid(), name: "Paracetamol 500mg", price: 35, stock: 20 },
      { id: uid(), name: "Ibuprofeno 400mg", price: 48, stock: 15 },
      { id: uid(), name: "Vitamina C 1g", price: 60, stock: 10 },
      { id: uid(), name: "Gel antibacterial 250ml", price: 55, stock: 25 },
    ];
  };

  const renderInventory = () => {
    const list = $("#inventoryList");
    list.innerHTML = "";
    const term = ($("#inventorySearch")?.value || "").toLowerCase();
    const stockFilter = $("#stockFilter")?.value || "all";
    const data = state.inventory.filter(p => {
      const okTerm = p.name.toLowerCase().includes(term);
      const okStock = stockFilter === "low" ? p.stock <= 5 : true;
      return okTerm && okStock;
    });
    if (!data.length) $("#inventoryEmptyMessage").classList.remove("hidden");
    else $("#inventoryEmptyMessage").classList.add("hidden");

    data.forEach(p => {
      const card = document.createElement("div");
      card.className = "card p-4 rounded-xl border border-gray-200";
      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-semibold text-gray-800">${p.name}</h4>
            <p class="text-sm text-gray-500">Stock: ${p.stock}</p>
            <p class="text-sm text-gray-700 mt-1">Precio: <strong>${money(p.price)}</strong></p>
          </div>
          <button class="btn-primary text-white px-3 py-2 rounded" data-add="${p.id}">
            <i class="fas fa-cart-plus mr-1"></i>Vender
          </button>
        </div>
      `;
      list.appendChild(card);
    });

    // Botones vender
    list.querySelectorAll("[data-add]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-add");
        const item = state.inventory.find(i => i.id === id);
        if (!item || item.stock <= 0) return;
        const inCart = state.cart.find(c => c.id === id);
        if (inCart) inCart.qty += 1; else state.cart.push({ id, name: item.name, price: item.price, qty: 1 });
        renderCart();
        save();
      });
    });
  };

  // Inventario en ventas (catálogo)
  const renderSalesInventory = () => {
    const list = $("#salesInventoryList");
    list.innerHTML = "";
    const term = ($("#salesInventorySearch")?.value || "").toLowerCase();
    const data = state.inventory.filter(p => p.name.toLowerCase().includes(term));
    $("#salesInventoryEmpty").classList.toggle("hidden", data.length !== 0);
    data.forEach(p => {
      const card = document.createElement("button");
      card.className = "card p-4 rounded-xl border border-gray-200 text-left";
      card.innerHTML = `
        <h4 class="font-semibold text-gray-800">${p.name}</h4>
        <p class="text-sm text-gray-500">Stock: ${p.stock}</p>
        <p class="text-sm text-gray-700 mt-1">Precio: <strong>${money(p.price)}</strong></p>
      `;
      card.addEventListener("click", () => {
        if (p.stock <= 0) return;
        const inCart = state.cart.find(c => c.id === p.id);
        if (inCart) inCart.qty += 1; else state.cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
        renderCart();
        save();
      });
      list.appendChild(card);
    });
  };

  // Añadir producto (prompt simple)
  const addProductFlow = () => {
    const name = prompt("Nombre del producto:");
    if (!name) return;
    const price = Number(prompt("Precio:") || "0");
    const stock = Number(prompt("Stock:") || "0");
    state.inventory.push({ id: uid(), name, price, stock });
    renderInventory(); renderSalesInventory(); save();
  };

  // Export inventario CSV
  const exportInventory = () => {
    if (!window.Papa) { log("PapaParse no cargó."); return; }
    const csv = Papa.unparse(state.inventory);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "inventario.csv";
    a.click();
  };

  // ===== Carrito / Venta =====
  const totals = () => {
    const subtotal = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
    const taxPct = Number($("#taxInput").value || 0);
    const discPct = Number($("#discountInput").value || 0);
    const tax = subtotal * (taxPct / 100);
    const disc = subtotal * (discPct / 100);
    const total = Math.max(0, subtotal + tax - disc);
    return { subtotal, tax, disc, total };
  };

  const renderCart = () => {
    const list = $("#cartList");
    list.innerHTML = "";
    $("#cartEmptyMessage").classList.toggle("hidden", state.cart.length !== 0);
    state.cart.forEach(item => {
      const row = document.createElement("div");
      row.className = "flex justify-between items-center border rounded p-2";
      row.innerHTML = `
        <div>
          <p class="font-medium">${item.name}</p>
          <p class="text-xs text-gray-500">${money(item.price)} x ${item.qty}</p>
        </div>
        <div class="flex items-center space-x-2">
          <button class="px-2 py-1 border rounded" data-dec="${item.id}">-</button>
          <span>${item.qty}</span>
          <button class="px-2 py-1 border rounded" data-inc="${item.id}">+</button>
          <button class="px-2 py-1 border rounded text-red-600" data-del="${item.id}"><i class="fas fa-trash"></i></button>
        </div>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-dec");
      const it = state.cart.find(i => i.id === id); if (!it) return;
      it.qty -= 1; if (it.qty <= 0) state.cart = state.cart.filter(i => i.id !== id);
      renderCart(); save();
    }));
    list.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-inc");
      const it = state.cart.find(i => i.id === id); if (!it) return;
      it.qty += 1; renderCart(); save();
    }));
    list.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-del");
      state.cart = state.cart.filter(i => i.id !== id);
      renderCart(); save();
    }));

    const t = totals();
    $("#cartSubtotal").textContent = money(t.subtotal);
    $("#taxValue").textContent = money(t.tax);
    $("#discountValue").textContent = money(t.disc);
    $("#cartTotal").textContent = money(t.total);
    $("#checkoutBtn").disabled = state.cart.length === 0;
  };

  const checkout = () => {
    if (!state.cart.length) return;
    // Verifica stock
    for (const item of state.cart) {
      const inv = state.inventory.find(p => p.id === item.id);
      if (!inv || inv.stock < item.qty) { alert("Stock insuficiente para " + item.name); return; }
    }
    // Descuenta stock
    state.cart.forEach(item => {
      const inv = state.inventory.find(p => p.id === item.id);
      inv.stock -= item.qty;
    });
    const t = totals();
    const sale = {
      id: uid(),
      date: new Date().toISOString(),
      items: JSON.parse(JSON.stringify(state.cart)),
      totals: t
    };
    state.sales.unshift(sale);
    state.cart = [];
    renderCart(); renderInventory(); renderSalesInventory(); renderSalesHistory(); renderReports();
    save();
    alert("Venta registrada ✅");
  };

  // ===== Historial / Reportes =====
  const renderSalesHistory = () => {
    const list = $("#salesHistoryList");
    list.innerHTML = "";
    $("#salesHistoryEmptyMessage").classList.toggle("hidden", state.sales.length !== 0);
    state.sales.forEach(s => {
      const div = document.createElement("div");
      const d = new Date(s.date);
      const items = s.items.map(i => `${i.name} x${i.qty}`).join(", ");
      div.className = "p-3 border rounded";
      div.innerHTML = `<div class="flex justify-between">
        <div>
          <p class="font-medium">${d.toLocaleString()}</p>
          <p class="text-sm text-gray-600">${items}</p>
        </div>
        <div class="font-bold">${money(s.totals.total)}</div>
      </div>`;
      list.appendChild(div);
    });
  };

  let chart;
  const renderReports = () => {
    $("#totalSalesCount").textContent = String(state.sales.length);
    const net = state.sales.reduce((s, v) => s + v.totals.total, 0);
    $("#netProfit").textContent = money(net);
    const totalProducts = state.sales.reduce((s, v) => s + v.items.reduce((a, b) => a + b.qty, 0), 0);
    $("#productsSoldCount").textContent = String(totalProducts);

    const last30 = {};
    const now = new Date();
    for (let i=29;i>=0;i--) {
      const d = new Date(now); d.setDate(now.getDate()-i);
      const key = d.toISOString().slice(0,10);
      last30[key] = 0;
    }
    state.sales.forEach(s => {
      const key = s.date.slice(0,10);
      if (last30[key] !== undefined) last30[key] += s.totals.total;
    });
    const labels = Object.keys(last30);
    const data = Object.values(last30);
    const ctx = document.getElementById("salesChart");
    if (window.Chart) {
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets: [{ label: "Ingresos", data }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  };

  // Export CSV de ventas en rango
  const exportCsv = () => {
    const start = $("#reportStartDate").value || "1900-01-01";
    const end = $("#reportEndDate").value || "2999-12-31";
    const rows = state.sales.filter(s => {
      const d = s.date.slice(0,10);
      return d >= start && d <= end;
    }).map(s => ({
      id: s.id, fecha: s.date, total: s.totals.total,
      items: s.items.map(i => `${i.name} x${i.qty} @ ${i.price}`).join("; ")
    }));
    const csv = window.Papa ? Papa.unparse(rows) : "id,fecha,total,items\n" + rows.map(r => `${r.id},${r.fecha},${r.total},"${r.items}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ventas.csv";
    a.click();
  };

  // Export PDF simple
  const exportPdf = () => {
    if (!window.jspdf || !window.jspdf.jsPDF) { log("jsPDF no cargó."); return; }
    const doc = new window.jspdf.jsPDF();
    doc.text("Reporte de Ventas", 14, 16);
    let y = 26;
    state.sales.slice(0, 30).forEach(s => {
      const line = `${new Date(s.date).toLocaleString()} - ${money(s.totals.total)}`;
      doc.text(line, 14, y); y += 8;
      if (y > 280) { doc.addPage(); y = 16; }
    });
    doc.save("reporte.pdf");
  };

  // ===== Clientes / Empleados / Proveedores =====
  const renderList = (arr, container, emptyEl, fields) => {
    container.innerHTML = "";
    if (!arr.length) emptyEl.classList.remove("hidden");
    else emptyEl.classList.add("hidden");
    arr.forEach(obj => {
      const d = document.createElement("div");
      d.className = "p-3 border rounded";
      d.innerHTML = `<p class="font-medium">${fields.map(f => obj[f]).filter(Boolean).join(" — ")}</p>`;
      container.appendChild(d);
    });
  };

  // ===== Configuración =====
  const applySettings = () => {
    renderHeader();
    $("#taxInput").value = state.settings.defaultTax ?? 0;
  };

  // ===== Init =====
  document.addEventListener("DOMContentLoaded", () => {
    try {
      load();
      seedInventoryIfEmpty();
      renderHeader();
      showSection("sales");
      renderInventory();
      renderSalesInventory();
      renderCart();
      renderSalesHistory();
      renderReports();
      applySettings();

      // Sidebar responsive
      const sidebar = $("#sidebar");
      $("#openSidebar").addEventListener("click", () => sidebar.classList.add("open"));
      $("#closeSidebar").addEventListener("click", () => sidebar.classList.remove("open"));
      $("#toggleSidebar").addEventListener("click", () => sidebar.classList.toggle("collapsed"));

      // Menú
      $$(".menu-item").forEach(btn => btn.addEventListener("click", () => showSection(btn.getAttribute("data-section"))));

      // Inventario
      $("#inventorySearch").addEventListener("input", renderInventory);
      $("#salesInventorySearch").addEventListener("input", renderSalesInventory);
      $("#stockFilter").addEventListener("change", renderInventory);
      $("#addProductBtn").addEventListener("click", addProductFlow);
      $("#exportInventoryBtn").addEventListener("click", exportInventory);

      // Venta
      $("#taxInput").addEventListener("input", renderCart);
      $("#discountInput").addEventListener("input", renderCart);
      $("#checkoutBtn").addEventListener("click", checkout);

      // Reportes
      $("#exportCsvBtn").addEventListener("click", exportCsv);
      $("#exportPdfBtn").addEventListener("click", exportPdf);

      // Clientes
      $("#addClientForm").addEventListener("submit", (e) => {
        e.preventDefault();
        state.clients.push({ id: uid(), name: $("#clientName").value, phone: $("#clientPhone").value });
        $("#clientName").value = ""; $("#clientPhone").value = "";
        renderList(state.clients, $("#clientsList"), $("#clientsEmptyMessage"), ["name","phone"]);
        save();
      });
      $("#exportClientsBtn").addEventListener("click", () => {
        const csv = window.Papa ? Papa.unparse(state.clients) : "";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "clientes.csv"; a.click();
      });

      renderList(state.clients, $("#clientsList"), $("#clientsEmptyMessage"), ["name","phone"]);

      // Empleados
      $("#addEmployeeForm").addEventListener("submit", (e) => {
        e.preventDefault();
        state.employees.push({
          id: uid(),
          name: $("#employeeName").value,
          role: $("#employeeRole").value,
          schedule: $("#employeeSchedule").value,
          phone: $("#employeePhone").value
        });
        $("#employeeName").value = $("#employeeRole").value = $("#employeeSchedule").value = $("#employeePhone").value = "";
        renderList(state.employees, $("#employeesList"), $("#employeesEmptyMessage"), ["name","role","phone"]);
        save();
      });
      $("#exportEmployeesBtn").addEventListener("click", () => {
        const csv = window.Papa ? Papa.unparse(state.employees) : "";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "empleados.csv"; a.click();
      });
      renderList(state.employees, $("#employeesList"), $("#employeesEmptyMessage"), ["name","role","phone"]);

      // Proveedores
      $("#addSupplierForm").addEventListener("submit", (e) => {
        e.preventDefault();
        state.suppliers.push({
          id: uid(),
          name: $("#supplierName").value,
          contact: $("#supplierContact").value,
          phone: $("#supplierPhone").value
        });
        $("#supplierName").value = $("#supplierContact").value = $("#supplierPhone").value = "";
        renderList(state.suppliers, $("#suppliersList"), $("#suppliersEmptyMessage"), ["name","contact","phone"]);
        save();
      });
      renderList(state.suppliers, $("#suppliersList"), $("#suppliersEmptyMessage"), ["name","contact","phone"]);

      // Configuración
      $("#saveSettingsBtn").addEventListener("click", () => {
        state.settings.name = $("#businessNameInput").value || state.settings.name;
        state.settings.logo = $("#logoUrlInput").value || state.settings.logo;
        state.settings.defaultTax = Number($("#defaultTaxInput").value || 0);
        applySettings(); save(); alert("Configuración guardada");
      });
      $("#businessNameInput").value = state.settings.name;
      $("#logoUrlInput").value = state.settings.logo;
      $("#defaultTaxInput").value = state.settings.defaultTax ?? 0;

      log("App lista ✅");
    } catch (err) {
      log("Error init: " + err.message);
    }
  });
})();
