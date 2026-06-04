

/* ===== ./App.jsx ===== */

import Popup from "./popup/Popup";

export default function App() {
  return <Popup />;
}


/* ===== ./services/restore.js ===== */

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


/* ===== ./services/snapshot.js ===== */

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


/* ===== ./services/cookies.js ===== */

export async function getCookies(url) {
  return chrome.cookies.getAll({
    url,
  });
}

export async function removeCookies(cookies) {
  await Promise.all(
    cookies.map(async (cookie) => {
      const protocol = cookie.secure ? "https" : "http";

      const url = `${protocol}://${cookie.domain.replace(
        /^\./,
        "",
      )}${cookie.path}`;

      try {
        await chrome.cookies.remove({
          url,
          name: cookie.name,
        });
      } catch {}
    }),
  );
}

export async function setCookies(cookies) {
  await Promise.all(
    cookies.map(async (cookie) => {
      try {
        await chrome.cookies.set({
          url: cookie.secure
            ? `https://${cookie.domain.replace(/^\./, "")}${cookie.path}`
            : `http://${cookie.domain.replace(/^\./, "")}${cookie.path}`,

          name: cookie.name,

          value: cookie.value,

          domain: cookie.domain,

          path: cookie.path,

          secure: cookie.secure,

          httpOnly: cookie.httpOnly,

          sameSite: cookie.sameSite,

          expirationDate: cookie.expirationDate,
        });
      } catch {}
    }),
  );
}


/* ===== ./services/storage.js ===== */

const ACTIVE_PROFILE_KEY = "activeProfile";
const STORAGE_KEY = "profiles";

export async function getProfiles() {
  const result = await chrome.storage.local.get(STORAGE_KEY);

  return result[STORAGE_KEY] || [];
}

export async function saveProfiles(profiles) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: profiles,
  });
}

export async function addProfile(profile) {
  const profiles = await getProfiles();

  profiles.push(profile);

  await saveProfiles(profiles);

  return profile;
}

export async function updateProfile(id, updates) {
  const profiles = await getProfiles();

  const next = profiles.map((profile) =>
    profile.id === id ? { ...profile, ...updates } : profile,
  );

  await saveProfiles(next);
}

export async function removeProfile(id) {
  const profiles = await getProfiles();

  await saveProfiles(profiles.filter((profile) => profile.id !== id));
}

export async function getProfile(id) {
  const profiles = await getProfiles();

  return profiles.find((profile) => profile.id === id);
}

export async function getProfilesByHostname(domain) {
  const profiles = await getProfiles();

  return profiles.filter(
    (profile) => profile.domain === domain && !profile.guest,
  );
}

export async function setActiveProfile(domain, id) {
  const result = await chrome.storage.local.get(ACTIVE_PROFILE_KEY);

  const active = result[ACTIVE_PROFILE_KEY] || {};

  active[domain] = id;

  await chrome.storage.local.set({
    [ACTIVE_PROFILE_KEY]: active,
  });
}

export async function getActiveProfile(domain) {
  const result = await chrome.storage.local.get(ACTIVE_PROFILE_KEY);

  const active = result[ACTIVE_PROFILE_KEY] || {};

  return active[domain] || null;
}

export async function getGuestProfile(domain) {
  const profiles = await getProfiles();

  return profiles.find((profile) => profile.guest && profile.domain === domain);
}

export function getRootDomain(hostname) {
  const parts = hostname.split(".");

  if (parts.length <= 2) {
    return hostname;
  }

  return parts.slice(-2).join(".");
}


/* ===== ./test.js ===== */



/* ===== ./content/content.js ===== */

/* EMPTY FILE */


/* ===== ./popup/Profiles.jsx ===== */

/* EMPTY FILE */


/* ===== ./popup/Popup.jsx ===== */

import { useState } from "react";
import { useProfiles } from "../hooks/useProfiles";

