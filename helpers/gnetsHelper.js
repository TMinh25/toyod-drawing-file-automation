import axios from 'axios';
import debug from 'debug';
import fs from 'fs';
import path from 'path';
import { upsertDirectory } from '../knowhow';
import { CSS_SELECTOR } from './constants/drawingFileConstants';
import { getPreviousInhouseDc } from './drawingFileHelper';
import Web from './webHelper';

export const TEMP_FOLDER = './temp';

export const SIMULATION_LOGIN_URL = `file://${process.env.PWD}/samples/simulation/login.htm`;
export const SIMULATION_LOGED_IN_URL = `file://${process.env.PWD}/samples/simulation/loged in.mht`;
export const SIMULATION_HOME_URL = `file://${process.env.PWD}/samples/simulation/home.mht`;
export const SIMULATION_NO_RECEIVE_URL = `file://${process.env.PWD}/samples/simulation/noReceiveList.mht`;
export const SIMULATION_RELEASED_URL = `file://${process.env.PWD}/samples/simulation/home.mht`;
export const DRAWING_SELECTION_URL = `file://${process.env.PWD}/samples/simulation/drawingSelectionDownload.mht`;

export const AVERAGE_LOGIN_DURATION = 0;
export const AVERAGE_DOWNLOAD_DURATION = 500;

const { LOGIN_SCREEN } = CSS_SELECTOR;

const autoBotDebugger = debug('app:bot');

export default class GnetHelper extends Web {
  constructor(web = {}) {
    super();
    this.simulationMode = web.DEV_MODE;
    this.loginUrl = web.LOGIN_URL;
    this.tingsUrl = web.TINGS_URL;
    this.userName = web.USERNAME;
    this.password = web.PASSWORD;
    this.sessionId = '';
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
    this.VIEW_PRINT_PAGE = `http://cad-sv01:7001/gnets/viewprint.do?inhouseDc={{inhouseDc}}&sessionId=${this.sessionId}`;
    this.NO_RECEIVED_PAGE = `http://cad-sv01:7001/gnets/receivedlist.do?sessionId=${this.sessionId}`;
    this.VIEW_FORMAT_POPUP = `http://cad-sv01:7001/gnets/viewformatselect.do?sessionId=${this.sessionId}`;
    this.DRAWING_DOWLOAD_URL = `http://cad-sv01:7001/gnets/viewprint.do?inhouseDc={{inhouseDc}}&mode=PDF&date=${nowUTCString}&sessionId=${this.sessionId}`;
  }

  async login() {
    if (!super.isBrowserOpened()) {
      super.page = await super.browser.newPage();
      // throw new Error("Can't open browser!");
    }

    const { USER_NAME, PASSWORD, LOGIN_BUTTON } = LOGIN_SCREEN;

    if (this.simulationMode) {
      await super.gotoUrl(SIMULATION_LOGIN_URL);
    } else {
      await super.gotoUrl(this.loginUrl);
    }

    await super.type(USER_NAME, this.userName);
    await super.type(PASSWORD, this.password);

    await super.click(LOGIN_BUTTON);
    await super.waitForTimeout(5000);

    const newPagePromise = new Promise((x) => browser.once('targetcreated', (target) => x(target.page())));
    const popup = await newPagePromise;
    const url = popup.url();

    this.getSessionId(url);
  }

  async getTodayExcel(todayTempDirectory) {
    if (!super.isBrowserOpened()) {
      this.login();
    }

    const page = await super.browser.newPage();
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
      if (!super.isBrowserOpened()) {
        this.login();
      }
      const { inhouseDc } = drawing;

      const drnPage = await super.browser.newPage();
      await drnPage.goto(this.VIEW_PRINT_PAGE);
      const checkBoxes = await drnPage.$$('#main input[type=checkbox]');
      for (const checkbox of checkBoxes) {
        await checkbox.click();
      }
      await drnPage.$eval('#main', (form) => {
        form.mode.value = 'view';
        form.submit();
      });
      await drnPage.waitForTimeout(5000);

      const popupPage = await super.browser.newPage();
      await popupPage.goto(this.VIEW_FORMAT_POPUP);
      await popupPage.waitForTimeout(5000);
      const downloadRes = await axios.get(this.DRAWING_DOWLOAD_URL, this.downloadFileOptions);

      const inhouseDcFolder = path.resolve(todayTempDirectory, inhouseDc);
      drawing.dir = inhouseDcFolder;
      const drawingFilePath = path.resolve(`${inhouseDcFolder}/drawing.pdf`);
      upsertDirectory(inhouseDcFolder);
      fs.writeFileSync(drawingFilePath, downloadRes.data);

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
      const drnUrl = `http://cad-sv01:7001/gnets/viewdrn.do?inhouseDc=${inhouseDc}`;

      const drnFile = await axios.get(drnUrl, this.downloadFileOptions);
      fs.writeFileSync(`${fullFilePath}/drn.pdf`, drnFile.data);
      return `${fullFilePath}/drn.pdf`;
    } catch (error) {
      autoBotDebugger(`Can not download drnFile: ${error}`);
    }
  }

  async getPreviousDrn(drawing) {
    try {
      const { prevDrawing, dir, inhouseDc } = drawing;
      let prevInhouseDc;
      if (!prevDrawing) {
        prevInhouseDc = getPreviousInhouseDc(inhouseDc);
      } else {
        prevInhouseDc = getPreviousInhouseDc(prevDrawing.inhouseDc);
      }

      const prevDrawingBuffer = await axios.get(`http://cad-sv01:7001/gnets/viewdrn.do?inhouseDc=${prevInhouseDc}`, this.downloadFileOptions);
      fs.writeFileSync(path.resolve(dir, `prevDrn.pdf`), prevDrawingBuffer.data);

      return {
        filePath: path.resolve(dir, `prevDrn.pdf`),
        buffer: prevDrawingBuffer.data,
        inhouseDc: prevInhouseDc,
      };
    } catch (err) {
      autoBotDebugger(err);
    }
  }
}
