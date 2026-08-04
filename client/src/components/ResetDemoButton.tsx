import { ReloadOutlined } from "@ant-design/icons";
import { Button, message, Popconfirm, Tooltip } from "antd";
import { useState } from "react";
import { resetDemoData } from "../api/client";
import { MY_SESSIONS_STORAGE_KEY } from "../hooks/useMySessions";

/**
 * Demo/testing convenience, not a real product feature: wipes the shared
 * server-side state (wallet, sessions, station occupancy) back to a fresh
 * seed, so anyone testing the app — or the deployed demo — can start over
 * without restarting the server. A full page reload afterwards is the
 * simplest way to guarantee every hook re-fetches the reset state instead
 * of threading a "refresh everything" callback through each one.
 */
export function ResetDemoButton() {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDemoData();
      localStorage.removeItem(MY_SESSIONS_STORAGE_KEY);
      window.location.reload();
    } catch {
      setResetting(false);
      message.error("Couldn't reset demo data — try again.");
    }
  };

  return (
    <Popconfirm
      title="Reset demo data?"
      description="This resets the wallet to $10 and clears every session for everyone using this demo. It can't be undone."
      okText="Reset"
      okButtonProps={{ danger: true }}
      onConfirm={handleReset}
    >
      <Tooltip title="Reset demo data">
        <Button
          type="text"
          icon={<ReloadOutlined style={{ color: "white" }} />}
          loading={resetting}
          aria-label="Reset demo data"
        />
      </Tooltip>
    </Popconfirm>
  );
}
