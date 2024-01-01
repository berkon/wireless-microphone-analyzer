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
var { take, filter, Subject, firstValueFrom } = require('rxjs');
const configStore     = new ConfigStore ( Pkg.name )

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
var MAX_SPAN     = undefined
global.SWEEP_POINTS = 100 // default value
var COM_PORT = undefined
var VENDOR_ID    = 'NON'

const chartColors = {
	RED    : 'rgb(255, 99 , 132)',
	ORANGE : 'rgb(255, 159, 64 )',
	YELLOW : 'rgb(255, 205, 86 )',
	GREEN  : 'rgb(75 , 222, 192)',
	BLUE   : 'rgb(54 , 162, 235)',
	PURPLE : 'rgb(153, 102, 255)',
	GREY   : 'rgb(201, 203, 207)'
};

const RECOMMENDED_CHANNELS_COLOR = chartColors.GREEN
const FORBIDDEN_COLOR            = chartColors.RED
const SCAN_COLOR                 = chartColors.PURPLE
const CONGESTED_COLOR            = chartColors.ORANGE
const CHAN_GRID_COLOR            = chartColors.GREY

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
            console.log ( "Unknown version of saved data!" )
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

if ( !global.MX_LINUX_WORKAROUND ) {
    configStore.set('mx_linux_workaround_enabled', false )
    global.MX_LINUX_WORKAROUND = false
}

console.log ( "MX Linux workaround is " + (global.MX_LINUX_WORKAROUND ? "enabled" : "disabled"))
ipcRenderer.send ('MX_LINUX_WORKAROUND', { checked : global.MX_LINUX_WORKAROUND });

var ctx = document.getElementById("graph2d").getContext('2d');
var myChart = null

if ( VIS_MANUF_CHAN === undefined ) VIS_MANUF_CHAN = true;
if ( VIS_FORBIDDEN  === undefined ) VIS_FORBIDDEN  = true;
if ( VIS_CONGEST    === undefined ) VIS_CONGEST    = true;
if ( VIS_TV_CHAN    === undefined ) VIS_TV_CHAN    = true;

let showPopup = async ( type, title, html, buttonsArr = [] ) => {
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
                    backgroundColor: Chart.helpers.color(SCAN_COLOR).alpha(0.2).rgbString(),
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
                    backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.2).rgbString(),
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
                    backgroundColor: Chart.helpers.color(CONGESTED_COLOR).alpha(0.5).rgbString(),
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
                        labelString: BAND_LABEL?BAND_LABEL:'MHz'
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
    console.log ( "No country set or file with forbidden ranges for that country does not exist! Falling back to 'DE'");
}

if ( !COM_PORT ) {
    COM_PORT = 'AUTO'
    configStore.set('com_port', COM_PORT )
} else {
    ipcRenderer.send ('SET_PORT', { portPath : COM_PORT });
}

if ( !SWEEP_POINTS ) {
    configStore.set('sweep_points', global.SWEEP_POINTS )
} else {
    global.SWEEP_POINTS = SWEEP_POINTS
}

var FREQ_FORBIDDEN = require ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + COUNTRY_CODE + '.json');

