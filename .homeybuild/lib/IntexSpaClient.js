'use strict';

const net = require('net');

const COMMANDS = {
  STATUS:  '8888060FEE0F01DA',
  POWER:   '8888060F01400098',
  FILTER:  '8888060F010004D4',
  HEATER:  '8888060F010010C8',
  BUBBLES: '8888060F010400D4',
};

const TEMP_COMMANDS = {
  20: '8888060F021400C7',
  21: '8888060F021500C6',
  22: '8888060F021600C5',
  23: '8888060F021700C4',
  24: '8888060F021800C3',
  25: '8888060F021900C2',
  26: '8888060F021A00C1',
  27: '8888060F021B00C0',
  28: '8888060F021C00BF',
  29: '8888060F021D00BE',
  30: '8888060F021E00BD',
  31: '8888060F021F00BC',
  32: '8888060F022000BB',
  33: '8888060F022100BA',
  34: '8888060F022200B9',
  35: '8888060F022300B8',
  36: '8888060F022400B7',
  37: '8888060F022500B6',
  38: '8888060F022600B5',
  39: '8888060F022700B4',
  40: '8888060F022800B3',
};

class IntexSpaClient {

  constructor({ ip, port = 8990, timeout = 5000 }) {
    this.ip = ip;
    this.port = port;
    this.timeout = timeout;
  }

  _sendCommand(dataHex) {
    return new Promise((resolve, reject) => {
      const sid = Date.now().toString();
      const message = JSON.stringify({ data: dataHex, sid, type: 1 });
      const socket = new net.Socket();
      let responseBuffer = '';

      socket.setTimeout(this.timeout);

      socket.connect(this.port, this.ip, () => {
        socket.write(message);
      });

      socket.on('data', (data) => {
        responseBuffer += data.toString();
        if (responseBuffer.includes('"result":"ok"')) {
          socket.destroy();
          try {
            const parsed = JSON.parse(responseBuffer.match(/\{.*\}/s)[0]);
            resolve(parsed.data || '');
          } catch (e) {
            reject(new Error('Failed to parse spa response'));
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error(`Timeout connecting to spa at ${this.ip}:${this.port}`));
      });

      socket.on('error', (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });
    });
  }

  _parseStatus(hexData) {
    if (!hexData || hexData.length < 36) {
      throw new Error('Invalid status response: ' + hexData);
    }
    const statusByte = parseInt(hexData.substring(10, 12), 16);
    const currentTemp = parseInt(hexData.substring(14, 16), 16);
    const targetTemp = parseInt(hexData.substring(30, 32), 16);

    return {
      power:       !!(statusByte & 0x01),
      filter:      !!(statusByte & 0x02),
      heater:      !!(statusByte & 0x04),
      bubbles:     !!(statusByte & 0x10),
      currentTemp: isNaN(currentTemp) ? null : currentTemp,
      targetTemp:  isNaN(targetTemp)  ? null : targetTemp,
    };
  }

  async getStatus() {
    const response = await this._sendCommand(COMMANDS.STATUS);
    return this._parseStatus(response);
  }

  async togglePower()   { await this._sendCommand(COMMANDS.POWER); }
  async toggleFilter()  { await this._sendCommand(COMMANDS.FILTER); }
  async toggleHeater()  { await this._sendCommand(COMMANDS.HEATER); }
  async toggleBubbles() { await this._sendCommand(COMMANDS.BUBBLES); }

  async setTemperature(temp) {
    const rounded = Math.round(temp);
    const cmd = TEMP_COMMANDS[rounded];
    if (!cmd) throw new Error(`Temperature ${rounded}°C out of range (20-40°C)`);
    await this._sendCommand(cmd);
  }
}

module.exports = { IntexSpaClient };
