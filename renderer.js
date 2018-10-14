'use strict'

var { ipcRenderer } = require ( 'electron' );
var SerialPort = require ( 'serialport' );
var Chart      = require ( 'chart.js'   );
const FREQUENCIES = require('require-all')(__dirname +'/frequency_data');

var START_FREQ = undefined;
var STOP_FREQ  = undefined;
var FREQ_STEP  = undefined;
var MAX_DBM    = -20;
var MIN_DBM    = -110;
var SWEEP_POINTS = 112;
var BAND = undefined;
var VENDOR_ID  = 'NON';

var LINE_LIVE        = 0;
var LINE_RECOMMENDED = 1;
var LINE_FORBIDDEN   = 2;

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

let SENNHEISER_CHANNEL_WIDTH   = 96000; // +/-48kHz Spitzenhub

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
                fill: 'start',
                lineTension: 0.4,
                pointRadius: 1.5
            },{
                label: 'Recommended by manuf.',
                backgroundColor: Chart.helpers.color(RECOMMENDED_CHANNELS_COLOR).alpha(0.2).rgbString(),
                borderColor: RECOMMENDED_CHANNELS_COLOR,
                borderWidth: 2,
                pointRadius: 0,
                lineTension: 0,
                fill: 'start',
                spanGaps: true
            },{
                label: 'Forbidden',
                backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.2).rgbString(),
                borderColor: FORBIDDEN_COLOR,
                borderWidth: 2,
                pointRadius: 0,
                fill: 'start',
                lineTension: 0,
                spanGaps: false
            }
        ]
    },
    options: {
        responsive: true,
        scales: {
            xAxes: [{
                scaleLabel: {
                    display: true,
                    labelString: 'MHz'
                }
            }],
            yAxes: [{
                scaleLabel: {
                    display: true,
                    labelString: 'dBm'
                }
            }]
        }
    }
});

function setVendorChannels ( presets ) {
    if ( !presets )
        return;
    
    for ( let i = 0 ; i < SWEEP_POINTS ; i++ )
        myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined;

    for ( var p of presets ) {
        let left_freq_edge  = p*1000 - SENNHEISER_CHANNEL_WIDTH/2;
        let right_freq_edge = p*1000 + SENNHEISER_CHANNEL_WIDTH/2;

        if ( isForbidden ( left_freq_edge, right_freq_edge ) || !isInRange ( left_freq_edge, right_freq_edge) )
            continue;

        let left_data_point  = alignToBoundary ( Math.round ( (left_freq_edge  - START_FREQ) / FREQ_STEP ) );
        let right_data_point = alignToBoundary ( Math.round ( (right_freq_edge - START_FREQ) / FREQ_STEP ) );
        let data_point       = left_data_point;
        
        if ( left_data_point - 1 >= 0 )
            myChart.data.datasets[LINE_RECOMMENDED].data[left_data_point-1] = MIN_DBM;
        
        while ( data_point <= right_data_point ) {
            myChart.data.datasets[LINE_RECOMMENDED].data[data_point] = MAX_DBM;
            data_point++;
        }

        if ( right_data_point + 1 < SWEEP_POINTS )
            myChart.data.datasets[LINE_RECOMMENDED].data[right_data_point+1] = MIN_DBM;
    }
}

function isInRange ( start, stop ) {
    if ( (start >= START_FREQ && start <= STOP_FREQ) || (stop >= START_FREQ && stop <= STOP_FREQ) )
        return true;
    else
        return false;
}

