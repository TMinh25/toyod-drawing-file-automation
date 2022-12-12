import Imap, { parseHeader } from 'imap';
import debug from 'debug';
const { simpleParser } = require('mailparser');
// import { createTransport } from 'nodemailer';

require('tls').DEFAULT_MIN_VERSION = 'TLSv1'; // fix NodeJS version >=12 prevent TLSv1.0

const appBizDebugger = debug('app:biz');

class IMAP_Helper {
  constructor(config) {
    this.config = config;
    this.imap = new Imap(config);
  }

  connect(onReadyCallback) {
    const { imap } = this;

    this.imap.once('ready', () => {
      appBizDebugger(`IMAP_Helper: Connection ready.`);

      onReadyCallback();
    });

    imap.once('error', (error) => {
      console.error(error);
      appBizDebugger(`IMAP_Helper error: ${error}`);
      onReadyCallback(error);
    });

    imap.once('end', () => {
      appBizDebugger('IMAP_Helper: Connection ended!');
    });
    
    imap.connect();
  };

  getState() {
    const { state } = this.imap;

    appBizDebugger(`IMAP_Helper getState: ${state}`);

    return state;
  }

  getBoxes(callback) {
    appBizDebugger(`IMAP_Helper getBoxes`);

    return this.imap.getBoxes(callback);
  }

  openBox(mailboxName, openReadOnly, callback) {
    appBizDebugger(`IMAP_Helper openBox: ${mailboxName}`);

    return this.imap.openBox(mailboxName, openReadOnly, callback);
  }

  search(criteria, callback) {
    return this.imap.search(criteria, callback);
  }

  fetch(source, options) {
    return this.imap.seq.fetch(source, options);
  }

  parseHeader(rawHeader, disableAutoDecode) {
    return parseHeader(rawHeader, disableAutoDecode)
  }

  readMail(folder, searchOptions, markSeen = false) {
    return new Promise((resolve, reject) => {
      this.connect((error) => {
        if (error) {
          reject(error)
        } else {
          this.imap.openBox(folder, false, (error, mailBox) => {
            if (error) {
              reject(error);
            }

            this.imap.search(searchOptions, async (error, uids) => {
              let messages = [];
              console.log(uids);

              for (const uid of uids) {
                const message = await this.readMailByUid(uid, markSeen);
                messages.push(message)
              }

              this.disconnect();
              resolve(messages);
            })
          })
        }
      })
    }) 
  }

  readMailByUidList(folder, uids, markSeen = false) {
    return new Promise((resolve, reject) => {
      this.connect((error) => {
        if (error) {
          reject(error)
        } else {
          this.imap.openBox(folder, false, async(error, mailBox) => {
            if (error) {
              reject(error);
            }

            let messages = [];

            for (const uid of uids) {
              const message = await this.readMailByUid(uid, markSeen);
              messages.push(message)
            }

            this.disconnect();
            resolve(messages);
          })
        }
      })
    }) 
  }

  readMailByUid(uid, markSeen) {
    return new Promise((resolve, reject) => {
      const f = this.imap.fetch(uid, { bodies: "", markSeen });

      f.on('message', (msg) => {
        msg.on('body', stream => {
          simpleParser(stream, (error, parsed) => {
            if (error) {
              console.error(error);
              appBizDebugger(`IMAP_Helper error: ${error}`);
              reject(error);
            }
            // const { from, subject, html, text, attachments  } = parsed;
            parsed.uid = uid;
            resolve(parsed);
          })
        })
      })

      f.once('error', error => {
        reject(error);
      });

      f.once('end', () => {
        console.log('Done fetching message!');
      });
    })
  }

  closeBox() {
    return this.imap.closeBox();
  }

  disconnect() {
    this.imap.end();
  }
};

export default IMAP_Helper;
