'use strict'

const { ipcRenderer } = require ('electron');
const { app, BrowserWindow } = require ( '@electron/remote' )
const ConfigStore     = require ( 'configstore' );
const { SerialPort }  = require ( 'serialport'  );
const Chart           = require ( 'chart.js'    );
const Swal            = require ( 'sweetalert2' );
const FREQ_VENDOR_PRESETS = require ( 'require-all' )(__dirname +'/frequency_data/presets' );
const Pkg             = require ('./package.json');
const fs              = require ('fs');
var { Subject, firstValueFrom } = require('rxjs');
const configStore     = new ConfigStore ( Pkg.name )
require ( './logger.js' );

const RFExplorer = require('./scan_devices/rf_explorer.js');
const TinySA = require('./scan_devices/tiny_sa.js');

const SAVED_DATA_VERSION = 1

global.MAX_DBM = -20
global.MIN_DBM = -110
const CONGESTION_LEVEL_DBM = -85
const SERIAL_RESPONSE_TIMEOUT = 1500

const LINE_LIVE          = 0
const LINE_RECOMMENDED   = 1
const LINE_FORBIDDEN     = 2
const LINE_CONGESTED     = 3
const LINE_CONGEST_TRESH = 4
const LINE_GRIDS         = 5
const LINE_FORBIDDEN_MARKERS = 6

var MIN_FREQ     = undefined
var MAX_FREQ     = undefined
var MIN_SPAN     = undefined
var MAX_SPAN     = undefined
global.SWEEP_POINTS = 100 // default value
var COM_PORT = undefined
var VENDOR_ID    = 'NON'

const SENNHEISER_CHANNEL_WIDTH   = 96000 // +/-48kHz Spitzenhub

let isExecuting = false
var port = null
let globalPorts = []
let baudRate = ''
var scanDevice = null
let saved_data_version = configStore.get('saved_data_version')
let portDetectionIndex = 0
var data$ = new Subject();
let dataSubscription = null
let popupCategory = ''
let responseCheckTimer  = null
let formValid = false

let curKeyInputTarget = '';
let keyInputTargets = {
    MANUAL_BAND_SETTINGS: 'MANUAL_BAND_SETTINGS',
    SWEEP_POINT_SETTINGS: 'SWEEP_POINT_SETTINGS'
}

document.getElementById('donate-button').addEventListener ('click', () => openDonateWindow() )

function openDonateWindow () {
    let win = new BrowserWindow ({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        width: 650,
        height: 650
    })
    win.setMenuBarVisibility ( false )
    win.loadURL("file://" + __dirname + "/donate.html")
//win.webContents.openDevTools()
}

// Saved data version handling
if ( !saved_data_version ) {
    configStore.set ( 'saved_data_version', SAVED_DATA_VERSION )
    saved_data_version = SAVED_DATA_VERSION
} else {
    switch ( saved_data_version ) {
        case 1: // Nothing to do
            break;

        default:
            log.info ( "Unknown version of saved data!" )
    }
}

let chPreset_Vendor = configStore.get('chPreset.vendor');
let chPreset_Band   = configStore.get('chPreset.band'  );
let chPreset_Series = configStore.get('chPreset.series');
let chPreset_Preset = configStore.get('chPreset.preset');

let COUNTRY_CODE    = configStore.get('country_code'   );
var COUNTRY_NAME    = configStore.get('country_name'   );
global.START_FREQ   = configStore.get('start_freq');
var LAST_START_FREQ = configStore.get('last_start_freq');
global.STOP_FREQ    = configStore.get('stop_freq');
var LAST_STOP_FREQ  = configStore.get('last_stop_freq' );
var FREQ_STEP       = configStore.get('freq_step');
var BAND_LABEL      = configStore.get('band_label'     );
var BAND_DETAILS    = configStore.get('band_details'   );
var VIS_MANUF_CHAN  = configStore.get('graphVisibility.recommended');
var VIS_FORBIDDEN   = configStore.get('graphVisibility.forbidden'  );
var VIS_CONGEST     = configStore.get('graphVisibility.congested'  );
var VIS_TV_CHAN     = configStore.get('graphVisibility.grids'      );
global.MX_LINUX_WORKAROUND = configStore.get('mx_linux_workaround_enabled' );
var SCAN_DEVICE     = configStore.get('scan_device' );
var COM_PORT        = configStore.get('com_port');
var SWEEP_POINTS    = configStore.get('sweep_points');
let DARK_MODE       = configStore.get('dark_mode');

const chartColors = {
    RED    : 'rgb(255, 99 ,132 )',
    AMBER  : 'rgb(255, 159, 64  )',
    GREEN  : 'rgb(75 , 222, 192)',
    PURPLE : 'rgb(153, 102, 255)',
    GREY   : 'rgb(201, 203, 207)'
}

if (DARK_MODE) {
    document.getElementsByTagName('body')[0].setAttribute('class', 'dark-mode')
}

const RECOMMENDED_CHANNELS_COLOR = chartColors.GREEN
const FORBIDDEN_COLOR            = chartColors.RED
const SCAN_COLOR                 = chartColors.PURPLE
const CONGESTED_COLOR            = chartColors.AMBER
const CHAN_GRID_COLOR            = chartColors.GREY

if ( !global.MX_LINUX_WORKAROUND ) {
    configStore.set('mx_linux_workaround_enabled', false )
    global.MX_LINUX_WORKAROUND = false
}

log.info ( "=========== Starting application ===========")
log.info ( `Running on platform: '${process.platform}'`)
log.info ( "MX Linux workaround is " + (global.MX_LINUX_WORKAROUND ? "enabled" : "disabled"))
ipcRenderer.send ('MX_LINUX_WORKAROUND', { checked : global.MX_LINUX_WORKAROUND });

if ( !DARK_MODE) {
    configStore.set('dark_mode', false )
    DARK_MODE = false
}

log.info ( "Dark mode is " + (DARK_MODE ? "enabled" : "disabled"))
ipcRenderer.send ('DARK_MODE', { checked : DARK_MODE });

var ctx = document.getElementById("graph2d").getContext('2d');
var myChart = null

if ( VIS_MANUF_CHAN === undefined ) VIS_MANUF_CHAN = true;
if ( VIS_FORBIDDEN  === undefined ) VIS_FORBIDDEN  = true;
if ( VIS_CONGEST    === undefined ) VIS_CONGEST    = true;
if ( VIS_TV_CHAN    === undefined ) VIS_TV_CHAN    = true;

let showPopup = async ( type, category, title, html, buttonsArr = [] ) => {
    popupCategory = category
    let swalConfig = {
        title,
        html,
        icon: type,
        showCancelButton: buttonsArr.length > 1 ? true : false,
        confirmButtonColor: "#0099ff",
        customClass: {
            title: 'sweetalert2-title',
            container: 'sweetalert2-container'
        }
    }

    if ( buttonsArr.length ) {
        swalConfig.confirmButtonText = buttonsArr[0]
    }

    if ( buttonsArr.length > 1 ) {
        swalConfig.cancelButtonText = buttonsArr[buttonsArr.length-1]
    }

    return Swal.fire ( swalConfig )
}

let initChart = () => {
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [
                {
                    type: "line",
                    label: 'Live Scan (Peak Hold)',
                    backgroundColor: Chart.helpers.color(SCAN_COLOR).alpha(0.5).rgbString(),
                    borderColor: SCAN_COLOR,
                    pointBackgroundColor: SCAN_COLOR,
                    borderWidth: 2,
                    pointRadius: 1.5,
                    fill: 'start',
                    lineTension: 0.4
                },{
                    type: "line",
                    label: 'Recommended Manuf. Channels',
                    backgroundColor: Chart.helpers.color(RECOMMENDED_CHANNELS_COLOR).alpha(0.5).rgbString(),
                    borderColor: RECOMMENDED_CHANNELS_COLOR,
                    borderWidth: 0.01, // 0 is not working!
                    pointRadius: 0,
                    fill: 'start',
                    lineTension: 0,
                    spanGaps: false,
                    hidden: !VIS_MANUF_CHAN
                },{
                    type: "line",
                    label: 'Forbidden Ranges',
                    backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.5).rgbString(),
                    borderColor: FORBIDDEN_COLOR,
                    borderWidth: 0.01, // 0 is not working!
                    pointRadius: 0,
                    fill: 'start',
                    lineTension: 0,
                    spanGaps: false,
                    hidden: !VIS_FORBIDDEN
                },{
                    type: "line",
                    label: 'Congested / Forbidden Channels',
                    backgroundColor: Chart.helpers.color(CONGESTED_COLOR).alpha(0.7).rgbString(),
                    borderColor: CONGESTED_COLOR,
                    borderWidth: 0.01, // 0 is not working!
                    pointRadius: 0,
                    fill: 'start',
                    lineTension: 0,
                    spanGaps: false,
                    hidden: !VIS_CONGEST
                },{
                    type: "line",
                    label: 'Congest_Thresh',
                    backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.5).rgbString(),
                    borderColor: FORBIDDEN_COLOR,
                    borderWidth: 2, // 0 is not working!
                    pointRadius: 0,
                    fill: 'none',
                    lineTension: 0,
                    spanGaps: true
                },{
                    type: "line",
                    label: 'TV Chan. Grid',
                    backgroundColor: Chart.helpers.color(CHAN_GRID_COLOR).alpha(0.3).rgbString(),
                    borderColor: CHAN_GRID_COLOR,
                    borderWidth: 0.01, // 0 is not working!
                    pointRadius: 0,
                    fill: 'start',
                    lineTension: 0,
                    spanGaps: false,
                    hidden: !VIS_TV_CHAN
                },{
                    label: 'Forbidden Start Marker',
                    backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.2).rgbString(),
                    borderColor: FORBIDDEN_COLOR,
                    borderWidth: 0.2,
                    pointRadius: 0,
                    lineTension: 0,
                    spanGaps: false,
                    hidden: !VIS_FORBIDDEN
                }
            ]
        },
        options: {
        //    animation: false,
            responsive: true,
            legend: {
                labels :  {
                    filter: (legendItem, chartData) => {
                        if ( legendItem.datasetIndex === 0 ||
                            legendItem.datasetIndex === 4 ||
                            legendItem.datasetIndex === 6)
                            return false;
                        else
                            return true;
                    }
                },
                onClick: legendClick
            },
            scales: {
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: BAND_LABEL?BAND_LABEL:'Hz'
                    },
                    barPercentage: 0.2,
                    gridLines : {
                        offsetGridLines: false
                    },
                    offset: false
                },{
                    position: "top",
                    weight: 2,
                    labels: [],
                    offset: true,
                    gridLines: { display: false },
                    ticks: { 
                        autoSkip: false,
                        fontColor: '#FF6384'
                    }
                },{
                    position: "top",
                    weight: 1,
                    labels: [],
                    offset: true,
                    gridLines: { display: false },
                    ticks: { 
                        autoSkip: false,
                        fontColor: '#4BDEC0'
                    }
                },{
                    position: "top",
                    weight: 0,
                    labels: [],
                    gridLines: { display: false },
                    ticks: { 
                        autoSkip: false,
                        fontColor: '#BBBBBB',
                        maxRotation: 0
                    }
                }],
                yAxes: [{
                    ticks: {
                        min : global.MIN_DBM,
                        suggestedMax : global.MAX_DBM
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'dBm'
                    }
                }]
            }
        }
    });
}

