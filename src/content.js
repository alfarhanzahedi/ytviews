/**
 *  content.js is the only background script of this extension.
 *  It handles all the functionalities of the extension that needs to performed in a 
 *  content script! 
 */

const youtubeSuffix = " - YouTube";

/**
 * This function extracts and returns the video ID from a typical YouTube video URL.
 * @param {string} url The YouTube video URL from which the video ID is to be extracted. 
 * @returns {string} The video ID, if present, else null.
 */
function getVideoIDFromURL(url) {
    let match = (url || "").match(/v=(.+?)(&|$)/);
    return match && match[1];
}


/**
 * This function extracts and returns the notification count from a typical YouTube tab title.
 * @param {string} title The YouTube video tab title from which the notification count is to be extracted.
 * @returns {string} The notification count, if present, else null.
 */
function getNotificationCountFromVideoTitle(title) {
    let match = (title || "").match(/^[(]\d+[)]/g);
    return match && match[0];
}

async function respondToChangesInTitleTag(mutationsList, observer) {
    debugger;
    for (let i = 0; i < mutationsList.length; i++) {

        if (mutationsList[i].type === 'childList' && mutationsList[i].addedNodes.length) {
            // We are observing the "title" tag. A change in the title text means that the user 
            // navigated to a different video or page on YouTube.
            // Extract the title text for both, old and new video.
            let videoTitleNew = mutationsList[i].addedNodes[0]["textContent"];
            let videoTitleOld = mutationsList[i].removedNodes[0]["textContent"];

            // Extract the URL of the current and old web page.
            let videoURLNew = mutationsList[i].addedNodes[0]["baseURI"].split("&")[0];
            let videoURLOld = mutationsList[i].removedNodes[0]["baseURI"].split("&")[0];

            // Extract the video ID from the URL of the current and old web page.
            let videoIDNew = getVideoIDFromURL(mutationsList[i].addedNodes[0]["baseURI"]);
            let videoIDOld = getVideoIDFromURL(mutationsList[i].removedNodes[0]["baseURI"]);


            // If the URL does not contain any video ID in it, then it is not the URL of
            // a YouTube video! So, no need of any further processing.
            if (videoIDNew == null) {
                continue;
            }

            // Title of a tab can change if a notification is received.
            // Example: Title changes from "Some Random Video" to "(1) Some Random Video".
            // For such cases, view count should not be updated.
            if (videoIDNew === videoIDOld) {
                let notificationCountOld = getNotificationCountFromVideoTitle(videoTitleOld);
                let notificationCountNew = getNotificationCountFromVideoTitle(videoTitleNew);
                // There can be two cases here -
                // 1. Notification is marked as read. The notification count is removed from the title in this scenario.
                // 2. New notification arrives. The notification count is added to the title in this scenario.
                if ((notificationCountOld != null && notificationCountNew == null) || (notificationCountNew != null && notificationCountOld == null)) {
                    continue;
                }
            }

            // A typical YouTube video title is suffixed with " - YouTube". 
            // Including this suffix in the video title while storing make little sense. 
            // So, remove it!
            if (videoTitleNew.endsWith(youtubeSuffix)) {
                videoTitleNew = videoTitleNew.slice(0, videoTitleNew.length - youtubeSuffix.length);
            }

            if (videoTitleOld.endsWith(youtubeSuffix)) {
                videoTitleOld = videoTitleOld.slice(0, videoTitleOld.length - youtubeSuffix.length);
            }

            // Let the background script handle the further processing (storage, etc) of the video data!
            chrome.runtime.sendMessage({
                "action": "processVideoData",
                "data": {
                    "id": videoIDNew,
                    "title": videoTitleNew,
                    "url": videoURLNew,
                    "watchedAt": new Date().toUTCString()
                }
            })
        }
    }
}

// Start observing changes in tha "title" tag.
// A change in the title text means that the user navigated to a different video or page on
// YouTube.
new MutationObserver(respondToChangesInTitleTag).observe(
    document.getElementsByTagName("title")[0],
    {
        childList: true,
        attributeOldValue: true
    }
);
