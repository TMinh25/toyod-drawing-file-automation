import { createTransport } from 'nodemailer';
import debug from 'debug';

const appBizDebugger = debug('app:biz');

class SMTP_Helper {
  constructor(config) {
    this.config = config;

    const {
      host, port,
      tls, secure,
      from, user,
      password: pass,
      maxConnections, pool,
    } = config;

    this.sentBy = from || user;

    this.transport = {
      host, port,
      secure,
      requireTLS: tls,

      maxConnections, pool,

      tls: tls ? { rejectUnauthorized: false } : undefined,

      from: (from || user),

      auth: {
        user,
        pass,
      }
    };
    console.log('transport: ', this.transport);

    this.smtp = createTransport(this.transport);
  }

  // TODO: send templated email

  send(to, cc, subject, html, attachments = [], callback) {
    appBizDebugger(`SMTP_Helper sendEmail: To: ${to}; CC: ${cc}`);

    const mailOptions = {
      from: this.sentBy,
      to: String(to),
      cc: String(cc),
      subject,
      html,
      attachments
    };

    this.smtp.sendMail(mailOptions, callback);
  }
};

export default SMTP_Helper;
