'use strict'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true; // Disable security warning on the console

var SerialPort = require ( 'serialport' );
const bandData = require ( 'require-all' )(__dirname +'/frequency_data/bands');

const {app, BrowserWindow, Menu} = require('electron');
const electronLocalshortcut = require ( 'electron-localshortcut' );

let mainWindow
let helpWindow

function createWindow () {
    mainWindow = new BrowserWindow({width: 1200, height: 700});
    mainWindow.loadFile('index.html');
    let wc = mainWindow.webContents;
    //wc.openDevTools();
    
    electronLocalshortcut.register ( mainWindow, 'Alt+CommandOrControl+Shift+I', () => {
        mainWindow.toggleDevTools();
    });

    electronLocalshortcut.register ( mainWindow, 'CommandOrControl+R', () => {
        mainWindow.reload();
    });

    var chanPresetMenuJSON =
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
        ]};
/*        { label: 'Analyze', submenu: [
            { label: 'No channel analysis', type: 'radio', checked: true, click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'NON' } ); } },
            { label: 'Sennheiser channels', type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SEN' } ); } },
            { label: 'Shure channels'     , type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SHU' } ); } }
        ]}, */
        
    var portMenuJSON = { label: 'Port', submenu: [] };
    var helpMenuJSON = { label: 'Help', click () { openHelpWindow(); } };

    function addMenuEntryOrSubmenu ( menu_label, menu_data, menu_location ) {
        if ( !Array.isArray (menu_data) ) {
            menu_location.push ({
                "label": menu_label,
                click () { wc.send ( "CHANGE_BAND", {
                    start_freq : menu_data.start_freq,
                    stop_freq  : menu_data.stop_freq,
                    details    : menu_data.details,
                    band       : menu_data.band
                }); }
            });
            return;
        }

        let len = menu_location.push ({ "label": menu_label, "submenu": [] });

        menu_data.forEach ( (submenu_entry) => {
            if ( submenu_entry.hasOwnProperty ('submenu') ) {
                addMenuEntryOrSubmenu ( submenu_entry.label, submenu_entry.submenu, menu_location[len-1].submenu );
            } else {
                menu_location[len-1].submenu.push ({
                    "label": submenu_entry.label,
                    click () { wc.send ( "CHANGE_BAND", {
                        "start_freq" : submenu_entry.start_freq,
                        "stop_freq"  : submenu_entry.stop_freq,
                        "details"    : submenu_entry.details,
                        "band"       : submenu_entry.band
                    }); }
                });
            }
        });
    }

    var menuJSON = [];
    menuJSON.push ({ label: 'Band', submenu: [] });

    Object.entries ( bandData ).forEach ( vendorBandData => {
        let key   = vendorBandData[0];
        let value = vendorBandData[1];

        if ( Array.isArray ( value ) ) {
            menuJSON[0].submenu.push ({ type:'separator' });
            value.forEach ( (val) => {
                addMenuEntryOrSubmenu ( val.label, val, menuJSON[0].submenu );
            });
            menuJSON[0].submenu.push ({ type:'separator' });
        } else if ( value.hasOwnProperty ('submenu') )
            addMenuEntryOrSubmenu ( value.label, value.submenu, menuJSON[0].submenu );
        else
            addMenuEntryOrSubmenu ( value.label, value, menuJSON[0].submenu );
    });

    menuJSON.push ( chanPresetMenuJSON );
    menuJSON.push ( portMenuJSON );
    menuJSON.push ( helpMenuJSON );

    // Add serial ports to the menu
    SerialPort.list().then ( (ports, err) => {
        let portNameArr = [];

        if ( err ) {
            console.log ( err );
            return;
        }
        
        ports.forEach ( ( port ) => {
            portNameArr.push ( port.comName );
        });

        menuJSON[2].submenu[0] = { label: 'Auto', type: 'radio', click () { wc.send ( 'SET_PORT',  portNameArr ); } }

        portNameArr.forEach ( ( port ) => {
            menuJSON[2].submenu.push (
                {
                    'label' : port,
                    'type'  : 'radio' ,
                    click () { wc.send ( 'SET_PORT', { port : port } ); }
                }
            );
        });

        Menu.setApplicationMenu ( Menu.buildFromTemplate ( menuJSON ) );
    });

    function openHelpWindow () {
        helpWindow = new BrowserWindow({width: 800, height: 600});
        helpWindow.setMenu ( null );
        helpWindow.loadFile('help.html');

        electronLocalshortcut.register ( helpWindow, 'CommandOrControl+R', () => {
            helpWindow.reload();
        });
    }

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