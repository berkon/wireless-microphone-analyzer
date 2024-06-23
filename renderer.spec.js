const RFExplorer = require('./scan_devices/rf_explorer.js');
const TinySA = require('./scan_devices/tiny_sa.js');
const electron = require('@electron/remote');
const renderer = require('./renderer.js')
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

describe('Renderer process', () => {
  it('getBaudrate()', () => {
    //jest.spyOn(app, 'getBaudrate');
    renderer.SCAN_DEVICE = RFExplorer.HW_TYPE
    expect(renderer.getBaudrate()).toEqual(RFExplorer.BAUD_RATE)
    global.SCAN_DEVICE = TinySA.HW_TYPE
    expect(renderer.getBaudrate()).toEqual(TinySA.BAUD_RATE)
    //expect(app.relaunch).toHaveBeenCalled()
  });

  it('normalizeFreqString()',() => {
    expect(renderer.normalizeFreqString('96,3')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96.3m')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96.3  M')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96,3Mhz')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96,3mhz')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96300k')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96300kHz')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96300KhZ')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96300000Hz')).toEqual(96300000);
    expect(renderer.normalizeFreqString('96300000h')).toEqual(96300000);
    expect(renderer.normalizeFreqString('ab96300kHz')).toEqual(false);
  });

  it('getFreqFromPercent()',() => {
    global.START_FREQ = 80000000
    global.STOP_FREQ  = 90000000
    expect(renderer.getFreqFromPercent(10)).toEqual(1000000)
  });
})