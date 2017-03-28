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
var ChunkStream = require("./chunk-stream");
var pixelBppMap = {
    1: {
        0: 0,
        1: 0,
        2: 0,
        3: 0xff
    },
    2: {
        0: 0,
        1: 0,
        2: 0,
        3: 1
    },
    3: {
        0: 0,
        1: 1,
        2: 2,
        3: 0xff
    },
    4: {
        0: 0,
        1: 1,
        2: 2,
        3: 3
    }
};
function PaethPredictor(left, above, upLeft) {
    var p = left + above - upLeft;
    var pLeft = Math.abs(p - left);
    var pAbove = Math.abs(p - above);
    var pUpLeft = Math.abs(p - upLeft);
    if (pLeft <= pAbove && pLeft <= pUpLeft) {
        return left;
    }
    else if (pAbove <= pUpLeft) {
        return above;
    }
    else {
        return upLeft;
    }
}
;
var Filter = (function (_super) {
    __extends(Filter, _super);
    function Filter(width, height, bpp, data, option) {
        var _this = _super.call(this) || this;
        _this._width = width;
        _this._height = height;
        _this._bpp = bpp;
        _this._data = data;
        _this._option = option;
        _this._line = 0;
        if (option.filterType === undefined || option.filterType === -1) {
            _this._filterTypes = [0, 1, 2, 3, 4];
        }
        else if (typeof option.filterType === 'number') {
            _this._filterTypes = [option.filterType];
        }
        _this._filters = {
            0: _this._filterNone.bind(_this),
            1: _this._filterSub.bind(_this),
            2: _this._filterUp.bind(_this),
            3: _this._filterAvg.bind(_this),
            4: _this._filterPaeth.bind(_this)
        };
        _this.read(_this._width * bpp + 1, _this._reverseFilterLine.bind(_this));
        return _this;
    }
    Filter.prototype.filter = function () {
        var pxData = this._data;
        var rawData = new Buffer(((this._width << 2) + 1) * this._height);
        var i, l, y, min, sel, sum;
        for (y = 0; y < this._height; y++) {
            // find best filter for this line (with lowest sum of values)
            min = Infinity;
            sel = 0;
            for (i = 0, l = this._filterTypes.length; i < l; i++) {
                sum = this._filters[this._filterTypes[i]](pxData, y, null);
                if (sum < min) {
                    sel = this._filterTypes[i];
                    min = sum;
                }
            }
            this._filters[sel](pxData, y, rawData);
        }
        return rawData;
    };
    Filter.prototype._reverseFilterLine = function (rawData) {
        var pxData = this._data;
        var pxLineLength = this._width << 2;
        var pxRowPos = this._line * pxLineLength;
        var filter = rawData[0];
        var i, x, pxPos, rawPos, idx, left, up, add, upLeft;
        if (filter === 0) {
            for (x = 0; x < this._width; x++) {
                pxPos = pxRowPos + (x << 2);
                rawPos = 1 + x * this._bpp;
                for (i = 0; i < 4; i++) {
                    idx = pixelBppMap[this._bpp][i];
                    pxData[pxPos + i] = idx !== 0xff ? rawData[rawPos + idx] : 0xff;
                }
            }
        }
        else if (filter === 1) {
            for (x = 0; x < this._width; x++) {
                pxPos = pxRowPos + (x << 2);
                rawPos = 1 + x * this._bpp;
                for (i = 0; i < 4; i++) {
                    idx = pixelBppMap[this._bpp][i];
                    left = x > 0 ? pxData[pxPos + i - 4] : 0;
                    pxData[pxPos + i] = idx !== 0xff ? rawData[rawPos + idx] + left : 0xff;
                }
            }
        }
        else if (filter === 2) {
            for (x = 0; x < this._width; x++) {
                pxPos = pxRowPos + (x << 2);
                rawPos = 1 + x * this._bpp;
                for (i = 0; i < 4; i++) {
                    idx = pixelBppMap[this._bpp][i];
                    up = this._line > 0 ? pxData[pxPos - pxLineLength + i] : 0;
                    pxData[pxPos + i] = idx !== 0xff ? rawData[rawPos + idx] + up : 0xff;
                }
            }
        }
        else if (filter === 3) {
            for (x = 0; x < this._width; x++) {
                pxPos = pxRowPos + (x << 2);
                rawPos = 1 + x * this._bpp;
                for (i = 0; i < 4; i++) {
                    idx = pixelBppMap[this._bpp][i];
                    left = x > 0 ? pxData[pxPos + i - 4] : 0;
                    up = this._line > 0 ? pxData[pxPos - pxLineLength + i] : 0;
                    add = Math.floor((left + up) / 2);
                    pxData[pxPos + i] = idx !== 0xff ? rawData[rawPos + idx] + add : 0xff;
                }
            }
        }
        else if (filter === 4) {
            for (x = 0; x < this._width; x++) {
                pxPos = pxRowPos + (x << 2);
                rawPos = 1 + x * this._bpp;
                for (i = 0; i < 4; i++) {
                    idx = pixelBppMap[this._bpp][i];
                    left = x > 0 ? pxData[pxPos + i - 4] : 0;
                    up = this._line > 0 ? pxData[pxPos - pxLineLength + i] : 0;
                    upLeft = x > 0 && this._line > 0 ? pxData[pxPos - pxLineLength + i - 4] : 0;
                    add = PaethPredictor(left, up, upLeft);
                    pxData[pxPos + i] = idx !== 0xff ? rawData[rawPos + idx] + add : 0xff;
                }
            }
        }
        this._line++;
        if (this._line < this._height) {
            this.read(this._width * this._bpp + 1, this._reverseFilterLine.bind(this));
        }
        else {
            this.emit('complete', this._data, this._width, this._height);
        }
    };
    Filter.prototype._filterNone = function (pxData, y, rawData) {
        var pxRowLength = this._width << 2;
        var rawRowLength = pxRowLength + 1;
        var sum = 0;
        if (!rawData) {
            for (var x = 0; x < pxRowLength; x++) {
                sum += Math.abs(pxData[y * pxRowLength + x]);
            }
        }
        else {
            rawData[y * rawRowLength] = 0;
            pxData.copy(rawData, rawRowLength * y + 1, pxRowLength * y, pxRowLength * (y + 1));
        }
        return sum;
    };
    Filter.prototype._filterSub = function (pxData, y, rawData) {
        var pxRowLength = this._width << 2;
        var rawRowLength = pxRowLength + 1;
        var sum = 0;
        var left, val;
        if (rawData) {
            rawData[y * rawRowLength] = 1;
        }
        for (var x = 0; x < pxRowLength; x++) {
            left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0;
            val = pxData[y * pxRowLength + x] - left;
            if (!rawData) {
                sum += Math.abs(val);
            }
            else {
                rawData[y * rawRowLength + 1 + x] = val;
            }
        }
        return sum;
    };
    Filter.prototype._filterUp = function (pxData, y, rawData) {
        var pxRowLength = this._width << 2;
        var rawRowLength = pxRowLength + 1;
        var sum = 0;
        var up, val;
        if (rawData) {
            rawData[y * rawRowLength] = 2;
        }
        for (var x = 0; x < pxRowLength; x++) {
            up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0;
            val = pxData[y * pxRowLength + x] - up;
            if (!rawData) {
                sum += Math.abs(val);
            }
            else {
                rawData[y * rawRowLength + 1 + x] = val;
            }
        }
        return sum;
    };
    Filter.prototype._filterAvg = function (pxData, y, rawData) {
        var pxRowLength = this._width << 2;
        var rawRowLength = pxRowLength + 1;
        var sum = 0;
        var left, up, val;
        if (rawData) {
            rawData[y * rawRowLength] = 3;
        }
        for (var x = 0; x < pxRowLength; x++) {
            left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0;
            up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0;
            val = pxData[y * pxRowLength + x] - ((left + up) >> 1);
            if (!rawData) {
                sum += Math.abs(val);
            }
            else {
                rawData[y * rawRowLength + 1 + x] = val;
            }
        }
        return sum;
    };
    Filter.prototype._filterPaeth = function (pxData, y, rawData) {
        var pxRowLength = this._width << 2;
        var rawRowLength = pxRowLength + 1;
        var sum = 0;
        var left, up, upLeft, val;
        if (rawData) {
            rawData[y * rawRowLength] = 4;
        }
        for (var x = 0; x < pxRowLength; x++) {
            left = x >= 4 ? pxData[y * pxRowLength + x - 4] : 0;
            up = y > 0 ? pxData[(y - 1) * pxRowLength + x] : 0;
            upLeft = x >= 4 && y > 0 ? pxData[(y - 1) * pxRowLength + x - 4] : 0;
            val = pxData[y * pxRowLength + x] - PaethPredictor(left, up, upLeft);
            if (!rawData) {
                sum += Math.abs(val);
            }
            else {
                rawData[y * rawRowLength + 1 + x] = val;
            }
        }
        return sum;
    };
    return Filter;
}(ChunkStream));
module.exports = Filter;
