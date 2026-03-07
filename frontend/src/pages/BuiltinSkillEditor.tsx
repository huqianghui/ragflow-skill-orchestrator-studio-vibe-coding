import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Form,
  Input,
  message,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CaretRightOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  FileOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import type { Connection, Skill, SkillTestResult } from '../types';
import { connectionsApi, skillsApi } from '../services/api';
import ConfigSchemaForm from '../components/ConfigSchemaForm';
import PageHeader from '../components/PageHeader';

const { Text, Paragraph } = Typography;

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  azure_ai_foundry: 'Azure AI Foundry (multi-service)',
  azure_openai: 'Azure OpenAI',
  azure_content_understanding: 'Azure Content Understanding',
  azure_doc_intelligence: 'Azure Document Intelligence',
  openai: 'OpenAI',
  http_api: 'HTTP API',
};

// Skills that only accept file input (no text input)
const FILE_ONLY_SKILLS = new Set(['DocumentCracker', 'OCR', 'ImageAnalyzer']);

// Rich result fields returned by DocumentCracker with prebuilt-layout
interface RichAnalyzeData {
  markdown?: string;
  text?: string;
  tables?: Array<{ html: string; rowCount: number; columnCount: number }>;
  figures?: Array<{ caption: string; boundingRegions?: unknown[] }>;
  selectionMarks?: Array<{ page: number; state: string; confidence: number }>;
  pages?: Array<{ pageNumber: number; width: number; height: number; unit: string }>;
  metadata?: { pageCount?: number };
}

