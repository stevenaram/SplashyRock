export type Offset = readonly [x: number, y: number];
export interface Shape {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly Offset[];
}
function shape(id: string, name: string, rows: string[]): Shape {
  return {
    id, name, width: rows[0].length, height: rows.length,
    cells: rows.flatMap((row, y) => [...row].flatMap((cell, x): Offset[] => cell === '1' ? [[x, y]] : [])),
  };
}
// The replacement reference contains 25 drawings and 23 distinct footprints.
// The two seven-cell diagonal blocks are each drawn twice.
export const SHAPES: readonly Shape[] = [
  shape('double-cross-up', 'ascending double cross', ['0010','0111','1110','0100']),
  shape('double-cross-down', 'descending double cross', ['0100','1110','0111','0010']),
  shape('block-diagonal-down', 'descending seven-square block', ['110','111','011']),
  shape('block-diagonal-up', 'ascending seven-square block', ['011','111','110']),
  shape('corner-bl', 'bottom-left corner', ['10', '11']),
  shape('corner-tr', 'top-right corner', ['11', '01']),
  shape('corner-tl', 'top-left corner', ['11', '10']),
  shape('corner-br', 'bottom-right corner', ['01', '11']),
  shape('single', 'single square', ['1']),
  shape('square-nine', 'nine-square block', ['111','111','111']),
  shape('stair-top-right', 'top-right staircase', ['011','110','100']),
  shape('stair-top-left', 'top-left staircase', ['110','011','001']),
  shape('cross-tall', 'tall eight-square cross', ['010','111','111','010']),
  shape('cross', 'cross', ['010', '111', '010']),
  shape('line-vertical', 'vertical three', ['1', '1', '1']),
  shape('stair-bottom-left', 'bottom-left staircase', ['001','011','110']),
  shape('line-horizontal', 'horizontal three', ['111']),
  shape('stair-bottom-right', 'bottom-right staircase', ['100','110','011']),
  shape('cup-right', 'right-opening cup', ['11', '10', '11']),
  shape('cup-left', 'left-opening cup', ['11', '01', '11']),
  shape('cup-down', 'down-opening cup', ['111', '101']),
  shape('cross-wide', 'wide eight-square cross', ['0110','1111','0110']),
  shape('cup-up', 'up-opening cup', ['101', '111']),
];

// Bush progression uses only existing shapes, skipping absent sizes.
export const BUSH_SIZE_TIERS=[3,...new Set(SHAPES.map(s=>s.cells.length).filter(n=>n>3))].sort((a,b)=>a-b);
