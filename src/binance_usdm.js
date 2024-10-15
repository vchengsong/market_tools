"use strict";

import fs from 'fs'
import ccxt from 'ccxt'
import cfg from './config.js'
import db from './database.js'

let agent = cfg.proxy_agent

// token pairs
let bn_pairs = [] // binance USDT spot token pairs
let bn_syms = []

let minute = 60 * 1000
let hour = 60 * minute
let day = 24 * hour
let max_life_1h = 30 * day        // 即30天, 用于定期删除旧数据
let original_since_1h = 20 * day  // 即20天，请求数据时使用
let original_since_1d = 180 * day 
let request_interval = 60 * minute


let time_file = cfg.timestamp_file
function recordCurrentTime() {
    const currentTime = new Date().toISOString();
    fs.writeFileSync(time_file, currentTime);
}

function calculateTimeDifference() {
    if (!fs.existsSync(time_file)) {
        return 100 * minute; // 文件不存在，返回 100分钟
    }

    const recordedTime = fs.readFileSync(time_file, 'utf-8');
    const recordedDate = new Date(recordedTime);
    const currentDate = new Date();
  
    const time_Diff = currentDate - recordedDate; // 时间差，单位为毫秒
    return time_Diff;

    // const minutes_Diff = Math.floor(time_Diff / 1000 / 60); // 转换为分钟
}
  

// --- data format ---
//kline tohlcv: [[1677650700000,0.10716,0.10716,0.10716,0.10716,2251],[1677651000000,0.10779,0.10784,0.10779,0.10784,9274]

const exchange = new ccxt.pro.binanceusdm ({ agent })
exchange.enableRateLimit = true 


// --- market related functions ---
async function init(){
    let tickers = await exchange.fetchTickers()
    bn_pairs = filter_tickers( tickers )
    bn_syms = pairs_syms( bn_pairs )        // bn_syms  = ['BTC','ETH','DOGE']
}
await init()

function pairs_syms( pairs ){
    let syms = []
    for( let itr in pairs ){
        let symbol = pairs[itr]
        let sym = symbol.split('/')[0]
        syms.push(sym)
    }
    return syms
}

function filter_tickers( tickers ){
    const symbols = [];
  
    // 1. 交易量大于1000万美元
    for (const symbol in tickers) {
        const volume = tickers[symbol].quoteVolume;
        if (volume > 10_000_000) { // 1000万美元
            symbols.push({
                symbol: tickers[symbol].symbol,
                volume: volume,
            });
        }
    }

    // 2. 删除交易量排名的最后20名
    symbols.sort((a, b) => b.volume - a.volume);      // 按交易额度排序
    let symbols_2 =  symbols.slice(0, symbols.length - 20).map(item => item.symbol);     // 筛除最后20名

    // 3. 过滤出USDT交易对
    let usdt_pairs = get_symbols_by_tail(symbols_2, '/USDT:USDT')

    // 4. 过滤出不需要的交易对
    let filtered_pairs = filter_exclude(usdt_pairs, cfg.excluded_tokens)

    // 5. sort
    return filtered_pairs.sort()
}

function get_symbols_by_tail( symbols_a, tail ){  // tail should be '/USDT' or '/BUSD' etc.
    let res = []
    for( let itr in symbols_a ) {
        let sym = symbols_a[itr]
        if ( sym.length > 10 && sym.slice(-10) === tail )
            res.push( sym )
    }
    return res
}

function filter_exclude( symbols_a, excludes_a ) {
    let res = []
    for( let itr in symbols_a){
        let sym = symbols_a[itr]
        if ( ! excludes_a.includes(sym.split('/')[0]) ){
            res.push(sym)
        }
    }
    return res
}

function get_original_since( timeframe ){
    const intervals = {
        '1h':  original_since_1h,  
        '1d':  original_since_1d,  
    };
    return intervals[timeframe] || null; 
}


// ------------------------ fetch candles ------------------------
async function fetch_candle_since (exchange, symbol, timeframe, since) {
    let ohlcvs = []

    // 1. request exchange api
    while (true) {
        try {
            // fetch data
            const response = await exchange.fetchOHLCV (symbol, timeframe, since)
            if (response.length) {
                ohlcvs = ohlcvs.concat(response)

                // recalculate since and log
                const firstCandle = exchange.safeValue (response, 0)
                const last_candle = exchange.safeValue (response, response.length - 1)
                const firstTimestamp = exchange.safeInteger (firstCandle, 0)
                const lastTimestamp = exchange.safeInteger (last_candle, 0)
                const firstDatetime = exchange.iso8601 (firstTimestamp)
                const lastDatetime = exchange.iso8601 (lastTimestamp)
                const currentDatetime = exchange.iso8601 (exchange.milliseconds ())
                // 判断 lastTimestamp 看是否需要再次请求数据?
                since = lastTimestamp + 1
                console.log (currentDatetime, symbol, timeframe, 'fetched', response.length,
                    'candles since', firstDatetime, 'till', lastDatetime, 'total', ohlcvs.length)
                break
            } else {
                break
            }
        } catch (e) {
            console.log (e.constructor.name, e.message)
        }
        break
    }

    // 2. store to db
    await db.tb_k1h_insert_bulk( symbol, ohlcvs )
}

async function check_and_fetch_kline( timeframe ){
    const now = exchange.milliseconds ()

    let fetch = false
    let since = 0
    let last_candle_timestamp = await db.tb_k1h_get_last_timestamp('BTC')
    
    if (last_candle_timestamp == 0){
        since = now - get_original_since(timeframe);
        fetch = true
    } else if ( calculateTimeDifference() >= request_interval ) { // todo
        since = last_candle_timestamp - 1 // - 1 is importand! this can fetch last 2 candles, not 1
        fetch = true
    }

    if (fetch) {
        const results = await Promise.allSettled(
            bn_pairs.map(async symbol => {
              await cfg.delay_ms(50);
              return fetch_candle_since(exchange, symbol, timeframe, since);
            })
        );
        
        recordCurrentTime();
    }
}

// --- export ---
export default {
    bn_syms,
    check_and_fetch_kline
}







