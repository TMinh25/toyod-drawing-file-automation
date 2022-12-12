import debug from 'debug';
import { countBy, round } from 'lodash';
import { OEM, PSM } from 'tesseract.js';
import { daysBetween } from '../knowhow.js';
import {
  ANGLE_CHECKING_STEP,
  ASSEMBLY_ROW_INDEX,
  BLOCK_PADDING,
  CSS_SELECTOR,
  FACTORY_CODE_CHAR_WHITELIST,
  FIRST_PAGE,
  IMAGE_DESITY,
  IMAGE_FILE_TYPE,
  MAX_HORIZONTAL_BLOCK_COUNT,
  MAX_LINE_WIDTH,
  MAX_ROTATED_ANGLE,
  MAX_VERTICAL_BLOCK_COUNT,
  MIN_BLOCK_HEIGHT,
  MIN_BLOCK_WIDTH,
  MIN_ROTATED_ANGLE,
  PDF_ZOOM_RATIO,
  SHIPPING_ROW_INDEX,
  TABLE_REGION,
  WHITE_PIXEL_RATE,
} from './constants/drawingFileConstants.js';
import ImageHelper from './imageHelper.js';
import OCRHelper from './ocrHelper.js';
import PDFHelper from './pdfHelper.js';
import WebHelper from './webHelper.js';

const appBizDebugger = debug('app:biz');

const TO_BASE64 = true;

function getPreviousInhouseDc(inhouseDc) {
  const codeNumberCount = 3;
  const codeRegex = /(-\d{3})$/;

  if (String(inhouseDc).match(codeRegex)) {
    const prevCount = Number(String(inhouseDc).slice(-codeNumberCount)) - 1;
    const dcNumber = ('0'.repeat(codeNumberCount) + String(prevCount)).slice(-codeNumberCount);
    const prevInhouseDc = String(inhouseDc).replace(codeRegex, '') + `-${dcNumber}`;
    return prevInhouseDc;
  }
}

export async function getPreviousDrn(file, sessionId) {
  try {
    const { prevDrawing, dir } = file;
    const prevInhouseDc = getPreviousInhouseDc(prevDrawing.inhouseDc);

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

    const prevDrawingRes = await axios.get(`http://cad-sv01:7001/gnets/viewdrn.do?inhouseDc=${prevInhouseDc}`, downloadOptions);
    fs.writeFileSync(`${dir}/prevDrn.pdf`, prevDrawing.data);

    file.prevDrawing = {
      filePath: `${dir}/prevDrn.pdf`,
      buffer: prevDrawingRes.data,
      inhouseDc: prevInhouseDc,
    };
  } catch (err) {
    console.error(err);
  }
}

export async function checkFactoryDrawingOnTings(drawing) {
  const { inhouseDc, partNo, releaseDate } = drawing;
  console.log(drawing);

  // const browser = await puppeteer.launch({
  //   headless: false,
  //   args: ['--no-sandbox', '--disable-setuid-sandbox'],
  //   ignoreHTTPSErrors: true,
  // });
  // const web = await browser.newPage();
  // await web.setViewport({
  //   width: 1920,
  //   height: 1080,
  //   deviceScaleFactor: 1,
  // });
  const web = new WebHelper();
  await web.goto(`https://tings.toyo-denso.co.jp/main/itemSearch/form/`);
  await web.type(CSS_SELECTOR.TINGS.PART_NO_INPUT, partNo);
  const searchButton = await web.$(CSS_SELECTOR.TINGS.SEARCH_BUTTON);
  await searchButton.click();
  await web.waitForTimeout(10000);
  const rows = await web.$$(CSS_SELECTOR.TINGS.TABLE_ROWS);

  let closestDate, site;
  for (const row of rows) {
    const partNoCell = await row.$('td:nth-child(2)');
    const partNoValue = String(await (await partNoCell.getProperty('innerText')).jsonValue());
    const createDateCell = await row.$('td:nth-child(8)');
    const createDateValue = String(await (await createDateCell.getProperty('innerText')).jsonValue());

    const daysBetweenCreateDate = daysBetween(createDateValue, releaseDate);
    if (partNoValue === partNo && daysBetweenCreateDate <= closestDate) {
      closestDate = daysBetweenCreateDate;
      const siteCell = await row.$('td:nth-child(10)');
      const siteValue = String(await (await siteCell.getProperty('innerText')).jsonValue());

      site = siteValue.slice(0, 1) + 'T';
    }
  }

  console.log(site);
  return site;
}

