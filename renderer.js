'use strict'

var { ipcRenderer } = require ( 'electron' );
var SerialPort = require ( 'serialport' );
var Chart      = require ( 'chart.js'   );
const FREQUENCIES = require('require-all')(__dirname +'/frequency_data');

var START_FREQ = undefined;
var STOP_FREQ  = undefined;
var FREQ_STEP  = undefined; // Leaving this value undefined because we take the readout from the device in order to align correctly
var MAX_DBM    = -30;
var MIN_DBM    = -110;

var data_receive_array  = [];
var max_array           = [];
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

let SENNHEISER_CHANNEL_WIDTH   = 96; // +/-48kHz Spitzenhub

var ctx = document.getElementById("graph2d").getContext('2d');
var myChart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [
            {
                label: 'Fill',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                spanGaps: true
            },{
                label: 'Recommended by manuf.',
                backgroundColor: Chart.helpers.color(RECOMMENDED_CHANNELS_COLOR).alpha(0.2).rgbString(),
                borderColor: RECOMMENDED_CHANNELS_COLOR,
                borderWidth: 2,
                pointRadius: 0,
                lineTension: 0,
                fill: 0,
                spanGaps: false
            },{
                label: 'Forbidden',
                backgroundColor: Chart.helpers.color(FORBIDDEN_COLOR).alpha(0.2).rgbString(),
                borderColor: FORBIDDEN_COLOR,
                borderWidth: 2,
                pointRadius: 0,
                fill: 0,
                lineTension: 0,
                spanGaps: false
            },{
                label: 'Live scan',
                backgroundColor: Chart.helpers.color(SCAN_COLOR).alpha(0.2).rgbString(),
                borderColor: SCAN_COLOR,
                pointBackgroundColor: SCAN_COLOR,
                borderWidth: 2,
                fill: 0,
                lineTension: 0.4,
                pointRadius: 1.5
            }
        ],
        options: {
            responsive: true,
            scales: {
                xAxes: [{
                    display:true,
                    scaleLabel: {
                        display: true,
                        labelString: 'MHz'
                    }
                }],
                yAxes: [{
                    stacked: true,
                    ticks: {
                        beginAtZero:true
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'dBm'
                    }
                }]
            }
        }
    }
});

