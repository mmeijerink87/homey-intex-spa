'use strict';

const Homey = require('homey');
const { IntexSpaClient } = require('../../lib/IntexSpaClient');

// Estimated power consumption per component (Watts)
const POWER = {
  heater: 2200,
  filter: 55,
  bubbles: 750,
};

class IntexSpaDevice extends Homey.Device {

  async onInit() {
    this.log(`Intex PureSpa device initialized: ${this.getName()}`);
    this._createClient();

    this.registerCapabilityListener('intex_spa_power',    this._onPowerChanged.bind(this));
    this.registerCapabilityListener('intex_spa_filter',   this._onFilterChanged.bind(this));
    this.registerCapabilityListener('intex_spa_heater',   this._onHeaterChanged.bind(this));
    this.registerCapabilityListener('intex_spa_bubbles',  this._onBubblesChanged.bind(this));
    this.registerCapabilityListener('target_temperature', this._onTargetTempChanged.bind(this));

    this._filterOnTrigger    = this.homey.flow.getDeviceTriggerCard('filter_turned_on');
    this._filterOffTrigger   = this.homey.flow.getDeviceTriggerCard('filter_turned_off');
    this._heaterOnTrigger    = this.homey.flow.getDeviceTriggerCard('heater_turned_on');
    this._heaterOffTrigger   = this.homey.flow.getDeviceTriggerCard('heater_turned_off');
    this._tempReachedTrigger = this.homey.flow.getDeviceTriggerCard('temperature_reached');

    await this.setUnavailable('Verbinding maken met spa...');
    this._startPolling();

    this.homey.setTimeout(async () => {
      await this._pollStatus().catch((err) => {
        this.log('Initial poll failed:', err.message);
        this.setUnavailable('Kan geen verbinding maken. Controleer het IP-adres in de apparaatinstellingen.');
      });
    }, 3000);
  }

  _createClient() {
    const s = this.getSettings();
    this.log(`Creating client for ${s.ip}:${s.port || 8990}`);
    this._client = new IntexSpaClient({ ip: s.ip, port: s.port || 8990, timeout: 5000 });
  }

  _startPolling() {
    this._stopPolling();
    const s = this.getSettings();
    const ms = (s.poll_interval || 30) * 1000;
    this._pollInterval = this.homey.setInterval(async () => {
      await this._pollStatus().catch((err) => {
        this.log('Poll error:', err.message);
        this.setUnavailable('Kan geen verbinding maken. Controleer het IP-adres in de apparaatinstellingen.');
      });
    }, ms);
  }

  _stopPolling() {
    if (this._pollInterval) {
      this.homey.clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  /**
   * Calculate estimated power based on active components
   */
  _calculatePower(status) {
    let watts = 0;
    if (status.heater)  watts += POWER.heater;
    if (status.filter)  watts += POWER.filter;
    if (status.bubbles) watts += POWER.bubbles;
    return watts;
  }

  async _pollStatus() {
    const status = await this._client.getStatus();

    const prevFilter  = this.getCapabilityValue('intex_spa_filter');
    const prevHeater  = this.getCapabilityValue('intex_spa_heater');
    const prevCurTemp = this.getCapabilityValue('measure_temperature');
    const prevTgtTemp = this.getCapabilityValue('target_temperature');

    await this.setCapabilityValue('intex_spa_power',   status.power);
    await this.setCapabilityValue('intex_spa_filter',  status.filter);
    await this.setCapabilityValue('intex_spa_heater',  status.heater);
    await this.setCapabilityValue('intex_spa_bubbles', status.bubbles);

    if (status.currentTemp !== null) await this.setCapabilityValue('measure_temperature', status.currentTemp);
    if (status.targetTemp  !== null) await this.setCapabilityValue('target_temperature',  status.targetTemp);

    // Update estimated power consumption
    const estimatedWatts = this._calculatePower(status);
    await this.setCapabilityValue('measure_power', estimatedWatts);

    if (prevFilter === false && status.filter === true)  await this._filterOnTrigger.trigger(this).catch(this.error);
    if (prevFilter === true  && status.filter === false) await this._filterOffTrigger.trigger(this).catch(this.error);
    if (prevHeater === false && status.heater === true)  await this._heaterOnTrigger.trigger(this).catch(this.error);
    if (prevHeater === true  && status.heater === false) await this._heaterOffTrigger.trigger(this).catch(this.error);

    if (prevCurTemp !== null && prevTgtTemp !== null) {
      if (prevCurTemp < prevTgtTemp && status.currentTemp >= status.targetTemp && status.heater) {
        await this._tempReachedTrigger.trigger(this).catch(this.error);
      }
    }

    await this.setAvailable();
  }

  async _onPowerChanged(value) {
    if (this.getCapabilityValue('intex_spa_power') !== value) await this._client.togglePower();
  }
  async _onFilterChanged(value) {
    if (this.getCapabilityValue('intex_spa_filter') !== value) await this._client.toggleFilter();
  }
  async _onHeaterChanged(value) {
    if (this.getCapabilityValue('intex_spa_heater') !== value) await this._client.toggleHeater();
  }
  async _onBubblesChanged(value) {
    if (this.getCapabilityValue('intex_spa_bubbles') !== value) await this._client.toggleBubbles();
  }
  async _onTargetTempChanged(value) {
    await this._client.setTemperature(value);
  }

  async setFilter(enabled) {
    if (this.getCapabilityValue('intex_spa_filter') !== enabled) {
      await this._client.toggleFilter();
      await this.setCapabilityValue('intex_spa_filter', enabled);
    }
  }
  async setHeater(enabled) {
    if (this.getCapabilityValue('intex_spa_heater') !== enabled) {
      await this._client.toggleHeater();
      await this.setCapabilityValue('intex_spa_heater', enabled);
    }
  }
  async setBubbles(enabled) {
    if (this.getCapabilityValue('intex_spa_bubbles') !== enabled) {
      await this._client.toggleBubbles();
      await this.setCapabilityValue('intex_spa_bubbles', enabled);
    }
  }
  async setTargetTemperature(temp) {
    await this._client.setTemperature(temp);
    await this.setCapabilityValue('target_temperature', temp);
  }

  async onSettings({ newSettings }) {
    this.log('Settings updated:', JSON.stringify(newSettings));
    this._createClient();
    this._startPolling();
    await this._pollStatus().catch((err) => {
      this.setUnavailable('Kan geen verbinding maken. Controleer het IP-adres in de apparaatinstellingen.');
    });
  }

  onDeleted() {
    this._stopPolling();
    this.log('Device deleted');
  }
}

module.exports = IntexSpaDevice;
