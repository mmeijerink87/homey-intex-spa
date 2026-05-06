'use strict';

const Homey = require('homey');

class IntexSpaDriver extends Homey.Driver {

  async onInit() {
    this.log('Intex PureSpa driver initialized');
  }

  async onPair(session) {
    let ip = '192.168.1.100';
    let port = 8990;

    session.setHandler('save_ip', async (data) => {
      ip = data.ip;
      port = parseInt(data.port) || 8990;
      this.log(`Saving: ${ip}:${port}`);
      return { success: true };
    });

    session.setHandler('list_devices', async () => {
      return [{
        name: 'Intex PureSpa',
        data: { id: 'intex-spa-' + ip.replace(/\./g, '-') },
        settings: { ip, port, poll_interval: 30 },
      }];
    });
  }

}

module.exports = IntexSpaDriver;
