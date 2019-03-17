'use strict'

const { ipcRenderer } = require ( 'electron'    );
const ConfigStore     = require ( 'configstore' );
const SerialPort      = require ( 'serialport'  );
const Chart           = require ( 'chart.js'    );
const FREQ_VENDOR_PRESETS = require ( 'require-all' )(__dirname +'/frequency_data/presets'  );
const Pkg             = require ('./package.json');
const { dialog }      = require ('electron'     ).remote;
const fs              = require ('fs');

const configStore = new ConfigStore ( Pkg.name );

var MAX_FREQ   = 2700000; // 2700000 kHz (2.7 GHz)
var MIN_FREQ   =   15000; //   15000 kHz ( 15 MHz)
var MAX_DBM    = -20;
var MIN_DBM    = -110;
var CONGESTION_LEVEL_DBM = -85;

var SWEEP_POINTS = 112;
var SERIAL_RESPONSE_TIMEOUT = 1500;
var VENDOR_ID  = 'NON';

var LINE_LIVE        = 0;
var LINE_RECOMMENDED = 1;
var LINE_FORBIDDEN   = 2;
var LINE_CONGESTED   = 3;
var LINE_CONGEST_TRESH = 4;
var LINE_GRIDS       = 5;
var LINE_FORBIDDEN_MARKERS = 6;

var PORT_MENU_SELECTION = undefined;

const chartColors = {
	RED    : 'rgb(255, 99 , 132)',
	ORANGE : 'rgb(255, 159, 64 )',
	YELLOW : 'rgb(255, 205, 86 )',
	GREEN  : 'rgb(75 , 222, 192)',
	BLUE   : 'rgb(54 , 162, 235)',
	PURPLE : 'rgb(153, 102, 255)',
	GREY   : 'rgb(201, 203, 207)'
};

let RECOMMENDED_CHANNELS_COLOR = chartColors.GREEN;
let FORBIDDEN_COLOR            = chartColors.RED;
let SCAN_COLOR                 = chartColors.PURPLE;
let CONGESTED_COLOR            = chartColors.ORANGE;
let CHAN_GRID_COLOR            = chartColors.GREY;

let SENNHEISER_CHANNEL_WIDTH   = 96000; // +/-48kHz Spitzenhub

var port = undefined;
var autoPortCheckTimer = undefined;
var responeCheckTimer  = undefined;

let chPreset_Vendor = configStore.get('chPreset.vendor');
let chPreset_Band   = configStore.get('chPreset.band'  );
let chPreset_Series = configStore.get('chPreset.series');
let chPreset_Preset = configStore.get('chPreset.preset');
let COUNTRY_CODE    = configStore.get('country_code'   );
let COUNTRY_NAME    = configStore.get('country_name'   );
var START_FREQ      = configStore.get('start_freq'     );
var LAST_START_FREQ = configStore.get('last_start_freq');
var STOP_FREQ       = configStore.get('stop_freq'      );
var LAST_STOP_FREQ  = configStore.get('last_stop_freq' );
var FREQ_STEP       = configStore.get('freq_step'      );
var BAND_LABEL      = configStore.get('band_label'     );
var BAND_DETAILS    = configStore.get('band_details'   );
var VIS_MANUF_CHAN  = configStore.get('graphVisibility.recommended');
var VIS_FORBIDDEN   = configStore.get('graphVisibility.forbidden'  );
var VIS_CONGEST     = configStore.get('graphVisibility.congested'  );
var VIS_TV_CHAN     = configStore.get('graphVisibility.grids'      );

if ( VIS_MANUF_CHAN === undefined ) VIS_MANUF_CHAN = true;
if ( VIS_FORBIDDEN  === undefined ) VIS_FORBIDDEN  = true;
if ( VIS_CONGEST    === undefined ) VIS_CONGEST    = true;
if ( VIS_TV_CHAN    === undefined ) VIS_TV_CHAN    = true;

let received_first_answer = false;