if ( fs.existsSync ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json' ) )
    var FREQ_GRIDS = require ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json');
else
    var FREQ_GRIDS = null;

var chDispValShadowArr = [];

if ( SCAN_DEVICE ) {
    ipcRenderer.send ('SET_SCAN_DEVICE', { scanDevice : SCAN_DEVICE });
    console.log ( `Scan device is '${SCAN_DEVICE}'`)
    initChart()
    scanPorts().then (() => connectPort() )
} else {
    console.log ( `No scan device selected. Waiting for user to select via popup ...`)

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
                scanPorts().then (() => connectPort() )
                break

            case TinySA.HW_TYPE:
                ipcRenderer.send ('SET_SCAN_DEVICE', { scanDevice : TinySA.HW_TYPE });
                configStore.set ('scan_device', 'TINY_SA')
                SCAN_DEVICE = TinySA.HW_TYPE;
                scanPorts().then (() => connectPort() )
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

/*
Chart.pluginService.register({
    afterUpdate: function(chart) {
        chart.config.data.datasets.forEach ( (dataset) => {
            var offset = -4;

            if ( !dataset._meta[0].data[0])
                return;
            
    //        console.log(dataset._meta[0].data[0]._model);

            for ( var i = 0 ; i < dataset._meta[0].data.length; i++ ) {
                let model = dataset._meta[0].data[i]._model;
                model.x += offset;
                model.controlPointNextX += offset;
                model.controlPointPreviousX += offset;
            }
        });
    }
});
*/

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

        myChart.config.options.scales.xAxes[3].labels[Math.floor((left_data_point+right_data_point)/2)] = f.label;

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
    return (freq / 1000000).toFixed(6)
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
            reject('ERR_PORT_INVALID_INDEX')
            return
        }

        console.log ( "=========================================================" )
        console.log ( `Trying port ${globalPorts[index].path} with baud rate ${baudRate} ...` );
        port = new SerialPort ({ path: globalPorts[index].path, baudRate : baudRate }, err => {
            if ( err ) {
                if ( err.toString().indexOf('Access denied') !== -1 ) {
                    showPopup (
                        'error',
                        "Access denied!",
                        `Got 'Access denied' on serial port! The application must be restarted!`,
                        ['Restart']
                    ).then ( result => {
                        if ( result.isConfirmed ) {
                            restartApp()
                        }
                    })

                    console.error ( err )
                    reject ( 'ERR_PORT_ACCESS_DENIED' )
                    return
                }

                console.error ( err )
                reject ( `ERR_PORT_GENERIC_${err.toString()}` )
                return
            }

            console.log( `Successfully connected to ${globalPorts[index].path}!` )
            resolve ()
        })

        // Create a promise of write() function
        port.writePromise = async (data, type ) => {
            port.write (data, type, (err) => {
                if (err) {
                    return Promise.reject(err);
                }

                return Promise.resolve();
            });
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
                                clearTimeout ( responseCheckTimer )
                                console.log ( "Stoped response check timer" )
                                console.log ( `Successfully detected '${data[0].values.NAME}' hardware!` )
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
                            MAX_SPAN = data[0].values.MAX_SPAN

                            configStore.set ( 'start_freq', global.START_FREQ )
                            configStore.set ( 'stop_freq' , global.STOP_FREQ  )
                            configStore.set ( 'freq_step' , FREQ_STEP  )

                            if ( !RFExplorer.isValidFreqConfig ( data[0].values.START_FREQ, data[0].values.STOP_FREQ ) ) {
                                console.error ( `Invalid frequency range: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz!` )

                                Swal.fire({
                                    title: "Invalid frequency range!",
                                    html: `The currently selected frequency range is not valid for device <b>${RFExplorer.NAME}</b>!` +
                                            `<br><br>Allowed range is: ${MIN_FREQ} - ${MAX_FREQ} Hz` +
                                            `<br><br>Current range is: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz`,
                                    icon: "warning",
                                    showCancelButton: false,
                                    confirmButtonColor: "#0099ff",
                                    customClass: {
                                        title: 'sweetalert2-title',
                                        container: 'sweetalert2-container'
                                    }
                                })
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

                            let label = "Range: " + formatFrequencyString(global.START_FREQ) + " - " + formatFrequencyString(global.STOP_FREQ) + " MHz    |    Span: " + formatFrequencyString(global.STOP_FREQ - global.START_FREQ) + " MHz" + country_information + band_details +  sweep_points

                            myChart.options.scales.xAxes[0].scaleLabel.labelString = label
                            configStore.set ( 'band_label' , label )
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

                console.log ( "Starting response check timer ..." )

                let responseCheckTimer = setTimeout ( () => {
                    console.error ( `No or invalid response from ${RFExplorer.NAME}!`)

                    // If serial port was connected successfully but to a different device type
                    disconnectPort().then( async err => {
                        if (err) {
                            console.error(err)
                            return
                        }

                        portDetectionIndex++

                        if ( portDetectionIndex < globalPorts.length ) {
                            console.log ( `Now trying port with index ${portDetectionIndex}`)
                            connectPort(portDetectionIndex)
                        } else { // No more ports available
                            await Swal.fire({
                                title: "No response from scan device!",
                                html: `<b>${RFExplorer.NAME}</b> could not be found or identified properly on any of the available ports!` +
                                        `<br><br>Please choose the correct device type from the menu or connect the chosen device. If the correct` +
                                        ` device is already connected, please restart it and then click 'Reconnect'.`,
                                icon: "error",
                                showCancelButton: false,
                                confirmButtonColor: "#0099ff",
                                confirmButtonText: 'Reconnect',
                                customClass: {
                                    title: 'sweetalert2-title',
                                    container: 'sweetalert2-container'
                                }
                            })

                            portDetectionIndex = 0
                            scanPorts().then (() => connectPort() )
                        }
                    })
                }, SERIAL_RESPONSE_TIMEOUT)

                scanDevice.getConfiguration()
            } else {
                console.error ("Unable to instantiate class RFExplorer!")
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
                                clearTimeout ( responseCheckTimer )
                                console.log ( "Stoped response check timer" )
                                console.log ( `Successfully detected '${data[0].values.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}' hardware!` )
                                return
                            }
                            break

                        case 'CONFIG_DATA':
                            global.START_FREQ = data[0].values.START_FREQ
                            global.STOP_FREQ = data[0].values.STOP_FREQ
                            FREQ_STEP = data[0].values.FREQ_STEP
                            MIN_FREQ = data[0].values.MIN_FREQ
                            MAX_FREQ = data[0].values.MAX_FREQ
                            MAX_SPAN = data[0].values.MAX_SPAN

                            configStore.set ( 'start_freq', global.START_FREQ )
                            configStore.set ( 'stop_freq' , global.STOP_FREQ  )
                            configStore.set ( 'freq_step' , FREQ_STEP  )

                            if ( !TinySA.isValidFreqConfig ( data[0].values.START_FREQ, data[0].values.STOP_FREQ ) ) {
                                console.error ( `Invalid frequency range: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz!` )

                                Swal.fire({
                                    title: "Invalid frequency range!",
                                    html: `The currently selected frequency range is not valid for device <b>${TinySA.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}</b>!` +
                                        `<br><br>Allowed range is: ${MIN_FREQ} - ${MAX_FREQ} Hz` +
                                        `<br><br>Current range is: ${data[0].values.START_FREQ} - ${data[0].values.STOP_FREQ} Hz`,
                                    icon: "warning",
                                    showCancelButton: false,
                                    confirmButtonColor: "#0099ff",
                                    customClass: {
                                        title: 'sweetalert2-title',
                                        container: 'sweetalert2-container'
                                    }
                                })    
                                return
                            }

                            const range = "Range: " + formatFrequencyString(global.START_FREQ) + " - " + formatFrequencyString(global.STOP_FREQ) + " MHz"
                            const span  = "    |    Span: " + formatFrequencyString(global.STOP_FREQ - global.START_FREQ) + " MHz"

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
                    }
                })

                console.log ( "Starting response check timer ..." )

                let responseCheckTimer = setTimeout ( () => {
                    console.error ( `No or invalid response from ${TinySA.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}!`)

                    // If serial port was connected successfully but to a different device type, disconnect it
                    disconnectPort().then( async (err) => {
                        if ( err ) {
                            console.error (err )
                            return
                        }

                        portDetectionIndex++

                        if ( portDetectionIndex < globalPorts.length ) {
                            console.log ( `Now trying port with index ${portDetectionIndex}`)
                            connectPort(portDetectionIndex)
                        } else { // No more ports available
                            await showPopup (
                                "error",
                                "No or invalid response from scan device!",
                                `<b>${TinySA.NAME}${TinySA.MODEL==="ULTRA"?" Ultra":""}</b> could not be found or identified properly on any of the available ports!` +
                                    `<br><br>Please choose the correct device type from the menu or connect the chosen device. If the correct` +
                                    ` device is already connected, please restart it and then click 'Reconnect'.`,
                                ['Reconnect']
                            )

                            portDetectionIndex = 0
                            scanPorts().then (() => connectPort() )
                        }
                    })
                }, SERIAL_RESPONSE_TIMEOUT )

                scanDevice.getConfiguration()
            } else {
                console.error ("Unable to instantiate class TinySA!")
            }
            break;

        default:
            console.error ( `Unknown scan device ${SCAN_DEVICE}` )
            scanDevice = null
    }
}