export async function checkFactoryDrawingByFile(fullFilePath) {
  const pdf = new PDFHelper();
  await pdf.read(fullFilePath);

  let angle = 0;
  let imageMetaData,
    tableRegion = [],
    factoryCodeList = [];

  const { width: PDF_WIDTH, height: PDF_HEIGHT } = pdf.getPageSize(FIRST_PAGE);

  const { base64: base64Image } = await pdf.convertToImage(
    {
      format: IMAGE_FILE_TYPE.JPG,
      width: PDF_ZOOM_RATIO * PDF_WIDTH,
      height: PDF_ZOOM_RATIO * PDF_HEIGHT,
      density: IMAGE_DESITY,
    },
    FIRST_PAGE,
    TO_BASE64
  );

  const imageBuffer = Buffer.from(base64Image, 'base64');

  for (angle = MIN_ROTATED_ANGLE; angle < MAX_ROTATED_ANGLE; angle += ANGLE_CHECKING_STEP) {
    imageMetaData = await segmentInfoRegion(imageBuffer, round(angle, 3));

    ({ tableRegion, factoryCodeList } = imageMetaData);

    // DEBUG START

    // for (const segmentedRegion of tableRegion) {
    //   const { rowIndex, cellIndex, left, top, width, height } = segmentedRegion;

    //   let imgSegmentedRegion = await cropRegion(imageBuffer, left, top, width, height, angle);

    //   await imgSegmentedRegion.writeToFile(getDebugFileName(fileName, `r${rowIndex}.c${cellIndex}`, IMAGE_FILE_TYPE.JPG)); // write to file to debug
    // }

    // DEBUG END

    const firstRowRegion = tableRegion.filter((r) => r.rowIndex === 1);

    if (firstRowRegion.length) {
      appBizDebugger(`Segmented ${tableRegion.length} (region) with angle ${angle} => OK`);
      break;
    } else {
      appBizDebugger(`Can't segment with angle ${angle} => Retry with next angle`);
    }
  }
  // const vendorRegionList = tableRegion.filter((region) => region.rowIndex === 1 && region.cellIndex !== 0);
  const shippingCheckedRegionList = tableRegion.filter((region) => region.rowIndex === SHIPPING_ROW_INDEX && region.cellIndex !== 0);
  const assemblyCheckedRegionList = tableRegion.filter((region) => region.rowIndex === ASSEMBLY_ROW_INDEX && region.cellIndex !== 0);
  const shippingCheckedList = [],
    assemblyCheckedList = [];

  for (let i = 0; i < MAX_HORIZONTAL_BLOCK_COUNT; i++) {
    const shippingChecked = await isCellChecked(imageBuffer, shippingCheckedRegionList[i]);
    const assemblyChecked = await isCellChecked(imageBuffer, assemblyCheckedRegionList[i]);

    shippingCheckedList[i] = shippingChecked;
    assemblyCheckedList[i] = assemblyChecked;
  }

  const shippingCheckedCount = countBy(shippingCheckedList, (i) => i == true).true;
  const assemblyCheckedCount = countBy(assemblyCheckedList, (i) => i == true).true;

  // if (checkedCount === 1 && checkedList[VTIndex])
  if (shippingCheckedCount > 1) {
    return undefined;
  }

  if (assemblyCheckedCount === 1) {
    const checkedIndex = assemblyCheckedList.findIndex((checked) => checked === true);
    const factory = factoryCodeList[checkedIndex];
    return { factory, checked: Boolean(checkedIndex >= 0), isVNTec: factory === 'VT' };
  }
}

