import axios from 'axios';
import fs from 'fs';
import puppeteer from 'puppeteer';
import path from 'path';
import lodash from 'lodash';
const { isEmpty, uniqBy } = lodash;
import XLSX from 'xlsx';
//import { checkFactoryDrawing, getPreviousDrawing, checkFactoryDrawingOnTings } from './helpers/drawingFileHelper.js';
//import Excel from './helpers/excelHelper.js';

const MAX_HISTORY_CHECK_FILES = 4;

export const CSS_SELECTOR = {
  LOGIN_SCREEN: {
    USERNAME: '#main > table:nth-child(3) > tbody > tr:nth-child(2) > td:nth-child(3) > input[type=text]',
    PASSWORD: '#main input[name=pass]',
    LOGIN_BUTTON: '#main > table:nth-child(3) > tbody > tr:nth-child(7) > td:nth-child(3) > a',
  },

  HOMEPAGE: {
    RECEIVED_DRAWING: `#RCV2 > td > table > tbody > tr > td:nth-child(2)`,
    NO_RECEIVE_DRAWING: `#RCV1 > td > table > tbody > tr > td:nth-child(2)`,
    RELEASED_DRAWING: `#LST2 > td > table > tbody > tr > td:nth-child(2)`,
  },

  NORECEIVED_PAGE: {
    DOWNLOAD_EXCEL: `#searchbox > div > table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(2) > td > font`,
  },
};
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

function checkFactoryDrawing(filePath) {
  return { factory: 'VT', isChecked: true, isVNTec: true };
}

export function getFilesInFolder(folderPath) {
  const files = fs.readdirSync(path.resolve(folderPath));
  return files;
}

function getTodayExcelData(excelFilePath) {
  try {
    const workbook = XLSX.readFile(excelFilePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const headers = getHeadersXLSX(worksheet);
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    const result = [];

    for (const row of excelData) {
      result.push({
        received: Boolean(row[headers[0]]),
        inhouseDc: row[headers[1]],
        aKeyNo: row[headers[2]],
        partNo: row[headers[3]],
        dwgNo: row[headers[4]],
        partName: row[headers[5]],
      });
    }

    return uniqBy(result, 'inhouseDc');
  } catch (error) {
    console.error({ error });
  }
}

export function stringSimilarity(s1, s2) {
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

export async function checkFactoryDrawingOnTings(drawing) {
  const { inhouseDc, partNo, releaseDate } = drawing;
  console.log(drawing);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ignoreHTTPSErrors: true,
  });
  const web = await browser.newPage();
  await web.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });
  //const web = new WebHelper();
  await web.goto(`https://tings.toyo-denso.co.jp/main/itemSearch/form/`);
  await web.type(CSS_SELECTOR.TINGS.PART_NO_INPUT, partNo);
  const searchButton = await web.$(CSS_SELECTOR.TINGS.SEARCH_BUTTON);
  await searchButton.click();
  await web.waitForTimeout(10000);
  const rows = await web.$$('#main > table.resTab > tbody > tr:not(:first-child)');

  let closestDate, site;
  for (const row of rows) {
    const partNoCell = await row.$('td:nth-child(2)');
    const partNoValue = String(await (await partNoCell.getProperty('innerText')).jsonValue());
    const createDateCell = await row.$('td:nth-child(8)');
    const createDateValue = String(await (await createDateCell.getProperty('innerText')).jsonValue());

    const daysBetweenCreateDate = daysBetween(createDateValue, releaseDate);
    if (partNoValue === partNo && daysBetweenCreateDate <= closestDate) {
      const siteCell = await row.$('td:nth-child(10)');
      const siteValue = String(await (await siteCell.getProperty('innerText')).jsonValue());

      site = siteValue.slice(0, 1) + 'T';
    }
  }

  console.log(site);
  return site;
}

function getSessionId(url) {
  const tempURL = url.split('?')[1];
  let params = new URLSearchParams(tempURL);
  console.log(params);

  return params.get('sessionId');
}

async function downloadDrnFile(inhouseDc, fullFilePath, downloadOptions) {
  try {
    const drnUrl = `http://cad-sv01:7001/gnets/viewdrn.do?inhouseDc=${inhouseDc}`;

    const drnFile = await axios.get(drnUrl, downloadOptions);
    fs.writeFileSync(`${fullFilePath}/drn.pdf`, drnFile.data);
    return `${fullFilePath}/drn.pdf`;
  } catch (error) {
    console.error(`Can not download drnFile: ${error}`);
  }
}

