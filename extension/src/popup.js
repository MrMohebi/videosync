const select_video_button = document.getElementById("select_video"),
    join_room_button = document.getElementById("join_room"),
    leave_room_button = document.getElementById("leave_room"),
    share_page_button = document.getElementById("share_page"),
    username_input = document.getElementById("username"),
    room_name_input = document.getElementById("room_name");

join_room_button.addEventListener("click",
    () => browser.storage.local.get("server")
        .then(res => res.server)
        .then(server => browser.runtime.sendMessage({
            join_room: {room: room_name_input.value, server: server}
        }))
        .then(() => window.close())
);

leave_room_button.addEventListener("click",
    () => browser.runtime.sendMessage({leave_room: true})
        .then(() => window.close())
);

share_page_button.addEventListener("click",
    () => browser.tabs.query({active: true, currentWindow: true})
        .then(tabs => tabs[0].url)
        .then(url => browser.runtime.sendMessage({share_url: url}))
        .then(() => window.close())
);

browser.tabs.query({active: true, currentWindow: true})
    .then(tabs => tabs[0].id)
    .then(tabid => browser.webNavigation.getAllFrames({tabId: tabid})
        .then(frames => select_video_button.addEventListener("click",
            () => browser.permissions.request({origins: frames.map(f => f.url).filter(s => s.startsWith("http"))})
                .then(() => browser.runtime.sendMessage({select_video: {tabid: tabid}}))
                .then(() => window.close())
        )));

username_input.addEventListener("input",
    () => browser.storage.local.set({username: username_input.value})
);

browser.runtime.sendMessage({get_room: {properties: ["path"]}})
    .then(room => {
        if (room == null || room.path == null) {
            share_page_button.disabled = leave_room_button.disabled = select_video_button.disabled = true;
            share_page_button.style.display = leave_room_button.style.display = select_video_button.style.display = "none";
            room_name_input.value = [...Array(10)].map(() => Math.random().toString(36)[2]).join("");
        }
        else {
            room_name_input.value = room.path;
            room_name_input.disabled = join_room_button.disabled = true;
            join_room_button.style.display = "none";
        }
    });

browser.storage.local.get("username")
    .then(res => res.username)
    .then(username => {if (username) { username_input.value = username; } });
