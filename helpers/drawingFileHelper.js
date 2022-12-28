import debug from 'debug';
import { countBy, round } from 'lodash';
import { OEM, PSM } from 'tesseract.js';
import { getHighestSubCode, normalizeString } from '../knowhow';
import {
  ANGLE_CHECKING_STEP,
  ASSEMBLY_ROW_INDEX,
  BLOCK_PADDING, CATEGORY_REGION_LIST, CSS_SELECTOR,
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
  PDF_ZOOM_RATIO, RANK_REGION_LIST, SHIPPING_ROW_INDEX,
  SITE_TABLE_REGION,
  WHITE_PIXEL_RATE
} from './constants/drawingFileConstants';
import ImageHelper from './imageHelper';
import OCRHelper from './ocrHelper';
import PDFHelper from './pdfHelper';

const autoBotDebugger = debug('app:bot');

const TO_BASE64 = true;

// export function getPreviousInhouseDc(inhouseDc) {
//   const codeNumberCount = 3;
//   const codeRegex = /(-\d{3})$/;

//   if (String(inhouseDc).match(codeRegex)) {
//     const prevCount = Number(String(inhouseDc).slice(-codeNumberCount)) - 1;
//     const dcNumber = ('0'.repeat(codeNumberCount) + String(prevCount)).slice(-codeNumberCount);
//     const prevInhouseDc = String(inhouseDc).replace(codeRegex, '') + `-${dcNumber}`;
//     return prevInhouseDc;
//   }
// }

export async function checkFactoryDrawingOnTings(drawing, webHelper) {
  const { partNo } = drawing;
  if (!partNo) {
    return undefined;
  }

  const tingsPage = await webHelper.browser.newPage()
  await tingsPage.goto(`https://tings.toyo-denso.co.jp/main/itemSearch/form/`, {
    timeout: 60000,
  });

  const subNoRegex = /-\d{2,}$/
  const partCode = partNo.match(subNoRegex) ? partNo.slice(0, 6) : partNo;

  await tingsPage.type(CSS_SELECTOR.TINGS.PART_NO_INPUT, partCode);
  const searchButton = await tingsPage.$(CSS_SELECTOR.TINGS.SEARCH_BUTTON);
  await searchButton.click();
  await tingsPage.waitForNavigation({ waitUntil: 'networkidle2' });

  const totalRecordEle = await tingsPage.$(CSS_SELECTOR.TINGS.TOTAL_RECORD_ELE);
  let totalRecord = normalizeString(await (await totalRecordEle.getProperty('innerHTML')).jsonValue());
  totalRecord = totalRecord.slice(totalRecord.indexOf(":") + 1, 17)
  const totalPage = Math.ceil(totalRecord / 50);

  const partNoList = [], siteList = [];
  let page = 1;

  do {
    const rows = await tingsPage.$$(CSS_SELECTOR.TINGS.TABLE_ROWS);

    for (const row of rows) {
      const partNoCell = await row.$('td:nth-child(2)');
      const partNoValue = String(await (await partNoCell.getProperty('innerText')).jsonValue());
      const siteCell = await row.$('td:nth-child(10)');
      const siteValue = String(await (await siteCell.getProperty('innerText')).jsonValue());
      partNoList.push(partNoValue);
      siteList.push(siteValue);
    }
    if (page < totalPage) {
      const nextPageButton = await totalRecordEle.$('a:nth-last-child(2)');
      if (nextPageButton) {
        await nextPageButton.click();
        await tingsPage.waitForNavigation({ waitUntil: 'networkidle2' });
      }
    }
    page++;
  } while (page === totalPage);
  await tingsPage.close();

  let site;

  if (partNoList.length > 0 && siteList.length > 0) {
    const highestSubCode = getHighestSubCode(partNo, partNoList);
    if (highestSubCode) {
      const { partNo, subNo, highestCode } = highestSubCode;
      const siteIndexes = []
      partNoList.forEach((no, i) => {
        if (no === highestCode) {
          siteIndexes.push(i);
        };
      });
      site = siteList.filter((v, i) => siteIndexes.includes(i));
    } else {
      site = [...new Set(siteList)];
    }
    return { factory: site, checked: true, isVNTec: site.length === 1 && site[0].toLowerCase() === "vntec" };
  } else {
    autoBotDebugger("No tings result found!");
    return undefined;
  }
}

