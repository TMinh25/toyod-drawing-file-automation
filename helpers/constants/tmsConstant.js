export const DEFAULT_VIEWPORT = {
  width: 1440,
  height: 694,
};

export const AVERAGE_LOGIN_DURATION = 6000;
export const AVERAGE_MODULE_LOADING_DURATION = 3000;
export const AVERAGE_FUNCTION_LOADING_DURATION = 500;
export const AVERAGE_FORM_LOADING_DURATION = 500;
export const DEFAULT_DATE_PICKER_LOADING_DURATION = 500;

export const CSS_SELECTOR = {
  MASTER_PAGE: {
    MAIN_MENU: "div.blue",
    MAIN_MENU_FIRST_ITEM: "div.blue > div:nth-child(2)",
    JUNK_ITEM_COUNT: 4,
    LANGUAGE_ITEM_TEXT: "English",

    SUB_MENU: ".borderless",
    SUB_MENU_FIRST_ITEM: ".borderless > div:nth-child(1) > div:nth-child(1) > input:nth-child(1)",
  },

  LOGIN_FORM: {
    USER_NAME: "div.field:nth-child(1) > div:nth-child(1) > input:nth-child(1)",
    PASSWORD: "div.field:nth-child(2) > div:nth-child(1) > input:nth-child(1)",
    LOGIN_BUTTON: "button.ui",
  },

  LOGOUT: {
    ACCOUNT_MENU: "div.top:nth-child(3) > span:nth-child(1)",
    LOG_OUT_BUTTON: "div.top:nth-child(3) > div:nth-child(3) > div:nth-child(6)",
  },

  LIST_SCREEN: {
    FUNCTION_NAME: '.content > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)',
    FIRST_RECORD: 'table.ui > tbody:nth-child(2) > tr:nth-child(1) > td:nth-child(3) > a:nth-child(1)',
  },

  FORM_SCREEN: {
    DATE_PICKER_CURRENT_DATE: '.react-datepicker > .react-datepicker__month-container > .react-datepicker__month > .react-datepicker__week > .react-datepicker__day--keyboard-selected',
    DATE_PICKER_SELECT_DATE: '.react-datepicker > .react-datepicker__month-container > .react-datepicker__month > .react-datepicker__week > .react-datepicker__day--selected',
  }
};
