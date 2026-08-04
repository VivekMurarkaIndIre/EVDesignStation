import type { Wallet } from "@ev/shared";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Carousel, Divider, Grid, List, Segmented, Space, Tooltip, Tour, Typography } from "antd";
import type { TourProps } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SessionCard } from "../components/SessionCard";
import { StartSessionModal } from "../components/StartSessionModal";
import { StationGrid } from "../components/StationGrid";
import { StationMap } from "../components/StationMap";
import { useMySessions } from "../hooks/useMySessions";
import { useRateSchedule } from "../hooks/useRateSchedule";
import { useStations } from "../hooks/useStations";

const STOPPED_SESSIONS_PAGE_SIZE = 6;
const WALKTHROUGH_SEEN_STORAGE_KEY = "ev-walkthrough-seen";

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

// Targets by DOM id rather than refs so the tour can point at elements
// owned by App's header (nav, reset button) without threading refs down
// through the component tree. A step's target returning undefined makes
// antd Tour render that step as a centered dialog instead of a spotlight
// — used for History, which doesn't exist in the DOM until a session has
// actually been stopped once.
// antd's type for `target` wants a function returning exactly HTMLElement,
// but getElementById returns HTMLElement | null. The runtime behavior
// already handles null correctly (renders the step centered instead of
// spotlit, which is exactly what we want for History before it exists) —
// only the compile-time type is overly strict, so this cast is safe.
function tourTarget(id: string): () => HTMLElement {
  return () => document.getElementById(id) as HTMLElement;
}

const WALKTHROUGH_STEPS: TourProps["steps"] = [
  {
    title: "Grid or map",
    description: "Switch between a card grid and an interactive map of every charging station.",
    target: tourTarget("tour-station-view-toggle"),
  },
  {
    title: "Active sessions",
    description: "Sessions you start stay pinned here while they're running, with a live running cost.",
    target: tourTarget("tour-active-sessions"),
  },
  {
    title: "History",
    description: "Once you stop a session, it moves down into History, with its full peak/off-peak cost breakdown.",
    target: tourTarget("tour-history"),
  },
  {
    title: "Transactions",
    description: "Every wallet top-up and charge deduction shows up here, in order, with a running balance.",
    target: tourTarget("tour-nav-transactions"),
  },
  {
    title: "Start fresh anytime",
    description:
      "Testing things out? This resets the wallet to $10 and clears every session — a clean slate whenever you want one.",
    target: tourTarget("tour-reset-button"),
  },
];

export function Dashboard({ wallet, refreshWallet }: { wallet: Wallet | null; refreshWallet: () => void }) {
  const navigate = useNavigate();
  const { stations, loading: stationsLoading, error: stationsError, refresh: refreshStations } = useStations();
  const { sessions, start, stop, pendingStationIds, pendingStopIds, error: sessionError } = useMySessions();
  const rateSchedule = useRateSchedule();
  const perView = useActiveSessionsPerView();
  const [stationView, setStationView] = useState<"Grid" | "Map">("Grid");
  const [startModalStationId, setStartModalStationId] = useState<string | null>(null);
  const [confirmingStart, setConfirmingStart] = useState(false);
  // Lazy initializer (not an effect): reads localStorage exactly once as
  // part of the first render, so the tour is part of the initial paint
  // rather than popping in after a timer. An effect-plus-setTimeout here
  // would race React 18 StrictMode's double-invoked effects in dev — the
  // first mount's cleanup cancels the timer before it fires, and the
  // second mount sees the flag the first one already wrote and skips
  // rescheduling, so the tour silently never opens.
  const [tourOpen, setTourOpen] = useState(() => !localStorage.getItem(WALKTHROUGH_SEEN_STORAGE_KEY));

  useEffect(() => {
    localStorage.setItem(WALKTHROUGH_SEEN_STORAGE_KEY, "true");
  }, []);

  const handleConfirmStart = async (stationId: string, autoStopAfterMinutes?: number) => {
    setConfirmingStart(true);
    const result = await start(stationId, autoStopAfterMinutes);
    setConfirmingStart(false);
    setStartModalStationId(null);
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
  const startModalStation = startModalStationId ? (stationsById.get(startModalStationId) ?? null) : null;

  return (
    <>
      {errorMessage && <Alert type="error" message={errorMessage} showIcon closable style={{ marginBottom: 16 }} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Stations
        </Typography.Title>
        <Space>
          <Tooltip title="Show walkthrough">
            <Button
              icon={<QuestionCircleOutlined />}
              onClick={() => setTourOpen(true)}
              aria-label="Show walkthrough"
            />
          </Tooltip>
          <Segmented
            id="tour-station-view-toggle"
            options={["Grid", "Map"]}
            value={stationView}
            onChange={(value) => setStationView(value as "Grid" | "Map")}
          />
        </Space>
      </div>
      {!stationsLoading &&
        (stationView === "Grid" ? (
          <StationGrid stations={stations} onStart={setStartModalStationId} pendingStationIds={pendingStationIds} />
        ) : (
          <StationMap stations={stations} onStart={setStartModalStationId} pendingStationIds={pendingStationIds} />
        ))}

      <StartSessionModal
        station={startModalStation}
        wallet={wallet}
        rateSchedule={rateSchedule}
        confirming={confirmingStart}
        onCancel={() => setStartModalStationId(null)}
        onConfirm={handleConfirmStart}
      />

      <Tour open={tourOpen} onClose={() => setTourOpen(false)} steps={WALKTHROUGH_STEPS} />

      <Divider />

      <Typography.Title level={4}>My Sessions</Typography.Title>
      <Typography.Title level={5} id="tour-active-sessions">
        Active
      </Typography.Title>
      {activeSessions.length === 0 ? (
        <Typography.Text type="secondary">
          {sessions.length === 0 ? "No sessions yet — start one above." : "No active sessions."}
        </Typography.Text>
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
          <Typography.Title level={5} id="tour-history">
            History
          </Typography.Title>
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
  );
}
