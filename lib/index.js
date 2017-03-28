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
Object.defineProperty(exports, "__esModule", { value: true });
var stream = require("stream");
var Parser = require("./parser");
var Packer = require("./packer");
var EDeflateStrategy;
(function (EDeflateStrategy) {
    EDeflateStrategy[EDeflateStrategy["DEFAULT_STRATEGY"] = 0] = "DEFAULT_STRATEGY";
    EDeflateStrategy[EDeflateStrategy["FILTERED"] = 1] = "FILTERED";
    EDeflateStrategy[EDeflateStrategy["HUFFMAN_ONLY"] = 2] = "HUFFMAN_ONLY";
    EDeflateStrategy[EDeflateStrategy["RLE"] = 3] = "RLE";
    EDeflateStrategy[EDeflateStrategy["FIXED"] = 4] = "FIXED";
})(EDeflateStrategy = exports.EDeflateStrategy || (exports.EDeflateStrategy = {}));
var EFilterType;
(function (EFilterType) {
    EFilterType[EFilterType["Auto"] = -1] = "Auto";
    EFilterType[EFilterType["None"] = 0] = "None";
    EFilterType[EFilterType["Sub"] = 1] = "Sub";
    EFilterType[EFilterType["Up"] = 2] = "Up";
    EFilterType[EFilterType["Average"] = 3] = "Average";
    EFilterType[EFilterType["Paeth"] = 4] = "Paeth";
})(EFilterType = exports.EFilterType || (exports.EFilterType = {}));
function createImage(option) {
    return new Image(option);
}
exports.createImage = createImage;
var Image = (function (_super) {
    __extends(Image, _super);
    function Image(option) {
        if (option === void 0) { option = {}; }
        var _this = _super.call(this) || this;
        _this.width = option.width || 0;
        _this.height = option.height || 0;
        if (_this.width > 0 && _this.height > 0) {
            _this.data = new Buffer(4 * _this.width * _this.height);
            if (option.fill) {
                _this.data.fill(0);
            }
        }
        else {
            _this.data = null;
        }
        _this.gamma = 0;
        _this.writable = true;
        _this._parser = new Parser(option || {});
        _this._parser.on('error', _this.emit.bind(_this, 'error'));
        _this._parser.on('close', _this._handleClose.bind(_this));
        _this._parser.on('metadata', _this._metadata.bind(_this));
        _this._parser.on('gamma', _this._gamma.bind(_this));
        _this._parser.on('parsed', function (data) {
            _this.data = data;
            _this.emit('parsed', data);
        });
        _this._packer = new Packer(option);
        _this._packer.on('data', _this.emit.bind(_this, 'data'));
        _this._packer.on('end', _this.emit.bind(_this, 'end'));
        _this._packer.on('close', _this._handleClose.bind(_this));
        _this._packer.on('error', _this.emit.bind(_this, 'error'));
        return _this;
    }
    Image.prototype.pack = function () {
        var _this = this;
        setImmediate(function () {
            _this._packer.pack(_this.data, _this.width, _this.height);
            _this.readable = true;
        });
        return this;
    };
    Image.prototype.parse = function (data, callback) {
        var _this = this;
        if (callback) {
            var onParsed_1 = null, onError_1 = null;
            this.once('parsed', onParsed_1 = function (data) {
                _this.removeListener('error', onError_1);
                _this.data = data;
                callback(null, _this);
            });
            this.once('error', onError_1 = function (err) {
                _this.removeListener('parsed', onParsed_1);
                callback(err, null);
            });
        }
        this.end(data);
        return this;
    };
    Image.prototype._write = function (data, encoding, callback) {
        return this._parser._write(data, encoding, callback);
    };
    Image.prototype.end = function (data) {
        return this._parser.end(data);
    };
    Image.prototype.bitblt = function (dst, sx, sy, w, h, dx, dy) {
        if (sx > this.width || sy > this.height || sx + w > this.width || sy + h > this.height) {
            throw new Error('bitblt reading outside image');
        }
        if (dx > dst.width || dy > dst.height || dx + w > dst.width || dy + h > dst.height) {
            throw new Error('bitblt writing outside image');
        }
        for (var y = 0; y < h; y++) {
            this.data.copy(dst.data, ((dy + y) * dst.width + dx) << 2, ((sy + y) * this.width + sx) << 2, ((sy + y) * this.width + sx + w) << 2);
        }
        return this;
    };
    Image.prototype._read = function () {
    };
    Image.prototype._metadata = function (metadata) {
        this.width = metadata.width;
        this.height = metadata.height;
        this.data = metadata.data;
        delete metadata.data;
        this.emit('metadata', metadata);
    };
    Image.prototype._gamma = function (gamma) {
        this.gamma = gamma;
    };
    Image.prototype._handleClose = function () {
        if (!this._parser.writable && !this._packer.readable) {
            this.emit('close');
        }
    };
    return Image;
}(stream.Duplex));
exports.Image = Image;
