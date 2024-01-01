'use strict'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true; // Disable security warning on the console

var { SerialPort } = require ( 'serialport' );
const fs           = require ('fs');

const FREQ_VENDOR_BANDS   = require ( 'require-all' )(__dirname +'/frequency_data/vendor_bands'  );
const FREQ_VENDOR_PRESETS = require ( 'require-all' )(__dirname +'/frequency_data/presets');
const COUNTRIES           = require ( './country_codes');

const {ipcMain}                      = require ( 'electron'               );
const {app, BrowserWindow, Menu}     = require ( 'electron'               );
const electronLocalshortcut          = require ( 'electron-localshortcut' );
const { productName, name, author, version } = require ( './package.json' );
const { dialog }                     = require ( 'electron'               );

app.commandLine.appendSwitch('disable-gpu');
require('@electron/remote/main').initialize()

// See the following discussions for next setting
// https://stackoverflow.com/questions/60106922/electron-non-context-aware-native-module-in-renderer
//https://github.com/electron/electron/issues/18397#issuecomment-583221969
app.allowRendererProcessReuse = false

const ConfigStore = require ( 'configstore' );
const configStore = new ConfigStore ( name );

let MENU_BAND     = 0;
let MENU_CHANNELS = 1;
let MENU_COUNTRY  = 2;
let MENU_PORT     = 3;
let MENU_SCAN_DEVICE = 4;
let MENU_TOOLS    = 5;
let MENU_HELP     = 6;

if ( process.platform === 'darwin') {
    MENU_BAND     = 1;
    MENU_CHANNELS = 2;
    MENU_COUNTRY  = 3;
    MENU_PORT     = 4;
    MENU_SCAN_DEVICE = 5;
    MENU_TOOLS    = 6;
    MENU_HELP     = 7;
}

let mainWindow;
let helpWindow;
let aboutWindow;

let globalPorts = []

let country_code = configStore.get('country_code');

if ( !country_code ) {
    console.log ( "No country setting saved! Using default: 'DE'");
    country_code = "DE";
}

const gotLock = app.requestSingleInstanceLock()
    
if ( !gotLock ) {
    app.quit()
} else { // This applies to the first instance of the applicatoin which has got the lock
    app.on ( 'second-instance', (event, commandLine, workingDirectory ) => {
        // Someone tried to run a second instance, we should focus our window.
        if ( mainWindow ) {
            if ( mainWindow.isMinimized() ) {
                mainWindow.restore()
            }

            mainWindow.focus()
        }
    })
}

