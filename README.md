# png-async
A simple and **non-blocking** PNG encoder / decoder for Node.

[![TypeScript definitions on DefinitelyTyped][dts-img]][dts-url]
[![npm version][npm-img]][npm-url]
[![Linux Build][travis-img]][travis-url]
[![Windows Build][appveyor-img]][appveyor-url]
[![devDependency Status][devdep-img]][devdep-url]

forked from [node-png](https://github.com/leogiese/node-png).

## Install

```bash
$ npm install png-async --save
```

## Build (for Developers)

```bash
$ git clone https://github.com/kanreisa/node-png-async.git
$ cd node-png-async
$ npm install
$ npm run typings-install
$ npm run build
```

## Example

```js
var fs = require('fs');
var png = require('png-async');

fs.createReadStream('in.png')
    .pipe(png.createImage({
        filterType: 4
    }))
    .on('parsed', function () {

        // Note: this is blocking. be careful.
        for (var y = 0; y < this.height; y++) {
            for (var x = 0; x < this.width; x++) {
                var idx = (this.width * y + x) << 2;

                // invert color
                this.data[idx] = 255 - this.data[idx];
                this.data[idx+1] = 255 - this.data[idx+1];
                this.data[idx+2] = 255 - this.data[idx+2];

                // and reduce opacity
                this.data[idx+3] = this.data[idx+3] >> 1;
            }
        }

        this.pack().pipe(fs.createWriteStream('out.png'));
    });
```
For more examples see `examples` folder.

## Documentation

As input any color type is accepted (grayscale, rgb, palette, grayscale with alpha, rgb with alpha) but 8 bit per sample (channel) is the only supported bit depth. Interlaced mode is not supported.

#### Supported ancillary chunks
* `gAMA` - gamma,
* `tRNS` - transparency (but only for paletted image)

### Class: Image

`Image` is readable and writable `Stream`.

#### Options

- `width` - use this with `height` if you want to create png from scratch
- `height` - as above
- `checkCRC` - whether parser should be strict about checksums in source stream (default: `true`)
- `deflateChunkSize` - chunk size used for deflating data chunks, this should be power of 2 and must not be less than 256 and more than 32*1024 (default: 32 kB)
- `deflateLevel` - compression level for delate (default: 9)
- `deflateStrategy` - compression strategy for delate (default: 3)
- `filterType` - png filtering method for scanlines (default: -1 => auto, accepts array of numbers 0-4)

#### Event "metadata"

`function(metadata) { }`
Image's header has been parsed, metadata contains this information:
- `width` image size in pixels
- `height` image size in pixels
- `palette` image is paletted
- `color` image is not grayscale
- `alpha` image contains alpha channel

#### Event: "parsed"

`function(data) { }`
Input image has been completly parsed, `data` is complete and ready for modification.


#### Event: "error"

`function(error) { }`

#### Image#parse(data: Buffer, callback?: (err: Error, image: Image) => void): Image

Parses PNG file data. Alternatively you can stream data to instance of PNG.

Optional `callback` is once called on `error` or `parsed`. The callback gets
two arguments `(err, data)`.

Returns `this` for method chaining.

#### Image#pack(): Image

Starts converting data to PNG file Stream.

Returns `this` for method chaining.


#### Image#bitblt(dst: Image, sx: number, sy: number, w: number, h: number, dx: number, dy: number): Image

Helper for image manipulation, copies rectangle of pixels from current image (`sx`, `sy`, `w`, `h`) to `dst` image (at `dx`, `dy`).

Returns `this` for method chaining.


#### Image#width: number

Width of image in pixels


#### Image#height: number

Height of image in pixels


#### Image#data: Buffer

Buffer of image pixel data. Every pixel consists 4 bytes: R, G, B, A (opacity).


#### Image#gamma: number

Gamma of image (0 if not specified)

## License

[MIT](LICENSE)

[npm-img]: https://img.shields.io/npm/v/png-async.svg
[npm-url]: https://npmjs.org/package/png-async
[dts-img]: https://img.shields.io/badge/DefinitelyTyped-.d.ts-1a8bcb.svg
[dts-url]: http://definitelytyped.org/
[travis-img]: https://img.shields.io/travis/kanreisa/node-png-async.svg
[travis-url]: https://travis-ci.org/kanreisa/node-png-async
[appveyor-img]: https://img.shields.io/appveyor/ci/kanreisa/node-png-async.svg
[appveyor-url]: https://ci.appveyor.com/project/kanreisa/node-png-async
[devdep-img]: https://david-dm.org/kanreisa/node-png-async/dev-status.svg
[devdep-url]: https://david-dm.org/kanreisa/node-png-async#info=devDependencies
