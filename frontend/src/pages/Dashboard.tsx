import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import {
  DatabaseOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';
import { skillsApi } from '../services/api';

const { Title } = Typography;

export default function Dashboard() {
  const [skillCount, setSkillCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    skillsApi.list(1, 1).then((data) => setSkillCount(data.total)).catch(() => {});
  }, []);

  return (
    <div>
      <Title level={3}>Dashboard</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Skills" value={skillCount ?? '-'} prefix={<ExperimentOutlined />} />
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
