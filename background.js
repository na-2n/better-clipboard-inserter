const activeTabs = {};
let activeTimer = null;
let previousText = null;

// TODO settings page
const settings = {
    timerInterval: 300,
    reloadPersist: true,
    fetchHttp: false,
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
        const textPromise = settings.fetchHttp
            ? fetch(settings.url, { mode: "no-cors" })
                .then(res => {
                    if (!res.ok) {
                        return Promise.reject(new Error(`error querying ${settings.url}`));
                    }

                    return res.text();
                })
            : navigator.clipboard.readText();

        textPromise
            .then(content => {
                if (content === null || content.length === 0 || content === previousText) return;
                previousText = content;

                Object.keys(activeTabs).map(x => parseInt(x)).forEach(id => browser.tabs.sendMessage(id, {
                    action: "insert", content
                }));
            })
            //TODO show error to user
            .catch(console.error);
    }, parseInt(settings.timerInterval));
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

function deactivate(tabId, dead = false, completelyDead = false) {
    delete activeTabs[tabId];

    if (!completelyDead) {
        browser.browserAction.setBadgeText({ tabId, text: "" });
    }
    if (!dead) {
        browser.tabs.sendMessage(tabId, { action: "eject" });
    }

    if (Object.keys(activeTabs).length === 0 && activeTimer !== null) {
        clearInterval(activeTimer);
        activeTimer = null;
    }
}

const confKeys = ["timerInterval", "reloadPersist", "fetchHttp", "url"]
function updateSettings(data) {
    confKeys
        .filter(k => data.hasOwnProperty(k))
        .forEach(k => settings[k] = data[k]);
}


browser.storage.local.get(confKeys).then(updateSettings);
browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        confKeys
            .filter(k => changes.hasOwnProperty(k))
            .forEach(k => settings[k] = changes[k].newValue);
    }
});

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

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
    if (activeTabs.hasOwnProperty(tabId)) {
        deactivate(tabId, true, true);
    }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // deactivate when we change url
    if (changeInfo.url) {
        if (activeTabs.hasOwnProperty(tabId)) {
            if (!settings.reloadPersist || activeTabs[tabId] !== changeInfo.url) {
                deactivate(tabId, true);
            } else {
                activate(tabId, changeInfo.url);
            }
        }
    }
});

