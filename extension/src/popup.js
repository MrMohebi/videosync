const select_video_button = document.getElementById("select_video"),
    leave_room_button = document.getElementById("leave_room"),
    create_room_button = document.getElementById("create_room"),
    share_page_button = document.getElementById("share_page"),
    username_input = document.getElementById("username"),
    room_name_div = document.getElementById("room_name");

leave_room_button.addEventListener("click",
    () => browser.runtime.sendMessage({leave_room: true})
        .then(() => window.close())
);

create_room_button.addEventListener("click",
    () => browser.storage.local.get("server")
        .then(res => res.server)
        .then(server => browser.tabs.create({
            url: "https://" + server + "/" + [...Array(10)].map(() => Math.random().toString(36)[2]).join("")
        }))
        .then(() => window.close())
);

share_page_button.addEventListener("click",
    () => browser.tabs.query({active: true, currentWindow: true})
        .then(tabs => tabs[0].url)
        .then(url => browser.runtime.sendMessage({share_url: url}))
);

select_video_button.addEventListener("click",
    () => browser.tabs.query({active: true, currentWindow: true})
        .then(tabs => tabs[0].id)
        .then(tabid => browser.runtime.sendMessage({select_video: {tabid: tabid}})));

username_input.addEventListener("input",
    () => browser.storage.local.set({username: username_input.value})
);

browser.runtime.sendMessage({get_room: {properties: ["path"]}})
    .then(room => {
        if (room == null || room.path == null) {
            share_page_button.disabled = leave_room_button.disabled = select_video_button.disabled = true;
            share_page_button.style.display = leave_room_button.style.display = select_video_button.style.display = "none";
            room_name_div.innerText = "(none)";
        }
        else {
            room_name_div.innerText = room.path;
        }
    });

browser.storage.local.get("username")
    .then(res => res.username)
    .then(username => {if (username) { username_input.value = username; } });