if ( !COUNTRY_CODE || !fs.existsSync ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + COUNTRY_CODE + '.json' ) ) {
    COUNTRY_CODE = 'DE';
    log.info ( "No country set or file with forbidden ranges for that country does not exist! Falling back to 'DE'");
}

if ( !COM_PORT ) {
    COM_PORT = 'AUTO'
    configStore.set ( 'com_port', COM_PORT )
} else {
    ipcRenderer.send ('SET_PORT', { portPath : COM_PORT });
}

if ( !SWEEP_POINTS ) {
    configStore.set ( 'sweep_points', global.SWEEP_POINTS )
} else {
    global.SWEEP_POINTS = SWEEP_POINTS
}

var FREQ_FORBIDDEN = require ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + COUNTRY_CODE + '.json');

if ( fs.existsSync ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json' ) )
    var FREQ_GRIDS = require ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json');
else
    var FREQ_GRIDS = null;

var chDispValShadowArr = [];

function connectDevice (portIdentifier, shouldScan ) {
    if ( shouldScan ) {
        portDetectionIndex = 0 // when a port scan is requested, it can be considered that all ports should be checked
        scanPorts()
            .then ( () => connectPort(portIdentifier) )
            .then ( () => scanDevice.getConfiguration() )
            .catch( (error) => {
                log.error ( "scanPorts(): " + error )
            })
    } else {
        connectPort(portIdentifier)
            .then ( () => scanDevice.getConfiguration() )
    }
}

if ( SCAN_DEVICE ) {
    ipcRenderer.send ('SET_SCAN_DEVICE', { scanDevice : SCAN_DEVICE });
    log.info ( `Scan device is '${SCAN_DEVICE}'`)
    initChart()
    connectDevice ( COM_PORT?COM_PORT:'AUTO', true )
} else {
    log.info ( `No scan device selected. Waiting for user to select via popup ...`)

    Swal.fire({
        title: "Device selection",
        html: `Please choose your scan device. You can change it later via the 'Device' menu.`,
        input: 'select',
        inputOptions: {
            'RF_EXPLORER': RFExplorer.NAME,
            'TINY_SA': TinySA.NAME
        },
        inputPlaceholder: 'Choose a scan device',
        icon: "question",
        showCancelButton: false,
        confirmButtonColor: "#0099ff",
        customClass: {
            title: 'sweetalert2-title',
            container: 'sweetalert2-container'
        },
        willOpen: function () {
            Swal.getConfirmButton().setAttribute('disabled', 'true');
        },
        didOpen: () => {
            document.getElementById('swal2-select').addEventListener("change", () => {
                Swal.getConfirmButton().removeAttribute('disabled');                
            })
        }
    }).then ( result => {
        initChart()

        switch (result.value) {
            case RFExplorer.HW_TYPE:
                ipcRenderer.send ('SET_SCAN_DEVICE', { scanDevice : RFExplorer.HW_TYPE });
                configStore.set ('scan_device', 'RF_EXPLORER')
                SCAN_DEVICE = RFExplorer.HW_TYPE;
                connectDevice ( COM_PORT?COM_PORT:'AUTO', true )
                break

            case TinySA.HW_TYPE:
                ipcRenderer.send ('SET_SCAN_DEVICE', { scanDevice : TinySA.HW_TYPE });
                configStore.set ('scan_device', 'TINY_SA')
                SCAN_DEVICE = TinySA.HW_TYPE;
                connectDevice(COM_PORT?COM_PORT:'AUTO', true )
                break
        }
    })
}

function legendClick ( e, legendItem ) {
    var index = legendItem.datasetIndex;
    var ci    = this.chart;
    var meta  = ci.getDatasetMeta(index);
    
    switch ( index ) {
        case LINE_RECOMMENDED: configStore.set('graphVisibility.recommended', legendItem.hidden?true:false ); break;
        case LINE_FORBIDDEN  : configStore.set('graphVisibility.forbidden'  , legendItem.hidden?true:false ); break;
        case LINE_CONGESTED  : configStore.set('graphVisibility.congested'  , legendItem.hidden?true:false ); break;
        case LINE_GRIDS      : configStore.set('graphVisibility.grids'      , legendItem.hidden?true:false ); break;
        default:
    }

    meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;

    if ( index === LINE_FORBIDDEN ) {
        let meta_2 = ci.getDatasetMeta ( LINE_FORBIDDEN_MARKERS )
        meta_2.hidden = meta_2.hidden === null ? !ci.data.datasets[LINE_FORBIDDEN_MARKERS].hidden : null;
    }

    ci.update();
}

function setForbidden () {
    for ( var f of FREQ_FORBIDDEN ) {
        let range_res = isInRange ( f.start*1000, f.stop*1000);
        let left_data_point  = undefined;
        let right_data_point = undefined;

        if ( !range_res )
            continue;

        if ( range_res === "FULL_COVERAGE" ) {
            left_data_point  = 0;
            right_data_point = global.SWEEP_POINTS - 1;
        } else {
            left_data_point  = alignToBoundary ( Math.round ( (f.start * 1000 - global.START_FREQ) / FREQ_STEP ) );
            right_data_point = alignToBoundary ( Math.round ( (f.stop  * 1000 - global.START_FREQ) / FREQ_STEP ) );
        }

        let data_point = left_data_point;
        myChart.config.options.scales.xAxes[1].labels[left_data_point] = f.info;

        if ( f.start * 1000 >= global.START_FREQ )
            myChart.data.datasets[LINE_FORBIDDEN_MARKERS].data[left_data_point] = global.MIN_DBM;

        while ( data_point <= right_data_point ) {
            myChart.data.datasets[LINE_FORBIDDEN].data[data_point] = global.MAX_DBM;
            data_point++;
        }

        if ( f.stop * 1000 <= global.STOP_FREQ )
            myChart.data.datasets[LINE_FORBIDDEN_MARKERS].data[right_data_point] = global.MIN_DBM;
    }
}

function setChannelGrids () {
    if ( !FREQ_GRIDS )
        return;

    let even = true;
    let last_data_point  = undefined; //avoid overwriting edge values

    for ( var f of FREQ_GRIDS ) {
        let range_res = isInRange ( f.start*1000, f.stop*1000);
        let left_data_point  = undefined;
        let right_data_point = undefined;
        let data_point       = undefined;

        if ( !range_res )
            continue;

        if ( range_res === "FULL_COVERAGE" ) {
            left_data_point  = 0;
            right_data_point = global.SWEEP_POINTS - 1;
        } else {
            left_data_point  = alignToBoundary ( Math.round ( (f.start * 1000 - global.START_FREQ) / FREQ_STEP ) );
            right_data_point = alignToBoundary ( Math.round ( (f.stop  * 1000 - global.START_FREQ) / FREQ_STEP ) );
        }

        data_point = left_data_point;

        if ( f.start * 1000 >= global.START_FREQ )
            myChart.config.options.scales.xAxes[3].labels[left_data_point] = '|';

        myChart.config.options.scales.xAxes[3].labels[Math.round((left_data_point+right_data_point)/2)] = f.label;

        if ( !even ) { // Only draw even (gray) fields. Otherwise overlapping occours. For odd (white fields we simply do nothing)
            even = !even;
            last_data_point = right_data_point;
            continue;
        }

        while ( data_point <= right_data_point ) {
            myChart.data.datasets[LINE_GRIDS].data[data_point] = even?global.MAX_DBM:undefined;
            last_data_point = data_point;
            data_point++;
        }

        even = !even;
    }

    if ( last_data_point < global.SWEEP_POINTS - 1) // Draw last marker
        myChart.config.options.scales.xAxes[3].labels[last_data_point] = '|';
}

function setVendorChannels ( presets, bank ) {
    if ( !presets )
        return;
    
    for ( let i = 0 ; i < global.SWEEP_POINTS ; i++ ) {
        myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined;
        myChart.data.datasets[LINE_CONGESTED].data[i]   = undefined;
        myChart.config.options.scales.xAxes[2].labels[i] = '';
        chDispValShadowArr = [];
    }

    for ( let i = 0 ; i < presets.length ; i++ ) {
        let left_freq_edge  = presets[i]*1000 - SENNHEISER_CHANNEL_WIDTH/2;
        let right_freq_edge = presets[i]*1000 + SENNHEISER_CHANNEL_WIDTH/2;

        if ( !isInRange ( left_freq_edge, right_freq_edge) )
            continue;

        let left_data_point  = alignToBoundary ( Math.round ( (left_freq_edge  - global.START_FREQ) / FREQ_STEP ) );
        let right_data_point = alignToBoundary ( Math.round ( (right_freq_edge - global.START_FREQ) / FREQ_STEP ) );

        if ( right_data_point === left_data_point && right_data_point < global.SWEEP_POINTS - 1)
            right_data_point++;
        
        chDispValShadowArr.push ([left_data_point, right_data_point, false]); // Last param shows if congested or not

        let data_point       = left_data_point;
        let f = presets[i].toString().split('');
        f.splice ( 3, 0, "." );
        f = f.join ( '' );
        let label_pos = left_data_point + Math.floor((right_data_point - left_data_point )/2);
        myChart.config.options.scales.xAxes[2].labels[label_pos] = 'B'+(bank.length===1?'0':'')+bank+'.C'+(i.toString().length===1?'0':'')+(i+1)+'  ('+f+')';

        while ( data_point <= right_data_point ) {
            if ( isForbidden ( left_freq_edge, right_freq_edge ) )
                myChart.data.datasets[LINE_CONGESTED  ].data[data_point] = global.MAX_DBM;
            else
                myChart.data.datasets[LINE_RECOMMENDED].data[data_point] = global.MAX_DBM;

            data_point++;
        }
    }

    myChart.config.options.scales.xAxes[2].labels[0]   = ' ';
    myChart.config.options.scales.xAxes[2].labels[global.SWEEP_POINTS-1] = ' ';
}

function isInRange ( start, stop ) {
    if ( (start >= global.START_FREQ && start <= global.STOP_FREQ) || (stop >= global.START_FREQ && stop <= global.STOP_FREQ) )
        return true;
    else if ( (start <= global.START_FREQ && stop >= global.STOP_FREQ) )
        return "FULL_COVERAGE";
    else
        return false;
}

function isForbidden ( start, stop ) {
    for ( var f of FREQ_FORBIDDEN ) {
        if ( (start >= f.start*1000 && start <= f.stop*1000) || (stop >= f.start*1000 && stop <= f.stop*1000) )
            return true;
    }

    return false;
}

function alignToBoundary ( point ) {
    if ( point < 0 )
        return 0;
    else if ( point > global.SWEEP_POINTS - 1 )
        return global.SWEEP_POINTS - 1;
    else
        return point;
}

function formatFrequencyString ( freq ) { // as Hz
    let arr = freq.toString().split ( /(?=(?:...)*$)/ )
    return arr.join('.')
}

function updateChart () {
    myChart.data.labels = [];

    for ( var freq = global.START_FREQ; freq <= global.STOP_FREQ ; freq += FREQ_STEP ) {
        myChart.data.labels.push ( formatFrequencyString ( freq ) );
    }

    // Initialize all values of all graphs (except the scan graph) with lowest dBm value
    myChart.data.datasets[LINE_LIVE].data        = []; // Live scan
    myChart.data.datasets[LINE_RECOMMENDED].data = []; // Recommended
    myChart.data.datasets[LINE_FORBIDDEN].data   = []; // Forbidden
    myChart.data.datasets[LINE_CONGESTED].data   = []; // Congested
    myChart.data.datasets[LINE_GRIDS].data       = []; // Grids
    myChart.data.datasets[LINE_FORBIDDEN_MARKERS].data = []; // Forbidden start markers
    myChart.data.datasets[LINE_CONGEST_TRESH].data[0] = CONGESTION_LEVEL_DBM;
    myChart.data.datasets[LINE_CONGEST_TRESH].data[global.SWEEP_POINTS-1] = CONGESTION_LEVEL_DBM;

    for ( let i = 0 ; i < global.SWEEP_POINTS ; i++ ) {
        myChart.config.options.scales.xAxes[1].labels[i] = '';
        myChart.config.options.scales.xAxes[2].labels[i] = '';
        myChart.config.options.scales.xAxes[3].labels[i] = '';
    }

    setForbidden    ();
    setChannelGrids ();

    if ( FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] && chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset)
        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );

    myChart.update();
}

