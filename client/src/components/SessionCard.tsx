import type { Session, Station } from "@ev/shared";
import { Button, Card, Space, Tag, Typography } from "antd";
import { CostBreakdown } from "./CostBreakdown";
import { ElapsedTime } from "./ElapsedTime";

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
            <Button type="primary" danger loading={stopping} onClick={() => onStop(session.id)}>
              Stop Session
            </Button>
          </>
        ) : (
          session.costBreakdown && <CostBreakdown breakdown={session.costBreakdown} />
        )}
      </Space>
    </Card>
  );
}
