browser.storage.local.get("server")
    .then(res => res.server)
    .then(server => {
        if (location.host == server) {
            while (document.body.firstChild) {
                document.body.removeChild(document.body.firstChild);
            }
            if (location.pathname == "/") {
                const input = document.createElement("input"); document.body.appendChild(input);
                input.type = "button";
                input.value = "Create Room";
                input.onclick = () => location.pathname = [...Array(10)].map(() => Math.random().toString(36)[2]).join("");
            }
            else {
                const room = location.pathname.slice(1);
                const h1 = document.createElement("h1"); document.body.appendChild(h1);
                h1.innerText = "Room " + room;
                const input_join = document.createElement("input"); document.body.appendChild(input_join);
                input_join.type = "button";
                input_join.value = "Join Room";
                input_join.disabled = false;
                input_join.onclick = () => {browser.runtime.sendMessage({join_room: {room: room, server: server}});};
            }
        }
    });
