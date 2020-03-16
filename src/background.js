/**
 *  background.js is the only background script of this extension.
 *  It handles all the functionalities of the extension that needs to performed in a 
 *  background script! 
 */

const dbName = "YTViews";

let db = new Dexie(dbName);

db.version(1).stores({
    videoDetails: "id",
    videoViewCounts: "id, count",
    videoViewHistory: "id"
});

function processVideoData(data) {
    // Check if a record corresponding to the current video (identifiable by data["id"]) exists.
    db.videoViewCounts.get(data["id"]).then(function (dataFromDB) {
        
        // If no record exists, create the necessary records in different stores!
        if (dataFromDB === undefined) {
            
            // Create a record in the  "videoViewCounts" store (with inital count as 1).
            db.videoViewCounts.add({ id: data["id"], count: 1 });
            
            // Create a record in the "videoDetails" store.
            db.videoDetails.add({ id: data["id"], title: data["title"], url: data["url"] });
        
        } else {
            
            // If a record exists, just increment the "count" of the current video in the
            // "videoViewCounts" store.
            db.videoViewCounts.put({ id: data["id"], count: dataFromDB["count"] + 1 });
        
        }

    });
}

function sendVideoDataToTab(tab) {
    db.transaction("r", db.videoViewCounts, db.videoDetails, function () {

        // Iterate over the videos in reverse order of "count".
        // That is, the most viewed video should come first!
        db.videoViewCounts
          .orderBy("count")
          .reverse()
          .each(function (videoViewCount) {

            // Obtain the details of the video from the database!
            db.videoDetails
              .get({ id: videoViewCount["id"] })
              .then(function (videoDetail) {

                // Finally, send the data to be displayed to the appropriate tab.
                chrome.tabs.sendMessage(tab.id, {
                    "action": "displayVideoData",
                    "data": {
                        "id": videoViewCount["id"],
                        "title": videoDetail["title"],
                        "url": videoDetail["url"],
                        "count": videoViewCount["count"]
                    }
                });
            });
        });
    });
}

let htmlTabId;

function handleTabUpdate(tabId, changeInfo, tab) {
    if (tabId === htmlTabId && changeInfo.status === "complete") {
        // Remove the listener. Not needed once the DOM tree has been completely created.
        chrome.tabs.onUpdated.removeListener(handleTabUpdate)
        // Send the data now.
        sendVideoDataToTab(tab);
    }
}

// Listen for "click" on the extension's icon in the chrome toolbar!
chrome.browserAction.onClicked.addListener(function () {
    // Create a new tab to display the data of different videos as recorded
    // and stored in the database.
    // Note: The data is to be sent to the newly created tab only when the DOM tree has 
    // been completely created. So, we will need to wait for it to be case.
    // We add a listener on tab updations to check if the creation of DOM tree
    // has completed or not..
    chrome.tabs.create({ url: chrome.runtime.getURL("frontend/index.html") },
        function (tab) {
            htmlTabId = tab.id;
            chrome.tabs.onUpdated.addListener(handleTabUpdate);
        }
    );
});

// Listen for messages from content scripts.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    // If the "action" specified is "processVideoData", process (store, etc) the video data
    // present in the message.
    if (message["action"] === "processVideoData") {
        processVideoData(message["data"]);
    }
});
