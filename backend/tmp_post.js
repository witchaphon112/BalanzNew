const crypto = require('crypto');

(async()=>{
  try{
    const url = 'https://impactful-jolie-shoofly.ngrok-free.dev/webhooks/line';
    const secret = 'db5bf415547cac649f72a92d111ea700';
    const body = {events:[{type:'message',replyToken:'test',source:{userId:'U_TEST'},timestamp:Date.now(),message:{id:'1',type:'text',text:'จ่าย 120 ข้าวมันไก่'}}]};
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('base64');
    const res = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json','X-Line-Signature': sig}, body: raw });
    console.log('POST status', res.status);
    console.log(await res.text());
  }catch(e){
    console.error('post error', e);
  }
})();
