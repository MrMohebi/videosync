var room = {},
    ws_prom;

browser.runtime.onStartup.addListener(() => {
    browser.browserAction.setBadgeText({text: ""});
    browser.browserAction.setBadgeBackgroundColor({color: "#0078c8"});
    browser.browserAction.setIcon({
        path: {
            16: "img/3d-glasses_inactive_16.png",
            32: "img/3d-glasses_inactive_32.png",
            64: "img/3d-glasses_inactive_64.png"
        }
    });
});

function onMessage(mess) {
    if (!room.mess_log) {
        room.mess_log = [];
    }
    room.mess_log.push(mess);
    if (mess.roomCnt) {
        room.count = mess.roomCnt;
        if (room.port) {
            browser.browserAction.setBadgeText({text: room.count.toString()});
            browser.browserAction.setBadgeBackgroundColor({color: "#0078c8"});
        }
        else {
            browser.browserAction.setBadgeText({text: "!"});
            browser.browserAction.setBadgeBackgroundColor({color: "#d83131"});
        }
    }
    if (mess.peer_message && mess.peer_message.video_info) {
        if (room.port && !room.waiting) {
            room.port.postMessage({video_info: mess.peer_message.video_info, source: "server", latency: (mess.sender_latency + mess.receiver_latency)/1000, username: mess.peer_message.username});
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
            const connect = (path) => {
                ws_prom = new Promise(resolve => {var ws = new WebSocket("ws://" + server + "/" + room.path); ws.onopen = () => resolve(ws);});
                ws_prom.then(() => {
                    browser.browserAction.setIcon({
                        path: {
                            16: "img/3d-glasses_active_16.png",
                            32: "img/3d-glasses_active_32.png",
                            64: "img/3d-glasses_active_64.png"
                        }
                    });
                    room.path = path;
                });
                ws_prom.then(ws => ws.onmessage = (ev) => onMessage(JSON.parse(ev.data)));
            };
            connect(request.join_room.room);
            ws_prom.then(ws => ws.onclose = ws.onerror = () => {
                browser.browserAction.setBadgeText({text: ""});
                browser.browserAction.setBadgeBackgroundColor({color: "#0078c8"});
                browser.browserAction.setIcon({
                    path: {
                        16: "img/3d-glasses_inactive_16.png",
                        32: "img/3d-glasses_inactive_32.png",
                        64: "img/3d-glasses_inactive_64.png"
                    }
                });
                const path = room.path;
                room.path = null;
                if (path) {
                    displayNotification("VideoSync Warning", "Disconnected, trying to reconnect");
                    connect(path);
                }
            });
        }
        if (request.leave_room) {
            if (room.path) {
                room.path = null;
                ws_prom.then(ws => ws.close());
            }
        }
        if (request.share_url) {
            if (room.path) {
                return browser.storage.local.get("username")
                    .then(res => res.username)
                    .then(username => ws_prom
                        .then(ws => ws.send(JSON.stringify({url: request.share_url, username: username})))
                    );
            }
        }
        if (request.notification) {
            displayNotification(request.notification.title, request.notification.message);
        }
        if (request.select_video) {
            ports.forEach(p => p.disconnect());
            ports = [];
            browser.tabs.executeScript(request.select_video.tabid, {allFrames: true, matchAboutBlank: true, file: "browser-polyfill.min.js"})
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
            browser.storage.local.get("username")
                .then(res => res.username)
                .then(username => ws_prom
                    .then(ws => ws.send(JSON.stringify({video_info: mess.video_info, username: username})))
                );
            room.video_info = mess.video_info;
        }
    };
    const awaitVideos = mess => {
        if (mess.iframes != null) {
            room.iframes = [...(room.iframes || []), ...mess.iframes];
            console.log(room.iframes);
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
                browser.browserAction.setBadgeText({text: room.count.toString()});
                browser.browserAction.setBadgeBackgroundColor({color: "#0078c8"});
                port.onDisconnect.addListener(() => {
                    room.port = null;
                    browser.browserAction.setBadgeText({text: "!"});
                    browser.browserAction.setBadgeBackgroundColor({color: "#d83131"});
                });
                port.postMessage({select_video: {id: 0}});
            }
        }
    };
    port.onMessage.addListener(awaitVideos);
});
