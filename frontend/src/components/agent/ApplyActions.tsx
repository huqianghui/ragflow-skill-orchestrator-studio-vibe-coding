import { Button, Space, message } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';

interface ApplyActionsProps {
  code: string;
  onApply?: () => void;
  showApply?: boolean;
}

export default function ApplyActions({ code, onApply, showApply }: ApplyActionsProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      message.success('Copied');
    } catch {
      message.error('Copy failed');
    }
  };

  return (
    <Space size={4} style={{ marginTop: 4 }}>
      {showApply && onApply && (
        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={onApply}>
          Apply
        </Button>
      )}
      <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
        Copy
      </Button>
    </Space>
  );
}