if ( !COUNTRY_CODE || !fs.existsSync ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + COUNTRY_CODE + '.json' ) ) {
    COUNTRY_CODE = 'DE';
    console.log ( "No country set or file with forbidden ranges for that country does not exist! Falling back to 'DE'");
}

// If value is not existing, just set to some initial value
if ( !START_FREQ      ) { START_FREQ      = 800000000 ; }
if ( !LAST_START_FREQ ) { LAST_START_FREQ = START_FREQ; }
if ( !STOP_FREQ       ) { STOP_FREQ       = 912000000 ; }
if ( !LAST_STOP_FREQ  ) { LAST_STOP_FREQ  = STOP_FREQ ; }
if ( !FREQ_STEP       ) { FREQ_STEP       = 1000000   ; }
if ( !BAND_LABEL      ) { BAND_LABEL      = "800.000 - 912.000 MHz"; }

if ( START_FREQ !== LAST_START_FREQ && STOP_FREQ !== LAST_STOP_FREQ )
    BAND_DETAILS = "";

var FREQ_FORBIDDEN = require ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + COUNTRY_CODE + '.json');

if ( fs.existsSync ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json' ) )
    var FREQ_GRIDS = require ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json');
else
    var FREQ_GRIDS = null;

var chDispValShadowArr = [];

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

var ctx = document.getElementById("graph2d").getContext('2d');
var myChart = new Chart(ctx, {
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
                    min : MIN_DBM,
                    suggestedMax : MAX_DBM
                },
                scaleLabel: {
                    display: true,
                    labelString: 'dBm'
                }
            }]
        }
    }
});


function setForbidden () {
    for ( var f of FREQ_FORBIDDEN ) {
        let range_res = isInRange ( f.start*1000, f.stop*1000);
        let left_data_point  = undefined;
        let right_data_point = undefined;

        if ( !range_res )
            continue;

        if ( range_res === "FULL_COVERAGE" ) {
            left_data_point  = 0;
            right_data_point = SWEEP_POINTS - 1;
        } else {
            left_data_point  = alignToBoundary ( Math.round ( (f.start * 1000 - START_FREQ) / FREQ_STEP ) );
            right_data_point = alignToBoundary ( Math.round ( (f.stop  * 1000 - START_FREQ) / FREQ_STEP ) );
        }

        let data_point = left_data_point;
        myChart.config.options.scales.xAxes[1].labels[left_data_point] = f.info;

        if ( f.start * 1000 >= START_FREQ )
            myChart.data.datasets[LINE_FORBIDDEN_MARKERS].data[left_data_point] = MIN_DBM;

        while ( data_point <= right_data_point ) {
            myChart.data.datasets[LINE_FORBIDDEN].data[data_point] = MAX_DBM;
            data_point++;
        }

        if ( f.stop * 1000 <= STOP_FREQ )
            myChart.data.datasets[LINE_FORBIDDEN_MARKERS].data[right_data_point] = MIN_DBM;
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
            right_data_point = SWEEP_POINTS - 1;
        } else {
            left_data_point  = alignToBoundary ( Math.round ( (f.start * 1000 - START_FREQ) / FREQ_STEP ) );
            right_data_point = alignToBoundary ( Math.round ( (f.stop  * 1000 - START_FREQ) / FREQ_STEP ) );
        }

        data_point = left_data_point;

        if ( f.start * 1000 >= START_FREQ )
            myChart.config.options.scales.xAxes[3].labels[left_data_point] = '|';

        myChart.config.options.scales.xAxes[3].labels[Math.floor((left_data_point+right_data_point)/2)] = f.label;

        if ( !even ) { // Only draw even (gray) fields. Otherwise overlapping occours. For odd (white fields we simply do nothing)
            even = !even;
            last_data_point = right_data_point;
            continue;
        }

        while ( data_point <= right_data_point ) {
            myChart.data.datasets[LINE_GRIDS].data[data_point] = even?MAX_DBM:undefined;
            last_data_point = data_point;
            data_point++;
        }

        even = !even;
    }

    if ( last_data_point < SWEEP_POINTS - 1) // Draw last marker
        myChart.config.options.scales.xAxes[3].labels[last_data_point] = '|';
}

