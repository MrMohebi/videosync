function drawRect(path, el) {
    const rect = el.getBoundingClientRect();
    path.setAttribute("x", rect.left);
    path.setAttribute("y", rect.y);
    path.setAttribute("width", rect.width);
    path.setAttribute("height", rect.height);
}

function selectElement(callback, predicate="true()") {
    const overlay_dom = document.createElement("metasearch-overlay");
    overlay_dom.style = "background: transparent none repeat scroll 0% 0% !important; border: 0px none !important; border-radius: 0px !important; box-shadow: none !important; display: block !important; height: 100% !important; left: 0px !important; margin: 0px !important; max-height: none !important; max-width: none !important; opacity: 1 !important; outline: currentcolor none 0px !important; padding: 0px !important; position: fixed !important; top: 0px !important; visibility: visible !important; width: 100% !important; z-index: 2147483638;";
    document.documentElement.appendChild(overlay_dom);
    var lastElement = undefined;
    var highlight = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var highlight_path = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    var levels = 0;
    var selectedElement = undefined;
    highlight_path.style = "stroke: #0F0 !important; stroke-width: 0.5px !important; fill: rgba(63,255,63,0.2) !important;";
    highlight.style = "position: fixed !important; top: 0 !important; left: 0 !important; cursor: crosshair !important; width: 100% !important; height: 100% !important;";
    highlight.appendChild(highlight_path);
    overlay_dom.appendChild(highlight);
    const checkAndSelect = function(el) {
        if (document.evaluate(predicate, el, null, XPathResult.BOOLEAN_TYPE, null).booleanValue) {
            selectedElement = el;
            highlight.style.setProperty("cursor", "crosshair", "important");
        }
        else {
            selectedElement = null;
            highlight.style.setProperty("cursor", "not-allowed", "important");
        }
    };

    const mouseMove = function(ev) {
        if (!highlight.parentNode) {
            overlay_dom.appendChild(highlight);
        }
        overlay_dom.style.setProperty("pointer-events", "none", "important");
        var els = document.elementsFromPoint(ev.clientX, ev.clientY);
        overlay_dom.style.setProperty("pointer-events", "auto", "important");
        var cur = els[0];
        var matching = els.filter(el => document.evaluate(predicate, el, null, XPathResult.BOOLEAN_TYPE, null).booleanValue);
        if (matching.length) {
            cur = matching[0];
        }
        if (cur != lastElement) {
            levels = 0;
            drawRect(highlight_path, cur);
            lastElement = cur;
            checkAndSelect(cur);
        }
    };

    const mouseWheel = function(ev) {
        if (ev.ctrlKey && ev.deltaY != 0) {
            ev.preventDefault();
            if (ev.deltaY > 0) {
                levels += 1;
            }
            else {
                levels = levels>0?levels-1:0;
            }
            var par = lastElement;
            for (let i=0; i<levels; ++i) {
                if (par.localName.toLowerCase() != "body") {
                    par = par.parentNode;
                }
                else {
                    levels = i;
                }
            }
            drawRect(highlight_path, par);
            checkAndSelect(par);
        }
    };

    const mouseClick = function() {
        document.removeEventListener("mousemove", mouseMove);
        document.removeEventListener("wheel", mouseWheel);
        overlay_dom.removeEventListener("click", mouseClick);
        document.documentElement.removeChild(overlay_dom);
        callback(selectedElement);
    };

    document.addEventListener("mousemove", mouseMove, {passive: false});
    document.addEventListener("wheel", mouseWheel, {passive: false});
    overlay_dom.addEventListener("click", mouseClick, {passive: false});
}

function displayNotification(title, message) {
    return browser.runtime.sendMessage({notification: {title: title, message: message}});
}

selectElement(video => {
    if (!video) {
        alert("You must select a video");
    }
    else {
        var port = browser.runtime.connect({name: "video_selector"});
        port.onMessage.addListener(mess => {
            if (mess.video_info && mess.source != "local") {
                const username = mess.username || "Anonymous";
                if (mess.video_info.duration != null && mess.video_info.duration != video.duration) {
                    displayNotification("VideoSync Warning", "Video duration does not match with " + username);
                }
                if (mess.video_info.paused != null && mess.video_info.paused != video.paused) {
                    if (video.paused) {
                        console.log("Playing video");
                        displayNotification("VideoSync", username + " resumed");
                        video.removeEventListener("play", updateVideo);
                        video.play();
                        video.addEventListener("play", updateVideo);
                    }
                    else {
                        console.log("Pausing video");
                        displayNotification("VideoSync", username + " paused");
                        video.removeEventListener("pause", updateVideo);
                        video.pause();
                        video.addEventListener("pause", updateVideo);
                    }
                }
                if (mess.video_info.playbackRate != null && mess.video_info.playbackRate != video.playbackRate) {
                    displayNotification("VideoSync", username + " set playback speed to " + mess.video_info.playbackRate);
                    video.removeEventListener("ratechange", updateVideo);
                    video.playbackRate = mess.video_info.playbackRate;
                    video.addEventListener("ratechange", updateVideo);
                }
                const latency = mess.video_info.paused?0:mess.latency*video.playbackRate;
                if (mess.video_info.currentTime != null && Math.abs(mess.video_info.currentTime + latency - video.currentTime) > 0.5*video.playbackRate + latency) {
                    displayNotification("VideoSync", username + " seeking");
                    console.log("Seeking to", mess.video_info.currentTime);
                    video.currentTime = mess.video_info.currentTime + latency;
                }
            }
        });
        const updateVideo = () => port.postMessage({video_info: {duration: video.duration, paused: video.paused, currentTime: video.currentTime, playbackRate: video.playbackRate}, source: "local"});

        updateVideo();
        //setInterval(updateVideo, 5000);
        video.addEventListener("pause", updateVideo);
        video.addEventListener("play", updateVideo);
        video.addEventListener("seeked", updateVideo);
        video.addEventListener("seeking", updateVideo);
        video.addEventListener("waiting", updateVideo);
        video.addEventListener("ratechange", updateVideo);
    }
}, "boolean(./../video)");
