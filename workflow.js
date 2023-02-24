import { format } from 'date-and-time';
import debug from 'debug';
import { isEmpty, uniqBy } from 'lodash';
import path from 'path';
import { performance } from 'perf_hooks';
import { API } from './helpers';
import { MAX_HISTORY_CHECK_FILES } from './helpers/constants/drawingFileConstants';
import { checkFactoryDrawingByFile, checkFactoryDrawingOnTings } from './helpers/drawingFileHelper';
import GnetHelper from './helpers/gnetsHelper';
import { getDateFromExcelValue, getTodayExcelData, getTodayExcelWithSite, removeFolder, replaceSiteNames, milisecondsToTimeFormat, sendMail, upsertDirectory } from './knowhow';

const autoBotDebugger = debug('app:biz');

const SMTP_SECRET_CODE = 'noreplySmtp';
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

// const testDrawings = [
//   {
//     fileId: 1,
//     fileName: 'test1.pdf',
//     fullFilePath: './samples/pdf/test.pdf',
//   },
//   {
//     fileId: 2,
//     fileName: 'test2.pdf',
//     fullFilePath: './samples/pdf/test2.pdf',
//   },
//   {
//     fileId: 3,
//     pKeyNo: 'A34232',
//     fileName: 'test3.pdf',
//     fullFilePath: './samples/pdf/test3.pdf',
//   },
//   {
//     fileId: 4,
//     pKeyNo: 'A34232',
//     fileName: 'test4.pdf',
//     fullFilePath: './samples/pdf/test4.pdf',
//   },
//   {
//     fileId: 5,
//     pKeyNo: 'A34232',
//     fileName: 'test5.pdf',
//     fullFilePath: './samples/pdf/test5.pdf',
//   },
//   {
//     fileId: 6,
//     pKeyNo: 'A34232',
//     fileName: 'test6.pdf',
//     fullFilePath: './samples/pdf/test6.pdf',
//   },
// ]