export default function Popup() {
  const { profiles, hostname, activeId, reload } = useProfiles();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [name, setName] = useState("");

  function getNextProfileName() {
    const existingProfiles = profiles.filter((p) => !p.guest);
    const maxIndex = existingProfiles.reduce((max, profile) => {
      const match = profile.name.match(/^Profile (\d+)$/);
      if (match) {
        const index = parseInt(match[1]);
        return Math.max(max, index);
      }
      return max;
    }, 0);

    return `Profile ${maxIndex + 1}`;
  }

  async function createProfile(customName) {
    const profileName = customName?.trim() || getNextProfileName();

    await chrome.runtime.sendMessage({
      type: "CREATE_PROFILE",
      name: profileName,
    });

    setName("");
    setShowCreateDialog(false);
    await reload();
  }

  async function handleClearProfile() {
    await chrome.runtime.sendMessage({
      type: "CLEAR_PROFILE",
    });

    await reload();
  }

  const nonGuestProfiles = profiles.filter((p) => !p.guest);

  return (
    <div
      style={{
        width: 350,
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}>
        <h2 style={{ margin: 0 }}>TabIdentity</h2>
        <button
          onClick={handleClearProfile}
          style={{
            padding: "4px 8px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
          title='Clear active profile data'>
          Clear
        </button>
      </div>

      <h3 style={{ color: "#666", fontSize: 14, marginTop: 0 }}>{hostname}</h3>

      {!showCreateDialog ? (
        <button
          onClick={() => setShowCreateDialog(true)}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: "bold",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}>
          <span style={{ fontSize: 20 }}>+</span>
          <span>Create New Profile</span>
        </button>
      ) : (
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            border: "1px solid #dee2e6",
          }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={getNextProfileName()}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: 8,
              border: "1px solid #ced4da",
              borderRadius: 4,
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                createProfile(name);
              }
            }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => createProfile(name)}
              style={{
                flex: 1,
                padding: "8px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}>
              Create
            </button>
            <button
              onClick={() => {
                setShowCreateDialog(false);
                setName("");
              }}
              style={{
                flex: 1,
                padding: "8px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <hr />

      {nonGuestProfiles.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center" }}>
          No profiles yet. Click the button above to create one!
        </p>
      ) : (
        nonGuestProfiles.map((profile) => (
          <div
            key={profile.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
              padding: 8,
              border:
                activeId === profile.id
                  ? "2px solid #007bff"
                  : "1px solid #ddd",
              borderRadius: 8,
              backgroundColor: activeId === profile.id ? "#f0f8ff" : "white",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeId === profile.id && <span>🟢</span>}
              <span
                style={{
                  fontWeight: activeId === profile.id ? "bold" : "normal",
                }}>
                {profile.name}
              </span>
            </div>

            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={async () => {
                  await chrome.runtime.sendMessage({
                    type: "SWITCH_PROFILE",
                    id: profile.id,
                  });
                  await reload();
                }}
                style={{
                  padding: "4px 8px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                }}>
                Switch
              </button>
              <button
                onClick={async () => {
                  await chrome.runtime.sendMessage({
                    type: "UPDATE_PROFILE",
                    id: profile.id,
                  });
                  await reload();
                }}
                style={{
                  padding: "4px 8px",
                  backgroundColor: "#ffc107",
                  color: "black",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                }}>
                Update
              </button>
              <button
                onClick={async () => {
                  const name = prompt("New name:", profile.name);
                  if (!name || name === profile.name) return;

                  await chrome.runtime.sendMessage({
                    type: "RENAME_PROFILE",
                    id: profile.id,
                    name,
                  });
                  reload();
                }}
                style={{
                  padding: "4px 8px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                }}>
                Rename
              </button>
              <button
                onClick={async () => {
                  if (
                    confirm("Are you sure you want to delete this profile?")
                  ) {
                    await chrome.runtime.sendMessage({
                      type: "DELETE_PROFILE",
                      id: profile.id,
                    });
                    reload();
                  }
                }}
                style={{
                  padding: "4px 8px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                }}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}


/* ===== ./popup/CreateProfile.jsx ===== */

/* EMPTY FILE */


/* ===== ./manifest.js ===== */

import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,

  name: "TabIdentity",

  version: "0.0.1",

  description: "Switch between website identities instantly",

  permissions: ["storage", "cookies", "tabs", "scripting"],

  host_permissions: ["<all_urls>"],

  action: {
    default_popup: "src/popup/index.html",
  },

  background: {
    service_worker: "src/background/background.js",
    type: "module",
  },
});


/* ===== ./main.jsx ===== */

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);


/* ===== ./hooks/useProfiles.js ===== */

import { useEffect, useState } from "react";

import {
  getProfilesByHostname,
  getActiveProfile,
  getRootDomain,
} from "../services/storage";

export function useProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [hostname, setHostname] = useState("");

  async function load() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const url = new URL(tab.url);

    setHostname(url.hostname);

    const domain = getRootDomain(url.hostname);

    const data = await getProfilesByHostname(domain);

    const active = await getActiveProfile(domain);

    setActiveId(active);

    setProfiles(data);
  }

  useEffect(() => {
    load();
  }, []);

  return {
    hostname,
    profiles,
    activeId,
    reload: load,
  };
}


/* ===== ./background/background.js ===== */

import { getTabSnapshot } from "../services/snapshot";
import { removeCookies, setCookies, getCookies } from "../services/cookies";
import { clearStorage, restoreStorage } from "../services/restore";
import {
  setActiveProfile,
  addProfile,
  getProfile,
  updateProfile,
  getRootDomain,
  getGuestProfile,
  removeProfile,
  getProfilesByHostname,
  getActiveProfile,
} from "../services/storage";

// Track tabs that already have guest profile
const tabsWithGuest = new Set();

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when page is fully loaded
  if (changeInfo.status !== "complete") return;

  // Check if this tab already has a guest profile
  if (tabsWithGuest.has(tabId)) return;

  try {
    const url = new URL(tab.url);
    const domain = getRootDomain(url.hostname);

    // Check if guest profile already exists for this domain
    const existingGuest = await getGuestProfile(domain);

    if (existingGuest) {
      // Update existing guest with current state
      const snapshot = await getTabSnapshot(tabId);
      const cookies = await getCookies(tab.url);

      await updateProfile(existingGuest.id, {
        cookies,
        localStorage: snapshot.localStorage,
        sessionStorage: snapshot.sessionStorage,
        url: snapshot.url,
        updatedAt: Date.now(),
      });
    } else {
      // Create new guest profile
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
    }

    // Mark tab as having guest profile
    tabsWithGuest.add(tabId);
  } catch (error) {
    console.error("Error creating guest profile:", error);
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
    removeProfile(message.id).then(() =>
      sendResponse({
        success: true,
      }),
    );

    return true;
  }

  if (message.type === "CLEAR_PROFILE") {
    clearActiveProfile()
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

  const profile = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    domain: getRootDomain(snapshot.hostname),
    origin: snapshot.origin,
    url: snapshot.url,
    cookies,
    localStorage: snapshot.localStorage,
    sessionStorage: snapshot.sessionStorage,
  };

  await addProfile(profile);

  // Set as active profile
  await setActiveProfile(getRootDomain(snapshot.hostname), profile.id);

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

  const snapshot = await getTabSnapshot(tab.id);

  const currentDomain = getRootDomain(snapshot.hostname);

  if (currentDomain !== profile.domain) {
    throw new Error("Invalid domain");
  }

  const currentCookies = await getCookies(tab.url);

  const existingGuest = await getGuestProfile(getRootDomain(snapshot.hostname));

  const guestData = await createGuestProfile();

  if (existingGuest) {
    await updateProfile(existingGuest.id, guestData);
  } else {
    await addProfile(guestData);
  }

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

async function createGuestProfile() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const snapshot = await getTabSnapshot(tab.id);

  const cookies = await getCookies(tab.url);

  return {
    id: crypto.randomUUID(),
    name: "Guest Session",
    guest: true,
    createdAt: Date.now(),
    domain: getRootDomain(snapshot.hostname),
    origin: snapshot.origin,
    url: snapshot.url,
    cookies,
    localStorage: snapshot.localStorage,
    sessionStorage: snapshot.sessionStorage,
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

async function clearActiveProfile() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  const url = new URL(tab.url);
  const domain = getRootDomain(url.hostname);
  const activeId = await getActiveProfile(domain);

  if (activeId) {
    const profile = await getProfile(activeId);

    if (profile && !profile.guest) {
      // Delete the profile
      await removeProfile(activeId);

      // Get or create guest profile to switch back
      let guestProfile = await getGuestProfile(domain);

      if (!guestProfile) {
        // Create empty guest profile
        guestProfile = {
          id: crypto.randomUUID(),
          name: "Guest Session",
          guest: true,
          createdAt: Date.now(),
          domain,
          origin: url.origin,
          url: tab.url,
          cookies: [],
          localStorage: {},
          sessionStorage: {},
        };
        await addProfile(guestProfile);
      }

      // Switch to guest profile (clear data)
      const currentCookies = await getCookies(tab.url);
      await removeCookies(currentCookies);
      await clearStorage(tab.id);
      await setActiveProfile(domain, guestProfile.id);

      // Reload the tab to apply changes
      await chrome.tabs.reload(tab.id);
    }
  }

  return { success: true };
}