export async function segmentInfoRegion(buffer, rotatedAngle = 0) {
  const tmpImg = new ImageHelper();

  const tesseractOcr = new OCRHelper();
  await tesseractOcr.createWorker();
  await tesseractOcr.setParameters({
    tessedit_char_whitelist: FACTORY_CODE_CHAR_WHITELIST,
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_ocr_engine_mode: OEM.TESSERACT_LSTM_COMBINED,
  });

  const TABLE_LEFT = PDF_ZOOM_RATIO * TABLE_REGION.LEFT - TABLE_REGION.PADDING,
    TABLE_TOP = PDF_ZOOM_RATIO * TABLE_REGION.TOP - TABLE_REGION.PADDING,
    TABLE_WIDTH = PDF_ZOOM_RATIO * TABLE_REGION.WIDTH + TABLE_REGION.PADDING * 2,
    TABLE_HEIGHT = PDF_ZOOM_RATIO * TABLE_REGION.HEIGHT + TABLE_REGION.PADDING * 2;

  tmpImg.read(buffer);

  if (rotatedAngle) {
    tmpImg.rotate(rotatedAngle);
  }

  await tmpImg.crop(TABLE_LEFT, TABLE_TOP, TABLE_WIDTH, TABLE_HEIGHT);

  // [!] after cropping, meta data is same??
  await tmpImg.writeToFile('./debug/testRegion.jpg');

  tmpImg.greyscale().threshold();

  const { data } = await tmpImg.getRawBuffer();

  const pixelMatrix = new Uint8ClampedArray(data.buffer);

  const getPixelValue = (x, y) => (pixelMatrix[y * TABLE_WIDTH + x] == 255 ? 1 : 0); // get value of pixel at position(x,y)

  let topX,
    topY,
    x,
    y,
    factoryCodeList = [];

  for (topY = 0; topY < TABLE_HEIGHT / 2; topY += 1) {
    let rowDensity = 0;

    for (let tempX = 0; tempX < TABLE_WIDTH - 1; tempX++) {
      rowDensity += getPixelValue(tempX, topY);
    }

    if (rowDensity < TABLE_WIDTH * WHITE_PIXEL_RATE) {
      break;
    }
  }

  if (topY >= TABLE_HEIGHT / 2) {
    appBizDebugger(`segmentInfoRegion: Can't find out topY!`);
    return [];
  } else {
    appBizDebugger(`segmentInfoRegion: topY 's founded: ${topY}`);
  }

  for (topX = 0; topX < TABLE_WIDTH / 2; topX += 1) {
    let colDensity = 0;

    for (let tempY = 0; tempY < TABLE_HEIGHT - 1; tempY++) {
      colDensity += getPixelValue(topX, tempY);
    }

    if (colDensity < TABLE_HEIGHT * WHITE_PIXEL_RATE) {
      break;
    }
  }

  if (topX >= TABLE_WIDTH / 2) {
    appBizDebugger(`segmentInfoRegion: Can't find out topX!`);
    return [];
  } else {
    appBizDebugger(`segmentInfoRegion: topX 's founded: ${topX}`);
  }

  const tableRegion = [];
  let lastLineY = 0;
  let rowIndex = 0;

  for (y = 0; y < TABLE_HEIGHT && rowIndex < MAX_VERTICAL_BLOCK_COUNT; y += MAX_LINE_WIDTH) {
    const height = y - lastLineY;
    if (height < MIN_BLOCK_HEIGHT) continue;

    let rowDensity = 0;

    for (let tempX = 0; tempX < TABLE_WIDTH; tempX++) {
      rowDensity += getPixelValue(tempX, y);
    }

    if (rowDensity < TABLE_WIDTH * WHITE_PIXEL_RATE && height > MIN_BLOCK_HEIGHT) {
      rowIndex++;

      tableRegion.push({
        rowIndex,
        cellIndex: 0,
        left: TABLE_LEFT,
        top: TABLE_TOP + y,
        width: TABLE_WIDTH,
        height,
      });

      let lastLineX = 0;
      let cellIndex = 0;

      if (rowIndex === 1) {
        const cellImg = await cropRegion(buffer, TABLE_LEFT, TABLE_TOP + y, TABLE_WIDTH, height, 0);
        const cellBuffer = await cellImg.writeToBuffer();
        const { text } = await tesseractOcr.recognize(cellBuffer);
        factoryCodeList = String(text)
          .replace(/\r?\n|\r/, '')
          .split('|');
      }

      for (x = topX; x < topX + TABLE_WIDTH && cellIndex < MAX_HORIZONTAL_BLOCK_COUNT; x += MAX_LINE_WIDTH) {
        const width = x - lastLineX;
        if (width < MIN_BLOCK_WIDTH) continue;
        lastLineY = y;

        let colDensity = 0;
        for (let tempY = lastLineY; tempY < y + MIN_BLOCK_HEIGHT; tempY++) {
          colDensity += getPixelValue(x, tempY);
        }

        if (colDensity < height * 0.1 && width > MIN_BLOCK_WIDTH) {
          cellIndex++;
          lastLineX = x;

          tableRegion.push({
            rowIndex,
            cellIndex,
            left: TABLE_LEFT + x,
            top: TABLE_TOP + y,
            width,
            height,
          });
        }
      }

      if (!cellIndex) {
        appBizDebugger(`segmentInfoRegion: Can't segment row ${rowIndex}!`);
      }
    }
  }

  tesseractOcr.terminate();

  if (!rowIndex) {
    appBizDebugger(`segmentInfoRegion: Can't find out any row!`);
  }

  return {
    bottomX: TABLE_LEFT + topX,
    bottomY: TABLE_TOP + topY,
    tableRegion,
    factoryCodeList,
  };
}

