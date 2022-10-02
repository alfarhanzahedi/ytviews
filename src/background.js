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
    db.videoViewCounts.get(data["id"]).then(function (dataFromDBForViewCount) {
        // If no record exists, create the necessary records in different stores!
        if (dataFromDBForViewCount === undefined) {
            // Create a record in the  "videoViewCounts" store (with initial count as 1).
            db.videoViewCounts.add({ id: data["id"], count: 1 });
            
            // Create a record in the "videoDetails" store.
            db.videoDetails.add({
                id: data["id"],
                title: data["title"],
                url: data["url"]
            });

            db.videoViewHistory.add({
               id: data["id"],
               // Adding the end-time as N/A for now.
               // It will be taken up separately as part of https://github.com/alfarhanzahedi/ytviews/issues/6.
               duration: [[data["watchedAt"], "N/A"]]
            });
        } else {
            // If a record exists, just increment the "count" of the current video in the
            // "videoViewCounts" store and add the view history.
            db.videoViewCounts.put({
                id: data["id"],
                count: dataFromDBForViewCount["count"] + 1
            });

            db.videoViewHistory.get(data["id"]).then(function (dataFromDBForViewHistory) {
                if (dataFromDBForViewHistory === undefined) {
                    db.videoViewHistory.add({
                        id: data["id"],
                        duration: [[data["watchedAt"], "N/A"]],
                    });
                } else {
                    dataFromDBForViewHistory["duration"].push([data["watchedAt"], "N/A"])
                    db.videoViewHistory.put({
                        id: data["id"],
                        duration: dataFromDBForViewHistory["duration"]
                    })
                }
            });
        }
    });
}

function sendVideoDataToTab(tab) {
    db.transaction("r", db.videoViewCounts, db.videoDetails, db.videoViewHistory, function () {

        // Iterate over the videos in reverse order of "count".
        // That is, the most viewed video should come first!
        db.videoViewCounts.orderBy("count").reverse().each(function (videoViewCount) {
            // Obtain the details of the video from the database!
            db.videoDetails.get({ id: videoViewCount["id"] }).then(function (videoDetail) {
                // Obtain the view history from the database.
                db.videoViewHistory.get({ id: videoViewCount["id"] }).then(function (videoViewHistory) {
                  // Convert to local TZ.
                  let lastWatchedAt = videoViewHistory["duration"].at(-1)[0];
                  let lastWatchedAtInLocalTZ = new Date(lastWatchedAt).toLocaleString()

                  // Finally, send the data to be displayed to the appropriate tab.
                  chrome.tabs.sendMessage(tab.id, {
                      "action": "displayVideoData",
                      "data": {
                          "id": videoViewCount["id"],
                          "title": videoDetail["title"],
                          "url": videoDetail["url"],
                          "count": videoViewCount["count"],
                          "lastWatchedAt": lastWatchedAtInLocalTZ
                      }
                  });
                })
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
chrome.action.onClicked.addListener(function () {
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
