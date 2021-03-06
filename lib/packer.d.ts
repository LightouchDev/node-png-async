/// <reference types="node" />
import stream = require('stream');
import png = require('./index');
export = Packer;
declare class Packer extends stream.Readable {
    private _option;
    constructor(option: png.IImageOptions);
    pack(data: Buffer, width: number, height: number): void;
    _read(): void;
    private _packChunk(type, data?);
    private _packIHDR(width, height);
    private _packIDAT(data);
    private _packIEND();
}
