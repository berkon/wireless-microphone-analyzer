
/*
// Original Paypal code:

<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top">
    <input type="hidden" name="cmd" value="_s-xclick" />
    <input type="hidden" name="hosted_button_id" value="2TW2GK2S5UBAJ" />
    <input type="image" src="https://www.paypalobjects.com/en_US/DK/i/btn/btn_donateCC_LG.gif" border="0" name="submit" title="PayPal - The safer, easier way to pay online!" alt="Donate with PayPal button" />
    <img alt="" border="0" src="https://www.paypal.com/en_DE/i/scr/pixel.gif" width="1" height="1" />
</form>
*/

const form = document.createElement('form')
form.method = 'post'
form.action = 'https://www.paypal.com/cgi-bin/webscr'

let cmd   = document.createElement('input')
cmd.type  = 'hidden'
cmd.name  = 'cmd'
cmd.value = '_s-xclick'
form.appendChild ( cmd )

let hosted_button_id   = document.createElement('input')
hosted_button_id.type  = 'hidden'
hosted_button_id.name  = 'hosted_button_id'
hosted_button_id.value = '2TW2GK2S5UBAJ'
form.appendChild ( hosted_button_id )

document.body.appendChild ( form )
form.submit()