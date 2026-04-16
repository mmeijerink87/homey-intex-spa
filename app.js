'use strict';

const Homey = require('homey');

class IntexSpaApp extends Homey.App {

  async onInit() {
    this.log('Intex PureSpa app initialized');
    this._registerFlowActions();
  }

  _registerFlowActions() {
    this.homey.flow.getActionCard('set_filter')
      .registerRunListener(async (args) => args.device.setFilter(args.enabled));
    this.homey.flow.getActionCard('set_heater')
      .registerRunListener(async (args) => args.device.setHeater(args.enabled));
    this.homey.flow.getActionCard('set_bubbles')
      .registerRunListener(async (args) => args.device.setBubbles(args.enabled));
    this.homey.flow.getActionCard('set_temperature')
      .registerRunListener(async (args) => args.device.setTargetTemperature(args.temperature));
  }
}

module.exports = IntexSpaApp;