let tryPort = (index) => {
    return new Promise ( (resolve, reject) => {
        if ( index > globalPorts.length -1 ) {
            reject ( 'ERR_PORT_INVALID_INDEX' )
            return
        }

        log.info ( "=========================================================" )
        log.info ( `Trying port ${globalPorts[index].path} with baud rate ${baudRate} ...` );
        port = new SerialPort ({ path: globalPorts[index].path, baudRate : baudRate }, err => {
            if ( err ) {
                if ( err.toString().indexOf('Access denied') !== -1 ) { // If access denied error
                    showPopup (
                        'error',
                        'POPUP_CAT_CONNECTION_ISSUE',
                        "Access denied!",
                        `Got 'Access denied' on serial port! The application must be restarted!`,
                        ['Restart']
                    ).then ( result => {
                        popupCategory = ''
                        if ( result.isConfirmed ) {
                            restartApp()
                        }
                    })
// TODO: Show popup to restart the app in case of: "Error: Opening COM4: File not found"
                    log.error ( err )
                    reject ( 'ERR_PORT_ACCESS_DENIED' )
                    return
                }

                log.error ( err )
                reject ( err )
                return
            }

            log.info( `Successfully connected to ${globalPorts[index].path}!` )
            resolve ( 'SUCCESS' )
        })

        // Create a promise of write() function
        port.writePromise = async (data, type ) => {
            if ( port.isOpen ) {
                port.write (data, type, (err) => {
                    if (err) {
                        return Promise.reject(err);
                    }

                    return Promise.resolve();
                });
            } else {
                log.error ( `Tried to write the following data to port '${port.settings.path}', but the stream was already closed: '${data}'`)
            }
        }
    })
}

