import fs from 'fs';
import moment from 'moment';
import path from 'path';
import { emptyCellBorder, emptyCellStyle } from './helpers/constants/excelConstant';
import { Excel } from './helpers';
import { DEBUG_FOLDER } from './helpers/constants/drawingFileConstants';
import SMTP from './helpers/smtpHelper';
import { getHeadersXLSX } from './helpers/excelHelper';
import { readFile, utils } from 'xlsx';

export const daysBetween = (d1, d2) => {
  // The number of milliseconds in one day
  const oneDay = 86400000;

  d1 = startOfDay(d1);
  d2 = startOfDay(d2);

  if (equalToDate(d1, d2)) {
    return 0;
  }

  return Math.floor((d2 - d1) / oneDay) - 1;
};

export function removeFolderForce(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
}

export function upsertDirectory(folderPath) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  } else {
    fs.rmSync(folderPath, { recursive: true, force: true });
    fs.mkdirSync(folderPath);
  }
}

export function getFilesInFolder(folderPath) {
  const files = fs.readdirSync(path.resolve(folderPath));
  return files;
}

export function getTodayExcelData(excelFilePath) {
  try {
    const workbook = readFile(excelFilePath, { cellStyles: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = getHeadersXLSX(worksheet);
    const excelData = utils.sheet_to_json(worksheet);

    const drawing = [];

    for (const row of excelData) {
      drawing.push({
        received: row[headers[0]],
        // received: Boolean(row[headers[0]]) ? '✓' : undefined,
        inhouseDc: row[headers[1]],
        customerDc: row[headers[2]],
        aKeyNo: row[headers[3]],
        partNo: row[headers[4]],
        dwgNo: row[headers[5]],
        name: row[headers[6]],
        dwgDiv: row[headers[7]],
        issue: row[headers[8]],
        dept: row[headers[9]],
        releaseDate: row[headers[10]],
        dwgType: row[headers[11]],
        oldKeyNo: row[headers[12]],
        newKeyNo: row[headers[13]],
        add: row[headers[14]],
        discon: row[headers[15]],
        'CD/C': row[headers[16]],
        'ID/C': row[headers[17]],
        partName: row[headers[18]],
        size: row[headers[19]],
        cause: row[headers[20]],
      });
    }

    const mergeStartRowIndex = [...new Set(worksheet['!merges'].map((item) => item.s.r))];
    const mergeEndRowIndex = [...new Set(worksheet['!merges'].map((item) => item.e.r))];
    const mergeRows = [];
    for (let i = 0; i < mergeStartRowIndex.length; i++) {
      mergeRows.push({ start: mergeStartRowIndex[i] + 1, end: mergeEndRowIndex[i] + 1 });
    }
    return { drawing, mergeRows };
  } catch (error) {
    console.error({ error });
  }
}

export async function getTodayExcelWithSite(data, mergeRows) {
  const excel = new Excel();
  await excel.readFile('./templates/check-day.xlsx');
  const workbook = await excel.getWorkbookInstant();
  const worksheet = workbook.getWorksheet(1);
  let rowIndex = 2;
  for (const row of Array.from(data).reverse()) {
    // TODO: change site cell color for more vibrant cell
    // can change cell color after insertRow
    // if (row.site === 'VNTEC') {
    //   worksheet.getCell(`V${rowIndex}`).fill = {
    //     fgColor: { argb: 'F0F0F0F0' },
    //   };
    // }
    worksheet.insertRow(
      3,
      [
        row.received,
        row.inhouseDc,
        row.customerDc,
        row.aKeyNo,
        row.partNo,
        row.dwgNo,
        row.name,
        row.dwgDiv,
        row.issue,
        row.dept,
        row.release,
        row.dwgType,
        row.oldKeyNo,
        row.newKeyNo,
        row.add,
        row.discon,
        row['CD/C'],
        row['ID/C'],
        row.partName,
        row.size,
        row.cause,
        row.site,
      ],
      'i+'
    );
    rowIndex++;
  }
  worksheet.spliceRows(2, 1);

  mergeRows.forEach((row) => {
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'V'].forEach((col) => {
      worksheet.mergeCells(`${col}${row.start}:${col}${row.end}`);
    });
  });

  const buffer = await excel.writeBuffer();
  await excel.writeFile(`./cache/temp/debug/test.xlsx`); // DEBUG
  return buffer;
}

export const getDaysByMonth = (month) => {
  const daysInMonth = moment({ month }).daysInMonth();
  return Array.from({ length: daysInMonth }, (v, k) => k + 1);
};

export async function sendMail(NOREPLY_MAIL_SMTP, EMAIL_NOTIFICATION, data) {
  const smtp = new SMTP(NOREPLY_MAIL_SMTP);
  const { mailSubject, mailBody, attachments } = data;
  smtp.send(EMAIL_NOTIFICATION, [], mailSubject, mailBody, attachments, async (err, info) => {
    if (err) {
      console.log(`Error when trying to send email: ${err}`);
    }
    console.log('Send mail success!', info);
  });
}

export async function getCheckDrawingExcel(result, performer, poChecker) {
  const currentMonth = moment().month();

  const checkExcel = result.map((data) => ({
    ...data,
    performer: performer,
    checker: poChecker,
  }));

  const excel = new Excel();
  await excel.readFile('./templates/drawing-check.xlsx');
  const workbook = await excel.getWorkbookInstant();
  const sheet = workbook.getWorksheet(1);
  dateLoop: for (let rIndex = 0; rIndex < checkExcel.length; rIndex++) {
    const data = checkExcel[rIndex];
    if (data.totalDrawings === 0) {
      sheet.insertRow(rIndex + 4, []);
      for (let cIndex = 1; cIndex <= 12; cIndex++) {
        const cell = sheet.getCell(rIndex + 4, cIndex);
        cell.style = emptyCellStyle;
        cell.border = emptyCellBorder;

        if (cIndex === 1) {
          cell.value = data.dateFormat;
        } else if (cIndex === 10) {
          cell.value = 'VNTEC 休日';
        }
        // else {
        //   cell.border.diagonal = {
        //     up: false,
        //     down: false,
        //     style: 'thin',
        //   };
        // }
      }
      continue dateLoop;
    }

    const rowData = [
      data.dateFormat,
      data.totalDrawings,
      data.totalChecked,
      data.S0AndTRCount,
      data.receivedAndPublishedCount,
      data.totalVNTec,
      data.checkedNotVNTec,
      data.uncheckedNotVNTec,
      data.totalNotVNTec,
      data.note,
      data.performer,
      data.checker,
    ];
    sheet.insertRow(rIndex + 4, rowData, 'o+');
  }
  const totalRowIndex = getDaysByMonth(currentMonth).length + 3;
  const totalRow = sheet.getRow(totalRowIndex + 2);

  totalRow.getCell(1).value = moment().format('[Total] TM/YYYY');
  totalRow.getCell(2).value = { formula: `SUM(B4: B${totalRowIndex})` };
  totalRow.getCell(3).value = { formula: `SUM(C4: C${totalRowIndex})` };
  totalRow.getCell(4).value = { formula: `SUM(D4: D${totalRowIndex})` };
  totalRow.getCell(5).value = { formula: `SUM(E4: E${totalRowIndex})` };
  totalRow.getCell(6).value = { formula: `SUM(F4: F${totalRowIndex})` };
  totalRow.getCell(7).value = { formula: `SUM(G4: G${totalRowIndex})` };
  totalRow.getCell(8).value = { formula: `SUM(H4: H${totalRowIndex})` };
  totalRow.getCell(9).value = { formula: `SUM(I4: I${totalRowIndex})` };
  await excel.writeFile('./debug/test-report.xlsx');
  return excel;
}
