'use strict'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true; // Disable security warning on the console

const {app, BrowserWindow, Menu} = require('electron')
let mainWindow

function createWindow () {
    mainWindow = new BrowserWindow({width: 1200, height: 700});
    mainWindow.loadFile('index.html');
    let wc = mainWindow.webContents;
    wc.openDevTools();

    var menu = Menu.buildFromTemplate ([
        { label: 'Band', submenu: [
            { label:'Sennheiser', submenu: [
                { label: 'A1-Band (470 - 516MHz)' , click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 516000, label: 'Sennheiser A1-Band (470 - 516MHz)', band: 'SEN_A1'} ); } },
                { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser A-Band (516 - 558MHz)' , band: 'SEN_A' } ); } },
                { label: 'G-Band  (566 - 608MHz)' , click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser G-Band (566 - 608MHz)' , band: 'SEN_G' } ); } },
                { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser B-Band (626 - 668MHz)' , band: 'SEN_B' } ); } },
                { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser C-Band (734 - 776MHz)' , band: 'SEN_C' } ); } },
                { label: 'D-Band   (780 - 822MHz)', submenu: [
                        { label: 'Full D-Band (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser D-Band (780 - 822MHz)', band: 'SEN_D'} ); } },
                        { type : 'separator'                  },
                        { label: 'G2 Series (786 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 786000, stop_freq: 822000, label: 'Sennheiser D-Band G2 Series (786 - 822MHz)', band: 'SEN_D_G2'} ); } },
                        { label: 'G3 Series (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser D-Band G3 Series (780 - 822MHz)', band: 'SEN_D_G3'} ); } }
                ]},
                { label: 'E-Band   (823 - 866MHz)', submenu: [
                        { label: 'Full E-Band (823 - 866MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 866000, label: 'Sennheiser E-Band (823 - 866MHz)', band: 'SEN_E'} ); } },
                        { type : 'separator'                  },
                        { label: 'G2 Series (830 - 866MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 830000, stop_freq: 866000, label: 'Sennheiser E-Band G2 Series (830 - 866MHz)', band: 'SEN_E_G2'} ); } },
                        { label: 'G3 Series (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser E-Band G3 Series (823 - 865MHz)', band: 'SEN_E_G3'} ); } }
                ]}
            ]},
            { label:'Shure', click() { } },
            { type:'separator' },
            { label: 'LTE Up-/Downlink Space (823 - 832MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 832000, label: 'LTE Up-/Downlink Space (823 - 832MHz)'} ); } },
            { label: 'ISM Band (863 - 865MHz)',               click () { wc.send ( 'CHANGE_BAND', { start_freq: 863000, stop_freq: 865000, label: 'ISM Band (863 - 865MHz)'              } ); } }
        ]},
        { label: 'Chan. Presets', submenu: [
            { label: 'Sennheiser', submenu: [
                { label: 'D-Band', submenu: [
                    { label: 'G2 Series', submenu: [
                        { label: 'Bank 1', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_1' } ); } },
                        { label: 'Bank 2', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_2' } ); } },
                        { label: 'Bank 3', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_3' } ); } },
                        { label: 'Bank 4', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_4' } ); } },
                        { label: 'Bank 5', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_5' } ); } },
                        { label: 'Bank 6', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_6' } ); } },
                        { label: 'Bank 7', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_7' } ); } },
                        { label: 'Bank 8', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_8' } ); } }
                    ]}
                ]},
                { label: 'E-Band', submenu: [
                    { label: 'G2 Series', submenu: [
                        { label: 'Bank 1', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_1' } ); } },
                        { label: 'Bank 2', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_2' } ); } },
                        { label: 'Bank 3', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_3' } ); } },
                        { label: 'Bank 4', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_4' } ); } },
                        { label: 'Bank 5', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_5' } ); } },
                        { label: 'Bank 6', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_6' } ); } },
                        { label: 'Bank 7', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_7' } ); } },
                        { label: 'Bank 8', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_8' } ); } }
                    ]},
                    { label: 'G3 Series', submenu: [
                        { label: 'Bank 1' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_1'  } ); } },
                        { label: 'Bank 2' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_2'  } ); } },
                        { label: 'Bank 3' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_3'  } ); } },
                        { label: 'Bank 4' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_4'  } ); } },
                        { label: 'Bank 5' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_5'  } ); } },
                        { label: 'Bank 6' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_6'  } ); } },
                        { label: 'Bank 7' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_7'  } ); } },
                        { label: 'Bank 8' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_8'  } ); } },
                        { label: 'Bank 9' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_9'  } ); } },
                        { label: 'Bank 10', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_10' } ); } },
                        { label: 'Bank 11', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_11' } ); } },
                        { label: 'Bank 12', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_12' } ); } },
                        { label: 'Bank 13', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_13' } ); } },
                        { label: 'Bank 14', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_14' } ); } },
                        { label: 'Bank 15', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_15' } ); } },
                        { label: 'Bank 16', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_16' } ); } },
                        { label: 'Bank 17', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_17' } ); } },
                        { label: 'Bank 18', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_18' } ); } },
                        { label: 'Bank 19', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_19' } ); } },
                        { label: 'Bank 20', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_20' } ); } }
                    ]}
                ]}
            ]},
            { label: 'Shure'     , click () { wc.send ( 'SET_CHAN_PRESET', { vendor: 'SHU' } ); } }
        ]},
        { label: 'Analyze', submenu: [
            { label: 'No channel analysis', type: 'radio', checked: true, click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'NON' } ); } },
            { label: 'Sennheiser channels', type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SEN' } ); } },
            { label: 'Shure channels'     , type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SHU' } ); } }
        ]},
        { label: 'Help' }
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