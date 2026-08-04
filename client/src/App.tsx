import { ConfigProvider, Layout, Typography } from "antd";

function App() {
  return (
    <ConfigProvider>
      <Layout style={{ minHeight: "100vh", padding: 24 }}>
        <Typography.Title level={2}>EV Charging Session Tracker</Typography.Title>
        <Typography.Text type="secondary">Station list coming in Phase 5.</Typography.Text>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
