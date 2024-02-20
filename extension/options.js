const server_addr = document.getElementById("server_addr");
browser.storage.local.get("server").then(res => server_addr.value = res.server);
document.getElementById("server_form").onsubmit = () => browser.storage.local.set({server: server_addr.value});
