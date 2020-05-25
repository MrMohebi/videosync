const select_video_button = document.getElementById("select_video"),
    leave_room_button = document.getElementById("leave_room"),
    create_room_button = document.getElementById("create_room"),
    share_page_button = document.getElementById("share_page"),
    username_input = document.getElementById("username");

select_video_button.addEventListener("click",
    () => browser.tabs.query({active: true, currentWindow: true})
        .then(tabs => tabs[0].id)
        .then(tabid => browser.tabs.executeScript(tabid, {allFrames: true, matchAboutBlank: true, file: "select_video.js"}))
        .then(() => window.close())
);

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

username_input.addEventListener("input",
    () => browser.storage.local.set({username: username_input.value})
);

browser.runtime.sendMessage({get_room: {properties: ["path"]}})
    .then(room => {
        console.log("Got room:", room);
        share_page_button.disabled = leave_room_button.disabled = select_video_button.disabled = (room === null || room === undefined || room.path === null || room.path === undefined);
    });

browser.storage.local.get("username")
    .then(res => res.username)
    .then(username => {if (username) { username_input.value = username; } });