function createWindow () {
    mainWindow = new BrowserWindow ({
        width: 1200,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');
    let wc = mainWindow.webContents;
    require("@electron/remote/main").enable(wc)
//wc.openDevTools();
    
    electronLocalshortcut.register ( mainWindow, 'F12', () => {
        mainWindow.toggleDevTools();
    });

    electronLocalshortcut.register ( mainWindow, 'CommandOrControl+R', () => {
        mainWindow.reload();
    });

    mainWindow.setTitle ( productName + " V" + version );

/*        { label: 'Analyze', submenu: [
            { label: 'No channel analysis', type: 'radio', checked: true, click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'NON' } ); } },
            { label: 'Sennheiser channels', type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SEN' } ); } },
            { label: 'Shure channels'     , type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SHU' } ); } }
        ]}, */
        
    var portMenuJSON = { label: 'Port', submenu: [] };

    var scanDeviceMenuJSON = { label: 'Device', submenu: [{
        label : 'RF Explorer',
        code  : 'RF_EXPLORER',
        type  : 'radio',
        click () { wc.send ( 'SET_SCAN_DEVICE', { scanDevice : 'RF_EXPLORER' } ); }
    }, {
        label : 'Tiny SA',
        code  : 'TINY_SA',
        type  : 'radio',
        click () { wc.send ( 'SET_SCAN_DEVICE', { scanDevice : 'TINY_SA' } ); }
    }, {
        label : 'Settings',
        code  : 'DEVICE_SETTINGS',
        click () { wc.send ( 'DEVICE_SETTINGS', {} ); }
    }]};

    var toolsMenuJSON = { label: 'Tools', submenu: [
        { label: 'Export', submenu: [
            { label: "Shure WW6 and IAS (CSV Format)", click () {
                dialog.showSaveDialog ({
                    title: "Export for Shure WW6 and IAS (CSV Format)",
                    filters: [ {name: "CSV", extensions: ["csv"]} ]
                }).then ( (res) => {
                    wc.send ( 'EXPORT_WW6_IAS_CSV', { filename : res.filePath })
                })  }
            }
        ]},
        { label : 'MX Linux Workaround',
            type  : 'checkbox',
            click (ev) {
                wc.send ( 'MX_LINUX_WORKAROUND', { enabled : ev.checked ? true : false })
            }
        },
        { label: 'Reset Peak             R', click () {
            wc.send ('RESET_PEAK', {});
        }},
        { label: 'Reset Settings', click () {
            wc.send ('RESET_SETTINGS', {});
        }}
    ]};

    var helpMenuJSON = { label: 'Help', submenu: [
        { label: "Documentation", click () { openHelpWindow() ; } },
        { label: "Developer tools", click () { wc.openDevTools(); } },
        { label: "About"        , click () { openAboutWindow(); } }
    ]};

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
            } else if ( submenu_entry.hasOwnProperty ('type') && submenu_entry.type === 'separator' ) {
                menu_location[len-1].submenu.push ({type: "separator"});
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

    if ( process.platform === 'darwin' )
        menuJSON.push ({ label: 'App Menu', submenu: [{ role: 'quit'}] })
    
    menuJSON.push ({ label: 'Band', submenu: [] });

    Object.entries ( FREQ_VENDOR_BANDS ).forEach ( vendorBandData => {
        let key   = vendorBandData[0];
        let value = vendorBandData[1];

        if ( Array.isArray ( value ) ) {
            menuJSON[MENU_BAND].submenu.push ({ type:'separator' });
            value.forEach ( (val) => {
                addMenuEntryOrSubmenu ( val.label, val, menuJSON[MENU_BAND].submenu );
            });
            menuJSON[MENU_BAND].submenu.push ({ type:'separator' });
        } else if ( value.hasOwnProperty ('submenu') )
            addMenuEntryOrSubmenu ( value.label, value.submenu, menuJSON[MENU_BAND].submenu );
        else
            addMenuEntryOrSubmenu ( value.label, value, menuJSON[MENU_BAND].submenu );
    });

    if ( country_code && fs.existsSync ( __dirname + '/frequency_data/country_bands/' + country_code ) ) {
        const COUNTRY_BANDS = require ( 'require-all' )(__dirname +'/frequency_data/country_bands/' + country_code );
        menuJSON[MENU_BAND].submenu.push ({ type:'separator' });

        Object.entries ( COUNTRY_BANDS ).forEach ( countryBandData => {
            let key   = countryBandData[0];
            let value = countryBandData[1];
            addMenuEntryOrSubmenu ( value.label, value.hasOwnProperty('submenu')?value.submenu:value, menuJSON[MENU_BAND].submenu );
        });
    }

    menuJSON.push ({ label: 'Chan. Presets', submenu: [] });

    Object.entries ( FREQ_VENDOR_PRESETS ).forEach ( vendorPreset => {
        let key        = vendorPreset[0].split("_");
        let preset     = vendorPreset[1];
        let vendor_idx = undefined;
        let band_idx   = undefined;
        let series_idx = undefined;

        vendor_idx = menuJSON[MENU_CHANNELS].submenu.findIndex ( ( elem ) => { return elem.label === key[0]; });

        if ( vendor_idx === -1 ) // Does this vendor already exists as a submenu?
            vendor_idx = menuJSON[MENU_CHANNELS].submenu.push ({ label: key[0], submenu: [] }) - 1;
        
        band_idx = menuJSON[MENU_CHANNELS].submenu[vendor_idx].submenu.findIndex ( ( elem ) => { return elem.label === key[1] + " - Band"; });
        
        if ( band_idx === -1 ) // Does this band already exist in this vendor submenu?
            band_idx = menuJSON[MENU_CHANNELS].submenu[vendor_idx].submenu.push ({ label: key[1] + " - Band", submenu: [] }) - 1;

        if ( key[2] !== "NONE" ) {
            series_idx = menuJSON[MENU_CHANNELS].submenu[vendor_idx].submenu[band_idx].submenu.findIndex ( ( elem ) => { return elem.label === key[2]; });
        
            if ( series_idx ) // Does this series already exist in this band submenu?
                series_idx = menuJSON[MENU_CHANNELS].submenu[vendor_idx].submenu[band_idx].submenu.push ({ label: key[2], submenu: [] }) - 1;
        }

        preset.forEach ( (bank, i) => {
            if ( key[2] !== "NONE" ) {
                menuJSON[MENU_CHANNELS].submenu[vendor_idx].submenu[band_idx].submenu[series_idx].submenu.push ({
                    label: "Bank " + (i+1),
                    click () { wc.send ( "SET_CHAN_PRESET", { preset: vendorPreset[0] + "_" + (i+1) }); }
                });
            } else {
                menuJSON[MENU_CHANNELS].submenu[vendor_idx].submenu[band_idx].submenu.push ({
                    label: "Bank " + (i+1),
                    click () { wc.send ( "SET_CHAN_PRESET", { preset: vendorPreset[0] + "_" + (i+1) }); }
                });
            }
        });
    });

    menuJSON.push ({ label: 'Country', submenu: [] });

    COUNTRIES.forEach ( c => {
        if ( fs.existsSync ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + c.code + '.json' ) ) {
            menuJSON[MENU_COUNTRY].submenu.push (
                {
                    'label' : c.label,
                    'code'  : c.code,
                    'type'  : 'radio' ,
                    'checked': country_code===c.code?true:false,
                    click () { wc.send ( 'SET_COUNTRY', { country_code : c.code, country_label : c.label } ); }
                }
            );
        }
    });

    ipcMain.on ( "SET_COUNTRY", (event, data) => {
        menuJSON[MENU_COUNTRY].submenu.forEach ( function ( elem ) {
            if ( elem.code === data.country_code ) {
                elem.checked = true;

                // Need to rebuild menu to reflect attribute (in this case the 'checked' attribute)
                Menu.setApplicationMenu ( Menu.buildFromTemplate ( menuJSON ) );
            }
        });
    });

    ipcMain.on ( "MX_LINUX_WORKAROUND", (event, data) => {
        let elem = menuJSON[MENU_TOOLS].submenu.find((elem)=> elem.label === 'MX Linux Workaround')
        elem.checked = data.checked;
        // Need to rebuild menu to reflect attribute (in this case the 'checked' attribute)
        Menu.setApplicationMenu ( Menu.buildFromTemplate ( menuJSON ) )
    });

    menuJSON.push ( portMenuJSON  );
    menuJSON.push ( scanDeviceMenuJSON );
    menuJSON.push ( toolsMenuJSON );
    menuJSON.push ( helpMenuJSON  );

    ipcMain.on ( "SET_SCAN_DEVICE", (event, data) => {
        switch ( data.scanDevice ) {
            case 'RF_EXPLORER':
                menuJSON[MENU_SCAN_DEVICE].submenu[0].checked = true
                menuJSON[MENU_SCAN_DEVICE].submenu[1].checked = false
                break

            case 'TINY_SA':
                menuJSON[MENU_SCAN_DEVICE].submenu[0].checked = false
                menuJSON[MENU_SCAN_DEVICE].submenu[1].checked = true
                break
        }

        // Need to rebuild menu to reflect attribute (in this case the 'checked' attribute)
        Menu.setApplicationMenu ( Menu.buildFromTemplate ( menuJSON ) )
    })

    let createPortMenu = selectedPort => {
        let portPathArr = [];
        menuJSON[MENU_PORT].submenu = []

        globalPorts.forEach ( ( port ) => {
            portPathArr.push ( port.path );
        });

        menuJSON[MENU_PORT].submenu[0] = {
            label: 'Auto',
            type: 'radio',
            checked: (selectedPort === undefined || selectedPort === 'AUTO') ? true : false,
            click () { wc.send ( 'SET_PORT',  portPathArr ); }
        }

        portPathArr.forEach ( port => {
            menuJSON[MENU_PORT].submenu.push (
                {
                    'label' : port,
                    'type'  : 'radio',
                    'checked': selectedPort === port ? true : false,
                    click () { wc.send ( 'SET_PORT', { port : port } ); }
                }
            );
        });

        // Need to rebuild menu to reflect attribute (in this case the 'checked' attribute)
        Menu.setApplicationMenu ( Menu.buildFromTemplate ( menuJSON ) );
    }

    ipcMain.on ( "SET_PORT", (event, data) => {
        createPortMenu ( data.portPath )
    })

    // Add serial ports to the menu
    SerialPort.list().then ( (ports, err) => {
        if ( err ) {
            console.log ( err );
            return;
        }

        globalPorts = ports
        createPortMenu ( err )
    })

    function openHelpWindow () {
        helpWindow = new BrowserWindow({width: 800, height: 600});
        helpWindow.setMenu ( null );
        helpWindow.loadFile('help.html');

        electronLocalshortcut.register ( helpWindow, 'CommandOrControl+R', () => {
            helpWindow.reload();
        });

        electronLocalshortcut.register ( helpWindow, 'Alt+CommandOrControl+Shift+I', () => {
            helpWindow.toggleDevTools();
        });

        electronLocalshortcut.register ( helpWindow, 'Esc', () => {
            helpWindow.close();
        });

        helpWindow.setTitle ( "Documentation" );
    }

    function openAboutWindow () {
        aboutWindow = new BrowserWindow({width: 500, height: 170, resizable: false});
        aboutWindow.setMenu ( null );
        aboutWindow.loadFile('about.html');

        electronLocalshortcut.register ( aboutWindow, 'CommandOrControl+R', () => {
            aboutWindow.reload();
        });

        electronLocalshortcut.register ( aboutWindow, 'Alt+CommandOrControl+Shift+I', () => {
            aboutWindow.toggleDevTools();
        });

        electronLocalshortcut.register ( aboutWindow, 'Esc', () => {
            aboutWindow.close();
        });

        aboutWindow.setTitle ( "About" );
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
