'use strict'

var vis = require ('vis');
var Chart = require('chart.js');

var global.START_FREQ = 821000;
var global.STOP_FREQ  = 866000;
var MAX_DBM    = -20;
var MIN_DBM    = -110;

/*
red: 'rgb(255, 99, 132)',
orange: 'rgb(255, 159, 64)',
yellow: 'rgb(255, 205, 86)',
green: 'rgb(75, 192, 192)',
blue: 'rgb(54, 162, 235)',
purple: 'rgb(153, 102, 255)',
grey: 'rgb(201, 203, 207)'
*/

var ctx = document.getElementById("graph2d").getContext('2d');
var myChart = new Chart(ctx, {
    type: 'line',
    data: {
        datasets: [
            {
                label: 'Scan',
                backgroundColor: ['rgba(54, 162, 235,0.2)'],
                borderColor:     ['rgba(54, 162, 235,1)'],
                pointBackgroundColor: 'rgba(54, 162, 235,1)',
                borderWidth: 2,
                fill: 2,
                lineTension: 0.4,
                pointRadius: 2
            },{
                label: 'Sennheiser E Band',
                backgroundColor: ['rgba(153,102,255,0.2)' ],
                borderColor:     ['rgba(153, 102, 255, 1)'],
                borderWidth: 2,
                pointRadius: 0,
                fill: 2,
                spanGaps: true
            },{
                label: '',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                spanGaps: true
            },{
                label: 'LTE',
                backgroundColor: ['rgba(255, 99, 132, 0.2)'],
                borderColor:     ['rgba(255,99,132,1)'],
                borderWidth: 2,
                pointRadius: 0,
                fill: 2,
                spanGaps: true
            }

        ],
        options: {
            scales: {
                xAxes: [{
                    display:true,
                    scaleLabel: {
                        display: true,
                        labelString: 'MHz'
                    }
                }],
                yAxes: [{
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

var freq_step  = Math.round ( (global.STOP_FREQ - global.START_FREQ) / 112 );

for ( var freq = global.START_FREQ; freq < global.STOP_FREQ ; freq += freq_step  ) {
    let freq_str = freq.toString();
    let str_len = freq_str.length;

    freq_str = [freq_str.slice(0, str_len-3), '.', freq_str.slice(str_len-3)].join('');
    myChart.data.labels.push (freq_str);
}

var sennheiser_e = [ 823000, 823875, 824500, 827175 ];
var blocked = [
    [ 832000, 862000 ],
    [ 790000, 821000 ]
];

for ( let i = 0 ; i < 112 ; i++ ) {
    myChart.data.datasets[1].data[i] = MIN_DBM; // Senneiser
    myChart.data.datasets[2].data[i] = MIN_DBM; // Flat line
    myChart.data.datasets[3].data[i] = MIN_DBM; // LTE
}

// Blocked frequencies
for ( var b of blocked ) {
    let left_data_point  = Math.round ( (b[0] - global.START_FREQ) / freq_step );
    let right_data_point = Math.round ( (b[1] - global.START_FREQ) / freq_step );

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
        myChart.data.datasets[3].data[data_point] = MAX_DBM;
        data_point++;
    }
}


// Sennheiser frequencies
for ( var s of sennheiser_e ) {
    let left_freq_edge  = s - 200; // Subtract 200kHz
    let left_data_point = Math.round ( (left_freq_edge - global.START_FREQ) / freq_step );
    let right_freq_edge = s + 200; // Add 200kHz
    let right_data_point = Math.round ( (right_freq_edge - global.START_FREQ) / freq_step );

    if ( left_data_point < 0 )
        left_data_point = 0;
    if ( left_data_point > 111 )
        left_data_point = 111;
    if ( right_data_point < 0 )
        right_data_point = 0;
    if ( right_data_point > 111 )
        right_data_point = 111;

    myChart.data.datasets[1].data[left_data_point-1] = MIN_DBM;
    let data_point = left_data_point;
    
    while ( data_point <= right_data_point ) {
        myChart.data.datasets[1].data[data_point] = MAX_DBM;
        data_point++;
    }

    myChart.data.datasets[1].data[right_data_point+1] = MIN_DBM;
}

myChart.update();

// specify options
var options = {
    width:  '100%',
    height: '100%',
    style: 'surface',
    showPerspective: true,
    showGrid: false,
    showShadow: false,
    keepAspectRatio: true,
    verticalRatio: 0.5,
    zMax: -70,
    xLabel: "MHz",
    yLabel: "dBm"
};

// Instantiate our graph object.
var container = document.getElementById('graph3d');
var graph3d = new vis.Graph3d ( container );
graph3d.setOptions ( options );

var SerialPort = require("serialport");

var port = new SerialPort("COM2", { baudRate : 500000 }, function ( err ) {
    if (err) return console.log('Error: ', err.message);

    var buf = Buffer.from('#0C0', 'ascii');
    buf.writeUInt8 ( 0x4, 1 );

    port.write ( buf, 'ascii', function(err) {
        if ( err )
            return console.log('Error on write: ', err.message);
    });
});

var receiving_new_sweep = false;
var data_receive_array = [];
var max_array = [];
var counter = 0;

port.on ( 'data', function ( data ) {
    if ( data.length === 3 && data.includes('$Sp') ) { //p = 112 bytes to receive
        data_receive_array = [];
        receiving_new_sweep = true;
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

                var data3d = new vis.DataSet();

                for ( var val of max_array ) {
                    data3d.add ({ x: counter, y: 0, z: val });
                    data3d.add ({ x: counter, y: 1, z: val });

                    if ( counter >= 68 && counter <= 72 ) {
                        data3d.add ({ x: counter, y: 2, z: -70 });
                        data3d.add ({ x: counter, y: 6, z: -70 });
                    } else {
                        data3d.add ({ x: counter, y: 2, z: -120 });
                        data3d.add ({ x: counter, y: 6, z: -120 });
                    }
                    counter++;
                }

                if ( !myChart.data.datasets[0].data.length )
                    myChart.data.datasets[0].data = max_array.slice();
                else {
                    var val_changed = false;

                    for ( var i = 0 ; i < max_array.length ; i++ ) {
                        if ( max_array[i] > myChart.data.datasets[0].data[i] ) {
                            myChart.data.datasets[0].data[i] = max_array[i];
                            val_changed = true;
                        }
                    }

                    if ( val_changed )
                        myChart.update();
                }

                
                
                graph3d.setData ( data3d );
                counter = 0;
            }    
        }
    }
});