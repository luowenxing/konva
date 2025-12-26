const fs = require('fs');

// 读取package.json文件
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// 读取要替换的文件内容
let fileContent = fs.readFileSync('./lib/Global.js', 'utf8');

// 替换字符串'@@version'为package.json中的version
fileContent = fileContent.replace('@@version', packageJson.version);

// 将替换后的内容写回文件
fs.writeFileSync('./lib/Global.js', fileContent, 'utf8');