'use strict'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true; // Disable security warning on the console

var SerialPort = require ( 'serialport' );

const {app, BrowserWindow, Menu} = require('electron');
const electronLocalshortcut = require ( 'electron-localshortcut' );

let mainWindow

function createWindow () {
    mainWindow = new BrowserWindow({width: 1200, height: 700});
    mainWindow.loadFile('index.html');
    let wc = mainWindow.webContents;
    //wc.openDevTools();
    
    electronLocalshortcut.register ( mainWindow, 'Alt+CommandOrControl+Shift+I', () => {
        mainWindow.toggleDevTools();
    });

    electronLocalshortcut.register ( mainWindow, 'CommandOrControl+R', () => {
        mainWindow.reload();
    });

    var menuJSON = [
        { label: 'Band', submenu: [
            { label:'Sennheiser', submenu: [
                { label:'XS Wireless', submenu: [
                    { label: 'A-Band   (548 - 572MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 548000, stop_freq: 572000, label: 'Sennheiser XS Wireless A-Band (548 - 572MHz)' , band: 'SEN_A_XS' } ); } },
                    { label: 'GB-Band  (606 - 630MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 630000, label: 'Sennheiser XS Wireless GB-Band (606 - 630MHz)', band: 'SEN_GB_XS'} ); } },
                    { label: 'B-Band   (614 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 614000, stop_freq: 638000, label: 'Sennheiser XS Wireless B-Band (614 - 638MHz)' , band: 'SEN_B_XS' } ); } },
                    { label: 'C-Band   (766 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 766000, stop_freq: 790000, label: 'Sennheiser XS Wireless C-Band (766 - 790MHz)' , band: 'SEN_C_XS' } ); } },
                    { label: 'D-Band   (794 - 806MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 794000, stop_freq: 806000, label: 'Sennheiser XS Wireless D-Band (794 - 806MHz)' , band: 'SEN_D_XS' } ); } },
                    { label: 'E-Band   (821 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 821000, stop_freq: 865000, label: 'Sennheiser XS Wireless E-Band (821 - 865MHz)' , band: 'SEN_E_XS' } ); } },
                    { label: 'K-Band   (925 - 937.5MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 925000, stop_freq: 937500, label: 'Sennheiser XS Wireless K-Band (925 - 937.5MHz)', band: 'SEN_K_XS' } ); } }
                ]},
                { label:'Evolution Wireless', submenu: [
                    { label:'G2 100/300/500', submenu: [
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW 100/300/500 G2 A-Band (516 - 558MHz)', band: 'SEN_A_G2' } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW 100/300/500 G2 G-Band (566 - 608MHz)', band: 'SEN_G_G2' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW 100/300/500 G2 B-Band (626 - 668MHz)', band: 'SEN_B_G2' } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW 100/300/500 G2 C-Band (734 - 776MHz)', band: 'SEN_C_G2' } ); } },
                        { label: 'D-Band   (786 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 786000, stop_freq: 822000, label: 'Sennheiser EW 100/300/500 G2 D-Band (786 - 822MHz)', band: 'SEN_D_G2' } ); } },
                        { label: 'E-Band   (830 - 866MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 830000, stop_freq: 866000, label: 'Sennheiser EW 100/300/500 G2 E-Band (830 - 866MHz)', band: 'SEN_E_G2' } ); } }
                    ]},
                    { label:'G3 100', submenu: [
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW 100 G3 A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW 100 G3 G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band  (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW 100 G3 GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW 100 G3 B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW 100 G3 C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band   (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW 100 G3 D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band   (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW 100 G3 E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } },
                        { label: '1G8-Band (1785 - 1805MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1785000, stop_freq: 1805000, label: 'Sennheiser EW 100 G3 1G8-Band (1785 - 1805MHz)' , band: 'SEN_1G8_G3' } ); } }
                    ]},
                    { label:'G3 300/500', submenu: [
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW 300/500 G3 A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW 300/500 G3 G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band  (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW 300/500 G3 GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW 300/500 G3 B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW 300/500 G3 C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band   (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW 300/500 G3 D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band   (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW 300/500 G3 E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } }
                    ]},
                    { label:'G4 100', submenu: [
                        { label: 'A1-Band (470 - 516MHz)' , click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 516000, label: 'Sennheiser EW 100 G4 A1-Band (470 - 516MHz)', band: 'SEN_A1_G4' } ); } },
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW 100 G4 A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW 100 G4 G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band  (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW 100 G4 GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW 100 G4 B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW 100 G4 C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band   (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW 100 G4 D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band   (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW 100 G4 E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } },
                        { label: '1G8-Band (1785 - 1805MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1785000, stop_freq: 1805000, label: 'Sennheiser EW G4 100 1G8-Band (1785 - 1805MHz)' , band: 'SEN_1G8_G3' } ); } }
                    ]},
                    { label:'G4 300/500', submenu: [
                        { label: 'AW+-Band (470 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 558000, label: 'Sennheiser EW 300/500 G4 AW+-Band (470 - 558MHz)', band: 'SEN_AW+_G4'} ); } },
                        { label: 'GW-Band  (558 - 626MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 558000, stop_freq: 626000, label: 'Sennheiser EW 300/500 G4 GW-Band (558 - 626MHz)' , band: 'SEN_GW_G4' } ); } },
                        { label: 'GBW-Band (606 - 678MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 678000, label: 'Sennheiser EW 300/500 G4 GBW-Band (606 - 678MHz)', band: 'SEN_GBW_G4'} ); } },
                        { label: 'BW-Band  (626 - 698MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 698000, label: 'Sennheiser EW 300/500 G4 BW-Band (626 - 698MHz)' , band: 'SEN_BW_G4' } ); } },
                        { label: 'CW-Band  (718 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 718000, stop_freq: 790000, label: 'Sennheiser EW 300/500 G4 CW-Band (718 - 790MHz)' , band: 'SEN_CW_G4' } ); } },
                        { label: 'DW-Band  (790 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 790000, stop_freq: 865000, label: 'Sennheiser EW 300/500 G4 DW-Band (790 - 865MHz)' , band: 'SEN_DW_G4' } ); } }
                    ]},
                    { label:'G4 IEM', submenu: [
                        { label: 'A1-Band (470 - 516MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 516000, label: 'Sennheiser EW IEM G4 A1-Band (470 - 516MHz)', band: 'SEN_A1_G4' } ); } },
                        { label: 'A-Band  (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW IEM G4 A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band  (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW IEM G4 G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW IEM G4 GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band  (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW IEM G4 B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band  (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW IEM G4 C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band  (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW IEM G4 D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band  (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW IEM G4 E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } }
                    ]},
                    { label:'D1', submenu: [
                        { label: '2G4-Band  (2400 - 2483,5MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 2400000, stop_freq: 2483500, label: 'Sennheiser EW D1 2G4-Band (2400 - 2483,5MHz)' , band: 'SEN_2G4'  } ); } }
                    ]}
                ]},
                { label:'AVX / SpeechLine Digital Wireless', submenu: [
                    { label: '1G9-Band  (1880 - 1900MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1880000, stop_freq: 1900000, label: 'Sennheiser AVX / SpeechLine Digital Wireless 1G9-Band (1880 - 1900MHz)' , band: 'SEN_E_1G9'  } ); } }
                ]},
                { label:'2000', submenu: [
                    { label: 'AW-Band  (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser 2000 AW-Band (516 - 558MHz)' , band: 'SEN_AW_2000' } ); } },
                    { label: 'GW-Band  (558 - 626MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 558000, stop_freq: 626000, label: 'Sennheiser 2000 GW-Band (558 - 626MHz)' , band: 'SEN_GW_2000' } ); } },
                    { label: 'GBW-Band (606 - 678MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 678000, label: 'Sennheiser 2000 GBW-Band (606 - 678MHz)', band: 'SEN_GBW_2000'} ); } },
                    { label: 'BW-Band  (626 - 698MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 698000, label: 'Sennheiser 2000 BW-Band (626 - 698MHz)' , band: 'SEN_BW_2000' } ); } },
                    { label: 'CW-Band  (718 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 718000, stop_freq: 790000, label: 'Sennheiser 2000 CW-Band (718 - 790MHz)' , band: 'SEN_CW_2000' } ); } },
                    { label: 'DW-Band  (790 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 790000, stop_freq: 865000, label: 'Sennheiser 2000 DW-Band (790 - 865MHz)' , band: 'SEN_DW_2000' } ); } }
                ]},
                { label:'3000/5000', submenu: [
                    { label: 'A-Band   (470 - 560MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 560000, label: 'Sennheiser 3000/5000 A-Band (470 - 560MHz)'  , band: 'SEN_A_3000_5000'  } ); } },
                    { label: 'AW-Band  (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser 3000/5000 AW-Band (516 - 558MHz)' , band: 'SEN_AW_3000_5000' } ); } },
                    { label: 'B-Band   (518 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 518000, stop_freq: 608000, label: 'Sennheiser 3000/5000 B-Band (518 - 608MHz)'  , band: 'SEN_B_3000_5000'  } ); } },
                    { label: 'C-Band   (548 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 548000, stop_freq: 638000, label: 'Sennheiser 3000/5000 C-Band (548 - 638MHz)'  , band: 'SEN_C_3000_5000'  } ); } },
                    { label: 'GW-Band  (558 - 626MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 558000, stop_freq: 626000, label: 'Sennheiser 3000/5000 GW-Band (558 - 626MHz)' , band: 'SEN_GW_3000_5000' } ); } },
                    { label: 'GBW-Band (606 - 678MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 678000, label: 'Sennheiser 3000/5000 GBW-Band (606 - 678MHz)', band: 'SEN_GBW_3000_5000'} ); } },
                    { label: 'D-Band   (614 - 704MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 614000, stop_freq: 704000, label: 'Sennheiser 3000/5000 D-Band (614 - 704MHz)'  , band: 'SEN_D_3000_5000'  } ); } },
                    { label: 'BW-Band  (626 - 698MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 698000, label: 'Sennheiser 3000/5000 BW-Band (626 - 698MHz)' , band: 'SEN_BW_3000_5000' } ); } },
                    { label: 'E-Band   (678 - 768MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 678000, stop_freq: 768000, label: 'Sennheiser 3000/5000 E-Band (678 - 768MHz)'  , band: 'SEN_E_3000_5000'  } ); } },
                    { label: 'CW-Band  (718 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 718000, stop_freq: 790000, label: 'Sennheiser 3000/5000 CW-Band (718 - 790MHz)' , band: 'SEN_CW_3000_5000' } ); } },
                    { label: 'G-Band   (776 - 866MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 776000, stop_freq: 866000, label: 'Sennheiser 3000/5000 G-Band (776 - 866MHz)'  , band: 'SEN_G_3000_5000'  } ); } },
                    { label: 'DW-Band  (790 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 790000, stop_freq: 865000, label: 'Sennheiser 3000/5000 DW-Band (790 - 865MHz)' , band: 'SEN_DW_3000_5000' } ); } },
                    { label: 'H-Band   (814 - 904MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 814000, stop_freq: 904000, label: 'Sennheiser 3000/5000 H-Band (814 - 904MHz)'  , band: 'SEN_H_3000_5000'  } ); } }
                ]},
                { label:'3000/5000 II', submenu: [
                    { label: 'L-Band  (470 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 638000, label: 'Sennheiser 3000/5000 II L-Band (470 - 638MHz)', band: 'SEN_L_3000_5000_II' } ); } },
                    { label: 'N-Band  (614 - 798MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 614000, stop_freq: 798000, label: 'Sennheiser 3000/5000 II N-Band (614 - 798MHz)', band: 'SEN_N_3000_5000_II' } ); } },
                    { label: 'P-Band  (776 - 960MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 776000, stop_freq: 960000, label: 'Sennheiser 3000/5000 II P-Band (776 - 960MHz)', band: 'SEN_P_3000_5000_II' } ); } }
                ]},
                { label:'Digital 6000', submenu: [
                    { label:'SKM / SK', submenu: [
                        { label: 'A1 - A4 (470 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 558000, label: 'Sennheiser Digital 6000 A1-A4-Band (470 - 558MHz)', band: 'SEN_A1_A4_6000' } ); } },
                        { label: 'A5 - A8 (550 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 550000, stop_freq: 638000, label: 'Sennheiser Digital 6000 A5-A8-Band (550 - 638MHz)', band: 'SEN_A5_A8_6000' } ); } },
                        { label: 'B1 - B4 (630 - 718MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 630000, stop_freq: 718000, label: 'Sennheiser Digital 6000 B1-B4-Band (630 - 718MHz)', band: 'SEN_B1_B4_6000' } ); } }
                    ]},
                    { label: 'EM Dante (470 - 718MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 718000, label: 'Sennheiser Digital 6000 EM Dante (470 - 718MHz)', band: 'SEN_EM_6000' } ); } },
                    { label: 'EK (470 - 654MHz)'      , click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 654000, label: 'Sennheiser Digital 6000 EK (470 - 654MHz)'      , band: 'SEN_EK_6000' } ); } }
                ]},
                { label:'Digital 9000', submenu: [
                    { label:'SKM / SK', submenu: [
                        { label: 'A1 - A4 (470 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 558000, label: 'Sennheiser Digital 9000 A1-A4-Band (470 - 558MHz)', band: 'SEN_A1_A4_6000' } ); } },
                        { label: 'A5 - A8 (550 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 550000, stop_freq: 638000, label: 'Sennheiser Digital 9000 A5-A8-Band (550 - 638MHz)', band: 'SEN_A5_A8_6000' } ); } },
                        { label: 'B1 - B4 (630 - 718MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 630000, stop_freq: 718000, label: 'Sennheiser Digital 9000 B1-B4-Band (630 - 718MHz)', band: 'SEN_B1_B4_6000' } ); } },
                        { label: 'B5 - B8 (710 - 798MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 710000, stop_freq: 798000, label: 'Sennheiser Digital 9000 A5-A8-Band (710 - 798MHz)', band: 'SEN_B5_B8_6000' } ); } }
                    ]},
                    { label: 'EM (470 - 798MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 798000, label: 'Sennheiser Digital 9000 EM (470 - 798MHz)', band: 'SEN_EM_9000' } ); } }
                ]},
            ]},
            { label:'Shure', submenu: [ 
                { label:'BLX (Analog)', submenu: [
                    { label: 'H8E-Band (518 - 542MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 518000, stop_freq: 542000, label: 'Sure BLX H8E-Band (518 - 542MHz)', band: 'SUR_H8E' } ); } },
                    { label: 'K3E-Band (606 - 630MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 630000, label: 'Sure BLX K3E-Band (606 - 630MHz)', band: 'SUR_K3E' } ); } },
                    { label: 'K14-Band (614 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 614000, stop_freq: 638000, label: 'Sure BLX K14-Band (614 - 638MHz)', band: 'SUR_K14' } ); } },
                    { label: 'M17-Band (662 - 686MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 662000, stop_freq: 686000, label: 'Sure BLX M17-Band (662 - 686MHz)', band: 'SUR_M17' } ); } },
                    { label: 'Q25-Band (742 - 766MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 742000, stop_freq: 766000, label: 'Sure BLX Q25-Band (742 - 766MHz)', band: 'SUR_Q25' } ); } },
                    { label: 'R12-Band (794 - 806MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 794000, stop_freq: 806000, label: 'Sure BLX R12-Band (794 - 806MHz)', band: 'SUR_R12' } ); } },
                    { label: 'S8-Band  (823 - 832MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 832000, label: 'Sure BLX  S8-Band (823 - 832MHz)', band: 'SUR_S8'  } ); } },
                    { label: 'T11-Band (863 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 863000, stop_freq: 865000, label: 'Sure BLX T11-Band (863 - 865MHz)', band: 'SUR_T11' } ); } }
                ]},
                { label:'SLX (Analog)', submenu: [
                    { label: 'G4E-Band (470 - 494MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 494000, label: 'Sure SLX G4E-Band (470 - 494MHz)', band: 'SUR_G4E' } ); } },
                    { label: 'G5E-Band (494 - 518MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 494000, stop_freq: 518000, label: 'Sure SLX G5E-Band (494 - 518MHz)', band: 'SUR_G5E' } ); } },
                    { label: 'H5-Band  (518 - 542MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 518000, stop_freq: 542000, label: 'Sure SLX H5-Band  (518 - 542MHz)', band: 'SUR_H5'  } ); } },
                    { label: 'J3-Band  (572 - 596MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 572000, stop_freq: 596000, label: 'Sure SLX J3-Band  (572 - 596MHz)', band: 'SUR_J3'  } ); } },
                    { label: 'K3E-Band (606 - 630MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 630000, label: 'Sure SLX K3E-Band (606 - 630MHz)', band: 'SUR_K3E' } ); } },
                    { label: 'L4E-Band (638 - 662MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 638000, stop_freq: 662000, label: 'Sure SLX L4E-Band (638 - 662MHz)', band: 'SUR_L4E' } ); } },
                    { label: 'P4-Band  (702 - 726MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 702000, stop_freq: 726000, label: 'Sure SLX  P4-Band (702 - 726MHz)', band: 'SUR_P4'  } ); } },
                    { label: 'Q24-Band (736 - 754MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 736000, stop_freq: 754000, label: 'Sure SLX Q24-Band (736 - 754MHz)', band: 'SUR_Q24' } ); } },
                    { label: 'R5-Band  (800 - 820MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 800000, stop_freq: 820000, label: 'Sure SLX  R5-Band (800 - 820MHz)', band: 'SUR_R5'  } ); } },
                    { label: 'S10-Band (823 - 832MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 832000, label: 'Sure SLX S10-Band (823 - 832MHz)', band: 'SUR_S10' } ); } },
                    { label: 'S6-Band  (838 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 838000, stop_freq: 865000, label: 'Sure SLX  S6-Band (838 - 865MHz)', band: 'SUR_S6'  } ); } }
                ]},
                { label:'GLX-D (Digital)', submenu: [
                    { label: 'Z2-Band (2404 - 2478MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 2404000, stop_freq: 2478000, label: 'Sure GLX-D Z2-Band (2404 - 2478MHz)', band: 'SUR_Z2' } ); } }
                ]},
                { label:'FP (Analog)', submenu: [
                    { label: 'G4E-Band (470 - 494MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 494000, label: 'Sure SLX G4E-Band (470 - 494MHz)', band: 'SUR_G4E' } ); } },
                    { label: 'G5E-Band (494 - 518MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 494000, stop_freq: 518000, label: 'Sure SLX G5E-Band (494 - 518MHz)', band: 'SUR_G5E' } ); } },
                    { label: 'H5-Band  (518 - 542MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 518000, stop_freq: 542000, label: 'Sure SLX H5-Band  (518 - 542MHz)', band: 'SUR_H5'  } ); } },
                    { label: 'J3-Band  (572 - 596MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 572000, stop_freq: 596000, label: 'Sure SLX J3-Band  (572 - 596MHz)', band: 'SUR_J3'  } ); } },
                    { label: 'K3E-Band (606 - 630MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 630000, label: 'Sure SLX K3E-Band (606 - 630MHz)', band: 'SUR_K3E' } ); } },
                    { label: 'L4E-Band (638 - 662MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 638000, stop_freq: 662000, label: 'Sure SLX L4E-Band (638 - 662MHz)', band: 'SUR_L4E' } ); } },
                    { label: 'P4-Band  (702 - 726MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 702000, stop_freq: 726000, label: 'Sure SLX  P4-Band (702 - 726MHz)', band: 'SUR_P4'  } ); } },
                    { label: 'Q24-Band (736 - 754MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 736000, stop_freq: 754000, label: 'Sure SLX Q24-Band (736 - 754MHz)', band: 'SUR_Q24' } ); } },
                    { label: 'S6-Band  (838 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 838000, stop_freq: 865000, label: 'Sure SLX  S6-Band (838 - 865MHz)', band: 'SUR_S6'  } ); } }
                ]},
                { label:'ULX-D (Digital)', submenu: [
                    { label: 'V51-Band (174 - 216MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 174000, stop_freq: 216000, label: 'Sure ULX-D G4E-Band (174 - 216MHz)', band: 'SUR_V51' } ); } },
                    { label: 'G51-Band (470 - 534MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 534000, label: 'Sure ULX-D G51-Band (470 - 534MHz)', band: 'SUR_G51' } ); } },
                    { label: 'H51-Band (534 - 598MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 534000, stop_freq: 598000, label: 'Sure ULX-D H51-Band (534 - 598MHz)', band: 'SUR_H51' } ); } },
                    { label: 'K51-Band (606 - 670MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 670000, label: 'Sure ULX-D K51-Band (606 - 670MHz)', band: 'SUR_K51' } ); } },
                    { label: 'P51-Band (710 - 782MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 710000, stop_freq: 782000, label: 'Sure ULX-D P51-Band (710 - 782MHz)', band: 'SUR_P51' } ); } },
                    { label: 'Q51-Band (794 - 806MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 794000, stop_freq: 806000, label: 'Sure ULX-D Q51-Band (794 - 806MHz)', band: 'SUR_Q51' } ); } },
                    { label: 'R51-Band (800 - 810MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 800000, stop_freq: 810000, label: 'Sure ULX-D R51-Band (800 - 810MHz)', band: 'SUR_R51' } ); } },
                    { label: 'Z17-Band (1492 - 1525MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1492000, stop_freq: 1525000, label: 'Sure ULX-D Z17-Band (1492 - 1525MHz)', band: 'SUR_Z17' } ); } },
                    { label: 'Z18-Band (1785 - 1805MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1785000, stop_freq: 1805000, label: 'Sure ULX-D Z18-Band (1785 - 1805MHz)', band: 'SUR_Z18' } ); } }
                ]},
                { label:'QLX-D (Digital)', submenu: [
                    { label: 'V51-Band (174 - 216MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 174000, stop_freq: 216000, label: 'Sure QLX-D G4E-Band (174 - 216MHz)', band: 'SUR_V51' } ); } },
                    { label: 'G51-Band (470 - 534MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 534000, label: 'Sure QLX-D G51-Band (470 - 534MHz)', band: 'SUR_G51' } ); } },
                    { label: 'H51-Band (534 - 598MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 534000, stop_freq: 598000, label: 'Sure QLX-D H51-Band (534 - 598MHz)', band: 'SUR_H51' } ); } },
                    { label: 'K51-Band (606 - 670MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 670000, label: 'Sure QLX-D K51-Band (606 - 670MHz)', band: 'SUR_K51' } ); } },
                    { label: 'L52-Band (632 - 694MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 632000, stop_freq: 694000, label: 'Sure QLX-D L52-Band (632 - 694MHz)', band: 'SUR_L52' } ); } },
                    { label: 'P51-Band (710 - 782MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 710000, stop_freq: 782000, label: 'Sure QLX-D P51-Band (710 - 782MHz)', band: 'SUR_P51' } ); } },
                    { label: 'Q51-Band (794 - 806MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 794000, stop_freq: 806000, label: 'Sure QLX-D Q51-Band (794 - 806MHz)', band: 'SUR_Q51' } ); } },
                    { label: 'S50-Band (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sure QLX-D S50-Band (823 - 865MHz)', band: 'SUR_S50' } ); } },
                    { label: 'Z17-Band (1492 - 1525MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1492000, stop_freq: 1525000, label: 'Sure QLX-D Z17-Band (1492 - 1525MHz)', band: 'SUR_Z17' } ); } },
                    { label: 'Z18-Band (1785 - 1805MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1785000, stop_freq: 1805000, label: 'Sure QLX-D Z18-Band (1785 - 1805MHz)', band: 'SUR_Z18' } ); } }
                ]},
                { label:'AXIENT (Digital)', submenu: [
                    { label: 'A(G56)-Band (470 - 636MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 636000, label: 'Sure AXIENT A(G56)-Band (470 - 636MHz)', band: 'SUR_A_G56' } ); } },
                    { label: 'B(K57)-Band (606 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 790000, label: 'Sure AXIENT B(K57)-Band (606 - 790MHz)', band: 'SUR_B_K57' } ); } }
                ]},
                { label:'MICROFLEX WIRELESS', submenu: [
                    { label: 'Z11-Band (1880 - 1900MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1880000, stop_freq: 1900000, label: 'Sure MICROFLEX WIRELESS Z11-Band (1880 - 1900MHz)', band: 'SUR_Z11' } ); } }
                ]},
                { label:'PSM 200 (Analog)', submenu: [
                    { label: 'H2-Band  (518 - 554MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 518000, stop_freq: 554000, label: 'Sure PSM 200 H2-Band  (518 - 554MHz)', band: 'SUR_H2'  } ); } },
                    { label: 'K9E-Band (606 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 638000, label: 'Sure PSM 200 K9E-Band (606 - 638MHz)', band: 'SUR_K9E' } ); } },
                    { label: 'Q3-Band  (748 - 784MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 748000, stop_freq: 784000, label: 'Sure PSM 200  Q3-Band (748 - 784MHz)', band: 'SUR_Q3'  } ); } },
                    { label: 'R8-Band  (800 - 814MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 800000, stop_freq: 814000, label: 'Sure PSM 200  R8-Band (800 - 814MHz)', band: 'SUR_R8'  } ); } },
                    { label: 'S5-Band  (842 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 842000, stop_freq: 865000, label: 'Sure PSM 200  S5-Band (842 - 865MHz)', band: 'SUR_S5'  } ); } }
                ]},
                { label:'PSM 300 (Analog)', submenu: [
                    { label: 'H8E/H20-Band (518 - 542MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 518000, stop_freq: 542000, label: 'Sure PSM 300 H8E/H20-Band (518 - 542MHz)', band: 'SUR_H8E_H20' } ); } },
                    { label: 'K3E-Band (606 - 630MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 630000, label: 'Sure PSM 300 K3E-Band (606 - 630MHz)', band: 'SUR_K3E' } ); } },
                    { label: 'K12-Band (614 - 638MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 614000, stop_freq: 638000, label: 'Sure PSM 300 K12-Band (614 - 638MHz)', band: 'SUR_K12' } ); } },
                    { label: 'L19-Band (630 - 654MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 630000, stop_freq: 654000, label: 'Sure PSM 300 L19-Band (630 - 654MHz)', band: 'SUR_L19' } ); } },
                    { label: 'M16-Band (686 - 710MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 686000, stop_freq: 710000, label: 'Sure PSM 300 M16-Band (686 - 710MHz)', band: 'SUR_M16' } ); } },
                    { label: 'Q25-Band (742 - 766MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 742000, stop_freq: 766000, label: 'Sure PSM 300 Q25-Band (742 - 766MHz)', band: 'SUR_Q25' } ); } },
                    { label: 'R12-Band (794 - 806MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 794000, stop_freq: 806000, label: 'Sure PSM 300 R12-Band (794 - 806MHz)', band: 'SUR_R12' } ); } },
                    { label: 'S8-Band  (823 - 832MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 832000, label: 'Sure PSM 300  S8-Band (823 - 832MHz)', band: 'SUR_S8'  } ); } },
                    { label: 'T11-Band (863 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 863000, stop_freq: 865000, label: 'Sure PSM 300 T11-Band (863 - 865MHz)', band: 'SUR_T11' } ); } }
                ]},
                { label:'PSM 900 (Analog)', submenu: [
                    { label: 'G6E-Band (470 - 506MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 506000, label: 'Sure PSM 900 G6E-Band (470 - 506MHz)', band: 'SUR_G6E' } ); } },
                    { label: 'G7E-Band (506 - 542MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 506000, stop_freq: 542000, label: 'Sure PSM 900 G7E-Band (506 - 542MHz)', band: 'SUR_G7E' } ); } },
                    { label: 'K1E-Band (596 - 632MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 596000, stop_freq: 632000, label: 'Sure PSM 900 K1E-Band (596 - 632MHz)', band: 'SUR_K1E' } ); } },
                    { label: 'L6E-Band (656 - 692MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 656000, stop_freq: 692000, label: 'Sure PSM 900 L6E-Band (656 - 692MHz)', band: 'SUR_L6E' } ); } },
                    { label: 'P7-Band  (702 - 742MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 702000, stop_freq: 742000, label: 'Sure PSM 900  P7-Band (702 - 742MHz)', band: 'SUR_P7'  } ); } },
                    { label: 'Q15-Band (750 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 750000, stop_freq: 790000, label: 'Sure PSM 900 Q15-Band (750 - 790MHz)', band: 'SUR_Q15' } ); } },
                    { label: 'R22-Band (790 - 830MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 790000, stop_freq: 830000, label: 'Sure PSM 900 R22-Band (790 - 830MHz)', band: 'SUR_R22' } ); } }
                ]},
                { label:'PSM 1000 (Analog)', submenu: [
                    { label: 'G10E-Band (470 - 542MHz)',click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 542000, label: 'Sure PSM 1000 G10E-Band (470 - 542MHz)', band: 'SUR_G10E'} ); } },
                    { label: 'J8E-Band (554 - 626MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 554000, stop_freq: 662000, label: 'Sure PSM 1000 J8E-Band (554 - 662MHz)' , band: 'SUR_J8E' } ); } },
                    { label: 'K10E-Band (596 - 668MHz)',click () { wc.send ( 'CHANGE_BAND', { start_freq: 596000, stop_freq: 668000, label: 'Sure PSM 1000 K10E-Band (596 - 668MHz)', band: 'SUR_K10E'} ); } },
                    { label: 'L8E-Band (626 - 698MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 698000, label: 'Sure PSM 1000 L8E-Band (626 - 698MHz)' , band: 'SUR_L8E' } ); } },
                    { label: 'L9E-Band (670 - 742MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 670000, stop_freq: 742000, label: 'Sure PSM 1000 L9E-Band (670 - 742MHz)' , band: 'SUR_L9E' } ); } },
                    { label: 'P8-Band  (710 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 710000, stop_freq: 790000, label: 'Sure PSM 1000  P8-Band (710 - 790MHz)' , band: 'SUR_P8'  } ); } },
                    { label: 'Q22E-Band (750 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 750000, stop_freq: 822000, label: 'Sure PSM 1000 Q22E-Band (750 - 822MHz)' , band: 'SUR_Q22E' } ); } }
                ]}
            ]},
            { type:'separator' },
            { label: 'VHF Band (174 - 230MHz)'   , click () { wc.send ( 'CHANGE_BAND', { start_freq: 174000, stop_freq: 230000, label: 'VHF Band (174 - 230MHz)'    } ); } },
            { label: 'ML 800 Band (823 - 832MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 832000, label: 'ML 800 Band (823 - 832MHz)' } ); } },
            { label: 'ISM Band (863 - 865MHz)'   , click () { wc.send ( 'CHANGE_BAND', { start_freq: 863000, stop_freq: 865000, label: 'ISM Band (863 - 865MHz)'    } ); } }
        ]},
        { label: 'Chan. Presets', submenu: [
            { label: 'Sennheiser', submenu: [
                { label: 'D-Band', submenu: [
                    { label: 'G2 Series', submenu: [
                        { label: 'Bank 1', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_1' } ); } },
                        { label: 'Bank 2', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_2' } ); } },
                        { label: 'Bank 3', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_3' } ); } },
                        { label: 'Bank 4', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_4' } ); } },
                        { label: 'Bank 5', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_5' } ); } },
                        { label: 'Bank 6', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_6' } ); } },
                        { label: 'Bank 7', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_7' } ); } },
                        { label: 'Bank 8', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_D_G2_8' } ); } }
                    ]}
                ]},
                { label: 'E-Band', submenu: [
                    { label: 'G2 Series', submenu: [
                        { label: 'Bank 1', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_1' } ); } },
                        { label: 'Bank 2', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_2' } ); } },
                        { label: 'Bank 3', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_3' } ); } },
                        { label: 'Bank 4', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_4' } ); } },
                        { label: 'Bank 5', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_5' } ); } },
                        { label: 'Bank 6', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_6' } ); } },
                        { label: 'Bank 7', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_7' } ); } },
                        { label: 'Bank 8', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G2_8' } ); } }
                    ]},
                    { label: 'G3 Series', submenu: [
                        { label: 'Bank 1' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_1'  } ); } },
                        { label: 'Bank 2' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_2'  } ); } },
                        { label: 'Bank 3' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_3'  } ); } },
                        { label: 'Bank 4' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_4'  } ); } },
                        { label: 'Bank 5' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_5'  } ); } },
                        { label: 'Bank 6' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_6'  } ); } },
                        { label: 'Bank 7' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_7'  } ); } },
                        { label: 'Bank 8' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_8'  } ); } },
                        { label: 'Bank 9' , click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_9'  } ); } },
                        { label: 'Bank 10', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_10' } ); } },
                        { label: 'Bank 11', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_11' } ); } },
                        { label: 'Bank 12', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_12' } ); } },
                        { label: 'Bank 13', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_13' } ); } },
                        { label: 'Bank 14', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_14' } ); } },
                        { label: 'Bank 15', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_15' } ); } },
                        { label: 'Bank 16', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_16' } ); } },
                        { label: 'Bank 17', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_17' } ); } },
                        { label: 'Bank 18', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_18' } ); } },
                        { label: 'Bank 19', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_19' } ); } },
                        { label: 'Bank 20', click () { wc.send ( 'SET_CHAN_PRESET', { preset: 'SEN_E_G3_20' } ); } }
                    ]}
                ]}
            ]},
            { label: 'Shure'     , click () { wc.send ( 'SET_CHAN_PRESET', { vendor: 'SHU' } ); } }
        ]},
        { label: 'Analyze', submenu: [
            { label: 'No channel analysis', type: 'radio', checked: true, click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'NON' } ); } },
            { label: 'Sennheiser channels', type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SEN' } ); } },
            { label: 'Shure channels'     , type: 'radio',                click () { wc.send ( 'SET_VENDOR_4_ANALYSIS', { vendor: 'SHU' } ); } }
        ]},
        { label: 'Port', submenu: [
        ]},
        { label: 'Help' }
    ];

    // Add serial ports to the menu
    SerialPort.list().then ( (ports, err) => {
        let portNameArr = [];

        if ( err ) {
            console.log ( err );
            return;
        }
        
        ports.forEach ( ( port ) => {
            portNameArr.push ( port.comName );
        });

        menuJSON[3].submenu[0] = { label: 'Auto', type: 'radio', click () { wc.send ( 'SET_PORT',  portNameArr ); } }

        portNameArr.forEach ( ( port ) => {
            menuJSON[3].submenu.push (
                {
                    'label' : port,
                    'type'  : 'radio' ,
                    click () { wc.send ( 'SET_PORT', { port : port } ); }
                }
            );
        });

        Menu.setApplicationMenu ( Menu.buildFromTemplate ( menuJSON ) );
    });

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on ( 'ready', createWindow );

app.on ( 'window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if ( process.platform !== 'darwin' )
        app.quit();
});

app.on ( 'activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if ( mainWindow === null )
        createWindow();
});