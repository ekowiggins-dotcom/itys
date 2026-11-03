import {test} from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';
import {storage} from '../lib/storage';
test('database location: explicit dir, Railway volume, or local (not persistent in production)',()=>{
 assert.deepEqual(storage({PREDICTION_DATA_DIR:'/x'}),{dir:'/x',persistent:true,source:'PREDICTION_DATA_DIR'});
 assert.deepEqual(storage({RAILWAY_VOLUME_MOUNT_PATH:'/data'}),{dir:'/data/postgres',persistent:true,source:'railway-volume'});
 assert.equal(storage({NODE_ENV:'production'}).persistent,false);
 assert.deepEqual(storage({NODE_ENV:'development'}),{dir:path.join(process.cwd(),'.data/postgres'),persistent:true,source:'local'});
});
