import { Typography } from 'antd';
import { useParams } from 'react-router-dom';

const { Title } = Typography;

export default function PipelineEditor() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <Title level={3}>Pipeline Editor</Title>
      <p>Pipeline ID: {id}</p>
      <div
        style={{
          height: 500,
          border: '2px dashed #d9d9d9',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 16,
        }}
      >
        React Flow canvas will be implemented in the pipeline-orchestration change
      </div>
    </div>
  );
}
