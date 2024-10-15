# market_tools


1. 安装  
根目录下运行命令 npm install   

2. 配置  
在 src/config.js 中 配置proxy 的端口为本地vpn的端口
const proxy = process.env.http_proxy || 'http://127.0.0.1:49183' // HTTP/HTTPS proxy  

在 src/config.js 中 配置repository_path 为本地项目的根目录  
const repository_path = '/Users/song/Home/Code/github.com/market_tools/'  

3. 初始化数据库  
根目录下运行命令 node src/db_init.js

4. 执行K线对比  
根目录下运行命令 node src/calculate_range.js 10  
说明，最后的数字10是指对比过去10个小时内所有的K线波动幅度，可选的范围是1-500  
此命令会先下载所有币种的近期K线  

5. 其他配置  
在 src/calculate_range.js 中 有个参数为 const N = 1.5; // 标准差倍数值  
本工具的目的是筛选出波动大的币种，如果N越大，则筛选出的越少，反之，则越多，可以在1-2之间调整  

另：输出结果中会一直包含BTC和ETH的波动幅度
