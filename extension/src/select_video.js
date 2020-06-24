(() => {
    function displayNotification(title, message) {
        return browser.runtime.sendMessage({notification: {title: title, message: message}});
    }

    function createVideoOverlay(video) {
        var overlay = document.createElement("videosync-video-overlay");
        video.parentElement.appendChild(overlay);
        overlay.style = "position: absolute; z-index: 2147483638; float: left; margin-left: 5%; margin-top: 5%; padding: 0.5rem; font-size: 1.5rem; color: #fff; background: rgba(0, 0, 0, 0.75); display: none;";
        return overlay;
    }

    function updateVideo() {
        if (notification_overlay) {
            notification_overlay.parentElement.removeChild(notification_overlay);
        }
        notification_overlay = createVideoOverlay(video);
        port.postMessage({video_info: {duration: video.duration, paused: video.paused, currentTime: video.currentTime, playbackRate: video.playbackRate}, source: "local"});
    }

    function handleMess(mess) {
        if (mess.source == "local") {
            return;
        }
        if (mess.select_video) {
            video = videos[mess.select_video.id];

            updateVideo();
            video.addEventListener("pause", updateVideo);
            video.addEventListener("play", updateVideo);
            video.addEventListener("seeked", updateVideo);
            video.addEventListener("seeking", updateVideo);
            video.addEventListener("waiting", updateVideo);
            video.addEventListener("ratechange", updateVideo);
        }
        if (mess.notification) {
            clearTimeout(notification_overlay.timeout);
            notification_overlay.style.display = "block";
            notification_overlay.innerText = mess.notification.title + ": " + mess.notification.message;
            notification_overlay.timeout = setTimeout(() => notification_overlay.style.display = "none", 5000);
        }
        if (mess.video_info) {
            const username = mess.username || "Anonymous";
            if (mess.video_info.duration != null && mess.video_info.duration != video.duration) {
                displayNotification("VideoSync Warning", "Video duration does not match with " + username);
            }
            if (mess.video_info.paused != null && mess.video_info.paused != video.paused) {
                if (video.paused) {
                    displayNotification("VideoSync", username + " resumed");
                    video.removeEventListener("play", updateVideo);
                    video.play();
                    video.addEventListener("play", updateVideo);
                }
                else {
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
                video.currentTime = mess.video_info.currentTime + latency;
            }
        }
    }

    var notification_overlay,
        video;
    var videos = document.getElementsByTagName("video");
    var port = browser.runtime.connect({name: "video_selector"});
    port.onMessage.addListener(handleMess);
    port.postMessage({videos: videos.length, source: "local"});
    port.onDisconnect.addListener(() => {
        if (notification_overlay) {
            notification_overlay.parentNode.removeChild(notification_overlay);
        }
    });
})();

0;
