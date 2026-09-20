// 从工作区已有 node_modules 复制 three 自包含构建到本项目 vendor/
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', '..', 'node_modules', 'three', 'build', 'three.module.js');
const dst = path.join(__dirname, '..', 'vendor', 'three.module.js');
fs.copyFileSync(src, dst);
const size = fs.statSync(dst).size;
console.log('copied ' + size + ' bytes');
