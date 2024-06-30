const Utils = require('./utils.js');

describe ('Utils', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    
    afterEach(() => {
        jest.useRealTimers();
    });

    it ("should call showMiniWarning() and set text HTML element.", () => {
        const testMessage = "This is a test"
        const mockElem = document.createElement('span');
        mockElem.id = 'warning-message';
        document.getElementById = jest.fn().mockReturnValue(mockElem);
        Utils.showMiniWarning(testMessage);
        expect(mockElem.textContent).toBe(testMessage);
    })

    it ("should call showMiniWarning(), first show a message with timeout and then a normal one.", () => {
        const testMessage1 = "This is a test WITHOUT a timeout";
        const testMessage2 = "This is a test WITH a timeout";
        const mockElem = document.createElement('span');
        mockElem.id = 'warning-message';
        document.getElementById = jest.fn().mockReturnValue(mockElem);
        Utils.showMiniWarning(testMessage1, 1000);
        expect(mockElem.textContent).toBe(testMessage1);
        jest.advanceTimersByTime(1000);
        Utils.showMiniWarning(testMessage2);
        expect(mockElem.textContent).toBe(testMessage2);
    })
})