import { Checkbox, Form, Input, InputNumber, Select, Slider, Switch } from 'antd';
interface SchemaProperty {
  type: string;
  enum?: string[];
  items?: { type: string };
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
}

interface ConfigSchema {
  type: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

interface Props {
  schema: ConfigSchema;
}

// Known checkbox options for array-of-string fields
const KNOWN_OPTIONS: Record<string, string[]> = {
  entity_categories: [
    'Person', 'Location', 'Organization', 'DateTime', 'Quantity',
    'URL', 'Email', 'PersonType', 'Event', 'Product', 'Skill',
    'Address', 'Phone Number', 'IP Address',
  ],
  pii_categories: [
    'Name', 'IDNumber', 'PhoneNumber', 'Email', 'Address',
    'CreditCard', 'BankAccount', 'Passport', 'DriversLicense',
  ],
  features: ['description', 'tags', 'objects'],
  languages: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'ar'],
};

export default function ConfigSchemaForm({ schema }: Props) {
  if (!schema?.properties) return null;

  const properties = schema.properties;
  const requiredFields = schema.required || [];

  return (
    <>
      {Object.entries(properties).map(([key, prop]) => {
        const isRequired = requiredFields.includes(key);
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        if (prop.type === 'boolean') {
          return (
            <Form.Item key={key} name={key} label={label} valuePropName="checked"
              tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
              <Switch />
            </Form.Item>
          );
        }

        if (prop.type === 'string' && prop.enum) {
          return (
            <Form.Item key={key} name={key} label={label}
              tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
              <Select options={prop.enum.map((v) => ({ label: v, value: v }))} />
            </Form.Item>
          );
        }

        if (prop.type === 'string') {
          const isLong = key.includes('prompt') || key.includes('template');
          return (
            <Form.Item key={key} name={key} label={label}
              tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
              {isLong ? <Input.TextArea rows={3} /> : <Input />}
            </Form.Item>
          );
        }

        if (prop.type === 'integer' || prop.type === 'number') {
          const hasRange = prop.minimum !== undefined && prop.maximum !== undefined;
          if (hasRange) {
            return (
              <Form.Item key={key} name={key} label={label}
                tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
                <Slider min={prop.minimum} max={prop.maximum}
                  step={prop.type === 'integer' ? 1 : 0.1} />
              </Form.Item>
            );
          }
          return (
            <Form.Item key={key} name={key} label={label}
              tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
              <InputNumber style={{ width: '100%' }}
                step={prop.type === 'integer' ? 1 : 0.1} />
            </Form.Item>
          );
        }

        if (prop.type === 'array' && prop.items?.type === 'string') {
          const knownOpts = KNOWN_OPTIONS[key];
          if (knownOpts) {
            return (
              <Form.Item key={key} name={key} label={label}
                tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
                <Checkbox.Group options={knownOpts} />
              </Form.Item>
            );
          }
          return (
            <Form.Item key={key} name={key} label={label}
              tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
              <Select mode="tags" placeholder="Type and press Enter" />
            </Form.Item>
          );
        }

        // Fallback: JSON text area
        return (
          <Form.Item key={key} name={key} label={label}
            tooltip={prop.description} rules={isRequired ? [{ required: true }] : undefined}>
            <Input.TextArea rows={3} placeholder="JSON value" />
          </Form.Item>
        );
      })}
    </>
  );
}
