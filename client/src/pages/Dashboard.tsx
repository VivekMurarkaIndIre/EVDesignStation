import { Alert, Carousel, Divider, Empty, Grid, List, Segmented, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SessionCard } from "../components/SessionCard";
import { StationGrid } from "../components/StationGrid";
import { StationMap } from "../components/StationMap";
import { useMySessions } from "../hooks/useMySessions";
import { useStations } from "../hooks/useStations";

const STOPPED_SESSIONS_PAGE_SIZE = 6;

// How many ~320px-wide session cards comfortably fit side by side at each
// breakpoint's content width. The carousel only slides when there are more
// active sessions than this — it's not a one-card-per-slide carousel.
function useActiveSessionsPerView(): number {
  const screens = Grid.useBreakpoint();
  if (screens.xxl) return 4;
  if (screens.xl) return 3;
  if (screens.lg) return 3;
  if (screens.md) return 2;
  return 1;
}

export function Dashboard({ refreshWallet }: { refreshWallet: () => void }) {
  const navigate = useNavigate();
  const { stations, loading: stationsLoading, error: stationsError, refresh: refreshStations } = useStations();
  const { sessions, start, stop, pendingStationIds, pendingStopIds, error: sessionError } = useMySessions();
  const perView = useActiveSessionsPerView();
  const [stationView, setStationView] = useState<"Grid" | "Map">("Grid");

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
  const slidesToShow = Math.min(perView, Math.max(activeSessions.length, 1));

  return (
    <>
      {errorMessage && <Alert type="error" message={errorMessage} showIcon closable style={{ marginBottom: 16 }} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Stations
        </Typography.Title>
        <Segmented
          options={["Grid", "Map"]}
          value={stationView}
          onChange={(value) => setStationView(value as "Grid" | "Map")}
        />
      </div>
      {!stationsLoading &&
        (stationView === "Grid" ? (
          <StationGrid stations={stations} onStart={handleStart} pendingStationIds={pendingStationIds} />
        ) : (
          <StationMap stations={stations} onStart={handleStart} pendingStationIds={pendingStationIds} />
        ))}

      <Divider />

      <Typography.Title level={4}>My Sessions</Typography.Title>
      {sessions.length === 0 ? (
        <Empty description="No sessions yet — start one above." />
      ) : (
        <>
          <Typography.Title level={5}>Active</Typography.Title>
          {activeSessions.length === 0 ? (
            <Typography.Text type="secondary">No active sessions.</Typography.Text>
          ) : (
            <Carousel
              dots={activeSessions.length > perView}
              infinite={false}
              slidesToShow={slidesToShow}
              slidesToScroll={perView}
            >
              {activeSessions.map((session) => (
                <div key={session.id} style={{ paddingRight: 16 }}>
                  <SessionCard
                    session={session}
                    station={stationsById.get(session.stationId)}
                    onStop={handleStop}
                    stopping={pendingStopIds.has(session.id)}
                  />
                </div>
              ))}
            </Carousel>
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
