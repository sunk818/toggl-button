/*jslint indent: 2 */
/*global window: false, XMLHttpRequest: false, chrome: false, btoa: false */
"use strict";

var TogglButton = {
  $user: null,
  $apiUrl: "https://www.toggl.com/api/v7",
  $newApiUrl: "https://new.toggl.com/api/v8",
  $sites: new RegExp([
    'asana\\.com',
    'podio\\.com',
    'trello\\.com',
    'github\\.com',
    'gitlab\\.com',
    'teambox\\.com',
    'teamweek\\.com',
    'basecamp\\.com',
    'unfuddle\\.com',
    'worksection\\.com',
    'pivotaltracker\\.com'].join('|')),
  $curEntryId: null,

  checkUrl: function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
      if (TogglButton.$sites.test(tab.url)) {
        TogglButton.setPageAction(tabId);
      } else if (/toggl\.com\/track/.test(tab.url)) {
        TogglButton.fetchUser(TogglButton.$apiUrl);
      } else if (/toggl\.com\/app/.test(tab.url)) {
        TogglButton.fetchUser(TogglButton.$newApiUrl);
      }
    }
  },

  fetchUser: function (apiUrl) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", apiUrl + "/me?with_related_data=true", true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        var resp = JSON.parse(xhr.responseText);
        TogglButton.$user = resp.data;
      } else if (apiUrl === TogglButton.$apiUrl) {
        TogglButton.fetchUser(TogglButton.$newApiUrl);
      }
    };
    xhr.send();
  },

  createTimeEntry: function (timeEntry) {
    var start = new Date(),
      xhr = new XMLHttpRequest(),
      entry = {
        time_entry: {
          start: start.toISOString(),
          created_with: "Toggl Button",
          description: timeEntry.description,
          wid: TogglButton.$user.default_wid,
          pid: timeEntry.projectId || null,
          billable: timeEntry.billable || false,
          duration: -(start.getTime() / 1000)
        }
      };
    xhr.open("POST", TogglButton.$newApiUrl + "/time_entries", true);
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(TogglButton.$user.api_token + ':api_token'));
    // handle response
    xhr.addEventListener('load', function (e) {
      var responseData, entryId;
      responseData = JSON.parse(xhr.responseText);
      entryId = responseData && responseData.data && responseData.data.id;
      TogglButton.$curEntryId = entryId;
    });
    xhr.send(JSON.stringify(entry));
  },

  stopTimeEntry: function (entryId) {
    entryId = entryId || TogglButton.$curEntryId;
    if (!entryId) {
      return;
    }
    var xhr = new XMLHttpRequest();

    // PUT https://www.toggl.com/api/v8/time_entries/{time_entry_id}/stop
    xhr.open("PUT", TogglButton.$newApiUrl + "/time_entries/" + entryId + "/stop", true);
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(TogglButton.$user.api_token + ':api_token'));
    xhr.send();
  },

  setPageAction: function (tabId) {
    var imagePath = 'images/inactive-19.png';
    if (TogglButton.$user !== null) {
      imagePath = 'images/active-19.png';
    }
    chrome.pageAction.setIcon({
      tabId: tabId,
      path: imagePath
    });
    chrome.pageAction.show(tabId);
  },

  newMessage: function (request, sender, sendResponse) {
    if (request.type === 'activate') {
      TogglButton.setPageAction(sender.tab.id);
      sendResponse({success: TogglButton.$user !== null, user: TogglButton.$user});
    } else if (request.type === 'timeEntry') {
      TogglButton.createTimeEntry(request);
    } else if (request.type === 'stop') {
      TogglButton.stopTimeEntry();
    }
  }

};

chrome.pageAction.onClicked.addListener(function (tab) {
  if (TogglButton.$user === null) {
    chrome.tabs.create({url: 'https://new.toggl.com/#login'});
  }
});

TogglButton.fetchUser(TogglButton.$apiUrl);
chrome.tabs.onUpdated.addListener(TogglButton.checkUrl);
chrome.extension.onMessage.addListener(TogglButton.newMessage);
