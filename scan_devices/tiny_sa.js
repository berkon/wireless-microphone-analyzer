// API information taken from : https://github.com/RFExplorer/RFExplorer-for-.NET/wiki/RF-Explorer-UART-API-interface-specification

const { DelimiterParser } = require ( '@serialport/parser-delimiter');
const { Subject, firstValueFrom } = require('rxjs');

class TinySA {
    // Device type which shares the same API with similar devices. This is e.g. needed for sw to know how a
    // device can be contacted via the serial port.
    static HW_TYPE   = 'TINY_SA';
    static HW_VERSION= 'HW Version';
    // Basic device name
    static NAME      = 'tinySA';
    // This devides devices with the same base NAME and HW_TYPE into specific models
    static MODEL     = ''

    static MIN_FREQ_BASIC = 0
    static MAX_FREQ_BASIC = 960000000
    static MIN_SPAN_BASIC = 1 // couldn't find any specification if and what the minimum span is
    static MAX_SPAN_BASIC = 959900000 // couldn't find any specification if and what the maximum span is
    static MIN_FREQ_ULTRA = 0
    static MAX_FREQ_ULTRA = 6000000000
    static MIN_SPAN_ULTRA = 1 // couldn't find any specification if and what the minimum span is
    static MAX_SPAN_ULTRA = 5999900000 // couldn't find any specification if and what the maximum span is

    static BAUD_RATE = 115200; // For TinySA the connection baudrate doesn't seem to matter
    static deviceCommands = {
        GET_VERSION: 'version',
        GET_FREQ_CONFIG: 'sweep', // Get current configuration
        SET_FREQ_CONFIG_START: 'sweep start',
        SET_FREQ_CONFIG_STOP: 'sweep stop',
        SCAN: 'scanraw'
    };

    SERIAL_RESPONSE_TIMEOUT = 1500

    port                 = undefined;
    received_config_data = false;
    lastCmdSent          = undefined;
    lastCmdLineSent      = undefined;
    data$                = new Subject();
    goodScanCounter      = 0;
    scanningActive       = false;

    constructor (port, data$) {
        this.port = port
        this.data$ = data$
    }

