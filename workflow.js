import { format } from 'date-and-time';
import debug from 'debug';
import { isEmpty, uniqBy } from 'lodash';
import path from 'path';
import { API } from './helpers';
import { MAX_HISTORY_CHECK_FILES } from './helpers/constants/drawingFileConstants';
import { checkFactoryDrawingByFile, checkFactoryDrawingOnTings, getPreviousDrn } from './helpers/drawingFileHelper';
import GnetHelper from './helpers/gnetsHelper';
import { getCheckDrawingExcel, getTodayExcelData, getTodayExcelWithSite, removeFolderForce, sendMail, upsertDirectory } from './knowhow';

const appBizDebugger = debug('app:biz');

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
  BOT_INFO_SECRET_CODE,
  SUPPORTING_SECRET_CODE,
  PERFORMER_SECRET_CODE,
];

// const now = new Date('2022/12/31');
const now = new Date();
const nowUserDateFormatted = format(now, 'DD/MM/YYYY');
const nowUserTimeFormatted = format(now, 'HH:MM');
const tempDir = `./cache/temp/${format(now, 'YYYYMMDD')}`;

export default async (payload, secretList, autobotCode, autobotSecret) => {
  try {
    appBizDebugger('===========================');
    appBizDebugger('Bot tải bản vẽ');
    appBizDebugger('===========================');
    if (!secretList.map((s) => s.secretCode).every((item) => secretListCode.includes(String(item)))) {
      appBizDebugger('Not enough secret!');
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
        appBizDebugger('Today is the last day of month => Getting report excel');

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
        appBizDebugger(error);
      }
    }

    const VTDrawingList = [];

    let processedDrawings = [],
      skippedDrawings = [
        // {
        //   fileId: 1,
        //   fileName: 'test1.pdf',
        //   fullFilePath: './samples/pdf/test.pdf',
        // },
        // {
        //   fileId: 2,
        //   fileName: 'test2.pdf',
        //   fullFilePath: './samples/pdf/test2.pdf',
        // },
        // {
        //   fileId: 3,
        //   partNo: 'A34232',
        //   fileName: 'test3.pdf',
        //   fullFilePath: './samples/pdf/test3.pdf',
        // },
        // {
        //   fileId: 4,
        //   partNo: 'A34232',
        //   fileName: 'test4.pdf',
        //   fullFilePath: './samples/pdf/test4.pdf',
        // },
        // {
        //   fileId: 5,
        //   partNo: 'A34232',
        //   fileName: 'test5.pdf',
        //   fullFilePath: './samples/pdf/test5.pdf',
        // },
        // {
        //   fileId: 6,
        //   partNo: 'A34232',
        //   fileName: 'test6.pdf',
        //   fullFilePath: './samples/pdf/test6.pdf',
        // },
      ],
      loopCount = 0;

    const { BROWSER_OPTIONS } = botInfo;

    const gnets = new GnetHelper(botInfo);
    await gnets.openBrowser(BROWSER_OPTIONS);

    if (!gnets.isBrowserOpened()) {
      throw new Error("Can't open browser!");
    }

    await gnets.login();
    const todayExcelFile = await gnets.getTodayExcel(todayTempDirectory);

    const { drawing, mergeRows } = getTodayExcelData(`${todayTempDirectory}/${todayExcelFile}`);

    skippedDrawings = uniqBy(drawing, 'inhouseDc');

    // PROCESSING FILES
    do {
      loopCount++;
      const tempSkippedDrawings = skippedDrawings;
      skippedDrawings = [];
      for (const drawing of tempSkippedDrawings) {
        try {
          const { inhouseDc } = drawing;
          let checkResult;

          if (loopCount === 1) {
            const drnFilePath = await gnets.downloadDrnFile(`${todayTempDirectory}/${inhouseDc}`);
            checkResult = await checkFactoryDrawingByFile(drnFilePath);
          } else if (loopCount < MAX_HISTORY_CHECK_FILES - 1) {
            await getPreviousDrn(drawing);
            checkResult = await checkFactoryDrawingByFile(drawing.prevDrawing.filePath);
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
            await api.apiPost({
              url: URL,
              encodedToken,
              data: {
                ...drawing,
                poChecker,
                performer,
                checked,
              },
            });
          }
        } catch (error) {
          console.log(error);
          skippedDrawings.push(drawing);
        }
      }
    } while (!isEmpty(skippedDrawings) && loopCount < MAX_HISTORY_CHECK_FILES);

    console.log({ processedDrawings, skippedDrawings });

    if (processedDrawings.length > 0) {
      const todayExcelBuffer = await getTodayExcelWithSite(processedDrawings, mergeRows);

      appBizDebugger(`Sending current's drawing to user's email...`);

      const attachments = [
        {
          filename: `Bảng dữ liệu check bản vẽ trên GNETs - T${month}.xlsx`,
          content: todayExcelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ];

      await sendMail(SMTPConfig, mailTo, {
        mailSubject: `Tổng hợp bản vẽ của ngày ${nowUserDateFormatted}`,
        mailBody: `Hệ thống autobot xin gửi lại bạn danh sách bản vẽ của ngày ${nowUserDateFormatted}, được lấy vào lúc ${nowUserTimeFormatted}`,
        attachments,
      });
    }

    removeFolderForce(todayTempDirectory);
    return { data: {} };
  } catch (error) {
    appBizDebugger('error: ', error);
    return { error };
  }
};
