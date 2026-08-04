import type { Station } from "@ev/shared";
import { Button, Card, Col, Row, Tag, Typography } from "antd";

export function StationGrid({
  stations,
  onStart,
  pendingStationIds,
}: {
  stations: Station[];
  onStart: (stationId: string) => void;
  pendingStationIds: Set<string>;
}) {
  return (
    <Row gutter={[16, 16]}>
      {stations.map((station) => (
        <Col key={station.id} xs={24} sm={12} md={8} lg={6}>
          <Card
            title={station.name}
            extra={<Tag color={station.status === "available" ? "success" : "warning"}>{station.status}</Tag>}
          >
            <Typography.Text type="secondary">{station.location}</Typography.Text>
            <br />
            <Typography.Text>{station.chargingSpeedKw} kW</Typography.Text>
            <br />
            <Button
              type="primary"
              style={{ marginTop: 12 }}
              disabled={station.status !== "available"}
              loading={pendingStationIds.has(station.id)}
              onClick={() => onStart(station.id)}
              block
            >
              Start Session
            </Button>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
