import puppeteer from 'puppeteer';
import debug from 'debug';
import lodash from 'lodash';
const { repeat } = lodash;

import { OPTIMIZED_WEB_VIEWPORT, OPTIMIZED_GOTO_OPTIONS, OPTIMIZED_WAIT_FOR_NAVIGATION_OPTIONS } from './constants/webConstant.js';

const appBizDebugger = debug('app:biz');

class Web_Helper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async openBrowser(options) {
    this.browser = await puppeteer.launch(options);
    this.page = await this.browser.newPage();
    await this.page.setViewport(OPTIMIZED_WEB_VIEWPORT);
  }

  isBrowserOpened() {
    return !!this.page;
  }

  verifyBrowserOpened() {
    if (!this.isBrowserOpened()) {
      throw new Error("Browser isn't opened correctly!");
    }
  }

  async waitForSelector(selector) {
    appBizDebugger(`waitForSelector ${selector}`);

    this.verifyBrowserOpened();

    await this.page.waitForSelector(selector);
  }

  async waitForTimeout(milliseconds) {
    appBizDebugger(`waitForTimeout ${milliseconds} ms`);

    this.verifyBrowserOpened();

    await this.page.waitForTimeout(milliseconds);
  }

  async waitForNavigation(options = OPTIMIZED_WAIT_FOR_NAVIGATION_OPTIONS) {
    this.verifyBrowserOpened();

    await this.page.waitForNavigation(options);
  }

  async gotoUrl(url, options = OPTIMIZED_GOTO_OPTIONS) {
    appBizDebugger(`gotoUrl ${url}`);

    this.verifyBrowserOpened();

    await this.page.goto(url, options);
  }

  async type(selector, text) {
    const { page } = this;

    await page.waitForSelector(selector);

    appBizDebugger(`type ${text}`);
    await page.type(selector, text);
  }

  async click(selector, text) {
    this.verifyBrowserOpened();

    const { page } = this;

    await page.waitForSelector(selector);

    appBizDebugger(`click ${selector}`);
    await page.click(selector, text);
  }

  async hover(selector, text) {
    this.verifyBrowserOpened();

    const { page } = this;

    await page.waitForSelector(selector);

    appBizDebugger(`hover ${selector}`);
    await page.hover(selector, text);
  }

  getPageInstant() {
    return this.page;
  }

  getPageUrl() {
    this.verifyBrowserOpened();

    return this.page.url();
  }

  async getCookies() {
    const cookies = await this.page.cookies();

    // console.log('cookies', cookies);

    return cookies;
  }

  async getNodeInnerHtml(selector) {
    this.verifyBrowserOpened();

    try {
      return await this.page.evaluate(new Function(`var node = document.querySelector('${selector}'); return (node ? node.innerHTML : '');`));
    } catch {
      throw new Error("Can't get node innerHtml");
    }
  }

  async getNodeInnerText(selector) {
    this.verifyBrowserOpened();

    try {
      return await this.page.evaluate(new Function(`var node = document.querySelector('${selector}'); return (node ? node.innerText : '');`));
    } catch {
      throw new Error("Can't get node innerHtml");
    }
  }

  async getNodeAtttribute(selector, atttribute) {
    this.verifyBrowserOpened();

    try {
      return await this.page.evaluate(new Function(`var node = document.querySelector('${selector}'); return (node ? node.atrributes.toString() : '');`));
    } catch {
      throw new Error("Can't get node innerHtml");
    }
  }

  async getNodeAtttributeAll(selector, atttribute) {
    this.verifyBrowserOpened();

    try {
      let pageFunction = '';

      // [!] use THIS to DEBUG:
      // pageFunction += `return  nodeList.length;`;

      pageFunction += `var nodeList = document.querySelectorAll('${selector}');`;
      pageFunction += `var attributeList = [];`;

      pageFunction += `for (var i = 0; i < nodeList.length; i += 1) {`;
      pageFunction += `   var node = nodeList[i];`;
      pageFunction += `   var attr = node.getAttributeNode('${atttribute}').value;`;

      pageFunction += `   attributeList.push(attr);`;
      pageFunction += `}`;

      pageFunction += `return attributeList;`;

      return await this.page.evaluate(new Function(pageFunction));
    } catch {
      throw new Error("Can't get node innerHtml");
    }
  }

  async getLocalStorageItem(key) {
    this.verifyBrowserOpened();

    return await this.page.evaluate(new Function(`return localStorage.getItem('${key}');`));
  }

  async evaluate(func) {
    this.verifyBrowserOpened();

    return await this.page.evaluate(func);
  }

  // https://github.com/puppeteer/puppeteer/blob/v10.2.0/docs/api.md#elementhandleselector
  async $(selector) {
    this.verifyBrowserOpened();

    return await this.page.$(selector);
  }

  // https://github.com/puppeteer/puppeteer/blob/v10.2.0/docs/api.md#elementhandleselector-1
  async $$(selector) {
    this.verifyBrowserOpened();

    return await this.page.$$(selector);
  }

  showDOMNode(dom, deepLevel = 0) {
    const { childNodes } = dom;

    for (const childNode of childNodes) {
      const { _rawText, rawTagName, rawAttrs, childNodes: grandChildNodes } = childNode;

      appBizDebugger(`${repeat(' ', deepLevel * 3)} + deepLevel: ${deepLevel}, rawText: ${_rawText || ''}, tagName: ${rawTagName || ''}, rawAttrs: ${rawAttrs || ''}`);

      for (const grandChildNode of grandChildNodes) {
        this.showDOMNode(grandChildNode, deepLevel + 1);
      }
    }
  }

  async closeBrowser() {
    try {
      await this.browser.close();
      // appBizDebugger('Closed browser gradeful!');
    } catch {
      // appBizDebugger('Can\'t close browser gradeful!');
    }
  }

  // Reference: https://www.scrapingbee.com/blog/download-file-puppeteer/
  async clickToDownload(selector, downloadPath) {
    await this.page._client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath });

    await this.page.click(selector);

    // TODO: change fileName
    // TODO: check download completed status
  }
}

export default Web_Helper;
