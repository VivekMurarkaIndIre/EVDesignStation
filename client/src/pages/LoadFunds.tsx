import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export function LoadFunds() {
  return (
    <Result
      status="info"
      title="Load Funds"
      subTitle="Payment integration is under construction — check back soon."
      extra={
        <Link to="/">
          <Button type="primary">Back to Dashboard</Button>
        </Link>
      }
    />
  );
}
