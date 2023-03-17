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

    let downloadDrawingList = [];

    let loopCount = 0,
      processedDrawings = [],
      skippedDrawings = [],
      crawlError = undefined;

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
      drawingList = [
        { inhouseDc: "MP23-00266-006", customerDc: "", aKeyNo: "4SW18954B2", pKeyNo: "A33555-12", dwgNo: "39115-T2A -A610-M1", dwgName: "JACK ASSY,AUX (W USB)" },
        { inhouseDc: "MP23-00266-010", customerDc: "", aKeyNo: "4SW20754A3", pKeyNo: "A36212-03", dwgNo: "39115-TG7 -A410-M1-A  ", dwgName: "JACK ASSY,ACC&USB&AUX(NH-167L)" },
        { inhouseDc: "MP23-00309-001", customerDc: "JMCN-00106", aKeyNo: "3CL01619A4", pKeyNo: "A20990-04", dwgNo: "30500-ZW2 -F010-M1", dwgName: "COIL ASSY,IGN" },
        { inhouseDc: "MP23-00206", customerDc: "", aKeyNo: "E16937", pKeyNo: "E16937", dwgNo: "E16937", dwgName: "LED-CSL0901VT1(C)" },
        { inhouseDc: "MP23-00309-002", customerDc: "JMCN-00106", aKeyNo: "3CL01078A4", pKeyNo: "A06574-04", dwgNo: "30511-ZV7 -0030", dwgName: "COIL 1 COMP,IGN" },
        { inhouseDc: "MP23-00309-003", customerDc: "JMCN-00106", aKeyNo: "3CL01079A3", pKeyNo: "A06575-03", dwgNo: "30512ZV7 0030 ", dwgName: "COIL 2 COMP,IGN" },
        { inhouseDc: "MP23-00309-004", customerDc: "JMCN-00106", aKeyNo: "3CL01618A2", pKeyNo: "A20989-02", dwgNo: "30513-ZW2 -F010-M1", dwgName: "COIL 3 COMP,IGN" },
        { inhouseDc: "MP23-00309-005", customerDc: "JMCN-00106", aKeyNo: "3OT04867", pKeyNo: "F11365", dwgNo: "30700-ZV5 -0030", dwgName: "CAP ASSY,NOISE SUPPRESSOR" },
        { inhouseDc: "MP20-01647-003", customerDc: "", aKeyNo: "2DC03086A7", pKeyNo: "A19140-07", dwgNo: "5316A-GEY -7500", dwgName: "HOUSING ASSY UND THROT" },
        { inhouseDc: "MP20-01647-004", customerDc: "", aKeyNo: "2DC03489A2", pKeyNo: "A30088-02", dwgNo: "5316A-KWV -0000", dwgName: "HOUSING ASSY,UND THROT" },
        { inhouseDc: "MP23-00349-001", customerDc: "", aKeyNo: "4OT10539D8", pKeyNo: "A17188-28", dwgNo: "28810-PPW -0130", dwgName: "PICK UP ASSY" },
        { inhouseDc: "MP23-00349-002", customerDc: "", aKeyNo: "4OT10538E0", pKeyNo: "A17189-30", dwgNo: "28820-PPW -0130", dwgName: "PICK UP ASSY" },
        { inhouseDc: "MP23-00349-003", customerDc: "", aKeyNo: "4OT10971C3", pKeyNo: "A18858-23", dwgNo: "28810-RER -0040", dwgName: "PICK UP ASSY" },
        { inhouseDc: "MP23-00349-004", customerDc: "", aKeyNo: "4OT11429C2", pKeyNo: "A22600-22", dwgNo: "28810-RPC -0130", dwgName: "PICK UP ASSY" },
        { inhouseDc: "MP23-00349-005", customerDc: "", aKeyNo: "4OT11516B9", pKeyNo: "A22661-19", dwgNo: "28820-RPC -0130", dwgName: "PICK UP ASSY" },
        { inhouseDc: "MP23-00349-006", customerDc: "", aKeyNo: "4OT11799B6", pKeyNo: "A24569-16", dwgNo: "28820-R29 -0130", dwgName: "PICK UP ASSY" },
        { inhouseDc: "MP23-00349-007", customerDc: "", aKeyNo: "4OT11944B6", pKeyNo: "A25583-16", dwgNo: "28810-R90 -0130", dwgName: "PICK UP ASSY" },
        { inhouseDc: "MP23-00349-008", customerDc: "", aKeyNo: "4OT12963B3", pKeyNo: "A31665-13", dwgNo: "28820-RJ2 -0030", dwgName: "PICK UP ASSY" },
      ];
      mergeRows = [];
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
          } else if (loopCount === 2) { // Tải bản vẽ trước đó của bản vẽ
            checkResult = await gnets.getPreviousDrn(drawing, todayTempDirectory);
          } else if (loopCount >= 3) { // Check trên tings
            checkResult = await checkFactoryDrawingOnTings(drawing, gnets);
          }

          autoBotDebugger(checkResult);

          if (!checkResult.factory) {
            autoBotDebugger(`${drawing.inhouseDc} (${drawing.aKeyNo}) is not a detected, retrying previous drawing`);
            skippedDrawings.push({ ...drawing, received: Boolean(drawing.received) });
            continue;
          }

          checkResult.factory = replaceSiteNames(checkResult.factory, SITE_NAMES);

          const { factory } = checkResult;
          if (factory) {
            const result = { ...drawing, ...checkResult };
            processedDrawings.push(result);
          }
        } catch (error) {
          autoBotDebugger(`resulting error: ${error}`);
          skippedDrawings.push(drawing);
          crawlError = error;
        }
      }
    } while (!isEmpty(skippedDrawings) && loopCount < 4);
    const endTime = performance.now();

    downloadDrawingList = processedDrawings.filter(({ isVNTec, categoryObj }) => Boolean(isVNTec) && Boolean(categoryObj["S1"] || categoryObj["MP"]));

    autoBotDebugger({ processedDrawings, skippedDrawings, downloadDrawingList });

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
        ${skippedDrawings.length > 0 ? `Danh sách bản vẽ không tìm được nơi lắp ráp: <br/> ${skippedDrawingStringList}` : ""}<br/>
        ${crawlError ? `Lỗi kéo bản vẽ: ${crawlError.message}<br />` : '<br />'}`,
        attachments,
      });
    }

    await Promise.all([...processedDrawings, ...skippedDrawings].map(drawing => {
      const partLineAll = drawingList.filter(d => d.inhouseDc === drawing.inhouseDc);

      return api.apiPost({
        url: URL,
        encodedToken,
        data: {
          ...drawing,
          releasedDate: getDateFromExcelValue(drawing.releaseDate),
          partLineAll,
          poChecker,
          performer,
        },
      })
    }));

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
