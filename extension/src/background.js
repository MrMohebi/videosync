var room = {},
    ws_prom = new Promise(resolve => resolve(null));

const server_version = "0.0.2";

function updateBadge() {
    ws_prom.then(ws => {
        if (ws != null && ws.readyState == WebSocket.OPEN) {
            browser.browserAction.setIcon({
                path: {
                    16: "img/3d-glasses_active_16.png",
                    32: "img/3d-glasses_active_32.png",
                    64: "img/3d-glasses_active_64.png"
                }
            });
            if (room.port) {
                browser.browserAction.setBadgeText({text: room.usernames.length.toString()});
                browser.browserAction.setBadgeBackgroundColor({color: "#0078c8"});
            }
            else {
                browser.browserAction.setBadgeText({text: "!"});
                browser.browserAction.setBadgeBackgroundColor({color: "#d83131"});
            }
        }
        else {
            browser.browserAction.setIcon({
                path: {
                    16: "img/3d-glasses_inactive_16.png",
                    32: "img/3d-glasses_inactive_32.png",
                    64: "img/3d-glasses_inactive_64.png"
                }
            });
            browser.browserAction.setBadgeText({text: ""});
        }
    });
}

browser.runtime.onStartup.addListener(updateBadge);

function onMessage(mess) {
    if (mess.usernames) {
        room.usernames = mess.usernames;
        updateBadge();
    }
    if (mess.peer_message && mess.peer_message.video_info) {
        if (room.port && !room.waiting) {
            room.port.postMessage({video_info: mess.peer_message.video_info, source: "server", latency: room.use_latency?(mess.sender_latency + mess.receiver_latency)/1000:0, username: mess.sender_username});
        }
    }
    if (mess.ok) {
        room.waiting = false;
    }
    if (mess.peer_message && mess.peer_message.url) {
        displayNotification("VideoSync", (mess.peer_message.username || "Anonymous") + " sent URL");
        browser.tabs.create({url: mess.peer_message.url});
    }
}

browser.storage.local.get("server").then(res => {
    if (!res.server) {
        browser.storage.local.set({server: "tame-occipital-sing.glitch.me"});
    }
});

browser.storage.local.get("last_room").then(res => {
    if (!res.last_room) {
        browser.storage.local.set({last_room: ""});
    }
});

function displayNotification(title, message) {
    if (room.port) {
        room.port.postMessage({notification: {title: title, message: message}});
    }
    else if (browser.notifications) {
        return browser.notifications.create("videosync", {
            type: "basic",
            iconUrl: browser.runtime.getURL("img/3d-glasses_active_64.png"),
            title: title,
            message: message
        });
    }
}

browser.runtime.onMessage.addListener(
    function(request) {
        if (request.get_file) {
            return fetch(request.get_file).then(response => response.text());
        }
        if (request.get_room) {
            return new Promise(resolve => {
                var ret_room = {};
                request.get_room.properties.forEach(prop => ret_room[prop] = room[prop]);
                resolve(ret_room);
            });
        }
        if (request.set_room) {
            Object.entries(request.set_room.properties).forEach(([prop, val]) => {
                room[prop] = val;
            });
        }
        if (request.join_room && !room.path) {
            const server = request.join_room.server;
            room.use_latency = request.join_room.use_latency;
            browser.storage.local.set({username: request.join_room.username});
            const connect = (path, onclose) => {
                return Promise.all([
                    browser.storage.local.set({last_room: path}),
                    ws_prom.then(ws => ws, () => null).then(ws => {
                        if (ws) {
                            ws.close();
                        }
                        ws_prom = new Promise((resolve, reject) => {var ws = new WebSocket("ws://" + server + "/" + server_version + "/" + path); ws.onclose = () => reject("Connection failed"); ws.onopen = () => resolve(ws);});
                        return ws_prom;
                    }).then(ws => {
                        updateBadge();
                        room.path = path;
                        ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
                        ws.onclose = onclose;
                        ws.send(JSON.stringify({username: request.join_room.username, status: {ready: room.port != null}}));
                    })
                ]);
            };
            const onclose = () => {
                updateBadge();
                const path = room.path;
                room.path = null;
                if (path) {
                    displayNotification("VideoSync Warning", "Disconnected, trying to reconnect");
                    connect(path, onclose);
                }
            };
            return connect(request.join_room.room, onclose);
        }
        if (request.leave_room) {
            if (room.path) {
                room.path = null;
                return ws_prom.then(ws => ws.close());
            }
        }
        if (request.share_url) {
            if (room.path) {
                return ws_prom.then(ws => ws.send(JSON.stringify({url: request.share_url})));
            }
        }
        if (request.notification) {
            displayNotification(request.notification.title, request.notification.message);
        }
        if (request.select_video) {
            if (room.port) {
                room.port = null;
                ws_prom.then(ws => ws.send(JSON.stringify({status: {ready: false}})));
                updateBadge();
            }
            ports.forEach(p => p.disconnect());
            ports = [];
            room.iframes = [];
            return browser.tabs.executeScript(request.select_video.tabid, {allFrames: true, matchAboutBlank: true, file: "browser-polyfill.min.js"})
                .then(() => browser.tabs.executeScript(request.select_video.tabid, {allFrames: true, matchAboutBlank: true, file: "select_video.js"}));
        }
    }
);

var ports = [],
    last_mess;

browser.runtime.onConnect.addListener(port => {
    if (!room.tabId || room.tabId != port.sender.tab.id) {
        if (room.port) {
            room.port = null;
            ws_prom.then(ws => ws.send(JSON.stringify({status: {ready: false}})));
            updateBadge();
        }
        ports.forEach(p => p.disconnect());
        ports = [];
        room.iframes = [];
        room.tabId = port.sender.tab.id;
    }
    ports.push(port);

    const listenInfo = mess => {
        if (mess.video_info && mess.source == "local") {
            const ts = Date.now();
            if (last_mess && ts - last_mess.ts < 1000 && last_mess.video_info.paused == mess.video_info.paused && last_mess.video_info.playbackRate == mess.video_info.playbackRate && Math.abs(last_mess.video_info.currentTime - mess.video_info.currentTime) < 0.00001) {
                console.log("Ignoring repeated message");
            }
            else {
                room.waiting = true;
                last_mess = {ts: ts, video_info: mess.video_info};
                ws_prom.then(ws => ws.send(JSON.stringify({video_info: mess.video_info})));
                room.video_info = mess.video_info;
            }
        }
    };
    const awaitVideos = mess => {
        if (mess.iframes != null) {
            room.iframes = [...(room.iframes || []), ...mess.iframes];
        }
        if (mess.videos != null) {
            port.videos = mess.videos;
            if (port.videos == 0) {
                port.disconnect();
            }
            else {
                port.onMessage.addListener(listenInfo);
                port.onMessage.removeListener(awaitVideos);
                room.port = port;
                room.iframes = [];
                ws_prom.then(ws => ws.send(JSON.stringify({status: {ready: true}})));
                updateBadge();
                port.onDisconnect.addListener(() => {
                    room.port = null;
                    ws_prom.then(ws => ws.send(JSON.stringify({status: {ready: false}})));
                    updateBadge();
                });
                port.postMessage({select_video: {id: 0}});
            }
        }
    };
    port.onMessage.addListener(awaitVideos);
});
