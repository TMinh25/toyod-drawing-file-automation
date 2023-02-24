export const FIRST_PAGE = 1;
export const IMAGE_FILE_TYPE = {
  PNG: 'png',
  JPG: 'jpg',
};

export const PDF_ZOOM_RATIO = 2;
export const IMAGE_DESITY = 300;

export const MIN_ROTATED_ANGLE = 0;
export const MAX_ROTATED_ANGLE = 1; // [..] almost less than 0.3
export const ANGLE_CHECKING_STEP = 0.1;

export const WHITE_PIXEL_RATE = 0.7;
export const CELL_HEADER_HEIGHT_RATE = 0.32;

export const MIN_BLOCK_HEIGHT = 10;
export const MIN_BLOCK_WIDTH = 60;
export const MAX_LINE_WIDTH = 1;
export const MAX_VERTICAL_BLOCK_COUNT = 3;
export const MAX_HORIZONTAL_BLOCK_COUNT = 13;

export const FACTORY_CODE_LIST = ['MF', 'KF', 'WT', 'ST', 'TT', 'IT', 'GT', 'VT', 'UT'];
export const FACTORY_CODE_CHAR_WHITELIST = 'FGIKMSTUVW|';
export const SHIPPING_ROW_INDEX = 2;
export const ASSEMBLY_ROW_INDEX = 3;
export const MAX_HISTORY_CHECK_FILES = 4;

export const SITE_TABLE_REGION = {
  PADDING: 60,
  LEFT: 150,
  TOP: 1560,
  WIDTH: 400,
  HEIGHT: 120,
};

export const CATEGORY_TABLE_REGION = {
  PADDING: 10,
  LEFT: 90,
  TOP: 187,
  WIDTH: 500,
  HEIGHT: 100,
};

export const RANK_TABLE_REGION = {
  PADDING: 10,
  LEFT: 100,
  TOP: 1800,
  WIDTH: 900,
  HEIGHT: 100,
}

const CHECK_BOX_SIZE = 34;
const CATEGORY_FIRST_ROW = 389;
const CATEGORY_SECOND_ROW = 465;
const CATEGORY_THIRD_ROW = 519;

const CATEGORY_FIRST_COL = 223;
const CATEGORY_SECOND_COL = 415;
const CATEGORY_THIRD_COL = 609;
const CATEGORY_FOURTH_COL = 801;
const CATEGORY_FIFTH_COL = 993;

export const CATEGORY_REGION_LIST = [
  {
    category: "new",
    left: CATEGORY_FIRST_COL,
    top: CATEGORY_FIRST_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "rev",
    left: CATEGORY_SECOND_COL,
    top: CATEGORY_FIRST_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "S0",
    left: CATEGORY_FIRST_COL,
    top: CATEGORY_SECOND_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "S1",
    left: CATEGORY_SECOND_COL,
    top: CATEGORY_SECOND_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "MP",
    left: CATEGORY_THIRD_COL,
    top: CATEGORY_SECOND_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "plan",
    left: CATEGORY_FIRST_COL,
    top: CATEGORY_THIRD_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "LM",
    left: CATEGORY_SECOND_COL,
    top: CATEGORY_THIRD_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "RS",
    left: CATEGORY_THIRD_COL,
    top: CATEGORY_THIRD_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "RC",
    left: CATEGORY_FOURTH_COL,
    top: CATEGORY_THIRD_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    category: "TR",
    left: CATEGORY_FIFTH_COL,
    top: CATEGORY_THIRD_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
];

const RANK_ROW = 2405;

export const RANK_REGION_LIST = [
  {
    rank: "A",
    left: 413,
    top: RANK_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    rank: "B",
    left: 868,
    top: RANK_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    rank: "C",
    left: 1323,
    top: RANK_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
  {
    rank: "D",
    left: 1779,
    top: RANK_ROW,
    width: CHECK_BOX_SIZE,
    height: CHECK_BOX_SIZE,
  },
]

export const BLOCK_PADDING = 15;
export const FACTORY_BLOCK_PADDING = 7;
export const DEBUG_FOLDER = './cache/debug';
export const newDwgDivValue = '新' // SHIN = NEW

export const CSS_SELECTOR = {
  LOGIN_SCREEN: {
    USER_NAME: '#main > table:nth-child(3) > tbody > tr:nth-child(2) > td:nth-child(3) > input',
    PASSWORD: '#main > table:nth-child(3) > tbody > tr:nth-child(3) > td:nth-child(3) > input[type=password]',
    LOGIN_BUTTON: '#main > table:nth-child(3) > tbody > tr:nth-child(7) > td:nth-child(3) > a',
  },

  NORECEIVED_PAGE: {
    DOWNLOAD_EXCEL: `#searchbox > div > table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(2) > td > font`,
  },

  TINGS: {
    TABLE_ROWS: '#main > table.resTab > tbody > tr:not(:first-child)',
    PART_NO_INPUT: '#main input[name=partNo]',
    SEARCH_BUTTON: '#main input[name=search]',
    TOTAL_RECORD_ELE: '#main > .band1',
  },

  RELEASED_PAGE_SELECTOR: {
    TABLE_ROWS: `tbody#tbd1 > tr[id*='row_']`,
  }
};

export const aSubNoRegex = /\w{1}\d{1}$/;
export const subNoRegex = /-\d{2,}$/;
export const otSubNoRegex = /^(\dOT)\d{5}(A\d{1,})$/;