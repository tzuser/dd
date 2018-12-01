const puppeteer = require("puppeteer");
const fs = require("fs");
const QrCode = require("qrcode-reader");
const Jimp = require("jimp");
const qrcode = require("qrcode-terminal");
const crypto = require("crypto");
const path = require("path");
const ProgressBar = require('progress');

let dataDir = path.join(__dirname, "./data");
//深度
let depth = 0;
let depthData = {'ac323abd9705e4c39dc8ead329b19e13':9,'ad896e254691ff6072a39488015f0353':10};

let userNameData = {
  Name: "name",
  "Phone Number": "phone",
  "Ding Mail": "email",
  Department: "department",
  中药名: "nick",
  Title: "title",
  Extension: "extension",
  职称: "jobTitle",
  岗位: "post",
  专业: "profession"
};

function getHash(name) {
  let key = crypto
    .createHash("md5")
    .update(name)
    .digest("hex");
  return key.toString();
}

function showQrcode() {
  var buffer = fs.readFileSync(__dirname + "/qrcode.jpg");
  Jimp.read(buffer, function(err, image) {
    if (err) {
      console.error(err);
    }
    var qr = new QrCode();
    qr.callback = function(err, value) {
      if (err) {
        console.error(err);
      }
      qrcode.generate(value.result, { small: true });
    };
    qr.decode(image.bitmap);
  });
}

//获取联系人
async function getUser(page, item) {
  await item.click();
  await page.waitFor(500);
  let box;
  try {
    box = await page.waitForSelector(".detail-box");
  } catch (err) {
    console.log('get User Error')
    return null;
  }
  let items = await box.$$(".box-item");
  let user = {};

  for (let item of Object.values(items)) {
    let value = await item.$eval(".cnt", node => node.innerText).catch(err => {
      console.log("null cnt");
    });
    let name = await item.$eval(".label", node => node.innerText).catch(err => {
      console.log("null label");
    });
    if (name) {
      user[userNameData[name]] = value;
    }
  }
  await (await page.$(".dialog-close")).click();
  await page.waitFor(500);
  return user;
}

async function goBack(page) {
  depth--;
  let btns = await page.$$(".breadcrumb-wrapper li>a");
  let tageButton = btns[btns.length - 1];
  if (!tageButton) {
    return false;
  }
  console.log("←");
  await tageButton.click();
  return true;
}

async function getUserList(page, userList, tree, id) {
  let index=0;
  var bar = new ProgressBar(':bar', { total: userList.length });
  for (let item of Object.values(userList)) {
    bar.tick();
    let user = await getUser(page, item);
    if (!user || !user.name) continue;
    let userID = getHash(`${user.name}${user.phone}`);
    tree[userID] = {
      id: userID,
      ...user,
      pid: id,
      type: "user"
    };
    index++
  }
}

async function getPathString(page) {
  let currentWrapper = await page.$$(".breadcrumb-wrapper li");
  let currentName;
  let pathString = "";
  for (let item of Object.values(currentWrapper)) {
    let name;
    try {
      name = await item.$eval("span", node => node.innerText);
    } catch (err) {
      name = await item.$eval("a", node => node.innerText);
    }
    currentName = name;
    pathString = `${pathString},${name}`;
  }
  return { pathString, currentName };
}
async function gotoBottom(page){
  let preScrollHeight = 0;
  let scrollHeight = -1;
    while(preScrollHeight !== scrollHeight) {
      // 详情信息是根据滚动异步加载，所以需要让页面滚动到屏幕最下方，通过延迟等待的方式进行多次滚动
      let scrollH1 = await page.evaluate(async () => {
          let box=document.querySelector(".org-member-inner.ng-isolate-scope")
          let h1 = box.scrollHeight;
          box.scrollTo(0, h1);
          return h1;
      });
      await page.waitFor(1000);
      let scrollH2 = await page.evaluate(async () => {
        let box=document.querySelector(".org-member-inner.ng-isolate-scope")
        return box.scrollHeight;
      });
      let scrollResult = [scrollH1, scrollH2];
      preScrollHeight = scrollResult[0];
      scrollHeight = scrollResult[1];
  }
}

