// Ambient type stub for @nut-tree/nut-js
// The real package is unavailable on this NTFS environment.
// All usage in computerControl.ts is inside try-catch blocks with
// PowerShell fallbacks — this stub satisfies the TypeScript compiler only.

declare module '@nut-tree/nut-js' {
  export class Point {
    constructor(x: number, y: number)
    x: number
    y: number
  }

  export const mouse: {
    setPosition(point: Point): Promise<void>
    click(button: Button): Promise<void>
    doubleClick(button: Button): Promise<void>
    getPosition(): Promise<Point>
  }

  export const keyboard: {
    type(text: string): Promise<void>
    pressKey(...keys: Key[]): Promise<void>
    releaseKey(...keys: Key[]): Promise<void>
  }

  export enum Button {
    LEFT  = 0,
    RIGHT = 1,
    MIDDLE = 2,
  }

  export enum Key {
    A, B, C, D, E, F, G, H, I, J, K, L, M,
    N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
    Enter, Tab, Escape, Space, Backspace, Delete,
    Up, Down, Left, Right,
    F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12,
    LeftControl, LeftShift, LeftAlt, LeftSuper,
  }
}