function InitChart () {
    myChart.data.labels = [];
    data_receive_array  = [];
    max_array           = [];
    receiving_new_sweep = false;

    for ( var freq = START_FREQ; freq <= STOP_FREQ ; freq += FREQ_STEP ) {
        let freq_str = Math.round(freq).toString();
        let str_len  = freq_str.length;
        freq_str = [freq_str.slice(0, str_len-3), '.', freq_str.slice(str_len-3)].join('');
        myChart.data.labels.push (freq_str);
    }

    myChart.data.datasets[0].data = [];
    myChart.data.datasets[1].data = [];
    myChart.data.datasets[2].data = [];
    myChart.data.datasets[3].data = [];

    // Initialize all values of all graphs (except the scan graph) with lowest dBm value
    for ( let i = 0 ; i < 112 ; i++ ) {
        myChart.data.datasets[0].data[i] = MIN_DBM; // Flat line
        myChart.data.datasets[1].data[i] = undefined; // Sennheiser
        myChart.data.datasets[2].data[i] = undefined; // LTE
//        myChart.data.datasets[3].data[i] = MIN_DBM; // Scan
    }

    // Forbidden frequencies
    for ( var f of FREQUENCIES.forbidden ) {
        let left_data_point  = Math.round ( (f.start - START_FREQ) / FREQ_STEP );
        let right_data_point = Math.round ( (f.end   - START_FREQ) / FREQ_STEP );

        if ( left_data_point < 0 )
            left_data_point = 0;
        if ( left_data_point > 111 )
            left_data_point = 111;
        if ( right_data_point < 0 )
            right_data_point = 0;
        if ( right_data_point > 111 )
            right_data_point = 111;

        let data_point = left_data_point;
 
        while ( data_point <= right_data_point ) {
            myChart.data.datasets[2].data[data_point] = MAX_DBM;
            data_point++;
        }
    }

    // Sennheiser frequencies
    for ( var s of FREQUENCIES.sennheiser_g3_e[2] ) {
        let left_freq_edge  = s - SENNHEISER_CHANNEL_WIDTH/2;
        let left_data_point = Math.round ( (left_freq_edge - START_FREQ) / FREQ_STEP );
        let right_freq_edge = s + SENNHEISER_CHANNEL_WIDTH/2;
        let right_data_point = Math.round ( (right_freq_edge - START_FREQ) / FREQ_STEP );

        if ( left_data_point < 0 )
            left_data_point = 0;
        if ( left_data_point > 111 )
            left_data_point = 111;
        if ( right_data_point < 0 )
            right_data_point = 0;
        if ( right_data_point > 111 )
            right_data_point = 111;

        let data_point = left_data_point;
        
        if ( left_data_point-1 >= 0 && left_data_point-1 <= 112 )
            myChart.data.datasets[1].data[left_data_point-1] = MIN_DBM;
        
        while ( data_point <= right_data_point ) {
            myChart.data.datasets[1].data[data_point] = MAX_DBM;
            data_point++;
        }

        if ( right_data_point+1 >= 0 && right_data_point+1 <= 112 )
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
function sendAnalyzerSetConfig ( start_freq, stop_freq ) {
    START_FREQ = start_freq;
    STOP_FREQ  = stop_freq;
    var config_buf = Buffer.from ( '#0C2-F:0'+START_FREQ+',0'+STOP_FREQ+',-0'+Math.abs(MAX_DBM).toString()+','+MIN_DBM.toString(), 'ascii' ); // Second character will be replaced in next line by a binary lenght value
    config_buf.writeUInt8 ( 0x20, 1 );
    port.write ( config_buf, 'ascii', function(err) { if ( err ) return console.log ( 'Error on write: ', err.message ); });
    setTimeout ( () => {sendAnalyzerGetConfig().then ( () => {
        InitChart ();        
    });}, 500);
}


/***********************************/
/*    Receive data from device     */
/***********************************/
port.on ( 'data', function ( data ) {
    if ( data.includes('$Sp') ) { //p = 112 bytes to receive
        data_receive_array = [];
        receiving_new_sweep = true;
        return;
    } else if ( data.includes('#C2-F:') ) {
        let start_freq_idx = data.indexOf('#C2-F:') + 6;
        let start_freq_step_idx = data.indexOf(',', start_freq_idx) + 1;

        let analyzer_cur_start_freq = parseInt ( data.slice ( start_freq_idx, start_freq_step_idx) );
        let analyzer_cur_freq_step  = parseInt ( data.slice ( start_freq_step_idx, data.indexOf(',', start_freq_step_idx)) );

        START_FREQ = analyzer_cur_start_freq;
        STOP_FREQ  = Math.floor ( (analyzer_cur_freq_step * 112) / 1000 ) + START_FREQ;
        FREQ_STEP  = analyzer_cur_freq_step / 1000; //Device sends step in Hz not kHz !!
        analyzerGetConfigPromise_Resolve();
        return;
    }

    if ( receiving_new_sweep ) {
        for ( var byte of data ) {
            data_receive_array.push ( -(byte/2) );

            if ( data_receive_array.length === 112 ) {
                receiving_new_sweep = false;

                if ( !max_array.length ) {
                    max_array = data_receive_array.slice();
                } else {
                    for ( var i = 0 ; i < data_receive_array.length ; i++ ) {
                        if ( data_receive_array[i] > max_array[i] )
                            max_array[i] = data_receive_array[i];
                    }
                }

                if ( !myChart.data.datasets[3].data.length ) {
                    myChart.data.datasets[3].data = max_array.slice();
                    myChart.update();
                } else {
                    var val_changed = false;

                    for ( var i = 0 ; i < max_array.length ; i++ ) {
                        if ( max_array[i] > myChart.data.datasets[3].data[i] ) {
                            myChart.data.datasets[3].data[i] = max_array[i];
                            val_changed = true;
                        }
                    }

                    if ( val_changed )
                        myChart.update();
                }
            }    
        }
    }
});

ipcRenderer.on ( 'CHANGE_FREQ', (event, message) => {
    sendAnalyzerSetConfig ( message.start_freq, message.stop_freq );
})