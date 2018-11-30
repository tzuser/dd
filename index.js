const puppeteer = require("puppeteer");
const fs = require("fs");
var QrCode = require("qrcode-reader");
var Jimp = require("jimp");
var qrcode = require("qrcode-terminal");


//深度
var depth=0;

let treeElement=[];
let depthData={};

function showQrcode() {
  var buffer = fs.readFileSync(__dirname + "/qrcode.jpg");
  Jimp.read(buffer, function(err, image) {
    if (err) {
      console.error(err);
      // TODO handle error
    }
    var qr = new QrCode();
    qr.callback = function(err, value) {
      if (err) {
        console.error(err);
        // TODO handle error
      }
      qrcode.generate(value.result, { small: true });
    };
    qr.decode(image.bitmap);
  });
}

//获取联系人
async function getUser(page,item){
  await item.click();
  await delay(500);
  let box=await page.waitForSelector(".detail-box");
  let items=await box.$$('.box-item');
  let user={};
  for(let [key,item] of Object.entries(items)){
    let value=await item.$eval(".cnt", node => node.innerText).catch(err => {
      console.log("null cnt");
    });
    let name=await item.$eval(".label", node => node.innerText).catch(err => {
      console.log("null label");
    });
    if(name){
      user[name]=value;
    }
  }
  await (await page.$('.dialog-close')).click();
  await delay(500);
  return user;
}

function setData(paths,data){

}

async function goBack(page){
  depth--;
  let btns=await page.$$('.breadcrumb-wrapper li');
  console.log(btns.length)
  debugger;
  await btns[btns.length-2].click();

}

async function find(page,tree){
  let list= await getList(page);
  depth++;
  console.log(depth)
  let nextList=[];
  let userList=[];
  for(let [key,item] of Object.entries(list)){
    let name = await item
      .$eval(".name", node => node.innerText)
      .catch(err => {
        console.log("null");
      });

    if(!name)continue;
    let title = await item
      .$eval(".title", node => node.innerText)
      .catch(err => {
        console.log("null");
      });
    //是否有头像
    let avatar = await item.$(".avatar");

    /*if(treeElement.includes(item))continue;
    treeElement.push(item);*/

    if (avatar) {
      //let user=await getUser(page,item);
      userList.push(item);
    } else {
      nextList.push(item);
    }
  }
  // 到底了
  if(nextList.length==0){
    console.log('到底了')
    // 获取用户
    /*for(let [key,item] of Object.entries(userList)){
      let user=await getUser(page,item);
      console.log(user);
    }*/
    await goBack(page)
    await page.screenshot({
      path: "back.jpg",
      type: "jpeg"
    });
    return find(page,tree)
  }else{
    console.log('下一级')
    if(depthData[depth]===undefined){
      depthData[depth]=0
    }else{
      depthData[depth]+=1;
    }
    let index=depthData[depth];
    await (await nextList[index]).click();
    return find(page,tree)
  }

 /* for(let [key,item] of Object.entries(nextList)){
    await find(item)
  }*/
}

async function getList(page){
  await delay(1000);
  let TopList = await page
    .waitForSelector(".org-member-inner-content .member-lists", {
      timeout: 1000
    })
    .catch(err => {
      console.log("没找到列表");
    });
  return (await TopList.$$("li"));
}


const delay = time => new Promise(resolve => setTimeout(resolve, time));
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
  await delay(500);
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
      await delay(1000);
      await contactBtn.click();
      await contactBtn.click();
      // 架构
      let jgBtn = await page
        .waitForSelector(".dept-name", { timeout: 3000 })
        .catch(err => {
          console.log("没找到架构");
        });
      await jgBtn.click();
      
      await find(page,{})
      
      page.screenshot({
        path: "login.jpg",
        type: "jpeg",
        fullPage: true
      });
    }
  });
  browser.on("targetcreated", e => {
    console.log(e);
  });

  //await browser.close();
})();

const getNextPage = async (page, chapterIndex, pageIndex) => {
  /* console.log(chapterIndex,pageIndex)
  await page.evaluate(() =>window.closd_tip(1));
  let imgHandle=await page.$('#center_box img');
  await imgHandle.screenshot({path: `img/page_${chapterIndex}_${pageIndex}.png`})

  let nextHandle=await page.$('#transit_div');
  await page.evaluate(() =>window.next_img());
  if(await page.$eval('#transit_div', node => node.style.display)=='none'){
    console.log('下一页')
    return getNextPage(page,chapterIndex,pageIndex+1)
  }else{
    console.log('下一章')
    let nextBtn=await page.$('#next_btn');
    nextBtn.click()
  }*/
};
