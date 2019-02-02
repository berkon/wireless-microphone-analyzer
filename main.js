'use strict'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true; // Disable security warning on the console

var SerialPort = require ( 'serialport' );
const FREQ_VENDOR_BANDS   = require ( 'require-all' )(__dirname +'/frequency_data/bands'  );
const FREQ_VENDOR_PRESETS = require ( 'require-all' )(__dirname +'/frequency_data/presets');

const {app, BrowserWindow, Menu} = require('electron');
const electronLocalshortcut = require ( 'electron-localshortcut' );
var { productName, version } = require ( './package.json' );

let mainWindow;
let helpWindow;

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

    mainWindow.setTitle ( productName + " V" + version );

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

    Object.entries ( FREQ_VENDOR_BANDS ).forEach ( vendorBandData => {
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

    menuJSON.push ({ label: 'Chan. Presets', submenu: [] });

    Object.entries ( FREQ_VENDOR_PRESETS ).forEach ( vendorPreset => {
        let key        = vendorPreset[0].split("_");
        let preset     = vendorPreset[1];
        let vendor_idx = undefined;
        let band_idx   = undefined;
        let series_idx = undefined;

        vendor_idx = menuJSON[1].submenu.findIndex ( ( elem ) => { return elem.label === key[0]; });

        if ( vendor_idx === -1 ) // Does this vendor already exists as a submenu?
            vendor_idx = menuJSON[1].submenu.push ({ label: key[0], submenu: [] }) - 1;
        
        band_idx = menuJSON[1].submenu[vendor_idx].submenu.findIndex ( ( elem ) => { return elem.label === key[1] + " - Band"; });
        
        if ( band_idx === -1 ) // Does this band already exist in this vendor submenu?
            band_idx = menuJSON[1].submenu[vendor_idx].submenu.push ({ label: key[1] + " - Band", submenu: [] }) - 1;

        series_idx = menuJSON[1].submenu[vendor_idx].submenu[band_idx].submenu.findIndex ( ( elem ) => { return elem.label === key[2]; });
        
        if ( series_idx ) // Does this series already exist in this band submenu?
            series_idx = menuJSON[1].submenu[vendor_idx].submenu[band_idx].submenu.push ({ label: key[2], submenu: [] }) - 1;

        preset.forEach ( (bank, i) => {
            menuJSON[1].submenu[vendor_idx].submenu[band_idx].submenu[series_idx].submenu.push ({
                label: "Bank " + (i+1),
                click () { wc.send ( "SET_CHAN_PRESET", { preset: vendorPreset[0] + "_" + (i+1) }); }
            });
        });
    });

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

        helpWindow.setTitle ( productName + " V" + version );
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