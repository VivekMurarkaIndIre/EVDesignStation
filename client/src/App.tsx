import { MenuOutlined, ThunderboltFilled, WalletOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Dropdown, Grid, Layout, Menu, Popover, Space, Tooltip, Typography } from "antd";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import { Dashboard } from "./pages/Dashboard";
import { LoadFunds } from "./pages/LoadFunds";
import { Transactions } from "./pages/Transactions";

const NAV_LINKS = [
  { key: "/", label: "Dashboard" },
  { key: "/transactions", label: "Transactions" },
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isCompact = !screens.md;
  const { wallet, loading: walletLoading, refresh: refreshWallet } = useWallet();
  const balance = wallet?.balance ?? 0;
  const selectedKeys = NAV_LINKS.some((item) => item.key === location.pathname) ? [location.pathname] : [];

  const navMenuItems = NAV_LINKS.map((item) =>
    isCompact
      ? { key: item.key, label: item.label, onClick: () => navigate(item.key) }
      : { key: item.key, label: <Link to={item.key}>{item.label}</Link> },
  );

  return (
    <ConfigProvider>
      <Layout style={{ minHeight: "100vh" }}>
        <Layout.Header style={{ display: "flex", alignItems: "center", gap: isCompact ? 12 : 24, padding: "0 16px" }}>
          <Typography.Text
            strong
            style={{
              color: "white",
              fontSize: isCompact ? 14 : 16,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <ThunderboltFilled style={{ color: "#ffd666", marginRight: 8 }} />
            {isCompact ? "EV Tracker" : "EV Charging Session Tracker"}
          </Typography.Text>

          <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: isCompact ? "flex-end" : "flex-start" }}>
            {isCompact ? (
              <Dropdown menu={{ items: navMenuItems, selectedKeys }} trigger={["click"]}>
                <Button
                  type="text"
                  icon={<MenuOutlined style={{ color: "white" }} />}
                  aria-label="Open navigation menu"
                />
              </Dropdown>
            ) : (
              <Menu
                key={selectedKeys[0] ?? "none"}
                theme="dark"
                mode="horizontal"
                selectedKeys={selectedKeys}
                items={navMenuItems}
                style={{ width: "100%" }}
              />
            )}
          </div>

          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <Tooltip title="This page will allow you to add money — coming in the next phase.">
                <span>
                  <Button disabled>Refill</Button>
                </span>
              </Tooltip>
            }
          >
            <Space style={{ cursor: "pointer" }}>
              <Tooltip title="Wallet">
                <WalletOutlined style={{ color: "white", fontSize: 18 }} />
              </Tooltip>
              <Typography.Text
                strong
                style={{ color: !walletLoading && balance < 0 ? "#ff7875" : "#95de64", fontSize: 16 }}
              >
                ${balance.toFixed(2)}
              </Typography.Text>
            </Space>
          </Popover>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<Dashboard refreshWallet={refreshWallet} />} />
            <Route
              path="/transactions"
              element={<Transactions wallet={wallet} loading={walletLoading} />}
            />
            <Route path="/load-funds" element={<LoadFunds />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
