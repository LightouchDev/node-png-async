/// <reference types="node" />
import png = require('./index');
import ChunkStream = require('./chunk-stream');
export = Filter;
declare class Filter extends ChunkStream {
    private _width;
    private _height;
    private _bpp;
    private _data;
    private _option;
    private _line;
    private _filterTypes;
    private _filters;
    constructor(width: number, height: number, bpp: number, data: Buffer, option: png.IImageOptions);
    filter(): Buffer;
    private _reverseFilterLine(rawData);
    private _filterNone(pxData, y, rawData);
    private _filterSub(pxData, y, rawData);
    private _filterUp(pxData, y, rawData);
    private _filterAvg(pxData, y, rawData);
    private _filterPaeth(pxData, y, rawData);
}