export async function checkFactoryDrawingByFile(fullFilePath) {
  const pdf = new PDFHelper();
  await pdf.read(fullFilePath);
  let angle = 0;
  let siteMetaData,
    drawingRank,
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
    siteMetaData = await siteOfDrawingSegmentInfo(imageBuffer, round(angle, 3));


    ({ tableRegion, factoryCodeList } = siteMetaData);

    // DEBUG START

    //for (const segmentedRegion of tableRegion) {
    //  const { rowIndex, cellIndex, left, top, width, height } = segmentedRegion;
    //  let imgSegmentedRegion = await cropRegion(imageBuffer, left, top, width, height, angle);
    //  await imgSegmentedRegion.writeToFile(`../cache/temp/debug/r${rowIndex}.c${cellIndex}.${IMAGE_FILE_TYPE.JPG}`); // write to file to debug
    //}

    // DEBUG END

    const firstRowRegion = tableRegion.filter((r) => r.rowIndex === 1);

    if (firstRowRegion.length) {
      autoBotDebugger(`Segmented ${tableRegion.length} (region) with angle ${angle} => OK`);
      break;
    } else {
      autoBotDebugger(`Can't segment with angle ${angle} => Retry with next angle`);
    }
  }
  // const vendorRegionList = tableRegion.filter((region) => region.rowIndex === 1 && region.cellIndex !== 0);
  const shippingCheckedRegionList = tableRegion.filter((region) => region.rowIndex === SHIPPING_ROW_INDEX && region.cellIndex !== 0);
  const assemblyCheckedRegionList = tableRegion.filter((region) => region.rowIndex === ASSEMBLY_ROW_INDEX && region.cellIndex !== 0);
  const shippingCheckedList = [],
    assemblyCheckedList = [],
    categoryObj = {};

  for (let i = 0; i < MAX_HORIZONTAL_BLOCK_COUNT; i++) {
    const shippingChecked = await isCellChecked(imageBuffer, shippingCheckedRegionList[i]);
    const assemblyChecked = await isCellChecked(imageBuffer, assemblyCheckedRegionList[i]);

    shippingCheckedList[i] = shippingChecked;
    assemblyCheckedList[i] = assemblyChecked;
  }

  for (const region of CATEGORY_REGION_LIST) {
    const { category, left, top, width, height } = region;

    // DEBUG START

    // let imgSegmentedRegion = await cropRegion(imageBuffer, left, top, width, height, 0);
    // await imgSegmentedRegion.writeToFile(`./cache/debug/${category}.${IMAGE_FILE_TYPE.JPG}`); // write to file to debug

    // DEBUG END

    const isChecked = await isCellChecked(imageBuffer, region, 0.9);
    categoryObj[category] = isChecked;
  }

  for (const region of RANK_REGION_LIST) {
    const { rank, left, top, width, height } = region;

    // DEBUG START

    // let imgSegmentedRegion = await cropRegion(imageBuffer, left, top, width, height, 0);
    // await imgSegmentedRegion.writeToFile(`./cache/debug/${rank}.${IMAGE_FILE_TYPE.JPG}`); // write to file to debug

    // DEBUG END

    const isChecked = await isCellChecked(imageBuffer, region);
    if (isChecked) {
      drawingRank = rank;
      break;
    }
  }

  // const shippingCheckedCount = countBy(shippingCheckedList, (i) => i == true).true;
  const assemblyCheckedCount = countBy(assemblyCheckedList, (i) => i == true).true;

  // if (checkedCount === 1 && checkedList[VTIndex])
  // if (shippingCheckedCount > 1) {
  //   return undefined;
  // }

  if (assemblyCheckedCount === 1) {
    const checkedIndex = assemblyCheckedList.findIndex((checked) => checked === true);
    const factory = factoryCodeList[checkedIndex];
    return { factory, checked: Boolean(checkedIndex >= 0), isVNTec: factory === 'VT', drawingRank, categoryObj };
  } else if (assemblyCheckedCount > 1) {
    const factory = factoryCodeList.filter((f, i) => assemblyCheckedList[i]);
    return { factory, checked: true, isVNTec: false, drawingRank, categoryObj };
  }
}

