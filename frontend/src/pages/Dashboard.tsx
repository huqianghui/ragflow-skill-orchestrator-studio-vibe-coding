import { Card, Col, Row, Statistic, Typography } from 'antd';
import {
  DatabaseOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

export default function Dashboard() {
  return (
    <div>
      <Title level={3}>Dashboard</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Skills" value={0} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Pipelines" value={0} prefix={<NodeIndexOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Data Sources" value={0} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Recent Runs" value={0} prefix={<HistoryOutlined />} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
