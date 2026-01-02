// popup.js

const DEFAULT_GEMS = [
    { name: 'Gemini (Default)', url: 'https://gemini.google.com/app' }
];

document.addEventListener('DOMContentLoaded', async () => {
    // Load Gems
    const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
    const select = document.getElementById('gem-select');

    if (data.gems.length === 0) {
        // Should not happen due to default, but safe fallback
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
    }

    // Check storage for last used Gem index (optional - implement later if needed)

    // Trigger Open
    document.getElementById('open-btn').addEventListener('click', handleOpen);
});

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
            contextText += `引用元URL: ${tab.url}\n\n`;
        }

        if (includeSelection && tab?.id) {
            const selection = await getTabSelection(tab.id);
            if (selection) {
                contextText += `引用テキスト:\n${selection}\n\n`;
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

function constructGeminiUrl(originalUrl, promptText) {
    const baseUrl = "https://gemini.google.com";
    let finalUrl = baseUrl;

    // Check if it's a specific Gem
    // Patterns: 
    // 1. https://gemini.google.com/app/gems/items/[ID] (Standard Web URL)
    // 2. https://gemini.google.com/gem/[ID] (Deep Link format)
    // We want to normalize to /gem/[ID] for the deep link to work best with prompts?
    // Actually, the article says: https://gemini.google.com/gem/[ID]?prompt_text=...

    const gemIdMatch = originalUrl.match(/\/gems\/items\/([^/?]+)/) || originalUrl.match(/\/gem\/([^/?]+)/);

    if (gemIdMatch) {
        const gemId = gemIdMatch[1];
        finalUrl = `${baseUrl}/gem/${gemId}`;
    } else {
        // Default /app or just base
        finalUrl = baseUrl; // defaults to standard chat
    }

    if (promptText) {
        const encodedPrompt = encodeURIComponent(promptText);
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${separator}prompt_text=${encodedPrompt}`;
    }

    return finalUrl;
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

