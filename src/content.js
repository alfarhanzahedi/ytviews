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
};

function respondToChangesInTitleTag(mutationsList, observer) {
    for (let i = 0; i < mutationsList.length; i++) {

        if (mutationsList[i].type === 'childList' && mutationsList[i].addedNodes.length) {
            // We are observing the "title" tag. A change in the title text means that the user 
            // navigated to a different video or page on YouTube.
            // Extract the title text.
            let videoTitle = mutationsList[i].addedNodes[0]["textContent"];
            
            // Extract the URL of the current web page.
            let videoURL = mutationsList[i].addedNodes[0]["baseURI"].split("&")[0];
            
            // Extract the video ID from the URL of the current web page.
            let videoID = getVideoIDFromURL(mutationsList[i].addedNodes[0]["baseURI"]);

            // If the URL does not contain any video ID in it, then it is not the URL of
            // a YouTube video! So, no need of any further processing.
            if (videoID == null) {
                continue;
            }
            
            // A typical YouTube video title is suffixed with " - YouTube". 
            // Including this suffix in the video title while storing make little sense. 
            // So, remove it!
            if (videoTitle.endsWith(youtubeSuffix)) {
                videoTitle = videoTitle.slice(0, videoTitle.length - youtubeSuffix.length);
            }

            // Let the background script handle the further processing (storage, etc) of the video data!
            chrome.runtime.sendMessage({
                "action": "processVideoData",
                "data": {
                    "id": videoID,
                    "title": videoTitle,
                    "url": videoURL,
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
    { childList: true }
);
