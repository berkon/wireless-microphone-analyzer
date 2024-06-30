class Utils {
    static messagesToShow
    static timerActive = null

    // One-time initialization
    static {
        Utils.messagesToShow = []
    }

    static showMiniWarning( text, timeout) {
        if ( text ) {
            Utils.messagesToShow.push({text: text, timeout: timeout})
        }

        if ( !Utils.timerActive ) {
            let curMessage = Utils.messagesToShow.pop();
            document.getElementById('warning-message').innerHTML = curMessage.text
            document.getElementById('warning-message').style.display = 'unset'

            if ( curMessage.timeout ) {
                Utils.timerActive = setTimeout ( () => {
                    Utils.timerActive = null
                    Utils.hideMiniWarning()
                    if ( Utils.messagesToShow.length > 0 ) {
                        Utils.showMiniWarning()
                    }
                }, timeout);
            }
        }
    }
    
    static hideMiniWarning() {
        document.getElementById('warning-message').innerHTML = ''
        document.getElementById('warning-message').style.display = 'none'
    }
}

module.exports = Utils;