function setVendorChannels ( presets, bank ) {
    if ( !presets )
        return;
    
    for ( let i = 0 ; i < SWEEP_POINTS ; i++ ) {
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

        let left_data_point  = alignToBoundary ( Math.round ( (left_freq_edge  - START_FREQ) / FREQ_STEP ) );
        let right_data_point = alignToBoundary ( Math.round ( (right_freq_edge - START_FREQ) / FREQ_STEP ) );

        if ( right_data_point === left_data_point && right_data_point < SWEEP_POINTS - 1)
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
                myChart.data.datasets[LINE_CONGESTED  ].data[data_point] = MAX_DBM;
            else
                myChart.data.datasets[LINE_RECOMMENDED].data[data_point] = MAX_DBM;

            data_point++;
        }
    }

    myChart.config.options.scales.xAxes[2].labels[0]   = ' ';
    myChart.config.options.scales.xAxes[2].labels[SWEEP_POINTS-1] = ' ';
}

function isInRange ( start, stop ) {
    if ( (start >= START_FREQ && start <= STOP_FREQ) || (stop >= START_FREQ && stop <= STOP_FREQ) )
        return true;
    else if ( (start <= START_FREQ && stop >= STOP_FREQ) )
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
    else if ( point > SWEEP_POINTS - 1 )
        return SWEEP_POINTS - 1;
    else
        return point;
}

function formatFrequencyString ( str ) { // str as kHz
    if ( str.length === 1 )
        str = "0." + str + "00";
    else if ( str.length === 2 )
        str = "0." + str + "0";
    else if ( str.length === 3 ) {
        str = "0." + str;
    } else {
        let MHz  = str.substr ( 0, str.length - 3 ); 
        let rest = str.substr ( -3 );
        str = MHz + "." + rest;
    }

    return str;
}

