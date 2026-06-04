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