function showPortHwError ( msg ) {
    Swal.fire({
        title: "Hardware error!",
        html: msg + `<br><ul style="text-align:left"><li>Make sure that the scan device is connected</li>` +
                    `<li>Select the corresponding serial port (or leave default: \'Auto\')</li>`+
                    `<li>If it still doesn\'t work please disconnect/power off the scan device, stop this tool, leave the scan device unpowered for approx 10s, then start the scan device and wait until its "pre-calibration" phase is over and it shows a graph on the display. Now start the software again!</li></ul>`,
        icon: "error",
        showCancelButton: false,
        confirmButtonColor: "#0099ff",
        customClass: {
            title: 'sweetalert2-title',
            container: 'sweetalert2-container'
        }
    }) 

    console.error ( msg )
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
                reject ( "No serial ports detected!" )
                return
            }

            globalPorts = ports
            console.log ( "The following ports were found:" )

            for ( const [ index, port ] of ports.entries()  ) {
                console.log ( `[${index}] ${port.friendlyName} (VendorID: ${port.vendorId}, ProductID: ${port.productId})`)
            }

            resolve ( ports )
        })
    })
}

function connectPort ( index ) {
    return new Promise ( (resolve, reject) => {
        baudRate = getBaudrate()

        if ( baudRate === null ) {
            console.error ( `Unable to get default baudrate for device ${SCAN_DEVICE}!` )
            return reject('ERR_PORT_NO_BAUDRATE')
        }

        if ( index !== undefined ) {
            console.log ( `Connecting to port with index '${index}'`)
            tryPort(index).then ( () => {
                portOpenCb()
                return resolve()
            }).catch ( err => {
                return reject (err)
            })
        } else if ( COM_PORT && COM_PORT !== 'AUTO' ) { // Select specific port
            console.log ( `Connecting to dedicated port '${COM_PORT}'`)
            for ( const [index, port] of globalPorts.entries() ) {
                if ( port.path === COM_PORT) {
                    tryPort(index).then (() => {
                        portOpenCb()
                        return resolve()
                    }).catch ( err => {
                        return reject (err)
                    })
                }
            }
        } else { // Automatic port selection
            console.log ( `Auto-detecting port ...`)
            tryPort(portDetectionIndex).then ( () => {
                portOpenCb ()
                return resolve()
            }).catch ( err => {
                if ( err !== 'ERR_PORT_ACCESS_DENIED' ) {
                    portDetectionIndex++

                    if ( portDetectionIndex < globalPorts.length ) {
                        tryPort(portDetectionIndex).then ( () => {
                            portOpenCb ()
                            return resolve()
                        })
                    } else {
                        reject ('ERR_PORT_DEVICE_NOT_FOUND')
                        portDetectionIndex = 0
                    }
                }
                return
            })
        }
    })
}