    static getMinFreq() {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                return TinySA.MIN_FREQ_BASIC

            case 'ULTRA':
                return TinySA.MIN_FREQ_ULTRA

            default:
                console.error ("getMinFreq(): Unknown TinySa model!")
        }
    }

    static getMaxFreq() {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                return TinySA.MAX_FREQ_BASIC

            case 'ULTRA':
                return TinySA.MAX_FREQ_ULTRA

            default:
                console.error ("getMaxFreq(): Unknown TinySa model!")
        }
    }

    static getMaxSpan() {
        switch ( TinySA.MODEL ) {
            case 'BASIC':
                return TinySA.MAX_SPAN_BASIC

            case 'ULTRA':
                return TinySA.MAX_SPAN_ULTRA

            default:
                console.error ("getMaxSpan(): Unknown TinySa model!")
        }
    }

    static isValidFreqConfig ( startFreq, stopFreq ) {
        switch (TinySA.MODEL) {
            case 'BASIC':
                if ( startFreq < TinySA.MIN_FREQ_BASIC || stopFreq > TinySA.MAX_FREQ_BASIC ) {
                    return false
                } else {
                    return true
                }

            case 'ULTRA':
                if ( startFreq < TinySA.MIN_FREQ_ULTRA || stopFreq > TinySA.MAX_FREQ_ULTRA ) {
                    return false
                } else {
                    return true
                }
        }
    }

    async sendPromise ( logMsg, cmd, params ) {
        this.lastCmdSent = cmd
        this.lastCmdLineSent = cmd

        if ( params ) {
            for ( const param of params ) {
                this.lastCmdLineSent = this.lastCmdLineSent + ' ' + param
            }
        }

        console.log ( "----------------- New Command -----------------" )

        if ( logMsg ) {   
            console.log ( logMsg )
        }

        console.log ( `T: '${this.lastCmdLineSent}'`)
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
            console.log ( "Periodic scan is enabled" )
            await this.sendPromise (`Starting periodic scan ...`, TinySA.deviceCommands.SCAN, [ global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS ] )
        } else {
            console.error ( "Device returned invalid frequency configuration!" )
        }
    }

    async setConfiguration ( startFreq, stopFreq ) {
        console.log ( "Setting new frequency configuration ... ")
        this.scanningActive = false;
        console.log ( "Disabling periodic scan ..." )
        console.log ( "Wait for lastly requested scan data to be received before continuing ...")
        await firstValueFrom(this.data$) // Wait for last scan data to arrive
        console.log ( "Periodic scan was active and is now disabled")
        await this.sendPromise ( `Setting start frequency to: ${startFreq} ...`, TinySA.deviceCommands.SET_FREQ_CONFIG_START, [startFreq] )
        await this.sendPromise ( `Setting stop frequency to: ${stopFreq} ...`, TinySA.deviceCommands.SET_FREQ_CONFIG_STOP, [stopFreq] )
        await this.sendPromise ( `Reading back current frequency settings ...`, TinySA.deviceCommands.GET_FREQ_CONFIG, null )
        this.scanningActive = true;
        console.log ( "Periodic scan is enabled" )
        await this.sendPromise ( `Starting periodic scan ...`, TinySA.deviceCommands.SCAN, [ global.START_FREQ, global.STOP_FREQ, global.SWEEP_POINTS ])    
    }

    async processData (res) {
        let respLineArr = []
        let buf = String.fromCharCode.apply ( null, res ) // convert character codes to their corresponding character representation

        let tmp_buf = buf.replaceAll(String.fromCharCode(0x0d),'⏎')
        tmp_buf = tmp_buf.replaceAll(String.fromCharCode(0x0a),'⇩')
        tmp_buf = tmp_buf.replaceAll(String.fromCharCode(0x09),'⇥')
        tmp_buf = tmp_buf.replace(/{.*}/, `{${tmp_buf.lastIndexOf('}') - tmp_buf.indexOf('{') -1 } bytes scan data}`)

//        if ( this.lastCmdSent !== 'scanraw') {
            console.log(`R: '${tmp_buf}'`)
//        }

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
            if ( this.lastCmdSent !== 'scanraw') {
                if (respLineArr[0] === this.lastCmdLineSent && index === 0) {
                    console.log ( `[${index}]: ${line}  (cmd echo)` )
                } else if (line.indexOf('{') === 0 && line.lastIndexOf('}') === line.length -1) {
                    //line = line.replace(/{.*}/, `{${ line.lastIndexOf('}') - line.indexOf('{') -1 } bytes scan data}`)
                    let tmp_line = line.replaceAll(String.fromCharCode(0x0d),'⏎')
                    tmp_line = tmp_line.replaceAll(String.fromCharCode(0x0a),'⇩')
                    tmp_line = tmp_line.replaceAll(String.fromCharCode(0x09),'⇥')
                    tmp_line = tmp_line.replace(/{.*}/, `{${tmp_line.lastIndexOf('}') - tmp_line.indexOf('{') -1} bytes scan data}`)
                    console.log ( `[${index}]: ${tmp_line}` )
                } else {
                    console.log ( `[${index}]: ${line}` )    
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
                            console.log ( `Ignoring trash data from device buffer`)
                            returnData.push ({
                                type: 'ERROR_RECEIVED_TRASH',
                                status: 'ERROR'
                            })
                        }
                    }
                }

                console.log (`Parsed version info:`)
                console.log (returnData)
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
                        STOP_FREQ: stopFreq
                    }
                }

                if ( TinySA.isValidFreqConfig(startFreq, stopFreq) ) {
                    resultData.values.FREQ_STEP    = parseInt ( (stopFreq - startFreq) / global.SWEEP_POINTS ) // Frequency step returned in Hz
                    resultData.values.MIN_FREQ     = TinySA.getMinFreq()
                    resultData.values.MAX_FREQ     = TinySA.getMaxFreq()
                    resultData.values.MAX_SPAN     = TinySA.getMaxSpan()
                }
                
                console.log (`Parsed frequency settings:`)
                console.log ([resultData])
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
                        console.log(`Bad scan after ${this.goodScanCounter} good. Received ${stopPos + 1} bytes (expected ${(global.SWEEP_POINTS * 3 )}). Discarding ...`)
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
    
            default:
                console.error (`Last command was: '${this.lastCmdSent}'`)
                console.error (`R: '${respLineArr}'  (unknown response`)
        }
    }    


    setHandler () {
        console.log ( `Setting handler for ${TinySA.NAME} data receiption ... ` )
        const delimiterParser = this.port.pipe ( new DelimiterParser({ delimiter: 'ch> ' }) )
        delimiterParser.on ( 'data', res => this.processData(res) )
    }
}

module.exports = TinySA;