(async () => {
  try {
    const today = new Date();
    const date = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getYear();
    const tempDir = `/cache/temp/${year}${month}${date}`;
    const todayTempDirectory = path.join(process.cwd(), tempDir);
    if (!fs.existsSync(todayTempDirectory)) {
      fs.mkdirSync(todayTempDirectory);
    } else {
      fs.rmSync(todayTempDirectory, { recursive: true, force: true });
      fs.mkdirSync(todayTempDirectory);
    }

    const browser = await puppeteer.launch({
      headless: false,
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    await page.goto('http://cad-sv01:7001/gnets/login.do');
    await page.type(CSS_SELECTOR.LOGIN_SCREEN.USERNAME, 'V2090562');
    await page.type(CSS_SELECTOR.LOGIN_SCREEN.PASSWORD, 'V2090562');
    await page.click(CSS_SELECTOR.LOGIN_SCREEN.LOGIN_BUTTON);
    const newPagePromise = new Promise((x) => browser.once('targetcreated', (target) => x(target.page())));
    const popup = await newPagePromise;
    const popupURL = popup.url();
    const sessionId = getSessionId(popupURL);
    const downloadOptions = {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, */*',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US',
        'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; Tablet PC 2.0)',
        Connection: 'Keep-Alive',
        Cookie: `JSESSIONID=${sessionId}`,
      },
    };

    const viewFormatURL = `http://cad-sv01:7001/gnets/viewformatselect.do?sessionId=${sessionId}`;
    const noReceivedURL = `http://cad-sv01:7001/gnets/noreceivelist.do?sessionId=${sessionId}`;

    const noReceivedList = await browser.newPage();
    await noReceivedList.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    await noReceivedList.goto(noReceivedURL);
    await noReceivedList._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: todayTempDirectory });
    const excelDownloadButton = await noReceivedList.$(CSS_SELECTOR.NORECEIVED_PAGE.DOWNLOAD_EXCEL);
    noReceivedList.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await excelDownloadButton.click();
    await noReceivedList.waitForTimeout(10000);
    await noReceivedList.close();
    // let drawingList = [{ inhouseDc: 'S122-01942' }];

    const files = getFilesInFolder(todayTempDirectory);
    const todayExcelFile = files.find((file) => file.match(/xls/));
    const drawingList = getTodayExcelData(`${todayTempDirectory}/${todayExcelFile}`);
    console.log(drawingList);

    for (let i = 0; i < drawingList.length; i++) {
      try {
        const drawing = drawingList[i];
        const { inhouseDc } = drawing;

        const viewPrintURL = `http://cad-sv01:7001/gnets/viewprint.do?inhouseDc=${inhouseDc}&sessionId=${sessionId}`;
        const downloadURL = `http://cad-sv01:7001/gnets/viewprint.do?inhouseDc=${inhouseDc}&mode=PDF&date=${new Date().toUTCString()}&sessionId=${sessionId}`;
        const drnPage = await browser.newPage();
        await drnPage.goto(viewPrintURL);
        const checkBoxes = await drnPage.$$('#main input[type=checkbox]');
        for (const checkbox of checkBoxes) {
          await checkbox.click();
        }
        await drnPage.$eval('#main', (form) => {
          form.mode.value = 'view';
          form.submit();
        });
        await drnPage.waitForTimeout(2500);
        const popupPage = await browser.newPage();
        await popupPage.goto(viewFormatURL);
        await popupPage.waitForTimeout(2500);

        const downloadRes = await axios.get(downloadURL, downloadOptions);
        console.log(downloadRes.data);
        fs.mkdirSync(todayTempDirectory + '/' + inhouseDc);
        fs.writeFileSync(todayTempDirectory + `/${inhouseDc}/drawing.pdf`, downloadRes.data);

        drawing.dir = todayTempDirectory + `/${inhouseDc}`;
        drawing.fullFilePath = todayTempDirectory + `/${inhouseDc}/drawing.pdf`;
        drawing.fileId = i + 1;
        drawing.fileName = `${inhouseDc}.pdf`;
        drawing.buffer = downloadRes.data;
      } catch (error) {
        console.error(error.message);
      }
    }
    console.log(drawingList);

    const VTDrawingList = [];

    let processedDrawings = [],
      skippedDrawings = [],
      loopCount = 0;

    skippedDrawings = uniqBy(drawing, 'inhouseDc');

    do {
      loopCount++;
      const tempSkippedDrawings = skippedDrawings;
      skippedDrawings = [];
      for (const drawing of tempSkippedDrawings) {
        try {
          const { inhouseDc } = drawing;
          let checkResult;

          if (loopCount === 1) {
            const drnFilePath = await downloadDrnFile(`${todayTempDirectory}/${inhouseDc}`);
            checkResult = await checkFactoryDrawing(drnFilePath);
          } else if (loopCount < MAX_HISTORY_CHECK_FILES - 2) {
            checkResult = await checkFactoryDrawing(drawing.fullFilePath);
          } else if (loopCount === MAX_HISTORY_CHECK_FILES - 2) {
            await getPreviousDrawing(drawing);
            checkResult = await checkFactoryDrawing(drawing.prevDrawing.filePath);
          } else if (loopCount === MAX_HISTORY_CHECK_FILES - 1) {
            checkResult = await checkFactoryDrawingOnTings(drawing);
          }

          if (!checkResult) {
            appBizDebugger(`${drawing.fileName} is not a detected, retrying previous drawing`);
            skippedDrawings.push(drawing);
            continue;
          }

          const { factory, checked } = checkResult;
          console.log({ factory });

          if (factory) {
            if (factory === 'VT') {
              VTDrawingList.push(drawing);
            }
            processedDrawings.push(drawing);
          }
        } catch (error) {
          console.log(error);
          skippedDrawings.push(drawing);
        }
      }
    } while (!isEmpty(skippedDrawings) && loopCount < MAX_HISTORY_CHECK_FILES);
    console.log({ processedFiles, skippedFiles });

    await browser.close();
  } catch (error) {
    console.log(error);
  }
})();
