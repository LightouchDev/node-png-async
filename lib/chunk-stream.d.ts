/// <reference types="node" />
import stream = require('stream');
export = ChunkStream;
declare class ChunkStream extends stream.Duplex {
    private _buffers;
    private _buffered;
    private _reads;
    private _paused;
    private _encoding;
    constructor();
    _read(size: any): void;
    _write(data: any, encoding: any, cb: any): boolean;
    read(length: any, callback?: any): void;
    end(data?: any): void;
    destroySoon: (data?: any) => void;
    destroy(): void;
    private _end();
    private _process();
}
