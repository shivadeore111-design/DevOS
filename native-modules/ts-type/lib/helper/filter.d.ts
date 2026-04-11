/**
 * Created by user on 2019/6/8.
 */
/**
 * 從 T 中排除可指派給 U 的類型，並替換為 R
 * Exclude from T those types that are assignable to U, and replace to R
 *
 * @example
 * type Test = string | number | boolean;
 * type Result = ITSExclude2<Test, string, never>; // number | boolean
 */
export type ITSExclude2<T, U, R = T> = T extends U ? never : R;
/**
 * 從 T 中提取可指派給 U 的類型，並替換為 R
 * Extract from T those types that are assignable to U, and replace to R
 *
 * @example
 * type Test = string | number | boolean;
 * type Result = ITSExtract2<Test, string, 'text'>; // 'text' | number | boolean
 */
export type ITSExtract2<T, U, R = T> = T extends U ? R : never;
/**
 * 提取 T 中屬於 U 的鍵
 * Extract keys from T that belong to U
 */
export type ITSExtractKeyof<T, U> = Extract<keyof T, U>;
/**
 * 從類陣列類型中提取指定索引的類型
 * Extract types of specified indexes from array-like type
 *
 * @example
 * type Test = [string, number, boolean];
 * type Result = ITSExtractArrayLike<Test, 0 | 2>; // [string, boolean]
 */
export type ITSExtractArrayLike<A, K extends Extract<keyof A, number> = Extract<keyof A, number>> = {
    [Index in K]: A[Index];
};
/**
 * 取得類陣列類型的所有數字索引鍵
 * Get all numeric index keys of array-like type
 */
export type ITSKeyofArrayLike<A> = keyof ITSExtractArrayLike<A>;
/**
 * 取得可為 null 或 undefined 的類型
 * Get types that can be null or undefined
 *
 * @example
 * type Test = string | number | null;
 * type Result = ITSNullable<Test>; // string | number | null
 */
export type ITSNullable<T> = T extends null | undefined ? T : never;
/**
 * 找出 T 當中與 U 相同的鍵
 * Find keys that are the same between T and U
 *
 * @example
 * type A = { a: 1; b: 2; };
 * type B = { a: 3; c: 4; };
 * type Result = ITSKeyofSame<A, B>; // 'a'
 */
export type ITSKeyofSame<T, U> = Extract<keyof T, keyof U>;
/**
 * 找出 T 當中與 U 不同的鍵
 * Find keys that are different between T and U
 *
 * @example
 * type A = { a: 1; b: 2; };
 * type B = { a: 3; c: 4; };
 * type Result = ITSKeyofDiff<A, B>; // 'b'
 */
export type ITSKeyofDiff<T, U> = Exclude<keyof T, ITSKeyofSame<T, U>>;
/**
 * 找出 T 與 U 當中同時存在的鍵
 * Find keys that exist in both T and U
 *
 * @example
 * type A = { a: 1; b: 2; };
 * type B = { a: 3; c: 4; };
 * type Result = ITSKeyofBothSame<A, B>; // 'a'
 */
export type ITSKeyofBothSame<T, U> = ITSKeyofSame<T, U> | ITSKeyofSame<U, T>;
/**
 * 去除 T 與 U 當中同時存在的鍵
 * Remove keys that exist in both T and U
 *
 * @example
 * type A = { a: 1; b: 2; };
 * type B = { a: 3; c: 4; };
 * type Result = ITSKeyofBothDiff<A, B>; // 'b' | 'c'
 */
export type ITSKeyofBothDiff<T, U> = ITSKeyofDiff<T, U> | ITSKeyofDiff<U, T>;
/**
 * ITSFilterKeysString - 基礎鍵過濾類型
 * 從聯合類型中排除指定的字符串鍵
 *
 * 使用範例：
 * @example
 * type AllKeys = 'log' | 'debug' | 'constructor' | 'error';
 * type PublicKeys = ITSFilterKeysString<AllKeys, 'constructor'>;  // 'log' | 'debug' | 'error'
 * type SafeKeys = ITSFilterKeysString<AllKeys, 'constructor' | 'error'>;  // 'log' | 'debug'
 *
 * @example
 * type ITSFilterKeysString<T, ExcludeKeys extends string = never> = T extends infer U
 * 	? U extends string
 * 		? U extends ExcludeKeys ? never : U
 * 		: never
 * 	: never;
 *
 * @see ITSExcludeFilterKeys
 */
