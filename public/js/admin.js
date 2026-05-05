const $ = (id) => document.getElementById(id);
const state = {
    token: localStorage.getItem('admin_token') || '',
    config: null,
    activeTab: 'groq'
};

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    $('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function api(path, method = 'GET', body = null) {
    const headers = {
        'x-admin-token': state.token,
        'Content-Type': 'application/json'
    };
    
    try {
        const res = await fetch(path, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Request failed');
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// Initial Load
if (state.token) {
    $('admin-token').value = state.token;
    loadConfig();
}

$('load-config-btn').addEventListener('click', () => {
    state.token = $('admin-token').value.trim();
    localStorage.setItem('admin_token', state.token);
    loadConfig();
});

async function loadConfig() {
    $('status-dot').className = 'dot';
    $('status-text').textContent = 'Loading...';
    
    try {
        const data = await api('/api/admin/config');
        state.config = data.config;
        renderConfig();
        renderKeys();
        
        $('login-section').classList.add('hidden');
        $('admin-content').classList.remove('hidden');
        $('status-dot').className = 'dot success';
        $('status-text').textContent = 'Connected';
    } catch (err) {
        $('status-dot').className = 'dot error';
        $('status-text').textContent = 'Unauthorized';
    }
}

function renderConfig() {
    const c = state.config;
    $('groq-keys').value = c.groq.keys.join('\n');
    $('groq-model').value = c.groq.model;
    $('gemini-keys').value = c.gemini.keys.join('\n');
    $('gemini-model').value = c.gemini.model;
    
    // Render provider order
    const orderList = $('provider-order');
    orderList.innerHTML = '';
    c.providerOrder.forEach(id => {
        const item = document.createElement('div');
        item.className = 'sort-item';
        item.dataset.id = id;
        item.innerHTML = `${id.toUpperCase()} <span>⠿</span>`;
        orderList.appendChild(item);
    });
}

function renderKeys() {
    const list = $('extension-list');
    list.innerHTML = '';
    state.config.extensionKeys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'ext-item fade-in';
        item.innerHTML = `
            <div class="ext-info">
                <h4>${key.label} ${key.email ? `<small style="color:var(--accent-secondary)">(${key.email})</small>` : ''}</h4>
                <p>Created: ${new Date(key.createdAt).toLocaleDateString()}</p>
                <p>Last Used: ${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</p>
            </div>
            <div class="ext-actions">
                <button class="secondary-btn" onclick="toggleKey('${key.id}', ${!key.active})">${key.active ? 'Disable' : 'Enable'}</button>
                <button class="secondary-btn" style="color: var(--error)" onclick="deleteKey('${key.id}')">Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

$('save-provider-btn').addEventListener('click', async () => {
    const body = {
        groq: {
            keys: $('groq-keys').value.split('\n').filter(k => k.trim()),
            model: $('groq-model').value.trim()
        },
        gemini: {
            keys: $('gemini-keys').value.split('\n').filter(k => k.trim()),
            model: $('gemini-model').value.trim()
        },
        providerOrder: Array.from($('provider-order').children).map(el => el.dataset.id)
    };
    
    const data = await api('/api/admin/config', 'POST', body);
    state.config = data.config;
    showToast('Configuration updated successfully');
    renderConfig();
});

$('gen-ext-key-btn').addEventListener('click', async () => {
    const label = $('new-ext-name').value.trim();
    const email = $('new-ext-email').value.trim();
    if (!label) return showToast('Please enter a label', 'error');
    
    const data = await api('/api/admin/extension-key', 'POST', { action: 'create', label, email });
    state.config.extensionKeys = data.keys;
    
    $('new-key-value').textContent = data.token;
    $('new-key-display').classList.remove('hidden');
    $('new-ext-name').value = '';
    $('new-ext-email').value = '';
    renderKeys();
    showToast('New extension key generated');
});

window.toggleKey = async (id, active) => {
    const data = await api('/api/admin/extension-key', 'POST', { action: 'setActive', id, active });
    state.config.extensionKeys = data.keys;
    renderKeys();
    showToast(`Key ${active ? 'enabled' : 'disabled'}`);
};

window.deleteKey = async (id) => {
    if (!confirm('Are you sure you want to delete this key?')) return;
    const data = await api('/api/admin/extension-key', 'POST', { action: 'delete', id });
    state.config.extensionKeys = data.keys;
    renderKeys();
    showToast('Key deleted');
};

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        btn.classList.add('active');
        $(`${btn.dataset.tab}-tab`).classList.remove('hidden');
    });
});
