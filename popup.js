// popup.js

const DEFAULT_GEMS = [
    { name: 'Gemini (Default)', url: 'https://gemini.google.com/app' }
];

document.addEventListener('DOMContentLoaded', async () => {
    await loadGems();
    setupEventListeners();
});

function setupEventListeners() {
    // Main View Actions
    document.getElementById('open-btn').addEventListener('click', handleOpen);
    document.getElementById('go-settings-btn').addEventListener('click', () => switchView('settings'));

    // Settings View Actions
    document.getElementById('back-btn').addEventListener('click', () => switchView('main'));
    document.getElementById('add-gem-btn').addEventListener('click', addNewGem);
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view - ${viewName} `).classList.add('active');

    if (viewName === 'main') {
        // Reload dropdown when returning to main to reflect changes
        loadGems();
    } else if (viewName === 'settings') {
        renderSettingsList();
    }
}

async function loadGems() {
    const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
    const select = document.getElementById('gem-select');
    select.innerHTML = '';

    if (data.gems.length === 0) {
        const option = document.createElement('option');
        option.text = "No Gems Configured";
        select.add(option);
        document.getElementById('open-btn').disabled = true;
    } else {
        data.gems.forEach(gem => {
            const option = document.createElement('option');
            option.text = gem.name;
            option.value = gem.url;
            select.add(option);
        });
        document.getElementById('open-btn').disabled = false;
    }
}

async function renderSettingsList() {
    const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
    const listEl = document.getElementById('settings-gem-list');
    listEl.innerHTML = '';

    data.gems.forEach((gem, index) => {
        const item = document.createElement('div');
        item.className = 'gem-item';

        item.innerHTML = `
    < div class="gem-info" >
        <div class="gem-name">${gem.name}</div>
        <div class="gem-url">${gem.url}</div>
      </div >
    <button class="delete-btn" data-index="${index}">Delete</button>
`;

        listEl.appendChild(item);
    });

    // Add click listeners for delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const index = e.target.getAttribute('data-index');
            await deleteGem(index);
        });
    });
}

async function addNewGem() {
    const nameInput = document.getElementById('new-gem-name');
    const urlInput = document.getElementById('new-gem-url');

    const name = nameInput.value.trim();
    let urlStr = urlInput.value.trim();

    if (!name || !urlStr) {
        alert('Please enter both name and URL.');
        return;
    }

    // Strict URL Validation
    try {
        const urlObj = new URL(urlStr);
        if (urlObj.hostname !== 'gemini.google.com') {
            alert('URL must be for gemini.google.com');
            return;
        }
        // Update urlStr to the normalized href (removes some edge case formatting issues)
        urlStr = urlObj.href;
    } catch (e) {
        alert('Invalid URL format.');
        return;
    }

    const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
    const gems = data.gems;
    gems.push({ name, url: urlStr });

    await chrome.storage.sync.set({ gems });

    nameInput.value = '';
    urlInput.value = '';
    renderSettingsList();
}

async function deleteGem(index) {
    if (!confirm('Delete this Gem?')) return;

    const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
    const gems = data.gems;
    gems.splice(index, 1);

    await chrome.storage.sync.set({ gems });
    renderSettingsList();
}


async function handleOpen() {
    const statusEl = document.getElementById('status');
    statusEl.textContent = "Gathering context...";

    const gemUrlInput = document.getElementById('gem-select').value;
    const includeUrl = document.getElementById('include-url').checked;
    const includeSelection = document.getElementById('include-selection').checked;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        let contextText = "";

        if (includeUrl && tab?.url) {
            contextText += `引用元URL: ${tab.url} \n\n`;
        }

        if (includeSelection && tab?.id) {
            const selection = await getTabSelection(tab.id);
            if (selection) {
                contextText += `引用テキスト: \n${selection} \n\n`;
            }
        }

        statusEl.textContent = "Opening Gemini...";

        // Construct Target URL with Deep Link
        const targetUrl = constructGeminiUrl(gemUrlInput, contextText);

        // Open Gemini Tab
        await chrome.tabs.create({ url: targetUrl });

        // Close popup
        window.close();

    } catch (err) {
        statusEl.textContent = "Error: " + err.message;
        console.error(err);
    }
}

function getTabSelection(tabId) {
    return chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.getSelection().toString()
    }).then(results => {
        if (results && results[0]) {
            return results[0].result;
        }
        return "";
    }).catch(err => {
        console.warn("Could not get selection", err);
        return "";
    });
}

