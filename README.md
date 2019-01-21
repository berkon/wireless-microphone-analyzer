# wireless-microphone-analyzer
The Wireless Microphone Analyzer shows the frequency spectrum captured via the "RF Explorer" hardware. Wireless microphone vendors (e.g. Sennheiser, Shure etc.) have defined specific frequency ranges for their equipment which they gave proprietary names. This tool allows you to preselect these bands. E.g. if you bought a "Sennheiser WE 100 G3" in Sennheiser's E-Band, you select this range in the app, to check whether and were there are any interferences. You can also also overlay the vendor recommended channel frequency presets, which are optimized by vendors and guarantee a intermodulation free operation of multiple microphones in parallel. The app also shows forbidden frequency ranges in red. E.g. LTE up/downstream ranges which meanwhile overlap with microphone frequency bands. Currently the app only supports these frequency ranges for Germany. Other countries will follow.

### Connection
When starting the app, it automatically tries to detect the serial port to which the RF Explorer hardware is attached to. If this doesn't work, you can open the "**Port**" menu and select the corresponding port manually. In case there is still no display, please restart the app or press **\<CTRL>\<R>**. It looks like sometimes the serial ports are not detected properly by the underying Electron framework.

### UI Description
It is possible to show/hide each of the displayed graphs:

* realtime scan
* forbidden areas
* recommended channels
* congested/forbidden channels

by clicking the corresponding entry in the legend on top.

The following mouse/keyboard commands zoom/move the frequency range:

* **Mouse wheel scroll OR Arrow up/down** zooms in/out of the waveform. Which means decreasing/increasing the span width of the spectrum analyzer

* **Mouse wheel tilt OR Arrow left/right** moves the frequency range down-/upwards

* **\<CTRL> Arrow left/right** toggles between Vendor channel presets withing the seleted vendor specific frequency band.
