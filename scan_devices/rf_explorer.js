// API information taken from : https://github.com/RFExplorer/RFExplorer-for-.NET/wiki/RF-Explorer-UART-API-interface-specification
// API communication examples with RealTerm: https://github.com/RFExplorer/RFExplorer-for-.NET/wiki/API-communication-examples-with-RealTerm
const { DelimiterParser } = require ( '@serialport/parser-delimiter');

class RFExplorer {
    static NAME       = 'RF Explorer'; // Basic device name
    static MODEL      = '' // This divides devices with the same base NAME and HW_TYPE into specific models
    // The device type shares the same API with similar devices. This is e.g. needed for sw to know how a
    // device can be contacted via the serial port.
    static HW_TYPE    = 'RF_EXPLORER';
    static BAUD_RATE  = 500000;

    static MIN_SPAN_BASIC = 112000; // 112 kHz
    static MIN_SWEEP_POINTS_BASIC = 112
    static MAX_SWEEP_POINTS_BASIC = 112
    
    static MIN_SPAN_PLUS  = 112000; // 112 kHz
    static MIN_SWEEP_POINTS_PLUS = 112
    static MAX_SWEEP_POINTS_PLUS = 65535

    static deviceCommands = {
        GET_CONFIG: '#0C0',    // Get current configuration
        SET_CONFIG: '#0C2-F:', // Set configuration
        HOLD: '#0CH',          // Tell the device to stop sending scan data
        SET_SWEEP_POINTS_LARGE :'#0Cj'  // Set number of sweep points up to 65536
    };
    static deviceEvents = {
        NAME: 'RF Explorer',
        DEVICE_DATA: '#C2-M:',     // '#C2-M:' = Main model code, expansion model code and firmware version
        CONFIG_DATA: '#C2-F:',     // '#C2-F:' = config data from scan device
        SCAN_DATA: '$S',           // '$S' = sweep data, 'p' = ASCII code 112 ( 112 sweep points will be received) 'à' = ASCII code 224 ( 224 sweep points will be received)
        SCAN_DATA_LARGE: '$z',     // '$s' = sweep data, 'p' = ASCII code 112 ( 112 sweep points will be received) 'à' = ASCII code 224 ( 224 sweep points will be received)
        CALIBRATION_DATA: '#CAL:', // Calibration data ?? (nothing in the docs)
        QUALITY_DATA: '#QA:',      // Quality data ?? (nothing in the docs)
        SERIAL_NUMBER: '#Sn'       // Serial number
    }

    SERIAL_RESPONSE_TIMEOUT = 1500

    port                 = undefined;
    received_config_data = false;

    constructor (port) {
        this.port = port
    }

    getMinSweepPoints () {
        switch ( RFExplorer.MODEL ) {
            case 'BASIC': return RFExplorer.MIN_SWEEP_POINTS_BASIC;
            case 'PLUS' : return RFExplorer.MIN_SWEEP_POINTS_PLUS;
        }
    }

    getMaxSweepPoints () {
        switch ( RFExplorer.MODEL ) {
            case 'BASIC': return RFExplorer.MAX_SWEEP_POINTS_BASIC;
            case 'PLUS' : return RFExplorer.MAX_SWEEP_POINTS_PLUS;
        }
    }

    getMinSpan() {
        switch ( RFExplorer.MODEL ) {
            case 'BASIC': return RFExplorer.MIN_SPAN_BASIC;
            case 'PLUS' : return RFExplorer.MIN_SPAN_PLUS;
        }
    }

    isValidSweepPointRange ( numOfSweepPoints ) {
        switch ( RFExplorer.MODEL ) {
            case 'BASIC':
                if ( numOfSweepPoints >= RFExplorer.MIN_SWEEP_POINTS_BASIC &&
                     numOfSweepPoints <= RFExplorer.MAX_SWEEP_POINTS_BASIC ) {
                    return true
                } else {
                    return false
                }

            case 'PLUS':
                if ( numOfSweepPoints >= RFExplorer.MIN_SWEEP_POINTS_PLUS &&
                     numOfSweepPoints <= RFExplorer.MAX_SWEEP_POINTS_PLUS ) {
                    return true
                } else {
                    return false
                }       
        }
    }

