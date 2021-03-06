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
var constants = require("./constants");
var CrcStream = require("./crc");
var ChunkStream = require("./chunk-stream");
var Filter = require("./filter");
var colorTypeToBppMap = {
    0: 1,
    2: 3,
    3: 1,
    4: 2,
    6: 4
};
var Parser = (function (_super) {
    __extends(Parser, _super);
    function Parser(option) {
        var _this = _super.call(this) || this;
        _this._option = option;
        option.checkCRC = option.checkCRC !== false;
        _this._hasIHDR = false;
        _this._hasIEND = false;
        _this._inflate = null;
        _this._filter = null;
        _this._crc = null;
        // input flags/metadata
        _this._palette = [];
        _this._colorType = 0;
        _this._chunks = {};
        _this._chunks[constants.TYPE_IHDR] = _this._handleIHDR.bind(_this);
        _this._chunks[constants.TYPE_IEND] = _this._handleIEND.bind(_this);
        _this._chunks[constants.TYPE_IDAT] = _this._handleIDAT.bind(_this);
        _this._chunks[constants.TYPE_PLTE] = _this._handlePLTE.bind(_this);
        _this._chunks[constants.TYPE_tRNS] = _this._handleTRNS.bind(_this);
        _this._chunks[constants.TYPE_gAMA] = _this._handleGAMA.bind(_this);
        _this.writable = true;
        _this.on('error', _this._handleError.bind(_this));
        _this._handleSignature();
        return _this;
    }
    Parser.prototype._handleError = function () {
        this.writable = false;
        this.destroy();
    };
    Parser.prototype._handleSignature = function () {
        this.read(constants.PNG_SIGNATURE.length, this._parseSignature.bind(this));
    };
    Parser.prototype._parseSignature = function (data) {
        var signature = constants.PNG_SIGNATURE;
        for (var i = 0; i < signature.length; i++) {
            if (data[i] !== signature[i]) {
                this.emit('error', new Error('Invalid file signature'));
                return;
            }
        }
        this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._parseChunkBegin = function (data) {
        // chunk content length
        var length = data.readUInt32BE(0);
        // chunk type
        var type = data.readUInt32BE(4);
        var name = '';
        for (var i = 4; i < 8; i++) {
            name += String.fromCharCode(data[i]);
        }
        // console.log('chunk ', name, length);
        // chunk flags
        var ancillary = !!(data[4] & 0x20); // or critical
        //const priv = !!(data[5] & 0x20);  // or public
        //const safeToCopy = !!(data[7] & 0x20);  // or unsafe
        if (!this._hasIHDR && type !== constants.TYPE_IHDR) {
            this.emit('error', new Error('Expected IHDR on beginning'));
            return;
        }
        this._crc = new CrcStream();
        this._crc.write(new Buffer(name));
        if (this._chunks[type]) {
            return this._chunks[type](length);
        }
        else if (!ancillary) {
            this.emit('error', new Error('Unsupported critical chunk type ' + name));
            return;
        }
        else {
            this.read(length + 4, this._skipChunk.bind(this));
        }
    };
    Parser.prototype._skipChunk = function (data) {
        this.read(8, this._parseChunkBegin.bind(this));
    };
    Parser.prototype._handleChunkEnd = function () {
        this.read(4, this._parseChunkEnd.bind(this));
    };
    Parser.prototype._parseChunkEnd = function (data) {
        var fileCrc = data.readInt32BE(0);
        var calcCrc = this._crc.crc32;
        // check CRC
        if (this._option.checkCRC && calcCrc !== fileCrc) {
            this.emit('error', new Error('Crc error'));
            return;
        }
        if (this._hasIEND) {
            this.destroySoon();
        }
        else {
            this.read(8, this._parseChunkBegin.bind(this));
        }
    };
    Parser.prototype._handleIHDR = function (length) {
        this.read(length, this._parseIHDR.bind(this));
    };
    Parser.prototype._parseIHDR = function (data) {
        this._crc.write(data);
        var width = data.readUInt32BE(0);
        var height = data.readUInt32BE(4);
        var depth = data[8];
        var colorType = data[9]; // bits: 1 palette, 2 color, 4 alpha
        var compr = data[10];
        var filter = data[11];
        var interlace = data[12];
        if (depth !== 8) {
            this.emit('error', new Error('Unsupported bit depth ' + depth));
            return;
        }
        if (!(colorType in colorTypeToBppMap)) {
            this.emit('error', new Error('Unsupported color type'));
            return;
        }
        if (compr !== 0) {
            this.emit('error', new Error('Unsupported compression method'));
            return;
        }
        if (filter !== 0) {
            this.emit('error', new Error('Unsupported filter method'));
            return;
        }
        if (interlace !== 0) {
            this.emit('error', new Error('Unsupported interlace method'));
            return;
        }
        this._colorType = colorType;
        this._data = new Buffer(width * height * 4);
        this._filter = new Filter(width, height, colorTypeToBppMap[this._colorType], this._data, this._option);
        this._hasIHDR = true;
        this.emit('metadata', {
            width: width,
            height: height,
            palette: !!(colorType & constants.COLOR_PALETTE),
            color: !!(colorType & constants.COLOR_COLOR),
            alpha: !!(colorType & constants.COLOR_ALPHA),
            data: this._data
        });
        this._handleChunkEnd();
    };
    Parser.prototype._handlePLTE = function (length) {
        this.read(length, this._parsePLTE.bind(this));
    };
    Parser.prototype._parsePLTE = function (data) {
        this._crc.write(data);
        var entries = Math.floor(data.length / 3);
        for (var i = 0; i < entries; i++) {
            this._palette.push([
                data.readUInt8(i * 3),
                data.readUInt8(i * 3 + 1),
                data.readUInt8(i * 3 + 2),
                0xff
            ]);
        }
        this._handleChunkEnd();
    };
    Parser.prototype._handleTRNS = function (length) {
        this.read(length, this._parseTRNS.bind(this));
    };
    Parser.prototype._parseTRNS = function (data) {
        this._crc.write(data);
        // palette
        if (this._colorType === 3) {
            if (this._palette.length === 0) {
                this.emit('error', new Error('Transparency chunk must be after palette'));
                return;
            }
            if (data.length > this._palette.length) {
                this.emit('error', new Error('More transparent colors than palette size'));
                return;
            }
            for (var i = 0; i < this._palette.length; i++) {
                this._palette[i][3] = i < data.length ? data.readUInt8(i) : 0xff;
            }
        }
        // for colorType 0 (grayscale) and 2 (rgb)
        // there might be one gray/color defined as transparent
        this._handleChunkEnd();
    };
    Parser.prototype._handleGAMA = function (length) {
        this.read(length, this._parseGAMA.bind(this));
    };
    Parser.prototype._parseGAMA = function (data) {
        this._crc.write(data);
        this.emit('gamma', data.readUInt32BE(0) / 100000);
        this._handleChunkEnd();
    };
    Parser.prototype._handleIDAT = function (length) {
        this.read(-length, this._parseIDAT.bind(this, length));
    };
    Parser.prototype._parseIDAT = function (length, data) {
        this._crc.write(data);
        if (this._colorType === 3 && this._palette.length === 0) {
            throw new Error('Expected palette not found');
        }
        if (!this._inflate) {
            this._inflate = zlib.createInflate();
            this._inflate.on('error', this.emit.bind(this, 'error'));
            this._filter.on('complete', this._reverseFiltered.bind(this));
            this._inflate.pipe(this._filter);
        }
        this._inflate.write(data);
        length -= data.length;
        if (length > 0) {
            this._handleIDAT(length);
        }
        else {
            this._handleChunkEnd();
        }
    };
    Parser.prototype._handleIEND = function (length) {
        this.read(length, this._parseIEND.bind(this));
    };
    Parser.prototype._parseIEND = function (data) {
        this._crc.write(data);
        // no more data to inflate
        this._inflate.end();
        this._hasIEND = true;
        this._handleChunkEnd();
    };
    Parser.prototype._reverseFiltered = function (data, width, height) {
        if (this._colorType === 3) {
            var i = void 0, y = void 0, x = void 0, pxRowPos = void 0, pxPos = void 0, color = void 0;
            // use values from palette
            var pxLineLength = width << 2;
            for (y = 0; y < height; y++) {
                pxRowPos = y * pxLineLength;
                for (x = 0; x < width; x++) {
                    pxPos = pxRowPos + (x << 2),
                        color = this._palette[data[pxPos]];
                    for (i = 0; i < 4; i++) {
                        data[pxPos + i] = color[i];
                    }
                }
            }
        }
        this.emit('parsed', data);
    };
    return Parser;
}(ChunkStream));
module.exports = Parser;
