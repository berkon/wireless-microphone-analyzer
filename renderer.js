'use strict'

const { ipcRenderer } = require ( 'electron'    );
const ConfigStore     = require ( 'configstore' );
const SerialPort      = require ( 'serialport'  );
const Chart           = require ( 'chart.js'    );
const FREQ_VENDOR_PRESETS = require ( 'require-all' )(__dirname +'/frequency_data/presets'  );
const FREQ_FORBIDDEN      = require ( 'require-all' )(__dirname +'/frequency_data/forbidden');
const Pkg             = require ('./package.json');
const { dialog }      = require ('electron'     ).remote;

const configStore = new ConfigStore ( Pkg.name );

var START_FREQ = undefined;
var STOP_FREQ  = undefined;
var FREQ_STEP  = undefined;

var MAX_DBM    = -20;
var MIN_DBM    = -110;
var CONGESTION_LEVEL_DBM = -85;

var SWEEP_POINTS = 112;
var VENDOR_ID  = 'NON';

var LINE_LIVE        = 0;
var LINE_RECOMMENDED = 1;
var LINE_FORBIDDEN   = 2;
var LINE_CONGESTED   = 3;
var LINE_CONGEST_TRESH = 4;

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

let SENNHEISER_CHANNEL_WIDTH   = 96000; // +/-48kHz Spitzenhub

var analyzerGetConfigPromise_Resolve = null;
var port = undefined;
var autoPortCheckTimer = undefined;

let chPreset_Vendor = configStore.get('chPreset.vendor');
let chPreset_Band   = configStore.get('chPreset.band'  );
let chPreset_Series = configStore.get('chPreset.series');
let chPreset_Preset = configStore.get('chPreset.preset');

var chDispValShadowArr = [];