function isForbidden ( start, stop ) {
    for ( var f of FREQUENCIES.forbidden ) {
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
        myChart.data.datasets[LINE_LIVE].data[i] = undefined; // Live scan
        myChart.data.datasets[LINE_RECOMMENDED].data[i] = undefined; // Recommended
        myChart.data.datasets[LINE_FORBIDDEN].data[i] = undefined; // Forbidden
    }

    // Forbidden frequencies
    for ( var f of FREQUENCIES.forbidden ) {
        if ( !isInRange ( f.start*1000, f.stop*1000) )
            continue;

        let left_data_point  = alignToBoundary ( Math.round ( (f.start * 1000 - START_FREQ) / FREQ_STEP ) );
        let right_data_point = alignToBoundary ( Math.round ( (f.stop  * 1000 - START_FREQ) / FREQ_STEP ) );
        let data_point = left_data_point;
 
        while ( data_point <= right_data_point ) {
            myChart.data.datasets[LINE_FORBIDDEN].data[data_point] = MAX_DBM;
            data_point++;
        }
    }

    setVendorChannels ();
    myChart.update();
}

var port = new SerialPort ( "COM2", { baudRate : 500000 }, function ( err ) {
    if ( err ) {
        console.log ( 'Error: ', err.message );
        return;
    }

    sendAnalyzer_GetConfig ().then ( () => {
        InitChart ();
    })
});

var analyzerGetConfigPromise_Resolve = null;

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
    var config_buf = Buffer.from ( '#0C2-F:0'+start_freq+',0'+stop_freq+',-0'+Math.abs(MAX_DBM).toString()+','+MIN_DBM.toString(), 'ascii' ); // Second character will be replaced in next line by a binary lenght value
    START_FREQ = start_freq * 1000;
    STOP_FREQ  = stop_freq  * 1000;
    BAND = band;
    config_buf.writeUInt8 ( 0x20, 1 );
    port.write ( config_buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });
    setTimeout ( () => { sendAnalyzer_GetConfig().then ( () => {
        myChart.options.scales.xAxes[0].scaleLabel.labelString = label;
        InitChart ();        
    });}, 500 );
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
var oldest_msg_idx = undefined; // first completely received message in the buffer ( in case there are more than one )
var msgId = undefined; // Command prefix of the message (see msg_id_array[])

port.on ( 'data', function ( data ) {
    Array.prototype.push.apply ( rec_buf, data ); //Add new data to receive buffer
    rec_buf_str = String.fromCharCode.apply ( null, rec_buf ); // Convert to characters

    for ( var msg_id of msg_id_array ) {
        let idx = rec_buf_str.indexOf ( msg_id );

        if ( idx !== -1 ) {
            if ( oldest_msg_idx === undefined ) {
                oldest_msg_idx = idx;
                msgId = msg_id;
            } else if ( idx < oldest_msg_idx ) {
                oldest_msg_idx = idx;
                msgId = msg_id;
            }
        }
    }

    if ( oldest_msg_idx === undefined ) // If undefined, there is no new message.
        return;

    let msg_end = rec_buf_str.indexOf ('\r\n');

    if ( msg_end != -1 ) {
        msg_buf = rec_buf.slice ( oldest_msg_idx + msgId.length, msg_end );
        rec_buf = rec_buf.slice ( msg_end + 2 ); // Ignore CR LF
    } else
        msg_buf = [];


    oldest_msg_idx = undefined;

    if ( !msg_buf.length )
        return;

    switch ( msgId ) {
        case '$Sp':
            var val_changed = false;

            for ( let i = 0 ; i < msg_buf.length ; i++ ) {
                msg_buf[i] = -( msg_buf[i] / 2 );
        
                if ( msg_buf[i] > myChart.data.datasets[LINE_LIVE].data[i] || myChart.data.datasets[LINE_LIVE].data[i] === undefined ) {
                    myChart.data.datasets[LINE_LIVE].data[i] = msg_buf[i];
                    val_changed = true;
                }
        
                if ( val_changed )
                    myChart.update();
            }
            break;

        case '#C2-F:':
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
});

ipcRenderer.on ( 'CHANGE_BAND', (event, message) => {
    sendAnalyzer_SetConfig ( message.start_freq, message.stop_freq, message.label, message.band );
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
    let vendor = preset_arr[0];
    let band   = preset_arr[1];
    let series = preset_arr[2];
    let preset = preset_arr[3];
    
    setVendorChannels ( FREQUENCIES[vendor+'_'+band+'_'+series][parseInt(preset)-1] );
    myChart.update();
});