import test from 'node:test';
import assert from 'node:assert/strict';
import {identityOptions,selectedProfile} from '../src/gateway-settings.mjs';

test('a different compatible USB adapter keeps its actual VID/PID and serial identity after port reassignment',()=>{
  const devices=[{port:'COM18',vid:0x10c4,pid:0xea60,serialNumber:'sensor-A',location:'1-3'},
    {port:'COM19',vid:null,pid:null,serialNumber:'',location:''}];
  const profile={vid:0x483,pid:0x5740,baud:115200};
  assert.equal(identityOptions(devices,profile).length,0);
  const options=identityOptions(devices,profile,{allUsb:true});
  assert.equal(options.length,1);
  const saved=selectedProfile(profile,options[0].value);
  assert.equal(saved.vid,0x10c4);assert.equal(saved.pid,0xea60);
  assert.equal(saved.serialNumber,'sensor-A');assert.equal(saved.baud,115200);
  assert.throws(()=>selectedProfile(profile,JSON.stringify({vid:1,pid:-1})));
});
test('cross-platform USB choices retain identity instead of an author COM number',()=>{
  const profile={vid:1155,pid:22336,enabled:true};
  const options=identityOptions([
    {port:'COM25',vid:1155,pid:22336,serialNumber:'A'},
    {port:'/dev/cu.usbmodem9510',vid:1155,pid:22336,serialNumber:'B'},
    {port:'COM7',vid:null,pid:null},
  ],profile);
  assert.equal(options.length,2);
  assert.deepEqual(selectedProfile(profile,options[1].value),
    {...profile,serialNumber:'B',location:''});
  assert.equal(Object.hasOwn(selectedProfile(profile,options[1].value),'port'),false);
});
test('USB adapters without a serial may be selected by location and returned to auto',()=>{
  const profile={vid:6790,pid:29987,serialNumber:'',location:''};
  const [option]=identityOptions([{port:'/dev/cu.wchusbserial1',vid:6790,pid:29987,location:'1-9'}],profile);
  assert.equal(selectedProfile(profile,option.value).location,'1-9');
  assert.equal(selectedProfile(profile,'{}').location,'');
});