export default async (payload, secretList, autobotCode, autobotSecret) => {

  // const now = new Date('2022/12/31');
  const now = new Date();
  const nowUserDateFormatted = format(now, 'DD/MM/YYYY');
  const nowUserTimeFormatted = format(now, 'HH:mm');
  const tempDir = `./cache/temp/${format(now, 'YYYYMMDD')}`;
  const drawingsDir = `./cache/QLBV/${format(now, 'DD-MM-YYYY')}`;

  let gnets;

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

    const { URL, API_KEY, API_SECRET } = supporting;
    const token = `${API_KEY}:${API_SECRET}`;
    const encodedToken = Buffer.from(token).toString('base64');

    const api = new API();

    const todayTempDirectory = path.resolve(tempDir);
    const todayDrawingDirectory = path.resolve(drawingsDir);
    upsertDirectory(todayTempDirectory);

    const downloadDrawingList = [];

    let loopCount = 0,
      processedDrawings = [],
      skippedDrawings = [];

    const { BROWSER_OPTIONS, SITE_NAMES } = botInfo;

    const startTime = performance.now();
    gnets = new GnetHelper(botInfo);
    await gnets.openBrowser(BROWSER_OPTIONS);

    if (!gnets.isBrowserOpened()) {
      throw new Error("Can't open browser!");
    }

    await gnets.login();
    const todayExcelFile = await gnets.getTodayExcel(todayTempDirectory);

    if (!todayExcelFile) {
      autoBotDebugger("No unreceived drawings found!")
      return { data: {} };
    }
    let drawingList, mergeRows;
    if (todayExcelFile) {
      ({ drawing: drawingList, mergeRows } = getTodayExcelData(path.resolve(todayTempDirectory, todayExcelFile)));
    }

    skippedDrawings = uniqBy(Array.from(drawingList), 'inhouseDc')

    // PROCESSING FILES
    do {
      loopCount++;
      let tempSkippedDrawings = Array.from(skippedDrawings);
      skippedDrawings = [];
      for (let drawing of tempSkippedDrawings) {
        try {
          let checkResult;
          const { inhouseDc } = drawing;
          const inhouseDir = path.resolve(todayTempDirectory, inhouseDc);
          await upsertDirectory(inhouseDir);

          if (loopCount === 1) { // Tải file drn trước để check bản drn của bản vẽ
            const drnFilePath = await gnets.downloadDrnFile(inhouseDc, inhouseDir);
            checkResult = await checkFactoryDrawingByFile(drnFilePath);
            drawing = { ...drawing, ...checkResult }
          } else if (loopCount < MAX_HISTORY_CHECK_FILES) { // Tải bản vẽ trước đó của bản vẽ
            checkResult = await gnets.getPreviousDrn(drawing, todayTempDirectory);
          } else if (loopCount === MAX_HISTORY_CHECK_FILES) { // Check trên tings
            checkResult = await checkFactoryDrawingOnTings(drawing, gnets);
          }

          autoBotDebugger(checkResult);

          if (!checkResult.factory) {
            autoBotDebugger(`${drawing.inhouseDc} (${drawing.aKeyNo}) is not a detected, retrying previous drawing`);
            skippedDrawings.push({ ...drawing, received: Boolean(drawing.received) });
            continue;
          }

          checkResult.factory = replaceSiteNames(checkResult.factory, SITE_NAMES);

          const { factory, isVNTec } = checkResult;
          if (factory) {
            const result = { ...drawing, ...checkResult };
            const { categoryObj } = result;
            if (isVNTec && (categoryObj["S1"] || categoryObj["MP"])) {
              downloadDrawingList.push(result);
            }
            processedDrawings.push(result);
          }
        } catch (error) {
          autoBotDebugger(`resulting error: ${error}`);
          skippedDrawings.push(drawing);
        }
      }
    } while (!isEmpty(skippedDrawings) && loopCount < MAX_HISTORY_CHECK_FILES);

    autoBotDebugger({ processedDrawings, skippedDrawings });

    const endTime = performance.now();

    if ([...processedDrawings, ...skippedDrawings].length > 0) {
      const todayExcelBuffer = await getTodayExcelWithSite(processedDrawings, drawingList, mergeRows);

      autoBotDebugger(`Sending current's drawing to user's email...`);

      const attachments = [
        {
          filename: `Bảng dữ liệu check bản vẽ trên GNETs - ngày ${nowUserDateFormatted}.xlsx`,
          content: todayExcelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ];

      const totalDrawingQty = [...processedDrawings, ...skippedDrawings].length;
      const VNTecDrawings = processedDrawings.filter(d => d.isVNTec);
      const skippedDrawingStringList = skippedDrawings.map(d => `- ${d.dwgNo} ${d.pKeyNo && `(${d.pKeyNo})`}<br/>`).join("");
      await sendMail(SMTPConfig, mailTo, {
        mailSubject: `Tổng hợp bản vẽ của ngày ${nowUserDateFormatted}`,
        mailBody: `Hệ thống autobot xin gửi lại bạn danh sách bản vẽ của ngày ${nowUserDateFormatted}, vào lúc ${nowUserTimeFormatted}. <br/>
        Tổng số bản vẽ được xử lý: ${totalDrawingQty}<br/>
        Thời gian xử lý ${totalDrawingQty} bản vẽ: ${milisecondsToTimeFormat(endTime - startTime)}<br/>
        ${VNTecDrawings.length > 0 ? `Số lượng bản vẽ VNTec: ${VNTecDrawings.length}` : ""}<br/>
        ${skippedDrawings.length > 0 ? `Danh sách bản vẽ không tìm được nơi lắp ráp: <br/> ${skippedDrawingStringList}` : ""}<br/>`,
        attachments,
      });
    }

    // await Promise.all([...processedDrawings, ...skippedDrawings].map(drawing => {
    //   const partLineAll = drawingList.filter(d => d.inhouseDc === drawing.inhouseDc);

    //   return api.apiPost({
    //     url: URL,
    //     encodedToken,
    //     data: {
    //       ...drawing,
    //       releasedDate: getDateFromExcelValue(drawing.releaseDate),
    //       partLineAll,
    //       poChecker,
    //       performer,
    //     },
    //   })
    // }));

    await upsertDirectory(todayDrawingDirectory);

    for (const drawing of downloadDrawingList) {
      await gnets.downloadDrawingFile(drawing, todayDrawingDirectory);
    }

    if (gnets.isBrowserOpened()) {
      await gnets.closeBrowser();
    }
    removeFolder(todayTempDirectory, { force: true });
    return { data: {} };
  } catch (error) {
    if (gnets.isBrowserOpened()) {
      gnets.closeBrowser()
    }
    autoBotDebugger('error: ', error);
    return { error };
  }
};
