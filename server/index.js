const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });
const flags = process.argv.slice(2).reduce((dict, cur) => {
    const spl = cur.split("=");
    if (spl.length == 1) {
        dict[spl[0]] = true;
    }
    else {
        dict[spl[0]] = spl[1];
    }
    return dict;
}, {});
wss.shouldHandle = req => req.url.startsWith("/" + require('./package.json').version + "/");

function log() {
    if (flags["--log"]) {
        console.log.apply(console, arguments);
    }
}

wss.on("connection", function (ws, req) {
    if (flags["--emulate-latency"]) {
        (function(mean_latency) {
            var oldEmit = ws.emit;
            ws.emit = function() {
                var args = Array.from(arguments);
                setTimeout(() => {
                    oldEmit.apply(this, args);
                }, mean_latency + (Math.random() + Math.random() + Math.random() + Math.random() + Math.random() + Math.random())/6);
            };
        })(Math.random()*2000);
    }

    ws.url = req.url;
    const sendUsernames = () => [...wss.clients]
        .filter(client => req.url == client.url && client.readyState === WebSocket.OPEN)
        .forEach((client, _, arr) => {
            client.send(JSON.stringify({usernames: arr.map(c => ({username: c.username, status: c.status}))}));
        });

    ws.on("pong", () => {ws.isAlive = true; ws.latency = (Date.now() - ws.lastPing)/2;});

    ws.on("message", message => {
        message = JSON.parse(message);
        log(ws.username, message);
        if (message.status) {
            if (message.username) {
                ws.username = message.username;
            }
            ws.status = message.status;
            sendUsernames();
            return;
        }
        wss.clients.forEach(client => {
            if (req.url == client.url && client.readyState === WebSocket.OPEN) {
                if (client === ws) {
                    client.send(JSON.stringify({ok: message}));
                }
                else {
                    client.send(JSON.stringify({peer_message: message, sender_latency: ws.latency, receiver_latency: client.latency, sender_username: ws.username}));
                }
            }
        });
    });

    ws.on("close", () => {sendUsernames();});
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.lastPing = Date.now();
    ws.ping(() => 0);
  });
}, 5000);

wss.on("close", function close() {
  clearInterval(interval);
});
