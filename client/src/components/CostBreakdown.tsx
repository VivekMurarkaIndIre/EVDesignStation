import type { CostBreakdown as CostBreakdownType } from "@ev/shared";
import { Col, Divider, Row, Statistic, Typography } from "antd";

export function CostBreakdown({ breakdown }: { breakdown: CostBreakdownType }) {
  return (
    <div>
      <Row gutter={16}>
        <Col span={12}>
          <Typography.Text strong style={{ color: "#d46b08" }}>
            Peak
          </Typography.Text>
          <Statistic value={breakdown.peakKwh} suffix="kWh" precision={3} valueStyle={{ fontSize: 18 }} />
          <Statistic value={breakdown.peakCost} prefix="$" precision={2} valueStyle={{ fontSize: 18 }} />
        </Col>
        <Col span={12}>
          <Typography.Text strong style={{ color: "#1677ff" }}>
            Off-Peak
          </Typography.Text>
          <Statistic value={breakdown.offPeakKwh} suffix="kWh" precision={3} valueStyle={{ fontSize: 18 }} />
          <Statistic value={breakdown.offPeakCost} prefix="$" precision={2} valueStyle={{ fontSize: 18 }} />
        </Col>
      </Row>
      <Divider style={{ margin: "12px 0" }} />
      <Row justify="space-between">
        <Typography.Text strong>Total</Typography.Text>
        <Typography.Text strong>
          {breakdown.totalKwh} kWh · ${breakdown.totalCost.toFixed(2)}
        </Typography.Text>
      </Row>
    </div>
  );
}
