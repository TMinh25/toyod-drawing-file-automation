import fs from 'fs';
import csv_parser from 'csv-parse/lib/sync';
import { createObjectCsvWriter, createObjectCsvStringifier } from 'csv-writer';

import { CSV_FILE_PARSING_OPTION } from './constants/csvConstant';

// Reference: https://stackabuse.com/reading-and-writing-csv-files-in-nodejs-with-node-csv/

class CSV_Helper {
  constructor(filePath, delimiter = ',', columns) {
    this.filePath = filePath;
    this.delimiter = delimiter;
    this.columns = columns;

    this.defaultParsingOption = {
      ...CSV_FILE_PARSING_OPTION,
      delimiter,
      columns,
      fromLine: 2, // skip
    };
  }

  readSync(filePath) {
    if (filePath) {
      this.filePath = filePath;
    }

    const fileContent = fs.readFileSync(this.filePath);

    return csv_parser(fileContent, this.defaultParsingOption);
  }

  stringtify(data) {
    return createObjectCsvStringifier({
      header: this.columns.map((k) => ({ id: k, title: k })),
      path: this.filePath,
      fieldDelimiter: this.delimiter,
    }).stringifyRecords(data);
  }

  async writeToFile(data, filePath) {
    if (filePath) {
      this.filePath = filePath;
    }

    const csvWriter = createObjectCsvWriter({
      header: this.columns.map((k) => ({ id: k, title: k })),
      path: this.filePath,
      fieldDelimiter: this.delimiter,
    });

    // [*] If you don't want to write a header line, don't give title to header elements
    // Reference: https://www.npmjs.com/package/csv-writer

    await csvWriter.writeRecords(data);
  }
}

export default CSV_Helper;
