// options.js

// Default Gem if none exists
const DEFAULT_GEMS = [
    { name: 'Gemini (Default)', url: 'https://gemini.google.com/app' }
];

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('add-gem-form').addEventListener('submit', saveGem);

function restoreOptions() {
    chrome.storage.sync.get({ gems: DEFAULT_GEMS }, (items) => {
        const gemsList = document.getElementById('gems-list');
        gemsList.innerHTML = '';

        if (items.gems.length === 0) {
            gemsList.innerHTML = '<p>No gems saved.</p>';
            return;
        }

        items.gems.forEach((gem, index) => {
            const div = document.createElement('div');
            div.className = 'gem-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'gem-info';

            const nameSpan = document.createElement('div');
            nameSpan.className = 'gem-name';
            nameSpan.textContent = gem.name;

            const urlSpan = document.createElement('div');
            urlSpan.className = 'gem-url';
            urlSpan.textContent = gem.url;

            infoDiv.appendChild(nameSpan);
            infoDiv.appendChild(urlSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => deleteGem(index);

            div.appendChild(infoDiv);
            div.appendChild(deleteBtn);
            gemsList.appendChild(div);
        });
    });
}

function saveGem(e) {
    e.preventDefault();
    const name = document.getElementById('gem-name').value;
    const url = document.getElementById('gem-url').value;

    if (!url.startsWith('https://gemini.google.com')) {
        alert('URL must start with https://gemini.google.com');
        return;
    }

    chrome.storage.sync.get({ gems: DEFAULT_GEMS }, (items) => {
        const gems = items.gems;
        gems.push({ name, url });

        chrome.storage.sync.set({ gems: gems }, () => {
            // Reset form
            document.getElementById('gem-name').value = '';
            document.getElementById('gem-url').value = '';
            restoreOptions();
        });
    });
}

function deleteGem(index) {
    if (!confirm('Are you sure you want to delete this Gem?')) return;

    chrome.storage.sync.get({ gems: DEFAULT_GEMS }, (items) => {
        const gems = items.gems;
        gems.splice(index, 1);

        chrome.storage.sync.set({ gems: gems }, () => {
            restoreOptions();
        });
    });
}
