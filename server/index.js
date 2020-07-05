const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.shouldHandle = req => req.url.startsWith("/" + require('./package.json').version + "/");

wss.on("connection", function (ws, req) {
    ws.url = req.url;
    console.log(ws.url);
    const sendUsernames = () => [...wss.clients]
        .filter(client => req.url == client.url && client.readyState === WebSocket.OPEN)
        .forEach((client, _, arr) => {
            client.send(JSON.stringify({usernames: arr.map(c => ({username: c.username, status: c.status}))}));
            console.log("Sent usernames");
        });

    ws.on("pong", () => {ws.isAlive = true; ws.latency = (Date.now() - ws.lastPing)/2;});

    ws.on("message", message => {
        message = JSON.parse(message);
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

    ws.on("close", () => {sendUsernames(); console.log(ws.username + " left room " + ws.url);});
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
