const DEFAULTS = {
    timerInterval: 300,
    reloadPersist: true,
    fetchHttp: false,
    url: "http://localhost:2653",
};

const confKeys = ["timerInterval", "reloadPersist", "fetchHttp", "url"];

function inputValProp(el) {
    return el.type === "checkbox" ? "checked" : "value";
}

document.addEventListener("DOMContentLoaded", () => {
    browser.storage.local.get(confKeys)
        .then(data => confKeys.reduce((o, k) => ({
            ...o,
            [k]: data.hasOwnProperty(k) && data[k] !== undefined ? data[k] : DEFAULTS[k]
        }), {}))
        .then(data => Object.keys(data)
            .map(k => [k, document.getElementById(k)])
            .forEach(([k, el]) => el[inputValProp(el)] = data[k])
        )
        .catch(err => console.error(`Failed to load options: ${err}`));
});


const optForm = document.getElementById("option-form");
if (optForm) {
    // not working for some reason
    //optForm.addEventListener("submit", ev => {
    optForm.querySelector('button[type="submit"]').addEventListener("click", ev => {
        const data = confKeys
            .map(k => [k, document.getElementById(k)])
            .reduce((o, [k, el]) => ({
                ...o, [k]: el[inputValProp(el)] !== undefined ? el[inputValProp(el)] : DEFAULTS[k]
            }), {});

        browser.storage.local.set(data)
            .catch(err => console.error(`Failed to save options: ${err}`));

        ev.preventDefault();
    });
}
