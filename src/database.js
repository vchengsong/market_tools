"use strict";

import cfg from './config.js'
import { Sequelize, DataTypes, Op } from "sequelize"

const sequelize = new Sequelize({
    dialect: 'sqlite',
    logging: false,
    // storage: '../data/database.sqlite'
    storage: cfg.db_file 
});

// --- table 1 ---
const TbCandleOneHour = sequelize.define('CandleOneHour', {
  symbol:    { type: DataTypes.STRING(15), allowNull: false },  
  timestamp: { type: DataTypes.DATE,  allowNull: false},
  open :     { type: DataTypes.FLOAT, allowNull: false},
  high:      { type: DataTypes.FLOAT, allowNull: false},
  low:       { type: DataTypes.FLOAT, allowNull: false},
  close:     { type: DataTypes.FLOAT, allowNull: false},
  volume:    { type: DataTypes.FLOAT, allowNull: false},
}, {
  tableName: 'CandleOneHour',
  timestamps: false, 
  indexes: [{
      unique: true,
      fields: ['symbol', 'timestamp'],},
  ],
}); 

async function tb_k1h_insert( symbol, ohlvc ){ // 插入或更新
    await TbCandleOneHour.upsert({
        symbol:    symbol,
        timestamp: ohlvc[0],
        open:      ohlvc[1],
        high:      ohlvc[2],
        low:       ohlvc[3],
        close:     ohlvc[4],
        volume:    ohlvc[5],
    })
}

async function tb_k1h_insert_bulk( symbol, ohlcvs ) {
    let sym = symbol.split('/')[0]

    let insert_data = []
    for( let itr in ohlcvs ){
      let ohlvc = ohlcvs[itr]
      insert_data.push({
        symbol:    sym,
        timestamp: ohlvc[0],
        open:      ohlvc[1],
        high:      ohlvc[2],
        low:       ohlvc[3],
        close:     ohlvc[4],
        volume:    ohlvc[5],
      })
    }

    await TbCandleOneHour.bulkCreate(insert_data, {
      updateOnDuplicate: ['symbol', 'timestamp'], // 指定冲突时更新的字段
    })
}

async function tb_k1h_get_last_timestamp( symbol ) {
    const result = await TbCandleOneHour.findOne({
        where: {
          symbol: symbol, 
        },
        order: [
          ['timestamp', 'DESC'], // 按 timestamp 降序排列
        ],
    });
    
    if (result) {
      return result.timestamp
    } 
    return 0
}

async function tb_k1h_get_syms_timestamps( symbols ) {
    const results = await TbCandleOneHour.findAll({
      attributes: ['symbol', [sequelize.fn('MAX', sequelize.col('timestamp')), 'maxTimestamp']],
      where: {
        symbol: symbols,
      },
      group: ['symbol'],
    });

    const maxTimestamps = [];
    results.forEach(result => {
      maxTimestamps.push([result.symbol, result.getDataValue('maxTimestamp')]);
    });

    return maxTimestamps;
}

async function tb_k1h_fetch_candles(symbol, limit) {
  const candles = await TbCandleOneHour.findAll({
    where: {
      symbol: symbol,
    },
    order: [
      ['timestamp', 'DESC'], // 按 timestamp 倒序排列
    ],
    limit: limit, // 返回的行数限制
  });

  const candleArray = candles.map(candle => [
    candle.timestamp,
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
  ]);

  return candleArray;
}

async function getRecordsFromLastNHours(symbol, N) {
    const endTime = new Date(); // 当前时间
    const startTime = new Date(endTime.getTime() - N * 60 * 60 * 1000); // N 小时前的时间

    try {
      const candles = await TbCandleOneHour.findAll({
        where: {
          symbol: symbol,
          timestamp: {
            [Op.between]: [startTime, endTime],
          },
        }, 
        order: [
          ['timestamp', 'DESC'], // 按 timestamp 降序排列
        ],
      });


    const candleArray = candles.map(candle => [
      candle.timestamp,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
    ]);

    return candleArray;
  } catch (error) {
    console.error('Error fetching records:', error);
    throw error; // 重新抛出错误以便处理
  }
}


async function tb_k1h_clear_old( days = 30 ){
  const currentTimestamp = Date.now();
  const DaysAgo = currentTimestamp - days * cfg.day_m; 

  TbCandleOneHour.destroy({
    where: {
      timestamp: {
        [Sequelize.Op.lt]: new Date(DaysAgo),
      },
    },
  })
}


// --- table 2 ---
export const TbAlert = sequelize.define('Alert', {
  id:    { type: DataTypes.INTEGER, primaryKey: true,  autoIncrement: true, allowNull: false },
  symbol:{ type: DataTypes.STRING(15), allowNull: false },  
  window:{ type: DataTypes.STRING(2), allowNull: false},  // one of '4h','1d','7d'
  level: { type: DataTypes.STRING(2), allowNull: false},  // one of 'L1','L2'
  change:{ type: DataTypes.FLOAT, allowNull: false},
  timestamp:{ type: DataTypes.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),allowNull: false},
}, {
  tableName: 'Alert',
  timestamps: false, 
  indexes: [
    {
      unique: false,
      fields: ['symbol', 'window', 'level'],
    },
  ],
}); 

async function tb_alert_insert( symbol, win, level, change ){
  await TbAlert.create({
    symbol: symbol,
    window: win,
    level:  level,
    change: change
  })
}

async function tb_alert_get_recent( symbol, win, level ){
  const result = await TbAlert.findOne({
      where: {
        symbol: symbol, 
        window: win,
        level:  level
      },
      order: [
        ['timestamp', 'DESC'], // 按 timestamp 降序排列
      ],
  });
  
  if (result) {
    return result.timestamp
  } 
  return 0
}

async function tb_alert_clear_old( days = 7 ){
  const currentTimestamp = Date.now();
  const DaysAgo = currentTimestamp - days * cfg.day_m; 

  TbAlert.destroy({
    where: {
      timestamp: {
        [Sequelize.Op.lt]: new Date(DaysAgo),
      },
    },
  })
}

// -- loop --
async function loop_db_clear(){
  let sleep_length = 24 * cfg.hour_m

  while ( true ) {
      try {
        await tb_k1h_clear_old()
        await tb_alert_clear_old()  
        
        console.log(cfg.date_time() + "loop - 4h - loop_db_clear")
        await new Promise(r => setTimeout(r, sleep_length));
      } catch (e) { console.error(e);}
  }
}

// -- init --
async function init() {
  await sequelize.sync({ force: true }); // 注意：force:true会删除已存在的表
}


// --- exports ---
export default {
  init,

  tb_k1h_insert_bulk,
  tb_k1h_get_last_timestamp,
  tb_k1h_get_syms_timestamps,
  tb_k1h_fetch_candles,
  getRecordsFromLastNHours,

  tb_alert_insert,
  tb_alert_get_recent,

  loop_db_clear,
}