const portOpenCb = () => {
    switch ( SCAN_DEVICE ) {
        case 'RF_EXPLORER':
            scanDevice = new RFExplorer(port);

            if ( scanDevice ) {
                scanDevice.setHandler(data$)

                if ( dataSubscription ) {
                    dataSubscription.unsubscribe()
                }

                dataSubscription = data$.subscribe ( data => {
                    switch ( data[0].type ) {
                        case 'NAME':
                            if ( data[0].values.NAME === RFExplorer.NAME ) {
                                log.info ( `Stoping response check timer ${responseCheckTimer} ...` )
                                clearTimeout ( responseCheckTimer )
                                responseCheckTimer = null
                                log.info ( `Successfully detected '${data[0].values.NAME}' hardware!` )
                                if ( popupCategory === 'POPUP_CAT_CONNECTION_ISSUE' ) {
                                    popupCategory = ''
                                    Swal.close()
                                }
                                ipcRenderer.send('SET_MAIN_WINDOW_TITLE', `${RFExplorer.NAME} on ${globalPorts[portDetectionIndex].path}`)
                                return
                            }
                            break

                        case 'CONFIG_DATA':
                            global.START_FREQ = data[0].values.START_FREQ
                            global.STOP_FREQ = data[0].values.STOP_FREQ
                            FREQ_STEP = data[0].values.FREQ_STEP
                            global.SWEEP_POINTS = data[0].values.SWEEP_POINTS
                            MIN_FREQ = data[0].values.MIN_FREQ
                            MAX_FREQ = data[0].values.MAX_FREQ
                            MIN_SPAN = RFExplorer.MIN_SPAN
                            MAX_SPAN = data[0].values.MAX_SPAN

                            configStore.set ( 'start_freq', global.START_FREQ )
                            configStore.set ( 'stop_freq' , global.STOP_FREQ  )
                            configStore.set ( 'freq_step' , FREQ_STEP  )

                            if ( !RFExplorer.isValidFreqConfig ( data[0].values.START_FREQ, data[0].values.STOP_FREQ ) ) {
                                log.error ( `Invalid frequency range: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz!` )

                                showPopup(
                                    'warning',
                                    'POPUP_CAT_INVALID_FREQUENCY',
                                    "Invalid frequency range!",
                                    `The currently selected frequency range is not valid for device <b>${RFExplorer.NAME}</b>!` +
                                    `<br><br>Allowed range is: ${MIN_FREQ} - ${MAX_FREQ} Hz` +
                                    `<br><br>Current range is: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz`,
                                    ['Ok']
                                )
                                return
                            }

                            let band_details = ""

                            if ( !BAND_DETAILS )
                                band_details = "    |    Band: <NO BAND SELECTED>"
                            else 
                                band_details = "    |    Band: " + BAND_DETAILS + ""

                            let country_information = ""

                            if ( !COUNTRY_CODE || !COUNTRY_NAME)
                                country_information = "    |    Country: Germany (DE)"
                            else
                                country_information = "    |    Country: " + COUNTRY_NAME + " (" + COUNTRY_CODE + ")"

                            const sweep_points = "    |    Sweep points: " + global.SWEEP_POINTS

                            let label = "Range: " + formatFrequencyString(global.START_FREQ) + " - " + formatFrequencyString(global.STOP_FREQ) + " Hz    |    Span: " + formatFrequencyString(global.STOP_FREQ - global.START_FREQ) + " Hz" + country_information + band_details +  sweep_points

                            myChart.options.scales.xAxes[0].scaleLabel.labelString = label
                            configStore.set ( 'band_label' , label )
                            BAND_LABEL = label
                            updateChart ()
                            break

                        case 'SCAN_DATA': {
                            let val_changed = false

                            for ( let i = 0 ; i < data[0].values.length ; i++ ) {
                                let value = -( data[0].values[i].charCodeAt(0) / 2 )

                                if ( value < global.MIN_DBM)
                                    value = global.MIN_DBM

                                if ( value > myChart.data.datasets[LINE_LIVE].data[i] || myChart.data.datasets[LINE_LIVE].data[i] === undefined ) {
                                    myChart.data.datasets[LINE_LIVE].data[i] = value
                                    val_changed = true

                                    let congestedChannel = checkCongestion ( i, value )

                                    if ( congestedChannel ) {
                                        for ( let i = congestedChannel[0] ; i <= congestedChannel[1] ; i++ ) {
                                            myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined
                                            myChart.data.datasets[LINE_CONGESTED  ].data[i] = global.MAX_DBM
                                        }
                                    }
                                }
                            }
        
                            if ( val_changed ) {
                                myChart.update()
                            }
                        } break
                    }
                })

                // In case another timer is running stop it!
                if ( responseCheckTimer ) {
                    log.info ( `Stoping response check timer ${responseCheckTimer} ...` )
                    clearTimeout ( responseCheckTimer )
                    responseCheckTimer = null
                }

                responseCheckTimer = setTimeout ( () => {
                    log.info ( `Response check timer ${responseCheckTimer} expired!`)
                    responseCheckTimer = null
                    log.error ( `No or invalid response from '${RFExplorer.NAME}' on '${globalPorts[portDetectionIndex].path}'!`)
                    log.error ( `Make sure that no other serial USB device is connected to '${globalPorts[portDetectionIndex].path}!'`)

                    // If serial port was connected successfully but to a different device type
                    disconnectPort().then ( async err => {
                        if (err) {
                            log.error(err)
                            return
                        }

                        if ( COM_PORT === 'AUTO' ) {
                            portDetectionIndex++

                            if ( portDetectionIndex < globalPorts.length ) {
                                log.info ( `Now trying port with index ${portDetectionIndex}`)
                                connectDevice ( 'AUTO', false )
                            } else {
                                log.info ( `No more ports available!` )
                            }

                            if ( portDetectionIndex === globalPorts.length || COM_PORT !== 'AUTO' ) {
                                // No more ports available
                                showPopup (
                                    "error",
                                    'POPUP_CAT_CONNECTION_ISSUE',
                                    "No or invalid response from scan device!",
                                    `<b>${RFExplorer.NAME}</b> could not be found or identified properly on any of the available ports!` +
                                        `<br><br>Please choose the correct device type from the menu or connect the chosen device. If the correct` +
                                        ` device is already connected, please restart it and then click 'Reconnect'.`,
                                    ['Reconnect', 'Cancel']                                
                                ).then ( result => {
                                    if ( result.isConfirmed ) {
                                        popupCategory = ''
                                        connectDevice ( COM_PORT?COM_PORT:'AUTO', true )
                                    }
                                })
                            }
                        }
                    })
                }, SERIAL_RESPONSE_TIMEOUT)

                log.info ( `Started response check timer ${responseCheckTimer}` )
            } else {
                log.error ("Unable to instantiate class RFExplorer!")
            }
            break;

        case 'TINY_SA':
            scanDevice = new TinySA(port, data$);

            if ( scanDevice ) {
                scanDevice.setHandler()

                if ( dataSubscription ) {
                    dataSubscription.unsubscribe()
                }

                dataSubscription = data$.subscribe ( data => {
                    switch ( data[0].type ) {
                        case 'NAME':
                            if ( data[0].values.NAME === TinySA.NAME ) {
                                log.info ( `Stoping response check timer ${responseCheckTimer} ...` )
                                clearTimeout ( responseCheckTimer )
                                responseCheckTimer = null
                                log.info ( `Successfully detected '${data[0].values.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}' hardware!` )
                                if ( popupCategory === 'POPUP_CAT_CONNECTION_ISSUE' ) {
                                    popupCategory = ''
                                    Swal.close()
                                }
                                ipcRenderer.send('SET_MAIN_WINDOW_TITLE', `${TinySA.NAME} on ${globalPorts[portDetectionIndex].path}`)
                                return
                            }
                            break

                        case 'CONFIG_DATA':
                            global.START_FREQ = data[0].values.START_FREQ
                            global.STOP_FREQ = data[0].values.STOP_FREQ
                            FREQ_STEP = data[0].values.FREQ_STEP
                            MIN_FREQ = data[0].values.MIN_FREQ
                            MAX_FREQ = data[0].values.MAX_FREQ
                            MIN_SPAN = TinySA.MIN_SPAN
                            MAX_SPAN = data[0].values.MAX_SPAN

                            configStore.set ( 'start_freq', global.START_FREQ )
                            configStore.set ( 'stop_freq' , global.STOP_FREQ  )
                            configStore.set ( 'freq_step' , FREQ_STEP  )

                            if ( !TinySA.isValidFreqConfig ( data[0].values.START_FREQ, data[0].values.STOP_FREQ ) ) {
                                log.error ( `Invalid frequency range: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz!` )

                                showPopup(
                                    'warning',
                                    'POPUP_CAT_INVALID_FREQUENCY',
                                    "Invalid frequency range!",
                                    `The currently selected frequency range is not valid for device <b>${TinySA.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}</b>!` +
                                    `<br><br>Allowed range is: ${MIN_FREQ} - ${MAX_FREQ} Hz` +
                                    `<br><br>Current range is: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz`,
                                    ['Ok']
                                )
                                return
                            }

                            const range = "Range: " + formatFrequencyString(global.START_FREQ) + " - " + formatFrequencyString(global.STOP_FREQ) + " Hz"
                            const span  = "    |    Span: " + formatFrequencyString(global.STOP_FREQ - global.START_FREQ) + " Hz"

                            let country = ''

                            if ( !COUNTRY_CODE || !COUNTRY_NAME) {
                                country = "    |    Country: Germany (DE)"
                            } else {
                                country = "    |    Country: " + COUNTRY_NAME + " (" + COUNTRY_CODE + ")"
                            }

                            let band = ''
                            if ( !BAND_DETAILS ) {
                                band = "    |    Band: <NO BAND SELECTED>"
                            } else {
                                band = "    |    Band: " + BAND_DETAILS + ""
                            }

                            const sweep_points = "    |    Sweep points: " + global.SWEEP_POINTS

                            const label = range + span + country + band + sweep_points

                            myChart.options.scales.xAxes[0].scaleLabel.labelString = label
                            configStore.set ( 'band_label' , label )
                            BAND_LABEL = label
                            updateChart ()
                            break

                        case 'SCAN_DATA': {
                            let val_changed = false

                            for ( let i = 0 ; i < data[0].values.length ; i++ ) {
                                let value = -data[0].values[i]
    
                                if ( value < global.MIN_DBM)
                                    value = global.MIN_DBM
    
                                if ( value > myChart.data.datasets[LINE_LIVE].data[i] || myChart.data.datasets[LINE_LIVE].data[i] === undefined ) {
                                    myChart.data.datasets[LINE_LIVE].data[i] = value
                                    val_changed = true
    
                                    let congestedChannel = checkCongestion ( i, value )
    
                                    if ( congestedChannel ) {
                                        for ( let i = congestedChannel[0] ; i <= congestedChannel[1] ; i++ ) {
                                            myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined
                                            myChart.data.datasets[LINE_CONGESTED  ].data[i] = global.MAX_DBM
                                        }
                                    }
                                }
                            }
    
                            if ( val_changed ) {
                                myChart.update()
                            }
                        } break

                        case 'ERROR_RECEIVED_TRASH':
                            log.info ( `Stoping response check timer ${responseCheckTimer} ...` )
                            clearTimeout ( responseCheckTimer )
                            responseCheckTimer = null
                            disconnectPort().then ( () => connectDevice(COM_PORT?COM_PORT:'AUTO', true) )
                            return
                    }
                })

                // In case another timer is running stop it!
                if ( responseCheckTimer ) {
                    log.info ( `Stopped response check timer ${responseCheckTimer} ...` )
                    clearTimeout ( responseCheckTimer )
                    responseCheckTimer = null
                }

                responseCheckTimer = setTimeout ( () => {
                    log.info ( `Response check timer ${responseCheckTimer} expired!`)
                    responseCheckTimer = null
                    log.error ( `No or invalid response from '${TinySA.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}' on '${globalPorts[portDetectionIndex].path}'!`)
                    log.error ( `Make sure that no other serial USB device is connected to '${globalPorts[portDetectionIndex].path}'!`)
                    data$.next([{
                        type: 'ERROR_NO_RESPONSE',
                        status: 'ERROR'
                    }])

                    // If serial port was connected successfully but to a different device type, disconnect it
                    disconnectPort().then ( async err => {
                        if ( err ) {
                            log.error (err )
                            return
                        }

                        if ( COM_PORT === 'AUTO' ) {
                            portDetectionIndex++

                            if ( portDetectionIndex < globalPorts.length ) {
                                log.info ( `Now trying port with index ${portDetectionIndex}` )
                                connectDevice ( 'AUTO', false )
                            } else {
                                log.info ( `No more ports available!` )
                            }
                        } 
                        
                        if ( portDetectionIndex === globalPorts.length || COM_PORT !== 'AUTO' ) {
                            // No more ports available
                            showPopup (
                                "error",
                                'POPUP_CAT_CONNECTION_ISSUE',
                                "No or invalid response from scan device!",
                                `<b>${TinySA.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}</b> could not be found or identified properly on any of the available ports!` +
                                    `<br><br>Please choose the correct device type from the menu or connect the chosen device. If the correct` +
                                    ` device is already connected, please restart it and then click 'Reconnect'.`,
                                ['Reconnect', 'Cancel']
                            ).then ( result => {
                                if ( result.isConfirmed ) {
                                    popupCategory = ''
                                    portDetectionIndex = 0
                                    connectDevice ( COM_PORT?COM_PORT:'AUTO', true )
                                }
                            })
                        }
                    })
                }, SERIAL_RESPONSE_TIMEOUT )

                log.info ( `Started response check timer ${responseCheckTimer}` )
            } else {
                log.error ("Unable to instantiate class TinySA!")
            }
            break;

        default:
            log.error ( `Unknown scan device ${SCAN_DEVICE}` )
            scanDevice = null
    }
}

