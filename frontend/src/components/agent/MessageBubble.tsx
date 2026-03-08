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
        {content ? (
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
        ) : null}
        {streaming && <BlinkingCursor />}
      </div>
    </div>
  );
}

/** CSS-animated blinking cursor indicator. */
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
