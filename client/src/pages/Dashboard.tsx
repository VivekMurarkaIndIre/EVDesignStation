import { Alert, Carousel, Divider, Empty, List, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { SessionCard } from "../components/SessionCard";
import { StationGrid } from "../components/StationGrid";
import { useMySessions } from "../hooks/useMySessions";
import { useStations } from "../hooks/useStations";

const STOPPED_SESSIONS_PAGE_SIZE = 6;

export function Dashboard({ refreshWallet }: { refreshWallet: () => void }) {
  const navigate = useNavigate();
  const { stations, loading: stationsLoading, error: stationsError, refresh: refreshStations } = useStations();
  const { sessions, start, stop, pendingStationIds, pendingStopIds, error: sessionError } = useMySessions();

  const handleStart = async (stationId: string) => {
    const result = await start(stationId);
    if (result.status === 402) {
      navigate("/load-funds");
      return;
    }
    refreshStations();
    refreshWallet();
  };

  const handleStop = async (sessionId: string) => {
    await stop(sessionId);
    refreshStations();
    refreshWallet();
  };

  const stationsById = new Map(stations.map((station) => [station.id, station]));
  const errorMessage = sessionError ?? stationsError;
  const activeSessions = sessions.filter((session) => session.endTime === null);
  const stoppedSessions = sessions.filter((session) => session.endTime !== null);

  return (
    <>
      {errorMessage && <Alert type="error" message={errorMessage} showIcon closable style={{ marginBottom: 16 }} />}

      <Typography.Title level={4}>Stations</Typography.Title>
      {!stationsLoading && (
        <StationGrid stations={stations} onStart={handleStart} pendingStationIds={pendingStationIds} />
      )}

      <Divider />

      <Typography.Title level={4}>My Sessions</Typography.Title>
      {sessions.length === 0 ? (
        <Empty description="No sessions yet — start one above." />
      ) : (
        <>
          <Typography.Title level={5}>Active</Typography.Title>
          {activeSessions.length === 0 ? (
            <Typography.Text type="secondary">No active sessions.</Typography.Text>
          ) : activeSessions.length === 1 ? (
            <div style={{ maxWidth: 480 }}>
              <SessionCard
                session={activeSessions[0]}
                station={stationsById.get(activeSessions[0].stationId)}
                onStop={handleStop}
                stopping={pendingStopIds.has(activeSessions[0].id)}
              />
            </div>
          ) : (
            <div style={{ maxWidth: 560 }}>
              <Carousel arrows dots infinite={false} style={{ padding: "0 40px 32px" }}>
                {activeSessions.map((session) => (
                  <div key={session.id}>
                    <SessionCard
                      session={session}
                      station={stationsById.get(session.stationId)}
                      onStop={handleStop}
                      stopping={pendingStopIds.has(session.id)}
                    />
                  </div>
                ))}
              </Carousel>
            </div>
          )}

          {stoppedSessions.length > 0 && (
            <>
              <Divider />
              <Typography.Title level={5}>History</Typography.Title>
              <List
                dataSource={stoppedSessions}
                grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
                pagination={{ pageSize: STOPPED_SESSIONS_PAGE_SIZE, showSizeChanger: false }}
                renderItem={(session) => (
                  <List.Item>
                    <SessionCard
                      session={session}
                      station={stationsById.get(session.stationId)}
                      onStop={handleStop}
                      stopping={false}
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
