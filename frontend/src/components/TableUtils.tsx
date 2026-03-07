import { useRef, useState } from 'react';
import { Popover } from 'antd';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

/**
 * Resizable table header cell — enables column width dragging.
 * Use with Table `components={{ header: { cell: ResizableTitle } }}`.
 */
export const ResizableTitle = (
  props: React.HTMLAttributes<HTMLTableCellElement> & {
    onResize?: (e: React.SyntheticEvent, data: { size: { width: number } }) => void;
    width?: number;
  },
) => {
  const { onResize, width, ...restProps } = props;
  if (!width || !onResize) {
    return <th {...restProps} />;
  }
  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          style={{
            position: 'absolute',
            right: -5,
            bottom: 0,
            top: 0,
            cursor: 'col-resize',
            width: 10,
            zIndex: 1,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

/**
 * Shows truncated text with a hover Popover when the content overflows.
 */
export function OverflowPopover({ text }: { text: string | null | undefined }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [overflowed, setOverflowed] = useState(false);

  const checkOverflow = () => {
    const el = spanRef.current;
    if (el) {
      setOverflowed(el.scrollWidth > el.clientWidth);
    }
  };

  if (!text) return <span>-</span>;

  const inner = (
    <span
      ref={spanRef}
      onMouseEnter={checkOverflow}
      style={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );

  if (!overflowed) return inner;

  return (
    <Popover
      content={<div style={{ maxWidth: 400, wordBreak: 'break-word' }}>{text}</div>}
      trigger="hover"
      mouseEnterDelay={0.5}
    >
      {inner}
    </Popover>
  );
}

/**
 * Helper to create a resize handler for a specific column key.
 * Usage: `handleResize('name', 100)` returns the onResize callback.
 */
export function makeResizeHandler<T extends Record<string, number>>(
  setColWidths: React.Dispatch<React.SetStateAction<T>>,
) {
  return (key: string, minWidth: number) =>
    (_: React.SyntheticEvent, { size }: { size: { width: number } }) => {
      setColWidths((prev) => ({ ...prev, [key]: Math.max(size.width, minWidth) }));
    };
}
