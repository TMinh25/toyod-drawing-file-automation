const AUTOBOT_CODE = 'download_drawing_file'; // [?] how to config this?
const AUTOBOT_SECRET = '123456';
const HEART_BEAT_CYCLE = '*/1 * * * *';

const GATEWAY = 'http://localhost:30006'; // TMS SMART URL
// const GATEWAY = "http://dev-toyo.tmssmart.com"; // TMS SMART URL
const NAMESPACE = '/telegrams';
const WS_PATH = '/ws/socket.io';
const WS_PING_INTERVAL = 1000;

const PAYLOAD_EMAIL_URL = 'http://dev-toyo.tmssmart.com/api/payload/email';
const PAYLOAD_DONE_EMAIL_URL = 'http://dev-toyo.tmssmart.com/api/payload/doneInvoiceEmail';
const PAYLOAD_EINVOICE_URL = 'http://dev-toyo.tmssmart.com/api/payload/einvoice';

const TASK_RESULT_TYPE = {
  UPDATE: 'update',
  INSERT: 'insert',
  DELETE: 'delete',
};

export {
  AUTOBOT_CODE,
  AUTOBOT_SECRET,
  HEART_BEAT_CYCLE,
  GATEWAY,
  NAMESPACE,
  WS_PATH,
  WS_PING_INTERVAL,
  PAYLOAD_EMAIL_URL,
  PAYLOAD_DONE_EMAIL_URL,
  TASK_RESULT_TYPE,
  PAYLOAD_EINVOICE_URL,
};