function showPortHwError ( msg ) {
    showPopup ('error', 'POPUP_CAT_CONNECTION_ISSUE', "Hardware error!", msg + `<br><ul style="text-align:left"><li>Make sure that the scan device is connected</li>` +
        `<li>Select the corresponding serial port (or leave default: \'Auto\')</li>`+
        `<li>If it still doesn\'t work please disconnect/power off the scan device, stop this tool, leave the scan device unpowered for approx 10s, then start the scan device and wait until its "pre-calibration" phase is over and it shows a graph on the display. Now start the software again!</li></ul>`,
        ['Retry', 'Cancel']
    ).then ( result => {
        if ( result.isConfirmed ) {
            connectDevice ( COM_PORT?COM_PORT:'AUTO', true )
        }
    })

    log.error ( msg )
}

function scanPorts() {
    return new Promise ((resolve, reject) => {
        SerialPort.list().then ( (ports, err) => {
//ports = ports.reverse()
            if ( err ) {
                showPortHwError ( err )
                reject ( err )
                return
            }

            if ( ports.length === 0 ) {
                showPortHwError ( "No serial ports detected!" )
                reject ( "ERROR_NO_PORTS" )
                return
            }

            globalPorts = ports
            log.info ( "The following ports were found:" )

            for ( const [ index, port ] of ports.entries()  ) {
                log.info ( `[${index}] ${port.friendlyName} (VendorID: ${port.vendorId}, ProductID: ${port.productId})`)
            }

            resolve ( ports )

            // Sending SET_PORT to update port list in menu
            ipcRenderer.send ( 'SET_PORT', { portPath : COM_PORT } )
        })
    })
}

function connectPort ( portIdentifier ) {
    return new Promise ( (resolve, reject) => {
        baudRate = getBaudrate()

        if ( baudRate === null ) {
            log.error ( `Unable to get default baudrate for device ${SCAN_DEVICE}!` )
            return reject('ERR_PORT_NO_BAUDRATE')
        }

        if ( typeof portIdentifier === 'number' ) { // Select port by array index
            log.info ( `Connecting to port with index ${portIdentifier}`)
            tryPort ( portIdentifier ).then ( () => {
                portOpenCb()
                return resolve ()
            }).catch ( err => {
                return reject ( err )
            })
        } else if ( typeof portIdentifier === 'string') {
            if ( portIdentifier === 'AUTO' ) { // Automatic port selection
                log.info ( `Auto-detecting port ...`)

                tryPort ( portDetectionIndex ).then ( () => {
                    portOpenCb ()
                    return resolve()
                }).catch ( err => {
                    portDetectionIndex++

                    if ( portDetectionIndex < globalPorts.length ) {
                        connectPort ( 'AUTO' )
                            .then ( () => resolve() )
                            .catch( () => reject () )
                    } else {
                        reject ('ERR_PORT_DEVICE_NOT_FOUND')
                    }
                })
            } else { // Select port by port name string
                log.info ( `Connecting to dedicated port '${COM_PORT}'`)

                for ( const [index, port] of globalPorts.entries() ) {
                    if ( port.path === COM_PORT) {
                        tryPort(index).then ( () => {
                            portOpenCb()
                            return resolve()
                        }).catch ( err => {
                            return reject (err)
                        })
                    }
                }    
            }
        }
    })
}

function disconnectPort () {
    return new Promise ((resolve, reject) => {
        if ( port && port.isOpen) {
            log.info ( "Closing existing connection to current scan device ..." )
            port.close(() => {
                port = null
                log.info ( "Port closed successfully.")
                resolve()
            })
        } else {
            resolve()
        }
    })
}

function checkCongestion ( pos, val ) {
    for ( let i = 0 ; i < chDispValShadowArr.length ; i++ ) {
        let low_pos       = chDispValShadowArr[i][0];
        let high_pos      = chDispValShadowArr[i][1];
        let oldCongestVal = chDispValShadowArr[i][2];

        if ( pos >= low_pos && pos <= high_pos && val >= CONGESTION_LEVEL_DBM ) {
            chDispValShadowArr[i][2] = true;

            if ( !oldCongestVal )
                return [ low_pos, high_pos ];
        }
    }

    return false;
}

ipcRenderer.on ( 'CHANGE_BAND', (event, message) => {
    setBand ( message.start_freq * 1000, message.stop_freq * 1000, message.details )
});

function setBand ( startFreq, stopFreq, details) {
    global.START_FREQ = LAST_START_FREQ = startFreq;
    global.STOP_FREQ  = LAST_STOP_FREQ  = stopFreq;

    configStore.set ( 'last_start_freq', LAST_START_FREQ );
    configStore.set ( 'last_stop_freq' , LAST_STOP_FREQ  );
    configStore.set ( 'band_details'   , details );

    BAND_DETAILS = details;
    scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );
}

ipcRenderer.on ( 'SET_VENDOR_4_ANALYSIS', (event, message) => {
    switch ( message.vendor ) {
        case 'NON': // No vendor selected
            VENDOR_ID = 'NON';

            for ( let i = 0 ; i < global.SWEEP_POINTS ; i++ )
                myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined;

            myChart.update();
            break;

        case 'SEN': // Sennheiser
            VENDOR_ID = 'SEN';
            break;

        case 'SHU': // Shure
            VENDOR_ID = 'SHU';
            break;
        
        default:
            log.info ( "Vendor missing in message!")
    }
});

ipcRenderer.on ( 'SET_CHAN_PRESET', (event, message) => {
    let preset_arr = message.preset.split ( '_' );
    chPreset_Vendor = preset_arr[0];
    chPreset_Band   = preset_arr[1];
    chPreset_Series = preset_arr[2];
    chPreset_Preset = preset_arr[3];

    configStore.set ( 'chPreset.vendor', chPreset_Vendor );
    configStore.set ( 'chPreset.band'  , chPreset_Band   );
    configStore.set ( 'chPreset.series', chPreset_Series );
    configStore.set ( 'chPreset.preset', chPreset_Preset );

    //myChart.config.options.scales.xAxes[2].labels = [];
    setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
    myChart.update();
});

ipcRenderer.on ( 'SET_COUNTRY', async (event, message) => {
    if ( !message.country_code ) {
        log.info ( "Empty or invalid country code!" )
        await showPopup(
            'error',
            'POPUP_CAT_INVALID_COUNTRY',
            "Empty or invalid country code!",
            `country_codes.json might be corrupted!`,
            ['OK']
        )
        return;
    }

    if ( !fs.existsSync ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + message.country_code + '.json' ) ) {
        await showPopup(
            'warning',
            'POPUP_CAT_INVALID_COUNTRY',
            "Country not available!",
            'No frequency related information available for ' + message.country_label +' (' + message.country_code + ')' + '! Falling back to Germany (DE)',
            ['Ok']
        )

        COUNTRY_CODE = 'DE';
        COUNTRY_NAME = 'Germany';
        ipcRenderer.send ('SET_COUNTRY', { country_code : COUNTRY_CODE });

        log.info ( "No frequency related information available for country code: '" + message.country_code +"' => Falling back to: 'DE'");
    } else {
        COUNTRY_CODE = message.country_code;
        COUNTRY_NAME = message.country_label;
    }
    
    configStore.set ( 'country_code', COUNTRY_CODE );
    configStore.set ( 'country_name', COUNTRY_NAME );
    FREQ_FORBIDDEN = require ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + COUNTRY_CODE + '.json');

    // Restart app
    restartApp()

    if ( fs.existsSync ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json' ) )
        FREQ_GRIDS = require ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json');
    else
        FREQ_GRIDS = undefined;

    updateChart();
    scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS ); // Need this to refresh country name on x-axis
});

