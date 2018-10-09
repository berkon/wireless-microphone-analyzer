'use strict'

var { ipcRenderer } = require ( 'electron' );
var SerialPort = require ( 'serialport' );
var Chart      = require ( 'chart.js'   );
const FREQUENCIES = require('require-all')(__dirname +'/frequency_data');

var START_FREQ = undefined;
var STOP_FREQ  = undefined;
var FREQ_STEP  = undefined;
var MAX_DBM    = -30;
var MIN_DBM    = -110;
var SWEEP_POINTS = 112;
var CHANNEL_TABLE = undefined;

var data_receive_array  = [];
var receiving_new_sweep = false;

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
                label: 'Live scan',
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

function InitChart () {
    myChart.data.labels = [];
    data_receive_array  = [];
    receiving_new_sweep = false;

    for ( var freq = START_FREQ; freq <= STOP_FREQ ; freq += FREQ_STEP )
        myChart.data.labels.push ( Math.round ( freq/1000 ) / 1000 );

    myChart.data.datasets[0].data = [];
    myChart.data.datasets[1].data = [];
    myChart.data.datasets[2].data = [];

    // Initialize all values of all graphs (except the scan graph) with lowest dBm value
    for ( let i = 0 ; i < SWEEP_POINTS ; i++ ) {
        myChart.data.datasets[1].data[i] = undefined; // Recommended
        myChart.data.datasets[2].data[i] = undefined; // Forbidden
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

    // Forbidden frequencies
    for ( var f of FREQUENCIES.forbidden ) {
        if ( !isInRange ( f.start*1000, f.stop*1000) )
            continue;

        let left_data_point  = alignToBoundary ( Math.round ( (f.start * 1000 - START_FREQ) / FREQ_STEP ) );
        let right_data_point = alignToBoundary ( Math.round ( (f.stop  * 1000 - START_FREQ) / FREQ_STEP ) );
        let data_point = left_data_point;
 
        while ( data_point <= right_data_point ) {
            myChart.data.datasets[2].data[data_point] = MAX_DBM;
            data_point++;
        }
    }

    // Recommended frequencies
if (!CHANNEL_TABLE) CHANNEL_TABLE = 'SEN_E_G3';
    for ( var s of FREQUENCIES[CHANNEL_TABLE][2] ) {
        let left_freq_edge  = s*1000 - SENNHEISER_CHANNEL_WIDTH/2;
        let right_freq_edge = s*1000 + SENNHEISER_CHANNEL_WIDTH/2;

        if ( isForbidden ( left_freq_edge, right_freq_edge ) || !isInRange ( left_freq_edge, right_freq_edge) )
            continue;

        let left_data_point  = alignToBoundary ( Math.round ( (left_freq_edge  - START_FREQ) / FREQ_STEP ) );
        let right_data_point = alignToBoundary ( Math.round ( (right_freq_edge - START_FREQ) / FREQ_STEP ) );
        let data_point       = left_data_point;
        
        if ( left_data_point - 1 >= 0 )
            myChart.data.datasets[1].data[left_data_point-1] = MIN_DBM;
        
        while ( data_point <= right_data_point ) {
            myChart.data.datasets[1].data[data_point] = MAX_DBM;
            data_point++;
        }

        if ( right_data_point + 1 < SWEEP_POINTS )
            myChart.data.datasets[1].data[right_data_point+1] = MIN_DBM;
    }

    myChart.update();
}

var port = new SerialPort ( "COM2", { baudRate : 500000 }, function ( err ) {
    if ( err ) {
        console.log ( 'Error: ', err.message );
        return;
    }

    sendAnalyzerGetConfig ().then ( () => {
        InitChart ();
    })
});

// Receive device configuration for confirming configured values and start receiving analyzer data.
var analyzerGetConfigPromise_Resolve = null;
var analyzerGetConfigPromise = new Promise ( (resolve, reject) => {
    var buf = Buffer.from ( '#0C0', 'ascii' );
    buf.writeUInt8 ( 0x4, 1 );
    port.write ( buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });
    analyzerGetConfigPromise_Resolve = resolve;
});

function sendAnalyzerGetConfig () {
    return analyzerGetConfigPromise;
}

// Configure analyzer device
function sendAnalyzerSetConfig ( start_freq, stop_freq, label, id ) {
    var config_buf = Buffer.from ( '#0C2-F:0'+start_freq+',0'+stop_freq+',-0'+Math.abs(MAX_DBM).toString()+','+MIN_DBM.toString(), 'ascii' ); // Second character will be replaced in next line by a binary lenght value
    START_FREQ = start_freq * 1000;
    STOP_FREQ  = stop_freq  * 1000;
    CHANNEL_TABLE = id;
    config_buf.writeUInt8 ( 0x20, 1 );
    port.write ( config_buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });
    setTimeout ( () => {sendAnalyzerGetConfig().then ( () => {
        myChart.options.scales.xAxes[0].scaleLabel.labelString = label;
        InitChart ();        
    });}, 500);
}


/***********************************/
/*    Receive data from device     */
/***********************************/
port.on ( 'data', function ( data ) {
    if ( data.includes('$Sp') ) { //p = SWEEP_POINTS bytes to receive
        data_receive_array = [];
        receiving_new_sweep = true;
        return;
    } else if ( data.includes('#C2-F:') ) {
        let start_freq_idx = data.indexOf('#C2-F:') + 6;
        let start_freq_step_idx = data.indexOf(',', start_freq_idx) + 1;
        
        START_FREQ = parseInt ( data.slice ( start_freq_idx, start_freq_step_idx) ) * 1000;
        FREQ_STEP  = parseInt ( data.slice ( start_freq_step_idx, data.indexOf(',', start_freq_step_idx)) );
        STOP_FREQ  = Math.floor ( FREQ_STEP * SWEEP_POINTS ) + START_FREQ;
        analyzerGetConfigPromise_Resolve();
        return;
    }

    if ( receiving_new_sweep ) {
        for ( var byte of data ) {
            data_receive_array.push ( -(byte/2) );

            if ( data_receive_array.length === SWEEP_POINTS ) {
                var val_changed = false;
                receiving_new_sweep = false;

                for ( let i = 0 ; i < data_receive_array.length ; i++ ) {
                    if ( data_receive_array[i] > myChart.data.datasets[0].data[i] || myChart.data.datasets[0].data[i] === undefined ) {
                        myChart.data.datasets[0].data[i] = data_receive_array[i];
                        val_changed = true;
                    }
                }

                if ( val_changed )
                    myChart.update();
            }    
        }
    }
});

ipcRenderer.on ( 'CHANGE_FREQ', (event, message) => {
    sendAnalyzerSetConfig ( message.start_freq, message.stop_freq, message.label, message.id );
})