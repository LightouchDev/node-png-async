'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var zlib = require("zlib");
var stream = require("stream");
var png = require("./index");
var constants = require("./constants");
var CrcStream = require("./crc");
var Filter = require("./filter");
var Packer = (function (_super) {
    __extends(Packer, _super);
    function Packer(option) {
        var _this = _super.call(this) || this;
        _this._option = option;
        option.deflateChunkSize = option.deflateChunkSize || 32 * 1024;
        option.deflateLevel = option.deflateLevel || 9;
        if (option.deflateStrategy === undefined) {
            option.deflateStrategy = png.EDeflateStrategy.RLE;
        }
        _this.readable = true;
        return _this;
    }
    Packer.prototype.pack = function (data, width, height) {
        var _this = this;
        // Signature
        this.emit('data', new Buffer(constants.PNG_SIGNATURE));
        this.emit('data', this._packIHDR(width, height));
        // filter pixel data
        var filter = new Filter(width, height, 4, data, this._option);
        data = filter.filter();
        // compress it
        var deflate = zlib.createDeflate({
            chunkSize: this._option.deflateChunkSize,
            level: this._option.deflateLevel,
            strategy: this._option.deflateStrategy
        });
        deflate.on('error', this.emit.bind(this, 'error'));
        deflate.on('data', function (data) {
            _this.emit('data', _this._packIDAT(data));
        });
        deflate.on('end', function () {
            _this.emit('data', _this._packIEND());
            _this.emit('end');
        });
        deflate.end(data);
    };
    Packer.prototype._read = function () {
        //todo
    };
    Packer.prototype._packChunk = function (type, data) {
        var len = (data ? data.length : 0);
        var buf = new Buffer(len + 12);
        buf.writeUInt32BE(len, 0);
        buf.writeUInt32BE(type, 4);
        if (data) {
            data.copy(buf, 8);
        }
        buf.writeInt32BE(CrcStream.crc32(buf.slice(4, buf.length - 4)), buf.length - 4);
        return buf;
    };
    Packer.prototype._packIHDR = function (width, height) {
        var buf = new Buffer(13);
        buf.writeUInt32BE(width, 0);
        buf.writeUInt32BE(height, 4);
        buf[8] = 8;
        buf[9] = 6; // colorType
        buf[10] = 0; // compression
        buf[11] = 0; // filter
        buf[12] = 0; // interlace
        return this._packChunk(constants.TYPE_IHDR, buf);
    };
    Packer.prototype._packIDAT = function (data) {
        return this._packChunk(constants.TYPE_IDAT, data);
    };
    Packer.prototype._packIEND = function () {
        return this._packChunk(constants.TYPE_IEND, null);
    };
    return Packer;
}(stream.Readable));
module.exports = Packer;