ipcRenderer.on ( 'SET_PORT', async (event, message) => {
    if ( Array.isArray(message) ) // If this is an array => Auto mode was chosen
        COM_PORT = 'AUTO';
    else
        COM_PORT = message.port;

    log.info ( `User has changed port to: '${COM_PORT}'`)
    configStore.set ( 'com_port', COM_PORT )
    ipcRenderer.send ('SET_PORT', { portPath : COM_PORT });
    scanDevice.scanningActive = false
    log.info ( "Periodic scan is now disabled" )
    log.info ( "Wait for lastly requested scan data to be received before continuing ..." )
    await firstValueFrom(data$) // Wait for last scan data to arrive
    log.info ( "Reconnecting port ..." )
    disconnectPort().then ( () => connectDevice ( COM_PORT, false ) )
})

ipcRenderer.on ( 'EXPORT_WW6_IAS_CSV', (event, message) => {
    let i = 0;

    for ( var freq = global.START_FREQ; freq <= global.STOP_FREQ ; freq += FREQ_STEP ) {
        const freqStr = Math.round(freq/1000).toString()
        const mHz = freqStr.slice(0, -3)
        const kHz = freqStr.substr(-3, 3).padEnd(3, '0')
        fs.appendFileSync ( message.filename, mHz + '.' + kHz + ", " + myChart.data.datasets[LINE_LIVE].data[i] + "\n", 'utf-8');
        i++;
    }
});

ipcRenderer.on ( 'RESET_PEAK', (event, message) => {
    log.info("Peak values have been reset")
    for ( let i = 0 ; i < global.SWEEP_POINTS ; i++ )
        myChart.data.datasets[LINE_LIVE].data[i] = undefined;

    myChart.update();
});

ipcRenderer.on ( 'RESET_SETTINGS', (event, message) => {
    showPopup(
        "question",
        'POPUP_CAT_SETTINGS',
        "Reset application settings?",
        'All settings you made will be lost!',
        ['Ok', 'Cancel']
    ).then ( result => {
        if (result.isConfirmed) {
            log.info ( "User has resetted application settings")
            configStore.clear()
            restartApp()
        }
    })
})

ipcRenderer.on ( 'MX_LINUX_WORKAROUND', (event, message) => {
    if ( message.enabled ) {
        log.info("Enabled workaround for MX Linux")
        configStore.set( 'mx_linux_workaround_enabled', true)
        global.MX_LINUX_WORKAROUND = true
        showPopup(
            'info',
            'POPUP_CAT_GENERAL',
            "Information",
            'This enables a workaround which prevents the app from hanging on certain MX Linux systems. Enabling it, will make it work on MX Linux, but also slows down zooming and moving through the spectrum.',
            ['Ok']
        )
    } else {
        log.info("Disabled workaround for MX Linux")
        configStore.set( 'mx_linux_workaround_enabled', false)
        global.MX_LINUX_WORKAROUND = false
    }
});

ipcRenderer.on ( 'DARK_MODE', (event, message) => {
    log.error(message)
        if ( message.enabled ) {
            log.info("Enabled dark mode")
            configStore.set('dark_mode', true)
        } else {
            log.info("Disabled dark mode")
            configStore.set('dark_mode', false)
        }

        showPopup('warning', 'RESTART_REQUIRED', 'Restart', 'App must be restarted for changes to take effect', ['Ok', 'Cancel']).then (result => {
            popupCategory = ''
            if ( result.isConfirmed ) {
                restartApp()
            }
        })
})

ipcRenderer.on ( 'SET_SCAN_DEVICE', async (event, message) => {
    log.info ( `User selected device '${message.scanDevice}'` )

    await disconnectPort( err => {
        port = null;

        if (err) {
            log.error(err)
            return
        }
    })

    switch ( message.scanDevice ) {
        case 'RF_EXPLORER':
            configStore.set ('scan_device', 'RF_EXPLORER')
            SCAN_DEVICE = message.scanDevice;
            connectDevice ( COM_PORT?COM_PORT:'AUTO', true )
            break;

        case 'TINY_SA':
            configStore.set ('scan_device', 'TINY_SA')
            SCAN_DEVICE = message.scanDevice;
            connectDevice ( COM_PORT?COM_PORT:'AUTO', true )
            break;

        default: log.error (`Unknown device: ${message.scanDevice}`);
    }
})

ipcRenderer.on ( 'DEVICE_SETTINGS', async (event, message) => {
    if ( scanDevice instanceof RFExplorer && scanDevice.constructor.MODEL === 'BASIC' ) {
        showPopup (
            'warning',
            'POPUP_CAT_SETTINGS',
            "No settings available",
            "This device does not have configurable settings!",
            ['Ok']
        )
    } else if (
        (scanDevice instanceof RFExplorer && scanDevice.constructor.MODEL === 'PLUS') ||
        scanDevice instanceof TinySA
    ) {
        Swal.fire({
            title: "Enter number of sweep points",
            html:'<p style="font-family: arial">Please enter a value between ' + scanDevice.getMinSweepPoints() + ' and ' + scanDevice.getMaxSweepPoints() + '</p>' +
            '<div><h2 class="swal2-title sweetalert2-title" style="display: inline; margin-left: 0;">Sweep points</h2><input id="swal-input" class="swal2-input"></div>',
            width: '600px',
            showCancelButton: true,
            confirmButtonText: "Ok",
            confirmButtonColor: "#0099ff",
            stopKeydownPropagation: false,
            customClass: {
                title: 'sweetalert2-title',
                validationMessage: 'sweetalert2-validation-message'
            },
            preConfirm: function () {
                return new Promise(function (resolve) {
                    resolve(document.getElementById('swal-input').value)
                })
            },
            inputValidator: value => {
                return new Promise( resolve => {
                    if ( !isNaN(value) ) {
                        resolve ()
                    } else {
                        resolve ( "Invalid number!");
                    }
                });
            }
        }).then ( result => {
            curKeyInputTarget = '';

            if (result.isConfirmed) {
                if ( scanDevice instanceof RFExplorer && scanDevice.constructor.MODEL === 'PLUS' ) {
                    global.SWEEP_POINTS = parseInt(result.value)
                    configStore.set ( 'sweep_points', global.SWEEP_POINTS )
                    scanDevice.setSweepPoints ( parseInt(global.SWEEP_POINTS) ).then (() => {
                        // Need to set frequency configuration here again, otherwise frequency range moves for unknown reason
                        scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );
                    });
                } else if ( scanDevice instanceof TinySA ) {
                    global.SWEEP_POINTS = result.value
                    log.info ( "Setting number of sweep points to: " + global.SWEEP_POINTS )
                    configStore.set ( 'sweep_points', global.SWEEP_POINTS )
                    scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );   
                } else {
                    log.error ( `Unable to set sweep points! Unknown device: ${scanDevice.constructor.NAME} ${scanDevice.constructor.HW_TYPE} ${scanDevice.constructor.MODEL}` )
                }
            }
        })

        curKeyInputTarget = keyInputTargets.SWEEP_POINT_SETTINGS;
        setTimeout(()=>{
            document.getElementsByClassName('swal2-confirm')[0].disabled = true
            document.getElementById('swal-input').focus()
        }, 200);
    } else {
        log.error ( `No device settings available for device: ${scanDevice.constructor.NAME}, ${scanDevice.constructor.HW_TYPE}, ${scanDevice.constructor.MODEL}`)
    }
})

ipcRenderer.on ( 'SHOW_MANUAL_BAND_SETTINGS', async (event, message) => {
    showManualBandSettings()
})

ipcRenderer.on ( 'SAVE_TO_HOTKEY', async (event, message) => {
    saveToHotkey ( message.hotkey )
})

function saveToHotkey (hotkey) {
    configStore.set ( `hotkeys.hotkey_${hotkey}`, {
        band_label: BAND_LABEL,
        band_details: BAND_DETAILS ,
        start_freq: global.START_FREQ,
        stop_freq: global.STOP_FREQ
    });
}

function showManualBandSettings () {
    log.info ( "Showing manual frequency band settings" )
    Swal.fire({
        title: "Manual frequency input",
        html:'<p style="font-family: arial">Please enter a valid frequency range. The frequency values can contain a comma or a dot. You can also specify international SI units like "k", "M", "G" (all case insensitive). Adding "Hz" is also allowed e.g. "Hz" or "kHz" or "MHz" etc. If no unit is given MHz is assumed!</p>' +
            '<div><h2 class="swal2-title sweetalert2-title" style="display: inline; margin-left: 0;">Start</h2><input id="swal-input1" class="swal2-input"></div>' +
            '<div><h2 class="swal2-title sweetalert2-title" style="display: inline; margin-left: 0;">Stop</h2><input id="swal-input2" class="swal2-input"></div>',
        preConfirm: function () {
            return new Promise(function (resolve) {
                resolve([
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value,
                ])
            })
        },
        stopKeydownPropagation: false,
        showCancelButton: true,
        confirmButtonText: "Ok",
        confirmButtonColor: "#0099ff",
        customClass: {
            title: 'sweetalert2-title',
            validationMessage: 'sweetalert2-validation-message'
        }
    }).then ( result => {
        curKeyInputTarget = '';

        if ( result.isConfirmed ) {
            const startFreq = normalizeFreqString(result.value[0])
            const stopFreq = normalizeFreqString(result.value[1])
            let isValidFreqConfig = false;

            if ( startFreq === null || stopFreq === null ) {
                return
            }

            switch ( SCAN_DEVICE ) {
                case 'RF_EXPLORER':
                    isValidFreqConfig = RFExplorer.isValidFreqConfig ( startFreq, stopFreq )
                    break;
                case 'TINY_SA':
                    isValidFreqConfig = TinySA.isValidFreqConfig( startFreq, stopFreq )
                    break;
            }

            if ( !isValidFreqConfig ) {
                return
            }

            log.info ( "Setting start/stop frequency to: " + startFreq + ' / ' + stopFreq )
            setBand ( startFreq, stopFreq, "Manual freq. range" )
        }
    })

    curKeyInputTarget = keyInputTargets.MANUAL_BAND_SETTINGS;
    setTimeout(()=>{
        document.getElementsByClassName('swal2-confirm')[0].disabled = true
        document.getElementById('swal-input1').focus()
    }, 200);
}

