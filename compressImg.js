// https://tinify.cn/dashboard/api
const TINIFYKEY = "8tDFVWHMZqj02PpFfnBXq82hqrDKyz0B";

const fs = require("fs");
const path = require("path");
// const exec = require("child_process").exec; //异步子进程
const execSync = require("child_process").execSync; //同步子进程

/** 获取文件大小 */
const getSize = (path) => fs.statSync(path).size / 1024;

const name = execSync("git show -s --format=%cn").toString().trim(); //姓名
const email = execSync("git show -s --format=%ce").toString().trim(); //邮箱
const diffContent = execSync("git diff --cached").toString().trim(); //diff后的内容

console.log(diffContent);

/** 获取新增的 png jpg 图片 */
const result = diffContent
  .match(/(?<=Binary files)(.+)(?=differ)/g)
  .map((item) => item?.includes(" and ") ? item.split(" and ")[1].trim() : '')
  .filter((item) => item.includes("jpg") || item.includes("png"))
  .map((item) => item.slice(1));

if (result.length === 0) {
  console.log("此次没有图片更新");
  return;
}

const tinify = require("tinify");
tinify.key = TINIFYKEY;

const sourceArr = [];
result.forEach(async(item) => {
  const imgPath = __dirname + item;
  const oldImgSize = getSize(imgPath);
  const source = tinify.fromFile(imgPath);
  // 删除原图片
  fs.unlinkSync(imgPath);
  sourceArr.push([source, imgPath, item, oldImgSize]);
});

Promise.all(sourceArr.map(([source, imgPath]) => source.toFile(imgPath)))
  .then(
  (values) => {
    if (values.every((item) => item === undefined)) {
      console.log("replace success");
      const filePath = sourceArr.reduce(
        ([, imgPath, pre, oldImgSize], [, , cur]) => {
          if (pre) {
            const newImgSize = getSize(imgPath);
            const diffSize = (newImgSize - oldImgSize).toFixed(1);
            console.log(
              `图片压缩之前大小：${oldImgSize}，图片压缩后的大小：${newImgSize}，缩小了约${diffSize}kb`
            );
            return `.${pre} .${cur}`;
          }
          return `.${cur}`;
        },
        ""
      );
      
      execSync(`git commit ${filePath} -m "replace image"`);
    }
  }
);
