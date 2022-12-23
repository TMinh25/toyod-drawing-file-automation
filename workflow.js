import { format } from 'date-and-time';
import debug from 'debug';
import { isEmpty, uniqBy } from 'lodash';
import path from 'path';
import { API } from './helpers';
import { MAX_HISTORY_CHECK_FILES } from './helpers/constants/drawingFileConstants';
import { checkFactoryDrawingByFile, checkFactoryDrawingOnTings } from './helpers/drawingFileHelper';
import GnetHelper from './helpers/gnetsHelper';
import { getCheckDrawingExcel, getTodayExcelData, getTodayExcelWithSite, removeFolder, sendMail, upsertDirectory } from './knowhow';

const autoBotDebugger = debug('app:bot');

const SMTP_SECRET_CODE = 'noreplySMTP';
const NOTIFICATION_SECRET_CODE = 'drawing_file_notification';
const PO_CHECKER_SECRET_CODE = 'po_checker';
const PERFORMER_SECRET_CODE = 'po_performer';
const BOT_INFO_SECRET_CODE = 'drawing_file_info';
const SUPPORTING_SECRET_CODE = 'spt_drawings';

const secretListCode = [
  SMTP_SECRET_CODE,
  NOTIFICATION_SECRET_CODE,
  PO_CHECKER_SECRET_CODE,
  PERFORMER_SECRET_CODE,
  BOT_INFO_SECRET_CODE,
  SUPPORTING_SECRET_CODE,
];

const testDrawings = [
  {
    fileId: 1,
    fileName: 'test1.pdf',
    fullFilePath: '~/drawing-file-automation/samples/pdf/test.pdf',
  },
  {
    fileId: 2,
    fileName: 'test2.pdf',
    fullFilePath: '~/drawing-file-automation/samples/pdf/test2.pdf',
  },
  {
    fileId: 3,
    partNo: 'A34232',
    fileName: 'test3.pdf',
    fullFilePath: '~/drawing-file-automation/samples/pdf/test3.pdf',
  },
  {
    fileId: 4,
    partNo: 'A34232',
    fileName: 'test4.pdf',
    fullFilePath: '~/drawing-file-automation/samples/pdf/test4.pdf',
  },
  {
    fileId: 5,
    partNo: 'A34232',
    fileName: 'test5.pdf',
    fullFilePath: '~/drawing-file-automation/samples/pdf/test5.pdf',
  },
  {
    fileId: 6,
    partNo: 'A34232',
    fileName: 'test6.pdf',
    fullFilePath: '~/drawing-file-automation/samples/pdf/test6.pdf',
  },
]

// const now = new Date('2022/12/31');
const now = new Date();
const nowUserDateFormatted = format(now, 'DD/MM/YYYY');
const nowUserTimeFormatted = format(now, 'HH:MM');
const tempDir = `./cache/temp/${format(now, 'YYYYMMDD')}`;

