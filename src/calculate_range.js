"use strict"

import bn_usdm from './binance_usdm.js'
import db from './database.js'
import windows from './windows.js'

const N = 1.5; // 标准差倍数值
const symbols = bn_usdm.bn_syms

const args = process.argv.slice(2); // 获取命令行参数，去掉前两个默认参数
const inputNumber = parseInt(args[0], 10); // 解析整数参数
const hours = isNaN(inputNumber) ? 24 : inputNumber; // 设置默认值

function calculateMean(values) {
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
}
    
function calculateStandardDeviation(values, mean) {
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function get_highly_volatile_coin( n_hours ) {
    const allWinValues_2 = [];

    for (const symbol of symbols) {
      const candles = await db.getRecordsFromLastNHours(symbol, n_hours);
      const win = windows.calculate_window(candles);
      allWinValues_2.push({ symbol, win });   // 将 win 对象和对应的 symbol 存储在数组中
    }

    const allWinValues = allWinValues_2.filter(item => item.win)

    // allWinValues.sort((a, b) => a.win.index - b.win.index); 
    
    // 计算所有 win.index 的标准差
    const indices = allWinValues.map(item => item.win.index);
    const meanIndex = calculateMean(indices);
    const stdDev = calculateStandardDeviation(indices, meanIndex);

    console.log('平均幅度: ' + meanIndex.toFixed(2) + '\n标准差倍数: ' + N  + '\n')
    
    // 筛选落在 N 倍标准差范围之外的 win 值
    const outliers = allWinValues.filter(item => 
        item.symbol === 'BTC' || item.symbol === 'ETH' || 
        item.win.index < meanIndex - N * stdDev || item.win.index > meanIndex + N * stdDev
    );

    // const outliers = allWinValues
    
    outliers.sort((a, b) => a.win.index - b.win.index); // 根据 win 的 index 属性进行排序

    // 打印 outliers 中每个值的 symbol 和对应的 win.index
    outliers.forEach(item => {
        console.log(`${item.symbol.padEnd(10)} ${String(item.win.index).padStart(5)}`);
    });

}

await bn_usdm.check_and_fetch_kline('1h')

await get_highly_volatile_coin( hours )

