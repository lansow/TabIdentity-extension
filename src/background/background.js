import { getTabSnapshot } from "../services/snapshot";
import { removeCookies, setCookies, getCookies } from "../services/cookies";
import { clearStorage, restoreStorage } from "../services/restore";
import {
  setActiveProfile,
  getActiveProfile,
  addProfile,
  getProfile,
  updateProfile,
  getRootDomain,
  getGuestProfile,
  removeProfile,
} from "../services/storage";

// Track tabs that already have guest AND domains that already have guest
const tabsWithGuest = new Set();
const domainsWithGuest = new Set();

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when page is fully loaded and has a valid URL
  if (
    changeInfo.status !== "complete" ||
    !tab.url ||
    tab.url.startsWith("chrome://")
  )
    return;

  try {
    const url = new URL(tab.url);
    const domain = getRootDomain(url.hostname);

    // IMPORTANT: Check if guest already exists for this DOMAIN (not just tab)
    // This prevents multiple guests
    if (domainsWithGuest.has(domain)) {
      // Guest already exists for this domain, just mark tab as handled
      tabsWithGuest.add(tabId);

      // Update guest with current state if this tab hasn't been processed
      if (!tabsWithGuest.has(tabId)) {
        const existingGuest = await getGuestProfile(domain);
        if (existingGuest) {
          const snapshot = await getTabSnapshot(tabId);
          const cookies = await getCookies(tab.url);

          await updateProfile(existingGuest.id, {
            cookies,
            localStorage: snapshot.localStorage,
            sessionStorage: snapshot.sessionStorage,
            url: snapshot.url,
            updatedAt: Date.now(),
          });
        }
      }
      return;
    }

    // Check if this specific tab already has a guest
    if (tabsWithGuest.has(tabId)) return;

    // Create new guest profile ONLY if domain doesn't have one yet
    const existingGuest = await getGuestProfile(domain);

    if (!existingGuest) {
      const snapshot = await getTabSnapshot(tabId);
      const cookies = await getCookies(tab.url);

      const guestProfile = {
        id: crypto.randomUUID(),
        name: "Guest Session",
        guest: true,
        createdAt: Date.now(),
        domain,
        origin: snapshot.origin,
        url: snapshot.url,
        cookies,
        localStorage: snapshot.localStorage,
        sessionStorage: snapshot.sessionStorage,
      };

      await addProfile(guestProfile);
      await setActiveProfile(domain, guestProfile.id);

      // Mark domain as having guest - PREVENTS FUTURE GUEST CREATION
      domainsWithGuest.add(domain);
    }

    // Mark tab as having guest
    tabsWithGuest.add(tabId);
  } catch (error) {
    console.error("Error managing guest profile:", error);
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithGuest.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CREATE_PROFILE") {
    createProfile(message.name)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          error: error.message,
        }),
      );

    return true;
  }

  if (message.type === "SWITCH_PROFILE") {
    switchProfile(message.id)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          error: error.message,
        }),
      );

    return true;
  }

  if (message.type === "UPDATE_PROFILE") {
    updateCurrentProfile(message.id)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          error: error.message,
        }),
      );

    return true;
  }

  if (message.type === "RENAME_PROFILE") {
    updateProfile(message.id, {
      name: message.name,
    }).then(() =>
      sendResponse({
        success: true,
      }),
    );

    return true;
  }

  if (message.type === "DELETE_PROFILE") {
    deleteProfile(message.id)
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          error: error.message,
        }),
      );

    return true;
  }

  if (message.type === "CLEAR_PROFILE") {
    clearActiveProfileData()
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          error: error.message,
        }),
      );

    return true;
  }
});

async function createProfile(name) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const snapshot = await getTabSnapshot(tab.id);
  const cookies = await getCookies(tab.url);
  const domain = getRootDomain(snapshot.hostname);

  const profile = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    domain,
    origin: snapshot.origin,
    url: snapshot.url,
    cookies,
    localStorage: snapshot.localStorage,
    sessionStorage: snapshot.sessionStorage,
  };

  await addProfile(profile);
  await setActiveProfile(domain, profile.id);

  return profile;
}

async function switchProfile(profileId) {
  const profile = await getProfile(profileId);

  if (!profile) {
    throw new Error("Profile not found");
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const currentDomain = getRootDomain(new URL(tab.url).hostname);

  if (currentDomain !== profile.domain) {
    throw new Error("Invalid domain");
  }

  // Save current state to guest before switching
  const currentSnapshot = await getTabSnapshot(tab.id);
  const currentCookies = await getCookies(tab.url);

  const existingGuest = await getGuestProfile(currentDomain);

  if (existingGuest) {
    await updateProfile(existingGuest.id, {
      cookies: currentCookies,
      localStorage: currentSnapshot.localStorage,
      sessionStorage: currentSnapshot.sessionStorage,
      url: currentSnapshot.url,
      updatedAt: Date.now(),
    });
  }

  // Apply new profile
  await removeCookies(currentCookies);
  await clearStorage(tab.id);
  await setCookies(profile.cookies);
  await restoreStorage(tab.id, profile);
  await setActiveProfile(profile.domain, profile.id);

  await new Promise((resolve) => setTimeout(resolve, 300));
  await chrome.tabs.reload(tab.id);

  return {
    success: true,
  };
}

async function updateCurrentProfile(profileId) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const snapshot = await getTabSnapshot(tab.id);
  const cookies = await getCookies(tab.url);

  await updateProfile(profileId, {
    cookies,
    localStorage: snapshot.localStorage,
    sessionStorage: snapshot.sessionStorage,
    updatedAt: Date.now(),
  });

  return {
    success: true,
  };
}

async function deleteProfile(profileId) {
  const profile = await getProfile(profileId);

  if (!profile) {
    throw new Error("Profile not found");
  }

  // Prevent deleting guest profiles
  if (profile.guest) {
    throw new Error("Cannot delete guest profile");
  }

  await removeProfile(profileId);

  // If this was the active profile, switch to guest
  const activeId = await getActiveProfile(profile.domain);
  if (activeId === profileId) {
    const guestProfile = await getGuestProfile(profile.domain);
    if (guestProfile) {
      await setActiveProfile(profile.domain, guestProfile.id);

      // Switch to guest state
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab) {
        const currentCookies = await getCookies(tab.url);
        await removeCookies(currentCookies);
        await clearStorage(tab.id);
        await setCookies(guestProfile.cookies || []);
        await restoreStorage(tab.id, guestProfile);
        await chrome.tabs.reload(tab.id);
      }
    }
  }

  return { success: true };
}

async function clearActiveProfileData() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const url = new URL(tab.url);
  const domain = getRootDomain(url.hostname);
  const activeId = await getActiveProfile(domain);

  if (!activeId) {
    return { success: true, message: "No active profile" };
  }

  const profile = await getProfile(activeId);

  if (!profile) {
    return { success: true, message: "Profile not found" };
  }

  // Clear the profile data but KEEP the profile
  const clearedData = {
    cookies: [],
    localStorage: {},
    sessionStorage: {},
    updatedAt: Date.now(),
  };

  await updateProfile(activeId, clearedData);

  // Apply the cleared state to the current tab
  const currentCookies = await getCookies(tab.url);
  await removeCookies(currentCookies);
  await clearStorage(tab.id);

  // If profile is not guest, reload to show cleared state
  // For guest, we just cleared the data and applied it
  await chrome.tabs.reload(tab.id);

  return { success: true };
}
