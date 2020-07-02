var room = {},
    ws_prom = new Promise(resolve => resolve(null));

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
    if (!room.mess_log) {
        room.mess_log = [];
    }
    room.mess_log.push(mess);
    if (mess.usernames) {
        room.usernames = mess.usernames;
        updateBadge();
    }
    if (mess.peer_message && mess.peer_message.video_info) {
        if (room.port && !room.waiting) {
            room.port.postMessage({video_info: mess.peer_message.video_info, source: "server", latency: (mess.sender_latency + mess.receiver_latency)/1000, username: mess.sender_username});
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
        if (request.join_room && !room.path) {
            const server = request.join_room.server;
            browser.storage.local.set({username: request.join_room.username});
            const connect = (path, onclose) => {
                ws_prom = new Promise(resolve => {var ws = new WebSocket("ws://" + server + "/" + path); ws.onopen = () => resolve(ws);});
                return Promise.all([
                    browser.storage.local.set({last_room: path}),
                    ws_prom.then(ws => {
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
            ports.forEach(p => p.disconnect());
            ports = [];
            return browser.tabs.executeScript(request.select_video.tabid, {allFrames: true, matchAboutBlank: true, file: "browser-polyfill.min.js"})
                .then(() => browser.tabs.executeScript(request.select_video.tabid, {allFrames: true, matchAboutBlank: true, file: "select_video.js"}));
        }
    }
);

var ports = [];

browser.runtime.onConnect.addListener(port => {
    if (!room.tabId || room.tabId != port.sender.tab.id) {
        ports.forEach(p => p.disconnect());
        ports = [];
        room.iframes = [];
        room.tabId = port.sender.tab.id;
    }
    ports.push(port);

    const listenInfo = mess => {
        if (mess.video_info && mess.source == "local") {
            room.waiting = true;
            ws_prom.then(ws => ws.send(JSON.stringify({video_info: mess.video_info})));
            room.video_info = mess.video_info;
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
