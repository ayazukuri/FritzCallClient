process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const WebSocket = require("ws");
const cfg = require("./cfg/cfg.json");

let win;
let login;
let wes;

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function log(text, window) {
    if (!cfg.console) return;
    const date = new Date().toString();
    const time = date.split(" ").slice(4, 5).join(" ");
    const day = date.split(" ").slice(1, 3).join(" ");
    window.webContents.send("log", `[${day} ${time}] ${text}`);
}

function showLogin(text) {
    login = new BrowserWindow({ width: 300, height: 280, webPreferences: { nodeIntegration: true }, show: false, resizable: false, icon: "./src/anchor.png" });
    login.loadFile("./html/login.html");
    login.setMenu(null);
    login.once("ready-to-show", login.show);
    login.on("close", () => {
        if (wes) wes.close();
        app.quit();
    });
    login.on("closed", () => login = null);
    if (text) log(text, login);
}

function showMain() {
    win = new BrowserWindow({ width: 1000, height: 500, webPreferences: { nodeIntegration: true }, show: false, resizable: false, icon: "./src/anchor.png" })
    win.loadFile("./index.html");
    win.setMenu(null);
    win.once("ready-to-show", win.show);
    win.on("close", () => {
        if (wes) wes.close();
        app.quit();
    });
    win.on("closed", () => win = null);
}

app.on("ready", showMain);

app.on("window-all-closed", () => { });

ipcMain.on("connect", showLogin);

ipcMain.on("disconnect", () => {
    if (wes) wes.close();
})

ipcMain.on("login", async (event, username, password) => {
    login.destroy();
    wes = new WebSocket(`https://${cfg.hostname}:${cfg.port}/`, { headers: { username, password } });
    win.webContents.send("wsopened");
    wes.on("message", message => {
        const data = JSON.parse(message);
        log(`[PACKET RECEIVED] ${data.type || data.statusCode}`, win);
        if (data.type === "call") win.webContents.send("call", data.data);
        if (data.type === "callEnd") win.webContents.send("callEnd");
    });
    wes.on("close", () => {
        win.webContents.send("wsclosed");
        wes = undefined;
    });
});

process.on("error", error => {
    log(error, win);
    fs.writeFile(`./errors/${new Date().getTime()}.txt`, error, err => {
        if (err) log("Error while writing error log");
    });
});

