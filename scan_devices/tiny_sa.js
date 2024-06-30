// API information taken from : https://tinysa.org/wiki/pmwiki.php?n=Main.USBInterface

const { DelimiterParser } = require ( '@serialport/parser-delimiter');
const { Subject, firstValueFrom } = require('rxjs');
const { timeout } = require ('rxjs/operators');
const Utils = require ('../utils.js');

class TinySA {
    static NAME      = 'tinySA'; // Basic device name
    static MODEL     = '' // This divides devices with the same base NAME and HW_TYPE into specific models
    // The device type shares the same API with similar devices. This is e.g. needed for sw to know how a
    // device can be contacted via the serial port.
    static HW_TYPE   = 'TINY_SA';
    static HW_VERSION= 'HW Version';
    static BAUD_RATE = 115200; // For TinySA the connection baudrate doesn't seem to matter
    static FREQ_BAND_MODE = 'HIGH';

    // TinySA Basic (small unit) has two frequency ranges in which it can operate.
    // Low  100 kHz - 350 MHz
    // High 240 MHz - 960 MHz
    // These ranges overlap by 110 MHz and must be switched with the 'mode' to accomodate the desired range
    static MIN_FREQ_BASIC_LOW  =    100000
    static MAX_FREQ_BASIC_LOW  = 350000000
    static MIN_FREQ_BASIC_HIGH = 240000000
    static MAX_FREQ_BASIC_HIGH = 960000000

    static MIN_SPAN_BASIC = 1 // couldn't find any specification if and what the minimum span is
    static MAX_SPAN_BASIC = 959900000 // couldn't find any specification if and what the maximum span is
    static MIN_SWEEP_POINTS_BASIC = 51
    static MAX_SWEEP_POINTS_BASIC = 65535

    static MIN_FREQ_ULTRA =     100000
    static MAX_FREQ_ULTRA = 6000000000
    static MIN_SPAN_ULTRA = 1 // couldn't find any specification if and what the minimum span is
    static MAX_SPAN_ULTRA = 5999900000 // couldn't find any specification if and what the maximum span is
    static MIN_SWEEP_POINTS_ULTRA = 25
    static MAX_SWEEP_POINTS_ULTRA = 65535

    static deviceCommands = {
        GET_VERSION: 'version',
        GET_FREQ_CONFIG: 'sweep', // Get current configuration
        SET_FREQ_CONFIG_START: 'sweep start',
        SET_FREQ_CONFIG_STOP: 'sweep stop',
        SCAN: 'scanraw',
        MODE: 'mode'
    };

    SERIAL_RESPONSE_TIMEOUT = 1500

    port                 = undefined;
    received_config_data = false;
    lastCmdSent          = undefined;
    lastCmdLineSent      = undefined;
    data$                = new Subject();
    goodScanCounter      = 0;
    scanningActive       = false;
    isRepeatedScanrawCommand = false;

    constructor (port, data$) {
        this.port = port
        this.data$ = data$
    }

