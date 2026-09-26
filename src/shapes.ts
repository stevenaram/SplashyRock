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
// Read left to right, top to bottom from the supplied reference. Repeated
// drawings share an entry rather than making those shapes more likely to deal.
export const SHAPES: readonly Shape[] = [
  shape('corner-bl', 'bottom-left corner', ['10', '11']),
  shape('corner-tr', 'top-right corner', ['11', '01']),
  shape('corner-tl', 'top-left corner', ['11', '10']),
  shape('corner-br', 'bottom-right corner', ['01', '11']),
  shape('diagonal-down', 'descending diagonal pair', ['10', '01']),
  shape('diagonal-up', 'ascending diagonal pair', ['01', '10']),
  shape('cross', 'cross', ['010', '111', '010']),
  shape('line-vertical', 'vertical three', ['1', '1', '1']),
  shape('line-horizontal', 'horizontal three', ['111']),
  shape('single', 'single square', ['1']),
  shape('cup-right', 'right-opening cup', ['11', '10', '11']),
  shape('cup-left', 'left-opening cup', ['11', '01', '11']),
  shape('cup-down', 'down-opening cup', ['111', '101']),
  shape('cup-up', 'up-opening cup', ['101', '111']),
  shape('split-up', 'up-pointing split three', ['010', '101']),
  shape('split-right', 'right-pointing split three', ['10', '01', '10']),
  shape('split-left', 'left-pointing split three', ['01', '10', '01']),
];