function disconnectPort () {
    return new Promise ((resolve, reject) => {
        if ( port && port.isOpen) {
            console.log ( "Closing existing connection to current scan device ..." )
            port.close(() => {
                port = null
                console.log ( "Port closed successfully.")
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
    global.START_FREQ = LAST_START_FREQ = message.start_freq * 1000;
    global.STOP_FREQ  = LAST_STOP_FREQ  = message.stop_freq  * 1000;

    configStore.set ( 'last_start_freq', LAST_START_FREQ );
    configStore.set ( 'last_stop_freq' , LAST_STOP_FREQ  );
    configStore.set ( 'band_details'   , message.details );

    BAND_DETAILS = message.details;
    scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );
});

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
            console.log ( "Vendor missing in message!")
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
        console.log ( "Empty or invalid country code!" )
        await Swal.fire({
            title: "Empty or invalid country code!",
            html: `country_codes.json might be corrupted!`,
            icon: "error",
            showCancelButton: false,
            confirmButtonColor: "#0099ff",
            customClass: {
                title: 'sweetalert2-title',
                container: 'sweetalert2-container'
            }
        }) 
        return;
    }

    if ( !fs.existsSync ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + message.country_code + '.json' ) ) {
        await Swal.fire({
            title: "Country not available!",
            html: 'No frequency related information available for ' + message.country_label +' (' + message.country_code + ')' + '! Falling back to Germany (DE)',
            icon: "warning",
            showCancelButton: false,
            confirmButtonColor: "#0099ff",
            customClass: {
                title: 'sweetalert2-title',
                container: 'sweetalert2-container'
            }
        }) 

        COUNTRY_CODE = 'DE';
        COUNTRY_NAME = 'Germany';
        ipcRenderer.send ('SET_COUNTRY', { country_code : COUNTRY_CODE });

        console.log ( "No frequency related information available for country code: '" + message.country_code +"' => Falling back to: 'DE'");
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

    console.log ( `User has changed port to: '${COM_PORT}'`)
    configStore.set ( 'com_port', COM_PORT )
    ipcRenderer.send ('SET_PORT', { portPath : COM_PORT });
    scanDevice.scanningActive = false
    console.log ( "Periodic scan is now disabled" )
    console.log ( "Wait for lastly requested scan data to be received before continuing ..." )
    await firstValueFrom(data$) // Wait for last scan data to arrive
    console.log ( "Reconnecting port ..." )
    await disconnectPort()
    connectPort()
});

