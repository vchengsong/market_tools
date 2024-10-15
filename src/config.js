"use strict";

// consts
const minute_m = 60 * 1000 // 毫秒（millisecond）
const hour_m = 60 * minute_m
const day_m = 24 * hour_m

// -- proxy --
import HttpsProxyAgent from 'https-proxy-agent'
const proxy = process.env.http_proxy || 'http://127.0.0.1:49183' // HTTP/HTTPS proxy
const proxy_agent = new HttpsProxyAgent (proxy)

// -- database path --
const repository_path = '/Users/song/Home/Code/github.com/market_tools/'
const db_file = repository_path + 'data/database.sqlite'                // 使用绝对路径，不然调试时程序自己容易找不到
const timestamp_file = repository_path + '/data/request_time.txt'       // 使用绝对路径，不然调试时程序自己容易找不到



// -- excluded_tokens --
let excluded_tokens = []  // example ['ABC','DEF']


function date_time(){
    const formatter = new Intl.DateTimeFormat('zh-CN', { // 'en-US' 为美国式时间
        // year:  'numeric',
        // month: '2-digit',
        day:   '2-digit',
        hour:  '2-digit',
        minute:'2-digit',
    });

    return formatter.format(new Date()).replace(/ /g, '/') + ' '
}

function delay_ms(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// -- export --
export default {
    minute_m, hour_m, day_m,
    proxy_agent,
    excluded_tokens,
    date_time,
    delay_ms,
    db_file,
    timestamp_file,
}