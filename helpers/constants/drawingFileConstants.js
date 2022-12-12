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

export const TABLE_REGION = {
  PADDING: 60,
  LEFT: 150,
  TOP: 1560,
  WIDTH: 400,
  HEIGHT: 120,
};
export const BLOCK_PADDING = 15;
export const FACTORY_BLOCK_PADDING = 7;
export const DEBUG_FOLDER = './debug';

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
    PART_NO_INPUT: '',
    SEARCH_BUTTON: '',
    P_NO_NUMBER: '',
    SITE_CELLS: '',
  },
};
