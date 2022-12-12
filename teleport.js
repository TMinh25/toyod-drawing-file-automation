export const TELEGRAM_EVENT_TYPE = {
  PROVISION: 'provision',
  PROVISION_ACK: 'provisionACK',
  PROVISION_NAK: 'provisionNAK',

  UPDATE_CONFIG: 'updateConfig',
  UPDATE_CONFIG_ACK: 'updateConfigACK',
  UPDATE_CONFIG_NAK: 'updateConfigNAK',

  HEARTBEAT: 'heartbeat',

  WAKE_UP: 'wakeUp',
  WAKE_UP_ACK: 'wakeUpACK',
  WAKE_UP_NAK: 'wakeUpNAK',

  TASK_COMPLETED: 'taskCompleted',
  TASK_COMPLETED_ACK: 'taskCompletedACK',
  TASK_COMPLETED_NAK: 'taskCompletedNAK',

  TASK_FAILED: 'taskFailed',
  TASK_FAILED_ACK: 'taskFailedACK',
  TASK_FAILED_NAK: 'taskFailedNAK',

  TASK_RESULT_UPDATED_ACK: 'taskResultUpdatedACK',
  TASK_RESULT_UPDATED_NAK: 'taskResultUpdatedNAK',
};

export const getTeleportEventType = (autobotCode, eventType, version = '1') => {
  return `v${version}.${autobotCode}.${eventType}`;
}

export const getRelatedPositiveACKEventType = (eventType) => {
  switch (eventType) {
    case TELEGRAM_EVENT_TYPE.PROVISION: {
      return TELEGRAM_EVENT_TYPE.PROVISION_ACK;
    }

    case TELEGRAM_EVENT_TYPE.PROVISION: {
      return TELEGRAM_EVENT_TYPE.PROVISION_ACK;
    }

    case TELEGRAM_EVENT_TYPE.WAKE_UP: {
      return TELEGRAM_EVENT_TYPE.WAKE_UP_ACK;
    }

    case TELEGRAM_EVENT_TYPE.TASK_COMPLETED: {
      return TELEGRAM_EVENT_TYPE.TASK_COMPLETED_ACK;
    }

    default: {
      throw new Error('Unknow socket eventType');
    }
  }
}

export const getRelatedNegatitiveNAKEventType = (eventType) => {
  switch (eventType) {
    case TELEGRAM_EVENT_TYPE.PROVISION: {
      return TELEGRAM_EVENT_TYPE.PROVISION_NAK;
    }

    case TELEGRAM_EVENT_TYPE.PROVISION: {
      return TELEGRAM_EVENT_TYPE.PROVISION_NAK;
    }

    case TELEGRAM_EVENT_TYPE.WAKE_UP: {
      return TELEGRAM_EVENT_TYPE.WAKE_UP_NAK;
    }

    case TELEGRAM_EVENT_TYPE.TASK_COMPLETED: {
      return TELEGRAM_EVENT_TYPE.TASK_COMPLETED_NAK;
    }

    default: {
      throw new Error('Unknow socket eventType');
    }
  }
}
