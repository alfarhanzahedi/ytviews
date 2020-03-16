/**
 *  index.js is responsible for generating the front-end to display the accumulated data
 *  to the user of the extension.
 */

// Listen for messages from background and content scripts.
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    // Display the data if the "action" attribute of the message says so!
    if (message["action"] === "displayVideoData") {
        $("#view-count-table > tbody:last-child").append(
            `
            <tr>
                <td><a href="${message["data"]["url"]}" target="_blank"> ${message["data"]["title"]}</a></td>
                <td>${message["data"]["count"]}</td>
            </tr>
            `
        );
    }
});
