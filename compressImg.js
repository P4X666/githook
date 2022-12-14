// https://tinify.cn/dashboard/api
const TINIFYKEY = "8tDFVWHMZqj02PpFfnBXq82hqrDKyz0B";
// 自定义的自动提交的 git commit message
const [messageStart, messageEnd] = [
  "auto commit message by",
  "replace image end",
];
/** 分隔符 */
const separator = "::";
/** 需要压缩的图片类型 */
const imgType = ["jpg", "png"]

const fs = require("fs");
const execSync = require("child_process").execSync; //同步子进程
const os = require("os");

/** 获取文件大小 */
const getSize = (path) => fs.statSync(path).size / 1024;
/** 记录日志 */
const recordText = (recordData) => {
  fs.appendFile("compressRecord.txt", recordData, (err) => {
    // 追加失败
    if (err) throw err;
    // 追加成功
    console.log("追加内容成功！");
  });
};

const name = execSync("git show -s --format=%cn").toString().trim(); //姓名
const email = execSync("git show -s --format=%ce").toString().trim(); //邮箱
const diffContent = execSync("git log -p -1").toString().trim(); //diff后的内容

if (!diffContent) {
  console.log("没有 diff 内容");
  return;
}

// 自动提交的容错处理 防止重复提交
if (diffContent.includes(messageStart)) {
  const autoMessage = diffContent.match(
    new RegExp(`(?<=${messageStart})(.+)(?=${messageEnd})`, "g")
  );
  const [userInfo] = autoMessage;
  if (userInfo.trim() && userInfo.includes(separator)) {
    const [userName, userEmail] = userInfo.split(separator);
    console.log("userName:", userName, "userEmail:", userEmail);
    if (userName.trim() === name) {
      console.log("该用户之前已经自动提交过了");
      return;
    }
  }
}

/** 获取新增的 png jpg 图片 */
const result =
  diffContent
    .match(/(?<=Binary files)(.+)(?=differ)/g)
    ?.map((item) =>
      item?.includes(" and ") ? item.split(" and ")[1].trim() : ""
    )
    ?.filter((item) => imgType.some(type => item.includes(type)))
    ?.map((item) => item.slice(1)) ?? [];

if (result.length === 0) {
  console.log("此次没有图片更新");
  return;
}

const tinify = require("tinify");
tinify.key = TINIFYKEY;

const sourceArr = [];
result.forEach((item) => {
  const imgPath = __dirname + item;
  const oldImgSize = getSize(imgPath);
  const source = tinify.fromFile(imgPath);
  // 删除原图片
  fs.unlinkSync(imgPath);
  sourceArr.push([source, imgPath, item, oldImgSize]);
});

Promise.all(sourceArr.map(([source, imgPath]) => source.toFile(imgPath))).then(
  (values) => {
    if (values.every((item) => item === undefined)) {
      let recordData = "";
      const filePath = sourceArr.reduce(
        (preItem, [, imgPath, cur, oldImgSize]) => {
          // 记录图片大小变化
          const newImgSize = getSize(imgPath);
          const diffSize = (oldImgSize - newImgSize).toFixed(1);
          recordData += `.${cur} 压缩之前大小：${oldImgSize}kb，压缩后的大小：${newImgSize}kb，缩小了约${diffSize}kb ${os.EOL}`;
          // 第一个不做处理
          if (preItem) {
            const [, , pre] = preItem;
            return `.${pre} .${cur}`;
          }
          return `.${cur}`;
        },
        ""
      );
      recordText(recordData);
      execSync(`git add ${filePath}`);
      execSync(
        `git commit -m "${messageStart} ${name} ${separator} ${email} ${messageEnd}"`
      );
      // execSync("git push origin master:master");
    } else {
      recordText(`
      压缩失败：${os.EOL}
        ${sourceArr.map(([, , relativePath]) => relativePath + ",")}
      `);
    }
  }
);
