/**
 * 記錄成員工具
 * Record Member Utilities
 *
 * 提供提取物件成員（方法）的工具類型
 * Provides utility types for extracting object members (methods)
 */
import { ITSPickByType } from './pick-type';
import { ITSPropertyKey } from '../../type/base';
import { ITSExtractKeyof } from '../filter';
/**
 * 過濾出所有成員是函數且鍵類型為字串或符號的屬性
 * Filter out all members that are functions and key types are string or symbol
 *
 * @example
 * class User {
 *   name: string;
 *   greet(): void;
 *   async fetch(): Promise<void>;
 * }
 * type Methods = ITSMemberMethods<User>;
 * // type Methods = { greet(): void; fetch(): Promise<void>; }
 */
export type ITSMemberMethods<T> = ITSPickByType<T, Function, Extract<keyof T, ITSPropertyKey>>;
/**
 * 取得物件方法的鍵
 * Get keys of object methods
 *
 * @example
 * class User {
 *   name: string;
 *   greet(): void;
 *   async fetch(): Promise<void>;
 * }
 * type MethodKeys = ITSKeyofMemberMethods<User>;
 * // type MethodKeys = "greet" | "fetch"
 */
export type ITSKeyofMemberMethods<T> = ITSExtractKeyof<ITSMemberMethods<T>, ITSPropertyKey>;
/**
 * 版本 12: 完全泛化版 - 支持任意鍵值類型與自定義條件
 * 可配置：1) 值類型條件 2) 鍵排除列表 3) 輸出鍵類型
 *
 * ✅ 跨模組驗證：使用 infer 延遲類型解析，即使跨模組引用也能正確運作，
 *    避免 IMethods 變為 string 的問題
 *
 * @example
 * ```
 * type IMethods2 = "assert" | "clear" | "count" | "countReset" | "debug"
 *  | "dir" | "dirxml" | "error" | "group" | "groupCollapsed" | "groupEnd"
 *  | "info" | "log" | "table" | "time" | "timeEnd" | "timeLog" | "timeStamp"
 *  | "trace" | "warn" | "profile" | "profileEnd"
 * export type IMethods2 = ITSExcludeFilterKeys<ITSExtractKeysV13<ITSMemberMethodsV12<Console, Function, 'constructor'>, string>, "Console" | 'new' | 'prototype' | 'Console' | 'length'>;
 * ```
 *
 * 類型參數：
 * - T: 輸入對象類型（需 extends object）
 * - ValueCond: 值類型條件（預設為函數類型 `(...args: any[]) => any`）
 * - ExcludeKeys: 要排除的鍵列表（預設為 never，不排除任何鍵）
 *
 * 與 MemberMethodsV11 的差異：
 * - V11: 固定排除函數類型的鍵，只能排除單個鍵
 * - V12: 可自定義值類型條件（如只提取返回 Promise 的方法），支持排除多個鍵
 *
 * 核心機制：
 * ---------------------------
 * 1. 使用 `T extends infer U` 捕獲輸入類型，實現跨模組延遲解析
 * 2. 映射類型遍歷所有鍵，篩選符合 ValueCond 的鍵
 * 3. 若 ExcludeKeys 不為 never，使用 `as` 重映射排除指定鍵
 *
 * ✅ 跨模組驗證：使用 infer 延遲類型解析，即使跨模組引用也能正確運作，
 *    避免 IMethods 變為 string 的問題
 *
 * 使用範例：
 * ---------------------------
 * @example
 * ```typescript
 * interface MyClass {
 *   name: string;
 *   log(): void;
 *   debug(): void;
 *   error(): void;
 *   constructor(): void;
 *   _privateMethod(): void;
 * }
 *
 * // 1. 提取所有方法（預設行為，等同 MemberMethodsV11 無排除時）
 * // ✅ 結果：'log' | 'debug' | 'error' | 'constructor' | '_privateMethod'
 * type AllMethods = MemberMethodsV12<MyClass>;
 *
 * // 2. 提取方法但排除 constructor
 * // ✅ 結果：'log' | 'debug' | 'error' | '_privateMethod'
 * // ❌ 'constructor' 被排除
 * type NoCtor = MemberMethodsV12<MyClass, (...args: any[]) => any, 'constructor'>;
 *
 * // 3. 排除多個鍵
 * // ✅ 結果：'log' | 'debug' | 'error'
 * // ❌ 'constructor'、'_privateMethod' 被排除
 * type PublicMethods = MemberMethodsV12<MyClass, (...args: any[]) => any, 'constructor' | '_privateMethod'>;
 *
 * // 4. 自定義值類型條件 - 只提取返回 string 的方法
 * interface StringReturnClass {
 *   getName(): string;
 *   getId(): number;
 *   log(): void;
 * }
 * // ✅ 結果：'getName'
 * type StringMethods = MemberMethodsV12<StringReturnClass, () => string>;
 *
 * // 5. 自定義值類型 - 只提取返回 Promise 的方法
 * interface AsyncClass {
 *   fetchData(): Promise<string>;
 *   syncMethod(): string;
 *   save(): Promise<void>;
 * }
 * // ✅ 結果：'fetchData' | 'save'
 * type AsyncMethods = MemberMethodsV12<AsyncClass, () => Promise<any>>;
 *
 * // 6. 泛型類別中使用
 * class GenericService<T> {
 *   data: T;
 *   fetch(): Promise<T>;
 *   save(): Promise<void>;
 *   private internal(): void;
 * }
 * // ✅ 結果：'fetch' | 'save' | 'internal'（含私有方法）
 * // ❌ 'data' 被過濾（不是函數）
 * type ServiceMethods = MemberMethodsV12<GenericService<any>>;
 * // ✅ 結果：'fetch' | 'save'
 * // ❌ 'internal' 也被排除（假設要排除私有方法）
 * type PublicServiceMethods = MemberMethodsV12<GenericService<any>, (...args: any[]) => any, 'internal'>;
 *
 * // 7. 與 ExtractKeyofV12 組合使用 - 提取並轉換為 string 類型
 * type MyClassMethods = MemberMethodsV12<MyClass>;
 * type StringMethodKeys = ExtractKeyofV12<MyClassMethods, string>;  // 'log' | 'debug' | 'error' | ...
 *
 * // 8. 內化排除模式 - 最簡潔用法
 * // 將所有排除邏輯集中在 MemberMethodsV12 的 ExcludeKeys 參數中
 * type CleanMethods = MemberMethodsV12<
 *   MyClass,
 *   Function,
 *   'constructor' | 'new' | 'prototype' | '_privateMethod'
 * >;
 * ```
 *
 * 進階組合範例：
 * ---------------------------
 * @example
 * ```typescript
 * // 組合 FilterKeys 實現分階段過濾
 * type Stage1 = MemberMethodsV12<ApiA>;  // 提取 A 的方法
 * type Stage2 = MemberMethodsV12<ApiB>;  // 提取 B 的方法
 * type Combined = FilterKeys<Stage1 | Stage2, 'constructor' | 'init'>;
 *
 * // 條件化排除
 * type ConditionalMethods<T, ExcludePrivate extends boolean> =
 *   ExcludePrivate extends true
 *     ? MemberMethodsV12<T, (...args: any[]) => any, `_${string}`>
 *     : MemberMethodsV12<T>;
 * ```
 *
 * @see ITSExcludeFilterKeys
 * @see ITSExtractKeysV13
 */
export type ITSMemberMethodsV12<T, ValueCond = (...args: any[]) => any, ExcludeKeys extends PropertyKey = never> = T extends infer U ? U extends object ? ExcludeKeys extends never ? {
    [K in keyof U]: U[K] extends ValueCond ? K : never;
}[keyof U] : {
    [K in keyof U as U[K] extends ValueCond ? K extends ExcludeKeys ? never : K : never]: any;
} extends infer M ? keyof M : never : never : never;
