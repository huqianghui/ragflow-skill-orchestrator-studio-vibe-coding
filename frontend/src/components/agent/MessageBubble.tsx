import { Typography, theme } from 'antd';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ApplyActions from './ApplyActions';

const { Text } = Typography;

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  onApplyCode?: (code: string) => void;
  showApply?: boolean;
  /** When true, shows a blinking cursor after the text (streaming in progress). */
  streaming?: boolean;
}

export default function MessageBubble({
  role, content, onApplyCode, showApply, streaming,
}: MessageBubbleProps) {
  const { token } = theme.useToken();

  if (role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{
          background: token.colorPrimaryBg,
          borderRadius: 12,
          padding: '8px 14px',
          maxWidth: '80%',
          wordBreak: 'break-word',
        }}>
          <Text>{content}</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: '8px 14px',
        maxWidth: '100%',
        wordBreak: 'break-word',
      }}>
        {streaming && !content ? (
          <ThinkingIndicator />
        ) : content ? (
          <>
            <ReactMarkdown
              components={{
                code({ className, children, ...rest }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeStr = String(children).replace(/\n$/, '');
                  if (match) {
                    return (
                      <div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ borderRadius: 8, fontSize: 12 }}
                        >
                          {codeStr}
                        </SyntaxHighlighter>
                        <ApplyActions
                          code={codeStr}
                          showApply={showApply}
                          onApply={onApplyCode ? () => onApplyCode(codeStr) : undefined}
                        />
                      </div>
                    );
                  }
                  return <code className={className} {...rest}>{children}</code>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
            {streaming && <BlinkingCursor />}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** "Thinking..." animation with bouncing dots and a gradient progress bar. */
function ThinkingIndicator() {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#555' }}>Thinking</span>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: '#888',
              animation: `thinking-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <div style={{
        marginTop: 8,
        height: 3,
        borderRadius: 2,
        background: '#f0f0f0',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          borderRadius: 2,
          background: 'linear-gradient(90deg, #1677ff, #69b1ff, #1677ff)',
          backgroundSize: '200% 100%',
          animation: 'thinking-bar 1.8s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes thinking-dot {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes thinking-bar {
          0% { width: 0%; background-position: 0% 0; }
          50% { width: 70%; background-position: 100% 0; }
          100% { width: 100%; background-position: 0% 0; }
        }
      `}</style>
    </div>
  );
}

/** CSS-animated blinking cursor indicator (shown while content is streaming). */
function BlinkingCursor() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 2,
        height: 16,
        background: 'var(--ant-color-primary, #1677ff)',
        marginLeft: 2,
        verticalAlign: 'text-bottom',
        animation: 'blink-cursor 0.8s step-end infinite',
      }}
    >
      <style>{`
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}
