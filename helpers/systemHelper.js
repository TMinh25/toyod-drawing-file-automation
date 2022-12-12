import { statSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import Downloader from 'nodejs-file-downloader';
import { cpu, mem, drive } from 'node-os-utils';
import { execSync, execFileSync } from 'child_process';

// Reference: https://www.npmjs.com/package/nodejs-file-downloader
//            https://sodocumentation.net/node-js/topic/2974/using-streams
//            https://www.npmjs.com/package/ws
//            https://ehkoo.com/bai-viet/tat-tan-tat-ve-promise-va-async-await#cuoi-cung-.finally()

class System_Helper {
  constructor() {
  }

  getAbsPath(filePath, absDirPath = '') {
    return path.join(absDirPath || __dirname, filePath);
  }

  isOpenedSocket(socket) {
    const stats  = statSync(socket);

    return stats.isSocket();
  }

  readBufferFromFile(filePath) {
    const bitmap = readFileSync(filePath);

    return Buffer.from(bitmap).toString('base64');
  }

  writeBufferToFile(filePath, base64Str) {
    var bitmap = Buffer.from(base64Str, 'base64');

    // TODO: check file existed => ovewrite?
    // Reference: https://www.npmjs.com/package/rimraf

    writeFileSync(filePath, bitmap);
  }

  // TODO: multiple files in parallel by using "child_process.fork"
  // https://www.scrapingbee.com/blog/download-file-puppeteer/

  // TODO: change list of params into options

  async downloadFile(url, directory, fileName, cloneFiles, headers) {
    const downloader = new Downloader({ url, directory, fileName, cloneFiles, headers });

    await downloader.download();
  }

  // More Reference: https://nodejs.org/api/os.html

  async getCpuUsage() {
    return await cpu.info();
  }

  async getCpuUsage() {
    return await cpu.usage;
  }

  async getCpuFree() {
    return await cpu.free();
  }

  async getMemInfo() {
    return await mem.info();
  }

  async getMemUsage() {
    return await mem.used();
  }

  async getMemFree() {
    return await mem.free();
  }

  async getDriveInfo() {
    return await drive.info();
  }

  async getDriveUsage() {
    return await drive.used();
  }

  async getDriveFree() {
    return await drive.free();
  }

  // Reference: https://stackoverflow.com/questions/10179114/execute-powershell-script-from-node-js
  //            https://adamtheautomator.com/invoke-restmethod/#Retrieving_Data_via_a_Simple_GET_request

  // Options Reference: https://nodejs.org/api/child_process.html#child_process_child_process_execsync_command_options

  exec(command, options) {
    return execSync(command, options)
  }

  execFile(file, args, options) {
    return execFileSync(file, args, options)
  }

  spawn(file, args, options) {
    return spawnSync(file, args, options)
  }

  getTerminalSize() {
    const { columns, rows } = process.stdout;

    return ({ columns, rows });
  }
}

export default System_Helper;
