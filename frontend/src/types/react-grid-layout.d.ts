declare module 'react-grid-layout' {
  import type { CSSProperties, ReactNode, RefObject } from 'react';

  export interface Layout {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    static?: boolean;
    isDraggable?: boolean;
    isResizable?: boolean;
  }

  export interface Layouts {
    [breakpoint: string]: Layout[];
  }

  export interface ResponsiveGridLayoutProps {
    children?: ReactNode;
    width: number;
    breakpoints?: Record<string, number>;
    cols?: Record<string, number>;
    layouts?: Layouts;
    rowHeight?: number;
    maxRows?: number;
    margin?: [number, number] | Record<string, [number, number]>;
    containerPadding?: [number, number] | Record<string, [number, number]> | null;
    className?: string;
    style?: CSSProperties;
    autoSize?: boolean;
    draggableCancel?: string;
    draggableHandle?: string;
    isDraggable?: boolean;
    isResizable?: boolean;
    isBounded?: boolean;
    useCSSTransforms?: boolean;
    transformScale?: number;
    allowOverlap?: boolean;
    preventCollision?: boolean;
    isDroppable?: boolean;
    resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>;
    onLayoutChange?(currentLayout: Layout[], allLayouts: Layouts): void;
    onBreakpointChange?(newBreakpoint: string, newCols: number): void;
  }

  export function Responsive(props: ResponsiveGridLayoutProps): ReactNode;
  export { Responsive as ResponsiveGridLayout };

  export function useContainerWidth(options?: {
    measureBeforeMount?: boolean;
    initialWidth?: number;
  }): {
    width: number;
    mounted: boolean;
    containerRef: RefObject<HTMLDivElement | null>;
    measureWidth: () => void;
  };
}

declare module 'react-grid-layout/css/styles.css' {
  const content: string;
  export default content;
}

declare module 'react-resizable/css/styles.css' {
  const content: string;
  export default content;
}