export default function BuiltinSkillEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [boundConnectionId, setBoundConnectionId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);
  const [testInputText, setTestInputText] = useState('');
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedContentType, setUploadedContentType] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const isFileOnly = skill ? FILE_ONLY_SKILLS.has(skill.name) : false;
  const isDocCracker = skill?.name === 'DocumentCracker';

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [skillData, connData, defaultsData] = await Promise.all([
        skillsApi.get(id),
        connectionsApi.list(1, 100),
        connectionsApi.getDefaults(),
      ]);
      setSkill(skillData);
      setConnections(connData.items);

      let connId = skillData.bound_connection_id;
      if (!connId && skillData.required_resource_types?.length) {
        const targetType = skillData.required_resource_types[0];
        const defaultConn = defaultsData[targetType];
        if (defaultConn) {
          connId = defaultConn.id;
        }
      }
      setBoundConnectionId(connId);

      const configValues: Record<string, unknown> = {};
      const schema = skillData.config_schema as { properties?: Record<string, { default?: unknown }> };
      if (schema?.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          configValues[key] = prop.default;
        }
      }
      if (skillData.config_values) {
        Object.assign(configValues, skillData.config_values);
      }
      form.setFieldsValue(configValues);
    } catch {
      message.error('Failed to load skill');
    } finally {
      setLoading(false);
    }
  }, [id, form]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const compatibleConnections = connections.filter((c) =>
    skill?.required_resource_types?.includes(c.connection_type)
  );

  const handleSave = async () => {
    if (!id || !skill) return;
    setSaving(true);
    try {
      const configValues = form.getFieldsValue();
      await skillsApi.configure(id, {
        config_values: configValues,
        bound_connection_id: boundConnectionId,
      });
      message.success('Configuration saved');
    } catch {
      message.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!id || !skill) return;
    setTesting(true);
    setTestResult(null);
    try {
      let testInput: Record<string, unknown>;
      if (uploadedFileId) {
        testInput = {
          values: [{ recordId: '1', data: { file_id: uploadedFileId, file_name: uploadedFileName } }],
        };
      } else {
        testInput = {
          values: [{ recordId: '1', data: { text: testInputText } }],
        };
      }
      const configOverride = form.getFieldsValue();
      const result = await skillsApi.test(id, testInput, configOverride);
      setTestResult(result);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Test failed'
        : 'Test failed';
      message.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      const result = await skillsApi.uploadTestFile(file);
      setUploadedFileId(result.file_id);
      setUploadedFileName(result.filename);
      setUploadedContentType(result.content_type);
      message.success(`File uploaded: ${result.filename}`);
    } catch {
      message.error('Failed to upload file');
    }
  };

  const handleRemoveFile = () => {
    setUploadedFileId(null);
    setUploadedFileName(null);
    setUploadedContentType(null);
    setTestResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!skill) {
    return <Alert type="error" message="Skill not found" />;
  }

  const hasErrors = testResult?.values.some((v) => v.errors.length > 0);
  const needsResource = skill.required_resource_types && skill.required_resource_types.length > 0;
  const schema = skill.config_schema as { type: string; properties?: Record<string, unknown> };
  const canRunTest = isFileOnly ? !!uploadedFileId : !!(testInputText || uploadedFileId);

  // Extract rich data from first successful test result
  const firstData = testResult?.values[0]?.data as RichAnalyzeData | undefined;
  const hasRichData = isDocCracker && firstData && (firstData.markdown || firstData.tables);

  // File preview
  const filePreviewUrl = uploadedFileId ? skillsApi.getTestFileUrl(uploadedFileId) : null;
  const isPdf = uploadedContentType === 'application/pdf'
    || uploadedFileName?.toLowerCase().endsWith('.pdf');
  const isImage = uploadedContentType?.startsWith('image/')
    || /\.(png|jpe?g|gif|bmp|webp|svg|tiff?)$/i.test(uploadedFileName || '');

  // ---------- Document Intelligence Studio layout (3-column) ----------
  if (isDocCracker) {
    return (
      <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, marginBottom: 8 }}>
          <PageHeader
            title={<>{skill.name} <Tag color="blue">Built-in</Tag></>}
            onBack={() => navigate('/skills')}
            extra={
              <Space>
                <Tooltip title="Configuration">
                  <Button
                    icon={<SettingOutlined />}
                    onClick={() => setShowConfig(!showConfig)}
                    type={showConfig ? 'primary' : 'default'}
                  />
                </Tooltip>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                  Save
                </Button>
              </Space>
            }
          />
        </div>

        {/* Config panel (collapsible) */}
        {showConfig && (
          <Card size="small" style={{ marginBottom: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {needsResource && (
                <div style={{ minWidth: 300 }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>Resource Binding</Text>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    {skill.required_resource_types!.map((t) => RESOURCE_TYPE_LABELS[t] || t).join(' or ')}
                  </Text>
                  <Select
                    placeholder="Select a connection"
                    value={boundConnectionId || undefined}
                    onChange={(v) => setBoundConnectionId(v)}
                    style={{ width: '100%' }}
                    options={compatibleConnections.map((c) => {
                      const detail = c.config?.deployment_name
                        ? ` [${c.config.deployment_name}]`
                        : c.config?.endpoint
                          ? ` [${c.config.endpoint}]`
                          : '';
                      return {
                        label: `${c.name}${detail}${c.is_default ? ' - default' : ''}`,
                        value: c.id,
                      };
                    })}
                  />
                  {boundConnectionId && (
                    <Text type="success" style={{ fontSize: 12 }}>
                      <CheckCircleOutlined /> Connected
                    </Text>
                  )}
                </div>
              )}
              {schema?.properties && Object.keys(schema.properties).length > 0 && (
                <div style={{ flex: 1 }}>
                  <Text strong style={{ display: 'block', marginBottom: 4 }}>Configuration</Text>
                  <Form form={form} layout="vertical" size="small">
                    <ConfigSchemaForm schema={schema as { type: string; properties: Record<string, { type: string; enum?: string[]; items?: { type: string }; default?: unknown; description?: string; minimum?: number; maximum?: number }>; required?: string[] }} />
                  </Form>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 3-column layout */}
        <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left column: file upload */}
          <div style={{
            width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column',
            borderRight: '1px solid #f0f0f0', padding: '0 8px 0 0',
          }}>
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !uploadedFileName && fileInputRef.current?.click()}
              style={{
                border: '2px dashed #d9d9d9',
                borderRadius: 8,
                padding: 16,
                textAlign: 'center',
                cursor: uploadedFileName ? 'default' : 'pointer',
                background: uploadedFileName ? '#f6ffed' : '#fafafa',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.3s',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }}
              />
              {uploadedFileName ? (
                <div style={{ textAlign: 'center' }}>
                  {/* Thumbnail */}
                  {isImage && filePreviewUrl ? (
                    <img
                      src={filePreviewUrl}
                      alt={uploadedFileName}
                      style={{
                        maxWidth: 120, maxHeight: 100, objectFit: 'contain',
                        borderRadius: 4, border: '1px solid #f0f0f0', marginBottom: 8,
                      }}
                    />
                  ) : isPdf && filePreviewUrl ? (
                    <div style={{
                      width: 120, height: 100, marginBottom: 8, overflow: 'hidden',
                      borderRadius: 4, border: '1px solid #f0f0f0', position: 'relative',
                      margin: '0 auto 8px',
                    }}>
                      <iframe
                        src={`${filePreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        title="PDF thumbnail"
                        style={{
                          width: 360, height: 300,
                          transform: 'scale(0.333)', transformOrigin: 'top left',
                          border: 'none', pointerEvents: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <FileOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
                  )}
                  <div style={{
                    fontSize: 12, wordBreak: 'break-all', marginBottom: 8,
                    maxWidth: 120,
                  }}>
                    {uploadedFileName}
                  </div>
                  <Space direction="vertical" size={4}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CaretRightOutlined />}
                      loading={testing}
                      onClick={(e) => { e.stopPropagation(); handleTest(); }}
                      disabled={!canRunTest}
                    >
                      Analyze
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                    >
                      Remove
                    </Button>
                    <Button
                      size="small"
                      icon={<CloudUploadOutlined />}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      Replace
                    </Button>
                  </Space>
                </div>
              ) : (
                <>
                  <CloudUploadOutlined style={{ fontSize: 32, color: '#bfbfbf', marginBottom: 8 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Drop file here or click to upload
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, marginTop: 4 }}>
                    PDF, DOCX, PPTX, images...
                  </Text>
                </>
              )}
            </div>
          </div>

          {/* Middle column: document preview */}
          <div style={{
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
            padding: '0 8px', borderRight: '1px solid #f0f0f0',
          }}>
            <Text strong style={{ marginBottom: 4, display: 'block', fontSize: 13, color: '#595959' }}>
              Document Preview
            </Text>
            <div style={{
              flex: 1, border: '1px solid #f0f0f0', borderRadius: 6,
              background: '#fafafa', overflow: 'hidden', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {filePreviewUrl && isPdf ? (
                <iframe
                  src={filePreviewUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Document Preview"
                />
              ) : filePreviewUrl && isImage ? (
                <div style={{
                  width: '100%', height: '100%', overflow: 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 16,
                }}>
                  <img
                    src={filePreviewUrl}
                    alt={uploadedFileName || 'Preview'}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : filePreviewUrl && uploadedFileName ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <FileOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">{uploadedFileName}</Text>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Preview not available for this file type
                    </Text>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <FileOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">Upload a document to preview</Text>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column: output panel */}
          <div style={{
            width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column',
            paddingLeft: 8, overflow: 'hidden',
          }}>
            {testing && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">Analyzing document...</Text>
                </div>
              </div>
            )}

            {!testing && testResult && (
              <>
                {/* Status bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 8, flexShrink: 0,
                }}>
                  {testResult.error ? (
                    <Tag color="red">Error</Tag>
                  ) : hasErrors ? (
                    <Tag color="red">Errors</Tag>
                  ) : (
                    <Tag color="green">Success</Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {testResult.execution_time_ms}ms
                  </Text>
                  {firstData?.metadata?.pageCount && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {firstData.metadata.pageCount} page(s)
                    </Text>
                  )}
                </div>

                {testResult.error && (
                  <Alert type="error" message={testResult.error} style={{ marginBottom: 8, flexShrink: 0 }} />
                )}

                {/* Error display */}
                {testResult.values.some((v) => v.errors.length > 0) && (
                  <div style={{ marginBottom: 8, flexShrink: 0 }}>
                    {testResult.values.map((v, i) =>
                      v.errors.length > 0 ? (
                        <Alert
                          key={i}
                          type="error"
                          message={v.errors.map((e) => e.message).join('; ')}
                          description={v.errors[0]?.traceback && (
                            <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', margin: 0 }}>
                              {v.errors[0].traceback}
                            </pre>
                          )}
                          style={{ marginBottom: 4 }}
                        />
                      ) : null
                    )}
                  </div>
                )}

                {/* Content tabs */}
                {hasRichData ? (
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Tabs
                      defaultActiveKey="content"
                      size="small"
                      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                      items={[
                        {
                          key: 'content',
                          label: 'Content',
                          children: (
                            <Tabs
                              defaultActiveKey="markdown"
                              size="small"
                              tabPosition="top"
                              style={{ height: '100%' }}
                              items={[
                                {
                                  key: 'markdown',
                                  label: 'Markdown',
                                  children: (
                                    <div
                                      className="di-markdown-content"
                                      style={{
                                        overflow: 'auto', padding: '8px 12px',
                                        height: 'calc(100vh - 340px)',
                                        background: '#fff', border: '1px solid #f0f0f0',
                                        borderRadius: 4, fontSize: 13,
                                      }}
                                    >
                                      <style>{`
                                        .di-markdown-content table {
                                          border-collapse: collapse;
                                          width: 100%;
                                          margin: 12px 0;
                                          font-size: 13px;
                                        }
                                        .di-markdown-content th,
                                        .di-markdown-content td {
                                          border: 1px solid #d9d9d9;
                                          padding: 6px 10px;
                                          text-align: left;
                                          vertical-align: top;
                                        }
                                        .di-markdown-content th {
                                          background: #fafafa;
                                          font-weight: 600;
                                        }
                                        .di-markdown-content tr:nth-child(even) {
                                          background: #fafafa;
                                        }
                                        .di-markdown-content figure {
                                          margin: 12px 0;
                                          padding: 8px;
                                          border: 1px dashed #d9d9d9;
                                          border-radius: 4px;
                                          background: #fafafa;
                                        }
                                        .di-markdown-content figcaption {
                                          font-size: 12px;
                                          color: #8c8c8c;
                                          margin-top: 4px;
                                        }
                                        .di-markdown-content img {
                                          max-width: 100%;
                                        }
                                        .di-markdown-content h1 { font-size: 20px; margin: 16px 0 8px; }
                                        .di-markdown-content h2 { font-size: 17px; margin: 14px 0 6px; }
                                        .di-markdown-content h3 { font-size: 15px; margin: 12px 0 4px; }
                                        .di-markdown-content p { margin: 6px 0; line-height: 1.6; }
                                        .di-markdown-content ul, .di-markdown-content ol { padding-left: 20px; }
                                        .di-markdown-content li { margin: 2px 0; }
                                      `}</style>
                                      <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                                        {firstData?.markdown || ''}
                                      </ReactMarkdown>
                                    </div>
                                  ),
                                },
                                {
                                  key: 'text',
                                  label: 'Text',
                                  children: (
                                    <pre style={{
                                      overflow: 'auto', padding: '8px 12px',
                                      height: 'calc(100vh - 340px)',
                                      background: '#fafafa', border: '1px solid #f0f0f0',
                                      borderRadius: 4, fontSize: 12,
                                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                      margin: 0,
                                    }}>
                                      {(firstData?.text || '').split('\n').map((line, i) => (
                                        <div key={i}>
                                          <span style={{ color: '#bbb', marginRight: 12, userSelect: 'none', display: 'inline-block', width: 36, textAlign: 'right' }}>{i + 1}</span>
                                          {line}
                                        </div>
                                      ))}
                                    </pre>
                                  ),
                                },
                                {
                                  key: 'tables',
                                  label: `Tables (${firstData?.tables?.length || 0})`,
                                  children: (
                                    <div style={{
                                      overflow: 'auto', padding: '8px 12px',
                                      height: 'calc(100vh - 340px)',
                                    }}>
                                      {(!firstData?.tables || firstData.tables.length === 0) ? (
                                        <Text type="secondary">No tables detected</Text>
                                      ) : (
                                        firstData.tables.map((t, i) => (
                                          <div key={i} style={{ marginBottom: 16 }}>
                                            <Text strong style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                                              Table {i + 1} ({t.rowCount} x {t.columnCount})
                                            </Text>
                                            <div
                                              style={{ fontSize: 12, overflow: 'auto' }}
                                              dangerouslySetInnerHTML={{ __html: t.html }}
                                            />
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  ),
                                },
                                {
                                  key: 'figures',
                                  label: `Figures (${firstData?.figures?.length || 0})`,
                                  children: (
                                    <div style={{
                                      overflow: 'auto', padding: '8px 12px',
                                      height: 'calc(100vh - 340px)',
                                    }}>
                                      {(!firstData?.figures || firstData.figures.length === 0) ? (
                                        <Text type="secondary">No figures detected</Text>
                                      ) : (
                                        firstData.figures.map((f, i) => (
                                          <div key={i} style={{
                                            padding: '8px 12px', marginBottom: 8,
                                            background: '#fafafa', borderRadius: 4,
                                            border: '1px solid #f0f0f0',
                                          }}>
                                            <Text strong style={{ fontSize: 12 }}>Figure {i + 1}</Text>
                                            {f.caption && (
                                              <div><Text style={{ fontSize: 12 }}>Caption: {f.caption}</Text></div>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  ),
                                },
                                {
                                  key: 'selectionMarks',
                                  label: `Selection marks (${firstData?.selectionMarks?.length || 0})`,
                                  children: (
                                    <div style={{
                                      overflow: 'auto', padding: '8px 12px',
                                      height: 'calc(100vh - 340px)',
                                    }}>
                                      {(!firstData?.selectionMarks || firstData.selectionMarks.length === 0) ? (
                                        <Text type="secondary">No selection marks detected</Text>
                                      ) : (
                                        firstData.selectionMarks.map((m, i) => (
                                          <div key={i} style={{ marginBottom: 4, fontSize: 12 }}>
                                            <Checkbox checked={m.state === 'selected'} disabled />
                                            <Text style={{ marginLeft: 8, fontSize: 12 }}>
                                              Page {m.page} — {m.state} (confidence: {(m.confidence * 100).toFixed(1)}%)
                                            </Text>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  ),
                                },
                              ]}
                            />
                          ),
                        },
                        {
                          key: 'result',
                          label: 'Result JSON',
                          children: (
                            <pre style={{
                              overflow: 'auto', padding: '8px 12px',
                              height: 'calc(100vh - 300px)',
                              background: '#f6ffed', border: '1px solid #b7eb8f',
                              borderRadius: 4, fontSize: 12, margin: 0,
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                              {JSON.stringify(firstData, null, 2)}
                            </pre>
                          ),
                        },
                      ]}
                    />
                  </div>
                ) : (
                  // Fallback: simple JSON output for non-rich data
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    {testResult.values.map((v, i) => (
                      v.errors.length === 0 && (
                        <pre key={i} style={{
                          margin: 0, padding: 8,
                          background: '#f6ffed', border: '1px solid #b7eb8f',
                          borderRadius: 4, fontSize: 12,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {JSON.stringify(v.data, null, 2)}
                        </pre>
                      )
                    ))}
                  </div>
                )}

                {/* Logs */}
                {testResult.logs.length > 0 && (
                  <div style={{ flexShrink: 0, marginTop: 8 }}>
                    <Collapse
                      size="small"
                      items={[{
                        key: 'logs',
                        label: `Logs (${testResult.logs.length})`,
                        children: (
                          <div style={{ fontSize: 12, maxHeight: 150, overflow: 'auto' }}>
                            {testResult.logs.map((log, i) => (
                              <div key={i} style={{ marginBottom: 2 }}>
                                <Tag
                                  color={log.level === 'ERROR' ? 'red' : log.level === 'WARNING' ? 'orange' : 'blue'}
                                  style={{ fontSize: 10 }}
                                >
                                  {log.level}
                                </Tag>
                                <Text>{log.message}</Text>
                              </div>
                            ))}
                          </div>
                        ),
                      }]}
                    />
                  </div>
                )}
              </>
            )}

            {!testing && !testResult && (
              <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Upload a document and click Analyze to see results
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Standard 2-column layout for non-DocumentCracker skills ----------
  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0 }}>
        <PageHeader
          title={<>{skill.name} <Tag color="blue">Built-in</Tag></>}
          onBack={() => navigate('/skills')}
          extra={
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              Save
            </Button>
          }
        />
      </div>

      {/* Main content: left config + right test */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left panel: Config */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          <Card size="small" title="Description" style={{ marginBottom: 12 }}>
            <Paragraph style={{ margin: 0 }}>{skill.description}</Paragraph>
          </Card>

          {needsResource && (
            <Card size="small" title="Resource Binding" style={{ marginBottom: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">
                  Required: {skill.required_resource_types!.map((t) => RESOURCE_TYPE_LABELS[t] || t).join(' or ')}
                </Text>
                <Select
                  placeholder="Select a connection"
                  value={boundConnectionId || undefined}
                  onChange={(v) => setBoundConnectionId(v)}
                  style={{ width: '100%' }}
                  options={compatibleConnections.map((c) => {
                    const detail = c.config?.deployment_name
                      ? ` [${c.config.deployment_name}]`
                      : c.config?.endpoint
                        ? ` [${c.config.endpoint}]`
                        : '';
                    return {
                      label: `${c.name}${detail}${c.is_default ? ' - default' : ''}`,
                      value: c.id,
                    };
                  })}
                />
                {boundConnectionId && (
                  <Text type="success">
                    <CheckCircleOutlined /> Connection selected
                  </Text>
                )}
                {!boundConnectionId && compatibleConnections.length === 0 && (
                  <Alert type="warning" message="No compatible connections found. Please create one in the Connections page." showIcon />
                )}
              </Space>
            </Card>
          )}

          {schema?.properties && Object.keys(schema.properties).length > 0 && (
            <Card size="small" title="Configuration" style={{ marginBottom: 12 }}>
              <Form form={form} layout="vertical" size="small">
                <ConfigSchemaForm schema={schema as { type: string; properties: Record<string, { type: string; enum?: string[]; items?: { type: string }; default?: unknown; description?: string; minimum?: number; maximum?: number }>; required?: string[] }} />
              </Form>
            </Card>
          )}
        </div>

        {/* Right panel: Test */}
        <div style={{ width: 440, flexShrink: 0, overflow: 'auto' }}>
          <Card size="small" title="Test Input" style={{ marginBottom: 12 }}>
            {!isFileOnly && (
              <Input.TextArea
                rows={4}
                placeholder="Enter test text here..."
                value={testInputText}
                onChange={(e) => {
                  setTestInputText(e.target.value);
                  setUploadedFileId(null);
                  setUploadedFileName(null);
                }}
                style={{ marginBottom: 8 }}
              />
            )}

            <div style={{
              border: '1px dashed #d9d9d9',
              borderRadius: 6,
              padding: uploadedFileName ? '8px 12px' : '24px 12px',
              textAlign: 'center',
              marginBottom: 12,
              background: uploadedFileName ? '#f6ffed' : '#fafafa',
            }}>
              {uploadedFileName ? (
                <Space>
                  <Tag color="blue" style={{ margin: 0 }}>{uploadedFileName}</Tag>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleRemoveFile}
                  />
                </Space>
              ) : (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    icon={<CloudUploadOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload File
                  </Button>
                  {isFileOnly && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Upload a document to test (PDF, DOCX, etc.)
                      </Text>
                    </div>
                  )}
                </>
              )}
            </div>

            <Button
              type="primary"
              icon={<CaretRightOutlined />}
              loading={testing}
              onClick={handleTest}
              block
              disabled={!canRunTest}
            >
              Run Test
            </Button>
          </Card>

          {testResult && (
            <Card
              size="small"
              title={
                <Space>
                  Output
                  {testResult.error ? (
                    <Tag color="red">Timeout</Tag>
                  ) : hasErrors ? (
                    <Tag color="red">Errors</Tag>
                  ) : (
                    <Tag color="green">Success</Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {testResult.execution_time_ms}ms
                  </Text>
                </Space>
              }
            >
              {testResult.error && (
                <Alert type="error" message={testResult.error} style={{ marginBottom: 8 }} />
              )}

              {testResult.values.map((v, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Text strong>Record: {v.recordId}</Text>
                  {v.errors.length > 0 && (
                    <Alert
                      type="error"
                      message={v.errors.map((e) => e.message).join('; ')}
                      description={v.errors[0]?.traceback && (
                        <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', margin: 0 }}>
                          {v.errors[0].traceback}
                        </pre>
                      )}
                      style={{ marginTop: 4 }}
                    />
                  )}
                  {v.errors.length === 0 && (
                    <pre style={{
                      margin: '4px 0', padding: 8,
                      background: '#f6ffed', border: '1px solid #b7eb8f',
                      borderRadius: 4, fontSize: 12, maxHeight: 400, overflow: 'auto',
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {JSON.stringify(v.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}

              {testResult.logs.length > 0 && (
                <Collapse
                  size="small"
                  items={[{
                    key: 'logs',
                    label: `Logs (${testResult.logs.length})`,
                    children: (
                      <div style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                        {testResult.logs.map((log, i) => (
                          <div key={i} style={{ marginBottom: 2 }}>
                            <Tag
                              color={log.level === 'ERROR' ? 'red' : log.level === 'WARNING' ? 'orange' : 'blue'}
                              style={{ fontSize: 10 }}
                            >
                              {log.level}
                            </Tag>
                            <Text>{log.message}</Text>
                          </div>
                        ))}
                      </div>
                    ),
                  }]}
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
