const RFExplorer = require('./rf_explorer.js');

global.log = {
    info: jest.fn(),
    error: jest.fn(),
}

describe('RF Explorer', () => {
    it ('should call isValidFreqConfig() with valid frequency range and return true', () => {
        RFExplorer.MODEL = 'BASIC';
        global.MIN_FREQ = 100000000 // 100 MHz
        global.MAX_FREQ = 200000000 // 200 MHz
        expect(RFExplorer.isValidFreqConfig(
            global.MIN_FREQ + 1000000,
            global.MAX_FREQ - 1000000)
        ).toBe(true);
    });

    it ('should call isValidFreqConfig() with invalid min frequency and return false',() => {
        RFExplorer.MODEL = 'BASIC';
        global.MIN_FREQ = 100000000 // 100 MHz
        global.MAX_FREQ = 200000000 // 200 MHz
        expect(RFExplorer.isValidFreqConfig(
            global.MIN_FREQ - 1000000,
            global.MAX_FREQ - 1000000)
        ).toBe(false);
    });

    it ('should call isValidFreqConfig() with invalid max frequency and return false',() => {
        RFExplorer.MODEL = 'BASIC';
        global.MIN_FREQ = 100000000 // 100 MHz
        global.MAX_FREQ = 200000000 // 200 MHz
        expect(RFExplorer.isValidFreqConfig(
            global.MIN_FREQ + 1000000,
            global.MAX_FREQ + 1000000)
        ).toBe(false);
    });

    it ('should call splitScanRange() with too high number of sweep points. Unable to reduce because lower than allowed',() => {
        let result = [{
                START_FREQ: 1000,
                STOP_FREQ: 1900
            },{
                START_FREQ: 2000,
                STOP_FREQ: 2900
            },{
                START_FREQ: 3000,
                STOP_FREQ: 4000
            }
        ]

        RFExplorer.MODEL = 'BASIC';
        global.START_FREQ = 1000
        global.STOP_FREQ = 4000
        global.SWEEP_POINTS = 5000
        let subRanges = RFExplorer.splitScanRange()
        expect(subRanges).toBe(false);
    });

    it ('should call splitScanRange() with too high number of sweep points. Reduce number automatically and return subranges',() => {
        let result = [{
                START_FREQ: 100000,
                STOP_FREQ: 299999
            },{
                START_FREQ: 300000,
                STOP_FREQ: 499999
            },{
                START_FREQ: 500000,
                STOP_FREQ: 700000
            }
        ]

        RFExplorer.MODEL = 'BASIC';
        global.START_FREQ = 20000000 // 20 MHz
        global.STOP_FREQ =  30000000 // 30 MHz
        global.SWEEP_POINTS = 90
        let subRanges = RFExplorer.splitScanRange()
        expect(subRanges).toStrictEqual(result);
    });
/*
    it ('should call splitScanRange() with a valid number of sweep points and return subranges',() => {
        let result = [{
                START_FREQ: 100000,
                STOP_FREQ: 299999
            },{
                START_FREQ: 300000,
                STOP_FREQ: 499999
            },{
                START_FREQ: 500000,
                STOP_FREQ: 700000
            }
        ]

        RFExplorer.MODEL = 'BASIC';
        global.START_FREQ = 100000 // 100 kHz
        global.STOP_FREQ =  700000 // 700 kHz
        global.SWEEP_POINTS = 336
        let subRanges = RFExplorer.splitScanRange()
        expect(subRanges).toStrictEqual(result);
    }); */
});