export type ITSExcludeFilterKeysString<T, ExcludeKeys extends string = never> = ITSExcludeFilterKeys<T, ExcludeKeys, string>;
/**
 * ITSFilterKeysPropertyKey - 支持 PropertyKey（string | number | symbol）的版本
 *
 * 使用範例：
 * @example
 * type AllKeys = 'log' | 'debug' | 'constructor' | 42 | symbol;
 * type StringKeys = ITSFilterKeysPropertyKey<AllKeys, number | symbol>;  // 'log' | 'debug' | 'constructor'
 * type NoSymbol = ITSFilterKeysPropertyKey<AllKeys, symbol>;            // 'log' | 'debug' | 'constructor' | 42
 *
 * @example
 * type ITSFilterKeysPropertyKey<T, ExcludeKeys extends PropertyKey = never> = T extends infer U
 * 	? U extends PropertyKey
 * 		? U extends ExcludeKeys ? never : U
 * 		: never
 * 	: never;
 *
 * @see ITSExcludeFilterKeys
 */
export type ITSExcludeFilterKeysPropertyKey<T, ExcludeKeys extends PropertyKey = never> = ITSExcludeFilterKeys<T, ExcludeKeys, PropertyKey>;
/**
 * ITSFilterKeys - 可配置鍵類型範圍的版本
 * 第三個類型參數 `AllowedPropertyKey` 允許精確控制保留哪些類型的鍵
 *
 * 使用範例：
 * @example
 * ```
 * type AllKeys = 'log' | 'debug' | 42 | 99 | symbol;
 *
 * // 只保留 string 類型，排除 'log'
 * type StringOnly = ITSFilterKeys<AllKeys, 'log', string>;  // 'debug'
 *
 * // 只保留 number 類型，不排除任何鍵
 * type NumOnly = ITSFilterKeys<AllKeys, never, number>;  // 42 | 99
 *
 * // 保留 string | number，排除 'debug'
 * type Mixed = ITSFilterKeys<AllKeys, 'debug', string | number>;  // 'log' | 42 | 99
 * ```
 *
 * 三代版本對比：
 * ITSFilterKeysString:     固定處理 string（最基礎）
 * ITSFilterKeysPropertyKey:   固定處理 PropertyKey（更廣泛）
 * ITSFilterKeys:   可配置 AllowedPropertyKey 參數（最靈活）
 *
 * @see ITSExtractKeysV13
 */