export async function siteOfDrawingSegmentInfo(buffer, rotatedAngle = 0) {
  const tmpImg = new ImageHelper();

  const tesseractOcr = new OCRHelper();
  await tesseractOcr.createWorker();
  await tesseractOcr.setParameters({
    tessedit_char_whitelist: FACTORY_CODE_CHAR_WHITELIST,
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_ocr_engine_mode: OEM.TESSERACT_LSTM_COMBINED,
  });

  const TABLE_LEFT = PDF_ZOOM_RATIO * SITE_TABLE_REGION.LEFT - SITE_TABLE_REGION.PADDING,
    TABLE_TOP = PDF_ZOOM_RATIO * SITE_TABLE_REGION.TOP - SITE_TABLE_REGION.PADDING,
    TABLE_WIDTH = PDF_ZOOM_RATIO * SITE_TABLE_REGION.WIDTH + SITE_TABLE_REGION.PADDING * 2,
    TABLE_HEIGHT = PDF_ZOOM_RATIO * SITE_TABLE_REGION.HEIGHT + SITE_TABLE_REGION.PADDING * 2;

  tmpImg.read(buffer);

  if (rotatedAngle) {
    tmpImg.rotate(rotatedAngle);
  }

  await tmpImg.crop(TABLE_LEFT, TABLE_TOP, TABLE_WIDTH, TABLE_HEIGHT);

  // [!] after cropping, meta data is same??
  // await tmpImg.writeToFile('./cache/debug/testRegion.jpg');

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
    autoBotDebugger(`segmentInfoRegion: Can't find out topY!`);
    return [];
  } else {
    autoBotDebugger(`segmentInfoRegion: topY 's founded: ${topY}`);
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
    autoBotDebugger(`segmentInfoRegion: Can't find out topX!`);
    return [];
  } else {
    autoBotDebugger(`segmentInfoRegion: topX 's founded: ${topX}`);
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
          .replace(/\r?\n|\r|\|/g, '') // replace all unnecessary character
          .match(/.{2}/g); // split text into array of segments with 2 character
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
        autoBotDebugger(`segmentInfoRegion: Can't segment row ${rowIndex}!`);
      }
    }
  }

  tesseractOcr.terminate();

  if (!rowIndex) {
    autoBotDebugger(`segmentInfoRegion: Can't find out any row!`);
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
    autoBotDebugger(`Doma_Helper.cropRegion: width = ${width} < 0 => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (height < 0) {
    autoBotDebugger(`Doma_Helper.cropRegion: height = ${height} < 0 => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (left > IMAGE_WIDTH) {
    autoBotDebugger(`Doma_Helper.cropRegion: left = ${left} > IMAGE_WIDTH: ${IMAGE_WIDTH} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (top > IMAGE_HEIGHT) {
    autoBotDebugger(`Doma_Helper.cropRegion: top = ${top} > IMAGE_HEIGHT: ${IMAGE_HEIGHT} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (left + width > IMAGE_WIDTH) {
    autoBotDebugger(`Doma_Helper.cropRegion: left + width = ${left + width} > IMAGE_WIDTH: ${IMAGE_WIDTH} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (top + height > IMAGE_HEIGHT) {
    autoBotDebugger(`Doma_Helper.cropRegion: top + height = ${top + height} > IMAGE_HEIGHT: ${IMAGE_HEIGHT} => Wrong crop region`);

    // throw new Error(RPA_ERROR.WRONG_CROP_REGION);
  }

  if (angle) {
    tmpImg.rotate(angle);
  }

  await tmpImg.crop(left, top, width, height);
  // await img.writeToFile(`./temp/partNo.${IMAGE_FILE_TYPE.JPG}`);

  return tmpImg;
}

async function isCellChecked(imageBuffer, region, ratio = 0.8) {
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
  return !Boolean(pixelMatrix.filter((pixel) => pixel === 255).length / pixelMatrix.length > ratio); // (number of white pixels / number of pixels) > 80% in cropRegion == not checked
}
