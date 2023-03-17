import { format } from 'date-and-time';
import debug from 'debug';
import fs from 'fs';
import fse from 'fs-extra';
import { isArray } from 'lodash';
import path from 'path';
import { readFile, utils } from 'xlsx';
import { Excel } from './helpers';
import { otSubNoRegex, subNoRegex } from './helpers/constants/drawingFileConstants';
import { emptyCellBorder, emptyCellStyle } from './helpers/constants/excelConstant';
import { getHeadersXLSX } from './helpers/excelHelper';
import SMTP from './helpers/smtpHelper';

const appBizDebugger = debug('app:biz');

export function replaceSiteNames(sites, replaceNames) {
  if (typeof sites === 'string') {
    if (replaceNames[sites]) {
      return replaceNames[sites];
    }
    return sites;
  } else if (isArray(sites)) {
    return sites.map((site) => {
      if (replaceNames[site]) {
        return replaceNames[site];
      }
      return site;
    });
  }
}

export function getDateFromExcelValue(excelDate) {
  // JavaScript dates can be constructed by passing milliseconds
  // since the Unix epoch (January 1, 1970) example: new Date(12312512312);

  // 1. Subtract number of days between Jan 1, 1900 and Jan 1, 1970, plus 1 (Google "excel leap year bug")             
  // 2. Convert to milliseconds.

  const timezoneDate = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
  const timezone = 7;

  return new Date(timezoneDate.setHours(timezoneDate.getHours() - timezone));
}

export const normalizeString = (s) => {
  return String(s).replace(/\&nbsp;/g, " ").replace(/\&lt;|\&gt;/g, " ").replace(/\s{1,}|\t{1,}/, " ");
}

export const getHighestSubCode = (pKeyNoWithSub, pKeyNoList = []) => {
  if (!pKeyNoWithSub) {
    return undefined;
  }

  const subNo = getSubNumber(pKeyNoWithSub);
  const pKeyNo = getTruePKeyNo(pKeyNoWithSub);
  let highestSub = 0;

  Array.from(pKeyNoList).forEach((no) => {
    const sub = getSubNumber(no);

    if (sub > highestSub && sub <= subNo - 1) {
      highestSub = sub;
    }
  });

  if (!highestSub) {
    return undefined;
  }

  // if (pKeyNoWithSub.match(otSubNoRegex)) {
  //   highestSub -= 1;
  // }

  const highestCode = pKeyNo + `-${('00' + highestSub).slice(-2)}`;
  return { pKeyNo, subNo, highestCode, highestSub };
}

export const getTrueAKeyNo = (aKeyNo) => {
  const subKeyNoRegex = /\w{1}\d{1}$/;
  if (!String(aKeyNo).match(subKeyNoRegex)) {
    return String(aKeyNo);
  } else {
    return String(aKeyNo).slice(0, aKeyNo.length - 2);
  }
}

export const getSubNumber = pKeyNo => {
  return pKeyNo.match(otSubNoRegex) ?
    Number(pKeyNo.split("A").at(-1).replace(/\D/g, '')) :
    pKeyNo.match(subNoRegex) ?
      Number(pKeyNo.split("-").at(-1)) :
      1;
}

export const getTruePKeyNo = (pKeyNo) => {
  return pKeyNo.match(otSubNoRegex) ?
    pKeyNo.slice(0, -2) :
    pKeyNo.match(subNoRegex) ?
      pKeyNo.slice(0, 6) :
      pKeyNo;
}

export const stringEqual = (s1, s2) => String(s1).toLowerCase().trim() === String(s2).toLowerCase().trim();

export const startOfDay = (date) => new Date(new Date(date).setHours(0, 0, 0, 0))

export const daysBetween = (d1, d2) => {
  // The number of milliseconds in one day
  const oneDay = 86400000;

  d1 = startOfDay(d1);
  d2 = startOfDay(d2);

  return Math.abs(Math.floor((d2 - d1) / oneDay));
};

export function removeFolder(folderPath, options) {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, ...options });
  }
}

export async function upsertDirectory(folderPath) {
  try {
    if (!fse.existsSync(folderPath)) {
      await fse.ensureDir(folderPath);
      fse.chmodSync(folderPath, '777');
    } else {
      // fse.rmSync(folderPath, { recursive: true, force: true });
      await fse.ensureDir(folderPath);
    }
  } catch (err) {
    console.error(err);
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
      const drawingRow = {
        receive: Boolean(row[headers[0]]),
        inhouseDc: row[headers[1]],
        customerDc: row[headers[2]],
        aKeyNo: row[headers[3]],
        pKeyNo: row[headers[4]],
        dwgNo: row[headers[5]],
        dwgName: row[headers[6]],
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
      };

      if (!drawingRow.aKeyNo && drawingRow.oldKeyNo) {
        drawingRow.aKeyNo = drawingRow.oldKeyNo;
      }
      if (!drawingRow.pKeyNo && drawingRow.newKeyNo) {
        drawingRow.pKeyNo = drawingRow.newKeyNo;
      }

      drawing.push(drawingRow);
    }

    const mergeStartRowIndex = [...new Set(worksheet['!merges'].map((item) => item.s.r))];
    const mergeEndRowIndex = [...new Set(worksheet['!merges'].map((item) => item.e.r))];
    const mergeRows = [];
    for (let i = 0; i < mergeStartRowIndex.length; i++) {
      mergeRows.push({ start: mergeStartRowIndex[i] + 1, end: mergeEndRowIndex[i] + 1 });
    }
    fse.removeSync(excelFilePath)
    return { drawing, mergeRows };
  } catch (error) {
    appBizDebugger({ error });
  }
}

