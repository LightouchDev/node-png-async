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
var stream = require("stream");
var ChunkStream = (function (_super) {
    __extends(ChunkStream, _super);
    function ChunkStream() {
        var _this = _super.call(this) || this;
        _this.destroySoon = _this.end;
        _this._buffers = [];
        _this._buffered = 0;
        _this._reads = [];
        _this._paused = false;
        _this.writable = true;
        return _this;
    }
    ChunkStream.prototype._read = function (size) {
        throw new Error('Not implemented');
    };
    ChunkStream.prototype._write = function (data, encoding, cb) {
        var _this = this;
        if (this.writable === false) {
            cb(new Error('Stream not writable'));
            return false;
        }
        this._buffers.push(data);
        this._buffered += data.length;
        setImmediate(function () { return _this._process(); });
        // ok if there are no more read requests
        if (this._reads && this._reads.length === 0) {
            this._paused = true;
        }
        cb();
    };
    ChunkStream.prototype.read = function (length, callback) {
        var _this = this;
        this._reads.push({
            length: Math.abs(length),
            allowLess: length < 0,
            func: callback
        });
        setImmediate(function () {
            _this._process();
            // its paused and there is not enought data then ask for more
            if (_this._paused && _this._reads.length > 0) {
                _this._paused = false;
                _this.emit('drain');
            }
        });
    };
    ChunkStream.prototype.end = function (data) {
        var _this = this;
        if (data) {
            this.write(data);
        }
        this.writable = false;
        // already destroyed
        if (!this._buffers)
            return;
        // enqueue or handle end
        if (this._buffers.length === 0) {
            this._end();
        }
        else {
            this._buffers.push(null);
            setImmediate(function () { return _this._process(); });
        }
    };
    ChunkStream.prototype.destroy = function () {
        if (!this._buffers) {
            return;
        }
        this.writable = false;
        this._reads = null;
        this._buffers = null;
        this.emit('close');
    };
    ChunkStream.prototype._end = function () {
        if (this._reads.length > 0) {
            this.emit('error', new Error('There are some read requests waitng on finished stream'));
        }
        this.destroy();
    };
    ChunkStream.prototype._process = function () {
        var buf, data, len, pos, count, read;
        // as long as there is any data and read requests
        while (this._buffered > 0 && this._reads && this._reads.length > 0) {
            read = this._reads[0];
            // read any data (but no more than length)
            if (read.allowLess) {
                // ok there is any data so that we can satisfy this request
                this._reads.shift(); // == read
                // first we need to peek into first buffer
                buf = this._buffers[0];
                // ok there is more data than we need
                if (buf.length > read.length) {
                    this._buffered -= read.length;
                    this._buffers[0] = buf.slice(read.length);
                    read.func.call(this, buf.slice(0, read.length));
                }
                else {
                    // ok this is less than maximum length so use it all
                    this._buffered -= buf.length;
                    this._buffers.shift(); // == buf
                    read.func.call(this, buf);
                }
            }
            else if (this._buffered >= read.length) {
                // ok we can meet some expectations
                this._reads.shift(); // == read
                pos = 0;
                count = 0;
                data = new Buffer(read.length);
                // create buffer for all data
                while (pos < read.length) {
                    buf = this._buffers[count++];
                    len = Math.min(buf.length, read.length - pos);
                    buf.copy(data, pos, 0, len);
                    pos += len;
                    // last buffer wasn't used all so just slice it and leave
                    if (len !== buf.length) {
                        this._buffers[--count] = buf.slice(len);
                    }
                }
                // remove all used buffers
                if (count > 0) {
                    this._buffers.splice(0, count);
                }
                this._buffered -= read.length;
                read.func.call(this, data);
            }
            else {
                // not enought data to satisfy first request in queue
                // so we need to wait for more
                break;
            }
        }
        if (this._buffers && this._buffers.length > 0 && this._buffers[0] === null) {
            this._end();
        }
    };
    return ChunkStream;
}(stream.Duplex));
module.exports = ChunkStream;
