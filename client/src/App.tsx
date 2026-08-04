import { ConfigProvider, Layout, Typography } from "antd";
import { SHARED_PACKAGE_READY } from "@ev/shared";

function App() {
  return (
    <ConfigProvider>
      <Layout style={{ minHeight: "100vh", padding: 24 }}>
        <Typography.Title level={2}>EV Charging Session Tracker</Typography.Title>
        <Typography.Text type="secondary">
          Shared package wired: {String(SHARED_PACKAGE_READY)}
        </Typography.Text>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
