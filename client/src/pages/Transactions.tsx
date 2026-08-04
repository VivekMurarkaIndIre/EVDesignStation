import type { Wallet, WalletTransaction } from "@ev/shared";
import { Empty, Table, Tag, Typography, type TableProps } from "antd";

const columns: TableProps<WalletTransaction>["columns"] = [
  {
    title: "Date",
    dataIndex: "createdAt",
    key: "createdAt",
    render: (value: string) => new Date(value).toLocaleString(),
  },
  {
    title: "Type",
    dataIndex: "type",
    key: "type",
    render: (type: WalletTransaction["type"]) => (
      <Tag color={type === "load" ? "success" : "error"}>{type === "load" ? "Load" : "Deduction"}</Tag>
    ),
  },
  {
    title: "Amount",
    dataIndex: "amount",
    key: "amount",
    render: (amount: number, record) => (
      <span style={{ color: record.type === "load" ? "#389e0d" : "#cf1322" }}>
        {record.type === "load" ? "+" : "-"}${amount.toFixed(2)}
      </span>
    ),
  },
  {
    title: "Balance After",
    dataIndex: "balanceAfter",
    key: "balanceAfter",
    render: (value: number) => `$${value.toFixed(2)}`,
  },
  {
    title: "Note",
    dataIndex: "note",
    key: "note",
  },
];

export function Transactions({ wallet, loading }: { wallet: Wallet | null; loading: boolean }) {
  const transactions = wallet?.transactions ?? [];
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <>
      <Typography.Title level={4}>Transactions</Typography.Title>
      {sorted.length === 0 ? (
        <Empty description="No transactions yet." />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={sorted} loading={loading} pagination={{ pageSize: 10 }} />
      )}
    </>
  );
}
