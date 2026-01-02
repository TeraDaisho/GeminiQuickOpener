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

    const gemUrl = document.getElementById('gem-select').value;
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

        // Open Gemini Tab
        const newTab = await chrome.tabs.create({ url: gemUrl });

        // Wait for load and inject
        if (contextText.trim() !== "") {
            statusEl.textContent = "Waiting for page load...";

            // We need to wait for the tab to be ready. 
            // We can use onUpdated listener or recursive retry in executeScript.
            // Recursive retry in executeScript is cleaner here as it avoids background script complexity for this simple task.

            chrome.scripting.executeScript({
                target: { tabId: newTab.id },
                func: injectPrompt,
                args: [contextText]
            });
        }

        // Close popup (optional, but good UX if successful)
        // window.close(); 

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

// This function runs INSIDE the Gemini page
async function injectPrompt(textToInject) {
    const MAX_RETRIES = 20; // 20 * 500ms = 10 seconds
    const RETRY_INTERVAL = 500;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function findInput() {
        // Try multiple selectors for Gemini's input box
        // 1. Contenteditable div (most common in modern chat apps)
        // 2. Textarea
        const selectors = [
            'div[contenteditable="true"]',
            'div[role="textbox"]',
            'textarea',
            '.ql-editor' // sometimes used in rich text editors
        ];

        for (const s of selectors) {
            const el = document.querySelector(s);
            if (el) return el;
        }
        return null;
    }

    for (let i = 0; i < MAX_RETRIES; i++) {
        const inputEl = findInput();
        if (inputEl) {
            // Focus and Input
            inputEl.focus();

            // For contenteditable, we often need to simulate text input event or modify innerHTML
            // Simpler approach: execCommand (deprecated but often works) or dispatch events

            // Try modifying textContent/innerHTML first for contenteditable
            if (inputEl.isContentEditable) {
                // Append text. Note: Gemini might verify user interaction. 
                // Best way is document.execCommand('insertText') if supported, as it triggers events.
                document.execCommand('insertText', false, textToInject);
            } else {
                inputEl.value += textToInject;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Try to scroll to bottom - optional
            return;
        }
        await sleep(RETRY_INTERVAL);
    }

    console.error("Gemini Quick Opener: Could not find input box.");
}
