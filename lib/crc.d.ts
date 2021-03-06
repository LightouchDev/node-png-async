/// <reference types="node" />
import stream = require('stream');
export = CrcStream;
declare class CrcStream extends stream.Writable {
    private _crc;
    constructor();
    readonly crc32: number;
    _write(data: any, encoding: any, cb: any): void;
    end(data?: any): void;
    static crc32(buf: Buffer): number;
}