// Return frequency in Hz
function normalizeFreqString (freqStr) {
    if ( !freqStr ) {
        return false
    }

    freqStr = freqStr.replace(/,/, '.') // parseFloat() does not accept comma, so replace it with dot

    if ( isNaN(freqStr) ) {
        if ((/^\d+\s*'Hz$/i).test(freqStr)) { // Check if is number only. That means Hz
            return parseInt(freqStr.match(/\d+/g))
        } else if ((/^\d+[.,]?\d*\s*(?:k|kHz)$/i).test(freqStr)) { // Check if is kHz
            freqStr = freqStr.replace(/,/, '.') // parseFloat() does not accept comma, so replace it with dot
            return parseFloat(freqStr.match(/\d+[.]?\d*/g)) * 1000
        } else if ((/^\d+[.,]?\d*\s*(?:M|MHz)$/i).test(freqStr)) { // Check if is MHz
            freqStr = freqStr.replace(/,/, '.') // parseFloat() does not accept comma, so replace it with dot
            return parseFloat(freqStr.match(/\d+[.]?\d*/g)) * 1000000
        } else if ((/^\d+[.,]?\d*\s*(?:G|GHz)$/i).test(freqStr)) { // Check if is GHz
            freqStr = freqStr.replace(/,/, '.') // parseFloat() does not accept comma, so replace it with dot
            return parseFloat(freqStr.match(/\d+[.]?\d*/g)) * 1000000000
        } else { // Not a number and has no valid units attached
            return false
        }
    } else {
        return ( parseFloat(freqStr) * 1000000) // If no unit is given MHz is assumed
    }
}

function getFreqFromPercent (percent) {
    return Math.round ( ((global.STOP_FREQ - global.START_FREQ) / 100) * percent );
}

function zoom ( deltaPercent ) { // delta deltaPercent
    const deltaFreq = getFreqFromPercent ( Math.abs(deltaPercent) )

    if ( deltaPercent < 0 ) { // zoom out
        let isMinimum = false
        let isMaximum = false

        log.info ( `Zooming OUT to ${Math.abs(deltaPercent) * 2 + 100}% of current view ...` )
        log.info ( `    Current frequency range: ${global.START_FREQ} - ${global.STOP_FREQ} Hz` )

        if ( global.START_FREQ - deltaFreq < MIN_FREQ ) {
            log.info ( `New start frequency exceeds minimum of ${MIN_FREQ}. Thus setting it to ${MIN_FREQ}!` )
            global.START_FREQ = MIN_FREQ
            isMinimum = true
        } else {
            global.START_FREQ = global.START_FREQ - deltaFreq
        }

        if ( global.STOP_FREQ + deltaFreq > MAX_FREQ ) {
            log.info ( `New stop frequency exceeds maximum of ${MAX_FREQ}. Thus setting it to ${MAX_FREQ}!` )
            global.STOP_FREQ = MAX_FREQ
            isMaximum = true
        } else {
            global.STOP_FREQ = global.STOP_FREQ + deltaFreq
        }

        let tmpSpan = global.STOP_FREQ - global.START_FREQ

        if ( tmpSpan > MAX_SPAN ) {
            log.info ( `Selected span of ${tmpSpan} would exceed maximum span of ${MAX_SPAN}! Aligning zoom to max span value ${MAX_SPAN}.` )
            let fill = Math.round ( ((global.STOP_FREQ - global.START_FREQ) - MAX_SPAN) / 2 )

            if ( isMinimum ) {
                global.STOP_FREQ = global.START_FREQ + MAX_SPAN
            } else if ( isMaximum ) {
                global.START_FREQ = global.STOP_FREQ - MAX_SPAN
            } else {
                global.START_FREQ -= fill
                global.STOP_FREQ  += fill    
            }
        }
    } else { // zoom in
        log.info ( `Zooming IN to ${100 - Math.abs(deltaPercent) * 2}% of current view ...` )
        log.info ( `    Current frequency range: ${global.START_FREQ} - ${global.STOP_FREQ} Hz` )

        // If smaller than minimal frequency span
        if ( (global.STOP_FREQ - deltaFreq) - (global.START_FREQ + deltaFreq) < MIN_SPAN ) {
            log.info ( `Selected span of ${global.STOP_FREQ - global.START_FREQ} is smaller than ${MIN_SPAN}! Aligning zoom to min span value ${MIN_SPAN}.` )
            let fill = Math.floor ( ((global.STOP_FREQ - global.START_FREQ) - MIN_SPAN) / 2 )
            global.STOP_FREQ -= fill
            global.START_FREQ += fill
        }

        // If smaller than minimum number of sweep points
        if ( global.STOP_FREQ - global.START_FREQ < global.SWEEP_POINTS ) {
            log.info ( `Selected span of ${global.STOP_FREQ - global.START_FREQ} is smaller than number of sweep points ${global.SWEEP_POINTS}! Aligning zoom to number of sweep points ${global.SWEEP_POINTS}.` )
            let fill = Math.floor ( ((global.STOP_FREQ - global.START_FREQ) - MIN_SPAN) / 2 )
            global.START_FREQ += fill;
            global.STOP_FREQ  -= fill;
        } else {
            global.START_FREQ += deltaFreq;
            global.STOP_FREQ  -= deltaFreq;
        }
    }

    log.info ( `    New frequency range:     ${global.START_FREQ} - ${global.STOP_FREQ} Hz` )
}

function move (deltaPercent) {
    log.info ( `Move frequency band to ${deltaPercent < 0 ? 'LEFT' : 'RIGHT'} by ${Math.abs(deltaPercent)}% of span` )
    log.info ( `    Current frequency range: ${global.START_FREQ} - ${global.STOP_FREQ} Hz` )
    const deltaFreq = getFreqFromPercent(Math.abs(deltaPercent))

    if ( deltaPercent < 0 ) {
        if ( global.START_FREQ - deltaFreq < MIN_FREQ ) {
            log.info ( `New start frequency ${global.START_FREQ - deltaFreq} would exceed minimum value of ${MIN_FREQ}. Moving to ${MIN_FREQ} instead!`)
            global.STOP_FREQ  = global.STOP_FREQ - (global.START_FREQ - MIN_FREQ)
            global.START_FREQ = MIN_FREQ
        } else {
            global.START_FREQ -= deltaFreq
            global.STOP_FREQ  -= deltaFreq
        }
    } else {
        if ( global.STOP_FREQ + deltaFreq > MAX_FREQ ) {
            log.info ( `New stop frequency ${global.STOP_FREQ + deltaFreq} would exceed maximum value of ${MAX_FREQ}. Moving to ${MAX_FREQ} instead!`)
            global.START_FREQ = global.START_FREQ + (MAX_FREQ - global.STOP_FREQ)
            global.STOP_FREQ  = MAX_FREQ
        } else {
            global.START_FREQ += deltaFreq
            global.STOP_FREQ  += deltaFreq
        }
    }
    log.info ( `    New frequency range:     ${global.START_FREQ} - ${global.STOP_FREQ} Hz` )
}

document.addEventListener ( "wheel", async e => {
    // Block calls while command is in progrees. Also there is a special case when
    // tilting the mouse wheel. Then the first time after app start, it fires twice
    // this causes a race condition. Thus block subsequent calls until current call
    // has executed completely.
    if (isExecuting) {
        return
    }

    isExecuting = true

    try {
        if ( e.deltaY > 0 ) { // Zoom out
            if ( !e.shiftKey && !e.ctrlKey ) {
                zoom(-10) // Zoom out to 120 % by adding 10% of current span on both sides ( = 20% )
            } else if ( e.shiftKey && !e.ctrlKey ) {
                zoom(-50) // Zoom out to 200% by adding 50% of span on both sides ( = 100% )
            }

            BAND_DETAILS = "";
        } else if ( e.deltaY < 0 ) { // Zoom in
            if ( !e.shiftKey && !e.ctrlKey ) {
                zoom(10) // Zoom in by removing 10% of span on both sides ( = 20% )
            } else if ( e.shiftKey && !e.ctrlKey ) {
                zoom(25) // Zoom in by removing 25% of span on both sides ( = 50% )
            }
        } else if ( e.deltaX < 0 ) { // Move left
            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks down
                if ( chPreset_Preset > 1 ) {
                    chPreset_Preset--;
                    log.info (`Toggle vendor specific channel presets/banks down. Now is: ${chPreset_Preset}`)

                    if ( FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] && chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset)
                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                    myChart.update();
                } else {
                    log.error(`Unable to toggle vendor specific channel presets/banks down! Already on preset ${chPreset_Preset}!`)
                }
                return;
            } else if ( !e.shiftKey && !e.ctrlKey ) {
                move(-10); // Move frequency band to LEFT by 10% of span
            } else if ( e.shiftKey && !e.ctrlKey ) {
                move(-50); // Move frequency band to LEFT by 50% of span
            }
        } else if ( e.deltaX > 0 ) { // Move right
            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks up
                if ( chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset && FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] ) {
                    if ( chPreset_Preset <  FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length ) {
                        chPreset_Preset++;
                        log.info (`Toggle vendor specific channel presets/banks up. Now is: ${chPreset_Preset}`)
                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                        myChart.update();
                    } else {
                        log.error(`Unable to toggle vendor specific channel presets/banks up! Only ${FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length} presets available!`)
                    }
                } else {
                    log.error("Unable to toggle vendor specific channel presets/banks up!")
                    log.error(`chPreset_Vendor: ${chPreset_Vendor}`)
                    log.error(`chPreset_Band: ${chPreset_Band}`)
                    log.error(`chPreset_Series: ${chPreset_Series}`)
                    log.error(`chPreset_Preset: ${chPreset_Preset}`)
                    log.error(`FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series]: ${FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series]}`)
                }
                return;
            } else if ( !e.shiftKey && !e.ctrlKey ) {
                move(10); // Move frequency band to RIGHT by 10% of span
            } else if ( e.shiftKey && !e.ctrlKey ) {
                move(50); // Move frequency band to RIGHT by 50% of span
            }
        }

        BAND_DETAILS = "";
        await scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );
    } finally {
        isExecuting = false;
    }
});

