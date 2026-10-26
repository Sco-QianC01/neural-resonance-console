import test from 'node:test';
import assert from 'node:assert/strict';
import {hasEEGDirectoryPermission,loadEEGDirectoryHandle,saveEEGDirectoryHandle} from '../src/eeg-directory.mjs';

function memoryIndexedDB(){
  const values=new Map();
  let initialized=false;
  const database={
    objectStoreNames:{contains:name=>name==='directories'&&initialized},
    createObjectStore(){initialized=true;},
    transaction(){
      const transaction={
        objectStore(){
          return {
            put(value,key){values.set(key,value);queueMicrotask(()=>transaction.oncomplete?.());},
            get(key){
              const request={result:values.get(key)};
              queueMicrotask(()=>request.onsuccess?.());
              return request;
            },
          };
        },
      };
      return transaction;
    },
    close(){},
  };
  return {open(){
    const request={result:database};
    queueMicrotask(()=>{
      if(!initialized)request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  }};
}

test('browser EEG save directory handle can be restored between page loads',async()=>{
  const indexedDB=memoryIndexedDB();
  const handle={name:'EEG Data'};
  await saveEEGDirectoryHandle(handle,indexedDB);
  assert.equal(await loadEEGDirectoryHandle(indexedDB),handle);
});

test('directory permission can be renewed from a connection gesture',async()=>{
  const calls=[];
  const handle={
    async queryPermission(options){calls.push(['query',options.mode]);return 'prompt';},
    async requestPermission(options){calls.push(['request',options.mode]);return 'granted';},
  };
  assert.equal(await hasEEGDirectoryPermission(handle),false);
  assert.equal(await hasEEGDirectoryPermission(handle,{request:true}),true);
  assert.deepEqual(calls,[['query','readwrite'],['request','readwrite']]);
});
