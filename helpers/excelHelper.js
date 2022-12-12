import ExcelJS from 'exceljs';
import XLSX from 'xlsx';

import { COLUMN_MIN_WIDTH, COLUMN_MAX_WIDTH, HEADER_FONT_FORMAT, DEFAULT_SHEET_NAME } from './constants/excelConstant';

// Reference: https://www.npmjs.com/package/exceljs

class Excel_Helper {
  constructor(columns) {
    this.workbook = new ExcelJS.Workbook();
    this.columns = columns || [];
  }

  // Reference: https://www.npmjs.com/package/exceljs#reading-xlsx

  async readFile(filePath) {
    // TODO: check file existed
    await this.workbook.xlsx.readFile(filePath);
  }

  async read(stream) {
    await this.workbook.xlsx.read(stream);
  }

  async load(buffer) {
    await this.workbook.xlsx.load(buffer);
  }

  // Reference: https://www.npmjs.com/package/exceljs#reading-csv

  async readCSVFile(filePath, options) {
    await workbook.csv.readFile(filePath, options);
  }

  async readCSV(streamOrBuffer, options) {
    await this.workbook.csv.read(streamOrBuffer, options);
  }

  async getWorkbookInstant() {
    return this.workbook;
  }

  async createDataSheet(data, sheetName = DEFAULT_SHEET_NAME, columns = this.columns) {
    const worksheet = this.workbook.addWorksheet(sheetName);
    const columnsFormater = columns ? columns : this.columns;

    if (!columnsFormater) {
      if (data[0]) {
        Object.keys(data[0]).forEach((field) => {
          // TODO: i18 translation
          // Reference: https://gitlab.com/bos-microservices/core/-/blob/master/helpers/excelHelper.js

          columnsFormater.push({
            header: field,
            key: field,
          });
        });
      }
    }

    if (this.autoFormating) {
      columnsFormater.forEach((column) => {
        const columnLength = column.header.length;

        column.width = columnLength < COLUMN_MIN_WIDTH ? COLUMN_MIN_WIDTH : Math.min(COLUMN_MAX_WIDTH, columnLength);
      });

      worksheet.getRow(1).font = HEADER_FONT_FORMAT;
    }

    worksheet.columns = columnsFormater;

    worksheet.addRows(data);

    return worksheet;
  }

  // Reference: https://www.npmjs.com/package/exceljs#writing-xlsx

  async writeFile(filePath) {
    return await this.workbook.xlsx.writeFile(filePath);
  }

  async write(stream) {
    return await this.workbook.xlsx.write(stream);
  }

  async writeBuffer() {
    return await this.workbook.xlsx.writeBuffer();
  }

  // Reference: https://www.npmjs.com/package/exceljs#writing-csv

  async writeCSVFile(filePath) {
    return await this.workbook.csv.writeFile(filePath);
  }

  async writeCSVStream(stream) {
    return await workbook.csv.write(stream);
  }

  // TODO: add manual data manupulation
  // [..] Formula, Tabling, Formating Reference: https://www.brcline.com/blog/how-to-write-an-excel-file-in-nodejs
}

export function getHeadersXLSX(sheet) {
  var header = 0,
    offset = 1;
  var hdr = [];
  var o = {};
  if (sheet == null || sheet['!ref'] == null) return [];
  var range = o.range !== undefined ? o.range : sheet['!ref'];
  var r;
  if (o.header === 1) header = 1;
  else if (o.header === 'A') header = 2;
  else if (Array.isArray(o.header)) header = 3;
  switch (typeof range) {
    case 'string':
      r = safe_decode_range(range);
      break;
    case 'number':
      r = safe_decode_range(sheet['!ref']);
      r.s.r = range;
      break;
    default:
      r = range;
  }
  if (header > 0) offset = 0;
  var rr = XLSX.utils.encode_row(r.s.r);
  var cols = new Array(r.e.c - r.s.c + 1);
  for (var C = r.s.c; C <= r.e.c; ++C) {
    cols[C] = XLSX.utils.encode_col(C);
    var val = sheet[cols[C] + rr];
    switch (header) {
      case 1:
        hdr.push(C);
        break;
      case 2:
        hdr.push(cols[C]);
        break;
      case 3:
        hdr.push(o.header[C - r.s.c]);
        break;
      default:
        if (val === undefined) continue;
        hdr.push(XLSX.utils.format_cell(val));
    }
  }
  return hdr;
}

export function safe_decode_range(range) {
  var o = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  var idx = 0,
    i = 0,
    cc = 0;
  var len = range.length;
  for (idx = 0; i < len; ++i) {
    if ((cc = range.charCodeAt(i) - 64) < 1 || cc > 26) break;
    idx = 26 * idx + cc;
  }
  o.s.c = --idx;

  for (idx = 0; i < len; ++i) {
    if ((cc = range.charCodeAt(i) - 48) < 0 || cc > 9) break;
    idx = 10 * idx + cc;
  }
  o.s.r = --idx;

  if (i === len || range.charCodeAt(++i) === 58) {
    o.e.c = o.s.c;
    o.e.r = o.s.r;
    return o;
  }

  for (idx = 0; i != len; ++i) {
    if ((cc = range.charCodeAt(i) - 64) < 1 || cc > 26) break;
    idx = 26 * idx + cc;
  }
  o.e.c = --idx;

  for (idx = 0; i != len; ++i) {
    if ((cc = range.charCodeAt(i) - 48) < 0 || cc > 9) break;
    idx = 10 * idx + cc;
  }
  o.e.r = --idx;
  return o;
}

export default Excel_Helper;
