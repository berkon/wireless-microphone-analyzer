const RFExplorer = require('./scan_devices/rf_explorer.js');
const TinySA = require('./scan_devices/tiny_sa.js');
const electron = require('@electron/remote');
const renderer = require('./renderer.js')
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

describe('General', () => {
    it('getFreqFromPercent()',() => {
        global.START_FREQ = 80000000
        global.STOP_FREQ  = 90000000
        expect(renderer.getFreqFromPercent(10)).toEqual(1000000)
    });

    it('move()', () => {

    })

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

    it('getBaudrate()', () => {
        //jest.spyOn(app, 'getBaudrate');
        global.SCAN_DEVICE = RFExplorer.HW_TYPE
        expect(renderer.getBaudrate()).toEqual(RFExplorer.BAUD_RATE)
        global.SCAN_DEVICE = TinySA.HW_TYPE
        expect(renderer.getBaudrate()).toEqual(TinySA.BAUD_RATE)
        //expect(app.relaunch).toHaveBeenCalled()
    });
})

describe ('zoom() out', () => {
    beforeEach( () => {
        global.MIN_FREQ     = 50 // 50 Hz
        global.MAX_FREQ     = 900 // 900 Hz
        global.MIN_SPAN     = 5  // 5 Hz
        global.MAX_SPAN     = 100 // 100 Hz
        global.SWEEP_POINTS = 112
    })

    it('by 50% and exceed MAX_SPAN', () => {
        global.START_FREQ   = 100 // 100 Hz
        global.STOP_FREQ    = 180 // 180 Hz
        renderer.zoom(-50)  // Zoom out by 50%
        expect(global.START_FREQ).toEqual(90)
        expect(global.STOP_FREQ ).toEqual(190)
    })

    it('by 50% and exceed MAX_FREQ', () => {
        global.START_FREQ   = 880 // 880 Hz
        global.STOP_FREQ    = 900 // 900 Hz
        renderer.zoom(-50)  // Zoom out by 50%
        expect(global.START_FREQ).toEqual(870)
        expect(global.STOP_FREQ ).toEqual(900)
    })

    it('by 70% and exceed MIN_FREQ', () => {
        global.START_FREQ   = 60 // 60 Hz
        global.STOP_FREQ    = 100 // 100 Hz
        renderer.zoom(-70)  // Zoom out by 50%
        expect(global.START_FREQ).toEqual(50)
        expect(global.STOP_FREQ ).toEqual(118)
    })

    it('by 100% and exceed MAX_SPAN and MIN_FREQ', () => {
        global.START_FREQ   = 50 // 50 Hz
        global.STOP_FREQ    = 200 // 200 Hz
        renderer.zoom(-100)  // Zoom out by 100%
        expect(global.START_FREQ).toEqual(75)
        expect(global.STOP_FREQ ).toEqual(175)
    })
});

describe ('zoom() in', () => {
    beforeEach( () => {
        global.MIN_FREQ     = 50 // 50 Hz
        global.MAX_FREQ     = 900 // 900 Hz
        global.MIN_SPAN     = 20  // 20 Hz
        global.MAX_SPAN     = 100 // 100 Hz
        global.SWEEP_POINTS = 112
    })

    it('by 50% and exceed MIN_SPAN and minimum SWEEP_POINTS', () => {
        global.START_FREQ   = 100 // 100 Hz
        global.STOP_FREQ    = 120 // 120 Hz
        renderer.zoom(50)  // Zoom in by 50%
        expect(global.START_FREQ).toEqual(54)
        expect(global.STOP_FREQ ).toEqual(166)
    })
})

describe ('move()', () => {
    beforeEach( () => {
        global.MIN_FREQ     = 50 // 50 Hz
        global.MAX_FREQ     = 900 // 900 Hz
        global.MIN_SPAN     = 20  // 20 Hz
        global.MAX_SPAN     = 100 // 100 Hz
        global.SWEEP_POINTS = 112
    })

    it('left 10% within valid frequency range', () => {
        global.START_FREQ   = 100 // 100 Hz
        global.STOP_FREQ    = 120 // 120 Hz
        renderer.move(-10)  // Move left by 10%
        expect(global.START_FREQ).toEqual(98)
        expect(global.STOP_FREQ ).toEqual(118)
    })

    it('left 50% and exceed MIN_FREQ', () => {
        global.START_FREQ   = 60 // 100 Hz
        global.STOP_FREQ    = 120 // 120 Hz
        renderer.move(-50)  // Move left by 50%
        expect(global.START_FREQ).toEqual(50)
        expect(global.STOP_FREQ ).toEqual(110)
    })

    it('right 10% within valid frequency range', () => {
        global.START_FREQ   = 100 // 100 Hz
        global.STOP_FREQ    = 120 // 120 Hz
        renderer.move(10)  // Move right by 10%
        expect(global.START_FREQ).toEqual(102)
        expect(global.STOP_FREQ ).toEqual(122)
    })

    it('right 50% and exceed MAX_FREQ', () => {
        global.START_FREQ   = 770 // 770 Hz
        global.STOP_FREQ    = 870 // 870 Hz
        renderer.move(50)  // Move right by 50%
        expect(global.START_FREQ).toEqual(800)
        expect(global.STOP_FREQ ).toEqual(900)
    })
})