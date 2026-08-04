import { Alert, ConfigProvider, Divider, Empty, Layout, Space, Typography } from "antd";
import { SessionCard } from "./components/SessionCard";
import { StationGrid } from "./components/StationGrid";
import { useMySessions } from "./hooks/useMySessions";
import { useStations } from "./hooks/useStations";

function App() {
  const { stations, loading: stationsLoading, error: stationsError, refresh: refreshStations } = useStations();
  const { sessions, start, stop, pendingStationIds, pendingStopIds, error: sessionError } = useMySessions();

  const handleStart = async (stationId: string) => {
    await start(stationId);
    refreshStations();
  };

  const handleStop = async (sessionId: string) => {
    await stop(sessionId);
    refreshStations();
  };

  const stationsById = new Map(stations.map((station) => [station.id, station]));
  const errorMessage = sessionError ?? stationsError;

  return (
    <ConfigProvider>
      <Layout style={{ minHeight: "100vh", padding: 24 }}>
        <Typography.Title level={2}>EV Charging Session Tracker</Typography.Title>

        {errorMessage && (
          <Alert type="error" message={errorMessage} showIcon closable style={{ marginBottom: 16 }} />
        )}

        <Typography.Title level={4}>Stations</Typography.Title>
        {!stationsLoading && (
          <StationGrid stations={stations} onStart={handleStart} pendingStationIds={pendingStationIds} />
        )}

        <Divider />

        <Typography.Title level={4}>My Sessions</Typography.Title>
        {sessions.length === 0 ? (
          <Empty description="No sessions yet — start one above." />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                station={stationsById.get(session.stationId)}
                onStop={handleStop}
                stopping={pendingStopIds.has(session.id)}
              />
            ))}
          </Space>
        )}
      </Layout>
    </ConfigProvider>
  );
}

export default App;
