// Create Context Menu items on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "add-to-daily-tasks",
        title: "Add to Daily Tasks",
        contexts: ["selection", "link", "page"]
    });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "add-to-daily-tasks") {
        const data = {
            title: tab.title,
            url: info.linkUrl || tab.url,
            selection: info.selectionText || ""
        };

        // Send message to content script to show the modal
        chrome.tabs.sendMessage(tab.id, {
            action: "open-clipper-modal",
            data: data
        }).catch(err => {
            // In case content script is not injected (e.g. extension just installed)
            console.error("Content script not ready:", err);
            // Fallback: inject it manually? No, manifest matches <all_urls>
        });
    }
});
