export async function clearStorage(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },

    func: () => {
      localStorage.clear();

      sessionStorage.clear();
    },
  });
}

export async function restoreStorage(tabId, profile) {
  await chrome.scripting.executeScript({
    target: { tabId },

    args: [profile.localStorage, profile.sessionStorage],

    func: (localData, sessionData) => {
      localStorage.clear();
      sessionStorage.clear();

      Object.entries(localData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      Object.entries(sessionData).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    },
  });
}