function InitChart () {
    myChart.data.labels = [];

    for ( var freq = START_FREQ; freq <= STOP_FREQ ; freq += FREQ_STEP ) {
        let val = Math.round ( freq / 1000 );
        val = formatFrequencyString ( val.toString() );
        myChart.data.labels.push ( val );
    }

    // Initialize all values of all graphs (except the scan graph) with lowest dBm value
    for ( let i = 0 ; i < SWEEP_POINTS ; i++ ) {
        myChart.data.datasets[LINE_LIVE].data[i]        = undefined; // Live scan
        myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined; // Recommended
        myChart.data.datasets[LINE_FORBIDDEN].data[i]   = undefined; // Forbidden
        myChart.data.datasets[LINE_CONGESTED].data[i]   = undefined; // Congested
        myChart.data.datasets[LINE_GRIDS].data[i]       = undefined; // Grids
        myChart.data.datasets[LINE_FORBIDDEN_MARKERS].data[i] = undefined; // Forbidden start markers
    }

    myChart.data.datasets[LINE_CONGEST_TRESH].data[0] = CONGESTION_LEVEL_DBM;
    myChart.data.datasets[LINE_CONGEST_TRESH].data[SWEEP_POINTS-1] = CONGESTION_LEVEL_DBM;

    for ( let i = 0 ; i < SWEEP_POINTS ; i++ ) {
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

function openPort () {
    let start_f = Math.floor ( START_FREQ / 1000 );
    let stop_f  = Math.floor ( STOP_FREQ  / 1000 );

    if( !PORT_MENU_SELECTION || PORT_MENU_SELECTION === 'AUTO' ) { // Automatic port selection
        SerialPort.list().then ( (ports, err) => {
            if ( err ) {
                console.log ( err );
                return;
            }

            let i = 0;

            console.log ( "Trying port " + ports[i].comName + " ...");
            port = new SerialPort ( ports[i].comName, { baudRate : 500000 }, function ( err ) {
                if ( err ) // Most likely the reason for the error is that the RF Explorer is not connected to this port. So we don't print an error message here.
                    return;

                setCallbacks();
                sendAnalyzer_SetConfig ( start_f, stop_f );
            });

            i++;

            autoPortCheckTimer = setInterval ( () => {
                if ( i === ports.length ) {
                    clearInterval ( autoPortCheckTimer );
                    const dialogOptions = {
                        type: 'error',
                        buttons: ['OK'],
                        message: 'Unable to find RF Explorer hardware!',
                        detail:  '- Make sure that the device is connected\n- Select the corresponding serial port (or leave default: \'Auto\')\n- If it still doesn\'t work please restart the app or press <CTRL><R>!'}
                    dialog.showMessageBox ( dialogOptions, (i) => {
                    //    console.log("Button " + i + " was pressed!")
                    });
                    console.log ( "Unable to find RF Explorer!");
                    return;
                }
                
                console.log ( "Trying port " + ports[i].comName + " ...");
                port = new SerialPort ( ports[i].comName, { baudRate : 500000 }, function ( err ) {
                    if ( err ) // Most likely the reason for the error is that the RF Explorer is not connected to this port. So we don't print an error message here.
                        return;

                    setCallbacks();
                    sendAnalyzer_SetConfig ( start_f, stop_f );
                });

                i++;
            }, SERIAL_RESPONSE_TIMEOUT);
        });
    } else  {
        port = new SerialPort ( PORT_MENU_SELECTION, { baudRate : 500000 }, function ( err ) {
            if ( err ) {
                console.log ( 'Error: ', err.message );
                return;
            }

            setCallbacks();
            sendAnalyzer_SetConfig ( start_f, stop_f );
        });
    }
}

// Configure analyzer device
function sendAnalyzer_SetConfig ( start_freq, stop_freq ) {
    if ( responeCheckTimer ) // Exit immediately in case another command is running
        return;

    rec_buf = []; // Buffer for continuosly receiving data
    rec_buf_str = []; // rec_buf converted to string so that we can check for commands
    msg_buf = []; // Once a message is complete, it will be placed in this buffer
    msgStart = -1;
    msgEnd   = -1;
    msgId    = -1;
    rec_buf_sweep_poi = 0;

    if ( start_freq < MIN_FREQ ) {
        stop_freq += MIN_FREQ - start_freq; // stay at current position
        start_freq = MIN_FREQ; // don't move start_freq to frequencies lower than allowed

        if ( stop_freq - start_freq < SWEEP_POINTS)
            stop_freq = start_freq + SWEEP_POINTS;
    }

    if ( stop_freq > MAX_FREQ ) {
        start_freq -= stop_freq - MAX_FREQ; // don't move to higher frequencies than allowed
        stop_freq   = MAX_FREQ; // stay at current position

        if ( stop_freq - start_freq < SWEEP_POINTS)
            start_freq = stop_freq - SWEEP_POINTS;
    }

    let start_freq_str = start_freq.toString();
    let stop_freq_str  = stop_freq.toString();

    while ( start_freq_str.length < 7 )
        start_freq_str = "0" + start_freq_str;

    while ( stop_freq_str.length < 7 )
        stop_freq_str = "0" + stop_freq_str;

    // Set DSP mode. Cp0 = Auto ; Cp1 = Filter ; Cp2 = Fast
//    var config_buf = Buffer.from ( '#0Cp0', 'ascii' ); // Second character will be replaced in next line by a binary lenght value
//    config_buf.writeUInt8 ( 0x05, 1 );
//    port.write ( config_buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });

    let config_buf = Buffer.from ( '#0C2-F:'+start_freq_str+','+stop_freq_str+',-0'+Math.abs(MAX_DBM).toString()+','+MIN_DBM.toString(), 'ascii' ); // Second character will be replaced in next line by a binary lenght value

    START_FREQ = start_freq * 1000;
    STOP_FREQ  = stop_freq  * 1000;
    config_buf.writeUInt8 ( 0x20, 1 );

    port.write ( config_buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });
    
    responeCheckTimer = setTimeout ( function () {
        console.error ("No Response!");
        responeCheckTimer = undefined;
    }, SERIAL_RESPONSE_TIMEOUT );
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

/***********************************/
/*    Receive data from device     */
/***********************************/
var rec_buf = []; // Buffer for continuosly receiving data
var rec_buf_str = []; // rec_buf converted to string so that we can check for commands
var msg_buf = []; // Once a message is complete, it will be placed in this buffer
var msg_id_array = [
    '$Sp',    // '$S' = sweep data, 'p' = ASCII code 112 ( 112 sweep points will be received)
    '#C2-F:'  // '#C2-F:' = config data from device
];
var msgStart = -1;
var msgEnd   = -1;
var msgId    = -1; // Command prefix of the message (see msg_id_array[])
var rec_buf_sweep_poi = 0;

function setCallbacks () {
    port.on ( 'data', function ( data ) {
        Array.prototype.push.apply ( rec_buf, data ); //Add new data to receive buffer
        rec_buf_str = String.fromCharCode.apply ( null, rec_buf ); // Convert to characters

        if ( msgStart === -1 ) { // Look for message start
            msgEnd = -1;
            msgId  = -1;

            for ( var msg_id of msg_id_array ) {
                let tmpMsgStart = rec_buf_str.indexOf ( msg_id );

                if ( tmpMsgStart !== -1 && (msgStart === -1 || tmpMsgStart < msgStart) ) {
                    msgStart = tmpMsgStart;
                    msgId    = msg_id;
                }
            }
        }

        if ( msgStart === -1 ) // Message found?
            return;

        if ( msgId === '$Sp' ) {
            // If this is the first answer ever which we recieve from the device, this means that the serial port ist
            // valid and working. So stop the port check timer and initialize the Chart ...
            if ( !received_first_answer ) {
                received_first_answer = true;
                clearInterval ( autoPortCheckTimer );
                clearTimeout  ( responeCheckTimer  );
                responeCheckTimer = undefined;
                console.log ( "RF Explorer found!" );
                InitChart ();
            }

            var dataStart = msgStart + msgId.length;
            var val_changed = false;

            msg_buf = rec_buf.slice ( dataStart + rec_buf_sweep_poi, dataStart + SWEEP_POINTS );

            for ( let i = 0 ; i < msg_buf.length ; i++ ) {
                msg_buf[i] = -( msg_buf[i] / 2 );
                
                if ( msg_buf[i] < MIN_DBM)
                    msg_buf[i] = MIN_DBM;

                if ( msg_buf[i] > myChart.data.datasets[LINE_LIVE].data[rec_buf_sweep_poi] || myChart.data.datasets[LINE_LIVE].data[rec_buf_sweep_poi] === undefined ) {
                    myChart.data.datasets[LINE_LIVE].data[rec_buf_sweep_poi] = msg_buf[i];
                    val_changed = true;

                    let congestedChannel = checkCongestion ( rec_buf_sweep_poi, msg_buf[i] );

                    if ( congestedChannel ) {
                        for ( let i = congestedChannel[0] ; i <= congestedChannel[1] ; i++ ) {
                            myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined;
                            myChart.data.datasets[LINE_CONGESTED  ].data[i] = MAX_DBM;
                        }
                    }
                }

                rec_buf_sweep_poi++;
            }

            if ( val_changed )
                myChart.update();

            if ( rec_buf_sweep_poi === SWEEP_POINTS ) { // Not waiting to get CR LF here since logic would be more complicated. Instead CR LF will automatically be skipped anyway when searching for next message!
                rec_buf = rec_buf.slice ( dataStart + SWEEP_POINTS ); // Remove message from rec_buf including CR LF at end of line
                rec_buf_sweep_poi = 0;
                msgStart = -1;            
                msgId    = -1;
            }

            return;
        } else {
            msgEnd = rec_buf_str.indexOf ( '\r\n', msgStart + msgId.length );

            if ( msgEnd !== -1 ) {
                msg_buf = rec_buf.slice ( msgStart + msgId.length, msgEnd );
                rec_buf = rec_buf.slice ( msgEnd + 2 ); // Remove oldest message from rec_buf including CR LF at end of line
    //console.log ( "ID: "+msgId+" LEN: "+msg_buf.length+"   " + String.fromCharCode.apply ( null, msg_buf) );
    //console.log ( "REMOVE START: 0 END: " + msgEnd );
            } else
                return;
        }

        switch ( msgId ) {
            case '#C2-F:': // Received config data from device
                clearTimeout ( responeCheckTimer );
                responeCheckTimer = undefined;

                // If this is the first answer ever which we recieve from the device, this means that the serial port ist
                // valid and working. So stop the port check timer and initialize the Chart ...
                if ( !received_first_answer ) {
                    received_first_answer = true;
                    clearInterval ( autoPortCheckTimer );
                    console.log ( "RF Explorer found!" );
                }

                let msg_buf_str = String.fromCharCode.apply ( null, msg_buf ); // Convert to characters
                let start_freq_step_idx = msg_buf_str.indexOf(',') + 1;

                START_FREQ = parseInt ( msg_buf_str.slice ( 0, start_freq_step_idx) ) * 1000;
                FREQ_STEP  = parseInt ( msg_buf_str.slice ( start_freq_step_idx, msg_buf_str.indexOf(',', start_freq_step_idx)) );
                STOP_FREQ  = ( FREQ_STEP * (SWEEP_POINTS-1) ) + START_FREQ;

                configStore.set ( 'start_freq', START_FREQ );
                configStore.set ( 'stop_freq' , STOP_FREQ  );
                configStore.set ( 'freq_step' , FREQ_STEP  );

                let start_f = Math.floor ( START_FREQ / 1000 );
                let stop_f  = Math.ceil  ( STOP_FREQ  / 1000 );
                let span_f  = Math.ceil  ( stop_f - start_f  );

                let band_details = "";

                if ( !BAND_DETAILS )
                    band_details = "    |    Band: <NO BAND SELECTED>";
                else 
                    band_details = "    |    Band: " + BAND_DETAILS + "";
                
                let country_information = "";

                if ( !COUNTRY_CODE || !COUNTRY_NAME)
                    country_information = "    |    Country: Germany (DE)";
                else
                    country_information = "    |    Country: " + COUNTRY_NAME + " (" + COUNTRY_CODE + ")";

                let label = formatFrequencyString("Range: " + start_f.toString()) + " - " + formatFrequencyString(stop_f.toString()) + " MHz    |    Span: " + formatFrequencyString(span_f.toString()) + "MHz" + country_information + band_details;

                myChart.options.scales.xAxes[0].scaleLabel.labelString = label;
                configStore.set ( 'band_label' , label );

                InitChart ();
                break;

            default:
                console.log ( "Unknown command!");
        }

        msgStart = -1;            
        msgEnd   = -1;
        msgId    = -1;
    });
}

openPort();

ipcRenderer.on ( 'CHANGE_BAND', (event, message) => {
    LAST_START_FREQ = message.start_freq * 1000;
    LAST_STOP_FREQ  = message.stop_freq  * 1000;

    configStore.set ( 'last_start_freq', LAST_START_FREQ );
    configStore.set ( 'last_stop_freq' , LAST_STOP_FREQ  );
    configStore.set ( 'band_details '  , message.details );

    BAND_DETAILS    = message.details;
    sendAnalyzer_SetConfig ( message.start_freq, message.stop_freq );
});

ipcRenderer.on ( 'SET_VENDOR_4_ANALYSIS', (event, message) => {
    switch ( message.vendor ) {
        case 'NON': // No vendor selected
            VENDOR_ID = 'NON';

            for ( let i = 0 ; i < SWEEP_POINTS ; i++ )
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

ipcRenderer.on ( 'SET_COUNTRY', (event, message) => {
    if ( !message.country_code ) {
        const dialogOptions = {
            type: 'error',
            buttons: ['OK'],
            message: 'Empty or invalid country code!',
            detail:  'country_code.json might be corrupted!'
        }
        dialog.showMessageBox ( dialogOptions, (i) => {
        //    console.log("Button " + i + " was pressed!")
        });
        console.log ( "Empty or invalid country code!" );
        return;
    }

    if ( !fs.existsSync ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + message.country_code + '.json' ) ) {
        COUNTRY_CODE = 'DE';
        COUNTRY_NAME = 'Germany';
        ipcRenderer.send ('SET_COUNTRY', { country_code : COUNTRY_CODE });
        const dialogOptions = {
            type: 'warning',
            buttons: ['OK'],
            message: 'Country not available!',
            detail:  'No frequency related information available for ' + message.country_label +' (' + message.country_code + ')' + '! Falling back to Germany (DE)'
        }
        dialog.showMessageBox ( dialogOptions, (i) => {
        //    console.log("Button " + i + " was pressed!")
        });
        console.log ( "File with forbidden ranges not found for country code: '" + message.country_code +"' => Falling back to: 'DE'");
    } else {
        COUNTRY_CODE = message.country_code;
        COUNTRY_NAME = message.country_label;
    }
    
    configStore.set ( 'country_code', COUNTRY_CODE );
    configStore.set ( 'country_name', COUNTRY_NAME );
    FREQ_FORBIDDEN = require ( __dirname + '/frequency_data/forbidden/FORBIDDEN_' + COUNTRY_CODE + '.json');

    if ( fs.existsSync ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json' ) )
        FREQ_GRIDS = require ( __dirname + '/frequency_data/grids/GRIDS_' + COUNTRY_CODE + '.json');
    else
        FREQ_GRIDS = undefined;

    InitChart();
    sendAnalyzer_SetConfig ( Math.floor ( START_FREQ/1000 ), Math.floor ( STOP_FREQ /1000 ) ); // Need this to refresh country name on x-axis
});

ipcRenderer.on ( 'SET_PORT', (event, message) => {
    if ( Array.isArray(message) ) // If this is an array => Auto mode was chosen
        PORT_MENU_SELECTION = 'AUTO';
    else
        PORT_MENU_SELECTION = message.port;

    if ( port && port.isOpen ) {
        console.log ( "Closing open port ...");
        port.close ( () => {
            openPort();
        });
    } else
        openPort();
});

ipcRenderer.on ( 'EXPORT_WW6_IAS_CSV', (event, message) => {
    let i = 0;

    for ( var freq = START_FREQ; freq <= STOP_FREQ ; freq += FREQ_STEP ) {
        let val = Math.round ( freq / 1000 );
        val = formatFrequencyString ( val.toString() );
        fs.appendFileSync ( message.filename, val + ", " + myChart.data.datasets[LINE_LIVE].data[i] + "\n", 'utf-8');
        i++;
    }
});

ipcRenderer.on ( 'RESET_PEAK', (event, message) => {
    for ( let i = 0 ; i < SWEEP_POINTS ; i++ )
        myChart.data.datasets[LINE_LIVE].data[i] = undefined;

    myChart.update();
});

document.addEventListener ( "wheel", function ( e ) {
    let start_f = 0, stop_f = 0;
    let delta_freq_10percent = Math.floor ( ( ( Math.floor(STOP_FREQ/1000) - Math.floor(START_FREQ/1000) ) / 100 ) * 10 ); // 10% of freq range

    if ( e.deltaY > 0 ) { // Zoom out
        start_f = Math.floor ( START_FREQ/1000 ) - delta_freq_10percent;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq_10percent;
    } else if ( e.deltaY < 0 ) { // Zoom in
        start_f = Math.floor ( START_FREQ/1000 ) + delta_freq_10percent;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq_10percent;
        
        if ( stop_f - start_f < SWEEP_POINTS )
            return;
    } else if ( e.deltaX < 0 ) { // Move left
        start_f = Math.floor ( START_FREQ/1000 ) - delta_freq_10percent;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq_10percent;
    } else if ( e.deltaX > 0 ) { // Move right
        start_f = Math.floor ( START_FREQ/1000 ) + delta_freq_10percent;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq_10percent;
    }

    BAND_DETAILS = "";
    sendAnalyzer_SetConfig ( start_f, stop_f );
});

document.addEventListener ( "keydown", function ( e ) {
    let start_f = 0, stop_f = 0;
    let delta_freq_10percent = Math.floor ( ( ( Math.floor(STOP_FREQ/1000) - Math.floor(START_FREQ/1000) ) / 100 ) * 10 ); // 10% of freq range
    let delta_freq_30percent = Math.floor ( ( ( Math.floor(STOP_FREQ/1000) - Math.floor(START_FREQ/1000) ) / 100 ) * 30 ); // 30% of freq range
    let delta_freq_50percent = Math.floor ( ( ( Math.floor(STOP_FREQ/1000) - Math.floor(START_FREQ/1000) ) / 100 ) * 50 ); // 50% of freq range

    switch ( e.keyCode ) {
        case 37: // Arrow left
            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks down
                if ( chPreset_Preset > 1 ) {
                    chPreset_Preset--;

                    if ( FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] && chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset)
                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                    myChart.update();
                }
                return;
            } else if ( e.shiftKey && !e.ctrlKey ) { // Move frequency band to left by 50% of span
                start_f = Math.floor ( START_FREQ/1000 ) - delta_freq_50percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq_50percent;
            } else if ( !e.shiftKey && !e.ctrlKey ) { // Move frequency band to left by 10% of span
                start_f = Math.floor ( START_FREQ/1000 ) - delta_freq_10percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq_10percent;
            }

            BAND_DETAILS    = "";
            break;

        case 39: // Arrow right
            if ( e.ctrlKey && !e.shiftKey ) { // Toggle vendor specific channel presets/banks up
                if ( FREQ_VENDOR_PRESETS [chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series] && chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset) {
                    if ( chPreset_Preset <  FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length ) {
                        chPreset_Preset++;
                        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                        myChart.update();
                    }
                }
                return;
            } else if ( e.shiftKey && !e.ctrlKey ) { // Move frequency band to right by 50% of span
                start_f = Math.floor ( START_FREQ/1000 ) + delta_freq_50percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq_50percent;
            } else if ( !e.shiftKey && !e.ctrlKey ) { // Move frequency band to right by 10% of span
                start_f = Math.floor ( START_FREQ/1000 ) + delta_freq_10percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq_10percent;
            }

            BAND_DETAILS    = "";
            break;

        case 38: // Zoom in
            if ( !e.shiftKey ) { // Zoom in by removing 10% of span on both sides ( = 20% ) if SHIFT not pressed
                start_f = Math.floor ( START_FREQ/1000 ) + delta_freq_10percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq_10percent;
            } else { // Zoom in by removing 30% of span on both sides ( = 60% ) if SHIFT is pressed
                start_f = Math.floor ( START_FREQ/1000 ) + delta_freq_30percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq_30percent;
            }
            
            if ( stop_f - start_f < SWEEP_POINTS )
                return;

            BAND_DETAILS    = "";    
            break;

        case 40: // Zoom out
            if ( !e.shiftKey ) { // Zoom out by adding 10% of span on both sides ( = 20% ) if SHIFT not pressed
                start_f = Math.floor ( START_FREQ/1000 ) - delta_freq_10percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq_10percent;
            } else { // Zoom out by adding 30% of span on both sides ( = 60% ) if SHIFT is pressed
                start_f = Math.floor ( START_FREQ/1000 ) - delta_freq_30percent;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq_30percent;
            }

            BAND_DETAILS    = "";
            break;

        case 82: // Reset peak
            for ( let i = 0 ; i < SWEEP_POINTS ; i++ )
                myChart.data.datasets[LINE_LIVE].data[i] = undefined;

            myChart.update();
            return;

        case 66: // Go back to last vendor band
            START_FREQ   = LAST_START_FREQ;
            STOP_FREQ    = LAST_STOP_FREQ;
            BAND_DETAILS = configStore.get('band_details');
            start_f = Math.floor ( START_FREQ/1000 );
            stop_f  = Math.floor ( STOP_FREQ /1000 );
            break;

        default:
            return;
    }

    sendAnalyzer_SetConfig ( start_f, stop_f );
});