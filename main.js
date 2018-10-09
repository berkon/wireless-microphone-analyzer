'use strict'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true; // Disable security warning on the console

const {app, BrowserWindow, Menu, ipcMain} = require('electron')
let mainWindow

function createWindow () {
    mainWindow = new BrowserWindow({width: 1200, height: 700});
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
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 470000, stop_freq: 516000, label: 'Sennheiser A1-Band (470 - 516MHz)', id: 'SEN_A1'} ); }
                        },{
                            label: 'A-Band   (516 - 558MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser A-Band (516 - 558MHz)', id: 'SEN_A'} ); }
                        },{
                            label: 'G-Band  (566 - 608MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser G-Band (566 - 608MHz)', id: 'SEN_G'} ); }
                        },{
                            label: 'B-Band   (626 - 668MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser B-Band (626 - 668MHz)', id: 'SEN_B'} ); }
                        },{
                            label: 'C-Band   (734 - 776MHz)',
                            click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser C-Band (734 - 776MHz)', id: 'SEN_C'} ); }
                        },{
                            label: 'D-Band   (780 - 822MHz)',
                            click () { console.log ("TEST")},
                            submenu: [
                                {
                                    label: 'Full D-Band (780 - 822MHz)'
                                },
                                { type:'separator' },
                                {
                                    label: 'G2 Series (786 - 822MHz)',
                                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 786000, stop_freq: 822000, label: 'Sennheiser D-Band G2 Series (786 - 822MHz)', id: 'SEN_D_G2'} ); }
                                },{
                                    label: 'G3 Series (780 - 822MHz)',
                                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser D-Band G3 Series (780 - 822MHz)', id: 'SEN_D_G3'} ); }
                                }
                            ]
                        },{
                            label: 'E-Band   (823 - 866MHz)',
                            submenu: [
                                {
                                    label: 'Full E-Band (823 - 866MHz)'
                                },
                                { type:'separator' },
                                {
                                    label: 'G2 Series (830 - 866MHz)',
                                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 830000, stop_freq: 866000, label: 'Sennheiser E-Band G2 (830 - 866MHz)', id: 'SEN_E_G2'} ); }
                                },{
                                    label: 'G3 Series (823 - 865MHz)',
                                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser E-Band G3 (823 - 865MHz)', id: 'SEN_E_G3'} ); }
                                }
                            ]
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
                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 821000, stop_freq: 831000, label: 'LTE Up-/Downlink Space (821 - 831MHz)'} ); }
                },{
                    label: 'ISM Band (863 - 866MHz)',
                    click () { mainWindow.webContents.send ( 'CHANGE_FREQ', { start_freq: 863000, stop_freq: 866000, label: 'ISM Band (863 - 866MHz)'} ); }
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