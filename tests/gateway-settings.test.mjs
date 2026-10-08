import test from 'node:test';
import assert from 'node:assert/strict';
import {identityOptions,selectedProfile} from '../src/gateway-settings.mjs';
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