async function find(page, tree, pid, isSave = true) {
  let list = await getList(page);
  let nextList = [];
  let userList = [];
  let { pathString, currentName } = await getPathString(page);
  console.log(currentName,list.length);
  let id = getHash(pathString); //getID
  if (isSave) {
    tree[id] = { id, name: currentName, type: "dir", pid };
  }
  
  //let isSearch=depth==0?false:true;
  for (let [key, item] of Object.entries(list)) {
    let name = await item
      .$eval(".name", node => node.innerText)
      .catch(err => {});

    if (!name) continue;
    let title = await item
      .$eval(".title", node => node.innerText)
      .catch(err => {});

    //是否有头像
    let avatar = await item.$(".avatar");
    if (avatar) {
      userList.push(item);
    } else {
      nextList.push(item);
    }
  }

  let users, isEnd;
  // 到底了
  if (nextList.length == 0) {
    console.log("__");
    // 获取用户
    await getUserList(page, userList, tree, id);

    isEnd = !(await goBack(page));
    if (isEnd) {
      console.log('-----------END------------')
      fs.writeFileSync(path.join(dataDir, "data.json"), JSON.stringify(tree));
      return;
    }
    return find(page, tree, id, false);
  } else {
    console.log("→");
    depth++;
    if (depthData[id] === undefined) {
      depthData[id] = 0;
    } else {
      depthData[id] += 1;
    }
    let index = depthData[id];
    let currentItem = nextList[index];

    if (!currentItem) {
      console.log("List到底了");
      await getUserList(page, userList, tree, id);
      isEnd = !(await goBack(page));
      if (isEnd) {
        console.log('-----------END2------------')
        fs.writeFileSync(path.join(dataDir, "data.json"), JSON.stringify(tree));
        return;
      }
      return find(page, tree, id, false);
    }
    await currentItem.click();
    return find(page, tree, id);
  }
}

async function getList(page) {
  await page.waitFor(1000)
  //滚动到最底部
  await gotoBottom(page)
  let TopList = await page.waitForSelector(
    ".org-member-inner-content .member-lists",
    {
      timeout: 2000
    }
  );
  return await TopList.$$("li");
}

(async () => {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1100, height: 600 }
  });
  const page = await browser.newPage();
  let pageIndex = 0;
  let chapterIndex = 0;
  await page.goto("https://im.dingtalk.com/");
  //查找二维码
  let qrcodeHandle = await page.waitForSelector(".qrcode-wrapper");
  //下载二维码图片
  await qrcodeHandle.screenshot({
    path: "qrcode.jpg",
    type: "jpeg"
  });
  console.log("请扫描二维码");
  await page.waitFor(1000);
  showQrcode();

  page.on("domcontentloaded", e => {
    console.log("domcontentloaded");
  });

  page.on("request", async request => {
    //等待扫描登录
    if (request.url().startsWith("https://login.dingtalk.com/login")) {
      console.log("正在登录...");
      let dialogCloseBtn = await page
        .waitForSelector(".dialog .close", { timeout: 500 })
        .catch(err => {
          console.log("没弹框");
        });
      if (dialogCloseBtn) await dialogCloseBtn.click();

      let contactBtn = await page
        .waitForSelector(".menu-item.menu-contact")
        .catch(err => {
          console.log("没找到联系人");
        });
      await page.waitFor(1000);
      await contactBtn.click();
      await contactBtn.click();
      // 架构
      let jgBtn = await page
        .waitForSelector(".dept-name", { timeout: 3000 })
        .catch(err => {
          console.log("没找到架构");
        });
      await jgBtn.click();
      const stepPath = path.join("step.json");
      let tree = {};
      if (fs.existsSync(stepPath)) {
        let stepData = JSON.parse(fs.readFileSync(stepPath, "utf8"));
        tree = stepData.tree;
        depthData = stepData.depthData;
      }
      try {
        await find(page, tree, 0);
      } catch (err) {
        console.error(err);
        fs.writeFileSync(stepPath, JSON.stringify({ tree, depthData }));
      }
    }
  });
  browser.on("targetcreated", e => {
    console.log(e);
  });

  //await browser.close();
})();
