'use strict'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true; // Disable security warning on the console

var SerialPort = require ( 'serialport' );

const {app, BrowserWindow, Menu} = require('electron')
let mainWindow

function createWindow () {
    mainWindow = new BrowserWindow({width: 1200, height: 700});
    mainWindow.loadFile('index.html');
    let wc = mainWindow.webContents;
    wc.openDevTools();

    var menuJSON = [
        { label: 'Band', submenu: [
            { label:'Sennheiser', submenu: [
                { label:'XS Wireless', submenu: [
                ]},
                { label:'Evolution Wireless', submenu: [
                    { label:'G2 100/300/500', submenu: [
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW G2 A-Band (516 - 558MHz)', band: 'SEN_A_G2' } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW G2 G-Band (566 - 608MHz)', band: 'SEN_G_G2' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW G2 B-Band (626 - 668MHz)', band: 'SEN_B_G2' } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW G2 C-Band (734 - 776MHz)', band: 'SEN_C_G2' } ); } },
                        { label: 'D-Band   (786 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 786000, stop_freq: 822000, label: 'Sennheiser EW G2 D-Band (786 - 822MHz)', band: 'SEN_D_G2' } ); } },
                        { label: 'E-Band   (830 - 866MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 830000, stop_freq: 866000, label: 'Sennheiser EW G2 E-Band (830 - 866MHz)', band: 'SEN_E_G2' } ); } }
                    ]},
                    { label:'G3 100', submenu: [
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW G3 A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW G3 G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band  (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW G3 GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW G3 B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW G3 C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band   (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW G3 D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band   (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW G3 E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } },
                        { label: '1G8-Band (1785 - 1805MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1785000, stop_freq: 1805000, label: 'Sennheiser EW G3 100 1G8-Band (1785 - 1805MHz)' , band: 'SEN_1G8_G3' } ); } }
                    ]},
                    { label:'G3 300/500', submenu: [
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW G3 A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW G3 G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band  (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW G3 GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW G3 B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW G3 C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band   (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW G3 D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band   (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW G3 E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } }
                    ]},
                    { label:'G4 100', submenu: [
                        { label: 'A1-Band (470 - 516MHz)' , click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 516000, label: 'Sennheiser EW G4 100/IEM A1-Band (470 - 516MHz)', band: 'SEN_A1_G4' } ); } },
                        { label: 'A-Band   (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW G4 100/IEM A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band   (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW G4 100/IEM G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band  (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW G4 100/IEM GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band   (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW G4 100/IEM B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band   (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW G4 100/IEM C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band   (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW G4 100/IEM D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band   (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW G4 100/IEM E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } },
                        { label: '1G8-Band (1785 - 1805MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 1785000, stop_freq: 1805000, label: 'Sennheiser EW G4 100 1G8-Band (1785 - 1805MHz)' , band: 'SEN_1G8_G3' } ); } }
                    ]},
                    { label:'G4 300/500', submenu: [
                        { label: 'AW+-Band (470 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 558000, label: 'Sennheiser EW G4 300/500 AW+-Band (470 - 558MHz)', band: 'SEN_AW+_G4'} ); } },
                        { label: 'GW-Band  (558 - 626MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 558000, stop_freq: 626000, label: 'Sennheiser EW G4 300/500 GW-Band (558 - 626MHz)' , band: 'SEN_GW_G4' } ); } },
                        { label: 'GBW-Band (606 - 678MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 678000, label: 'Sennheiser EW G4 300/500 GBW-Band (606 - 678MHz)', band: 'SEN_GBW_G4'} ); } },
                        { label: 'BW-Band  (626 - 698MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 698000, label: 'Sennheiser EW G4 300/500 BW-Band (626 - 698MHz)' , band: 'SEN_BW_G4' } ); } },
                        { label: 'CW-Band  (718 - 790MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 718000, stop_freq: 790000, label: 'Sennheiser EW G4 300/500 CW-Band (718 - 790MHz)' , band: 'SEN_CW_G4' } ); } },
                        { label: 'DW-Band  (790 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 790000, stop_freq: 865000, label: 'Sennheiser EW G4 300/500 DW-Band (790 - 865MHz)' , band: 'SEN_DW_G4' } ); } }
                    ]},
                    { label:'G4 IEM', submenu: [
                        { label: 'A1-Band (470 - 516MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 470000, stop_freq: 516000, label: 'Sennheiser EW G4 100/IEM A1-Band (470 - 516MHz)', band: 'SEN_A1_G4' } ); } },
                        { label: 'A-Band  (516 - 558MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 516000, stop_freq: 558000, label: 'Sennheiser EW G4 100/IEM A-Band (516 - 558MHz)' , band: 'SEN_A_G3'  } ); } },
                        { label: 'G-Band  (566 - 608MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 566000, stop_freq: 608000, label: 'Sennheiser EW G4 100/IEM G-Band (566 - 608MHz)' , band: 'SEN_G_G3'  } ); } },
                        { label: 'GB-Band (606 - 648MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 606000, stop_freq: 648000, label: 'Sennheiser EW G4 100/IEM GB-Band (606 - 648MHz)', band: 'SEN_GB_G3' } ); } },
                        { label: 'B-Band  (626 - 668MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 626000, stop_freq: 668000, label: 'Sennheiser EW G4 100/IEM B-Band (626 - 668MHz)' , band: 'SEN_B_G3'  } ); } },
                        { label: 'C-Band  (734 - 776MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 734000, stop_freq: 776000, label: 'Sennheiser EW G4 100/IEM C-Band (734 - 776MHz)' , band: 'SEN_C_G3'  } ); } },
                        { label: 'D-Band  (780 - 822MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 780000, stop_freq: 822000, label: 'Sennheiser EW G4 100/IEM D-Band (780 - 822MHz)' , band: 'SEN_D_G3'  } ); } },
                        { label: 'E-Band  (823 - 865MHz)', click () { wc.send ( 'CHANGE_BAND', { start_freq: 823000, stop_freq: 865000, label: 'Sennheiser EW G4 100/IEM E-Band (823 - 865MHz)' , band: 'SEN_E_G3'  } ); } }
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
            { label:'Shure', click() { } },
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