document.addEventListener ( "keydown", async e => {
    // Block calls while command is in progres.
    if (isExecuting) {
        return
    }

    isExecuting = true

    try {
        switch ( curKeyInputTarget ) {
            // Manual frequency band settings modal
            case keyInputTargets.MANUAL_BAND_SETTINGS:
            case keyInputTargets.SWEEP_POINT_SETTINGS:
                switch ( e.key ) {
                    case 'Enter':
                        if ( formValid ) {
                            Swal.clickConfirm();
                        }
                        break;
                }
                return;

            // Main window
            default:
                // Get last character of the key code to check if it is a number key
                // In that case the key code looks like "Digit1" or "Numpad1"
                let lastChar = e.code.charAt (e.code.length - 1)

                // First check if a hotkey was pressed
                if ( !isNaN(parseInt(lastChar)) && (e.code.indexOf('Numpad') > -1 || e.code.indexOf('Digit') > -1) ) {
                    let numberKey = parseInt(lastChar)

                    if ( numberKey >= 1 && numberKey <= 9 ) {
                        if ( !e.shiftKey ) { // load hotkey data
                            let bandData = configStore.get(`hotkeys.hotkey_${numberKey}`)

                            if ( bandData ) {
                                log.info( `Loaded data from hotkey '${e.code}':`)
                                log.info( `    Band Label:   ${bandData.band_label}`)
                                log.info( `    Band Details: ${bandData.band_details}`)
                                log.info( `    Start Freq.:  ${bandData.start_freq}`)
                                log.info( `    Stop Freq.:   ${bandData.stop_freq}`)
                                BAND_LABEL = bandData.band_label
                                BAND_DETAILS = bandData.band_details
                                global.START_FREQ = bandData.start_freq;
                                global.STOP_FREQ  = bandData.stop_freq;
                            } else {
                                log.info( `No data stored for hotkey '${e.code}'!`)
                                return
                            }
                        } else { // save data to hotkey
                            saveToHotkey ( numberKey );
                        }
                    }
                } else {
                    switch ( e.key ) {
                        case 'ArrowLeft': // Arrow left
                            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks down
                                if ( chPreset_Preset > 1 ) {
                                    chPreset_Preset--;
                                    log.info (`Toggle vendor specific channel presets/banks down. Now is: ${chPreset_Preset}`)

                                    if ( FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] && chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset)
                                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                                    myChart.update();
                                } else {
                                    log.error(`Unable to toggle vendor specific channel presets/banks down! Already on preset ${chPreset_Preset}!`)
                                }
                                return;
                            } else if ( e.shiftKey && !e.ctrlKey ) {
                                move(-50); // Move frequency band to LEFT by 50% of span
                            } else if ( !e.shiftKey && !e.ctrlKey ) {
                                move(-10); // Move frequency band to LEFT by 10% of span
                            }

                            BAND_DETAILS = "";
                            break;

                        case 'ArrowRight': // Arrow right
                            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks up
                                if ( chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset && FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] ) {
                                    if ( chPreset_Preset <  FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length ) {
                                        chPreset_Preset++;
                                        log.info (`Toggle vendor specific channel presets/banks up. Now is: ${chPreset_Preset}`)
                                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                                        myChart.update();
                                    } else {
                                        log.error(`Unable to toggle vendor specific channel presets/banks up! Only ${FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length} presets available!`)
                                    }
                                } else {
                                    log.error("Unable to toggle vendor specific channel presets/banks up!")
                                    log.error(`chPreset_Vendor: ${chPreset_Vendor}`)
                                    log.error(`chPreset_Band: ${chPreset_Band}`)
                                    log.error(`chPreset_Series: ${chPreset_Series}`)
                                    log.error(`chPreset_Preset: ${chPreset_Preset}`)
                                    log.error(`FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series]: ${FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series]}`)
                                }
                                return;
                            } else if ( e.shiftKey && !e.ctrlKey ) {
                                move(50); // Move frequency band to RIGHT by 50% of span
                            } else if ( !e.shiftKey && !e.ctrlKey ) {
                                move(10); // Move frequency band to RIGHT by 10% of span
                            }

                            BAND_DETAILS = "";
                            break;

                        case 'ArrowUp': // Arrow up - Zoom in
                            if ( !e.shiftKey ) {
                                zoom(10); // Zoom in by removing 10% of span on both sides ( = 20% )
                            } else {
                                zoom(25); // Zoom in by removing 25% of span on both sides ( = 50% )
                            }

                            if ( global.STOP_FREQ - global.START_FREQ < global.SWEEP_POINTS ) {
                                return;
                            }

                            BAND_DETAILS = "";
                            break;

                        case 'ArrowDown': // Arrow down - Zoom out
                            if ( !e.shiftKey ) { 
                                zoom(-10); // Zoom out to 120% by adding 10% of span on both sides ( = 20% )
                            } else {
                                zoom(-50); // Zoom out by adding 50% of span on both sides ( = 100% )
                            }

                            BAND_DETAILS = "";
                            break;

                        case 'r': // Reset peak
                            log.info ("Resetting peak values ...");

                            for ( let i = 0 ; i < global.SWEEP_POINTS ; i++ )
                                myChart.data.datasets[LINE_LIVE].data[i] = undefined;

                            myChart.update();
                            break;

                        case 'b': // Go back to last vendor band
                            global.START_FREQ = LAST_START_FREQ;
                            global.STOP_FREQ    = LAST_STOP_FREQ;
                            BAND_DETAILS = configStore.get('band_details');
                            break;

                        case 'f': // Set manual frequency range (band)
                            showManualBandSettings()
                            break;

                        default:
                            return
                    }
                }
        }

        await scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );
    } finally {
        isExecuting = false
    }
});

// Need to use 'keyup' event for live input validation because 'keydown' fires before changes were made to the input element!
document.addEventListener ( "keyup", async e => {
    switch ( curKeyInputTarget ) {
        case keyInputTargets.MANUAL_BAND_SETTINGS: {
            let input1Valid = false
            let input2Valid = false
            formValid = false

            if (normalizeFreqString(document.getElementById('swal-input1').value) === false) {
                document.getElementById('swal-input1').style.backgroundColor = "#ffb6b6"
                input1Valid = false
            } else {
                document.getElementById('swal-input1').style.backgroundColor = "unset"
                input1Valid = true
            }

            if (normalizeFreqString(document.getElementById('swal-input2').value) === false) {
                document.getElementById('swal-input2').style.backgroundColor = "#ffb6b6"
                input2Valid = false
            } else {
                document.getElementById('swal-input2').style.backgroundColor = "unset"
                input2Valid = true
            }

            if ( input1Valid && input2Valid ) {
                formValid = true
                document.getElementsByClassName('swal2-confirm')[0].disabled = false
            } else {
                document.getElementsByClassName('swal2-confirm')[0].disabled = true
            }
        } break;

        case keyInputTargets.SWEEP_POINT_SETTINGS: {
            formValid = false

            if ( !scanDevice.isValidSweepPointRange(document.getElementById('swal-input').value) ) {
                document.getElementById('swal-input').style.backgroundColor = "#ffb6b6"
                document.getElementsByClassName('swal2-confirm')[0].disabled = true
            } else {
                formValid = true
                document.getElementById('swal-input').style.backgroundColor = "unset"
                document.getElementsByClassName('swal2-confirm')[0].disabled = false
            }
        } break;

        default:
    }
})

function getBaudrate () {
    switch ( SCAN_DEVICE ) {
        case 'RF_EXPLORER': return RFExplorer.BAUD_RATE;
        case 'TINY_SA'    : return TinySA.BAUD_RATE;
        default:
            log.error (`Cannot get baudrate for unknown device: ${SCAN_DEVICE}`);
            return null;
    }
}

function restartApp () {
    app.relaunch ()
    app.exit (0)
}
