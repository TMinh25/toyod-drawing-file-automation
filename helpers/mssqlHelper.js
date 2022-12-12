
// import debug from 'debug';
import mssql from 'mssql';

// const appBizDebugger = debug('app:biz');

class MSSQL_Helper {
  constructor(config) {
    this.config = config || [];
  }

  async connect(config) {
    if (config) {
      this.config = config;
    }

    this.conn = await mssql.connect(this.config);
  }

  async query(queryString) {
    return await this.conn.query(queryString);
  }

  newRequest() {
    this.request = new this.conn.Request();
    return this.request;
  }

  addParam(name, type, value) {
    this.request.input(name, type, value);
  }

  addOutput(name, type) {
    this.request.output(name, type);
  }

  async execute(procedureName) {
    await this.request.execute(procedureName)
  }

  async disconnect() {
    await this.conn.close();
  }
};

export default MSSQL_Helper;
