import axios from 'axios';
import debug from 'debug';
import fse from 'fs-extra';
import path from 'path';
import { getFilesInFolder, upsertDirectory } from '../knowhow';
import { CSS_SELECTOR } from './constants/drawingFileConstants';
import { OPTIMIZED_WEB_VIEWPORT } from './constants/webConstant';
import { getPreviousInhouseDc } from './drawingFileHelper';
import Web from './webHelper';

export const AVERAGE_LOGIN_DURATION = 0;
export const AVERAGE_DOWNLOAD_DURATION = 500;

const { LOGIN_SCREEN, RELEASED_PAGE_SELECTOR } = CSS_SELECTOR;

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
        Accept: 'image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, */*',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-US',
        'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.3; WOW64; Trident/7.0; .NET4.0E; .NET4.0C; Tablet PC 2.0)',
        Cookie: '',
        'Content-Type': 'application/x-www-form-urlencoded',
        Connection: 'Keep-Alive',
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
    this.RELEASED_PAGE = `${this.gnetsUrl}/released.do?sessionId=${this.sessionId}`
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

    const pages = this.browser.pages();
    const popup = pages[pages.length - 1];
    const url = popup.url();

    this.getSessionId(url);
  }

  async getTodayExcel(todayTempDirectory) {
    if (!this.isBrowserOpened()) {
      this.login();
    }

    const page = await this.browser.newPage();
    await page.setViewport(OPTIMIZED_WEB_VIEWPORT);
    await page.goto(this.NO_RECEIVED_PAGE);
    await page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: todayTempDirectory });
    const excelDownloadButton = await page.$(CSS_SELECTOR.NORECEIVED_PAGE.DOWNLOAD_EXCEL);
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

  async downloadDrawingFile(drawing, todayTempDirectory, fileId) {
    try {
      if (!this.isBrowserOpened()) {
        this.login();
      }
      const { inhouseDc } = drawing;

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
      const inhouseDcFolder = path.resolve(todayTempDirectory, inhouseDc);
      upsertDirectory(inhouseDcFolder);
      const drawingFilePath = path.resolve(inhouseDcFolder, `drawing.pdf`);
      fse.writeFileSync(drawingFilePath, downloadRes.data);
      await Promise.all([drnPage.close(), popupPage.close()]);
      drawing.dir = inhouseDcFolder;
      drawing.fullFilePath = drawingFilePath;
      drawing.fileId = fileId;
      drawing.fileName = `drawing.pdf`;
      drawing.buffer = downloadRes.data;
      console.log(downloadRes.data);

      await Promise.all([drnPage.close(), popupPage.close()]);

      return {
        dir: inhouseDcFolder,
        fullFilePath: drawingFilePath,
        fileName: `drawing.pdf`,
        fileId,
        buffer: downloadRes.data,
      };
    } catch (error) {
      autoBotDebugger(error);
    }
  }

  async downloadDrnFile(inhouseDc, fullFilePath) {
    try {
      const drnUrl = this.VIEW_DRN_PAGE.replace("{{inhouseDc}}", inhouseDc);

      const drnFile = await axios.get(drnUrl, this.downloadFileOptions);
      fse.writeFileSync(path.resolve(fullFilePath, `drn.pdf`), drnFile.data);
      return path.resolve(fullFilePath, `drn.pdf`);
    } catch (error) {
      autoBotDebugger(`Can not download drnFile: ${error}`);
    }
  }

  // async getPreviousDrn(drawing) {
  //   try {
  //     const { prevDrawing, dir, inhouseDc } = drawing;
  //     const prevInhouseDc = !prevDrawing ? getPreviousInhouseDc(inhouseDc) : getPreviousInhouseDc(prevDrawing.inhouseDc);
  //     const drnURL = this.VIEW_DRN_PAGE.replace("{{inhouseDc}}", prevInhouseDc);
  //     const prevDrawingBuffer = await axios.get(drnURL, this.downloadFileOptions);
  //     fse.writeFileSync(path.resolve(dir, `prevDrn.pdf`), prevDrawingBuffer.data);

  //     return {
  //       filePath: path.resolve(dir, `prevDrn.pdf`),
  //       buffer: prevDrawingBuffer.data,
  //       inhouseDc: prevInhouseDc,
  //     };
  //   } catch (err) {
  //     autoBotDebugger(err);
  //   }
  // }

  async getPreviousDrn(drawing) {
    try {
      const { keyNo, dir } = drawing;
      const { KEY_NO_INPUT, SEARCH_BUTTON, FIRST_ROW } = RELEASED_PAGE_SELECTOR;

      const releasedPage = await this.browser.newPage();
      await releasedPage.setViewport(OPTIMIZED_WEB_VIEWPORT);
      await releasedPage.goto(this.RELEASED_PAGE);

      await releasedPage.type(KEY_NO_INPUT, keyNo);
      await releasedPage.click(SEARCH_BUTTON);
      await releasedPage.waitForTimeout(5000);

      const firstRow = await releasedPage.$(FIRST_ROW)
      const inhouseDcCell = await firstRow.$("td: nth-child(2)");
      const inhouseDcValue = await (await inhouseDcCell.getProperty('textContent')).jsonValue()
      const drnURL = this.VIEW_DRN_PAGE.replace("{{inhouseDc}}", inhouseDcValue);
      const drnBuffer = await axios.get(drnURL, this.downloadFileOptions);
      fse.writeFileSync(path.resolve(dir, `prevDrn.pdf`), drnBuffer.data);
      await releasedPage.close();
      return {
        filePath: path.resolve(dir, `prevDrn.pdf`),
        buffer: drnBuffer.data,
        inhouseDc: inhouseDcValue,
      };
    } catch (error) {
      autoBotDebugger(error);
    }
  }
}
