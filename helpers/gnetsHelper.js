import axios from 'axios';
import { format } from 'date-and-time';
import debug from 'debug';
import fse from 'fs-extra';
import path from 'path';
import { getFilesInFolder, getTrueAKeyNo, upsertDirectory } from '../knowhow';
import { CSS_SELECTOR, newDwgDivValue } from './constants/drawingFileConstants';
import { OPTIMIZED_WEB_VIEWPORT } from './constants/webConstant';
import { getPreviousInhouseDc } from './drawingFileHelper';
import Web from './webHelper';

export const AVERAGE_LOGIN_DURATION = 0;
export const AVERAGE_DOWNLOAD_DURATION = 500;

const { LOGIN_SCREEN, NORECEIVED_PAGE, RELEASED_PAGE_SELECTOR } = CSS_SELECTOR;

const autoBotDebugger = debug('app:bot');

export default class GnetHelper extends Web {
  constructor(web = {}) {
    super();
    this.simulationMode = web.DEV_MODE;
    this.gnetsUrl = web.GNETS_URL;
    this.tingsUrl = web.TINGS_URL;
    this.LOGIN_PAGE = `${this.gnetsUrl}/login.do`;
    this.username = web.USERNAME;
    this.password = web.PASSWORD;
    this.downloadFileOptions = {
      responseType: 'arraybuffer',
      headers: {
        Accept: `image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, */*`,
        Cookie: '',
        Connection: 'Keep-Alive',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US',
        'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; Tablet PC 2.0)',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
    };
  }

  getSessionId(url) {
    const tempURL = url.split('?')[1];
    let params = new URLSearchParams(tempURL);
    this.sessionId = params.get('sessionId');

    const nowUTCString = new Date().toUTCString();
    this.downloadFileOptions.headers.Cookie = `JSESSIONID=${this.sessionId}`;
    this.VIEW_PRINT_PAGE = `${this.gnetsUrl}/viewprint.do?inhouseDc={{inhouseDc}}&sessionId=${this.sessionId}`;
    this.RELEASED_PAGE = `${this.gnetsUrl}/distributionstatuslist.do?sessionId=${this.sessionId}`
    this.NO_RECEIVED_PAGE = `${this.gnetsUrl}/noreceivelist.do?sessionId=${this.sessionId}`;
    this.VIEW_FORMAT_POPUP = `${this.gnetsUrl}/viewformatselect.do?sessionId=${this.sessionId}`;
    this.DRAWING_DOWNLOAD_URL = `${this.gnetsUrl}/viewprint.do?inhouseDc={{inhouseDc}}&mode=PDF&date=${nowUTCString}&sessionId=${this.sessionId}`;
    this.VIEW_DRN_PAGE = `${this.gnetsUrl}/viewdrn.do?inhouseDc={{inhouseDc}}`;
  }

  async login() {
    if (!this.isBrowserOpened()) {
      this.page = await this.browser.newPage();
      // throw new Error("Can't open browser!");
    }

    const { USER_NAME, PASSWORD, LOGIN_BUTTON } = LOGIN_SCREEN;

    await this.gotoUrl(this.LOGIN_PAGE);
    await this.type(USER_NAME, this.username);

    await this.type(PASSWORD, this.password);

    await this.click(LOGIN_BUTTON);
    await this.waitForTimeout(5000);

    const pages = await this.browser.pages();
    const popup = pages[pages.length - 1];

    this.getSessionId(popup.url());
  }

  async getTodayExcel(todayTempDirectory) {
    if (!this.isBrowserOpened()) {
      this.login();
    }

    const page = await this.browser.newPage();
    await page.setViewport(OPTIMIZED_WEB_VIEWPORT);
    await page.goto(this.NO_RECEIVED_PAGE);
    await page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: todayTempDirectory });
    const excelDownloadButton = await page.$(NORECEIVED_PAGE.DOWNLOAD_EXCEL);
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await excelDownloadButton.click();
    await page.waitForTimeout(10000);
    await page.close();

