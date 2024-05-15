// API information taken from : https://github.com/RFExplorer/RFExplorer-for-.NET/wiki/RF-Explorer-UART-API-interface-specification

const { DelimiterParser } = require ( '@serialport/parser-delimiter');

class RFExplorer {
    static NAME     = 'RF Explorer';
    static HW_TYPE   = 'RF_EXPLORER';
    static BAUD_RATE = 500000;
    static MIN_SPAN = 112000
    static deviceCommands = {
        GET_CONFIG: '#0C0', // Get current configuration
        SET_CONFIG: '#0C2-F:'
    };
    static deviceEvents = {
        NAME: 'RF Explorer',
        DEVICE_DATA: '#C2-M:',  // '#C2-M:' = model, config and firmware
        CONFIG_DATA: '#C2-F:',  // '#C2-F:' = config data from scan device
        SCAN_DATA: '$S' // '$S' = sweep data, 'p' = ASCII code 112 ( 112 sweep points will be received) 'à' = ASCII code 224 ( 224 sweep points will be received)        
        //'#CAL:',
        //'#QA:',
        //'#Sn'
    }

    SERIAL_RESPONSE_TIMEOUT = 1500

    port                 = undefined;
    received_config_data = false;

    constructor (port) {
        this.port = port
    }

    getConfiguration () {
        let buf = Buffer.from ( RFExplorer.deviceCommands.GET_CONFIG )
        buf.writeUInt8 ( 0x4, 1 )
        log.info ( `Probing for '${this.constructor.NAME}' hardware (with cmd: '${buf.toString()}' ) ...` )

        this.port.write ( buf, 'ascii', function(err) {
            if ( err ) {
                log.error ( err )
            }
        });
    }

    async setConfiguration ( startFreq, stopFreq, sweepPoints ) {
        const startFreqStr = Math.floor(startFreq/1000).toString().padStart(7, '0')
        const stopFreqStr  = Math.floor(stopFreq/1000).toString().padStart(7, '0')

        // Set DSP mode. Cp0 = Auto ; Cp1 = Filter ; Cp2 = Fast
//      var config_buf = Buffer.from ( '#0Cp0', 'ascii' ); // Second character will be replaced in next line by a binary lenght value
//      config_buf.writeUInt8 ( 0x05, 1 );
//      this.port.write ( config_buf, 'ascii', function(err) { if ( err ) return log.info ( 'Error on write: ', err.message ); });

        log.info ( `Setting frequency configuration to start: ${startFreqStr} stop: ${stopFreqStr} ...` )
        let sendBuf = Buffer.from ( RFExplorer.deviceCommands.SET_CONFIG+startFreqStr+','+stopFreqStr+',-0'+Math.abs(global.global.MAX_DBM).toString()+','+global.MIN_DBM.toString(), 'ascii' ); // Second character will be replaced in next line by a binary lenght value
        sendBuf.writeUInt8 ( 0x20, 1 );

        if ( global.MX_LINUX_WORKAROUND ) {
            let sendBuf2 = Buffer.from ( RFExplorer.deviceCommands.GET_CONFIG )  // Workaround for issue with MX Linux (app only works once, then RF explorer must be restarted)
            sendBuf2.writeUInt8 ( 0x4, 1 ) // Workaround for issue with MX Linux (app only works once, then RF explorer must be restarted)
            try {
                await this.port.writePromise ( sendBuf2, 'ascii' ) // Workaround for issue with MX Linux (app only works once, then RF explorer must be restarted)
                await this.port.writePromise ( sendBuf, 'ascii' )
            } catch (err) {
                log.error ("Unable to write to serial port: " + err)
            }
        } else {
            await this.port.writePromise ( sendBuf, 'ascii' )
        }
    }

    setHandler (data$) {
        log.info ( `Setting handler for ${RFExplorer.NAME} data receiption ... ` )
        const parser = this.port.pipe(new DelimiterParser({ delimiter: '\r\n' }))

        parser.on ( 'data', (res) => {
            let buf = String.fromCharCode.apply ( null, res )

            for ( let deviceEventType in this.constructor.deviceEvents ) {
                let deviceEvent = this.constructor.deviceEvents[deviceEventType]

                if ( buf.indexOf ( deviceEvent ) !== -1 ) {
                    if ( deviceEventType === 'NAME') {
                        log.info ( `Received device name string '${buf}'` )
                        data$.next([{
                            type: 'NAME',
                            values: {
                                NAME: deviceEvent
                            }
                        }])
                        return
                    }

                    const dataLength = parseInt ( deviceEvent === RFExplorer.deviceEvents.SCAN_DATA ? buf[deviceEvent.length]  : (buf.length - deviceEvent.length) )
                    const data = buf.substring  ( deviceEvent === RFExplorer.deviceEvents.SCAN_DATA ? (deviceEvent.length + 1) : deviceEvent.length ) // +1 to exclude the byte following the message ID which contains the number of sweep points

                    switch ( deviceEvent ) {
                        case this.constructor.deviceEvents.CONFIG_DATA: // Received config data from scan device
                            this.received_config_data = true
                            log.info ( "Received config data:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )

                            let res_arr = data.split ( "," )

                            const starFreq    = parseInt ( res_arr[0] ) * 1000 // Start frequency returned in kHz thus multiply by 1000
                            const freqStep    = parseInt ( res_arr[1] )        // Frequency step returned in Hz
                            const sweepPoints = parseInt ( res_arr[4] )        // Number of sweep points

                            data$.next([{
                                type: 'CONFIG_DATA',
                                values: {
                                    START_FREQ: starFreq,
                                    FREQ_STEP: freqStep,
                                    SWEEP_POINTS: sweepPoints,
                                    STOP_FREQ:  ( freqStep * (sweepPoints-1) ) + starFreq,
                                    MIN_FREQ: parseInt ( res_arr[7] ) * 1000, // Minimum frequency returned in kHz thus multiply by 1000
                                    MAX_FREQ: parseInt ( res_arr[8] ) * 1000, // Maximum frequency returned in kHz thus multiply by 1000
                                    MAX_SPAN: parseInt ( res_arr[9] ) * 1000 // Maximum span returned in kHz thus multiply by 1000
                                }
                            }])
                            RFExplorer.MIN_FREQ = parseInt ( res_arr[7] ) * 1000
                            RFExplorer.MAX_FREQ = parseInt ( res_arr[8] ) * 1000
                            break

                        case '#CAL:': // Calibration data ?? (nothing in the docs)
                        case '#QA:': // Quality data ?? (nothing in the docs)
                            log.info ( "Received data:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )
                            break

                        case '#Sn': // Serial number
                            log.info ( "Received serial number:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )
                            break

                        case this.constructor.deviceEvents.DEVICE_DATA: // Model, setup and firmware
                            log.info ( "Received model, setup and firmware version:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )
                            break

                        case this.constructor.deviceEvents.SCAN_DATA:
                            if ( this.received_config_data ) {
                                data$.next([{
                                    type: "SCAN_DATA",
                                    values: data
                                }])
                            }
                            break
                    }
                }
            }            
        })
    }

    static isValidFreqConfig ( startFreq, stopFreq ) {
        if ( startFreq < RFExplorer.MIN_FREQ || stopFreq > RFExplorer.MAX_FREQ || startFreq >= stopFreq) {
            log.error ( "Invalid frequency configuration: " + startFreq + " / " + stopFreq )
            return false
        } else {
            return true
        }
    }
}

module.exports = RFExplorer;