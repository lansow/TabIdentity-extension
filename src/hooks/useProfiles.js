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