ipcRenderer.on ( 'EXPORT_WW6_IAS_CSV', (event, message) => {
    let i = 0;

    for ( var freq = global.START_FREQ; freq <= global.STOP_FREQ ; freq += FREQ_STEP ) {
        fs.appendFileSync ( message.filename, formatFrequencyString(freq) + ", " + myChart.data.datasets[LINE_LIVE].data[i] + "\n", 'utf-8');
        i++;
    }
});

ipcRenderer.on ( 'RESET_PEAK', (event, message) => {
    console.log("Peak values have been reset")
    for ( let i = 0 ; i < global.SWEEP_POINTS ; i++ )
        myChart.data.datasets[LINE_LIVE].data[i] = undefined;

    myChart.update();
});

ipcRenderer.on ( 'RESET_SETTINGS', (event, message) => {
    Swal.fire({
        title: "Reset application settings?",
        html: 'All settings you made will be lost!',
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#0099ff",
        customClass: {
            title: 'sweetalert2-title',
            container: 'sweetalert2-container'
        }
    }).then ( result => {
        if (result.isConfirmed) {
            console.log ( "User has resetted application settings")
            configStore.clear()
            restartApp()
        }
    })
})

ipcRenderer.on ( 'MX_LINUX_WORKAROUND', (event, message) => {
    if ( message.enabled ) {
        console.log("Enabled workaround for MX Linux")
        configStore.set( 'mx_linux_workaround_enabled', true)
        global.MX_LINUX_WORKAROUND = true
        Swal.fire({
            title: "Information",
            html: 'This enables a workaround which prevents the app from hanging on certain MX Linux systems. Enabling it, will make it work on MX Linux, but also slows down zooming and moving through the spectrum.',
            icon: "info",
            showCancelButton: false,
            confirmButtonColor: "#0099ff",
            customClass: {
                title: 'sweetalert2-title',
                container: 'sweetalert2-container'
            }
        }) 
    } else {
        console.log("Disabled workaround for MX Linux")
        configStore.set( 'mx_linux_workaround_enabled', false)
        global.MX_LINUX_WORKAROUND = false
    }
});

ipcRenderer.on ( 'SET_SCAN_DEVICE', async (event, message) => {
    console.log ( `User selected device '${message.scanDevice}'` )

    await disconnectPort( err => {
        port = null;

        if (err) {
            console.error(err)
            return
        }
    })

    switch ( message.scanDevice ) {
        case 'RF_EXPLORER':
            configStore.set ('scan_device', 'RF_EXPLORER')
            SCAN_DEVICE = message.scanDevice;
            portDetectionIndex = 0
            connectPort();
            break;

        case 'TINY_SA':
            configStore.set ('scan_device', 'TINY_SA')
            SCAN_DEVICE = message.scanDevice;
            portDetectionIndex = 0
            connectPort();
            break;

        default: console.error (`Unknown device: ${message.scanDevice}`);
    }
})

ipcRenderer.on ( 'DEVICE_SETTINGS', async (event, message) => {
    if ( scanDevice instanceof RFExplorer ) {
        Swal.fire({
            title: "No settings available",
            text: "This device does not have configurable settings!",
            icon: "warning",
            showCancelButton: false,
            confirmButtonColor: "#0099ff",
            customClass: {
                title: 'sweetalert2-title',
                container: 'sweetalert2-container'
            },
        })
    } else if ( scanDevice instanceof TinySA ) {
        Swal.fire({
            title: "Enter number of sweep points",
            input: "text",
            width: '200px',
            showCancelButton: true,
            confirmButtonText: "Ok",
            confirmButtonColor: "#0099ff",
            customClass: {
                title: 'sweetalert2-title',
                validationMessage: 'sweetalert2-validation-message'
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
            if (result.isConfirmed) {
                global.SWEEP_POINTS = result.value
                console.log ( "Number of sweep points was set to:", global.SWEEP_POINTS )
                configStore.set ( 'sweep_points', global.SWEEP_POINTS )
                scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );        
            }
        })
    }
})