export type ITSExcludeFilterKeys<T, ExcludeKeys extends PropertyKey = never, AllowedPropertyKey extends PropertyKey = PropertyKey> = T extends infer U ? U extends AllowedPropertyKey ? U extends ExcludeKeys ? never : U : never : never;
/**
 * ITSExtractKeysV13 - 選擇器版本（只保留匹配 IncludeKeys 的鍵）
 *
 * 與 FilterKeysV3 的邏輯差異：
 * - FilterKeysV3: `U extends ExcludeKeys ? never : U` → 排除匹配的鍵
 * - ITSExtractKeysV13: `U extends IncludeKeys ? U : never` → 只保留匹配的鍵
 *
 * 設計理念：
 * ---------------------------
 * ExtractKeyofV12 系列的核心需求是「篩選符合 V 類型的鍵」。
 * FilterKeys 系列的設計是「排除」思維（ ExcludeKeys ），
 * 而 ITSExtractKeysV13 採用「選擇」思維（ IncludeKeys ），更符合鍵提取的語義。
 *
 * 與 FilterKeysV3 實作的對比：
 * - FilterKeysV3: `FilterKeysV3<T, never, V>`（用 AllowedPropertyKey 篩選，ExcludeKeys 設為 never）
 * - ITSExtractKeysV13: `ITSExtractKeysV13<T, V, PropertyKey>`（直接用 IncludeKeys 篩選）
 *
 * 使用範例與測試驗證：
 * ```typescript
 * type AllKeys = 'log' | 'debug' | 'error' | 42 | 99 | symbol;
 *
 * // 1. 篩選 string 類型鍵（等同 ExtractKeyofV12d<AllKeys, string>）
 * // ✅ 結果：'log' | 'debug' | 'error'
 * type Strings = ITSExtractKeysV13<AllKeys, string, PropertyKey>;
 *
 * // 2. 篩選 number 類型鍵
 * // ✅ 結果：42 | 99
 * type Numbers = ITSExtractKeysV13<AllKeys, number, PropertyKey>;
 *
 * // 3. 只保留特定字面量
 * // ✅ 結果：'log' | 'debug'
 * type Picked = ITSExtractKeysV13<AllKeys, 'log' | 'debug', PropertyKey>;
 *
 * // 4. 特定數字字面量（只保留 42，過濾 99）
 * // ✅ 結果：42
 * // ❌ 99 會被過濾
 * type SpecificNumber = ITSExtractKeysV13<AllKeys, 42, PropertyKey>;
 *
 * // 5. 實作 ExtractKeyofV12（輸出轉為 string）
 * // ✅ 結果：'log' | 'debug' | 'error'
 * type V12_Strings = ITSExtractKeysV13<AllKeys, string, PropertyKey> & string;
 *
 * // 6. 限制輸入類型為 string（等同 FilterKeysV3<AllKeys, never, string>）
 * // ✅ 結果：'log' | 'debug' | 'error'
 * // ❌ number/symbol 被過濾
 * type StringOnly = ITSExtractKeysV13<AllKeys, PropertyKey, string>;
 *
 * // 7. symbol 類型篩選（結果為 never）
 * // ✅ 結果：never（symbol 無法通過 PropertyKey 匹配 string/number）
 * type SymbolFiltered = ITSExtractKeysV13<AllKeys, symbol, PropertyKey>;
 * ```
 *
 * Enum 類型處理範例：
 * ------------------
 * TypeScript enum 作為類型時，需使用模板字面量 `${Enum}` 或 keyof typeof 獲取成員。
 *
 * ```typescript
 * enum LogLevel {
 *   DEBUG = 'debug',
 *   INFO = 'info',
 *   WARN = 'warn',
 *   ERROR = 'error'
 * }
 *
 * enum StatusCode {
 *   OK = 200,
 *   NOT_FOUND = 404,
 *   ERROR = 500
 * }
 *
 * // 8. 從 enum 鍵中篩選（使用 keyof typeof）
 * // ✅ 結果：'DEBUG' | 'INFO'
 * type EnumKeys = keyof typeof LogLevel;  // 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
 * type PickedEnumKeys = ITSExtractKeysV13<EnumKeys, 'DEBUG' | 'INFO', PropertyKey>;
 *
 * // 11. 數字 enum 的值篩選（使用 infer 提取數字）
 * // ✅ 結果：200 | 500
 * type StatusEnumValues = `${StatusCode}` extends `${infer N extends number}` ? N : never;
 * type PickedStatusValues = ITSExtractKeysV13<200 | 404 | 500, StatusEnumValues, PropertyKey>;
 *
 * // 12. enum 作為第二參數（IncludeKeys）使用 ITSTypeAndStringLiteral
 * // 搭配 ts-type 的 ITSTypeAndStringLiteral 可直接將 enum 轉為 string 字面量
 * // ✅ 結果：'debug' | 'error'
 * import { ITSTypeAndStringLiteral } from 'ts-type';
 * type MixedInput = ITSTypeAndStringLiteral<LogLevel> | 42 | symbol;
 * type EnumAsIncludeKeys = ITSTypeAndStringLiteral<LogLevel.DEBUG | LogLevel.ERROR>;
 * type Filtered = ITSExtractKeysV13<MixedInput, EnumAsIncludeKeys, PropertyKey>;
 * // ✅ 可賦值：LogLevel.DEBUG, LogLevel.ERROR
 * // ❌ 被過濾：'trace', 'fatal', 42, symbol
 *
 * // 13. 數字 enum 直接作為 IncludeKeys
 * // ✅ 結果：200 | 404 | 500
 * type AllCodes = 200 | 301 | 404 | 500 | 503;
 * type StatusCodes = ITSExtractKeysV13<AllCodes, StatusCode, PropertyKey>;
 * ```
 *
 * @see ITSExcludeFilterKeys
 */
export type ITSExtractKeysV13<T, IncludeKeys extends PropertyKey, AllowedPropertyKey extends PropertyKey = PropertyKey> = T extends infer U ? U extends AllowedPropertyKey ? U extends IncludeKeys ? U : never : never : never;
