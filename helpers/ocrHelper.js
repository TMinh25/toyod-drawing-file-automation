import Tesseract from 'tesseract.js';
import debug from 'debug';
import path from 'path';
import { isFunction } from 'lodash';

import { OCR_CACHE_PATH } from './constants/ocrConstant';

const appBizDebugger = debug('app:biz');

class OCRHelper {
  constructor(language = 'eng') {
    this.language = language;
  }

  async createWorker(logger) {
    const defaultLogger = (m) => {
      const { workerId, status, progress } = m;
      // appBizDebugger(`OCR_Helper.log: Status: ${status}; Progress: ${Math.trunc(progress * 100)} %;  Worker Id: ${workerId || 'x'};`);
    };

    const worker = Tesseract.createWorker({
      logger: logger || defaultLogger,

      cachePath: path.join(OCR_CACHE_PATH),
    });

    const { language } = this;

    await worker.load();
    await worker.loadLanguage(language);
    await worker.initialize(language);

    this.worker = worker;
  }

  async setParameters(options) {
    const { worker } = this;

    if (!worker) {
      this.createWorker();
    }

    await worker.setParameters(options);
  }

  async recognize(input, resultParser) {
    return new Promise(async (resolve, reject) => {
      try {
        const { worker } = this;

        if (!worker) {
          this.createWorker();
        }

        const result = await worker.recognize(input);

        // appBizDebugger('OCR_Helper recognized result: ');
        // appBizDebugger(JSON.stringify(result, undefined, 2));

        let text, confidence;

        if (isFunction(resultParser)) {
          ({ text, confidence } = resultParser(result));
        } else {
          ({ text, confidence } = result.data);
        }

        // appBizDebugger(`OCR_Helper recognized text with confidence ${Math.trunc(confidence)} (%) confidence: \n${text}`);

        resolve({ text, confidence });
      } catch (error) {
        reject(error);
      }
    });
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
    }
  }
}

export default OCRHelper;
