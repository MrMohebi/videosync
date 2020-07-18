const select_video_button = document.getElementById("select_video"),
    join_room_button = document.getElementById("join_room"),
    leave_room_button = document.getElementById("leave_room"),
    share_page_button = document.getElementById("share_page"),
    username_input = document.getElementById("username"),
    room_name_input = document.getElementById("room_name"),
    usernames_table = document.getElementById("usernames");

const room_prom = browser.runtime.sendMessage({get_room: {properties: ["iframes", "path", "usernames"]}});

join_room_button.addEventListener("click",
    () => browser.storage.local.get("server")
        .then(res => res.server)
        .then(server => {
            if (room_name_input.value && username_input.value) {
                return browser.runtime.sendMessage({
                    join_room: {room: room_name_input.value, server: server, username: username_input.value}
                });
            }
        }).then(() => window.close(), () => window.close())
);

leave_room_button.addEventListener("click",
    () => browser.runtime.sendMessage({leave_room: true})
        .then(() => window.close(), () => window.close())
);

share_page_button.addEventListener("click",
    () => browser.tabs.query({active: true, currentWindow: true})
        .then(tabs => tabs[0].url)
        .then(url => browser.runtime.sendMessage({share_url: url}))
        .then(() => window.close(), () => window.close())
);

browser.tabs.query({active: true, currentWindow: true})
    .then(tabs => [tabs[0].id, tabs[0].url])
    .then(([tabid, url]) => room_prom.then(room => select_video_button.addEventListener("click",
        () => browser.permissions.request({origins: (room.iframes || []).filter(s => s.startsWith("http")).map(s => (new URL(s)).origin).filter(s => s != (new URL(url)).origin).map(s => s + "/*")})
            .then(() => browser.runtime.sendMessage({select_video: {tabid: tabid}}))
            .then(() => window.close(), () => window.close())
    )));

room_prom.then(room => {
    if (room == null || room.path == null) {
        usernames_table.style.display = share_page_button.style.display = leave_room_button.style.display = select_video_button.style.display = "none";
        browser.storage.local.get("last_room").then(res => room_name_input.value = res.last_room);
    }
    else {
        room_name_input.value = room.path;
        username_input.disabled = room_name_input.disabled = true;
        join_room_button.style.display = "none";
    }
});

room_prom.then(room => {
    if (room != null && room.usernames != null) {
        room.usernames.forEach(user => {
            var tr = document.createElement("tr"),
                name_td = document.createElement("td"),
                status_td = document.createElement("td");
            name_td.innerText = user.username;
            status_td.innerText = user.status.ready?"ready":"not ready";
            status_td.style.textAlign = "right";
            usernames_table.appendChild(tr);
            tr.appendChild(name_td);
            tr.appendChild(status_td);
        });
    }
});

browser.storage.local.get("username")
    .then(res => res.username)
    .then(username => {if (username) { username_input.value = username; } });
