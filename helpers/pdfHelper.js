import { getDocument } from 'pdfjs-dist/legacy/build/pdf';
import { fromPath } from 'pdf2pic'; // fromBase64, fromBuffer
import PDF2Printer from 'pdf-to-printer';
import debug from 'debug';
// import HummusRecipe from 'hummus-recipe';
// import rimraf  from 'rimraf';

const appBizDebugger = debug('app:biz');

class Pdf_Helper {
  constructor(srcFile) {
    this.srcFile = srcFile;
  }

  async read(srcFile) {
    if (srcFile) {
      this.srcFile = srcFile;
    }

    this.doc = await getDocument(srcFile).promise;
  }

  async getPageSize(pageNo) {
    const page = await this.doc.getPage(pageNo);

    // try: page.pageInfo.view: https://techoverflow.net/2018/04/13/extract-pdf-page-sizes-using-pdfjs-nodejs/

    return {
      width: page.view[2],
      height: page.view[3],
    };
  }

  nomalizeText(pageContent, joinedResult = false) {
    if (joinedResult) {
      return pageContent.items
        .filter((item) => item.str.trim().length)
        .map((item) => item.str)
        .join(' ')
        .replace(' . ', '. ');
    } else {
      return pageContent.items.filter((item) => item.str.trim().length).map((item) => item.str);
    }
  }

  async getPageText(pageNo = 1, joinedResult = false) {
    const page = await this.doc.getPage(pageNo);
    const pageContent = await page.getTextContent();

    return this.nomalizeText(pageContent, joinedResult);
  }

  async getDocumentText(joinedResult = false) {
    const maxPages = this.doc.numPages;
    const documentContent = [];

    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const page = await this.doc.getPage(pageNo);
      const pageContent = await page.getTextContent();

      documentContent.push(this.nomalizeText(pageContent, joinedResult));
    }

    return documentContent;
  }

  // Raw version of getPageText
  async getPageContent(pageNo = 1) {
    const page = await this.doc.getPage(pageNo);

    return await page.getTextContent();
  }

  // Raw version of getDocumentText
  async getDocumentContent() {
    const maxPages = this.doc.numPages;
    const documentContent = [];

    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const page = await this.doc.getPage(pageNo);
      const pageContent = await page.getTextContent();

      documentContent.push(pageContent);
    }

    return documentContent;
  }

  // Reference: https://github.com/yakovmeister/pdf2pic-examples/blob/master/from-file-to-image.js
  async convertToImage(options, pageNo = 1, toBase64 = false) {
    const converter = fromPath(this.srcFile, options);

    appBizDebugger(`PDF.convertToImage: ${this.srcFile}`);

    return await converter(pageNo, toBase64);
  }

  async bulkToImages(filePath, options, pagesNo = -1, toBase64 = false) {
    const converter = fromPath(filePath, options);

    appBizDebugger(`PDF.bulkToImage: ${this.srcFile}`);

    return await converter.bulk(pagesNo, toBase64);
  }

  // encrypt(outputFile, password) {
  //   const pdfDoc = new HummusRecipe(this.srcFile, outputFile);

  //   // Reference https://hummus-recipe.s3.amazonaws.com/docs/Recipe.html#.encrypt
  //   //           https://hummus-recipe.s3.amazonaws.com/docs/encrypt.js.html

  //   pdfDoc.encrypt({
  //       userPassword: password,
  //       ownerPassword: password,
  //       userProtectionFlag: 4 // => default "print" permission
  //   }).endPDF();
  // }

  // Reference: https://www.npmjs.com/package/pdf-to-printer
  async print(filePath, options) {
    return await PDF2Printer.print(filePath, options);
  }

  async getPrinterList() {
    return await PDF2Printer.getPrinters();
  }

  async getDefaultPrinter() {
    return await PDF2Printer.getDefaultPrinter();
  }

  async printToDefaultPrinter(filePath) {
    const options = {
      printer: await getDefaultPrinter(),
      unix: ['-o fit-to-page'], // Reference: https://www.computerhope.com/unix/ulp.htm
      win32: ['-print-settings "fit"'], // Reference: https://www.sumatrapdfreader.org/docs/Command-line-arguments.html
    };

    return await PDF2Printer.print(filePath, options);
  }
}

export default Pdf_Helper;
