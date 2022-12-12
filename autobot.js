import socketIOClient from 'socket.io-client';
import { scheduleJob } from 'node-schedule';
import debug from 'debug';
import {
  AUTOBOT_CODE, AUTOBOT_SECRET, HEART_BEAT_CYCLE,
  GATEWAY, NAMESPACE, WS_PATH, WS_PING_INTERVAL,
} from './startupConfig';
import { TELEGRAM_EVENT_TYPE, getTeleportEventType } from './teleport';
import workflow from './workflow';

const appBizDebugger = debug('app:biz');

const DEFAULT_EVENT_PAYLOAD = { autobotCode: AUTOBOT_CODE };

const convertToJson = (secretList) => {
  for (let secret of secretList) {
    const { isObject, value } = secret;
    if (isObject) {
      secret.value = JSON.parse(value.replace(/\r\n/g, ''));
    }
  }

  return secretList;
}

let heartbeat = null;
// let runningConfig = null;
let isBusy = false;
let error, data;
let autobotSecret = AUTOBOT_SECRET;
let autobotCode = AUTOBOT_CODE;
let isProvisionACK = false;
let isStarted = false;
let secretList = [];

// let retryProvision;

appBizDebugger(`Waiting for correct running time...`);

const socket = socketIOClient(
  `${GATEWAY}${NAMESPACE}`,
  {
    path: WS_PATH,
    transports: ['websocket'],
    pingInterval: WS_PING_INTERVAL,
  },
);

socket.on('connect', () => {

  appBizDebugger(`Teleport_Helper.onConnect...`);

  // const token = btoa(`${autobotCode}:${autobotSecret}`); // base64 string
  // appBizDebugger(`Teleport_Helper.register: ${token}`);

  socket.emit(TELEGRAM_EVENT_TYPE.PROVISION, {
    autobotCode,
    autobotSecret,
  });

  appBizDebugger(`[Socket] Is Started: ${isStarted}`);
});

const provisionACKEvent = getTeleportEventType(autobotCode, TELEGRAM_EVENT_TYPE.PROVISION_ACK, 1);
const provisionNAKEvent = getTeleportEventType(autobotCode, TELEGRAM_EVENT_TYPE.PROVISION_NAK, 1);
const wakeUpEvent = getTeleportEventType(autobotCode, TELEGRAM_EVENT_TYPE.WAKE_UP, 1);
const taskResultUpdatedACK = getTeleportEventType(autobotCode, TELEGRAM_EVENT_TYPE.TASK_RESULT_UPDATED_ACK, 1);
const taskResultUpdatedNAK = getTeleportEventType(autobotCode, TELEGRAM_EVENT_TYPE.TASK_RESULT_UPDATED_NAK, 1);
const updateConfigEvent = getTeleportEventType(autobotCode, TELEGRAM_EVENT_TYPE.UPDATE_CONFIG, 1);
const updateIntrinsicEvent = getTeleportEventType(autobotCode, TELEGRAM_EVENT_TYPE.UPDATE_INTRINSIC, 1);

// TODO: ACK / NAK time out

socket.on(provisionACKEvent, (config) => { // provision & loading config
  appBizDebugger(`[Socket] Provision is successed`);
  
  secretList = convertToJson(config.payload.secretList);

  isProvisionACK = true;

  !heartbeat && (heartbeat = scheduleJob(HEART_BEAT_CYCLE, () => { // init heartbeat
    appBizDebugger(`Teleport_Helper.heartbeat emit`);

    socket.emit(TELEGRAM_EVENT_TYPE.HEARTBEAT, DEFAULT_EVENT_PAYLOAD);
  }));
});

