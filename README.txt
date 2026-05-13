Take full control of your Intex PureSpa from Homey Pro, without any cloud dependency.

Features:
- Read and set water temperature (20-40°C)
- Control heater, filter pump and bubbles
- Turn power on/off
- Flow cards for powerful automation

Compatibility:
- Intex PureSpa models with WiFi and the Intex Link app (e.g. SC-WF20)
- Requires Homey Pro and spa on the same local network

Setup:
During pairing, the app will scan your local network for an Intex PureSpa. If your spa is not detected automatically, you can enter its IP address manually. The pairing screen includes a "Test connection" button to verify reachability before adding the device. For a stable connection, assign a static IP to your spa in your router's DHCP settings.

Automation examples:
- Warm up the spa every Friday at 17:00 for the weekend
- Get a notification when the target temperature is reached
- Turn off heating and bubbles automatically at night

Version 1.0.8 - 13 May 2026
- Reworked pairing flow: automatic network scan with manual IP fallback
- Added "Test connection" button during manual IP entry
- Fixed: IP changes in device settings now take effect immediately