    getConfiguration () {
        // IMPORTANT: After requesting the configuration data, the device immediately starts sending scan data.
        // No additional command is required!
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
        if ( RFExplorer.isValidFreqConfig(startFreq, stopFreq) === false ) {
            return false
        }

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
                return false
            }
            return true
        } else {
            await this.port.writePromise ( sendBuf, 'ascii' )
            return true
        }
    }

    async setSweepPoints ( numberOfSweepPoints ) {
        log.info ( `Setting number of sweep points to ${numberOfSweepPoints} ...` )
        // Second character will be replaced by a binary lenght value        
        // '00' is just a placeholder for two bytes in the buffer which will be replaced by MSB/LSB
        let sendBuf = Buffer.from ( RFExplorer.deviceCommands.SET_SWEEP_POINTS_LARGE + '00', 'ascii' );
        sendBuf.writeUInt8 ( 0x6, 1 );
        sendBuf.writeUInt8 ( (numberOfSweepPoints & 0xFF00) >> 8, 4 ); // MSB
        sendBuf.writeUInt8 ( numberOfSweepPoints & 0x00FF       , 5 ); // LSB
        await this.port.writePromise ( sendBuf, 'ascii' )
    }

    setHandler (data$) {
        log.info ( `Setting handler for ${RFExplorer.NAME} data receiption ... ` )
        const parser = this.port.pipe(new DelimiterParser({ delimiter: '\r\n' }))

        parser.on ( 'data', (res) => {
            let buf = String.fromCharCode.apply ( null, res )

            // When a command is sent to the device, on newer models of RF Explorer (PLUS variant),
            // the device is transmitting a so called EOS sequence ('End Of Sweep') to acknowledge
            // the end of an ongoing sweep. This sequence is FF FE FF FE 00 (as string: 'ÿþÿþ ').
            // We need to strip these characters before processing the string.
            let eosSequences = [
                { sequence: 'ÿþÿþ\x00#', offset: 5 },
                { sequence: 'þ\x00#'   , offset: 2 },
                { sequence: 'ÿþÿþ\x00$', offset: 5 },
                { sequence: 'þ\x00$'   , offset: 2 }
            ]

            for ( const eosSequence of eosSequences) {
                let eosIdx = buf.indexOf ( eosSequence.sequence )

                if ( eosIdx !== -1 ) {
                    buf = buf.substring ( eosIdx + eosSequence.offset )
                }
            }

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

                    let dataLength = 0;
                    let data = ''

                    switch (deviceEvent) {
                        case RFExplorer.deviceEvents.SCAN_DATA:
                            dataLength = buf.charCodeAt(deviceEvent.length)
                            data = buf.substring  ( deviceEvent.length + 1 ) // +1 to exclude the byte following the message ID which contains the number of sweep points
                            break

                        case RFExplorer.deviceEvents.SCAN_DATA_LARGE:
                            const MSB = buf.charCodeAt(deviceEvent.length)
                            const LSB = buf.charCodeAt(deviceEvent.length + 1)
                            dataLength = (MSB << 8) | LSB;
                            data = buf.substring  ( deviceEvent.length + 2 ) // +2 to exclude the two bytes following the message ID which contain the number of sweep points
                            break

                        default:
                            dataLength = buf.length - deviceEvent.length
                            data = buf.substring ( deviceEvent.length )
                    }

                    switch ( deviceEvent ) {
                        case this.constructor.deviceEvents.CONFIG_DATA: // Received config data from scan device
                            this.received_config_data = true
                            log.info ( "Received config data:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )

                            let res_arr = data.split ( "," )

                            const startFreq   = parseInt ( res_arr[0] ) * 1000 // Start frequency returned in kHz thus multiply by 1000
                            const freqStep    = parseInt ( res_arr[1] )        // Frequency step returned in Hz
                            const sweepPoints = parseInt ( res_arr[4] )        // Number of sweep points
                            const stopFreq    = ( freqStep * (sweepPoints-1) ) + startFreq

                            data$.next([{
                                type: 'CONFIG_DATA',
                                values: {
                                    START_FREQ: startFreq,
                                    FREQ_STEP: freqStep,
                                    SWEEP_POINTS: sweepPoints,
                                    STOP_FREQ: stopFreq,
                                    MIN_FREQ: parseInt ( res_arr[7] ) * 1000, // Minimum frequency returned in kHz thus multiply by 1000
                                    MAX_FREQ: parseInt ( res_arr[8] ) * 1000, // Maximum frequency returned in kHz thus multiply by 1000
                                    MAX_SPAN: parseInt ( res_arr[9] ) * 1000, // Maximum span returned in kHz thus multiply by 1000
                                    MIN_SPAN: this.getMinSpan()
                                }
                            }])
                            global.MIN_FREQ = parseInt ( res_arr[7] ) * 1000
                            global.MAX_FREQ = parseInt ( res_arr[8] ) * 1000

                            log.info(`    Min Freq    : ${global.MIN_FREQ} Hz`)
                            log.info(`    Max Freq    : ${global.MAX_FREQ} Hz`)
                            log.info(`    Start Freq  : ${startFreq} Hz`)
                            log.info(`    Stop Freq   : ${stopFreq} Hz`)
                            log.info(`    Freq Step   : ${freqStep} Hz`)
                            log.info(`    Sweep points: ${sweepPoints} Hz`)
                            log.info(`    Max Span    : ${parseInt ( res_arr[9] ) * 1000} Hz`)
                            break

                        case this.constructor.deviceEvents.CALIBRATION_DATA:
                            log.info ( "Received calibration data:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )
                            break;

                        case this.constructor.deviceEvents.QUALITY_DATA:
                            log.info ( "Received quality data:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )
                            break;

                        case this.constructor.deviceEvents.SERIAL_NUMBER:
                            log.info ( "Received serial number:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )
                            break;

                        case this.constructor.deviceEvents.DEVICE_DATA: { // Model data and firmware version
                            log.info ( "Received model data and firmware version:  ID: " + deviceEvent + " DATA LENGTH: " + dataLength + " DATA: " + data )
                            const deviceDataArr = data.split(',')
                            const mainModelCode = parseInt(deviceDataArr[0]);
                            let mainModelString = '';
                            const expansionModelCode = parseInt(deviceDataArr[1]);
                            let expansionModelString = '';
                            const fwVersion = deviceDataArr[2];

                            switch (mainModelCode) {
                                case 0:  mainModelString = '433M';
                                case 1:  mainModelString = '868M';
                                case 2:  mainModelString = '915M';
                                case 3:  mainModelString = 'WSUB1G';
                                case 4:  mainModelString = '2.4G';
                                case 5:  mainModelString = 'WSUB3G';
                                case 6:  mainModelString = '6G';
                                case 60: mainModelString = 'RFEGEN';
                                    RFExplorer.MODEL = 'BASIC';
                                    break;
                                case 10: mainModelString = 'WSUB1G_PLUS';
                                    RFExplorer.MODEL = 'PLUS';
                                    break;
                                default:
                                    log.error( `Unknown 'RF Explorer' model code: ${mainModelCode}` )
                            }

                            switch (expansionModelCode) {
                                case 4:   expansionModelString = '2.4G'              ; break;
                                case 5:   expansionModelString = 'WSUB3G'            ; break;
                                case 12:  expansionModelString = 'WSUB3G PLUS'       ; break;
                                case 255: expansionModelString = 'No expansion model'; break;
                                default:
                                    log.error( `Unknown expansion model code: ${expansionModelCode}` )
                            }

                            log.info (`    Main model type:      '${mainModelString}'`)
                            log.info (`    Expansion model type: '${expansionModelString}'`)
                            log.info (`    Firmware version:     '${fwVersion}'`)
                        } break;

                        case this.constructor.deviceEvents.SCAN_DATA:
                            if ( this.received_config_data ) {
                                data$.next([{
                                    type: "SCAN_DATA",
                                    values: data
                                }])
                            }
                            break

                        case this.constructor.deviceEvents.SCAN_DATA_LARGE:
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
        if ( startFreq < global.MIN_FREQ || stopFreq > global.MAX_FREQ || startFreq >= stopFreq ) {
            log.error ( "Invalid frequency configuration: " + startFreq + " / " + stopFreq )
            log.error ( `Must be within: ${global.MIN_FREQ} Hz - ${global.MAX_FREQ} Hz!`)
            return false
        } else {
            return true
        }
    }
}

module.exports = RFExplorer;