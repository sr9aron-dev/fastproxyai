const $ = (selector) => document.querySelector(selector);

const state = {
  adminToken: localStorage.getItem("adminToken") || ""
};

$("#adminToken").value = state.adminToken;

function setOutput(payload) {
  $("#output").textContent = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}

async function api(path, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };

  if (state.adminToken) headers["x-admin-token"] = state.adminToken;

  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload?.error?.message || `Request failed with ${response.status}`);
  }
  return payload;
}

function selectedProviderOrder() {
  const selected = document.querySelector("input[name='providerOrder']:checked");
  return selected.value.split(",");
}

function renderConfig(config) {
  $("#groqModel").value = config.groq.model;
  $("#geminiModel").value = config.gemini.model;
  $("#groqKeys").value = "";
  $("#geminiKeys").value = "";
  $("#groqKeys").placeholder = `${config.groq.keyCount || 0} Groq key tersimpan. Paste full list baru hanya jika ingin mengganti.`;
  $("#geminiKeys").placeholder = `${config.gemini.keyCount || 0} Gemini key tersimpan. Paste full list baru hanya jika ingin mengganti.`;

  const orderValue = config.providerOrder.join(",");
  const radio = document.querySelector(`input[name='providerOrder'][value='${orderValue}']`);
  if (radio) radio.checked = true;

  renderExtensionKeys(config.extensionKeys || []);
}

function renderExtensionKeys(keys) {
  const root = $("#extensionKeys");
  root.innerHTML = "";

  if (!keys.length) {
    root.innerHTML = "<p class='hint'>Belum ada API key ekstensi.</p>";
    return;
  }

  for (const key of keys) {
    const row = document.createElement("div");
    row.className = "key-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(key.label || key.id)}</strong><br>
        <small>${key.id} · ${key.active ? "active" : "disabled"} · dibuat ${key.createdAt || "-"}</small>
      </div>
      <button class="secondary" data-action="toggle" data-id="${key.id}" data-active="${key.active ? "0" : "1"}">${key.active ? "Disable" : "Enable"}</button>
      <button class="danger" data-action="delete" data-id="${key.id}">Delete</button>
    `;
    root.append(row);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

$("#saveAdminTokenBtn")?.addEventListener("click", () => {
  state.adminToken = $("#adminToken").value.trim();
  localStorage.setItem("adminToken", state.adminToken);
  setOutput("Admin token disimpan di browser lokal.");
});

$("#healthBtn")?.addEventListener("click", async () => {
  try {
    const payload = await api("/api/health", { method: "GET", headers: {} });
    setOutput(payload);
  } catch (error) {
    setOutput(error.message);
  }
});

$("#loadConfigBtn").addEventListener("click", async () => {
  try {
    const btn = $("#loadConfigBtn");
    const originalText = btn.textContent;
    btn.textContent = "Loading...";
    btn.disabled = true;

    state.adminToken = $("#adminToken").value.trim();
    localStorage.setItem("adminToken", state.adminToken);
    
    const payload = await api("/api/admin-config", { method: "GET" });
    renderConfig(payload.config);
    
    // Switch UI
    $("#loginScreen").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");
    setOutput({ ok: true, message: "Login berhasil. Dashboard dimuat." });

    btn.textContent = originalText;
    btn.disabled = false;
  } catch (error) {
    setOutput(error.message);
    $("#loadConfigBtn").textContent = "Login & Load Config";
    $("#loadConfigBtn").disabled = false;
  }
});

$("#copyTokenBtn")?.addEventListener("click", () => {
  const token = $("#newToken").textContent;
  if (token) {
    navigator.clipboard.writeText(token).then(() => {
      const btn = $("#copyTokenBtn");
      btn.textContent = "Copied!";
      setTimeout(() => btn.textContent = "Copy", 2000);
    });
  }
});

$("#saveConfigBtn").addEventListener("click", async () => {
  try {
    const payload = await api("/api/admin-config", {
      method: "POST",
      body: JSON.stringify({
        providerOrder: selectedProviderOrder(),
        groq: {
          model: $("#groqModel").value.trim(),
          ...($("#groqKeys").value.trim() ? { keys: $("#groqKeys").value } : {})
        },
        gemini: {
          model: $("#geminiModel").value.trim(),
          ...($("#geminiKeys").value.trim() ? { keys: $("#geminiKeys").value } : {})
        }
      })
    });
    renderConfig(payload.config);
    setOutput(payload);
  } catch (error) {
    setOutput(error.message);
  }
});

$("#createExtensionKeyBtn").addEventListener("click", async () => {
  try {
    const payload = await api("/api/admin-extension-key", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        label: $("#extensionKeyLabel").value.trim()
      })
    });
    $("#newTokenBox").classList.remove("hidden");
    $("#newToken").textContent = payload.token;
    renderExtensionKeys(payload.keys);
    setOutput({ ok: true, message: "API key ekstensi dibuat. Salin token dari kotak kuning." });
  } catch (error) {
    setOutput(error.message);
  }
});

$("#extensionKeys").addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  try {
    const action = button.dataset.action;
    const id = button.dataset.id;
    const body = action === "toggle"
      ? { action: "setActive", id, active: button.dataset.active === "1" }
      : { action: "delete", id };

    const payload = await api("/api/admin-extension-key", {
      method: "POST",
      body: JSON.stringify(body)
    });
    renderExtensionKeys(payload.keys);
    setOutput(payload);
  } catch (error) {
    setOutput(error.message);
  }
});