export default async (payload, secretList, autobotCode, autobotSecret) => {
  console.log(secretList)
  try {
    autoBotDebugger('===========================');
    autoBotDebugger('Bot tải bản vẽ');
    autoBotDebugger('===========================');
    if (!secretList.map((s) => s.secretCode).every((item) => secretListCode.includes(String(item)))) {
      autoBotDebugger('Not enough secret!');
      return { error: 'Not enough secret!' };
    }
    const SMTPConfig = secretList.find((secret) => secret.secretCode === SMTP_SECRET_CODE).value;
    const mailTo = secretList.find((secret) => secret.secretCode === NOTIFICATION_SECRET_CODE).value;
    const poChecker = secretList.find((secret) => secret.secretCode === PO_CHECKER_SECRET_CODE).value;
    const performer = secretList.find((secret) => secret.secretCode === PERFORMER_SECRET_CODE).value;
    const botInfo = secretList.find((secret) => secret.secretCode === BOT_INFO_SECRET_CODE).value;
    const supporting = secretList.find((secret) => secret.secretCode === SUPPORTING_SECRET_CODE).value;

    const { URL, REPORT_URL, API_KEY, API_SECRET } = supporting;
    const token = `${API_KEY}:${API_SECRET}`;
    const encodedToken = Buffer.from(token).toString('base64');

    const api = new API();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const lastDayOfMonth = new Date(year, month, 0);

    const todayTempDirectory = path.resolve(tempDir);
    upsertDirectory(todayTempDirectory);

    if (now.getDate() === new Date(lastDayOfMonth).getDate()) {
      try {
        autoBotDebugger('Today is the last day of month => Getting report excel');

        const data = await api.apiGet({ url: `${REPORT_URL}?month=${month}`, encodedToken });
        const reportFile = await getCheckDrawingExcel(data.data, performer, poChecker);
        const reportFileBuffer = await reportFile.writeBuffer();

        const attachments = [
          {
            filename: `Bảng dữ liệu check bản vẽ trên GNETs - T${month}.xlsx`,
            content: reportFileBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ];

        await sendMail(SMTPConfig, mailTo, {
          mailSubject: `Báo cáo tổng hợp bản vẽ của tháng ${month}/${year}`,
          mailBody: `Hệ thống autobot xin gửi lại bạn danh sách bản vẽ của tháng ${month}/${year}`,
          attachments,
        });
      } catch (error) {
        autoBotDebugger(error);
      }
    }

    const VTDrawingList = [];

    let processedDrawings = [],
      skippedDrawings = [],
      loopCount = 0;

    const { BROWSER_OPTIONS } = botInfo;

    const gnets = new GnetHelper(botInfo);
    await gnets.openBrowser(BROWSER_OPTIONS);

    if (!gnets.isBrowserOpened()) {
      throw new Error("Can't open browser!");
    }

    // await gnets.login();
    // const todayExcelFile = await gnets.getTodayExcel(todayTempDirectory);

    // const { drawing: drawingList, mergeRows } = getTodayExcelData(path.resolve(todayTempDirectory, todayExcelFile));

    // skippedDrawings = uniqBy(drawingList, 'inhouseDc');
    skippedDrawings = testDrawings;

    // PROCESSING FILES
    do {
      loopCount++;
      let tempSkippedDrawings = Array.from(skippedDrawings);
      skippedDrawings = [];
      console.log(loopCount)
      for (let [fileId, drawing] of tempSkippedDrawings.entries()) {
        try {
          const { inhouseDc } = drawing;
          let checkResult;
          const inhouseDir = path.resolve(todayTempDirectory, inhouseDc);

          if (!drawing.fullFilePath) {
            const downloadDrawingResult = await gnets.downloadDrawingFile(drawing, todayTempDirectory, fileId)
            drawing = { ...drawing, ...downloadDrawingResult, relativeFilePath: "." + drawing.fullFilePath.substr(drawing.fullFilePath.indexOf("/cache")) };
          }

          if (loopCount === 1) { // Tải file drn trước để check bản drn của bản vẽ
            // const fullFilePath = await gnets.downloadDrnFile(inhouseDir);
            const { fullFilePath } = drawing;
            const filePath = "." + fullFilePath.substr(fullFilePath.indexOf("/cache"))
            checkResult = await checkFactoryDrawingByFile(filePath);
          } else if (loopCount < MAX_HISTORY_CHECK_FILES) { // Tải bản vẽ trước đó của bản vẽ
            const prevDrawing = await gnets.getPreviousDrn(drawing);
            drawing.prevDrawing = prevDrawing;
            checkResult = await checkFactoryDrawingByFile(drawing.prevDrawing.filePath);
          } else if (loopCount === MAX_HISTORY_CHECK_FILES) { // Check trên tings
            checkResult = await checkFactoryDrawingOnTings(drawing, gnets);
          }

          if (!checkResult) {
            autoBotDebugger(`${drawing.fileName} is not a detected, retrying previous drawing`);
            skippedDrawings.push({ ...drawing, received: Boolean(drawing.received) });
            continue;
          }

          const { factory } = checkResult;

          if (factory) {
            const result = { ...drawing, received: Boolean(drawing.received), ...checkResult };
            if (factory === 'VT') {
              VTDrawingList.push(result);
            }
            processedDrawings.push(result);
          }
        } catch (error) {
          autoBotDebugger(error);
          skippedDrawings.push({ ...drawing, received: Boolean(drawing.received) });
        }
      }
    } while (!isEmpty(skippedDrawings) && loopCount < MAX_HISTORY_CHECK_FILES);

    autoBotDebugger({ processedDrawings, skippedDrawings });

    if (processedDrawings.length > 0) {
      const todayExcelBuffer = await getTodayExcelWithSite(processedDrawings, mergeRows);

      autoBotDebugger(`Sending current's drawing to user's email...`);

      const attachments = [
        {
          filename: `Bảng dữ liệu check bản vẽ trên GNETs - T${month}.xlsx`,
          content: todayExcelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ];

      await sendMail(SMTPConfig, mailTo, {
        mailSubject: `Tổng hợp bản vẽ của ngày ${nowUserDateFormatted}`,
        mailBody: `Hệ thống autobot xin gửi lại bạn danh sách bản vẽ của ngày ${nowUserDateFormatted}, vào lúc ${nowUserTimeFormatted}`,
        attachments,
      });
    }
    if (skippedDrawings.length > 0) {
      await sendMail(SMTPConfig, mailTo, {
        mainSubject: `Tổng hợp bản vẽ không thể tìm nơi lắp ráp của ngày ${nowUserDateFormatted}`,
        mailBody: `Hệ thống autobot xin gửi lại danh sách bản vẽ không thể xử lý của ngày ${nowUserDateFormatted}, vào lúc ${nowUserTimeFormatted}\n
          - Danh sách gồm: 
          ${skippedDrawings.map(d => `<li>${d.inhouseDc} (${d.partNo})</li>`)}`,
        attachments: []
      })
    }

    for (const drawing of [...processedDrawings, ...skippedDrawings]) {
      await api.apiPost({
        url: URL,
        encodedToken,
        data: {
          ...drawing,
          poChecker,
          performer,
        },
      });
    }

    removeFolder(todayTempDirectory, { force: true });
    return { data: {} };
  } catch (error) {
    autoBotDebugger('error: ', error);
    return { error };
  }
};
