// background.js

const DEFAULT_GEMS = [
    { name: 'Gemini (Default)', url: 'https://gemini.google.com/app' }
];

// Initialize Context Menu
chrome.runtime.onInstalled.addListener(() => {
    rebuildContextMenu();
});

// Rebuild menu on startup to ensure it's in sync
chrome.runtime.onStartup.addListener(() => {
    rebuildContextMenu();
});

// Update Menu when Storage Changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.gems) {
        rebuildContextMenu();
    }
});

// Handle Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId.startsWith("gem_")) {
        const index = parseInt(info.menuItemId.split("_")[1], 10);
        await openGemByIndex(index, tab);
    }
});

// Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "open-default-gem") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // Open the first Gem (Index 0)
            await openGemByIndex(0, tab);
        }
    }
});

// Function to Rebuild Context Menu
async function rebuildContextMenu() {
    // Clear existing to avoid duplicates
    chrome.contextMenus.removeAll(async () => {
        const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
        const gems = data.gems.length > 0 ? data.gems : DEFAULT_GEMS;

        // Create Parent Item
        chrome.contextMenus.create({
            id: "parent_menu",
            title: "Gemini Quick Opener",
            contexts: ["all"]
        });

        // Create Submenus for each Gem
        gems.forEach((gem, index) => {
            chrome.contextMenus.create({
                id: `gem_${index}`,
                parentId: "parent_menu",
                title: gem.name,
                contexts: ["all"]
            });
        });
    });
}

// Function to Open Gem by Index
async function openGemByIndex(index, tab) {
    try {
        const data = await chrome.storage.sync.get({ gems: DEFAULT_GEMS });
        const gems = data.gems.length > 0 ? data.gems : DEFAULT_GEMS;

        const gem = gems[index];
        if (!gem) return; // Should not happen

        const gemUrl = gem.url;

        // Build Context
        let contextText = "";

        // Add URL
        if (tab.url) {
            contextText += `引用元URL: ${tab.url}\n\n`;
        }

        // Add Selection
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

        // Construct URL and Open
        const targetUrl = constructGeminiUrl(gemUrl, contextText);
        await chrome.tabs.create({ url: targetUrl });

    } catch (err) {
        console.error("Error opening Gemini:", err);
    }
}

// Helper: Construct Deep Link URL
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