function alignToMaxSpan () {
    if ( global.STOP_FREQ - global.START_FREQ > MAX_SPAN ) {
        let fill = Math.floor ( (MAX_SPAN - (global.STOP_FREQ - global.START_FREQ)) / 2 );
        global.START_FREQ -= fill;
        global.STOP_FREQ  = global.STOP_FREQ  + fill;
        console.log ( "Maximum span reached!" );
    }
}

function getFreqPercentOfSpan (percent) {
    return Math.floor( ((global.STOP_FREQ - global.START_FREQ) / 100) * percent );
}

function zoom (percent) { // delta percent
    if ( percent < 0 ) {
        console.log (`Zoom OUT to ${Math.abs(percent) * 2 + 100}% of current view ...`);
    } else {
        console.log (`Zoom IN to ${100 - Math.abs(percent) * 2}% of current view ...`);
    }

    const delta_freq = getFreqPercentOfSpan(Math.abs(percent));

    if ( percent < 0 ) {
        global.START_FREQ -= delta_freq;
        global.STOP_FREQ  += delta_freq;
    } else {
        global.START_FREQ += delta_freq;
        global.STOP_FREQ  -= delta_freq;
    }
}

function move (percent) {
    console.log (`Move frequency band to ${percent < 0 ? 'LEFT' : 'RIGHT'} by ${Math.abs(percent)}% of span`)
    const delta_freq = getFreqPercentOfSpan(Math.abs(percent));

    if ( percent < 0 ) {
        global.START_FREQ -= delta_freq;
        global.STOP_FREQ  -= delta_freq;
    } else {
        global.START_FREQ += delta_freq;
        global.STOP_FREQ  += delta_freq;
    }
}

document.addEventListener ( "wheel", async e => {
    // When tilting the mouse wheel the first time after app start, it fires twice
    // this causes a race condition. Thus block subsequent calls until current
    // call has executed completely. To quick subsequent calls must genereally be blocked
    // as well to prevent race conditions while writing the data to the device
    if (isExecuting) {
        return
    }

    isExecuting = true

    if ( e.deltaY > 0 ) { // Zoom out
        if ( !e.shiftKey && !e.ctrlKey ) { // Zoom out by adding 10% of span on both sides ( = 20% )
            zoom(-10); // Zoom out to 120% by adding 10% of span on both sides ( = 20% )
        } else if ( e.shiftKey && !e.ctrlKey ) {
            zoom(-50); // Zoom out by adding 50% of span on both sides ( = 100% )
        }

        alignToMaxSpan ();
        BAND_DETAILS = "";
    } else if ( e.deltaY < 0 ) { // Zoom in
        if ( !e.shiftKey && !e.ctrlKey ) {
            zoom(10); // Zoom in by removing 10% of span on both sides ( = 20% )
        } else if ( e.shiftKey && !e.ctrlKey ) {
            zoom(25); // Zoom in by removing 25% of span on both sides ( = 50% )
        }
        
        if ( global.STOP_FREQ - global.START_FREQ < global.SWEEP_POINTS ) {
            isExecuting = false
            return;
        }
    } else if ( e.deltaX < 0 ) { // Move left
        if ( !e.shiftKey && !e.ctrlKey ) {
            move(-10); // Move frequency band to LEFT by 10% of span
        } else if ( e.shiftKey && !e.ctrlKey ) {
            move(-50); // Move frequency band to LEFT by 50% of span
        }
    } else if ( e.deltaX > 0 ) { // Move right
        if ( !e.shiftKey && !e.ctrlKey ) {
            move(10); // Move frequency band to RIGHT by 10% of span
        } else if ( e.shiftKey && !e.ctrlKey ) {
            move(50); // Move frequency band to RIGHT by 50% of span
        }
    }

    BAND_DETAILS = "";
    await scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );
    isExecuting = false
});

