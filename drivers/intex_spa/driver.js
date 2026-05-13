'use strict';

const Homey = require('homey');
const net = require('net');
const os = require('os');

class IntexSpaDriver extends Homey.Driver {

  async onInit() {
    this.log('Intex PureSpa driver initialized');
  }

  /**
   * Called when the user starts pairing.
   * Scans the local network for Intex spas.
   */
  async onPairListDevices() {
    this.log('Starting network scan for Intex spas...');
    
    try {
      const subnets = this._getLocalSubnets();
      this.log('Scanning subnets:', subnets);

      const found = [];
      for (const subnet of subnets) {
        const devices = await this._scanSubnet(subnet);
        found.push(...devices);
      }

      this.log(`Scan complete. Found ${found.length} spa(s)`);

      if (found.length === 0) {
        return [{
          name: 'Intex PureSpa (handmatig instellen)',
          data: { id: 'intex-spa-manual-' + Date.now() },
          settings: {
            ip: '192.168.1.100',
            port: 8990,
            poll_interval: 30,
          },
        }];
      }

      return found.map((device) => ({
        name: `Intex PureSpa`,
        data: { id: 'intex-spa-' + device.ip.replace(/\./g, '-') },
        settings: {
          ip: device.ip,
          port: 8990,
          poll_interval: 30,
        },
      }));
    } catch (err) {
      this.error('Pair scan error:', err);
      return [{
        name: 'Intex PureSpa (handmatig instellen)',
        data: { id: 'intex-spa-manual-' + Date.now() },
        settings: {
          ip: '192.168.1.100',
          port: 8990,
          poll_interval: 30,
        },
      }];
    }
  }

  _getLocalSubnets() {
    const subnets = new Set();
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            subnets.add(parts.slice(0, 3).join('.'));
          }
        }
      }
    }
    return Array.from(subnets);
  }

  async _scanSubnet(subnet) {
    const found = [];
    const batchSize = 32;

    for (let start = 1; start <= 254; start += batchSize) {
      const promises = [];
      for (let i = start; i < start + batchSize && i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        promises.push(this._probeSpa(ip));
      }
      const results = await Promise.all(promises);
      for (const r of results) {
        if (r) found.push(r);
      }
    }

    return found;
  }

  _probeSpa(ip) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const done = (result) => {
        if (!resolved) {
          resolved = true;
          try { socket.destroy(); } catch (e) {}
          resolve(result);
        }
      };

      socket.setTimeout(1500);

      socket.connect(8990, ip, () => {
        try {
          const cmd = JSON.stringify({
            data: '8888060FEE0F01DA',
            sid: '' + Date.now(),
            type: 1,
          });
          socket.write(cmd);
        } catch (e) {
          done(null);
        }
      });

      socket.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.result === 'ok' && response.data && response.data.startsWith('FFFF110F')) {
            done({ ip });
            return;
          }
        } catch (e) {}
        done(null);
      });

      socket.on('error', () => done(null));
      socket.on('timeout', () => done(null));
    });
  }
}

module.exports = IntexSpaDriver;
