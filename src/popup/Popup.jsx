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
