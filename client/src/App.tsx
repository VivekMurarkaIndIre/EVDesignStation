import { ConfigProvider, Layout, Menu, Space, Typography } from "antd";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useWallet } from "./hooks/useWallet";
import { Dashboard } from "./pages/Dashboard";
import { LoadFunds } from "./pages/LoadFunds";
import { Transactions } from "./pages/Transactions";

const NAV_ITEMS = [
  { key: "/", label: <Link to="/">Dashboard</Link> },
  { key: "/transactions", label: <Link to="/transactions">Transactions</Link> },
];

function App() {
  const location = useLocation();
  const { wallet, loading: walletLoading, refresh: refreshWallet } = useWallet();
  const balance = wallet?.balance ?? 0;
  const selectedKeys = NAV_ITEMS.some((item) => item.key === location.pathname) ? [location.pathname] : [];

  return (
    <ConfigProvider>
      <Layout style={{ minHeight: "100vh" }}>
        <Layout.Header style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Typography.Text strong style={{ color: "white", fontSize: 16, whiteSpace: "nowrap" }}>
            EV Charging Session Tracker
          </Typography.Text>
          <Menu
            key={selectedKeys[0] ?? "none"}
            theme="dark"
            mode="horizontal"
            selectedKeys={selectedKeys}
            items={NAV_ITEMS}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Space>
            <Typography.Text style={{ color: "white" }}>Wallet:</Typography.Text>
            <Typography.Text
              strong
              style={{ color: !walletLoading && balance < 0 ? "#ff7875" : "#95de64", fontSize: 16 }}
            >
              ${balance.toFixed(2)}
            </Typography.Text>
          </Space>
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
