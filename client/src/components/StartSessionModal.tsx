import type { RateSchedule, Station, Wallet } from "@ev/shared";
import { Alert, Modal, Select, Space, Typography } from "antd";
import { useState } from "react";

export const DURATION_OPTIONS: { label: string; value: number | "none" }[] = [
  { label: "No limit", value: "none" },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hr", value: 120 },
];

/** Mirrors server pricingService.currentRatePerKwh — same UTC-hour rule, so the estimate here matches what actually gets billed. */
function currentRatePerKwh(schedule: RateSchedule, date: Date): number {
  const hour = date.getUTCHours();
  const isPeak = hour >= schedule.peakStartHour && hour < schedule.peakEndHour;
  return isPeak ? schedule.peakRatePerKwh : schedule.offPeakRatePerKwh;
}

export function StartSessionModal({
  station,
  wallet,
  rateSchedule,
  confirming,
  onCancel,
  onConfirm,
}: {
  station: Station | null;
  wallet: Wallet | null;
  rateSchedule: RateSchedule | null;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: (stationId: string, autoStopAfterMinutes?: number) => void;
}) {
  const [durationMinutes, setDurationMinutes] = useState<number | "none">("none");

  const estimatedCost =
    station && rateSchedule && durationMinutes !== "none"
      ? Math.round(station.chargingSpeedKw * currentRatePerKwh(rateSchedule, new Date()) * (durationMinutes / 60) * 100) /
        100
      : null;
  const balance = wallet?.balance ?? 0;
  const insufficientForDuration = estimatedCost !== null && estimatedCost > balance;

  return (
    <Modal
      title={station ? `Start session at ${station.name}` : "Start session"}
      open={station !== null}
      onCancel={onCancel}
      afterClose={() => setDurationMinutes("none")}
      onOk={() => station && onConfirm(station.id, durationMinutes === "none" ? undefined : durationMinutes)}
      confirmLoading={confirming}
      okText="Start Session"
    >
      {station && (
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Typography.Text type="secondary">
            {station.chargingSpeedKw} kW · Wallet balance: ${balance.toFixed(2)}
          </Typography.Text>

          <div>
            <Typography.Text strong>Charge for</Typography.Text>
            <Select
              value={durationMinutes}
              onChange={setDurationMinutes}
              options={DURATION_OPTIONS}
              style={{ width: "100%", marginTop: 4 }}
            />
          </div>

          {estimatedCost !== null && (
            <Typography.Text type="secondary">
              Estimated cost at the current rate: ${estimatedCost.toFixed(2)}
            </Typography.Text>
          )}

          {insufficientForDuration && (
            <Alert
              type="warning"
              showIcon
              message="Not enough balance for this duration"
              description={`You have $${balance.toFixed(2)}, but this would cost about $${estimatedCost!.toFixed(2)}. You can still start — the session will stop automatically once your balance runs out.`}
            />
          )}
        </Space>
      )}
    </Modal>
  );
}