var ctx = document.getElementById("graph2d").getContext('2d');
var myChart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [
            {
                label: 'Live scan (peak hold)',
                backgroundColor: Chart.helpers.color(SCAN_COLOR).alpha(0.2).rgbString(),
                borderColor: SCAN_COLOR,
                pointBackgroundColor: SCAN_COLOR,
                borderWidth: 2,
                pointRadius: 1.5,
                fill: 'start',
                lineTension: 0.4
            },{
                label: 'Recommended manuf. channels',
                backgroundColor: Chart.helpers.color(RECOMMENDED_CHANNELS_COLOR).alpha(0.5).rgbString(),
                borderColor: RECOMMENDED_CHANNELS_COLOR,
                borderWidth: 0.01, // 0 is not working!
                pointRadius: 0,
                fill: 'start',
                lineTension: 0,
                spanGaps: false
            },{
                label: 'Forbidden ranges',
                backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.2).rgbString(),
                borderColor: FORBIDDEN_COLOR,
                borderWidth: 0.01, // 0 is not working!
                pointRadius: 0,
                fill: 'start',
                lineTension: 0,
                spanGaps: false
            },{
                label: 'Congested / forbidden channels',
                backgroundColor: Chart.helpers.color(CONGESTED_COLOR).alpha(0.5).rgbString(),
                borderColor: CONGESTED_COLOR,
                borderWidth: 0.01, // 0 is not working!
                pointRadius: 0,
                fill: 'start',
                lineTension: 0,
                spanGaps: false
            },{
                label: 'Congest_Thresh',
                backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.5).rgbString(),
                borderColor: FORBIDDEN_COLOR,
                borderWidth: 2, // 0 is not working!
                pointRadius: 0,
                fill: 'none',
                lineTension: 0,
                spanGaps: true
            }
        ]
    },
    options: {
    //    animation: false,
        responsive: true,
        legend: {
            labels :  {
                filter: (legendItem, chartData) => {
                    if ( legendItem.datasetIndex === 0 || legendItem.datasetIndex === 4 )
                        return false;
                    else
                        return true;
                }
            }
        },
        scales: {
            xAxes: [{
                scaleLabel: {
                    display: true,
                    labelString: 'MHz'
                }
            },{
                position: "top",
                weight: 1,
                labels: [],
                offset: true,
                gridLines: { display: false },
                ticks: { 
                    autoSkip: false,
                    fontColor: '#FF6384'
                }
            },{
                position: "top",
                weight: 0,
                labels: [],
                gridLines: { display: false },
                ticks: { 
                    autoSkip: false,
                    fontColor: '#4BDEC0'
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
    for ( var f of FREQ_FORBIDDEN.forbidden_DE ) {
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

        while ( data_point <= right_data_point ) {
            myChart.data.datasets[LINE_FORBIDDEN].data[data_point] = MAX_DBM;
            data_point++;
        }
    }
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
    for ( var f of FREQ_FORBIDDEN.forbidden_DE ) {
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

function InitChart () {
    myChart.data.labels = [];

    for ( var freq = START_FREQ; freq <= STOP_FREQ ; freq += FREQ_STEP ) {
        let val = Math.round ( freq / 1000 ) / 1000
        val = val.toString();
        
        if ( val.length < 7 ) {
            if ( !val.includes(".") )
                val += ".000";
            else
                while ( val.length < 7 )
                    val += "0";
        }

        myChart.data.labels.push ( val );
    }

    // Initialize all values of all graphs (except the scan graph) with lowest dBm value
    for ( let i = 0 ; i < SWEEP_POINTS ; i++ ) {
        myChart.data.datasets[LINE_LIVE].data[i]        = undefined; // Live scan
        myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined; // Recommended
        myChart.data.datasets[LINE_FORBIDDEN].data[i]   = undefined; // Forbidden
        myChart.data.datasets[LINE_CONGESTED].data[i]   = undefined; // Congested
        myChart.data.datasets[LINE_CONGEST_TRESH].data[0] = CONGESTION_LEVEL_DBM;
        myChart.data.datasets[LINE_CONGEST_TRESH].data[SWEEP_POINTS-1] = CONGESTION_LEVEL_DBM;
    }

    for ( let i = 0 ; i < SWEEP_POINTS ; i++ ) {
        myChart.config.options.scales.xAxes[1].labels[i] = '';
        myChart.config.options.scales.xAxes[2].labels[i] = '';
    }

    setForbidden ();

    if ( chPreset_Vendor && chPreset_Band && chPreset_Series && chPreset_Preset)
        setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );

    myChart.update();
}

function openPort () {
    if( !PORT_MENU_SELECTION || PORT_MENU_SELECTION === 'AUTO' ) { // Automatic port selection
        SerialPort.list().then ( (ports, err) => {
            if ( err ) {
                console.log ( err );
                return;
            }

            let i = 0;
            autoPortCheckTimer = setInterval ( () => {
                if ( i === ports.length ) {
                    clearInterval ( autoPortCheckTimer );
                    const dialogOptions = {
                        type: 'error',
                        buttons: ['OK'],
                        message: 'Unable to find RF Explorer hardware!',
                        detail:  '- Make sure that the device is connected\n- Select the corresponding serial port (or leave default: \'Auto\')\n- If it still doesn\'t work please restart the app or press <CTRL><R>!'}
                    dialog.showMessageBox ( dialogOptions, i => console.log("Button " + i + " was pressed!"));
                    console.log ( "Unable to find RF Explorer!");
                    return;
                }
                
                console.log ( "Trying port " + ports[i].comName + " ...");
                port = new SerialPort ( ports[i].comName, { baudRate : 500000 }, function ( err ) {
/*                    if ( err ) {
                        console.log ( 'Error: ', err.message );
                        return;
                    } */

                    setCallbacks();

                    sendAnalyzer_GetConfig ().then ( () => {
                        clearInterval ( autoPortCheckTimer );
                        console.log ( "RF Explorer found!" );
                        InitChart ();
                    });
                });

                i++;
            }, 500);
        });
    } else  {
        port = new SerialPort ( PORT_MENU_SELECTION, { baudRate : 500000 }, function ( err ) {
            if ( err ) {
                console.log ( 'Error: ', err.message );
                return;
            }

            setCallbacks();

            sendAnalyzer_GetConfig ().then ( () => {
                console.log ( "RF Explorer found!" );
                InitChart ();
            });
        });
    }
}

// Receive device configuration for confirming configured values and start receiving analyzer data.
function sendAnalyzer_GetConfig () {
    return new Promise ( (resolve, reject) => {
        var buf = Buffer.from ( '#0C0', 'ascii' );
        buf.writeUInt8 ( 0x4, 1 );
        port.write ( buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });
        analyzerGetConfigPromise_Resolve = resolve;
    });
}

// Configure analyzer device
function sendAnalyzer_SetConfig ( start_freq, stop_freq, label, band ) {
    rec_buf = []; // Buffer for continuosly receiving data
    rec_buf_str = []; // rec_buf converted to string so that we can check for commands
    msg_buf = []; // Once a message is complete, it will be placed in this buffer
    msgStart = -1;
    msgEnd   = -1;
    msgId    = -1;
    rec_buf_sweep_poi = 0;
    let start_freq_str = start_freq.toString();
    let stop_freq_str  = stop_freq.toString();

    while ( start_freq_str.length < 7 )
        start_freq_str = "0" + start_freq_str;

    while ( stop_freq_str.length < 7 )
        stop_freq_str = "0" + stop_freq_str;

    // Set DSP mode. Cp0 = Auto ; Cp1 = Filter ; Cp2 = Fast
    var config_buf = Buffer.from ( '#0Cp0', 'ascii' ); // Second character will be replaced in next line by a binary lenght value
    config_buf.writeUInt8 ( 0x05, 1 );
    port.write ( config_buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });

    config_buf = Buffer.from ( '#0C2-F:'+start_freq_str+','+stop_freq_str+',-0'+Math.abs(MAX_DBM).toString()+','+MIN_DBM.toString(), 'ascii' ); // Second character will be replaced in next line by a binary lenght value
    START_FREQ = start_freq * 1000;
    STOP_FREQ  = stop_freq  * 1000;
    config_buf.writeUInt8 ( 0x20, 1 );
    port.write ( config_buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });

    sendAnalyzer_GetConfig().then ( () => {
        myChart.options.scales.xAxes[0].scaleLabel.labelString = label;
        InitChart ();        
    });
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
            var dataStart = msgStart + msgId.length;
            var val_changed = false;

            msg_buf = rec_buf.slice ( dataStart + rec_buf_sweep_poi, dataStart + 112 );

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

            if ( rec_buf_sweep_poi === 112 ) { // Not waiting to get CR LF here since logic would be more complicated. Instead CR LF will automatically be skipped anyway when searching for next message!
                rec_buf = rec_buf.slice ( dataStart + 112 ); // Remove message from rec_buf including CR LF at end of line
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
                let msg_buf_str = String.fromCharCode.apply ( null, msg_buf ); // Convert to characters
                let start_freq_step_idx = msg_buf_str.indexOf(',') + 1;
                START_FREQ = parseInt ( msg_buf_str.slice ( 0, start_freq_step_idx) ) * 1000;
                FREQ_STEP  = parseInt ( msg_buf_str.slice ( start_freq_step_idx, msg_buf_str.indexOf(',', start_freq_step_idx)) );
                STOP_FREQ  = ( FREQ_STEP * (SWEEP_POINTS-1) ) + START_FREQ;
                analyzerGetConfigPromise_Resolve();
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
    sendAnalyzer_SetConfig ( message.start_freq, message.stop_freq, message.details, message.band );
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

document.addEventListener ( "wheel", function ( e ) {
    let start_f = 0, stop_f = 0;
    //let delta_freq = ( Math.abs(e.deltaY) / 100 ) * 5000;
    let delta_freq = Math.floor ( ( ( Math.floor(STOP_FREQ/1000) - Math.floor(START_FREQ/1000) ) / 100 ) * 10 ); // 10% of freq range

    if ( e.deltaY > 0 ) { // Zoom out
        start_f = Math.floor ( START_FREQ/1000 ) - delta_freq;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq;
    } else if ( e.deltaY < 0 ) { // Zoom in
        start_f = Math.floor ( START_FREQ/1000 ) + delta_freq;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq;
        
        if ( stop_f - start_f < 112 )
            return;
    } else if ( e.deltaX < 0 ) { // Move left
        start_f = Math.floor ( START_FREQ/1000 ) - delta_freq;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq;
    } else if ( e.deltaX > 0 ) { // Move right
        start_f = Math.floor ( START_FREQ/1000 ) + delta_freq;
        stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq;
    }


    let start_f_str = start_f / 1000;
    start_f_str = start_f_str.toString();
    
    let stop_f_str = stop_f / 1000;
    stop_f_str = stop_f_str.toString();

    let span_f_str = (stop_f - start_f) / 1000;
    span_f_str = span_f_str.toString();

    sendAnalyzer_SetConfig ( start_f, stop_f, start_f_str + " - " + stop_f_str + " MHz  (Span: " + span_f_str + "MHz)", "" );
});

document.addEventListener ( "keydown", function ( e ) {
    let start_f = 0, stop_f = 0;
    //let delta_freq = 10000;
    let delta_freq = Math.floor ( ( ( Math.floor(STOP_FREQ/1000) - Math.floor(START_FREQ/1000) ) / 100 ) * 10 ); // 10% of freq range

    switch ( e.keyCode ) {
        case 37: // Arrow left
             if ( !e.ctrlKey ) { // Move freq band to left
                start_f = Math.floor ( START_FREQ/1000 ) - delta_freq;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq;
             } else { // Toggle vendor specific channel presets/banks down
                if ( chPreset_Preset > 1 ) {
                    chPreset_Preset--;
                    setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                    myChart.update();
                }
                return;
             }
            break;

        case 39: // Arrow right
            if ( !e.ctrlKey ) { // Move freq band to right
                start_f = Math.floor ( START_FREQ/1000 ) + delta_freq;
                stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq;
            } else { // Toggle vendor specific channel presets/banks up
                if ( chPreset_Preset <  FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series].length ) {
                    chPreset_Preset++;
                    setVendorChannels ( FREQ_VENDOR_PRESETS[chPreset_Vendor+'_'+chPreset_Band+'_'+chPreset_Series][parseInt(chPreset_Preset)-1], chPreset_Preset );
                    myChart.update();
                }
                return;
            }
            break;

        case 38: // Zoom in
            start_f = Math.floor ( START_FREQ/1000 ) + delta_freq;
            stop_f  = Math.floor ( STOP_FREQ /1000 ) - delta_freq;

            if ( stop_f - start_f < 112 )
                return;
            break;

        case 40: // Zoom out
            start_f = Math.floor ( START_FREQ/1000 ) - delta_freq;
            stop_f  = Math.floor ( STOP_FREQ /1000 ) + delta_freq;
            break;
        default:
            return;
    }

    let start_f_str = start_f / 1000;
    start_f_str = start_f_str.toString();
    
    let stop_f_str = stop_f / 1000;
    stop_f_str = stop_f_str.toString();

    let span_f_str = (stop_f - start_f) / 1000;
    span_f_str = span_f_str.toString();

    sendAnalyzer_SetConfig ( start_f, stop_f, start_f_str + " - " + stop_f_str + " MHz  (Span: " + span_f_str + "MHz)", "" );
});