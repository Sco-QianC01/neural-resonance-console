const DATABASE_NAME='neural-resonance-eeg';
const STORE_NAME='directories';
const HANDLE_KEY='eeg-data';

function openDatabase(indexedDB=globalThis.indexedDB){
  if(!indexedDB)throw new Error('IndexedDB is unavailable');
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE_NAME,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error??new Error('Could not open EEG directory storage'));
  });
}

export async function saveEEGDirectoryHandle(handle,indexedDB=globalThis.indexedDB){
  const database=await openDatabase(indexedDB);
  try{
    await new Promise((resolve,reject)=>{
      const transaction=database.transaction(STORE_NAME,'readwrite');
      transaction.objectStore(STORE_NAME).put(handle,HANDLE_KEY);
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error??new Error('Could not save EEG directory handle'));
      transaction.onabort=()=>reject(transaction.error??new Error('EEG directory handle storage was aborted'));
    });
  }finally{database.close();}
}

export async function loadEEGDirectoryHandle(indexedDB=globalThis.indexedDB){
  const database=await openDatabase(indexedDB);
  try{
    return await new Promise((resolve,reject)=>{
      const transaction=database.transaction(STORE_NAME,'readonly');
      const request=transaction.objectStore(STORE_NAME).get(HANDLE_KEY);
      request.onsuccess=()=>resolve(request.result??null);
      request.onerror=()=>reject(request.error??new Error('Could not restore EEG directory handle'));
      transaction.onabort=()=>reject(transaction.error??new Error('EEG directory handle lookup was aborted'));
    });
  }finally{database.close();}
}

export async function hasEEGDirectoryPermission(handle,{request=false}={}){
  if(!handle)return false;
  if(request&&typeof handle.requestPermission==='function')
    return await handle.requestPermission({mode:'readwrite'})==='granted';
  if(typeof handle.queryPermission!=='function')return true;
  return await handle.queryPermission({mode:'readwrite'})==='granted';
}
