const {app, BrowserWindow, Menu, ipcMain} = require('electron')
let mainWindow

function createWindow () {
    mainWindow = new BrowserWindow({width: 800, height: 600});
    mainWindow.loadFile('index.html');
    mainWindow.webContents.openDevTools();

    var menu = Menu.buildFromTemplate([
        {
            label: 'Frequency',
            submenu: [
                {
                    label:'Sennheiser',
                    submenu: [
                        { 
                            label: 'A1-Band (470 - 516MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 470000, stop_freq: 516000} ); }
                        },{
                            label: 'A-Band   (516 - 558MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 516000, stop_freq: 558000} ); }
                        },{
                            label: 'G-Band  (566 - 608MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 566000, stop_freq: 608000} ); }
                        },{
                            label: 'B-Band   (626 - 668MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 626000, stop_freq: 668000} ); }
                        },{
                            label: 'C-Band   (734 - 776MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 734000, stop_freq: 776000} ); }
                        },{
                            label: 'D-Band   (780 - 822MHz)',
                            submenu: [
                                {
                                    label: 'G2 Series (786 - 822MHz)',
                                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 786000, stop_freq: 822000} ); }
                                },{
                                    label: 'G3 Series (780 - 822MHz)',
                                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 780000, stop_freq: 822000} ); }
                                }
                            ]
                        },{
                            label: 'E-Band   (823 - 865MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 823000, stop_freq: 865000} ); }
                        }
                    ]
                },
                {
                    label:'Shure',
                    click() {

                    }
                },
                { type:'separator' },
                {
                    label: 'LTE Up-/Downlink Space (821 - 831MHz)',
                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 821000, stop_freq: 831000} ); }
                },{
                    label: 'ISM Band (863 - 866MHz)',
                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 863000, stop_freq: 866000} ); }
                }
            ]
        }
    ])
    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on ( 'ready', createWindow );

app.on ( 'window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if ( process.platform !== 'darwin' )
        app.quit();
});

app.on ( 'activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if ( mainWindow === null )
        createWindow();
});