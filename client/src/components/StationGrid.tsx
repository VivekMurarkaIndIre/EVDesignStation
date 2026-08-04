import type { Station } from "@ev/shared";
import { Button, Card, List, Tag, Typography } from "antd";

const STATIONS_PAGE_SIZE = 8;

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
    <List
      dataSource={stations}
      grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 4 }}
      pagination={stations.length > STATIONS_PAGE_SIZE ? { pageSize: STATIONS_PAGE_SIZE, showSizeChanger: false } : false}
      renderItem={(station) => (
        <List.Item>
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
        </List.Item>
      )}
    />
  );
}
