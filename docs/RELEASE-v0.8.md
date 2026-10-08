# Neural Resonance v0.8

Three interfaces: waveform capture, neural worm, and device settings.

Portable applications include isolated Python dependencies and the web console. No Node.js, author-specific path, USB serial number, or private server is required.

## Start

- Windows x64: extract the complete folder, then run `NeuralResonance/NeuralResonance.exe`. Keep `_internal` with the executable.
- macOS Apple Silicon / Intel: extract the matching ZIP and open `Neural Resonance.app`. The app is not Apple-signed or notarized; follow macOS privacy/security prompts to allow opening and Bluetooth access.
- Source install: `Start-Windows.ps1` with PowerShell 7, or `Start-macOS.command`.

The application opens its actual local URL. Known USB identities are selected automatically; reassigned serial port names are detected. Existing local laboratory acquisition can be reused without claiming the USB device twice.

## Supported protocols

ThinkGear EEG over serial/BLE, AFE4490 text SpO2/pulse, explicitly configured text GSR, and the documented JSON gateway input. Proprietary protocols need their own adapters. Pulse rate is not HRV.

Protocol/API and fake-device reconnection tests passed; desktop/mobile browser checks and Windows relocation were verified. Native packages are built on Windows and both Mac architectures. Native build success does not verify physical Mac USB/BLE acquisition. Current connected sensors have not passed continuous valid measurement acceptance.

No patient data or private device configuration is included. The webpage stores records locally until the user explicitly exports or uploads them.

## 0.8.2 final verification fixes

- Static websites no longer request device-management APIs. The local acquisition gateway explicitly advertises its device settings capability.
- Device settings include direct downloads for Windows x64, Apple Silicon and Intel Mac.
- The browser icon is included and the visible application version matches the package.
