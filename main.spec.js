const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

describe('Main Process', () => {
  it('quit second instance', () => {
    jest.spyOn(app, 'requestSingleInstanceLock').mockReturnValue(false);
    jest.spyOn(app, 'quit');
    require('./main.js')
    expect(app.quit).toHaveBeenCalled();
  });
})