async function cropRegion(buffer, left, top, width, height, angle) {
  const tmpImg = new ImageHelper();

  tmpImg.read(buffer);

  const { width: IMAGE_WIDTH, height: IMAGE_HEIGHT } = await tmpImg.getMetadata();

  if (width < 0) {
    appBizDebugger(`Doma_Helper.cropRegion: width = ${width} < 0 => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (height < 0) {
    appBizDebugger(`Doma_Helper.cropRegion: height = ${height} < 0 => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (left > IMAGE_WIDTH) {
    appBizDebugger(`Doma_Helper.cropRegion: left = ${left} > IMAGE_WIDTH: ${IMAGE_WIDTH} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (top > IMAGE_HEIGHT) {
    appBizDebugger(`Doma_Helper.cropRegion: top = ${top} > IMAGE_HEIGHT: ${IMAGE_HEIGHT} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (left + width > IMAGE_WIDTH) {
    appBizDebugger(`Doma_Helper.cropRegion: left + width = ${left + width} > IMAGE_WIDTH: ${IMAGE_WIDTH} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (top + height > IMAGE_HEIGHT) {
    appBizDebugger(`Doma_Helper.cropRegion: top + height = ${top + height} > IMAGE_HEIGHT: ${IMAGE_HEIGHT} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (angle) {
    tmpImg.rotate(angle);
  }

  await tmpImg.crop(left, top, width, height);
  // await img.writeToFile(`./temp/partNo.${IMAGE_FILE_TYPE.JPG}`);

  return tmpImg;
}

async function isCellChecked(imageBuffer, region) {
  const { top, left, width, height } = region;
  const segmentedRegion = await cropRegion(
    imageBuffer,
    left + BLOCK_PADDING,
    top + BLOCK_PADDING,
    width - BLOCK_PADDING * 2,
    height - BLOCK_PADDING * 2,
    0
  );
  segmentedRegion.greyscale().threshold();

  const { data } = await segmentedRegion.getRawBuffer();
  const pixelMatrix = new Uint8ClampedArray(data.buffer);
  return !Boolean(pixelMatrix.filter((pixel) => pixel === 255).length / pixelMatrix.length > 0.8); // (number of white pixels / number of pixels) > 80% in cropRegion == not checked
}
