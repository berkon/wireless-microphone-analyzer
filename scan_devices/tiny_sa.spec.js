const TinySA = require('./tiny_sa.js');

global.log = {
    info: jest.fn(),
    error: jest.fn(),
}

describe('TinySA', () => {
    it ('should call isValidFreqConfig() with valid LOW frequency range and return LOW', () => {
        TinySA.MODEL = 'BASIC';
        expect(TinySA.isValidFreqConfig(
            TinySA.MIN_FREQ_BASIC_LOW + 1000000,
            TinySA.MAX_FREQ_BASIC_LOW - 1000000)
        ).toBe('LOW');
    });

    it ('should call isValidFreqConfig() with valid HIGH frequency range and return HIGH', () => {
        TinySA.MODEL = 'BASIC';
        expect(TinySA.isValidFreqConfig(
            TinySA.MIN_FREQ_BASIC_HIGH + 1000000,
            TinySA.MAX_FREQ_BASIC_HIGH - 1000000)
        ).toBe('HIGH');
    });

    it ('isValidFreqConfig() out of HIGH range and return false',() => {
        TinySA.MODEL = 'BASIC';
        TinySA.FREQ_BAND_MODE === 'HIGH';
        expect(TinySA.isValidFreqConfig(
            TinySA.MIN_FREQ_BASIC_HIGH - 1000000,
            TinySA.MAX_FREQ_BASIC_HIGH + 1000000)
        ).toBe(false);
    });

    it ('isValidFreqConfig() in overlapping range (mode LOW) and return false',() => {
        TinySA.MODEL = 'BASIC';
        TinySA.FREQ_BAND_MODE === 'LOW';
        expect(TinySA.isValidFreqConfig(
            TinySA.MIN_FREQ_BASIC_LOW + 1000000,
            TinySA.MAX_FREQ_BASIC_HIGH - 1000000)
        ).toBe(false);
    });

    it ('isValidFreqConfig() in overlapping range (mode HIGH) and return false',() => {
        TinySA.MODEL = 'BASIC';
        TinySA.FREQ_BAND_MODE === 'HIGH';
        expect(TinySA.isValidFreqConfig(
            TinySA.MIN_FREQ_BASIC_LOW + 1000000,
            TinySA.MAX_FREQ_BASIC_HIGH - 1000000)
        ).toBe(false);
    });
});