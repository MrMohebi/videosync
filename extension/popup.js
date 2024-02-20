const select_video_button = document.getElementById("select_video"),
    //join_room_submit = document.getElementById("join_room"),
    leave_room_button = document.getElementById("leave_room"),
    share_page_button = document.getElementById("share_page"),
    username_input = document.getElementById("username"),
    room_name_input = document.getElementById("room_name"),
    use_latency_checkbox = document.getElementById("use_latency"),
    usernames_table = document.getElementById("usernames"),
    room_info_span = document.getElementById("room_info"),
    room_legend = document.getElementById("room"),
    join_form = document.getElementById("join");

const room_prom = browser.runtime.sendMessage({get_room: {properties: ["iframes", "path", "use_latency"]}});

join_form.addEventListener("submit",
    () => browser.storage.local.get("server")
        .then(res => res.server)
        .then(server => {
            if (room_name_input.value && username_input.value) {
                return browser.runtime.sendMessage({
                    join_room: {room: room_name_input.value, server: server, username: username_input.value, use_latency: true}
                });
            }
        })
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

use_latency_checkbox.addEventListener("change",
    () => browser.runtime.sendMessage({set_room: {properties: {"use_latency": use_latency_checkbox.checked}}})
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
        room_info_span.style.display = "none";
        browser.storage.local.get("last_room").then(res => room_name_input.value = res.last_room);
    }
    else {
        room_legend.innerText = room.path;
        use_latency_checkbox.checked = room.use_latency;
        join_form.style.display = "none";
    }
});

browser.storage.local.get("username")
    .then(res => res.username)
    .then(username => {if (username) { username_input.value = username; } });

function refreshData() {
    browser.runtime.sendMessage({get_room: {properties: ["usernames"]}}).then(room => {
        if (room != null && room.usernames != null) {
            while (usernames_table.rows.length > 0) {
                usernames_table.deleteRow(-1);
            }
            room.usernames.forEach(user => {
                var tr = usernames_table.insertRow(-1);
                var name_td = tr.insertCell(0);
                var status_td = tr.insertCell(1);
                name_td.innerText = user.username;
                status_td.innerText = user.status.ready?"ready":"not ready";
                status_td.style.textAlign = "right";
            });
        }
    });
}

refreshData();
setInterval(refreshData, 1000);
