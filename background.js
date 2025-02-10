const activeTabs = {};
let activeTimer = null;
let previousText = null;

// TODO settings page
const settings = {
    timerInterval: 300,
    url: "http://localhost:2653",
};

function contentScript() {
    browser.runtime.onMessage.addListener(function onMessage(req) {
        switch (req.action) {
            case "eject":
                browser.runtime.onMessage.removeListener(onMessage);
                break;

            case "insert":
                const el = document.createElement("p");
                el.classList.add("clipboard-inserted");
                el.textContent = req.content;

                document.body.appendChild(el);
                break;
        }
    });
}

function activateTimer() {
    activeTimer = setInterval(() => {
        fetch(settings.url, { mode: "no-cors" })
            .then(res => {
                if (!res.ok) {
                    return Promise.reject(new Error(`error querying ${settings.url}`));
                }

                return res.text();
            })
            .then(content => {
                if (content === null || content.length === 0 || content === previousText) return;
                previousText = content;

                Object.keys(activeTabs).map(x => parseInt(x)).forEach(id => browser.tabs.sendMessage(id, {
                    action: "insert", content
                }));
            })
            //TODO show error to user
            .catch(console.error);
    }, settings.timerInterval);
}

function activate(tabId, url) {
    browser.scripting.executeScript({ target: { tabId }, func: contentScript });

    activeTabs[tabId] = url;

    browser.browserAction.setBadgeBackgroundColor({ tabId, color: "green" });
    browser.browserAction.setBadgeText({ tabId, text: "ON" });

    if (activeTimer === null) {
        activateTimer();
    }
}

function deactivate(tabId, dead = false) {
    delete activeTabs[tabId];

    browser.browserAction.setBadgeText({ tabId, text: "" });
    if (!dead) {
        browser.tabs.sendMessage(tabId, { action: "eject" });
    }

    if (Object.keys(activeTabs).length === 0 && activeTimer !== null) {
        clearInterval(activeTimer);
        activeTimer = null;
    }
}

browser.browserAction.onClicked.addListener(() => {
    browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
            const cur = tabs[0];

            if (!activeTabs.hasOwnProperty(cur.id)) {
                activate(cur.id, cur.url);
            } else {
                deactivate(cur.id)
            }
        });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // deactivate when we change url
    if (changeInfo.url) {
        if (activeTabs.hasOwnProperty(tabId)) {
            if (activeTabs[tabId] !== changeInfo.url) {
                deactivate(tabId, true);
            } else {
                activate(tabId, changeInfo.url);
            }
        }
    }
});

