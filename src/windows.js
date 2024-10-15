"use strict";

import cfg from './config.js'
import db from './database.js';

function calculate_window( candles ){
    let length = candles.length
    if ( !length ) return

    let win = {}
    let first_c = candles[length - 1] // oldest
    let last_c  = candles[0] // latest
    win.open  = first_c[1]
    win.high  = first_c[2]
    win.low   = first_c[3]
    win.close = last_c[4]
    
    // calculate high and low
    for ( let i = length - 2; i >= 0 ; i-- ){
        let high = candles[i][2]
        let low  = candles[i][3]
        win.high ?
            win.high = win.high < high ? high :win.high
            : win.high = high
        win.low ?
            win.low = win.low > low ? low : win.low
            : win.low = low
    }

    // three percentages
    win.change = parseFloat(((win.close - win.open) / win.open * 100).toFixed(2));
    win.amplitude = parseFloat(Math.abs( (win.high - win.low) / win.open * 100 ).toFixed(2));
    win.index = parseFloat((( win.amplitude + Math.abs(win.change) ) / 2).toFixed(2));
    if(win.change < 0){ 
        win.index = - win.index
        win.amplitude = - win.amplitude 
    }

    return win
}


// --- export ---
export default {
    calculate_window,
}
