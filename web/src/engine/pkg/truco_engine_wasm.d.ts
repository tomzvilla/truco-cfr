/* tslint:disable */
/* eslint-disable */

/**
 * El partido, tal como lo usa el Worker de la web. Las vistas se devuelven como JSON de `TableView`.
 */
export class WasmMatch {
    free(): void;
    [Symbol.dispose](): void;
    act(action: number): string;
    botStep(): string;
    botToMove(): boolean;
    logits(features: Uint8Array): Float32Array;
    newHand(): string;
    newMatch(seed: number): string;
    constructor(model: Uint8Array, seed: number);
    view(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmmatch_free: (a: number, b: number) => void;
    readonly wasmmatch_act: (a: number, b: number) => [number, number, number, number];
    readonly wasmmatch_botStep: (a: number) => [number, number, number, number];
    readonly wasmmatch_botToMove: (a: number) => number;
    readonly wasmmatch_logits: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmmatch_new: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmmatch_newHand: (a: number) => [number, number, number, number];
    readonly wasmmatch_newMatch: (a: number, b: number) => [number, number];
    readonly wasmmatch_view: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
