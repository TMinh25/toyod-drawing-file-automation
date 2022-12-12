import sharp from 'sharp';
import debug from 'debug';

// Reference: https://sharp.pixelplumbing.com/api-operation

const appBizDebugger = debug('app:biz');

class Image_Helper {
  constructor() {
  }
  
  read(input, options) {
    // appBizDebugger(`Image_Helper.read ${input}`);

    const image = sharp(input, options);

    this.image = image;

    return image;
  }

  async getMetadata() {
    // appBizDebugger(`Image_Helper.getMetadata`);

    return await this.image.metadata();
  }

  greyscale(option) {
    return this.image.greyscale(option);
  }

  threshold(option) {
    return this.image.threshold(option);
  }

  async getRawBuffer(option) {
    return await this.image.raw(option).toBuffer({ resolveWithObject: true });;
  }

  resize(options) {
    appBizDebugger(`Image_Helper.resize with options`);

    return this.image.resize(options);
  }

  rotate(angle, options) {
    appBizDebugger(`Image_Helper.rotate:  angle=${angle || 'auto'}, options=${options}`);

    return this.image.rotate(angle , options);
  }

  resize(options) {
    appBizDebugger(`Image_Helper.resize with options`);

    return this.image.resize(options);
  }

  async crop(left, top, width, height) {
    // appBizDebugger(`Image_Helper.crop: left=${left}, top=${top}, width=${width}, height=${height}`);

    return this.image.extract({ left, top, width, height });
  }

  sharpen(sigma, flat, jagged) {
    appBizDebugger(`Image_Helper.sharpen: sigma=${sigma}, flat=${flat}, jagged=${jagged}`);

    return this.image.sharpen(sigma, flat, jagged);
  }

  blur(sigma) {
    appBizDebugger(`Image_Helper.blur: sigma=${sigma}`);

    return this.image.blur(sigma);
  }

  async writeToFile(filePath) {
    appBizDebugger(`Image_Helper.write: ${filePath}`);

    return await this.image.toFile(filePath);
  }

  async writeToBuffer() {
    appBizDebugger(`Image_Helper.writeBuffer`);

    return await this.image.toBuffer();
  }

  changeToFormat(format, options) {
    appBizDebugger(`Image_Helper.toFormat: ${format}`);

    return this.image.toFormat(format, options);
  }

  clone() {
    appBizDebugger(`Image_Helper.clone`);

    return this.image.clone();
  }
}

export default Image_Helper;
