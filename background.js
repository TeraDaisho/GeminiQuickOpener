// background.js

const DEFAULT_GEMS = [
    { name: 'Gemini (Default)', url: 'https://gemini.google.com/app' }
];

// Context Menu Setup
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "open-gemini-context",
        title: "Open with Gemini",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open-gemini-context") {
        openGeminiWithContext(tab);
    }
});

// Keyboard Shortcut Setup
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "open-default-gem") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            openGeminiWithContext(tab);
        }
    }
});

async function openGeminiWithContext(tab) {
    try {
        // 1. Get Settings to find Default Gem (First one)
        const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
        const defaultGem = data.gems.length > 0 ? data.gems[0] : DEFAULT_GEMS[0];
        const gemUrl = defaultGem.url;

        // 2. Build Context
        let contextText = "";

        // Add URL
        if (tab.url) {
            contextText += `引用元URL: ${tab.url}\n\n`;
        }

        // Add Selection
        // Only try to get selection if executeScript is allowed (http/https)
        if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
            try {
                const selection = await getTabSelection(tab.id);
                if (selection) {
                    contextText += `引用テキスト:\n${selection}\n\n`;
                }
            } catch (err) {
                console.warn("Could not get selection:", err);
            }
        }

        // 3. Construct URL and Open
        const targetUrl = constructGeminiUrl(gemUrl, contextText);
        await chrome.tabs.create({ url: targetUrl });

    } catch (err) {
        console.error("Error opening Gemini:", err);
    }
}

// Helper: Construct Deep Link URL (Copied from popup.js)
function constructGeminiUrl(originalUrl, promptText) {
    const baseUrl = "https://gemini.google.com";
    let finalUrl = baseUrl;

    let cleanUrl = (originalUrl || "").trim();

    const gemIdMatch = cleanUrl.match(/\/gems\/items\/([^/?\s]+)/) || cleanUrl.match(/\/gem\/([^/?\s]+)/);

    if (gemIdMatch) {
        const gemId = gemIdMatch[1];
        finalUrl = `${baseUrl}/gem/${gemId}`;
    } else {
        finalUrl = baseUrl;
    }

    if (promptText) {
        const encodedPrompt = encodeURIComponent(promptText);
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${separator}prompt_text=${encodedPrompt}`;
    }

    return finalUrl;
}

// Helper: Get Selection using Scripting API
async function getTabSelection(tabId) {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.getSelection().toString()
    });

    if (results && results[0] && results[0].result) {
        return results[0].result;
    }
    return "";
}