    const files = getFilesInFolder(todayTempDirectory);
    const todayExcelFile = files.find((file) => file.match(/xls/));
    return todayExcelFile;
  }

  async downloadDrawingFile(drawing, todayDrawingDirectory) {
    try {
      if (!this.isBrowserOpened()) {
        this.login();
      }
      const { inhouseDc, partNo } = drawing;

      const drnPage = await this.browser.newPage();
      await drnPage.setViewport(OPTIMIZED_WEB_VIEWPORT);
      const drawingURL = this.VIEW_PRINT_PAGE.replace("{{inhouseDc}}", inhouseDc);
      await drnPage.goto(drawingURL);
      const checkBoxes = await drnPage.$$('#main input[type=checkbox]');
      for (const checkbox of checkBoxes) {
        await checkbox.click();
      }
      await drnPage.$eval('#main', (form) => {
        form.mode.value = 'view';
        form.submit();
      });
      await drnPage.waitForTimeout(checkBoxes.length * 2500);

      const popupPage = await this.browser.newPage();

      await popupPage.setViewport(OPTIMIZED_WEB_VIEWPORT);
      await popupPage.goto(this.VIEW_FORMAT_POPUP);
      await popupPage.waitForTimeout(checkBoxes.length * 2500);

      const downloadURL = this.DRAWING_DOWNLOAD_URL.replace("{{inhouseDc}}", inhouseDc);
      const downloadRes = await axios.get(downloadURL, this.downloadFileOptions);
      drawing.dir = todayDrawingDirectory;
      const drawingFilePath = path.resolve(todayDrawingDirectory, `${inhouseDc} (${partNo}).pdf`);
      fse.writeFileSync(drawingFilePath, downloadRes.data);
      drawing.fullFilePath = drawingFilePath;
      drawing.fileName = `${inhouseDc} (${partNo}).pdf`;
      drawing.buffer = downloadRes.data;
      await Promise.all([drnPage.close(), popupPage.close()]);

      return {
        dir: todayDrawingDirectory,
        fullFilePath: drawingFilePath,
        fileName: `${inhouseDc} (${partNo}).pdf`,
        buffer: downloadRes.data,
      };
    } catch (error) {
      console.error(error);
      autoBotDebugger(error);
    }
  }

  async downloadDrnFile(inhouseDc, fullFilePath) {
    try {
      const drnUrl = this.VIEW_DRN_PAGE.replace("{{inhouseDc}}", inhouseDc);

      const drnFile = await axios.get(drnUrl, this.downloadFileOptions);
      const drnFilePath = path.resolve(fullFilePath, `drn.pdf`);
      fse.writeFileSync(drnFilePath, drnFile.data);
      return drnFilePath;
    } catch (error) {
      autoBotDebugger(`Can not download drnFile: ${error}`);
    }
  }

  async getPreviousDrn(drawing, dir) {
    try {
      const { prevDrawing, inhouseDc, aKeyNo } = drawing;

      const releasedPage = await this.browser.newPage()
      await releasedPage.setViewport(OPTIMIZED_WEB_VIEWPORT);
      await releasedPage.goto(this.RELEASED_PAGE);

      const inputAKeyNo = getTrueAKeyNo(aKeyNo);

      await releasedPage.$eval('#main', (form, keyNo) => {
        form.mode.value = "search";
        form.akeyNoS.value = "%" + keyNo;
        form.dateFrom.value = "";
        form.releasedFlg.value = "true";
        form.submit();
      }, inputAKeyNo);
      // await releasedPage.waitForNavigation({ waitUntil: 'load' });
      await releasedPage.waitForTimeout(2500);
      const rows = await releasedPage.$$(RELEASED_PAGE_SELECTOR.TABLE_ROWS);
      let result;

      for (const row of rows) {
        const id = await (await row.getProperty("id")).jsonValue();
        if (String(id).match(/^row_\d{1,}/)) {
          const dwgDivCell = await row.$("td:nth-child(7)");
          const dwgDiv = String(await (await dwgDivCell.getProperty('innerText')).jsonValue()).trim();
          if (dwgDiv === newDwgDivValue) {
            const inhouseDcCell = await row.$("td:nth-child(2)");
            const inhouseDc = String(await (await inhouseDcCell.getProperty('innerText')).jsonValue()).trim();

            const drnURL = this.VIEW_DRN_PAGE.replace("{{inhouseDc}}", inhouseDc);
            const prevDrawingBuffer = await axios.get(drnURL, this.downloadFileOptions);
            await upsertDirectory(dir);
            const prevDrnFilePath = path.resolve(dir, `${inhouseDc} - prevDrn.pdf`);
            fse.writeFileSync(prevDrnFilePath, prevDrawingBuffer.data);
            result = {
              filePath: prevDrnFilePath,
              buffer: prevDrawingBuffer.data,
              inhouseDc,
            }
            break;
          }
        }
      }
      await releasedPage.close();
      return result;
    } catch (err) {
      console.error(err)
      autoBotDebugger(err);
    }
  }
}