export async function getTodayExcelWithSite(data, drawingList, mergeRows) {
  try {
    const excel = new Excel();
    await excel.readFile('./templates/check-day.xlsx');
    const workbook = await excel.getWorkbookInstant();
    const worksheet = workbook.getWorksheet(1);
    let rowIndex = 2;
    for (const row of Array.from(drawingList).reverse()) {
      // TODO: change site cell color for more vibrant cell
      // can change cell color after insertRow
      // if (row.factory === 'VT') {
      //   worksheet.getCell(`V${rowIndex}`).fill = {
      //     fgColor: { argb: 'F0F0F0F0' },
      //   };
      // }

      const site = data.find(a => a.inhouseDc === row.inhouseDc);
      worksheet.insertRow(
        3,
        [
          row.receive ? 'a' : undefined,
          row.inhouseDc,
          row.customerDc,
          row.aKeyNo,
          row.pKeyNo,
          row.dwgNo,
          row.dwgName,
          (site && site.drawingRank) ? site.drawingRank : row.dwgDiv,
          row.issue,
          row.dept,
          row.releaseDate,
          row.dwgType,
          row.oldKeyNo,
          row.newKeyNo,
          row.add ? 'a' : undefined,
          row.discon ? 'a' : undefined,
          row['CD/C'] ? 'a' : undefined,
          row['ID/C'] ? 'a' : undefined,
          row.partName,
          row.size,
          row.cause,
          (site && site.categoryObj) ? row.categoryObj["S0"] ? 'a' : undefined : '',
          (site && site.categoryObj) ? row.categoryObj["TR"] ? 'a' : undefined : '',
          (site && site.categoryObj) ? row.categoryObj["RC"] ? 'a' : undefined : '',
          site ? isArray(site.factory) ? site.factory.join(", ") : site.factory : '',
        ],
        'i+'
      );
      rowIndex++;
    }
    worksheet.spliceRows(2, 1);

    mergeRows.forEach((row) => {
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'V', 'W', 'X', 'Y'].forEach((col) => {
        worksheet.mergeCells(`${col}${row.start}:${col}${row.end}`);
      });
    });

    const buffer = await excel.writeBuffer();
    await upsertDirectory(`./cache/debug/`);
    await excel.writeFile(`./cache/debug/test.xlsx`); // DEBUG
    return buffer;
  } catch (error) {
    console.error(error);
  }
}

var getDaysInMonth = function (month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (v, k) => k + 1)
};

export async function sendMail(NOREPLY_MAIL_SMTP, sendTo, data) {
  const smtp = new SMTP(NOREPLY_MAIL_SMTP);
  const { mailSubject, mailBody, attachments } = data;
  smtp.send(sendTo, [], mailSubject, mailBody, attachments, async (err, info) => {
    if (err) {
      appBizDebugger(`Error when trying to send email: ${err}`);
    }
    appBizDebugger('Send mail success!', info);
  });
}

export async function getCheckDrawingExcel(result, performer, poChecker) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const checkExcel = Array.from(result).map((data) => ({
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
  const totalRowIndex = getDaysInMonth(currentMonth, currentYear).length + 3;
  const totalRow = sheet.getRow(totalRowIndex + 2);

  totalRow.getCell(1).value = format(new Date(), '[Total] TM/YYYY');
  totalRow.getCell(2).value = { formula: `SUM(B4: B${totalRowIndex})` };
  totalRow.getCell(3).value = { formula: `SUM(C4: C${totalRowIndex})` };
  totalRow.getCell(4).value = { formula: `SUM(D4: D${totalRowIndex})` };
  totalRow.getCell(5).value = { formula: `SUM(E4: E${totalRowIndex})` };
  totalRow.getCell(6).value = { formula: `SUM(F4: F${totalRowIndex})` };
  totalRow.getCell(7).value = { formula: `SUM(G4: G${totalRowIndex})` };
  totalRow.getCell(8).value = { formula: `SUM(H4: H${totalRowIndex})` };
  totalRow.getCell(9).value = { formula: `SUM(I4: I${totalRowIndex})` };
  // await excel.writeFile('./debug/test-report.xlsx');
  return excel;
}

export const milisecondsToTimeFormat = (miliseconds) => {
  const duration = miliseconds / 1000;
  const hrs = ~~(duration / 3600);
  const mins = ~~((duration % 3600) / 60);
  const secs = ~~duration % 60;

  let ret = "";

  if (hrs > 0) {
    ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
  }

  ret += "" + mins + ":" + (secs < 10 ? "0" : "");
  ret += "" + secs;

  return ret;
}