document.addEventListener ( "keydown", async e => {
    // If only SHIFT (16) or CTRL (17) key was pressed (and no other key) ... do nothing
    if ( e.keyCode === 16 || e.keyCode === 17 ) {
        return
    }

    // To quick subsequent calls must be blocked to prevent race conditions while writing the data to the device
    if (isExecuting) {
        return
    }

    isExecuting = true

    switch ( e.keyCode ) {
        case 37: // Arrow left
            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks down
                if ( chPreset_Preset > 1 ) {
                    chPreset_Preset--;
                    console.log (`Toggle vendor specific channel presets/banks down. Now is: ${chPreset_Preset}`)

                    if ( FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] && chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset)
                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                    myChart.update();
                } else {
                    console.error(`Unable to toggle vendor specific channel presets/banks down! Already on preset ${chPreset_Preset}!`)
                }
                isExecuting = false
                return;
            } else if ( e.shiftKey && !e.ctrlKey ) {
                move(-50); // Move frequency band to LEFT by 50% of span
            } else if ( !e.shiftKey && !e.ctrlKey ) {
                move(-10); // Move frequency band to LEFT by 10% of span
            }

            BAND_DETAILS = "";
            break;

        case 39: // Arrow right
            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks up
                if ( chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset && FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] ) {
                    if ( chPreset_Preset <  FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length ) {
                        chPreset_Preset++;
                        console.log (`Toggle vendor specific channel presets/banks up. Now is: ${chPreset_Preset}`)
                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                        myChart.update();
                    } else {
                        console.error(`Unable to toggle vendor specific channel presets/banks up! Only ${FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length} presets available!`)
                    }
                } else {
                    console.error("Unable to toggle vendor specific channel presets/banks up!")
                    console.error(`chPreset_Vendor: ${chPreset_Vendor}`)
                    console.error(`chPreset_Band: ${chPreset_Band}`)
                    console.error(`chPreset_Series: ${chPreset_Series}`)
                    console.error(`chPreset_Preset: ${chPreset_Preset}`)
                    console.error(`FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series]: ${FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series]}`)
                }
                isExecuting = false
                return;
            } else if ( e.shiftKey && !e.ctrlKey ) {
                move(50); // Move frequency band to RIGHT by 50% of span
            } else if ( !e.shiftKey && !e.ctrlKey ) {
                move(10); // Move frequency band to RIGHT by 10% of span
            }

            BAND_DETAILS = "";
            break;

        case 38: // Arrow up - Zoom in
            if ( !e.shiftKey ) {
                zoom(10); // Zoom in by removing 10% of span on both sides ( = 20% )
            } else {
                zoom(25); // Zoom in by removing 25% of span on both sides ( = 50% )
            }

            if ( global.STOP_FREQ - global.START_FREQ < global.SWEEP_POINTS ) {
                isExecuting = false
                return;
            }

            BAND_DETAILS = "";
            break;

        case 40: // Arrow down - Zoom out
            if ( !e.shiftKey ) { 
                zoom(-10); // Zoom out to 120% by adding 10% of span on both sides ( = 20% )
            } else {
                zoom(-50); // Zoom out by adding 50% of span on both sides ( = 100% )
            }

            alignToMaxSpan ();
            BAND_DETAILS = "";
            break;

        case 82: // Reset peak
            console.log ("Resetting peak values ...");

            for ( let i = 0 ; i < global.SWEEP_POINTS ; i++ )
                myChart.data.datasets[LINE_LIVE].data[i] = undefined;

            myChart.update();
            isExecuting = false
            return;

        case 66: // Go back to last vendor band
            global.START_FREQ = LAST_START_FREQ;
            global.STOP_FREQ    = LAST_STOP_FREQ;
            BAND_DETAILS = configStore.get('band_details');
            break;

        default:
            return;
    }

    await scanDevice.setConfiguration ( global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS );
    isExecuting = false
});

function getBaudrate () {
    switch ( SCAN_DEVICE ) {
        case 'RF_EXPLORER': return RFExplorer.BAUD_RATE;
        case 'TINY_SA'    : return TinySA.BAUD_RATE;
        default:
            console.error (`Cannot get baudrate for unknown device: ${SCAN_DEVICE}`);
            return null;
    }
}

function restartApp () {
    app.relaunch ()
    app.exit (0)
}
