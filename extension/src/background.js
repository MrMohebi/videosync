var room = {},
    ws_prom;

function onMessage(mess) {
    console.log("Got message", mess);
    if (!room.mess_log) {
        room.mess_log = [];
    }
    room.mess_log.push(mess);
    if (mess.roomCnt) {
        room.count = mess.roomCnt;
        browser.browserAction.setBadgeText({text: room.count.toString()});
    }
    if (mess.peer_message && mess.peer_message.video_info) {
        if (room.port && !room.waiting) {
            room.port.postMessage({video_info: mess.peer_message.video_info, source: "server", latency: (mess.sender_latency + mess.receiver_latency)/1000});
        }
    }
    if (mess.ok) {
        console.log("Stop waiting");
        room.waiting = false;
    }
    if (mess.peer_message && mess.peer_message.url) {
        browser.tabs.create({url: mess.peer_message.url});
    }
}

browser.storage.local.get("server").then(res => {
    if (!res.server) {
        browser.storage.local.set({server: "tame-occipital-sing.glitch.me"});
    }
});

browser.runtime.onMessage.addListener(
    function(request) {
        console.log("REQUEST", request);
        if (request.get_file) {
            return fetch(request.get_file).then(response => response.text());
        }
        if (request.get_room) {
            return new Promise(resolve => {
                var ret_room = {};
                request.get_room.properties.forEach(prop => ret_room[prop] = room[prop]);
                console.log("Returning", ret_room);
                resolve(ret_room);
            });
        }
        if (request.join_room) {
            if (room.path) {
                room = {};
                ws_prom.then(ws => ws.close());
            }
            else {
                browser.browserAction.setIcon({
                    path: {
                        16: "img/3d-glasses_active_16.png",
                        32: "img/3d-glasses_active_32.png",
                        64: "img/3d-glasses_active_64.png"
                    }
                });
            }
            room.path = request.join_room.room;
            const server = request.join_room.server;
            ws_prom = new Promise(resolve => {var ws = new WebSocket("ws://" + server + "/" + room.path); ws.onopen = () => resolve(ws);});
            ws_prom.then(ws => ws.onmessage = (ev) => onMessage(JSON.parse(ev.data)));
            console.log("Joined room", room.path);
        }
        if (request.leave_room) {
            if (room.path) {
                ws_prom.then(ws => ws.close());
            }
            console.log("Leaving room", room);
            room = {};
            browser.browserAction.setBadgeText({text: ""});
            browser.browserAction.setIcon({
                path: {
                    16: "img/3d-glasses_inactive_16.png",
                    32: "img/3d-glasses_inactive_32.png",
                    64: "img/3d-glasses_inactive_64.png"
                }
            });
        }
        if (request.share_url) {
            if (room.path) {
                return ws_prom.then(ws => ws.send(JSON.stringify({url: request.share_url})));
            }
        }
        if (request.notification && browser.notifications) {
            return browser.notifications.create({
                type: "basic",
                iconUrl: browser.runtime.getURL("img/3d-glasses_active_64.png"),
                title: request.notification.title,
                message: request.notification.message
            });
        }
    }
);

browser.runtime.onConnect.addListener(port => {
    room.port = port;
    port.onMessage.addListener(mess => {
        if (mess.video_info && mess.source == "local") {
            room.waiting = true;
            console.log("Waiting for message...");
            ws_prom.then(ws => ws.send(JSON.stringify({video_info: mess.video_info})));
            room.video_info = mess.video_info;
        }
    });
});
