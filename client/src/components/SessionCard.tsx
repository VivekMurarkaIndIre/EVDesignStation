import type { Session, Station } from "@ev/shared";
import { Alert, Button, Card, Space, Tag, Typography } from "antd";
import { CostBreakdown } from "./CostBreakdown";
import { ElapsedTime, formatDuration } from "./ElapsedTime";

// Below this, the "time left" line escalates into a visible warning banner.
const LOW_BALANCE_WARNING_SECONDS = 600;

const STOP_REASON_LABEL: Record<Exclude<Session["stopReason"], "manual" | null>, string> = {
  insufficient_funds: "Stopped automatically — balance depleted",
  duration_elapsed: "Stopped automatically — time limit reached",
};

export function SessionCard({
  session,
  station,
  onStop,
  stopping,
}: {
  session: Session;
  station: Station | undefined;
  onStop: (sessionId: string) => void;
  stopping: boolean;
}) {
  const isActive = session.endTime === null;
  const estimate = session.chargeEstimate;

  return (
    <Card
      title={station?.name ?? session.stationId}
      extra={<Tag color={isActive ? "processing" : "default"}>{isActive ? "Active" : "Stopped"}</Tag>}
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Typography.Text type="secondary">Started {new Date(session.startTime).toLocaleString()}</Typography.Text>

        {isActive ? (
          <>
            <Typography.Title level={4} style={{ margin: 0 }}>
              <ElapsedTime since={session.startTime} />
            </Typography.Title>

            {estimate &&
              (estimate.secondsRemaining <= LOW_BALANCE_WARNING_SECONDS ? (
                <Alert
                  type={estimate.secondsRemaining <= 0 ? "error" : "warning"}
                  showIcon
                  message={
                    estimate.secondsRemaining <= 0
                      ? "Balance depleted — session is stopping automatically."
                      : `Balance running low — about ${formatDuration(estimate.secondsRemaining * 1000)} of charging left.`
                  }
                />
              ) : (
                <Typography.Text type="secondary">
                  ~{formatDuration(estimate.secondsRemaining * 1000)} of charging left on current balance
                </Typography.Text>
              ))}

            <Button type="primary" danger loading={stopping} onClick={() => onStop(session.id)}>
              Stop Session
            </Button>
          </>
        ) : (
          <>
            {session.stopReason && session.stopReason !== "manual" && (
              <Tag color="orange">{STOP_REASON_LABEL[session.stopReason]}</Tag>
            )}
            {session.costBreakdown && <CostBreakdown breakdown={session.costBreakdown} />}
          </>
        )}
      </Space>
    </Card>
  );
}