socket.on(wakeUpEvent, async (payload) => {
  appBizDebugger(`[Socket] Wake UP`);
  appBizDebugger(`[Socket] Is Busy: ${isBusy}`);

  if (isProvisionACK) {
    if (isBusy) {
      socket.emit(TELEGRAM_EVENT_TYPE.WAKE_UP_NAK, DEFAULT_EVENT_PAYLOAD);
      return;
    } else {
      isBusy = true;

      socket.emit(TELEGRAM_EVENT_TYPE.WAKE_UP_ACK, DEFAULT_EVENT_PAYLOAD); // TODO add payload includes emailId

      ({ error, data } = await workflow(payload, secretList, autobotCode, autobotSecret));

      if (error) {
        socket.emit(TELEGRAM_EVENT_TYPE.TASK_FAILED, DEFAULT_EVENT_PAYLOAD);
      } else {
        socket.emit(
          TELEGRAM_EVENT_TYPE.TASK_COMPLETED, 
          {
            autobotCode,
            payload: data, // data must containts emailId list
          },
        );
      }
    }
  }
});

socket.on(taskResultUpdatedACK, () => {
  if (isProvisionACK) {
    appBizDebugger(`[Socket] Task result updated success`);
    isBusy = false;
  }
});

socket.on(taskResultUpdatedNAK, () => {
  if (isProvisionACK) {
    appBizDebugger(`[Socket] Task result updated fail`);
    if (error) {
      socket.emit(TELEGRAM_EVENT_TYPE.TASK_FAILED, DEFAULT_EVENT_PAYLOAD);
    } else {
      socket.emit(
        TELEGRAM_EVENT_TYPE.TASK_COMPLETED, 
        {
          autobotCode,
          payload: data, // data must containts emailId list
        },
      );
    }
  }
});

socket.on(provisionNAKEvent, () => {
  appBizDebugger(`[Socket] Provision is failed`);

  // retry after 5 minutes
  // retryProvision = setTimeout(() => {
  //   socket.emit(TELEGRAM_EVENT_TYPE.PROVISION, {
  //     autobotCode,
  //     autobotSecret,
  //   });
  // }, 5 * 60 * 1000)
});

socket.on(updateConfigEvent, (config) => {
  if (isProvisionACK) {
    appBizDebugger(`[Socket] Update config is successed`);
    const { sender, payload } = config;
    if (sender === autobotCode && !isBusy) {
      const { secretCode, secretName, value } = payload;
      secretList = secretList.map(secret => {
        if (secret.secretCode === secretCode) {
          secret.secretName = secretName;
          secret.value = JSON.parse(value.replace(/\r\n/g, ''));
        }
        return secret;
      })
      socket.emit(TELEGRAM_EVENT_TYPE.UPDATE_CONFIG_ACK, DEFAULT_EVENT_PAYLOAD);
  
      socket.emit(TELEGRAM_EVENT_TYPE.PROVISION, {
        autobotCode,
        autobotSecret,
      });
    } else {
      socket.emit(TELEGRAM_EVENT_TYPE.UPDATE_CONFIG_NAK, DEFAULT_EVENT_PAYLOAD);
    }
  }
});

socket.on(updateIntrinsicEvent, (config) => {
  if (isProvisionACK) {
    appBizDebugger(`[Socket] Update intrinsic`);
    const { payload } = config;
    if (!isBusy) {
      const { 
        autobotCode: newAutobotCode, 
        autobotSecret: newAutobotSecret, 
      } = payload;
      
      autobotCode = newAutobotCode;
      autobotSecret = newAutobotSecret;
  
      socket.emit(TELEGRAM_EVENT_TYPE.UPDATE_INTRINSIC_ACK, DEFAULT_EVENT_PAYLOAD);
      appBizDebugger(`[Socket] Update intrinsic emit`);
  
      socket.emit(TELEGRAM_EVENT_TYPE.PROVISION, {
        autobotCode,
        autobotSecret,
      });

      appBizDebugger(`[Socket] Provision with updated autobotSecret`);
    } else {
      socket.emit(TELEGRAM_EVENT_TYPE.UPDATE_INTRINSIC_NAK, DEFAULT_EVENT_PAYLOAD);
    }
  }
});

socket.on('disconnect', () => {
  appBizDebugger(`[Socket] Socket disconnected!`);

  heartbeat && heartbeat.cancel();

  // clearTimeout(retryProvision);
})
