export async function getTabSnapshot(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },

    func: () => {
      const local = {};
      const session = {};

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        local[key] = localStorage.getItem(key);
      }

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);

        session[key] = sessionStorage.getItem(key);
      }

      return {
        localStorage: local,
        sessionStorage: session,
        origin: location.origin,
        hostname: location.hostname,
        url: location.href,
      };
    },
  });

  return result;
}
