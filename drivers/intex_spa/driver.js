'use strict';

const Homey = require('homey');
const net = require('net');
const os = require('os');

class IntexSpaDriver extends Homey.Driver {

  async onInit() {
    this.log('Intex PureSpa driver initialized');
  }

  /**
   * Custom pair handler.
   *
   * Flow:
   *   list_devices  --> scan the network. If devices found, show them.
   *                     If nothing found, programmatically navigate to manual_ip.
   *   manual_ip     --> user enters IP, tests connection, and adds device.
   *   add_devices   --> standard Homey "add chosen device" view.
   */
  onPair(session) {
    session.setHandler('showView', async (viewId) => {
      this.log(`Pair view: ${viewId}`);
    });

    // Homey calls this automatically when the list_devices template loads.
    // We perform the network scan here and return the result.
    session.setHandler('list_devices', async () => {
      this.log('list_devices handler: starting scan...');
      let scanned = [];
      try {
        scanned = await this._scanNetwork();
        this.log(`Scan complete. Found ${scanned.length} spa(s)`);
      } catch (err) {
        this.error('Scan error:', err);
      }

      if (scanned.length === 0) {
        // No spa auto-detected: jump to manual IP entry.
        // We do NOT await this — we return an empty list immediately so the
        // template doesn't hang, and showView happens in parallel.
        session.showView('manual_ip').catch((e) => this.error('showView manual_ip failed:', e));
        return [];
      }

      return scanned.map((device) => ({
        name: `Intex PureSpa (${device.ip})`,
        data: { id: 'intex-spa-' + device.ip.replace(/\./g, '-') },
        settings: {
          ip: device.ip,
          port: 8990,
          poll_interval: 30,
        },
      }));
    });

    // Called by manual_ip.html when the user clicks "Test connection"
    session.setHandler('test_connection', async (data) => {
      const ip = (data && data.ip) ? String(data.ip).trim() : '';
      if (!this._isValidIp(ip)) {
        return { success: false, error: 'invalid_ip' };
      }
      this.log(`Testing connection to ${ip}:8990`);
      const result = await this._probeSpa(ip);
      return { success: !!result, ip };
    });

    // Called by manual_ip.html when the user clicks "Add device".
    // We hand the assembled device back to the front-end, which then
    // calls Homey.addDevice() and proceeds to the add_devices view.
    session.setHandler('add_manual_device', async (data) => {
      const ip = (data && data.ip) ? String(data.ip).trim() : '';
      if (!this._isValidIp(ip)) {
        throw new Error('invalid_ip');
      }
      return {
        name: `Intex PureSpa (${ip})`,
        data: { id: 'intex-spa-' + ip.replace(/\./g, '-') },
        settings: {
          ip,
          port: 8990,
          poll_interval: 30,
        },
      };
    });
  }

  _isValidIp(ip) {
    if (!ip || typeof ip !== 'string') return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((p) => {
      const n = parseInt(p, 10);
      return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
    });
  }

  async _scanNetwork() {
    const subnets = this._getLocalSubnets();
    this.log('Scanning subnets:', subnets);

    const found = [];
    for (const subnet of subnets) {
      const devices = await this._scanSubnet(subnet);
      found.push(...devices);
    }
    return found;
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
