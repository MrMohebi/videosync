const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", function (ws, req) {
    ws.url = req.url;
    console.log(req.url);
    const sendCount = () => [...wss.clients]
        .filter(client => req.url == client.url && client.readyState === WebSocket.OPEN)
        .forEach((client, _, arr) => client.send(JSON.stringify({roomCnt: arr.length})));

    sendCount();

    ws.on("pong", () => {ws.isAlive = true; ws.latency = (Date.now() - ws.lastPing)/2;});

    ws.on("message", message => {
        console.log(message);
        wss.clients.forEach(client => {
            console.log(client.url);
            if (req.url == client.url && client.readyState === WebSocket.OPEN) {
                if (client === ws) {
                    client.send(JSON.stringify({ok: message}));
                }
                else {
                    client.send(JSON.stringify({peer_message: JSON.parse(message), sender_latency: ws.latency, receiver_latency: client.latency}));
                }
            }
        });
    });

    ws.on("close", () => {sendCount(); console.log("client left");});
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
