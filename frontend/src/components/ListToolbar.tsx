import { Input, Space } from 'antd';

interface ListToolbarProps {
  searchPlaceholder?: string;
  onSearch: (value: string) => void;
  onSearchChange?: (value: string) => void;
  filters?: React.ReactNode;
  extra?: React.ReactNode;
  searchWidth?: number;
}

export default function ListToolbar({
  searchPlaceholder = 'Search...',
  onSearch,
  onSearchChange,
  filters,
  extra,
  searchWidth = 300,
}: ListToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <Space wrap>
        <Input.Search
          placeholder={searchPlaceholder}
          allowClear
          onSearch={onSearch}
          onChange={(e) => {
            if (!e.target.value && onSearchChange) {
              onSearchChange('');
            } else if (!e.target.value) {
              onSearch('');
            }
          }}
          style={{ width: searchWidth }}
        />
        {filters}
      </Space>
      {extra && <div>{extra}</div>}
    </div>
  );
}
