import {loadPyodide} from './pyodide.mjs';
let ready;
async function initialize(){
  const py=await loadPyodide({indexURL:new URL('./',import.meta.url).href});
  const response=await fetch(new URL('./reviewed-data.zip?v=7a40e412531346b2',import.meta.url));
  if(!response.ok)throw Error('已发布底表未能加载，请刷新重试。');
  py.unpackArchive(new Uint8Array(await response.arrayBuffer()),'zip',{extractDir:'/published'});
  py.runPython("import sys\nsys.path.insert(0,'/published/business/decision-engine')\nimport browser_bridge");
  return py;
}
const queue=[],cancelled=new Set();let running=false;
async function drain(){
  if(running||!queue.length)return;running=true;
  const {id,request}=queue.shift();
  try{
    if(cancelled.delete(id))return;
    ready??=initialize();const py=await ready;
    if(cancelled.delete(id))return;
    py.globals.set('_published_request',JSON.stringify(request));
    const result=py.runPython('browser_bridge.dispatch(_published_request)');
    self.postMessage({id,result:JSON.parse(result)});
  }catch(e){self.postMessage({id,result:{status:500,data:{error:'网页计算未完成：'+e.message}}});}
  finally{running=false;setTimeout(drain,0);}
}
self.onmessage=event=>{
  if(event.data.cancel){cancelled.add(event.data.cancel);return;}
  queue.push(event.data);setTimeout(drain,0);
};