    static getMinFreq() {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                return TinySA.FREQ_BAND_MODE === 'LOW' ? TinySA.MIN_FREQ_BASIC_LOW : TinySA.MIN_FREQ_BASIC_HIGH;

            case 'ULTRA':
                return TinySA.MIN_FREQ_ULTRA

            default:
                log.error ("getMinFreq(): Unknown TinySa model!")
        }
    }

    static getMaxFreq() {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                return TinySA.FREQ_BAND_MODE === 'LOW' ? TinySA.MAX_FREQ_BASIC_LOW : TinySA.MAX_FREQ_BASIC_HIGH

            case 'ULTRA':
                return TinySA.MAX_FREQ_ULTRA

            default:
                log.error ("getMaxFreq(): Unknown TinySa model!")
        }
    }

    static getMinSpan() {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                return TinySA.MIN_SPAN_BASIC

            case 'ULTRA':
                return TinySA.MIN_SPAN_ULTRA

            default:
                log.error ("getMinSpan(): Unknown TinySa model!")
        }
    }

    static getMaxSpan() {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                return TinySA.MAX_SPAN_BASIC

            case 'ULTRA':
                return TinySA.MAX_SPAN_ULTRA

            default:
                log.error ("getMaxSpan(): Unknown TinySa model!")
        }
    }

    getMinSweepPoints () {
        switch ( TinySA.MODEL ) {
            case 'BASIC': return TinySA.MIN_SWEEP_POINTS_BASIC;
            case 'ULTRA': return TinySA.MIN_SWEEP_POINTS_ULTRA;
        }
    }

    getMaxSweepPoints () {
        switch ( TinySA.MODEL ) {
            case 'BASIC': return TinySA.MAX_SWEEP_POINTS_BASIC;
            case 'ULTRA': return TinySA.MAX_SWEEP_POINTS_ULTRA;
        }
    }

    isValidSweepPointRange ( numOfSweepPoints ) {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                if ( numOfSweepPoints >= TinySA.MIN_SWEEP_POINTS_BASIC &&
                     numOfSweepPoints <= TinySA.MAX_SWEEP_POINTS_BASIC ) {
                    return true
                } else {
                    return false
                }

            case 'ULTRA':
                if ( numOfSweepPoints >= TinySA.MIN_SWEEP_POINTS_ULTRA &&
                     numOfSweepPoints <= TinySA.MAX_SWEEP_POINTS_ULTRA ) {
                    return true
                } else {
                    return false
                }       
        }
    }

    static isValidFreqConfig ( startFreq, stopFreq ) {
        switch (TinySA.MODEL) {
            case 'BASIC':
                if ( startFreq >= TinySA.MIN_FREQ_BASIC_LOW && stopFreq <= TinySA.MAX_FREQ_BASIC_LOW && startFreq <= stopFreq ) {
                    return 'LOW'
                } else if ( startFreq >= TinySA.MIN_FREQ_BASIC_HIGH && stopFreq <= TinySA.MAX_FREQ_BASIC_HIGH && startFreq <= stopFreq ) {
                    return 'HIGH'
                } else {
                    log.error ( "Invalid frequency configuration: " + startFreq + " / " + stopFreq )
                    log.error ( `Must be within: 100 kHz - 350 MHz (LOW) or 240 MHz - 960 MHz (HIGH)`)
                    return false
                }
            case 'ULTRA':
                if ( startFreq < TinySA.MIN_FREQ_ULTRA || stopFreq > TinySA.MAX_FREQ_ULTRA || startFreq >= stopFreq ) {
                    log.error ( "Invalid frequency configuration: " + startFreq + " / " + stopFreq )
                    return false
                } else {
                    return true
                }
        }
    }

    async sendPromise ( logMsg, cmd, params ) {
        if ( cmd === this.lastCmdSent && cmd === TinySA.deviceCommands.SCAN) {
            this.isRepeatedScanrawCommand = true
        } else {
            this.isRepeatedScanrawCommand = false
        }

        this.lastCmdSent = cmd
        this.lastCmdLineSent = cmd

        if ( params ) {
            for ( const param of params ) {
                this.lastCmdLineSent = this.lastCmdLineSent + ' ' + param
            }
        }

        if ( !this.isRepeatedScanrawCommand ) {
            log.info ( "----------------- New Command -----------------" )

            if ( logMsg ) {   
                log.info ( logMsg )
            }

            log.info ( `T: '${this.lastCmdLineSent}'`)
        }

        this.port.writePromise ( Buffer.from ( this.lastCmdLineSent + '\r' ), 'ascii' );
        return await firstValueFrom(this.data$)
    }

    async getConfiguration () {
        const deviceInfo = await this.sendPromise (`Probing for '${TinySA.NAME}' hardware ...`, TinySA.deviceCommands.GET_VERSION, null )
        if ( deviceInfo[0].status === 'ERROR' ) {
            return
        }
        const freqConfig = await this.sendPromise (`Obtain current frequency settings ...`, TinySA.deviceCommands.GET_FREQ_CONFIG, null )

        if ( freqConfig[0].status === 'VALID' ) {
            this.scanningActive = true;
            log.info ( "Periodic scan is enabled" )
            await this.sendPromise (`Starting periodic scan ...`, TinySA.deviceCommands.SCAN, [ global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS ] )
        } else {
            log.error ( "Device returned invalid frequency configuration!" )
        }
    }

    async setConfiguration ( startFreq, stopFreq ) {
        log.info ( "Setting new frequency configuration ... ")
        this.scanningActive = false;
        log.info ( "Disabling periodic scan ..." )
        log.info ( "Wait for lastly requested scan data to be received before continuing ...")
        try {
            await firstValueFrom(this.data$.pipe(timeout(1000))) // Wait for last scan data to arrive
        } catch (error) {
            log.info ( "Timeout!")
        }
        log.info ( "Periodic scan was active and is now disabled")
        // If using Basic TinySA model, switch frequency mode according to the requested frequency range
        if ( TinySA.MODEL === 'BASIC' ) {
            // New frequency range to be set is in LOW range
            if ( TinySA.isValidFreqConfig(startFreq, stopFreq) === 'LOW' ) {
                if ( TinySA.FREQ_BAND_MODE === 'HIGH' ) {
                    Utils.showMiniWarning('Switching to LOW mode', 2000);
                } else {
                    if ( stopFreq === TinySA.MAX_FREQ_BASIC_LOW ) {
                        Utils.showMiniWarning(`WARNING! You've reached the maximum frequency of TinySA's LOW mode of ${TinySA.MAX_FREQ_BASIC_LOW/1000000} MHz!<br>If you want to switch to HIGH mode, enter (or select) a frequency range within ${TinySA.MIN_FREQ_BASIC_HIGH/1000000} MHz and ${TinySA.MAX_FREQ_BASIC_HIGH/1000000} MHz!`);
                    } else {
                        Utils.hideMiniWarning()
                    }
                }

                TinySA.FREQ_BAND_MODE = 'LOW'
                await this.sendPromise ( `Setting frequency mode to LOW ...`, TinySA.deviceCommands.MODE, ['low', 'input'] )
                global.MIN_FREQ = TinySA.MIN_FREQ_BASIC_LOW
                global.MAX_FREQ = TinySA.MAX_FREQ_BASIC_LOW
            } else if ( TinySA.isValidFreqConfig(startFreq, stopFreq) === 'HIGH' ) { // New frequency range to be set is in HIGH range
                if ( TinySA.FREQ_BAND_MODE === 'LOW' ) {
                    Utils.showMiniWarning('Switching to HIGH mode', 2000);
                } else {
                    if ( startFreq === TinySA.MIN_FREQ_BASIC_HIGH ) {
                        Utils.showMiniWarning(`WARNING! You've reached the minimum frequency of TinySA's HIGH mode of ${TinySA.MIN_FREQ_BASIC_HIGH/1000000} MHz!<br>If you want to switch to LOW mode, enter (or select) a frequency range within ${TinySA.MIN_FREQ_BASIC_LOW/1000} kHz and ${TinySA.MAX_FREQ_BASIC_LOW/1000000} MHz!`);
                    } else {
                        Utils.hideMiniWarning()
                    }
                }

                TinySA.FREQ_BAND_MODE = 'HIGH'
                await this.sendPromise ( `Setting frequency mode to HIGH ...`, TinySA.deviceCommands.MODE, ['high', 'input'] )
                global.MIN_FREQ = TinySA.MIN_FREQ_BASIC_HIGH
                global.MAX_FREQ = TinySA.MAX_FREQ_BASIC_HIGH
            } else {
                log.error(`Unable to set frequency mode! Start/stop frequency ${startFreq}/${stopFreq} is not within any of the following frequency ranges:`)
                log.error(`Low  100 kHz - 350 MHz`)
                log.error(`High 240 MHz - 960 MHz`)
                return
            }
        }

        await this.sendPromise ( `Setting start frequency to: ${startFreq} ...`, TinySA.deviceCommands.SET_FREQ_CONFIG_START, [startFreq] )
        await this.sendPromise ( `Setting stop frequency to: ${stopFreq} ...`, TinySA.deviceCommands.SET_FREQ_CONFIG_STOP, [stopFreq] )
        await this.sendPromise ( `Reading back current frequency settings ...`, TinySA.deviceCommands.GET_FREQ_CONFIG, null )
        this.scanningActive = true;
        log.info ( "Periodic scan is enabled" )
        await this.sendPromise ( `Starting periodic scan ...`, TinySA.deviceCommands.SCAN, [ global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS ])    
    }

    async processData (res) {
        let respLineArr = []
        let buf = String.fromCharCode.apply ( null, res ) // convert character codes to their corresponding character representation

        let tmp_buf = buf.replaceAll(String.fromCharCode(0x0d),'⏎')
        tmp_buf = tmp_buf.replaceAll(String.fromCharCode(0x0a),'⇩')
        tmp_buf = tmp_buf.replaceAll(String.fromCharCode(0x09),'⇥')
        tmp_buf = tmp_buf.replace(/{.*}/, `{${tmp_buf.lastIndexOf('}') - tmp_buf.indexOf('{') -1 } bytes scan data}`)

        if ( !this.isRepeatedScanrawCommand ) {
            log.info(`R: '${tmp_buf}'`)
        }

        // If the returned data is a scan result do a special handling here to avoid
        // an accidental splitting at scan values which by coincidence represent '/r/n'
        if (this.lastCmdSent === TinySA.deviceCommands.SCAN) {
            respLineArr[0] = buf.substring ( 0, buf.indexOf('\r\n'))
            respLineArr[1] = buf.substring ( buf.indexOf('\r\n') + 2)
        } else {
            respLineArr = buf.split('\r\n')

            // Remove last array element if empty
            if ( respLineArr[respLineArr.length-1] === '' ) {
                respLineArr = respLineArr.slice(0, -1)
            }
        }

        for (let [index, line] of respLineArr.entries()) {
            if ( this.lastCmdSent !== TinySA.deviceCommands.SCAN ) {
                if (respLineArr[0] === this.lastCmdLineSent && index === 0) {
                    log.info ( `[${index}]: ${line}  (cmd echo)` )
                } else if (line.indexOf('{') === 0 && line.lastIndexOf('}') === line.length -1) {
                    //line = line.replace(/{.*}/, `{${ line.lastIndexOf('}') - line.indexOf('{') -1 } bytes scan data}`)
                    let tmp_line = line.replaceAll(String.fromCharCode(0x0d),'⏎')
                    tmp_line = tmp_line.replaceAll(String.fromCharCode(0x0a),'⇩')
                    tmp_line = tmp_line.replaceAll(String.fromCharCode(0x09),'⇥')
                    tmp_line = tmp_line.replace(/{.*}/, `{${tmp_line.lastIndexOf('}') - tmp_line.indexOf('{') -1} bytes scan data}`)
                    log.info ( `[${index}]: ${tmp_line}` )
                } else {
                    log.info ( `[${index}]: ${line}` )    
                }
            }
        }

        switch ( this.lastCmdSent ) {
            case TinySA.deviceCommands.GET_VERSION:
                let returnData = []

                for ( let [index, line] of respLineArr.entries()) {
                    if ( line.indexOf ( TinySA.NAME + '_' ) !== -1 ) {
                        TinySA.MODEL = 'BASIC'
                        returnData.push ({
                            type: 'NAME',
                            values: {
                                NAME: TinySA.NAME
                            }
                        })
                    } else if ( line.indexOf ( TinySA.NAME + '4_' ) !== -1 ) {
                        TinySA.MODEL = 'ULTRA'
                        returnData.push ({
                            type: 'NAME',
                            values: {
                                NAME: TinySA.NAME
                            }
                        })
                    } else if ( line.indexOf ( TinySA.HW_VERSION ) !== -1 ) {
                        returnData.push ({
                            type: 'HW_VERSION',
                            values: {
                                HW_VERSION: line.split(':')[1]
                            }
                        })
                    } else {
                        // It looks like the device is buffering data which was not transmitted to the
                        // PC. In that case when the PC connects, that trash data is received (e.g.
                        // scan data). Thus to clean the device buffer, ignore all trash data that comes
                        // from the device. So if the response to the 'version' command is not a command
                        // echo (as it should be) consider it to be trash data.
                        if (!(line === this.lastCmdLineSent && index === 0)) {
                            log.info ( `Ignoring trash data from device buffer`)
                            returnData.push ({
                                type: 'ERROR_RECEIVED_TRASH',
                                status: 'ERROR'
                            })
                        }
                    }
                }

                log.info (`Parsed version info:`)
                log.info (returnData)
                this.data$.next(returnData)
                break;

            case TinySA.deviceCommands.GET_FREQ_CONFIG:
                this.received_config_data = true
                let res_arr = respLineArr[1].split ( " " )
                const startFreq   = parseInt ( res_arr[0] ) // Start frequency returned in Hz
                const stopFreq    = parseInt ( res_arr[1] ) // Stop frequency returned in Hz
//              const sweepPoints = parseInt ( res_arr[2] ) // Number of sweep points // not used because it cannot be set from the PC app. It just returns what is set on the device
                
                const resultData = {
                    type: 'CONFIG_DATA',
                    status: TinySA.isValidFreqConfig(startFreq, stopFreq) ? 'VALID' : 'INVALID',
                    values: {
                        START_FREQ: startFreq,
                        STOP_FREQ: stopFreq,
                        FREQ_STEP: parseInt ( (stopFreq - startFreq) / global.SWEEP_POINTS ), // Frequency step returned in Hz
                        MIN_FREQ: TinySA.getMinFreq(),
                        MAX_FREQ: TinySA.getMaxFreq(),
                        MIN_SPAN: TinySA.getMinSpan(),
                        MAX_SPAN: TinySA.getMaxSpan()
                    }
                }
                
                log.info (`Parsed frequency settings:`)
                log.info ([resultData])
                this.data$.next([resultData]);
                break

            case TinySA.deviceCommands.SCAN:
                if ( this.received_config_data ) {
                    let newBuf = []
                    const startPos = respLineArr[1].indexOf('{')
                    const stopPos = respLineArr[1].lastIndexOf('}')

                    if ( startPos === 0 && stopPos === (global.SWEEP_POINTS * 3 ) + 1 ) {  // *3 because each value has 3 bytes: xML
                        respLineArr[1] = respLineArr[1].substring(startPos + 1, stopPos)
                        this.goodScanCounter++

                        for (let index = 1 ; index < respLineArr[1].length ; index += 3) {
                            let val = respLineArr[1].charCodeAt(index) + (respLineArr[1].charCodeAt(index + 1) * 256)
                            val = -((val / 32) - (TinySA.MODEL==='BASIC'?128:174))
                            newBuf.push(val)
                        }

                        this.data$.next([{
                            type: "SCAN_DATA",
                            values: newBuf
                        }])
                    } else {
                        log.info(`Bad scan after ${this.goodScanCounter} good. Received ${stopPos + 1} bytes (expected ${(global.SWEEP_POINTS * 3 )}). Discarding ...`)
                        this.goodScanCounter = 0;
                        this.data$.next([{
                            type: "NO_DATA"
                        }])
                    }
                }

                if ( this.scanningActive ) {
                    await this.sendPromise ( null, TinySA.deviceCommands.SCAN, [ global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS ] )
                }
                break

            case TinySA.deviceCommands.SET_FREQ_CONFIG_START:
                // This command does not respond with any data (except the command echo of course)
                this.data$.next([{type: 'NO_DATA'}])
                break

            case TinySA.deviceCommands.SET_FREQ_CONFIG_STOP:
                // This command does not respond with any data (except the command echo of course)
                this.data$.next([{type: 'NO_DATA'}])
                break

            case TinySA.deviceCommands.MODE:
                // This command does not respond with any data (except the command echo of course)
                this.data$.next([{type: 'NO_DATA'}])
                break

            default:
                log.error (`Last command was: '${this.lastCmdSent}'`)
                log.error (`R: '${respLineArr}'  (unknown response)`)
        }
    }    

    setHandler () {
        log.info ( `Setting handler for ${TinySA.NAME} data receiption ... ` )
        const delimiterParser = this.port.pipe ( new DelimiterParser({ delimiter: 'ch> ' }) )
        delimiterParser.on ( 'data', res => this.processData(res) )
    }
}

module.exports = TinySA;